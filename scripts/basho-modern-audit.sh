#!/usr/bin/env bash
# CSSOS_WAVE_2001 — 《奥の細道》现代物校验。复用无人校验器的骨架, 只换判据。
# 芭蕉的硬约束不是"无人"(三部都允许旅人剪影), 而是【禁现代物】——
# 江戸年間的东北, 出现电线/水泥/船只/护岸/路标就是废镜。
# 判据同样写成【正面提问】(数一数有几件现代物), 不是"有没有违规"。
set -uo pipefail
cat > /tmp/modern_prompt.txt <<'PROMPT'
Look at this frame from a film set in Edo-period Japan (1689). Answer with a single JSON object, nothing else.

Count every object that could NOT have existed in Japan in 1689. Count it even if small,
blurred or far away. Things that count: power lines, utility poles, concrete, asphalt, metal
railings, guardrails, modern ships or boats with engines, road signs, plastic, glass windows,
cars, modern clothing, buildings with modern materials.
Do NOT count: rocks, trees, grass, moss, water, mist, stars, wooden temples, straw hats,
stone steps, or a person in traditional robes.

Also say whether any warm artificial light source is visible (lantern, fire, lamp glow).

Reply exactly:
{"modern": <integer>, "what": "<short phrase, or empty>", "warmlight": "<short phrase, or empty>"}
PROMPT
python3 - <<'PY' > /tmp/bsurls.txt
import json
p=json.load(open("/srv/cssos/tmp/basho-shoot-progress.json"))
s=json.load(open("/tmp/basho-shotlist.json"))
for pk in ("p1","p2","p3"):
    for _a,num,_x,_y,_d,_desc in s[pk]:
        r=p.get(f"{pk}:{num}")
        if r and r.get("ok"): print(f"{pk}#{num}|{r['url']}")
PY
mapfile -t ROWS < /tmp/bsurls.txt
echo "待校验 ${#ROWS[@]} 镜"
: > /tmp/bsresults.txt
for row in "${ROWS[@]}"; do
  lbl="${row%%|*}"; url="${row#*|}"
  [ -z "$url" ] && continue
  res=$(NP_PROMPT_FILE=/tmp/modern_prompt.txt bash /tmp/np.sh video "$url" "$lbl" </dev/null 2>/dev/null | grep -oE '\{[^}]*\}' | head -3)
  n=$(python3 -c "
import sys,json,re
mx=0
for m in re.findall(r'\{[^}]*\}', '''$res'''):
    try: mx=max(mx,int(json.loads(m).get('modern',0)))
    except Exception: pass
print(mx)")
  echo "$lbl|$n|$url" >> /tmp/bsresults.txt
  if [ "$n" != "0" ]; then echo "❌ $lbl 现代物 $n"; else echo "✅ $lbl"; fi
done
python3 - <<'PY'
rows=[l.strip().split("|") for l in open("/tmp/bsresults.txt") if l.strip()]
total=sum(1 for _ in open("/tmp/bsurls.txt"))
bad=[r[0] for r in rows if int(r[1])>0]
print("--- 汇总 ---")
print(f"清单 {total} 镜, 实际校验 {len(rows)} 镜" + ("  ⚠️ 有漏!" if len(rows)!=total else "  ✅ 无遗漏"))
print(f"检出现代物 {len(bad)} 镜: {bad}")
PY
