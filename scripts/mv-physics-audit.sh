#!/usr/bin/env bash
# CSSOS_WAVE_2015 20260828 — 【物理常识校验器】。
#
# Jing:「必须查物理常识。像 OpenAI 说的"模拟"世界, 不符合人类现实生活的内容, 都要检测。
#        这是 AI 经常犯的错误。初期的 AI 经常无法显示正常的人类手指数, 对人类面部也非常模糊,
#        无法显示正常的五官, 更别说丑美了。」
#
# 为什么必须单独有这一层:
# 之前三个校验器查的都是【有没有违规元素】—— 人数 / 露脸 / 现代物 / 帽型。
# 它们全都放行了这些镜头:
#   · 芭蕉 p1#1  一只【悬空的手】在系草鞋, 鞋里露出脚趾, 没有腿没有身体 -> 恐怖片
#   · 旧时相识    两人【坐在水里】对谈; 一个男子【站在水面上】
# 这些不是"多了个不该有的东西", 是【这个世界不成立】。用户一眼觉得诡异, 却说不出哪不对。
#
# 判据仍然是【正面提问 + 数数】(让模型找"错误"它会倾向说没有):
#   数手指 / 数四肢 / 问站在什么上面 / 问五官是否完整
#
# 用法:
#   bash mv-physics-audit.sh calibrate          # 先在【已知有问题】的镜头上校准
#   bash mv-physics-audit.sh list <urls.txt>    # 批量; 每行 label|url
set -uo pipefail

cat > /tmp/physics_prompt.txt <<'PROMPT'
You are checking a single frame from a film for PHYSICAL PLAUSIBILITY — whether this could exist in
the real world. Answer with one JSON object and nothing else. Be literal and count carefully.

1. "people": how many humans are visible (any size).
2. "bodies_complete": true only if EVERY visible human has a coherent connected body.
   Set it FALSE if you can see a hand, arm, leg or foot that is NOT visibly attached to a body,
   or a body part that fades into the background, or a person missing an expected limb.
3. "fingers_ok": true only if every clearly visible hand has exactly five fingers and normal shape.
   Use "n/a" if no hand is clearly visible.
4. "faces_ok": true only if every clearly visible face has normal, well-formed features
   (two eyes, nose, mouth, correct placement, not melted, not smeared, not doubled).
   Use "n/a" if no face is clearly visible.
5. "supported": what is each person actually standing, sitting or resting ON?
   Answer with a short phrase, e.g. "ground", "boat", "chair", "water surface", "nothing / mid-air".
6. "impossible": count things that break physics or common sense. Count each occurrence:
   - a person standing, sitting or walking directly ON water with no boat, raft or platform
   - a HUMAN FLYING, hovering, floating in the air, or airborne alongside birds
   - a person or object floating with nothing supporting it
   - a body passing through solid matter; two bodies occupying the same space
   - duplicated or extra limbs; a limb bending the wrong way
   - a shadow falling in the wrong direction, or a person with no shadow while others have one
   - water flowing uphill; fire or smoke falling downward; rain falling upward
   - an animal or object at an impossible scale next to a human
   - a reflection that does not match what is above it
7. "note": one short phrase naming the worst problem, or "" if none.

Reply exactly:
{"people": <int>, "bodies_complete": <true|false>, "fingers_ok": <true|false|"n/a">,
 "faces_ok": <true|false|"n/a">, "supported": "<phrase>", "impossible": <int>, "note": "<phrase>"}
PROMPT

ask () {  # $1 = video url, $2 = label ; 抽首/中/尾三帧, 取最坏的一帧
  bash /tmp/np.sh video "$1" "$2" </dev/null 2>/dev/null | grep -oE '\{[^}]*\}' | head -3
}

judge () {  # stdin: 若干 JSON 行 -> "bad|note"
  python3 -c "
import sys,json,re
raw=sys.stdin.read()
bad=0; notes=[]
for m in re.findall(r'\{[^}]*\}', raw):
    try: d=json.loads(m)
    except Exception: continue
    why=[]
    if d.get('bodies_complete') is False: why.append('肢体不完整')
    if d.get('fingers_ok') is False:      why.append('手指异常')
    if d.get('faces_ok') is False:        why.append('五官异常')
    if int(d.get('impossible',0) or 0)>0: why.append('违反物理'+str(d.get('impossible')))
    sup0=str(d.get('supported','')).lower()
    if 'air' in sup0 or 'fly' in sup0 or 'sky' in sup0: why.append('悬空/飞行')
    sup=str(d.get('supported','')).lower()
    if 'water surface' in sup or 'mid-air' in sup or 'nothing' in sup: why.append('站在'+sup)
    if why:
        bad=1; notes.append(','.join(why)+('/'+str(d.get('note','')) if d.get('note') else ''))
print(str(bad)+'|'+(' ; '.join(dict.fromkeys(notes))[:110]))"
}

case "${1:-}" in
calibrate)
  echo "== 校准: 用【已知有问题】的三个镜头验准头 =="
  declare -a C=(
    "芭蕉p1#1旧(悬空的手)|https://cdn.cssstudio.app/artifacts/mv-shots/basho/shot-bs11-dbb5ff924d3eb25e.mp4"
    "旧时相识js07(坐水里)|https://cdn.cssstudio.app/artifacts/mv-shots/xunxunmimi/shot-js07-fe91a0f120dc827c.mp4"
    "旧时相识js10(站水上)|https://cdn.cssstudio.app/artifacts/mv-shots/xunxunmimi/shot-js10-45cf9f192aa1265a.mp4"
  )
  for c in "${C[@]}"; do
    lbl="${c%%|*}"; url="${c#*|}"
    r=$(NP_PROMPT_FILE=/tmp/physics_prompt.txt ask "$url" "$lbl")
    v=$(printf '%s' "$r" | judge)
    printf "%-26s %s  %s\n" "$lbl" "$([ "${v%%|*}" = "1" ] && echo '❌ 检出' || echo '✅ 未检出')" "${v#*|}"
  done
  ;;
list)
  IN="${2:?需要 label|url 清单文件}"
  OUT="${3:-/tmp/physics-results.txt}"
  mapfile -t ROWS < "$IN"
  echo "物理常识校验 ${#ROWS[@]} 镜"
  : > "$OUT"
  for row in "${ROWS[@]}"; do
    [ -z "$row" ] && continue
    lbl="${row%%|*}"; url="${row#*|}"
    r=$(NP_PROMPT_FILE=/tmp/physics_prompt.txt ask "$url" "$lbl")
    v=$(printf '%s' "$r" | judge)
    echo "$lbl|${v%%|*}|${v#*|}|$url" >> "$OUT"
    [ "${v%%|*}" = "1" ] && echo "❌ $lbl  ${v#*|}" || echo "✅ $lbl"
  done
  python3 - "$IN" "$OUT" <<'PY'
import sys
tot=sum(1 for l in open(sys.argv[1]) if l.strip())
rows=[l.strip().split("|") for l in open(sys.argv[2]) if l.strip()]
bad=[r for r in rows if r[1]=="1"]
print("--- 汇总 ---")
print(f"清单 {tot} 镜, 实际校验 {len(rows)} 镜" + ("  ⚠️ 有漏!" if len(rows)!=tot else "  ✅ 无遗漏"))
print(f"物理/常识问题 {len(bad)} 镜")
for r in bad[:40]: print("   ", r[0], r[2])
PY
  ;;
*)
  echo "用法: $0 calibrate | list <urls.txt> [out.txt]"; exit 1;;
esac
