# Sentinel — Living Project Plan

> Source of truth for Sentinel's product direction, implementation tasks, and verification state.
> Changes made through Sentinel's Plan Control are timestamped and committed to this file.

## Vision
Build a secure, mobile-first development command center that monitors GitHub repositories, explains project health, and coordinates approved project changes through an auditable plan.

## Current baseline
- [x] Responsive Next.js + TypeScript application foundation.
- [x] GitHub OAuth connection prototype with encrypted HttpOnly session cookie.
- [x] Repository inventory and search.
- [x] Per-repository command center with workflow, pull request, and issue snapshots.
- [x] Installable PWA manifest and icon.
- [x] Project Plan Control page with repository selection.
- [x] Read or create each repository's root-level plan.md.
- [x] Compare plan revisions and record added/removed line changes.
- [x] Commit plan.md to GitHub when Run is clicked.
- [x] Prepare Cursor, ChatGPT, or Claude execution handoff prompt.
- [x] Create a dedicated plan-run branch instead of writing to the default branch.
- [x] Open a pull request for every plan run and leave it unmerged for human review.
- [x] Include branch-specific implementation instructions, test requirements, and evidence updates in the agent handoff.
- [x] Add CI workflow for typecheck, lint, and production build on main and Sentinel plan branches.
- [ ] Confirm CI results and validate a real deployment.

## Product requirements

### Plan Control
- [x] One plan control center for all connected repositories.
- [x] Root-level plan.md is the project's canonical plan.
- [x] Create plan.md automatically when missing and Run is clicked.
- [x] Record timestamps, selected agent, and additions/removals.
- [x] Preserve GitHub commit history as the audit trail.
- [ ] Semantic diff that recognizes edits as updates rather than only line removals/additions.
- [x] Explicit plan approval through the user-triggered Run action; PR remains open for human review.
- [ ] Direct, permissioned integrations with supported coding agents.
- [ ] Capture agent output, files changed, test results, and verification evidence.
- [ ] Detect external plan edits and handle concurrent changes safely.

### GitHub and monitoring
- [ ] Replace broad OAuth scope with least-privilege GitHub App installation.
- [ ] Allow selecting repositories and manage access per installation.
- [ ] Global commit, pull request, issue, and workflow activity.
- [ ] Workflow job-level failure diagnosis.
- [ ] Deployment provider integrations and production/preview URL inventory.
- [ ] Uptime and API health checks.
- [x] Neon database persistence for accounts, repository snapshots, health snapshots, plan-run metadata, and audit events. Live credentials and deploy remain operator steps.
- [ ] Scheduled background processing.
- [ ] Environment variable inventory by name and configured status only.

### Code intelligence and security
- [ ] CodeQL and Dependabot alert ingestion.
- [ ] Semgrep and repository-native lint/type/test integration.
- [ ] Dependency and license inventory.
- [ ] Normalize findings with severity, file/line evidence, recommendation, and verification.
- [ ] Regression detection and reopening of recurring findings.
- [ ] Never expose environment secrets, access tokens, or private keys.

### Planning and knowledge
- [ ] Project goals, milestones, features, and task dependencies.
- [ ] Acceptance criteria for each feature.
- [ ] Separate proposed, implemented, tested, and verified states.
- [ ] Architecture map, stack inventory, API and database documentation.
- [ ] Evidence-linked project assistant with prompt-injection protection.

### Mobile and release
- [x] Responsive phone layout.
- [x] PWA manifest and app icon.
- [ ] Add service worker/offline shell and install guidance.
- [ ] Push/in-app notifications.
- [ ] Production security review, rate limits, audit retention, and backup strategy.

## Verification rules
- A plan item is not complete merely because code was committed.
- Implemented means the code change exists.
- Tested means relevant automated or manual tests were run.
- Verified means expected behavior was observed and evidence recorded.
- Never claim checks passed when they were not run or their results are unavailable.

## Change history
Sentinel appends a dated summary of plan changes here whenever a plan run is committed.

### 2026-11-09 — Neon persistence
- Added SQL migrations, the `@neondatabase/serverless` client, and Wrangler secret wiring for `DATABASE_URL`.
- Repository, health, and plan-run screens now read and write Neon when the secret is set.
- Migrations were not applied to a live database, and the Worker was not deployed.
