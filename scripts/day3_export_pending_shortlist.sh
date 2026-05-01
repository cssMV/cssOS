#!/usr/bin/env bash
set -euo pipefail

python3 scripts/day3_export_pending_shortlist.py

echo
echo "Day 3 pending shortlist exported."
echo "Check data/meta/day3_triage/pending_shortlist/day3_pending_shortlist.csv"
