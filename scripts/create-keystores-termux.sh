#!/usr/bin/env bash
# Create new Android upload keystores on Termux and push them to GitHub Secrets.
# Skips Workflow-Updater (keep your existing laptop keystore for that app).
#
# Usage:
#   pkg install openjdk-17 gh
#   gh auth login
#   cd ~/Workflow-Updater && git pull
#   ./scripts/create-keystores-termux.sh
#
# Optional: use one password for all new keystores
#   KEYSTORE_PASSWORD='your-secure-password' ./scripts/create-keystores-termux.sh
#
# NEVER commit keystores or ~/.android/signing/ to git.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNING_DIR="${ANDROID_SIGNING_DIR:-$HOME/.android/signing}"
CREDS_FILE="$SIGNING_DIR/keystore-credentials.txt"
ALIAS="upload"
VALIDITY_DAYS=10000

# repo_slug|display_name|dname_CN
APPS=(
  "Expense_Tracker|Expense Tracker|Expense Tracker"
  "LendFLow|LendFLow|LendFLow"
  "dress-inventory|Dress Inventory|Dress Inventory"
)

warn_play_console() {
  cat <<'EOF'

================================================================================
IMPORTANT — Google Play upload keys
================================================================================
New keystores work ONLY if:
  • The app has NEVER been uploaded to Play before, OR
  • You reset the upload key in Play Console (Release > Setup > App signing)

If an app was already published with a different keystore from your laptop,
uploads will FAIL until you either:
  1) Recover the original keystore from your laptop, OR
  2) Request an upload key reset in Play Console for that app

Workflow-Updater is skipped — it already uses your laptop keystore.
================================================================================

EOF
}

require_tools() {
  local missing=0
  for tool in keytool gh; do
    if ! command -v "$tool" >/dev/null; then
      echo "Missing: $tool"
      missing=1
    fi
  done
  if [[ "$missing" -eq 1 ]]; then
    echo ""
    echo "On Termux, run:"
    echo "  pkg update && pkg install openjdk-17 gh"
    exit 1
  fi
  gh auth status >/dev/null 2>&1 || {
    echo "Run: gh auth login"
    exit 1
  }
}

random_password() {
  if command -v openssl >/dev/null; then
    openssl rand -base64 24 | tr -d '/+=' | head -c 24
  else
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24
  fi
}

create_keystore() {
  local repo="$1"
  local display="$2"
  local cn="$3"
  local slug
  slug="$(echo "$repo" | tr '[:upper:]' '[:lower:]' | tr '_' '-')"
  local dir="$SIGNING_DIR/$slug"
  local keystore="$dir/upload-keystore.jks"
  local password="${KEYSTORE_PASSWORD:-}"

  mkdir -p "$dir"
  chmod 700 "$SIGNING_DIR" "$dir"

  if [[ -f "$keystore" ]]; then
    echo ""
    echo "Keystore already exists: $keystore"
    read -r -p "Overwrite? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || { echo "Skipped $repo"; return 0; }
    rm -f "$keystore"
  fi

  if [[ -z "$password" ]]; then
    password="$(random_password)"
  fi

  echo ""
  echo "Creating keystore for $display ($repo)..."
  keytool -genkeypair -v \
    -keystore "$keystore" \
    -alias "$ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -storepass "$password" \
    -keypass "$password" \
    -dname "CN=${cn}, OU=Mobile, O=hanzel1698, C=IN"

  chmod 600 "$keystore"

  local sha1
  sha1="$(keytool -list -v -keystore "$keystore" -storepass "$password" -alias "$ALIAS" \
    | grep -i 'SHA1:' | head -1 | sed -E 's/.*SHA1:[[:space:]]*//')"

  echo "  Keystore: $keystore"
  echo "  SHA1:     $sha1"

  {
    echo "[$repo]"
    echo "keystore=$keystore"
    echo "alias=$ALIAS"
    echo "storepass=$password"
    echo "keypass=$password"
    echo "sha1=$sha1"
    echo "created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo ""
  } >> "$CREDS_FILE"

  echo "Uploading secrets to GitHub ($repo)..."
  "$ROOT/scripts/sync-github-secrets.sh" keystore "$repo" "$keystore" "$ALIAS" "$password" "$password" "$sha1"
}

main() {
  warn_play_console
  read -r -p "Continue creating NEW keystores for 3 apps? [y/N] " confirm
  [[ "${confirm,,}" == "y" ]] || { echo "Cancelled."; exit 0; }

  require_tools
  mkdir -p "$SIGNING_DIR"
  chmod 700 "$SIGNING_DIR"

  if [[ -f "$CREDS_FILE" ]]; then
    cp "$CREDS_FILE" "${CREDS_FILE}.bak.$(date +%s)"
  fi
  : > "$CREDS_FILE"
  chmod 600 "$CREDS_FILE"

  echo "Credentials will be saved to: $CREDS_FILE"
  echo "Back up this file somewhere safe (not GitHub)."

  for entry in "${APPS[@]}"; do
    IFS='|' read -r repo display cn <<< "$entry"
    create_keystore "$repo" "$display" "$cn"
  done

  cat <<EOF

================================================================================
Done.
================================================================================
Keystores:  $SIGNING_DIR/
Passwords:  $CREDS_FILE  (chmod 600 — back this up offline)

GitHub secrets set on:
  - hanzel1698/Expense_Tracker
  - hanzel1698/LendFLow
  - hanzel1698/dress-inventory

Next steps:
  1. Back up $SIGNING_DIR to encrypted cloud/USB when you can
  2. Sync Play JSON if not done yet:
       ./scripts/sync-github-secrets.sh play /path/to/play-service-account.json
  3. Run "Bump versionCode and Build for Play" then "Upload to Google Play"

EOF
}

main "$@"
