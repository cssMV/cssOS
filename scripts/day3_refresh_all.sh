#!/usr/bin/env bash
set -euo pipefail

bash scripts/day3_refresh_triage_stats.sh
echo
bash scripts/day3_export_pending_shortlist.sh

echo
echo "Day 3 review board refreshed."
echo "Check data/meta/day3_triage/day3_character_triage_stats.csv"
echo "Check data/meta/day3_triage/pending_shortlist/day3_pending_shortlist.csv"
echo
python3 - <<'PY'
import csv
from pathlib import Path

stats_path = Path("data/meta/day3_triage/day3_character_triage_stats.csv")
if not stats_path.is_file():
    raise SystemExit(0)

with stats_path.open(encoding="utf-8", newline="") as handle:
    rows = list(csv.DictReader(handle))

if not rows:
    raise SystemExit(0)

def to_int(row, key):
    try:
        return int(row.get(key, 0) or 0)
    except ValueError:
        return 0

def to_float(row, key):
    try:
        return float(row.get(key, 0) or 0)
    except ValueError:
        return 0.0

remaining_rows = [row for row in rows if to_int(row, "remaining") > 0]
if not remaining_rows:
    print("Next suggestion: all sampled items have been reviewed.")
    raise SystemExit(0)

best = max(
    remaining_rows,
    key=lambda row: (
        to_int(row, "remaining"),
        to_float(row, "keep_ratio_reviewed"),
        to_int(row, "keep"),
        row.get("character_id", ""),
    ),
)

character_id = best.get("character_id", "unknown")
remaining = to_int(best, "remaining")
progress = best.get("review_progress", "0/0")
keep_ratio_reviewed = to_float(best, "keep_ratio_reviewed")

print(
    "Next suggestion: prioritize {} first "
    "(remaining={}, progress={}, keep_ratio_reviewed={:.2%}).".format(
        character_id,
        remaining,
        progress,
        keep_ratio_reviewed,
    )
)
PY
