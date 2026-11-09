# Sentinel

**See Everything. Build Anything.**

Sentinel is a development command center for monitoring, understanding, and improving the health of projects across GitHub. It is designed as a responsive web application that can also be installed on mobile as a Progressive Web App (PWA).

## Product goals

- Connect multiple GitHub repositories from one account.
- Show repository, branch, commit, pull request, workflow, build, and deployment health.
- Inspect code quality, dependencies, security findings, and failing checks.
- Track features from planned to implemented, tested, and verified.
- Maintain project architecture notes, decisions, known issues, and recovery guidance.
- Run scheduled health checks and send actionable alerts.
- Keep GitHub access read-only by default. Any future write/fix capability must require explicit authorization.

## Planned stack

- Next.js + TypeScript for the responsive web/PWA experience.
- Cloudflare Pages/Workers for hosting and server-side execution.
- Neon PostgreSQL for application data. Connection setup, migrations, secrets, and deploy steps are in `docs/NEON-MIGRATION.md`.
- GitHub App/API + webhooks for repository integration.
- Cloudflare Queues and scheduled Workers for background processing.
- CodeQL, Semgrep, ESLint, dependency auditing, and project tests for analysis.

## Security principles

- Never copy plaintext environment-variable values or credentials into Sentinel's database, logs, reports, or AI context.
- Store only variable names, presence/status, and safe provider references unless a separately designed encrypted-secret feature is explicitly enabled.
- Request the minimum GitHub permissions needed; begin read-only.
- Treat repository content, issue text, workflow logs, and external webhook payloads as untrusted input.
- Require explicit approval before changing source code, opening write operations, or triggering deployments.

## Project status

The repository is initialized. The detailed product specification and phased roadmap are in `docs/PRODUCT_SPEC.md` and `docs/ROADMAP.md`.

## Development

```bash
npm install
npm run dev          # Next.js, reads .env.local
npm test             # URL, SQL, and migration checks. No database required
npm run typecheck
npm run lint
npm run build
npm run db:neon:apply   # direct Neon URL, see docs/NEON-MIGRATION.md
npm run db:neon:check   # pooled Neon URL
npm run cf:build
npm run cf:dry-run      # package the Worker without uploading it
npm run cf:preview      # local Worker, reads .dev.vars
npm run cf:deploy       # uploads the Worker. Do this only with real credentials
```

Copy `.env.example` to `.env.local` and `.dev.vars.example` to `.dev.vars`. Do not commit real credentials. `DATABASE_URL` is a Wrangler secret (pooled Neon URL). Schema changes use `NEON_DATABASE_URL_UNPOOLED` and are not uploaded to the Worker.

## Important production setup

The OAuth flow is a development-grade first connection, not the final least-privilege installation model. For production use, configure a GitHub App with read-only repository metadata, contents, pull request, issue, and Actions permissions as needed, and let users select installations/repositories. Do not deploy with the broad OAuth `repo` scope as the final permission model.

## Project plan control

Open **Planner** from the Sentinel dashboard. Choose a repository, edit its project plan, and select Cursor, ChatGPT, or Claude for the execution handoff. When you click **Run plan**, Sentinel compares the edited plan with the current `plan.md`, creates the file if it is missing, appends a timestamped change summary, and commits the result to that repository.

The current agent connection is a handoff workflow: Sentinel saves the plan and prepares a prompt to copy into the selected agent. It does not silently execute code changes inside Cursor, ChatGPT, or Claude. Agent execution APIs and end-to-end run verification are future integrations. Plan commits require the GitHub token to have repository contents write permission; the current OAuth prototype requests the broad `repo` scope. Use a least-privilege GitHub App before production.

## Plan execution workflow

A plan run now creates a dedicated `sentinel/plan-<timestamp>` branch from the repository's default branch, commits the proposed `plan.md` on that branch, and opens a pull request for review. It does not change the default branch, merge the PR, deploy, or directly invoke an external coding agent.

The Planner prepares a provider-specific handoff prompt for Cursor, ChatGPT, or Claude. The agent must work on the created branch, update plan status with files and test evidence, and leave the PR open. Direct agent API execution, automated run callbacks, and test-result ingestion remain future integrations. The current GitHub OAuth prototype has broad `repo` permissions; use a least-privilege GitHub App before production.
