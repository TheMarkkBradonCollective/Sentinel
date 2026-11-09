/**
 * Read-only Neon connectivity check using the same HTTP driver as the Worker.
 *
 * DATABASE_URL=postgresql://...-pooler.../sentinel npm run db:neon:check
 */
import { neon } from "@neondatabase/serverless";
import {
  classifyDatabaseUrl,
  neonVariablePointsAtSupabase,
  redactSecrets,
  resolveNeonConnectionString,
} from "../../src/lib/db/databaseUrl";
import { missingRequiredTables } from "../../src/lib/db/schema";
import { loadLocalEnv } from "./load-env";

async function main(): Promise<void> {
  const loaded = loadLocalEnv();
  if (loaded.length) console.log(`Loaded local env files: ${loaded.join(", ")}`);
  if (neonVariablePointsAtSupabase()) {
    console.error("Refusing to check connectivity against a Supabase host.");
    process.exitCode = 2;
    return;
  }
  const connectionString = resolveNeonConnectionString();
  if (!connectionString) {
    console.error("Neon connectivity check did not run. Set DATABASE_URL to the pooled Neon connection string.");
    process.exitCode = 2;
    return;
  }
  const target = classifyDatabaseUrl(connectionString);
  if (target.provider !== "neon") {
    console.error("Refusing to check connectivity: host is not neon.tech.");
    process.exitCode = 2;
    return;
  }
  const sql = neon(connectionString);
  const info = await sql.query("SELECT current_database() AS database, current_setting('server_version') AS version");
  const listed = await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const names = listed.map((row) => String(row.table_name));
  const missing = missingRequiredTables(names);
  let migrations: string[] = [];
  if (names.includes("schema_migrations")) {
    const applied = await sql.query("SELECT version FROM schema_migrations ORDER BY version");
    migrations = applied.map((row) => String(row.version));
  }
  const report = {
    ok: missing.length === 0,
    provider: target.provider,
    database: info[0]?.database ?? target.database,
    version: info[0]?.version ?? null,
    pooled: target.pooled,
    tables: names.length,
    migrations,
    missingTables: missing,
  };
  console.log(JSON.stringify(report));
  if (missing.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.message : "Connectivity check failed"));
  process.exitCode = 1;
});
