#!/usr/bin/env bash
set -euo pipefail

REPO="${CSSOS_REPO:-/home/jing/cssOS/repo}"
LOCK="/tmp/cssos-git-autosave.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "autosave already running"
  exit 0
fi

sudo -n "$REPO/scripts/ops/cssos-media-sync.sh" || true

cd "$REPO"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not a git repo: $REPO"
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "HEAD" ]]; then
  echo "detached HEAD, skip autosave"
  exit 0
fi

git add -A
if git diff --cached --quiet; then
  echo "no changes"
  exit 0
fi

stamp="$(date '+%Y-%m-%d %H:%M:%S %z')"
git commit -m "chore(autosave): checkpoint $stamp"
git push origin "$branch"

sudo -n "$REPO/scripts/ops/cssos-auto-deploy.sh" || true
