#!/usr/bin/env bash
# Deploy Play release workflows to hanzel1698 Android repos.
# Requires: gh CLI authenticated as hanzel1698 with repo write access.
# Usage: ./scripts/deploy-play-workflows.sh [repo-name ...]
# Omit repo names to deploy to Expense_Tracker, LendFLow, and dress-inventory.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$ROOT/scripts/play-workflows"
BRANCH="cursor/manual-play-release-workflow-c0c3"

declare -A REPO_BRANCH=(
  [Expense_Tracker]=master
  [LendFLow]=master
  [dress-inventory]=main
)

if [[ $# -gt 0 ]]; then
  REPOS=("$@")
else
  REPOS=(Expense_Tracker LendFLow dress-inventory)
fi

deploy_repo() {
  local repo="$1"
  local base_branch="${REPO_BRANCH[$repo]}"
  local template_dir="$TEMPLATES/$repo"
  local work_dir
  work_dir="$(mktemp -d)"

  if [[ ! -d "$template_dir/.github/workflows" ]]; then
    echo "Missing templates for $repo at $template_dir"
    return 1
  fi

  echo "=== Deploying to hanzel1698/$repo ($base_branch) ==="
  git clone --depth 1 --branch "$base_branch" "https://github.com/hanzel1698/${repo}.git" "$work_dir"
  cd "$work_dir"
  git checkout -b "$BRANCH"

  git config user.name "${GIT_USER_NAME:-hanzel1698}"
  git config user.email "${GIT_USER_EMAIL:-hanzel1698@users.noreply.github.com}"

  mkdir -p .github/workflows
  cp "$template_dir/.github/workflows/play-version-bump-build.yml" .github/workflows/
  cp "$template_dir/.github/workflows/upload-aab-to-play.yml" .github/workflows/
  cp "$template_dir/android-release.yml" .github/workflows/android-release.yml

  git add .github/workflows/
  if git diff --staged --quiet; then
    echo "No workflow changes for $repo"
    cd /
    rm -rf "$work_dir"
    return 0
  fi

  git commit -m "ci: separate Play release from automatic Android builds

- Add manual play-version-bump-build.yml to bump versionCode, commit, and build AAB
- Add manual upload-aab-to-play.yml for Google Play publishing
- Skip automatic android-release builds for [skip ci] version bump commits"
  git push -u origin "$BRANCH"

  gh pr create --repo "hanzel1698/$repo" --base "$base_branch" --head "$BRANCH" \
    --title "ci: separate Play release from automatic Android builds" \
    --body "Adds manual Play release workflows.

1. **Android Release Build** — automatic on push (testing)
2. **Bump versionCode and Build for Play** — manual when ready to publish
3. **Upload latest AAB to Google Play** — manual after step 2"

  local pr_num
  pr_num="$(gh pr list --repo "hanzel1698/$repo" --head "$BRANCH" --json number --jq '.[0].number')"
  gh pr merge "$pr_num" --repo "hanzel1698/$repo" --merge --delete-branch
  echo "Merged PR #$pr_num for $repo"
  cd /
  rm -rf "$work_dir"
}

for repo in "${REPOS[@]}"; do
  deploy_repo "$repo"
done

echo "Done. Configure GOOGLE_PLAY_SERVICE_ACCOUNT_JSON and Android signing secrets on each repo before uploading to Play."
