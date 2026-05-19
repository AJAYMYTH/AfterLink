\---



\## 📋 1. Project Definition

\- \[ ] \*\*Name:\*\* `\\\[PROJECT\\\_NAME]`

\- \[ ] \*\*Core Goal:\*\* `\\\[1-sentence value proposition]`

\- \[ ] \*\*Target Users:\*\* `\\\[e.g., backend devs, IoT teams, internal ops]`

\- \[ ] \*\*Success Metrics:\*\* `\\\[e.g., <50ms p95 latency, 10k concurrent connections, 99.9% uptime]`

\- \[ ] \*\*Scope (In):\*\* `\\\[Key features for v1.0]`

\- \[ ] \*\*Scope (Out):\*\* `\\\[Deferred to v1.1+ or explicitly excluded]`

\- \[ ] \*\*Non-Functional Requirements:\*\* `\\\[Security, performance, scalability, compliance]`



\## 🏗️ 2. Architecture \& Tech Stack

\- \[ ] \*\*Language/Runtime:\*\* `\\\[e.g., TypeScript / Node.js 20+ / Go / Python]`

\- \[ ] \*\*Package Manager:\*\* `\\\[pnpm / npm / yarn]`

\- \[ ] \*\*Repo Structure:\*\* `\\\[Monorepo / Single-repo / Multi-repo]`

\- \[ ] \*\*Core Dependencies:\*\* `\\\[List critical libs + versions]`

\- \[ ] \*\*Database/Storage:\*\* `\\\[e.g., PostgreSQL, Redis, S3, SQLite]`

\- \[ ] \*\*Infrastructure:\*\* `\\\[e.g., Vercel, AWS, Cloudflare, Docker, bare-metal]`

\- \[ ] \*\*Key Design Decisions:\*\* `\\\[Link to ADRs or note rationale]`



\## 📁 3. Repository Initialization

\- \[ ] Create repo on GitHub with `README.md`, `.gitignore`, `LICENSE`

\- \[ ] Initialize workspace: `\\\[e.g., pnpm init, pnpm -w add -D typescript eslint prettier vitest]`

\- \[ ] Configure linter/formatter: `eslint.config.mjs`, `prettier.config.js`, `package.json` scripts

\- \[ ] Add `package.json` scripts: `dev`, `build`, `test`, `lint`, `typecheck`

\- \[ ] Commit initial structure to `main`

\- \[ ] Enable Dependabot: `.github/dependabot.yml`



\## 🌿 4. Branching \& PR Strategy

\- \[ ] \*\*Strategy:\*\* GitHub Flow (or GitFlow if required)

\- \[ ] \*\*Branch Naming:\*\* `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `release/`

\- \[ ] \*\*Commit Convention:\*\* Conventional Commits (`feat:`, `fix:`, `chore(deps):`, etc.)

\- \[ ] \*\*PR Template:\*\* `.github/PULL\\\_REQUEST\\\_TEMPLATE.md` (include testing, security, docs checks)

\- \[ ] \*\*Branch Protection:\*\* `main` requires passing CI + 1 review + up-to-date

\- \[ ] \*\*Merge Strategy:\*\* Squash \& merge (clean history) or Merge commits (preserve context)



\## ⚙️ 5. CI/CD Pipeline Setup

\- \[ ] \*\*Workflows Created:\*\* `.github/workflows/ci.yml`, `release.yml`, `deploy.yml`

\- \[ ] \*\*Triggers:\*\* `push`/`pull\\\_request` to `main`, `release` tags, scheduled benchmarks

\- \[ ] \*\*Jobs:\*\* Checkout → Install → Lint → Typecheck → Test → Security Audit → Build → Deploy

\- \[ ] \*\*Caching:\*\* `pnpm` store, `node\\\_modules`, build artifacts

\- \[ ] \*\*Timeouts:\*\* Max `15m` per job

\- \[ ] \*\*Badges:\*\* Add CI, Coverage, Version to `README.md`

\- \[ ] \*\*Notifications:\*\* Discord/Slack webhook on failure/success



\## 🔐 6. Environment \& Secret Management

\- \[ ] \*\*Environments Created:\*\* `development`, `staging`, `production` (GitHub Settings → Environments)

\- \[ ] \*\*Secret Scoping:\*\* Prod secrets restricted to `production` env only

\- \[ ] \*\*Auth Method:\*\* OIDC for cloud providers (no long-lived tokens)

\- \[ ] \*\*Secret Rotation Policy:\*\* `\\\[e.g., Quarterly or automated via cloud provider]`

\- \[ ] \*\*No Secrets in Code/Logs:\*\* Verified via `gitleaks` or GitHub secret scanning



\## 🤖 7. AI Agent \& Team Workflow

\- \[ ] \*\*Agent Context File:\*\* `.cursorrules` or `.windsurfrules` with stack, rules, branch policy

\- \[ ] \*\*Prompt Guidelines:\*\* Specific, scoped, test-driven, conventional commits

\- \[ ] \*\*CODEOWNERS:\*\* `.github/CODEOWNERS` auto-assigns reviewers per path

\- \[ ] \*\*PR Size Limit:\*\* ≤400 lines per PR (split if larger)

\- \[ ] \*\*Audit Trail:\*\* `Co-Authored-By:` for AI-generated commits

\- \[ ] \*\*Review Policy:\*\* Human must verify logic, security, and edge cases



\## 🛡️ 8. Security \& Compliance

\- \[ ] `npm audit --audit-level=moderate` enforced in CI

\- \[ ] `npm config set provenance true` for package publishing

\- \[ ] Branch protection prevents direct `main` pushes

\- \[ ] Dependency updates automated (Dependabot/Renovate)

\- \[ ] Security policy: `SECURITY.md` with disclosure process

\- \[ ] Least-privilege GitHub Actions permissions (`permissions: read-only` by default)



\## 🧪 9. Testing \& Quality Gates

\- \[ ] \*\*Unit Tests:\*\* ≥85% coverage threshold

\- \[ ] \*\*Integration Tests:\*\* Core workflows (e.g., TCP handshake, auth, pub/sub)

\- \[ ] \*\*Benchmarks:\*\* Baseline established, CI fails on >5% regression

\- \[ ] \*\*Flaky Test Policy:\*\* Quarantine + alert, don't ignore

\- \[ ] \*\*Test Data:\*\* Deterministic, mocked external services

\- \[ ] \*\*Coverage Reporting:\*\* Codecov integrated + PR comments



\## 📖 10. Documentation \& Runbooks

\- \[ ] `README.md`: Quick start, architecture diagram, badges, license

\- \[ ] `CONTRIBUTING.md`: Setup, AI rules, PR process, testing expectations

\- \[ ] API/Protocol Docs: Auto-generated or manual (e.g., Docusaurus, Vercel Docs)

\- \[ ] `SECURITY.md`: Vulnerability reporting, supported versions

\- \[ ] Incident Runbook: Debug steps, rollback procedure, contact escalation

\- \[ ] Decision Log: `docs/decisions/` or inline ADRs



\## 🚦 11. Pre-Launch Checklist (v1.0)

\- \[ ] All CI jobs green on `main`

\- \[ ] Branch protection \& environment approvals active

\- \[ ] Secrets rotated \& scoped correctly

\- \[ ] npm provenance \& security audit passed

\- \[ ] Docs site live \& up-to-date

\- \[ ] Benchmark baselines documented

\- \[ ] Team/AI workflow tested end-to-end

\- \[ ] Rollback procedure documented \& tested

\- \[ ] \*\*Final Sign-off:\*\* `\\\[Maintainer Name]` on `\\\[Date]`



\## 🛠️ Quick Reference Commands

```bash

\\# Branch \\\& PR

git checkout -b feat/your-feature

git push -u origin feat/your-feature

gh pr create --title "feat: ..." --body "..."



\\# Local CI Simulation

pnpm run lint \\\&\\\& pnpm run typecheck \\\&\\\& pnpm test



\\# AI Agent Setup

echo "PROJECT: \\\[Name]\\\\nSTACK: \\\[Tech]\\\\nRULES: Conventional commits, feat/\\\* branches, <400 line PRs, run tests before commit" > .cursorrules



\\# Security \\\& Audit

npx gitleaks detect --source .

npm audit --production

```



\---

\*\*✅ Once all boxes are checked, you're ready to build.\*\*

\*Keep this file in your repo root. Update it for major version bumps or architecture shifts.\*



\---



💡 \*\*Tip for your coding agent:\*\*

Paste the entire `PROJECT\\\_SETUP.md` into your agent's context window and say:

> `"Follow this checklist step-by-step. Do not write feature code until Section 1–6 are complete. Confirm each step before moving forward."`



Want me to auto-generate any of the referenced files (`.cursorrules`, `PR\\\_TEMPLATE.md`, `CODEOWNERS`, `dependabot.yml`, or the 4 workflow YAMLs) ready to drop into your repo?

