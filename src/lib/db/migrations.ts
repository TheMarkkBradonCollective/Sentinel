const MIGRATION_FILENAME = /^([0-9]{4}_[a-z0-9_]+)\.sql$/;

export function migrationVersion(filename: string): string {
  const match = MIGRATION_FILENAME.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return match[1];
}

export function pendingMigrationFiles(filenames: readonly string[], applied: readonly string[]): string[] {
  const appliedSet = new Set(applied);
  return [...filenames].sort().filter((name) => !appliedSet.has(migrationVersion(name)));
}
