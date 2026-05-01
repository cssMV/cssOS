#!/usr/bin/env bash
set -e
COVER=/var/lib/cssos/covers/01605c9406c2023d384e30858d097fed.webp
DIR=/tmp/xfade-test
mkdir -p "$DIR"
cd "$DIR"
rm -f seg-*.mp4 out.mp4

# Render 4 short Ken-Burns clips (each 4s @ 25fps).
for i in 0 1 2 3; do
  ffmpeg -y -loop 1 -t 4 -i "$COVER" \
    -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z=min(zoom+0.0010\,1.3):x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=100:s=1280x720:fps=25,setsar=1" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 25 -an "seg-000${i}.mp4" \
    > /tmp/xfade-seg-${i}.log 2>&1
done

echo "---SEGMENTS---"
ls -la seg-*.mp4

echo "---XFADE_RUN---"
ffmpeg -y \
  -i seg-0000.mp4 -i seg-0001.mp4 -i seg-0002.mp4 -i seg-0003.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1.200:offset=2.800[v001];[v001][2:v]xfade=transition=fade:duration=1.200:offset=5.600[v002];[v002][3:v]xfade=transition=fade:duration=1.200:offset=8.400[vmix]" \
  -map "[vmix]" -c:v libx264 -preset veryfast -pix_fmt yuv420p -movflags +faststart -an out.mp4 \
  > /tmp/xfade-run.log 2>&1

echo "EXIT=$?"
echo "---OUT---"
ls -la out.mp4
echo "---DURATION---"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 out.mp4
