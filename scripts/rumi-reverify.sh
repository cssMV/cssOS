#!/usr/bin/env bash
# 鲁米重拍复验 —— 只查重拍的 127 镜, 判据与首轮一致(逐镜: 该有人/该无人)。
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
mapfile -t ROWS < <(python3 -c "
import json
d=json.load(open('/srv/cssos/tmp/rumi-reshoot.json'))
for k,v in d.items(): print(k+'|'+v)")
echo "复验 ${#ROWS[@]} 镜"
: > /tmp/rmrev.txt
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
  echo "$lbl|$v|$url" >> /tmp/rmrev.txt
done
python3 - <<'PY'
import json,re
HAS=re.compile(r"人影|行者|笠影|一双手|手指|只拍手|只拍脚|赤脚|背影|剪影|他|舞|旋转|坐着|站立|弯腰")
shots=json.load(open("/tmp/rumi-shotlist.json"))
desc={f"{pk}#{r[1]}":r[5] for pk in ("p1","p2","p3") for r in shots[pk]}
rows=[l.strip().split("|") for l in open("/tmp/rmrev.txt") if l.strip()]
tot=len(json.load(open("/srv/cssos/tmp/rumi-reshoot.json")))
bad=[]
for r in rows:
    lbl,h,hat,lh,md=r[0],int(r[1]),r[2],r[3]=="1",int(r[4])
    want=bool(HAS.search(desc.get(lbl,"")))
    why=[]
    if md>0: why.append(f"现代物{md}")
    if want:
        if h>1: why.append(f"人数{h}")
        if hat=="fur": why.append("皮毛帽")
        if lh: why.append("披发")
    else:
        if h>0: why.append(f"该无人却有{h}人")
    if why: bad.append((lbl,",".join(why)))
print("--- 复验汇总 ---")
print(f"重拍 {tot} 镜, 实际复验 {len(rows)} 镜" + ("  ⚠️ 有漏!" if len(rows)!=tot else "  ✅ 无遗漏"))
print(f"仍违规 {len(bad)} 镜")
for l,w in bad[:30]: print("   ",l,w)
PY
