#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  extract-run-video-frames.sh --run-id RUN_ID [--host api-vm] [--source shot|video|final] [--count 4]

Examples:
  scripts/extract-run-video-frames.sh --run-id run_20260330_180502_eead68ea100a4033825c93308914c92e
  scripts/extract-run-video-frames.sh --run-id run_xxx --source final --count 3

The script extracts evenly spaced JPG frames from a run video on the remote host
and copies them into /Users/jing/cssOS/tmp_inspect/<run_id>/ locally.
EOF
}

RUN_ID=""
HOST="api-vm"
SOURCE_KIND="shot"
FRAME_COUNT="4"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --source)
      SOURCE_KIND="${2:-}"
      shift 2
      ;;
    --count)
      FRAME_COUNT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${RUN_ID}" ]]; then
  echo "--run-id is required" >&2
  usage >&2
  exit 1
fi

case "${SOURCE_KIND}" in
  shot)
    REMOTE_VIDEO="./build/video/shots/video_shot_000.mp4"
    ;;
  video)
    REMOTE_VIDEO="./build/video/video.mp4"
    ;;
  final)
    REMOTE_VIDEO="./build/final_mv.mp4"
    ;;
  *)
    echo "--source must be one of: shot, video, final" >&2
    exit 1
    ;;
esac

LOCAL_DIR="/Users/jing/cssOS/tmp_inspect/${RUN_ID}"
mkdir -p "${LOCAL_DIR}"
rm -f "${LOCAL_DIR}"/*.jpg 2>/dev/null || true

REMOTE_RUN_DIR="/srv/cssos/shared/runs/${RUN_ID}"
REMOTE_TMP_DIR="/tmp/cssos-frame-check-${RUN_ID}-${SOURCE_KIND}"
LOCAL_BASENAME="$(basename "${LOCAL_DIR}")"

ssh "${HOST}" "bash -lc '
set -euo pipefail
RUN_DIR=\"${REMOTE_RUN_DIR}\"
VIDEO_PATH=\"${REMOTE_RUN_DIR}/${REMOTE_VIDEO#./}\"
OUT_DIR=\"${REMOTE_TMP_DIR}\"
COUNT=${FRAME_COUNT}
rm -rf \"\$OUT_DIR\"
mkdir -p \"\$OUT_DIR\"
if [[ ! -f \"\$VIDEO_PATH\" ]]; then
  echo \"missing video: \$VIDEO_PATH\" >&2
  exit 1
fi
DURATION=\$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"\$VIDEO_PATH\")
python3 - <<PY
duration = max(0.1, float(\"\"\"\$DURATION\"\"\".strip() or 0.0))
count = max(1, int(\"${FRAME_COUNT}\"))
times = [max(0.08, min(duration - 0.08, duration * ((i + 1) / (count + 1)))) for i in range(count)]
for idx, value in enumerate(times, 1):
    print(f\"{idx} {value:.3f}\")
PY
' | while read -r INDEX TS; do
  REMOTE_FILE=\"${REMOTE_TMP_DIR}/frame_\$(printf '%02d' \"\$INDEX\")_\${TS//./_}.jpg\"
  ssh \"${HOST}\" \"ffmpeg -y -ss \"\$TS\" -i \"${REMOTE_RUN_DIR}/${REMOTE_VIDEO#./}\" -frames:v 1 -q:v 2 \"\$REMOTE_FILE\" >/dev/null 2>&1\"
done"

ssh "${HOST}" "bash -lc '
set -euo pipefail
cd \"${REMOTE_TMP_DIR}\"
shopt -s nullglob
files=( *.jpg )
if (( \${#files[@]} == 0 )); then
  echo \"no extracted jpg frames in ${REMOTE_TMP_DIR}\" >&2
  exit 1
fi
tar -cf - \"\${files[@]}\"
'" | tar -xf - -C "${LOCAL_DIR}"

ssh "${HOST}" "rm -rf '${REMOTE_TMP_DIR}'" >/dev/null 2>&1 || true

echo "Extracted frames:"
ls -1 "${LOCAL_DIR}"/*.jpg
