#!/usr/bin/env bash
# CSSOS_WAVE_1755 — Jing: farewell MV on account close (account_deletion.en.v1).
# Re-generate every synthesised placeholder asset. Mirrors welcome.en.v1's
# regenerate.sh. Run from this directory:
#   cd personalization-templates/account_deletion/en.v1 && ./regenerate.sh
#
# Requires: ffmpeg (>= 4.x)
#
# Output:
#   base.mp3   — 30s A-minor sine-wave ambient pad (3-voice triad, tender,
#                soft fade-in / fade-out, no melody, no copyright)
#   base.mp4   — 30s 1920x1080 dusk amber->indigo gradient still
#   cover.png  — first frame of base.mp4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DURATION=30
WIDTH=1920
HEIGHT=1080

echo "[regenerate] base.mp3 — A-minor triad sine-wave pad (${DURATION}s)"
# A3 (220.00) + C4 (261.63) + E4 (329.63) — a soft A-minor pad. Tender,
# not mournful: gentle 3s fade-in and 4s fade-out.
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "sine=frequency=220.00:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=261.63:duration=${DURATION}" \
  -f lavfi -i "sine=frequency=329.63:duration=${DURATION}" \
  -filter_complex \
    "[0]volume=0.17[a0];\
     [1]volume=0.13[a1];\
     [2]volume=0.10[a2];\
     [a0][a1][a2]amix=inputs=3:dropout_transition=0,\
     afade=t=in:st=0:d=3,\
     afade=t=out:st=$((DURATION - 4)):d=4,\
     aformat=sample_rates=44100:channel_layouts=stereo" \
  -c:a libmp3lame -b:a 192k \
  base.mp3

echo "[regenerate] base.mp4 — dusk amber->indigo gradient still (${WIDTH}x${HEIGHT}, ${DURATION}s)"
# Vertical gradient from #3a2a1a (dusk amber, top) to #191a3a (indigo,
# bottom) — a warm-to-cool twilight. Visual placeholder; replace with
# real motion design (rising embers per app.farewell-moment.js) in v2.
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "color=c=0x3a2a1a:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
  -f lavfi -i "color=c=0x191a3a:size=${WIDTH}x${HEIGHT}:duration=${DURATION}:rate=30" \
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
