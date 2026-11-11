#!/bin/bash
# 写 lyrics.json: 先把旧字节落到它自己的不可变快照地址, 再写稳定 key, 最后核对。
# R2 没开版本管理 —— 同 key 写入就是永久删除。所以顺序不能颠倒(W2086 的 17 首就是这么丢的)。
set -u
WID="${1:?workId}"
D=/tmp/w2299
set -a; . /etc/cssos.env; set +a
CUR=$(readlink -f /srv/cssos/current)
UA='Mozilla/5.0 (Macintosh) cssos-audit'
B=$D/lyrics.before.json; A=$D/lyrics.after.json
[ -s "$B" ] && [ -s "$A" ] || { echo "FAIL 没有 before/after 文件 —— 停手"; exit 2; }

osha=$(sha1sum "$B" | cut -c1-16)
nsha=$(sha1sum "$A" | cut -c1-16)
okey="works/$WID/lyrics--$osha.json"
nkey="works/$WID/lyrics--$nsha.json"
echo "旧字节 sha16=$osha   新字节 sha16=$nsha"
[ "$osha" != "$nsha" ] || { echo "FAIL 新旧一样 —— 没必要写"; exit 2; }

# ① 旧字节的永久地址(平台自己的快照约定 works/<id>/lyrics--<sha16>.json)
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$okey")
if [ "$code" = 200 ]; then
  echo "① 旧快照已存在(幂等) → $okey"
else
  echo "① 存旧字节: $( cd "$CUR" && node r2putkey.mjs "$B" "$okey" "application/json" 2>&1 | tail -1 )"
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 25 -A "$UA" "https://cdn.cssstudio.app/$okey")
fi
echo "   取回 HTTP $code"
[ "$code" = 200 ] || { echo "FAIL 旧字节没存住 —— 【绝不】继续写稳定 key"; exit 3; }
curl -s -m 30 -A "$UA" "https://cdn.cssstudio.app/$okey" -o "$D/verify.old.json"
if cmp -s "$B" "$D/verify.old.json"; then echo "   旧字节字节级一致 ✅ 旧版从此有自己的地址"; else echo "FAIL 旧快照内容不一致 —— 停手"; exit 3; fi

# ② 新字节的快照 + 稳定 key
echo "② 存新快照: $( cd "$CUR" && node r2putkey.mjs "$A" "$nkey" "application/json" 2>&1 | tail -1 )"
echo "③ 写稳定 key: $( cd "$CUR" && node r2putkey.mjs "$A" "works/$WID/lyrics.json" "application/json" 2>&1 | tail -1 )"
sleep 3

# ④ 核对: 稳定 key 现在就是新内容, 且旧快照仍在
curl -s -m 30 -A "$UA" "https://cdn.cssstudio.app/works/$WID/lyrics.json" -o "$D/verify.new.json"
if cmp -s "$A" "$D/verify.new.json"; then echo "④ 稳定 key = 新内容 ✅"; else echo "④ ‼ 稳定 key 不是新内容"; fi
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$okey")
echo "   旧快照仍可取: HTTP $code  →  https://cdn.cssstudio.app/$okey"
echo
echo "新内容里的语言与行数:"
python3 -I -c "
import json,sys
d=json.load(open('$D/verify.new.json',encoding='utf-8'))
for x in d['languages']:
    n=sum(len(s.get('lines') or []) for s in (x.get('sections') or []))
    print(f\"   {x.get('lang')}: {len(x.get('sections') or [])} 节 / {n} 行  is_native={x.get('is_native')}  title={str(x.get('title'))[:30]}\")
"
