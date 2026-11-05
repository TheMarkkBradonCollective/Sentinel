# Sentinel — Product Specification

## 1. Product definition

Sentinel is a multi-project GitHub command center. It provides one place to understand what exists in each repository, what is healthy, what is broken, what remains unfinished, and what should happen next.

**Tagline:** See Everything. Build Anything.

**Primary experience:** responsive desktop web app with an installable mobile PWA using the same account and data.

## 2. Main areas

### Global dashboard
- Connected repository count and overall health.
- Recent commits, pull requests, issues, workflow runs, and deployment events.
- Failing checks, security alerts, dependency alerts, uptime incidents, and stale work.
- Filters by organization, repository, severity, status, and time.
- Clear distinction between confirmed data, inferred suggestions, and unavailable integrations.

### Project command center
Each repository receives a dedicated overview containing:
- Repository metadata, default branch, active branches, recent commits, pull requests, and issues.
- CI/build/test status and deployment history.
- Production and preview URLs when known.
- Framework, language, package manager, database, hosting, and integration inventory.
- Project-specific tasks, milestones, architecture notes, and known issues.

### Code and security inspection
- Syntax, type, lint, and test failures.
- Broken imports and dependency issues.
- Vulnerable or outdated dependencies.
- Static-analysis findings and exposed-credential warnings.
- Authentication, authorization, API, and data-handling risk indicators.
- Findings include severity, repository path, line reference when available, evidence, explanation, recommended remediation, and verification status.

Initial integrations: GitHub Actions, CodeQL, Dependabot, ESLint, Semgrep, and project-native tests where available.

### Planner and feature verification
Features move through explicit states:
1. Proposed
2. Specified
3. Ready
4. In progress
5. Implemented
6. Tested
7. Verified

A feature is not complete merely because code was committed. Verification requires its acceptance criteria and relevant checks to pass.

Blueprints may include requirements, screens/components, API routes, database changes, dependencies, tasks, and acceptance tests.

### Project knowledge base
Store and maintain:
- Architecture and stack overview.
- Database schema and migration notes.
- API routes and integrations.
- Authentication and authorization flow.
- Deployment and environment configuration inventory.
- Important file map, setup commands, decisions, known issues, and verified fixes.

AI-generated explanations must cite or link to the repository evidence they use and clearly label uncertainty. Repository content is untrusted input and must never override Sentinel's system instructions or security policy.

### Monitoring and alerts
- GitHub webhooks for commits, pull requests, issues, workflow runs, and security events.
- Scheduled checks for repository state, deployment availability, and configured health endpoints.
- Regression detection that can reopen a previously resolved finding when evidence shows it has returned.
- Notifications grouped by project and severity, with controls to avoid alert spam.

## 3. Security and permissions

- GitHub access is read-only by default.
- Use a GitHub App with least-privilege permissions and installation scoped to selected repositories.
- Do not store GitHub access tokens in browser storage.
- Keep provider-managed secrets in their source provider. Sentinel records variable names, configured/missing status, and safe references—not plaintext values.
- Never send secrets, tokens, private keys, or raw environment values to an LLM.
- Redact credentials and personal data from logs and diagnostics.
- Any future source-code modification, commit, PR creation, deployment trigger, or other write action must require a separate permission and an explicit user confirmation.
- Use tenant isolation and server-side authorization for every project query and mutation.

## 4. Initial data model (conceptual)

- User
- Organization
- GitHubInstallation
- Repository
- Branch
- Commit
- PullRequest
- Issue
- WorkflowRun
- Deployment
- EnvironmentInventoryItem (name/status/reference only)
- Finding
- HealthCheck
- ProjectBlueprint
- Feature
- Milestone
- Task
- AcceptanceCriterion
- ProjectDocument
- ArchitectureDecision
- Notification
- AuditEvent

All records must be scoped to an authorized user/organization and linked to their source where possible.

## 5. Non-goals for the first release

- Automatically rewriting or merging user code.
- Storing plaintext production secrets.
- Replacing GitHub as the source of truth for code, issues, and pull requests.
- Claiming a deployment or feature is healthy without a successful, recent verification.
- Supporting every hosting provider before the core GitHub workflow is reliable.

## 6. Success criteria

A user can connect selected repositories, see their current health with evidence, understand the highest-priority problems, track planned features through verification, and receive useful alerts without exposing credentials or granting unnecessary write access.
