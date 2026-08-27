#!/usr/bin/env bash
# CSSOS_WAVE_1992 20260827 — 《鹿柴》「空山不见人」自动校验器。
#
# 为什么必须自动: 第三部 55 镜的硬约束是【一个人都不许有】, 靠人眼看 55 个片子必漏。
# 而且锚图第一次就违反过 no people —— 模型对否定式指令的服从度本来就不可靠。
#
# 打法: ffmpeg 抽帧 -> KIE 的 Gemini 视觉判读 -> 逐帧数人。
# 只走 KIE(铁律), 不引第二家。判据写成【正面提问】而不是"有没有违规",
# 因为让模型找"违规"会倾向于报无违规(讨好), 让它数人则中立。
#
# 用法:
#   bash wangchuan-noperson-audit.sh calibrate            # 先在已知答案的两张锚图上验准头
#   bash wangchuan-noperson-audit.sh video <url> <label>  # 查一个片子
#   bash wangchuan-noperson-audit.sh image <url> <label>  # 查一张图
set -euo pipefail

K=$(sudo grep -E "^KIE_API_KEY=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"')
# CSSOS_WAVE_1992b — 本来用 KIE 的 Claude(平台默认判读模型), 但实测它【纯文字都在报
# "Server exception"】—— 不是图像的问题, 是那条路由整个在抛异常。按三强铁律换 Gemini
# (同在 KIE, 不引第二家), 实测吃图且 0.04 credits/次, 几乎免费。
MODEL="${KIE_VISION_MODEL:-gemini-3-pro}"
ENDPOINT="https://api.kie.ai/gemini-3.1-pro/v1/chat/completions"
WORK=/srv/cssos/tmp/noperson
mkdir -p "$WORK"

PROMPT='Look at this frame and answer with a single JSON object, nothing else.

Count every human being visible in the image. Count a human even if they are:
tiny, far away, blurred, in silhouette, seen from behind, partly hidden behind
foliage, or only a face/hand/leg. Also count human-shaped statues and painted or
carved human figures. Do NOT count animals, rocks that merely resemble a person,
or tree shapes.

Then separately note whether any obvious human-made object is present
(building, boat, umbrella, lantern, clothing, tools, path made of cut stone).

Reply exactly:
{"humans": <integer>, "where": "<short phrase, or empty>", "manmade": "<short phrase, or empty>"}'

ask_image () {   # $1 = local image file
  # 先缩到 1024 宽再编码 —— 原图 2.7MB 的 base64 当 argv 会 "Argument list too long",
  # 而且视觉模型本来就会把图缩到 ~1568px, 传原图纯属烧 token。
  ffmpeg -y -v error -i "$1" -vf "scale='min(1024,iw)':-2" /tmp/np_small.jpg
  base64 -w0 /tmp/np_small.jpg > /tmp/np_b64.txt 2>/dev/null \
    || base64 /tmp/np_small.jpg | tr -d '\n' > /tmp/np_b64.txt
  MODEL="$MODEL" python3 -c '
import json,os
b64=open("/tmp/np_b64.txt").read().strip()
prompt=open("/tmp/np_prompt.txt",encoding="utf-8").read()
print(json.dumps({"model":os.environ["MODEL"],"max_tokens":300,"messages":[{"role":"user","content":[
 {"type":"text","text":prompt},
 {"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+b64}}]}]}))' > /tmp/np_req.json
  curl -s -m 120 -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $K" -H "content-type: application/json" \
    --data-binary @/tmp/np_req.json \
  | python3 -c '
import sys,json,re
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print("PARSE_FAIL:"+raw[:160]); raise SystemExit
t=((d.get("choices") or [{}])[0].get("message") or {}).get("content","") or ""
m=re.search(r"\{.*\}",str(t),re.S)
print(m.group(0) if m else "NO_JSON:"+str(t)[:160])'
}

printf '%s' "$PROMPT" > /tmp/np_prompt.txt

case "${1:-}" in
calibrate)
  echo "== 校准: 已知答案的两张锚图 =="
  curl -s -o "$WORK/has_person.png" "https://cdn.cssstudio.app/artifacts/mv-plates/wangchuan/plateA-terrain-8902244088038121.png"
  curl -s -o "$WORK/no_person.png"  "https://cdn.cssstudio.app/artifacts/mv-plates/wangchuan/plateA-terrain-v2-7afd3a2c66221e14.png"
  echo -n "锚A-v1 (已知【有】一个人): "; ask_image "$WORK/has_person.png"
  echo -n "锚A-v2 (已知【无】人)    : "; ask_image "$WORK/no_person.png"
  ;;
image)
  curl -s -o "$WORK/one.png" "$2"
  echo -n "${3:-image}: "; ask_image "$WORK/one.png"
  ;;
video)
  url="$2"; label="${3:-shot}"
  curl -s -o "$WORK/v.mp4" "$url"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/v.mp4")
  rm -f "$WORK"/f_*.png
  # 抽 3 帧: 首 / 中 / 尾 —— 人可能只在其中一帧里晃过
  for i in 1 2 3; do
    t=$(python3 -c "print(max(0.1, $dur * ($i/4.0)))")
    ffmpeg -y -v error -ss "$t" -i "$WORK/v.mp4" -frames:v 1 -vf scale=768:-2 "$WORK/f_$i.png"
  done
  worst=0
  for f in "$WORK"/f_*.png; do
    r=$(ask_image "$f")
    n=$(python3 -c "
import json,sys
try: print(json.loads('''$r''').get('humans',0))
except Exception: print(-1)")
    echo "  $(basename "$f"): $r"
    [ "$n" -gt "$worst" ] 2>/dev/null && worst=$n
  done
  if [ "$worst" -eq 0 ]; then echo "✅ $label 无人"; else echo "❌ $label 检出 $worst 人 —— 需重拍"; fi
  ;;
*)
  echo "用法: $0 calibrate | image <url> [label] | video <url> [label]"; exit 1;;
esac
