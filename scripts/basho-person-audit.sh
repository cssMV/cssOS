#!/usr/bin/env bash
# CSSOS_WAVE_2004 — 《奥の細道》人物合规校验。
# 芭蕉的规则不是"无人"(允许一个旅人背影), 而是【最多 1 人 · 必须背影 · 不超 1/8 宽 · 不见脸】。
# 「允许 ≤1」不等于「不必约束」—— 这正是 #36 拍出三个人的原因。
set -uo pipefail
cat > /tmp/person_prompt.txt <<'PROMPT'
Look at this frame. Answer with a single JSON object, nothing else.

1. Count every human being visible (tiny, far, blurred, back-facing, partly hidden — all count).
2. Say whether ANY human face is visible or recognisable (even partly, even small).
3. Estimate what fraction of the image WIDTH the largest person occupies, as a decimal (0.05 = one twentieth).

Reply exactly:
{"humans": <integer>, "face_visible": <true|false>, "widest": <decimal>}
PROMPT
python3 - <<'PY' > /tmp/bpurls.txt
import json
p=json.load(open("/srv/cssos/tmp/basho-shoot-progress.json"))
s=json.load(open("/tmp/basho-shotlist.json"))
for pk in ("p1","p2","p3"):
    for _a,num,_x,_y,_d,_desc in s[pk]:
        r=p.get(f"{pk}:{num}")
        if r and r.get("ok"): print(f"{pk}#{num}|{r['url']}")
PY
mapfile -t ROWS < /tmp/bpurls.txt
echo "待校验 ${#ROWS[@]} 镜"
: > /tmp/bpresults.txt
for row in "${ROWS[@]}"; do
  lbl="${row%%|*}"; url="${row#*|}"
  [ -z "$url" ] && continue
  res=$(NP_PROMPT_FILE=/tmp/person_prompt.txt bash /tmp/np.sh video "$url" "$lbl" </dev/null 2>/dev/null | grep -oE '\{[^}]*\}' | head -3)
  v=$(python3 -c "
import json,re
mx_h=0; face=False; mx_w=0.0
for m in re.findall(r'\{[^}]*\}', '''$res'''):
    try:
        d=json.loads(m)
        mx_h=max(mx_h,int(d.get('humans',0)))
        face = face or bool(d.get('face_visible'))
        mx_w=max(mx_w,float(d.get('widest',0) or 0))
    except Exception: pass
print(f'{mx_h}|{int(face)}|{mx_w:.2f}')")
  h=$(echo "$v"|cut -d'|' -f1); f=$(echo "$v"|cut -d'|' -f2); w=$(echo "$v"|cut -d'|' -f3)
  echo "$lbl|$h|$f|$w|$url" >> /tmp/bpresults.txt
  viol=$(python3 -c "print(1 if ($h>1 or $f==1 or $w>0.14) else 0)")
  if [ "$viol" = "1" ]; then echo "❌ $lbl 人=$h 露脸=$f 宽=$w"; else echo "✅ $lbl"; fi
done
python3 - <<'PY'
rows=[l.strip().split("|") for l in open("/tmp/bpresults.txt") if l.strip()]
total=sum(1 for _ in open("/tmp/bpurls.txt"))
bad=[r[0] for r in rows if int(r[1])>1 or r[2]=="1" or float(r[3])>0.14]
print("--- 汇总 ---")
print(f"清单 {total} 镜, 实际校验 {len(rows)} 镜" + ("  ⚠️ 有漏!" if len(rows)!=total else "  ✅ 无遗漏"))
print(f"人物违规 {len(bad)} 镜: {bad}")
PY
