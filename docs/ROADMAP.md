# Sentinel — Implementation Roadmap

## Phase 0 — Foundation
- [x] Create the Sentinel GitHub repository.
- [x] Define product scope, security principles, and implementation phases.
- [ ] Add the responsive Next.js + TypeScript application scaffold.
- [ ] Establish linting, formatting, type-checking, and test commands.
- [ ] Add CI checks for pull requests and the main branch.

## Phase 1 — GitHub connection and inventory
- [ ] Register/configure a GitHub App.
- [ ] Implement secure installation and account connection flow.
- [ ] Let users select repositories rather than granting blanket access.
- [ ] Import repository metadata, default branches, commits, PRs, issues, and workflow runs.
- [ ] Build the global dashboard and per-project overview.
- [ ] Record sync timestamps and show stale/unavailable data clearly.

## Phase 2 — Build, deployment, and health monitoring
- [ ] Display GitHub Actions workflow and job results.
- [ ] Add deployment provider integrations and URL inventory.
- [ ] Add configurable uptime and API health checks.
- [ ] Add Neon/database connection status checks without exposing credentials.
- [ ] Add environment-variable inventory (names and status only).
- [ ] Add webhook processing and scheduled background jobs.

## Phase 3 — Code quality and security
- [ ] Ingest CodeQL and Dependabot alerts.
- [ ] Integrate Semgrep and repository-native lint/type/test commands.
- [ ] Normalize findings into a consistent model.
- [ ] Add severity, evidence, remediation guidance, and verification state.
- [ ] Detect regressions and reopened findings.

## Phase 4 — Planner and feature verification
- [ ] Add project goals, blueprints, milestones, and tasks.
- [ ] Add acceptance criteria and test references.
- [ ] Track implemented vs. tested vs. verified states.
- [ ] Link findings and commits to affected features.

## Phase 5 — Project knowledge and assistant
- [ ] Generate architecture and file-map summaries from repository evidence.
- [ ] Maintain decision records and known-issue documentation.
- [ ] Add evidence-linked project Q&A.
- [ ] Enforce secret redaction and prompt-injection boundaries.

## Phase 6 — Alerts, PWA, and release hardening
- [ ] Add configurable email/push/in-app notifications.
- [ ] Add installable PWA behavior and mobile navigation.
- [ ] Add audit log, retention controls, and account/repository disconnect flows.
- [ ] Add backups, observability, rate limits, and abuse protection.
- [ ] Complete security review and production deployment checklist.

## Release gates

A phase is not considered complete until its acceptance tests pass, security implications are reviewed, and the feature is verified in a deployed environment. A checklist item marked implemented is not automatically considered tested or production-ready.
