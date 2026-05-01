#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <submit_request.json> <output_dir> [timeout_sec]" >&2
  exit 64
fi

submit_request="$1"
output_dir="$2"
timeout_sec="${3:-1800}"

bridge_python="${CSSMV_DIFFSINGER_BRIDGE_PYTHON:-/srv/cssmv-hosts/diffsinger-v14-torch113-venv/bin/python}"
bridge_root="${CSSMV_DIFFSINGER_LEGACY_ROOT:-/srv/cssmv-hosts/DiffSinger-v1.4.0}"
bridge_onnx="${CSSMV_DIFFSINGER_LEGACY_ONNX:-/tmp/1215_opencpop_ds1000_fix_label_nomidi.diff_decoder.t113.op14.onnx}"
speedup="${CSSMV_DIFFSINGER_SPEEDUP:-10}"
chunk_frames="${CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES:-128}"
chunk_overlap="${CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP:-16}"

mkdir -p "$output_dir"
log_path="$output_dir/bridge.log"
pid_path="$output_dir/bridge.pid"

nohup env \
  CSSMV_DIFFSINGER_BRIDGE_PYTHON="$bridge_python" \
  CSSMV_DIFFSINGER_LEGACY_ROOT="$bridge_root" \
  CSSMV_DIFFSINGER_LEGACY_ONNX="$bridge_onnx" \
  CSSMV_DIFFSINGER_SPEEDUP="$speedup" \
  CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES="$chunk_frames" \
  CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP="$chunk_overlap" \
  timeout "${timeout_sec}s" \
  /srv/cssos/current/scripts/cssmv-diffsinger-legacy-bridge.py \
  "$submit_request" \
  "$output_dir" \
  >"$log_path" 2>&1 &

echo $! > "$pid_path"
printf '{"pid":%s,"logPath":"%s","outputDir":"%s"}\n' "$(cat "$pid_path")" "$log_path" "$output_dir"
