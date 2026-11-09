import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertNeonMigrationTarget,
  classifyDatabaseUrl,
  redactSecrets,
  resolveApplicationConnectionString,
  resolveMigrationConnectionString,
} from "./databaseUrl";
import { pendingMigrationFiles } from "./migrations";
import { missingRequiredTables, REQUIRED_TABLES } from "./schema";
import { buildRepositoryUpsert } from "./sql";
import { toRepositorySnapshot } from "./snapshots";

const pooled = "postgresql://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/sentinel?sslmode=require";
const direct = "postgresql://user:secret@ep-example.us-east-2.aws.neon.tech/sentinel?sslmode=require";

test("classifies pooled and direct Neon URLs without exposing the secret", () => {
  const pooledTarget = classifyDatabaseUrl(pooled);
  assert.equal(pooledTarget.provider, "neon");
  assert.equal(pooledTarget.pooled, true);
  assert.equal(pooledTarget.database, "sentinel");
  assert.equal(classifyDatabaseUrl(direct).pooled, false);
  assert.equal(redactSecrets(`failed ${pooled}`).includes("secret"), false);
  assert.match(redactSecrets(`failed ${pooled}`), /postgresql:\/\/\*\*\*/);
});

test("application queries use Neon and migrations refuse the pooler", () => {
  const env = { DATABASE_URL: pooled, NEON_DATABASE_URL_UNPOOLED: direct };
  assert.equal(resolveApplicationConnectionString(env), pooled);
  assert.equal(resolveMigrationConnectionString(env), direct);
  assert.throws(() => assertNeonMigrationTarget(pooled), /pooled/);
  assert.equal(assertNeonMigrationTarget(direct).database, "sentinel");
  assert.equal(resolveApplicationConnectionString({ DATABASE_URL: "postgresql://user:pw@db.supabase.co:5432/postgres" }), undefined);
  assert.throws(() => assertNeonMigrationTarget("postgresql://user:pw@localhost/sentinel"), /neon\.tech/);
});

test("pending migrations stay ordered and skip applied versions", () => {
  assert.deepEqual(pendingMigrationFiles(["0002_next.sql", "0001_init.sql"], []), ["0001_init.sql", "0002_next.sql"]);
  assert.deepEqual(pendingMigrationFiles(["0001_init.sql", "0002_next.sql"], ["0001_init"]), ["0002_next.sql"]);
  assert.throws(() => pendingMigrationFiles(["notes.sql"], []), /Invalid migration filename/);
});

test("repository upsert keeps user text in parameters", () => {
  const snapshot = toRepositorySnapshot({
    id: 42,
    name: "sentinel",
    full_name: "owner/sentinel'); DROP TABLE repositories;--",
    description: "hello",
    html_url: "https://github.com/owner/sentinel",
    language: "TypeScript",
    stargazers_count: 1,
    forks_count: 2,
    open_issues_count: 3,
    default_branch: "main",
    updated_at: "2026-01-01T00:00:00.000Z",
    private: true,
    archived: false,
    pushed_at: null,
    visibility: "private",
  });
  assert.ok(snapshot);
  const statement = buildRepositoryUpsert([snapshot]);
  assert.ok(statement);
  assert.equal(statement.text.includes("DROP TABLE"), false);
  assert.equal(statement.values.includes("owner/sentinel'); DROP TABLE repositories;--".slice(0, 200)), true);
  assert.equal(statement.values.filter((value) => value === 42 || value === "42").length, 1);
});

test("checked-in migrations create the required tables and contain no credentials", () => {
  const directory = resolve(process.cwd(), "db/migrations");
  const files = readdirSync(directory).filter((name) => name.endsWith(".sql"));
  assert.deepEqual(files, ["0001_init.sql"]);
  const sql = readFileSync(resolve(directory, files[0]), "utf8");
  assert.equal(/postgres(?:ql)?:\/\//i.test(sql), false);
  assert.equal(/password\s*=/i.test(sql), false);
  for (const table of REQUIRED_TABLES) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.deepEqual(missingRequiredTables(["schema_migrations"]), REQUIRED_TABLES.filter((table) => table !== "schema_migrations"));
});
