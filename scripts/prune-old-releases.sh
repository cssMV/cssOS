#!/usr/bin/env bash
set -euo pipefail

RELEASE_ROOT="${RELEASE_ROOT:-/srv/cssos/releases}"
CURRENT_LINK="${CURRENT_LINK:-/srv/cssos/current}"
KEEP_COUNT="${KEEP_COUNT:-3}"
EXECUTE="${EXECUTE:-0}"
RM_PREFIX=()

if command -v sudo >/dev/null 2>&1; then
  RM_PREFIX=(sudo)
fi

usage() {
  cat <<'EOF'
Usage: prune-old-releases.sh [options]

Keep the current release and the newest N release directories.
Dry-run by default.

Options:
  --release-root <path>   Releases directory
  --current-link <path>   Symlink pointing to active release
  --keep-count <n>        Number of newest releases to keep in addition to active target safety
  --execute               Actually remove old release directories
  --help                  Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-root) RELEASE_ROOT="$2"; shift 2 ;;
    --current-link) CURRENT_LINK="$2"; shift 2 ;;
    --keep-count) KEEP_COUNT="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

mapfile -t releases < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d | sort -r)
current_target="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

declare -A keep
count=0
for release in "${releases[@]}"; do
  if [[ $count -lt $KEEP_COUNT ]]; then
    keep["$release"]=1
    ((count+=1))
  fi
done
if [[ -n "$current_target" ]]; then
  keep["$current_target"]=1
fi

echo "Current target: ${current_target:-<none>}"
echo "Keeping up to $KEEP_COUNT newest releases plus current target."
echo

for release in "${releases[@]}"; do
  if [[ -n "${keep[$release]:-}" ]]; then
    echo "KEEP  $release"
  else
    echo "PRUNE $release"
    if [[ "$EXECUTE" == "1" ]]; then
      "${RM_PREFIX[@]}" rm -rf "$release"
    fi
  fi
done

if [[ "$EXECUTE" != "1" ]]; then
  echo
  echo "Dry-run only. Re-run with --execute to delete the PRUNE set."
fi
