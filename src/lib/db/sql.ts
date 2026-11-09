import type { RepositorySnapshot, SqlStatement } from "@/lib/db/types";

const REPOSITORY_COLUMNS = [
  "github_id",
  "owner",
  "name",
  "full_name",
  "description",
  "html_url",
  "language",
  "visibility",
  "is_private",
  "is_archived",
  "default_branch",
  "stargazers_count",
  "forks_count",
  "open_issues_count",
  "pushed_at",
  "github_updated_at",
] as const;

export function buildAccountUpsert(account: { githubId: string; login: string; avatarUrl: string | null }): SqlStatement {
  return {
    text: `INSERT INTO github_accounts (github_id, login, avatar_url, last_seen_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (github_id) DO UPDATE SET
  login = EXCLUDED.login,
  avatar_url = EXCLUDED.avatar_url,
  last_seen_at = now()`,
    values: [account.githubId, account.login, account.avatarUrl],
  };
}

export function buildRepositoryUpsert(rows: readonly RepositorySnapshot[]): SqlStatement | null {
  if (!rows.length) return null;
  const width = REPOSITORY_COLUMNS.length;
  const values: unknown[] = [];
  const groups = rows.map((row, index) => {
    const start = index * width;
    values.push(
      row.githubId,
      row.owner,
      row.name,
      row.fullName,
      row.description,
      row.htmlUrl,
      row.language,
      row.visibility,
      row.isPrivate,
      row.isArchived,
      row.defaultBranch,
      row.stargazersCount,
      row.forksCount,
      row.openIssuesCount,
      row.pushedAt,
      row.githubUpdatedAt,
    );
    const placeholders = Array.from({ length: width }, (_, column) => `$${start + column + 1}`);
    return `(${placeholders.join(", ")}, now())`;
  });
  const assignments = REPOSITORY_COLUMNS.filter((column) => column !== "github_id")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");
  return {
    text: `INSERT INTO repositories (${REPOSITORY_COLUMNS.join(", ")}, synced_at)
VALUES ${groups.join(", ")}
ON CONFLICT (github_id) DO UPDATE SET
  ${assignments},
  synced_at = now()`,
    values,
  };
}

export function buildAccountRepositoryLinks(accountGithubId: string, repositoryGithubIds: readonly string[]): SqlStatement | null {
  if (!repositoryGithubIds.length) return null;
  const values: unknown[] = [];
  const groups = repositoryGithubIds.map((repositoryGithubId, index) => {
    const start = index * 2;
    values.push(accountGithubId, repositoryGithubId);
    return `($${start + 1}, $${start + 2}, now())`;
  });
  return {
    text: `INSERT INTO account_repositories (account_github_id, repository_github_id, synced_at)
VALUES ${groups.join(", ")}
ON CONFLICT (account_github_id, repository_github_id) DO UPDATE SET synced_at = now()`,
    values,
  };
}

export function buildAuditEvent(input: {
  accountGithubId: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
}): SqlStatement {
  return {
    text: `INSERT INTO audit_events (account_github_id, action, target, metadata)
VALUES ($1, $2, $3, $4::jsonb)`,
    values: [input.accountGithubId, input.action, input.target, JSON.stringify(input.metadata)],
  };
}
