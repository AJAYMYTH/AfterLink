# Branching Strategy

## Overview
AfterLink uses **GitHub Flow** with release branch protection for stability.

## Branch Naming Conventions

| Prefix | Example | Purpose |
|---|---|---|
| `main` | `main` | Production-ready code. Always deployable. |
| `feature/` | `feature/tls-support` | New features or enhancements |
| `fix/` | `fix/connection-leak` | Bug fixes |
| `docs/` | `docs/api-reference` | Documentation-only changes |
| `chore/` | `chore/update-deps` | Maintenance, tooling, config |
| `ci/` | `ci/add-benchmarks` | CI/CD pipeline changes |
| `refactor/` | `refactor/frame-parser` | Code restructuring (no behavior change) |
| `perf/` | `perf/reduce-allocations` | Performance improvements |
| `test/` | `test/add-rate-limit-tests` | Test additions or fixes |
| `release/` | `release/v1.2.0` | Release prep (version bumps, changelog) |

## Lifecycle

```
feature/x ──┐
fix/y ──────┤
            ├──▶ main (squash merge)
ci/z ───────┘
```

1. **Create**: Branch from `main` with appropriate prefix
2. **Develop**: Commit using Conventional Commits format
3. **Review**: Open PR targeting `main`
4. **Merge**: Squash merge into `main` (preserves clean history)
5. **Delete**: Delete feature branch after merge

## Merge Rules

| Rule | Requirement |
|---|---|
| PR approval | ≥ 1 reviewer approval |
| CI status | All checks must pass |
| Branch | Must be up-to-date with `main` |
| Merge method | Squash and merge (default) |
| Commit message | Must follow Conventional Commits |

## Branch Protection (main)

After CI workflows register, enable protection:
```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field allow_squash_merge=true \
  --field allow_merge_merge=false \
  --field allow_rebase_merge=false \
  --field delete_head_on_merge=true
```

## Release Process

1. Create `release/vX.Y.Z` branch from `main`
2. Bump versions in all `package.json` files
3. Update `CHANGELOG.md`
4. Merge to `main` via PR
5. Create GitHub Release from `main`
6. Trigger `release.yml` workflow (auto-publishes to npm)
