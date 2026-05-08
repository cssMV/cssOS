#!/usr/bin/env bash
# CSSOS_POST_SYNC 20260508 — Jing
#
# Run AFTER `npx cap sync ios` to merge our App Store-required Info.plist
# additions (privacy usage strings + export compliance flag). Capacitor
# regenerates the plist on every sync; this script reasserts our keys.
#
# Usage:
#   cd mobile && npx cap sync ios && bash scripts/post-sync.sh

set -e

cd "$(dirname "$0")/.."

PLIST="ios/App/App/Info.plist"
ADDITIONS="ios-info-additions.plist"

if [ ! -f "$PLIST" ]; then
  echo "[post-sync] $PLIST not found — run 'npx cap add ios' first."
  exit 1
fi

# Skip if our marker is already present (idempotent).
if grep -q "CSSOS_PRIVACY_USAGE\|NSCameraUsageDescription" "$PLIST"; then
  echo "[post-sync] privacy strings already present — skipping."
  exit 0
fi

# Strip XML comments + extract just the <key>/<string>... lines.
ADDITIONS_INNER=$(awk '/^<key>|^<string>|^<true|^<false|^<array>|^<\/array>/ {print}' "$ADDITIONS")

# Splice before </dict> — the second-to-last line.
TMP=$(mktemp)
awk -v additions="$ADDITIONS_INNER" '
  /^<\/dict>/ && !inserted {
    print "\t<!-- CSSOS_PRIVACY_USAGE auto-merged by post-sync.sh -->"
    print additions
    inserted = 1
  }
  { print }
' "$PLIST" > "$TMP"
mv "$TMP" "$PLIST"

echo "[post-sync] merged $(grep -c '^<key>' "$ADDITIONS") privacy/compliance keys into $PLIST"
