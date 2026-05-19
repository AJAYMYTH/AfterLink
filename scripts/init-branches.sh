#!/bin/bash
# scripts/init-branches.sh - Safely scaffold standard branches
# Usage: ./scripts/init-branches.sh

set -e

MAIN_BRANCH="main"

echo "Checking out $MAIN_BRANCH..."
git checkout "$MAIN_BRANCH"
git pull origin "$MAIN_BRANCH"

BRANCHES=(
  "feature/example-feature"
  "fix/example-fix"
  "docs/example-docs"
  "chore/example-chore"
  "ci/example-ci"
  "refactor/example-refactor"
  "perf/example-perf"
  "test/example-test"
  "release/v1.2.0"
)

for branch in "${BRANCHES[@]}"; do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "  ✓ $branch already exists"
  else
    git branch "$branch" "$MAIN_BRANCH"
    echo "  + Created $branch"
  fi
done

echo ""
echo "Branches scaffolded from $MAIN_BRANCH."
echo "Push with: git push origin --all"
