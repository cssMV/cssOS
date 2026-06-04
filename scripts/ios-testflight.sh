#!/usr/bin/env bash
# CSSOS_WAVE_172 20260515 — Jing
# One-shot TestFlight upload. Replaces the manual Xcode UI dance.
#
# Usage:
#   npm run testflight:ios            # auto-bumps build number, archives, uploads
#   BUILD=42 npm run testflight:ios   # pins a specific build number
#   SKIP_SYNC=1 npm run testflight:ios   # skip `cap sync ios`
#
# Prereqs (one-time):
#   1. Xcode + command line tools installed
#   2. Signed in to Xcode with the dev account for team QBG9PRVBYZ
#   3. .env.local has APP_STORE_CONNECT_KEY_ID / ISSUER_ID / KEY_PATH
#      (Wave 171 set these up)
#
# What it does:
#   1. cap sync ios          (refreshes web assets into ios/App/App/public)
#   2. xcodebuild archive    → build/cssOS.xcarchive
#   3. xcodebuild exportArchive → build/cssOS.ipa
#   4. xcrun altool --upload-app  → TestFlight (auth via .p8 key)
#
# Failure modes:
#   - Code signing: open ios/App/App.xcworkspace in Xcode once, click
#     "Try Again" under Signing & Capabilities to refresh provisioning.
#   - Build number collision: increment manually with BUILD=N.
#   - Stale node_modules: `npm ci && cd ios/App && pod install`.

set -euo pipefail

# CSSOS_WAVE_172 — CocoaPods crashes on `String#unicode_normalize` unless
# LANG is UTF-8 (Ruby defaults to ASCII-8BIT for paths otherwise). This
# trips up `npx cap sync ios` which calls `pod install` internally.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# CSSOS_WAVE_172 — surface xcpretty when installed via `gem install --user`
# (lands in ~/.gem/ruby/<ver>/bin which is not on PATH by default).
for d in "$HOME"/.gem/ruby/*/bin; do
  [[ -d "$d" ]] && PATH="$d:$PATH"
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="${REPO_ROOT}/ios/App"
BUILD_DIR="${REPO_ROOT}/build"
ARCHIVE_PATH="${BUILD_DIR}/cssOS.xcarchive"
IPA_DIR="${BUILD_DIR}/ipa"
SCHEME="App"
WORKSPACE="${IOS_DIR}/App.xcworkspace"
EXPORT_OPTIONS="${REPO_ROOT}/scripts/ExportOptions.plist"

say() { printf '\033[36m[testflight] %s\033[0m\n' "$*"; }
die() { printf '\033[31m[testflight] FATAL: %s\033[0m\n' "$*" >&2; exit 1; }

# --- 0. Load .env.local creds (Wave 171) ----------------------------------
if [[ -f "${REPO_ROOT}/.env.local" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${REPO_ROOT}/.env.local"; set +a
fi
: "${APP_STORE_CONNECT_KEY_ID:?missing APP_STORE_CONNECT_KEY_ID in .env.local}"
: "${APP_STORE_CONNECT_ISSUER_ID:?missing APP_STORE_CONNECT_ISSUER_ID in .env.local}"
: "${APP_STORE_CONNECT_KEY_PATH:?missing APP_STORE_CONNECT_KEY_PATH in .env.local}"
[[ -f "${APP_STORE_CONNECT_KEY_PATH}" ]] || die ".p8 not found at ${APP_STORE_CONNECT_KEY_PATH}"

# --- 1. Sync web assets into the iOS bundle -------------------------------
if [[ "${SKIP_SYNC:-0}" != "1" ]]; then
  say "cap sync ios"
  (cd "${REPO_ROOT}" && npx cap sync ios)
else
  say "SKIP_SYNC=1 — skipping cap sync"
fi

# --- 2. Bump build number (CFBundleVersion) -------------------------------
PROJECT_FILE="${IOS_DIR}/App.xcodeproj/project.pbxproj"
if [[ -n "${BUILD:-}" ]]; then
  NEW_BUILD="${BUILD}"
  say "pinning build number to ${NEW_BUILD}"
else
  CURRENT_BUILD="$(grep -m1 'CURRENT_PROJECT_VERSION' "${PROJECT_FILE}" | sed 's/[^0-9]//g')"
  NEW_BUILD=$((CURRENT_BUILD + 1))
  say "bumping build ${CURRENT_BUILD} → ${NEW_BUILD}"
fi
# In-place edit, idempotent — replaces every CURRENT_PROJECT_VERSION = N
/usr/bin/sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = ${NEW_BUILD}/g" "${PROJECT_FILE}"

# --- 3. Clean previous build artifacts ------------------------------------
say "cleaning ${BUILD_DIR}"
rm -rf "${ARCHIVE_PATH}" "${IPA_DIR}"
mkdir -p "${BUILD_DIR}" "${IPA_DIR}"

# --- 4. Archive -----------------------------------------------------------
say "xcodebuild archive (this takes 2-5 min)"
# CSSOS_WAVE_172 — pass DEVELOPMENT_TEAM + CODE_SIGN_STYLE as explicit
# build settings. Capacitor 6 + Xcode 26's automatic-signing path
# inexplicably ignores the pbxproj DEVELOPMENT_TEAM value during a
# headless archive and bails with "Signing for App requires a
# development team". Setting them on the xcodebuild command line fixes
# it without touching the project file.
xcodebuild \
  -workspace "${WORKSPACE}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=QBG9PRVBYZ \
  CODE_SIGN_STYLE=Automatic \
  archive \
  | (command -v xcpretty >/dev/null && xcpretty || cat) || die "xcodebuild archive failed"

# --- 5. Export .ipa --------------------------------------------------------
say "xcodebuild exportArchive → ${IPA_DIR}"
xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${IPA_DIR}" \
  -exportOptionsPlist "${EXPORT_OPTIONS}" \
  -allowProvisioningUpdates \
  | (command -v xcpretty >/dev/null && xcpretty || cat) || die "xcodebuild exportArchive failed"

IPA_FILE="$(find "${IPA_DIR}" -name '*.ipa' | head -1)"
[[ -f "${IPA_FILE}" ]] || die "no .ipa produced in ${IPA_DIR}"
say "produced: ${IPA_FILE} ($(du -h "${IPA_FILE}" | cut -f1))"

# --- 6. Upload to TestFlight (App Store Connect API key auth) -------------
# `xcrun altool` uses the .p8 from one of these locations:
#   ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8
#   ./private_keys/AuthKey_<KEYID>.p8
#   <pwd>/private_keys/AuthKey_<KEYID>.p8
# We stage a symlink to make our gitignored location work transparently.
ALTOOL_KEYS_DIR="${HOME}/.appstoreconnect/private_keys"
mkdir -p "${ALTOOL_KEYS_DIR}"
KEY_FILENAME="AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"
if [[ ! -f "${ALTOOL_KEYS_DIR}/${KEY_FILENAME}" ]]; then
  say "staging .p8 symlink → ${ALTOOL_KEYS_DIR}/${KEY_FILENAME}"
  ln -sf "${APP_STORE_CONNECT_KEY_PATH}" "${ALTOOL_KEYS_DIR}/${KEY_FILENAME}"
fi

say "altool --upload-app (this takes 1-3 min)"
xcrun altool --upload-app \
  --type ios \
  --file "${IPA_FILE}" \
  --apiKey "${APP_STORE_CONNECT_KEY_ID}" \
  --apiIssuer "${APP_STORE_CONNECT_ISSUER_ID}" \
  --output-format json \
  || die "altool upload failed"

say "✅ Uploaded build ${NEW_BUILD}."
say "   Apple processing takes 5-15 min; we'll wait and auto-assign to the INTERNAL tester group (skips beta review)."

# --- 7. Wait for VALID + auto-assign to the INTERNAL tester group --------
# CSSOS_WAVE_220A 20260517 — Jing: previously, after upload the build sat
# in App Store Connect not assigned to any group, so TestFlight on the
# phone never showed it until manually added in the web UI. Now we poll
# the App Store Connect API until processingState=VALID, then POST the
# build into the tester group so it appears on-device immediately.
# Idempotent: re-running after a successful assign is a no-op (409 → skip).
#
# CSSOS_WAVE_220C 20260520 — Jing: FIX. We used to target "Internal — Jing"
# (8182a21c…) which is actually an EXTERNAL group (isInternalGroup=false).
# External groups require a Beta App Review pass before the build is
# installable, so every run "succeeded" yet the build stayed invisible on
# device (the exact reason builds 13/14 didn't show). Switch the default
# to the real INTERNAL group "App Store Connect Users (real internal)"
# (a2d9fd56…): internal groups skip beta review and appear immediately.
#
# Override the target group via TESTFLIGHT_GROUP_ID=<uuid> if needed.
ASC_APP_ID="${ASC_APP_ID:-6768848996}"
TESTFLIGHT_GROUP_ID="${TESTFLIGHT_GROUP_ID:-a2d9fd56-e006-4a24-88c6-e2f3905b9f4f}"  # App Store Connect Users (real internal)

if command -v node >/dev/null 2>&1; then
  say "waiting for Apple to finish processing build ${NEW_BUILD} → VALID..."
  APP_STORE_CONNECT_KEY_ID="${APP_STORE_CONNECT_KEY_ID}" \
  APP_STORE_CONNECT_ISSUER_ID="${APP_STORE_CONNECT_ISSUER_ID}" \
  APP_STORE_CONNECT_KEY_PATH="${APP_STORE_CONNECT_KEY_PATH}" \
  ASC_APP_ID="${ASC_APP_ID}" \
  TESTFLIGHT_GROUP_ID="${TESTFLIGHT_GROUP_ID}" \
  NEW_BUILD="${NEW_BUILD}" \
  node --input-type=module -e '
import { readFileSync } from "fs";
import { createSign } from "crypto";

const KEY_ID    = process.env.APP_STORE_CONNECT_KEY_ID;
const ISSUER    = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_PATH  = process.env.APP_STORE_CONNECT_KEY_PATH;
const APP_ID    = process.env.ASC_APP_ID;
const GROUP_ID  = process.env.TESTFLIGHT_GROUP_ID;
const VERSION   = process.env.NEW_BUILD;

const privateKey = readFileSync(KEY_PATH, "utf8");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const payl = b64({ iss: ISSUER, iat: now, exp: now + 600, aud: "appstoreconnect-v1" });
  const sig  = createSign("SHA256")
    .update(`${head}.${payl}`)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${head}.${payl}.${sig}`;
}
const tok = () => ({ Authorization: `Bearer ${jwt()}` });

async function findBuild() {
  const url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&filter[version]=${VERSION}&limit=1`;
  const r = await fetch(url, { headers: tok() });
  const d = await r.json();
  return d.data?.[0] || null;
}

async function waitForValid(maxMinutes = 20) {
  const deadline = Date.now() + maxMinutes * 60 * 1000;
  let lastState = "";
  while (Date.now() < deadline) {
    const b = await findBuild();
    if (!b) {
      process.stdout.write("[testflight]   build not yet visible in App Store Connect API...\n");
    } else {
      const s = b.attributes.processingState;
      if (s !== lastState) {
        process.stdout.write(`[testflight]   state=${s}\n`);
        lastState = s;
      }
      if (s === "VALID") return b;
      if (s === "FAILED" || s === "INVALID") {
        throw new Error(`Apple rejected build ${VERSION}: state=${s}`);
      }
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error(`Timed out after ${maxMinutes} min waiting for build ${VERSION} → VALID`);
}

async function assignToGroup(buildId) {
  const url = `https://api.appstoreconnect.apple.com/v1/betaGroups/${GROUP_ID}/relationships/builds`;
  const r = await fetch(url, {
    method: "POST",
    headers: { ...tok(), "Content-Type": "application/json" },
    body: JSON.stringify({ data: [{ type: "builds", id: buildId }] }),
  });
  if (r.status === 204) return true;
  // 409 = already in group; treat as success (idempotent).
  if (r.status === 409) { process.stdout.write("[testflight]   already in group (idempotent skip)\n"); return true; }
  const txt = await r.text();
  throw new Error(`assign HTTP ${r.status}: ${txt}`);
}

const build = await waitForValid();
process.stdout.write(`[testflight]   ✅ build ${VERSION} VALID (id=${build.id})\n`);
await assignToGroup(build.id);
process.stdout.write(`[testflight]   ✅ assigned to TestFlight group ${GROUP_ID}\n`);
' || die "auto-assign failed (build still uploaded; assign manually if needed)"
else
  say "node not on PATH — skipping auto-assign. Add manually in App Store Connect."
fi

say "✅ DONE — build ${NEW_BUILD} live on TestFlight, ready to install."
say "    Check status: https://appstoreconnect.apple.com/apps/${ASC_APP_ID}/testflight/ios"
