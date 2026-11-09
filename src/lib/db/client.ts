import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { classifyDatabaseUrl, redactSecrets, resolveNeonConnectionString } from "@/lib/db/databaseUrl";
import type { SqlStatement } from "@/lib/db/types";

type Queryable = NeonQueryFunction<false, false>;

let cached: { key: string; sql: Queryable } | null = null;

async function connectionString(): Promise<string | undefined> {
  const fromProcess = resolveNeonConnectionString(process.env);
  if (fromProcess) return fromProcess;
  try {
    const { env } = await getCloudflareContext({ async: true });
    return resolveNeonConnectionString({
      DATABASE_URL: env.DATABASE_URL,
      NEON_DATABASE_URL: env.NEON_DATABASE_URL,
    });
  } catch {
    return undefined;
  }
}

async function sqlClient(): Promise<Queryable | null> {
  const url = await connectionString();
  if (!url) return null;
  if (cached?.key === url) return cached.sql;
  const sql = neon(url);
  cached = { key: url, sql };
  return sql;
}

export async function databaseConfigured(): Promise<boolean> {
  return (await connectionString()) != null;
}

export async function describeRuntimeDatabase(): Promise<{ configured: boolean; pooled: boolean; databaseName: string | null }> {
  const classified = classifyDatabaseUrl(await connectionString());
  if (classified.provider !== "neon") return { configured: false, pooled: false, databaseName: null };
  return { configured: true, pooled: classified.pooled, databaseName: classified.database };
}

export async function queryRows<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[] | null> {
  const sql = await sqlClient();
  if (!sql) return null;
  const rows = await sql.query(text, values);
  return rows as T[];
}

export async function transaction(statements: readonly SqlStatement[]): Promise<void> {
  if (!statements.length) return;
  const sql = await sqlClient();
  if (!sql) throw new Error("Neon is not configured.");
  await sql.transaction((txn) => statements.map((statement) => txn.query(statement.text, statement.values as never[])));
}

export function logPersistenceFailure(action: string, error: unknown): void {
  const message = redactSecrets(error instanceof Error ? error.message : "Database query failed");
  console.error(JSON.stringify({ event: "persistence_failed", action, message }));
}
