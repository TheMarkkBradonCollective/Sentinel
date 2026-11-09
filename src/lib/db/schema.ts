export const REQUIRED_TABLES = [
  "schema_migrations",
  "github_accounts",
  "repositories",
  "account_repositories",
  "health_snapshots",
  "plan_runs",
  "audit_events",
] as const;

export function missingRequiredTables(present: readonly string[]): string[] {
  const names = new Set(present);
  return REQUIRED_TABLES.filter((table) => !names.has(table));
}
