# Neon PostgreSQL

Sentinel's application database is **Neon Postgres**. The Cloudflare Worker queries it with `@neondatabase/serverless` over HTTP. GitHub remains the source of truth for repository content and `plan.md`.

Neon stores:

- GitHub account identity (numeric id, login, avatar URL). Access tokens are not stored.
- Repository snapshots and which account can see them.
- The latest workflow snapshot for a repository.
- Plan-run metadata (branch, pull request URL, change counts). Plan bodies are not stored.
- Audit events for account connection and plan commits.

This repository does not create a Neon project or deploy the Worker. Those steps need real credentials and are operator actions.

## 1. Create the Neon project

1. In the [Neon console](https://console.neon.tech), create a project. `sentinel` is a clear name.
2. Choose the region closest to the Cloudflare Worker.
3. Note the database name (`sentinel`, or Neon's default `neondb`).
4. Copy both connection strings for that database. The password appears only when the string is created.
   - **Pooled:** hostname contains `-pooler`. This is `DATABASE_URL`.
   - **Direct:** hostname has no `-pooler`. This is `NEON_DATABASE_URL_UNPOOLED`.

Use the pooled string for the Worker. Use the direct string for schema changes. Neon's pooler is PgBouncer in transaction mode, and it rejects parts of DDL.

Do not commit either string. Do not put them in `NEXT_PUBLIC_*` variables or in `wrangler.jsonc` `vars`.

## 2. Apply the schema

Migrations live in `db/migrations` and are applied in filename order. `schema_migrations` records each version. Each file runs in one transaction.

From a machine that can reach Neon, with dev dependencies installed:

```bash
# .env.local or the shell. Direct URL only.
NEON_DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/sentinel?sslmode=require
npm run db:neon:apply
```

The script also reads `.env`, `.env.local`, and `.dev.vars` when the variables are not already in the environment. Existing process variables win. The command prints the database name and applied versions. It does not print the connection string.

Check the pooled URL with the same driver the Worker uses:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-example-pooler.region.aws.neon.tech/sentinel?sslmode=require
npm run db:neon:check
```

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | Connected, and every required table is present |
| 1 | Connected, but the schema is incomplete or the query failed |
| 2 | Not configured, or the URL was refused (pooler, non-Neon host, Supabase host) |

`npm run db:neon:apply` refuses a pooled hostname and refuses a Supabase host. `SENTINEL_ALLOW_NON_NEON_MIGRATION=1` with `SENTINEL_SCHEMA_TEST_URL` is a local escape hatch for a disposable Postgres, not for production.

## 3. Worker secrets and local env

`wrangler.jsonc` lists required secret **names**. Values are set outside git.

| Variable | Where it lives | Use |
|----------|----------------|-----|
| `DATABASE_URL` | Worker secret, `.dev.vars`, `.env.local` | Pooled Neon URL for application queries |
| `NEON_DATABASE_URL` | Optional alias of `DATABASE_URL` | Same queries. Not required when `DATABASE_URL` is Neon |
| `NEON_DATABASE_URL_UNPOOLED` | Developer machine or CI only | Direct URL for `npm run db:neon:apply`. Do not upload it to the Worker |
| `GITHUB_CLIENT_ID` | Worker secret | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Worker secret | GitHub OAuth |
| `SENTINEL_SESSION_SECRET` | Worker secret | Encrypts the session cookie. At least 32 characters |
| `NEXT_PUBLIC_APP_URL` | `.env.local` for `next dev` | Public origin. Not a database credential |

Copy `.dev.vars.example` to `.dev.vars` for `npm run cf:preview`. Copy `.env.example` to `.env.local` for `npm run dev` and the migration scripts. Wrangler loads `.dev.vars` for local Worker dev and does not also load `.env` when `.dev.vars` exists.

Upload secrets to the Worker. `wrangler secret put` creates a new Worker version and deploys it, so run it only when a deploy is intended:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SENTINEL_SESSION_SECRET
```

Paste each value when prompted. Do not pass secrets as shell arguments.

`nodejs_compat` is enabled, so request handlers can read these values from `process.env`. The app also falls back to the OpenNext Cloudflare context when `process.env` does not have the URL yet.

## 4. Deploy

The Worker is the OpenNext build, not a separate Pages project. Route handlers use the default Node.js server runtime. OpenNext runs that bundle on the Worker with `nodejs_compat`. This OpenNext version cannot package App Router routes that set `export const runtime = "edge"` inside the main server function.

```bash
npm run cf:build      # opennextjs-cloudflare build
npm run cf:dry-run    # build, then wrangler deploy --dry-run (no upload)
npm run cf:preview    # local Worker via wrangler dev
npm run cf:deploy     # build and deploy. Requires Cloudflare auth and the secrets above
```

`npm run cf:dry-run` compiles the Worker and runs Wrangler's local checks. It does not upload the Worker, and it does not prove that Neon or GitHub credentials work. `next.config.ts` sets `output: "standalone"` so `next build` writes `.next/standalone`. CI packages that output with `opennextjs-cloudflare build --skipNextBuild` and then runs the same Wrangler dry run. A dry run may still ask Wrangler to identify the account; it must not be used as a substitute for `cf:deploy` when a real release is intended.

Before the first production deploy:

1. Apply migrations to the target Neon branch with the direct URL.
2. Put the four required secrets on the Worker.
3. Run `npm run db:neon:check` against the pooled URL.
4. Run `npm run cf:dry-run`.
5. Run `npm run cf:deploy` when the checks above are acceptable.

Deploy does not apply SQL. A Worker rollback does not roll back Neon data.

## 5. What the running app does

| Action | Database |
|--------|----------|
| GitHub OAuth callback | Inserts the account and a `github.connected` audit event. Login still succeeds if Neon is down or unset |
| Repository list | Upserts repository rows and the account's links, then the dashboard reads counts and recent plan runs |
| Project page | Upserts that repository and its latest workflow snapshot |
| Plan run | After the GitHub pull request is opened, inserts plan-run metadata and a `plan.committed` audit event |

Reads are scoped to the signed-in GitHub account. The status payload includes the database name and migration versions, not the host, user, or password. Query failures returned to the browser say that the database query failed. Connection strings are redacted from server logs.

Repository sync stores the first page GitHub returns (100 repositories) and does not delete links for repositories that disappear from that page. The dashboard list still comes from GitHub, so a removed repository disappears from the UI while its old snapshot can remain in Neon.

## 6. Local checks that do not need Neon

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` covers URL classification, migration ordering, parameterized repository upserts, and the checked-in SQL file. It does not open a connection.
