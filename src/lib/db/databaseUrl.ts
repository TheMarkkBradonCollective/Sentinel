/**
 * Server-side database URL classification.
 * Never import this from client components. Connection strings stay on the server.
 */

export type DatabaseProvider = "neon" | "supabase" | "postgres" | "unset";

export interface DatabaseTarget {
  provider: DatabaseProvider;
  host: string | null;
  database: string | null;
  pooled: boolean;
  local: boolean;
  configured: boolean;
}

const EMPTY_TARGET: DatabaseTarget = {
  provider: "unset",
  host: null,
  database: null,
  pooled: false,
  local: false,
  configured: false,
};

type Env = Record<string, string | undefined>;

function envOf(env?: Env): Env {
  return env ?? process.env;
}

function readEnv(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

export function classifyDatabaseUrl(connectionString: string | undefined | null): DatabaseTarget {
  const raw = connectionString?.trim() ?? "";
  if (!raw) return EMPTY_TARGET;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return EMPTY_TARGET;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return EMPTY_TARGET;

  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "") || null;
  const pooled = host.includes("-pooler") || parsed.searchParams.get("pgbouncer") === "true";

  let provider: DatabaseProvider = "postgres";
  if (host === "neon.tech" || host.endsWith(".neon.tech")) provider = "neon";
  else if (
    host.endsWith(".supabase.co") ||
    host.endsWith(".supabase.com") ||
    host === "supabase.co" ||
    host === "supabase.com"
  ) {
    provider = "supabase";
  }

  return { provider, host, database, pooled, local, configured: true };
}

/** True when a Neon-specific variable points at Supabase. DATABASE_URL is allowed to be classified separately. */
export function neonVariablePointsAtSupabase(env?: Env): boolean {
  const source = envOf(env);
  for (const key of ["NEON_DATABASE_URL", "NEON_DATABASE_URL_UNPOOLED"]) {
    const value = readEnv(source, key);
    if (value && classifyDatabaseUrl(value).provider === "supabase") return true;
  }
  return false;
}

/** Pooled Neon URL for Worker queries. Ignores a non-Neon DATABASE_URL. */
export function resolveNeonConnectionString(env?: Env): string | undefined {
  const source = envOf(env);
  const dedicated = readEnv(source, "NEON_DATABASE_URL");
  if (dedicated && classifyDatabaseUrl(dedicated).provider === "neon") return dedicated;

  const shared = readEnv(source, "DATABASE_URL");
  if (shared && classifyDatabaseUrl(shared).provider === "neon") return shared;

  return undefined;
}

/** Pooled connection string for application queries. Sentinel accepts only Neon hosts. */
export function resolveApplicationConnectionString(env?: Env): string | undefined {
  return resolveNeonConnectionString(env);
}

/**
 * Direct Neon URL for DDL. Pooler connections reject parts of schema scripts.
 * A non-Neon URL is used only when a local schema test opts in.
 */
export function resolveMigrationConnectionString(env?: Env): string | undefined {
  const source = envOf(env);
  const unpooled = readEnv(source, "NEON_DATABASE_URL_UNPOOLED");
  if (unpooled) {
    const provider = classifyDatabaseUrl(unpooled).provider;
    if (provider === "neon" || provider === "supabase") return unpooled;
  }

  const dedicated = readEnv(source, "NEON_DATABASE_URL");
  if (dedicated && classifyDatabaseUrl(dedicated).provider === "neon" && !classifyDatabaseUrl(dedicated).pooled) {
    return dedicated;
  }

  const shared = readEnv(source, "DATABASE_URL");
  if (shared && classifyDatabaseUrl(shared).provider === "neon" && !classifyDatabaseUrl(shared).pooled) {
    return shared;
  }

  if (source.SENTINEL_ALLOW_NON_NEON_MIGRATION === "1") {
    return readEnv(source, "SENTINEL_SCHEMA_TEST_URL");
  }

  return undefined;
}

export function assertNeonMigrationTarget(connectionString: string, env?: Env): DatabaseTarget {
  const source = envOf(env);
  const target = classifyDatabaseUrl(connectionString);
  if (!target.configured) {
    throw new Error("The migration connection string is missing or invalid.");
  }
  if (target.provider === "supabase") {
    throw new Error("Refusing to run the Neon migration against a Supabase host.");
  }
  if (target.provider !== "neon" && source.SENTINEL_ALLOW_NON_NEON_MIGRATION !== "1") {
    throw new Error(
      "Refusing to migrate: the host is not neon.tech. Set NEON_DATABASE_URL_UNPOOLED to the direct Neon connection string."
    );
  }
  if (target.pooled) {
    throw new Error(
      "Refusing to apply schema through a pooled Neon connection. Set NEON_DATABASE_URL_UNPOOLED to the direct connection string."
    );
  }
  return target;
}

/** Public description. Host, user, and password are omitted. */
export function describeNeonConfig(env?: Env): {
  configured: boolean;
  pooled: boolean;
  databaseName: string | null;
} {
  const classified = classifyDatabaseUrl(resolveNeonConnectionString(env));
  if (classified.provider !== "neon") {
    return { configured: false, pooled: false, databaseName: null };
  }
  return {
    configured: true,
    pooled: classified.pooled,
    databaseName: classified.database,
  };
}

export function redactSecrets(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://***")
    .replace(/((?:password|pwd)=)[^\s&'"]+/gi, "$1***");
}

export function sslForConnection(connectionString: string): false | { rejectUnauthorized: boolean } {
  const target = classifyDatabaseUrl(connectionString);
  if (!target.configured || target.local) return false;
  if (/sslmode=disable/i.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}
