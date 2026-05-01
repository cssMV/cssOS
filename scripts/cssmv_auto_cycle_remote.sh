#!/usr/bin/env bash
set -euo pipefail

cd /srv/cssos/repo

mkdir -p logs
DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/cssmv_auto_cycle_${DATE_TAG}.log"
PROBE_V4_GATE_THRESHOLD_PERCENT="${PROBE_V4_GATE_THRESHOLD_PERCENT:-12}"

echo "[auto-cycle] start ${DATE_TAG}" | tee -a "$LOG_FILE"

# Current highest-value automatic step: keep pushing shot_002 quality upward.
bash scripts/day7_recollect_shot002_refined.sh >> "$LOG_FILE" 2>&1 || true

python3 scripts/build_single_pool_triage.py \
  --input-dir data/raw_char/char002_shot002_refined \
  --target-shot shot002_refined \
  --output-root data/meta/day7_refined_triage \
  >> "$LOG_FILE" 2>&1 || true

python3 scripts/report_collection_effectiveness.py \
  --label day7_shot002_refined \
  --triage-csv data/meta/day7_refined_triage/shot002_refined_triage.csv \
  --raw-dirs data/raw_char/char002_shot002_refined \
  --output-json data/meta/day7_refined_triage/day7_shot002_refined_effectiveness.json \
  --output-csv data/meta/day7_refined_triage/day7_shot002_refined_effectiveness.csv \
  >> "$LOG_FILE" 2>&1 || true

python3 scripts/gate_probe_v4_candidates.py \
  --effectiveness-json data/meta/day7_refined_triage/day7_shot002_refined_effectiveness.json \
  --triage-csv data/meta/day7_refined_triage/shot002_refined_triage.csv \
  --threshold-percent "$PROBE_V4_GATE_THRESHOLD_PERCENT" \
  --target-shot shot002_refined \
  --output-root data/validation/probe_v4_candidates \
  >> "$LOG_FILE" 2>&1 || true

echo "[auto-cycle] done ${DATE_TAG}" | tee -a "$LOG_FILE"
echo "[auto-cycle] log=${LOG_FILE}" | tee -a "$LOG_FILE"
