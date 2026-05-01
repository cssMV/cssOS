#!/usr/bin/env bash
set -euo pipefail

bash scripts/day1_collect.sh
bash scripts/day1_prepare_clips.sh
python3 scripts/build_stage1_manifest.py

echo
echo "Day 1 finished."
echo "Check data/meta/stage1_manifest.csv"
echo "Next step: assign same-person clips to char001 / char002 / char003 ..."
