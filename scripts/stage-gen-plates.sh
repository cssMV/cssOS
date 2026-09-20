#!/usr/bin/env bash
# W2122 — 批量出演播厅背幕图。【串行】, 一间一间来 —— 并发把厂商队列压垮那次(111 镜挂 48 镜)
# 换来的规矩, 这里不破例。每张 3 credits, 失败就停在那一张, 不假装跑完。
set -uo pipefail
T=$(sudo grep -oE "^CSSOS_ADMIN_TOKEN=.*" /etc/cssos.env | cut -d= -f2-)
K=$(sudo grep -oE "^KIE_API_KEY=.*" /etc/cssos.env | cut -d= -f2-)
IN=/tmp/plates.json
N=$(python3 -c "import json;print(len(json.load(open('$IN'))))")
echo "清单 $N 间厅"
bal0=$(curl -s -H "Authorization: Bearer $K" https://api.kie.ai/api/v1/chat/credit | python3 -c "import sys,json;print(json.load(sys.stdin)['data'])")
echo "开跑前余额 $bal0"
ok=0; bad=0
for i in $(seq 0 $((N-1))); do
  sid=$(python3 -c "import json;print(json.load(open('$IN'))[$i]['stage_id'])")
  zh=$(python3 -c "import json;print(json.load(open('$IN'))[$i]['zh'])")
  python3 -c "
import json
d=json.load(open('$IN'))[$i]
json.dump({'stage_id':d['stage_id'],'prompt':d['prompt']}, open('/tmp/one.json','w'), ensure_ascii=False)
"
  printf "[%2d/%d] %-18s %s ... " "$((i+1))" "$N" "$sid" "$zh"
  r=$(curl -s -X POST "http://127.0.0.1:3000/api/admin/stage-plate" \
        -H "x-admin-token: $T" -H "Content-Type: application/json" \
        --data @/tmp/one.json --max-time 240)
  u=$(echo "$r" | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('url') or ('FAIL '+str(d.get('code'))+' '+str(d.get('detail',''))[:60]))
except Exception as e: print('FAIL bad-json')")
  if [[ "$u" == https://* ]]; then
    echo "✅ $u"; echo "$sid|$u" >> /tmp/plates-out.txt; ok=$((ok+1))
  else
    echo "❌ $u"; bad=$((bad+1))
  fi
  sleep 2
done
bal1=$(curl -s -H "Authorization: Bearer $K" https://api.kie.ai/api/v1/chat/credit | python3 -c "import sys,json;print(json.load(sys.stdin)['data'])")
echo
echo "清单 $N 间, 实际跑了 $((ok+bad)) 间 —— 成功 $ok, 失败 $bad"
echo "余额 $bal0 -> $bal1  (花了 $(python3 -c "print(round($bal0-$bal1,2))") credits)"
