-- Sentinel application schema.
-- GitHub remains the source of truth for repository content and plan.md.
-- This database stores account links, repository snapshots, health snapshots,
-- plan-run metadata, and audit events. It does not store access tokens,
-- OAuth client secrets, session secrets, or plan.md bodies.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_accounts (
  github_id text PRIMARY KEY,
  login text NOT NULL,
  avatar_url text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_accounts_id_digits CHECK (github_id ~ '^[0-9]+$')
);

CREATE TABLE IF NOT EXISTS repositories (
  github_id text PRIMARY KEY,
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  description text,
  html_url text NOT NULL,
  language text,
  visibility text NOT NULL,
  is_private boolean NOT NULL,
  is_archived boolean NOT NULL,
  default_branch text NOT NULL,
  stargazers_count integer NOT NULL DEFAULT 0 CHECK (stargazers_count >= 0),
  forks_count integer NOT NULL DEFAULT 0 CHECK (forks_count >= 0),
  open_issues_count integer NOT NULL DEFAULT 0 CHECK (open_issues_count >= 0),
  pushed_at timestamptz,
  github_updated_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repositories_id_digits CHECK (github_id ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS repositories_full_name_idx ON repositories (full_name);

CREATE TABLE IF NOT EXISTS account_repositories (
  account_github_id text NOT NULL REFERENCES github_accounts (github_id) ON DELETE CASCADE,
  repository_github_id text NOT NULL REFERENCES repositories (github_id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_github_id, repository_github_id)
);

CREATE INDEX IF NOT EXISTS account_repositories_repository_idx
  ON account_repositories (repository_github_id);

CREATE TABLE IF NOT EXISTS health_snapshots (
  repository_github_id text PRIMARY KEY REFERENCES repositories (github_id) ON DELETE CASCADE,
  latest_workflow_name text,
  latest_workflow_status text,
  latest_workflow_conclusion text,
  open_issues_count integer NOT NULL DEFAULT 0 CHECK (open_issues_count >= 0),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_github_id text NOT NULL REFERENCES github_accounts (github_id) ON DELETE CASCADE,
  repository_full_name text NOT NULL,
  provider text NOT NULL,
  branch text NOT NULL,
  base_branch text NOT NULL,
  pull_request_url text NOT NULL,
  pull_request_number integer NOT NULL CHECK (pull_request_number > 0),
  commit_sha text,
  added_count integer NOT NULL CHECK (added_count >= 0),
  removed_count integer NOT NULL CHECK (removed_count >= 0),
  updated_count integer NOT NULL CHECK (updated_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_runs_provider CHECK (provider IN ('cursor', 'chatgpt', 'claude'))
);

CREATE INDEX IF NOT EXISTS plan_runs_account_created_idx
  ON plan_runs (account_github_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_github_id text REFERENCES github_accounts (github_id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audit_events_account_created_idx
  ON audit_events (account_github_id, created_at DESC);
