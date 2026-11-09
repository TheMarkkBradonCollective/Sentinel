import { githubRequest, type GitHubRepo } from "@/lib/github";
import type { SentinelSession } from "@/lib/session";
import { databaseConfigured, describeRuntimeDatabase, logPersistenceFailure, queryRows, transaction } from "@/lib/db/client";
import { githubId, toRepositorySnapshot } from "@/lib/db/snapshots";
import { buildAccountRepositoryLinks, buildAccountUpsert, buildAuditEvent, buildRepositoryUpsert } from "@/lib/db/sql";
import type { PersistenceFailure, PersistenceResult, PersistenceStatus, PlanRunSummary, RepositoryInput, SqlStatement } from "@/lib/db/types";

const NOT_CONFIGURED: PersistenceFailure = {
  ok: false,
  reason: "not_configured",
  message: "DATABASE_URL is not set to a Neon connection string.",
};

type AccountIdentity = { githubId: string; login: string; avatarUrl: string | null };

function unavailable(message: string): PersistenceFailure {
  return { ok: false, reason: "unavailable", message };
}

function missingSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /schema_migrations|does not exist|42P01/i.test(message);
}

async function requireDatabase(): Promise<PersistenceFailure | null> {
  if (!(await databaseConfigured())) return NOT_CONFIGURED;
  return null;
}

export async function resolveGithubIdentity(session: SentinelSession): Promise<AccountIdentity> {
  if (session.githubId != null) {
    const id = githubId(session.githubId);
    if (id) return { githubId: id, login: session.login, avatarUrl: session.avatarUrl || null };
  }
  const user = await githubRequest<{ id: number; login: string; avatar_url: string }>(session, "/user");
  const id = githubId(user.id);
  if (!id) throw new Error("GitHub user id is not a safe integer.");
  return { githubId: id, login: user.login, avatarUrl: user.avatar_url || null };
}

async function write(action: string, statements: SqlStatement[]): Promise<PersistenceFailure | null> {
  const missing = await requireDatabase();
  if (missing) return missing;
  try {
    await transaction(statements);
    return null;
  } catch (error) {
    logPersistenceFailure(action, error);
    return unavailable("Database query failed.");
  }
}

export async function recordGithubConnection(account: AccountIdentity): Promise<PersistenceResult<{ githubId: string }>> {
  const failure = await write("github.connected", [
    buildAccountUpsert(account),
    buildAuditEvent({
      accountGithubId: account.githubId,
      action: "github.connected",
      target: account.login,
      metadata: { login: account.login },
    }),
  ]);
  if (failure) return failure;
  return { ok: true, data: { githubId: account.githubId } };
}

export async function syncRepositories(session: SentinelSession, repositories: readonly RepositoryInput[]): Promise<PersistenceResult<{ repositories: number }>> {
  const missing = await requireDatabase();
  if (missing) return missing;
  let account: AccountIdentity;
  try {
    account = await resolveGithubIdentity(session);
  } catch (error) {
    logPersistenceFailure("repositories.sync", error);
    return unavailable("Could not resolve the GitHub account.");
  }
  const snapshots = repositories.flatMap((repo) => {
    const snapshot = toRepositorySnapshot(repo);
    return snapshot ? [snapshot] : [];
  });
  const statements: SqlStatement[] = [buildAccountUpsert(account)];
  const upsert = buildRepositoryUpsert(snapshots);
  if (upsert) statements.push(upsert);
  const links = buildAccountRepositoryLinks(account.githubId, snapshots.map((snapshot) => snapshot.githubId));
  if (links) statements.push(links);
  const failure = await write("repositories.sync", statements);
  if (failure) return failure;
  return { ok: true, data: { repositories: snapshots.length } };
}

export async function recordHealthSnapshot(session: SentinelSession, repo: GitHubRepo, workflow: { name: string | null; status: string | null; conclusion: string | null }): Promise<PersistenceResult<{ repositoryGithubId: string }>> {
  const missing = await requireDatabase();
  if (missing) return missing;
  const snapshot = toRepositorySnapshot(repo);
  if (!snapshot) return unavailable("Repository metadata was rejected.");
  let account: AccountIdentity;
  try {
    account = await resolveGithubIdentity(session);
  } catch (error) {
    logPersistenceFailure("health.snapshot", error);
    return unavailable("Could not resolve the GitHub account.");
  }
  const upsert = buildRepositoryUpsert([snapshot]);
  const links = buildAccountRepositoryLinks(account.githubId, [snapshot.githubId]);
  if (!upsert || !links) return unavailable("Repository metadata was rejected.");
  const failure = await write("health.snapshot", [
    buildAccountUpsert(account),
    upsert,
    links,
    {
      text: `INSERT INTO health_snapshots (
  repository_github_id, latest_workflow_name, latest_workflow_status, latest_workflow_conclusion, open_issues_count, captured_at
) VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (repository_github_id) DO UPDATE SET
  latest_workflow_name = EXCLUDED.latest_workflow_name,
  latest_workflow_status = EXCLUDED.latest_workflow_status,
  latest_workflow_conclusion = EXCLUDED.latest_workflow_conclusion,
  open_issues_count = EXCLUDED.open_issues_count,
  captured_at = now()`,
      values: [snapshot.githubId, workflow.name, workflow.status, workflow.conclusion, snapshot.openIssuesCount],
    },
  ]);
  if (failure) return failure;
  return { ok: true, data: { repositoryGithubId: snapshot.githubId } };
}

export async function recordPlanRun(session: SentinelSession, run: {
  repositoryFullName: string;
  provider: string;
  branch: string;
  baseBranch: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  commitSha: string | null;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
}): Promise<PersistenceResult<{ recorded: true }>> {
  const missing = await requireDatabase();
  if (missing) return missing;
  if (!["cursor", "chatgpt", "claude"].includes(run.provider)) return unavailable("Plan run metadata was rejected.");
  if (!Number.isInteger(run.pullRequestNumber) || run.pullRequestNumber <= 0) return unavailable("Plan run metadata was rejected.");
  let account: AccountIdentity;
  try {
    account = await resolveGithubIdentity(session);
  } catch (error) {
    logPersistenceFailure("plan.committed", error);
    return unavailable("Could not resolve the GitHub account.");
  }
  const counts = [run.addedCount, run.removedCount, run.updatedCount].map((value) => Math.max(0, Math.trunc(value)));
  const failure = await write("plan.committed", [
    buildAccountUpsert(account),
    {
      text: `INSERT INTO plan_runs (
  account_github_id, repository_full_name, provider, branch, base_branch,
  pull_request_url, pull_request_number, commit_sha, added_count, removed_count, updated_count
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values: [
        account.githubId,
        run.repositoryFullName.slice(0, 200),
        run.provider,
        run.branch.slice(0, 200),
        run.baseBranch.slice(0, 255),
        run.pullRequestUrl.slice(0, 2048),
        run.pullRequestNumber,
        run.commitSha ? run.commitSha.slice(0, 64) : null,
        counts[0],
        counts[1],
        counts[2],
      ],
    },
    buildAuditEvent({
      accountGithubId: account.githubId,
      action: "plan.committed",
      target: run.repositoryFullName.slice(0, 200),
      metadata: {
        provider: run.provider,
        branch: run.branch.slice(0, 200),
        pullRequestNumber: run.pullRequestNumber,
        added: counts[0],
        removed: counts[1],
        updated: counts[2],
      },
    }),
  ]);
  if (failure) return failure;
  return { ok: true, data: { recorded: true } };
}

function asInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

export async function readPersistenceStatus(session: SentinelSession): Promise<PersistenceStatus> {
  const described = await describeRuntimeDatabase();
  if (!described.configured) {
    return {
      configured: false,
      reachable: false,
      pooled: false,
      database: null,
      migrations: [],
      counts: null,
      recentPlanRuns: [],
      reason: "not_configured",
    };
  }
  try {
    const [databaseRows, migrationRows] = await Promise.all([
      queryRows<{ database: string }>("SELECT current_database() AS database"),
      queryRows<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version"),
    ]);
    if (!databaseRows || !migrationRows) {
      return {
        configured: true,
        reachable: false,
        pooled: described.pooled,
        database: described.databaseName,
        migrations: [],
        counts: null,
        recentPlanRuns: [],
        reason: "unavailable",
      };
    }
    let account: AccountIdentity;
    try {
      account = await resolveGithubIdentity(session);
    } catch (error) {
      logPersistenceFailure("persistence.status", error);
      return {
        configured: true,
        reachable: true,
        pooled: described.pooled,
        database: databaseRows[0]?.database ?? described.databaseName,
        migrations: migrationRows.map((row) => String(row.version)),
        counts: null,
        recentPlanRuns: [],
        reason: "unavailable",
      };
    }
    const [counts, recent] = await Promise.all([
      queryRows<{ repositories: number; plan_runs: number; audit_events: number }>(
        `SELECT
          (SELECT count(*)::int FROM account_repositories WHERE account_github_id = $1) AS repositories,
          (SELECT count(*)::int FROM plan_runs WHERE account_github_id = $1) AS plan_runs,
          (SELECT count(*)::int FROM audit_events WHERE account_github_id = $1) AS audit_events`,
        [account.githubId]
      ),
      queryRows<{ provider: string; branch: string; pull_request_number: number; pull_request_url: string; created_at: string }>(
        `SELECT provider, branch, pull_request_number, pull_request_url, created_at
         FROM plan_runs
         WHERE account_github_id = $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [account.githubId]
      ),
    ]);
    const recentPlanRuns: PlanRunSummary[] = (recent ?? []).map((row) => ({
      provider: String(row.provider),
      branch: String(row.branch),
      pullRequestNumber: asInt(row.pull_request_number),
      pullRequestUrl: String(row.pull_request_url),
      createdAt: asIso(row.created_at),
    }));
    return {
      configured: true,
      reachable: true,
      pooled: described.pooled,
      database: databaseRows[0]?.database ?? described.databaseName,
      migrations: migrationRows.map((row) => String(row.version)),
      counts: counts?.[0]
        ? {
            repositories: asInt(counts[0].repositories),
            planRuns: asInt(counts[0].plan_runs),
            auditEvents: asInt(counts[0].audit_events),
          }
        : null,
      recentPlanRuns,
    };
  } catch (error) {
    logPersistenceFailure("persistence.status", error);
    return {
      configured: true,
      reachable: false,
      pooled: described.pooled,
      database: described.databaseName,
      migrations: [],
      counts: null,
      recentPlanRuns: [],
      reason: missingSchema(error) ? "not_migrated" : "unavailable",
    };
  }
}
