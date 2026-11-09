/**
 * Apply db/migrations/*.sql to Neon with the direct connection string.
 *
 * NEON_DATABASE_URL_UNPOOLED=postgresql://.../sentinel npm run db:neon:apply
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import {
  assertNeonMigrationTarget,
  neonVariablePointsAtSupabase,
  redactSecrets,
  resolveMigrationConnectionString,
  sslForConnection,
} from "../../src/lib/db/databaseUrl";
import { pendingMigrationFiles } from "../../src/lib/db/migrations";
import { missingRequiredTables } from "../../src/lib/db/schema";
import { loadLocalEnv } from "./load-env";

async function main(): Promise<void> {
  const loaded = loadLocalEnv();
  if (loaded.length) console.log(`Loaded local env files: ${loaded.join(", ")}`);
  if (neonVariablePointsAtSupabase()) {
    console.error("Refusing to run against a Supabase host.");
    process.exitCode = 2;
    return;
  }
  const connectionString = resolveMigrationConnectionString();
  if (!connectionString) {
    console.error("Set NEON_DATABASE_URL_UNPOOLED to the direct Neon connection string. Do not use the pooled hostname.");
    process.exitCode = 2;
    return;
  }
  let target;
  try {
    target = assertNeonMigrationTarget(connectionString);
  } catch (error) {
    console.error(redactSecrets(error instanceof Error ? error.message : "Invalid migration target"));
    process.exitCode = 2;
    return;
  }

  const directory = resolve(process.cwd(), "db/migrations");
  const filenames = readdirSync(directory).filter((name) => name.endsWith(".sql"));
  const client = new pg.Client({ connectionString, ssl: sslForConnection(connectionString) });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const existing = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
    const pending = pendingMigrationFiles(filenames, existing.rows.map((row) => row.version));
    const applied: string[] = [];
    for (const filename of pending) {
      const version = filename.replace(/\.sql$/, "");
      const sql = readFileSync(resolve(directory, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
        applied.push(version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    const listed = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const names = listed.rows.map((row) => row.table_name);
    const missing = missingRequiredTables(names);
    if (missing.length) throw new Error(`Schema apply finished but these tables are missing: ${missing.join(", ")}`);
    const info = await client.query<{ database: string }>("SELECT current_database() AS database");
    console.log(JSON.stringify({
      ok: true,
      provider: target.provider,
      database: info.rows[0]?.database ?? target.database,
      applied,
      pendingBefore: pending.map((name) => name.replace(/\.sql$/, "")),
      tables: names.length,
    }));
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.message : "Schema apply failed"));
  process.exitCode = 1;
});
