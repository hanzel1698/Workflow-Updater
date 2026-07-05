#!/usr/bin/env bash
# Sync GitHub Actions secrets for Android Play publishing.
#
# PLAY JSON (one file, all repos):
#   ./scripts/sync-github-secrets.sh play /path/to/play-service-account.json
#
# KEYSTORE (per app — each app has its own upload key):
#   ./scripts/sync-github-secrets.sh keystore Workflow-Updater /path/to/upload-keystore.jks
#   ./scripts/sync-github-secrets.sh keystore Expense_Tracker /path/to/upload-keystore.jks upload
#
# Requires: gh auth login (as hanzel1698)
# Never commit credential files to git.

set -euo pipefail

OWNER="hanzel1698"
ANDROID_REPOS=(Workflow-Updater Expense_Tracker LendFLow dress-inventory)

usage() {
  cat <<'EOF'
Usage:
  sync-github-secrets.sh play <play-service-account.json>
  sync-github-secrets.sh keystore <repo> <upload-keystore.jks> [alias] [storepass] [keypass] [sha1]

Repos: Workflow-Updater, Expense_Tracker, LendFLow, dress-inventory

Examples:
  ./scripts/sync-github-secrets.sh play ~/keys/play-api.json
  ./scripts/sync-github-secrets.sh keystore Workflow-Updater ~/.android/signing/workflow-updater.jks
  ./scripts/sync-github-secrets.sh keystore Expense_Tracker ~/.android/signing/expense-tracker.jks upload
EOF
  exit 1
}

require_gh() {
  command -v gh >/dev/null || { echo "Install gh and run: gh auth login"; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }
}

sync_play_json() {
  local json_file="$1"
  [[ -f "$json_file" ]] || { echo "Play JSON not found: $json_file"; exit 1; }
  echo "Syncing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON to all Android repos..."
  for repo in "${ANDROID_REPOS[@]}"; do
    echo "  -> $repo"
    if gh secret set --help 2>&1 | grep -q body-file; then
      gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON \
        --repo "$OWNER/$repo" \
        --body-file "$json_file"
    else
      gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON \
        --repo "$OWNER/$repo" \
        < "$json_file"
    fi
  done
  echo "Done."
}

sync_keystore_repo() {
  local repo="$1"
  local keystore="$2"
  local alias="${3:-upload}"
  local storepass="${4:-}"
  local keypass="${5:-}"
  local sha1="${6:-}"

  local valid=0
  for r in "${ANDROID_REPOS[@]}"; do
    [[ "$r" == "$repo" ]] && valid=1
  done
  [[ "$valid" -eq 1 ]] || { echo "Unknown repo: $repo"; usage; }

  [[ -f "$keystore" ]] || { echo "Keystore not found: $keystore"; exit 1; }

  if [[ -z "$storepass" ]]; then
    read -r -s -p "Keystore password for $repo: " storepass
    echo
  fi
  if [[ -z "$keypass" ]]; then
    keypass="$storepass"
  fi

  if [[ -z "$sha1" ]] && command -v keytool >/dev/null; then
    sha1="$(keytool -list -v -keystore "$keystore" -storepass "$storepass" -alias "$alias" \
      | grep -i 'SHA1:' | head -1 | sed -E 's/.*SHA1:[[:space:]]*//')"
    echo "Detected SHA1: $sha1"
  fi

  local b64
  if base64 --help 2>&1 | grep -q w; then
    b64="$(base64 -w 0 "$keystore")"
  else
    b64="$(base64 < "$keystore" | tr -d '\n')"
  fi

  echo "Syncing signing secrets to $repo..."
  gh secret set ANDROID_KEYSTORE_BASE64 --repo "$OWNER/$repo" --body "$b64"
  gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$OWNER/$repo" --body "$storepass"
  gh secret set ANDROID_KEY_ALIAS --repo "$OWNER/$repo" --body "$alias"
  gh secret set ANDROID_KEY_PASSWORD --repo "$OWNER/$repo" --body "$keypass"
  if [[ -n "$sha1" ]]; then
    gh secret set ANDROID_UPLOAD_CERT_SHA1 --repo "$OWNER/$repo" --body "$sha1"
  fi
  echo "Done for $repo."
}

[[ $# -ge 1 ]] || usage
require_gh

case "$1" in
  play)
    [[ $# -eq 2 ]] || usage
    sync_play_json "$2"
    ;;
  keystore)
    [[ $# -ge 3 ]] || usage
    shift
    sync_keystore_repo "$@"
    ;;
  *)
    usage
    ;;
esac
