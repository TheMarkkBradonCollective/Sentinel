# Sentinel — Project Plan

## Project goal
Build Sentinel into a secure, mobile-friendly command center that monitors GitHub projects and coordinates planned changes through an auditable project plan.

## Product principles
- GitHub remains the source of truth for source code and project history.
- Each managed repository has its own root-level plan.md.
- Sentinel detects and records plan changes as additions, removals, and updates.
- A plan run commits the plan to the selected repository and prepares an execution handoff for the selected coding agent.
- No agent or automated process may claim work is complete without test and verification evidence.
- Code writes and deployments require explicit approval.

## Current state
- [x] Sentinel repository and product specification created.
- [x] Responsive dashboard and GitHub OAuth prototype committed.
- [x] Repository inventory and project command-center views added.
- [x] Installable PWA manifest and icon added.
- [ ] Replace broad OAuth prototype with a least-privilege GitHub App installation.
- [ ] Validate CI and Cloudflare deployment in a real environment.

## Planned changes

### Plan control center
- [x] Add a project-specific Plan section.
- [x] Load plan.md from the selected repository.
- [x] Create plan.md automatically when it does not exist and Run is clicked.
- [x] Compare proposed plan text with the previous version.
- [x] Record added and removed lines and a possible update count.
- [x] Append a timestamped change summary to plan.md.
- [x] Commit plan.md to GitHub with a descriptive commit message.
- [x] Prepare a handoff prompt for Cursor, ChatGPT, or Claude.
- [ ] Add explicit per-repository write permission via a least-privilege GitHub App.
- [ ] Add robust semantic diffing that groups changed requirements into updated items.
- [ ] Add a review/approval step before agent code execution.
- [ ] Integrate agent execution APIs where supported and authorized.
- [ ] Track agent runs, files changed, tests, and evidence back into plan.md.
- [ ] Detect out-of-band plan.md edits and reconcile them on next sync.
- [ ] Preserve concurrent edits with SHA conflict handling and a merge/reload flow.

### Monitoring and project intelligence
- [ ] Live workflow and deployment monitoring.
- [ ] Code quality, dependency, and security findings.
- [ ] Project architecture and knowledge map.
- [ ] Feature planner with acceptance criteria and verification states.
- [ ] Scheduled health checks and notifications.
- [x] Neon persistence for accounts, repository snapshots, plan-run metadata, and audit events. Findings storage is still future work. Live credentials and deploy remain operator steps.

## Plan change log

Plan revisions are committed to GitHub. Each Sentinel plan run appends its timestamp, selected agent, and line-level change summary here.
