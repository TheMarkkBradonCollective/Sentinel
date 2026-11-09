export type PersistenceReason = "not_configured" | "not_migrated" | "unavailable";

export type PersistenceFailure = {
  ok: false;
  reason: PersistenceReason;
  message: string;
};

export type PersistenceOk<T> = { ok: true; data: T };

export type PersistenceResult<T> = PersistenceOk<T> | PersistenceFailure;

export type RepositoryInput = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  updated_at: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
  visibility: string;
};

export type RepositorySnapshot = {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  visibility: string;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  pushedAt: string | null;
  githubUpdatedAt: string | null;
};

export type SqlStatement = { text: string; values: unknown[] };

export type PlanRunSummary = {
  provider: string;
  branch: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
  createdAt: string;
};

export type PersistenceStatus = {
  configured: boolean;
  reachable: boolean;
  pooled: boolean;
  database: string | null;
  migrations: string[];
  counts: { repositories: number; planRuns: number; auditEvents: number } | null;
  recentPlanRuns: PlanRunSummary[];
  reason?: PersistenceReason;
};
