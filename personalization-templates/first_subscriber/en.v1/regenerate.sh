#!/usr/bin/env bash
# CSSOS_PHASE2_PERSONALIZATION_STAGE_C 20260503 — Jing
# Re-generate every synthesised asset for first_subscriber.en.v1.
# Run from this directory:
#   cd personalization-templates/first_subscriber/en.v1 && ./regenerate.sh
#
# Requires: ffmpeg (>= 4.x)
#
# Output:
#   base.mp3   — 30s C-major rising arpeggio (C-E-G-C-E-G), gentle
#                fade-in / fade-out, no melody copyright concerns
#   base.mp4   — 30s 1920x1080 warm sunrise gradient still
#   cover.png  — first frame of base.mp4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DURATION=30
WIDTH=1920
HEIGHT=1080

echo "[regenerate] base.mp3 — C-major rising arpeggio pad (${DURATION}s)"
# Six rising-octave sine layers with staggered onsets — no melodic
# composition, just a slowly-blooming triad-stack that feels celebratory.
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "sine=frequency=261.63:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=329.63:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=392.00:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=523.25:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=659.25:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=783.99:duration=${DURATION}" \
  -filter_complex \
    "[0]volume=0.18,adelay=0|0[a0];\
     [1]volume=0.16,adelay=400|400[a1];\
     [2]volume=0.14,adelay=800|800[a2];\
     [3]volume=0.10,adelay=1600|1600[a3];\
     [4]volume=0.08,adelay=2400|2400[a4];\
     [5]volume=0.06,adelay=3200|3200[a5];\
     [a0][a1][a2][a3][a4][a5]amix=inputs=6:dropout_transition=0,\
     afade=t=in:st=0:d=2,\
     afade=t=out:st=$((DURATION - 4)):d=4,\
     aformat=sample_rates=44100:channel_layouts=stereo" \
  -c:a libmp3lame -b:a 192k \
  base.mp3

echo "[regenerate] base.mp4 — warm sunrise gradient still (${WIDTH}x${HEIGHT}, ${DURATION}s)"
# Top #1a0a3d (deep predawn) → bottom #d77a3a (sunrise gold).
# Visual placeholder — flat but warm; replace with real motion in v2.
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "color=c=0x1a0a3d:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
  -f lavfi -i "color=c=0xd77a3a:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
  -filter_complex \
    "[0][1]blend=all_expr='A*(1-Y/H)+B*(Y/H)':shortest=1" \
  -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -movflags +faststart \
  -t "$DURATION" \
  base.mp4

echo "[regenerate] cover.png — first frame of base.mp4"
ffmpeg -y -hide_banner -loglevel warning \
  -i base.mp4 \
  -frames:v 1 -update 1 \
  cover.png

echo "[regenerate] done."
ls -lh base.mp3 base.mp4 cover.png
