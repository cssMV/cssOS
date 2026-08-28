#!/usr/bin/env bash
# CSSOS_WAVE_2010 — 鲁米人物合规校验。
# 本片规则与前两部【不同】: 允许正面与特写(这是压测点), 但
#   · 人数锁死 ≤1
#   · 考据锁死: 素色高筒毡帽(不是皮毛帽) / 短发收进帽内(不是披发)
#   · 禁现代物
# 所以判据也换一套 —— 不是"数人 + 占宽", 是"人数 + 帽型 + 头发 + 现代物"。
set -uo pipefail
cat > /tmp/rumi_prompt.txt <<'PROMPT'
Look at this frame from a film set in 13th-century Persia/Anatolia. Answer with one JSON object, nothing else.

1. Count every human being visible.
2. If a person wears a tall hat, say whether it is PLAIN FELT (smooth, matte, cylindrical/conical) or FUR (shaggy, animal pelt). Use "none" if no hat.
3. Say whether any person has LONG LOOSE HAIR falling outside the hat onto the shoulders.
4. Count objects that could not exist in 1250 AD (wires, concrete, cars, plastic, electric light, modern clothing).

Reply exactly:
{"humans": <int>, "hat": "felt|fur|none", "long_hair": <true|false>, "modern": <int>}
PROMPT
python3 - <<'PY' > /tmp/rmurls.txt
import json
p=json.load(open("/srv/cssos/tmp/rumi-shoot-progress.json"))
s=json.load(open("/tmp/rumi-shotlist.json"))
for pk in ("p1","p2","p3"):
    for _a,num,_x,_y,_d,_desc in s[pk]:
        r=p.get(f"{pk}:{num}")
        if r and r.get("ok"): print(f"{pk}#{num}|{r['url']}")
PY
mapfile -t ROWS < /tmp/rmurls.txt
echo "待校验 ${#ROWS[@]} 镜"
: > /tmp/rmresults.txt
for row in "${ROWS[@]}"; do
  lbl="${row%%|*}"; url="${row#*|}"
  res=$(NP_PROMPT_FILE=/tmp/rumi_prompt.txt bash /tmp/np.sh video "$url" "$lbl" </dev/null 2>/dev/null | grep -oE '\{[^}]*\}' | head -3)
  v=$(python3 -c "
import json,re
h=0; hat='none'; lh=False; md=0
for m in re.findall(r'\{[^}]*\}', '''$res'''):
    try:
        d=json.loads(m); h=max(h,int(d.get('humans',0)))
        if d.get('hat')=='fur': hat='fur'
        elif hat!='fur' and d.get('hat')=='felt': hat='felt'
        lh = lh or bool(d.get('long_hair')); md=max(md,int(d.get('modern',0)))
    except Exception: pass
print(f'{h}|{hat}|{int(lh)}|{md}')")
  h=$(echo "$v"|cut -d'|' -f1); hat=$(echo "$v"|cut -d'|' -f2); lh=$(echo "$v"|cut -d'|' -f3); md=$(echo "$v"|cut -d'|' -f4)
  echo "$lbl|$h|$hat|$lh|$md|$url" >> /tmp/rmresults.txt
  bad=$(python3 -c "print(1 if ($h>1 or '$hat'=='fur' or $lh==1 or $md>0) else 0)")
  [ "$bad" = "1" ] && echo "❌ $lbl 人=$h 帽=$hat 披发=$lh 现代物=$md" || echo "✅ $lbl"
done
python3 - <<'PY'
rows=[l.strip().split("|") for l in open("/tmp/rmresults.txt") if l.strip()]
total=sum(1 for _ in open("/tmp/rmurls.txt"))
bad=[r[0] for r in rows if int(r[1])>1 or r[2]=="fur" or r[3]=="1" or int(r[4])>0]
print("--- 汇总 ---")
print(f"清单 {total} 镜, 实际校验 {len(rows)} 镜" + ("  ⚠️ 有漏!" if len(rows)!=total else "  ✅ 无遗漏"))
print(f"违规 {len(bad)} 镜: {bad}")
PY
