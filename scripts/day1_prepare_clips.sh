#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/clips
mkdir -p data/frames
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/prepare_${DATE_TAG}.log"

for f in data/raw/*.mp4; do
  [[ -f "$f" ]] || continue

  base="$(basename "$f" .mp4)"
  clip_dir="data/clips/$base"
  frame_dir="data/frames/$base"

  mkdir -p "$clip_dir"
  mkdir -p "$frame_dir"

  echo "=== PREPARE: $f" | tee -a "$LOG_FILE"

  ffmpeg -y \
    -i "$f" \
    -an \
    -c:v libx264 \
    -pix_fmt yuv420p \
    -f segment \
    -segment_time 4 \
    -reset_timestamps 1 \
    "$clip_dir/${base}_clip_%03d.mp4" \
    >> "$LOG_FILE" 2>&1 || true

  for c in "$clip_dir"/*.mp4; do
    [[ -f "$c" ]] || continue
    cbase="$(basename "$c" .mp4)"
    cframe_dir="$frame_dir/$cbase"
    mkdir -p "$cframe_dir"

    ffmpeg -y \
      -i "$c" \
      -vf "fps=2,scale=128:128" \
      "$cframe_dir/frame_%03d.png" \
      >> "$LOG_FILE" 2>&1 || true
  done
done

echo "Done. Clips in data/clips, frames in data/frames"
