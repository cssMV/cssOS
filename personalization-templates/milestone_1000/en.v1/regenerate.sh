#!/usr/bin/env bash
# CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #272 — Jing
# Re-generate every synthesised asset for welcome.en.v1.
# Run from this directory:  cd personalization-templates/welcome/en.v1 && ./regenerate.sh
#
# Requires: ffmpeg (>= 4.x)
#
# Output:
#   base.mp3   — 30s C-major sine-wave ambient pad (3-voice triad,
#                soft fade-in / fade-out, no melody, no copyright)
#   base.mp4   — 30s 1920x1080 warm dark-purple gradient still
#   cover.png  — first frame of base.mp4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DURATION=30
WIDTH=1920
HEIGHT=1080

echo "[regenerate] base.mp3 — C-major triad sine-wave pad (${DURATION}s)"
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "sine=frequency=261.63:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=329.63:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=392.00:duration=${DURATION}" \
  -filter_complex \
    "[0]volume=0.18[a0];\
     [1]volume=0.14[a1];\
     [2]volume=0.10[a2];\
     [a0][a1][a2]amix=inputs=3:dropout_transition=0,\
     afade=t=in:st=0:d=2.5,\
     afade=t=out:st=$((DURATION - 3)):d=3,\
     aformat=sample_rates=44100:channel_layouts=stereo" \
  -c:a libmp3lame -b:a 192k \
  base.mp3

echo "[regenerate] base.mp4 — warm dark-purple gradient still (${WIDTH}x${HEIGHT}, ${DURATION}s)"
# Two stacked color sources blended into a soft vertical gradient
# from #2b1248 (top) to #4a1a54 (bottom). Visual placeholder — flat
# but warm; replace with real motion design in v2.
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "color=c=0x2b1248:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
  -f lavfi -i "color=c=0x4a1a54:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
  -filter_complex \
    "[0][1]blend=all_expr='A*(1-Y/H)+B*(Y/H)':shortest=1" \
  -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -movflags +faststart \
  -t "$DURATION" \
  base.mp4

echo "[regenerate] cover.png — first frame of base.mp4"
ffmpeg -y -hide_banner -loglevel warning \
  -i base.mp4 -frames:v 1 -update 1 \
  cover.png

echo "[regenerate] done. asset sizes:"
ls -lh base.mp3 base.mp4 cover.png | awk '{print "  " $5 "\t" $9}'
