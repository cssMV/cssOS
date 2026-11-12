#!/bin/bash
# 写一份字幕 JSON 到它原来的 key: 旧字节先落自己的不可变地址, 再写原 key, 最后回读核对。
# R2 没开版本管理 —— 同 key 写入就是永久删除(W2086 的 17 首就是这么丢的)。
set -u
KEY="${1:?r2 key, 例如 works/<id>/subtitle-take1.json}"
D="${D:?输出目录}"
set -a; . /etc/cssos.env; set +a
CUR=$(readlink -f /srv/cssos/current)
UA='Mozilla/5.0 (Macintosh) cssos-audit'
B=$D/sub.before.json; A=$D/sub.after.json
[ -s "$B" ] && [ -s "$A" ] || { echo "FAIL 没有 before/after —— 停手"; exit 2; }

osha=$(sha1sum "$B" | cut -c1-24)
nsha=$(sha1sum "$A" | cut -c1-24)
[ "$osha" != "$nsha" ] || { echo "FAIL 新旧一样 —— 没必要写"; exit 2; }
okey="artifacts/subtitle-archive/sub-$osha.json"
echo "旧字节 sha24=$osha  新字节 sha24=$nsha"

# ① 旧字节的永久地址
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$okey")
if [ "$code" = 200 ]; then
  echo "① 旧快照已存在(幂等) → $okey"
else
  echo "① 存旧字节: $( cd "$CUR" && node r2putkey.mjs "$B" "$okey" application/json 2>&1 | tail -1 )"
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 25 -A "$UA" "https://cdn.cssstudio.app/$okey")
fi
echo "   取回 HTTP $code"
[ "$code" = 200 ] || { echo "FAIL 旧字节没存住 —— 【绝不】继续写原 key"; exit 3; }
curl -s -m 30 -A "$UA" "https://cdn.cssstudio.app/$okey" -o "$D/verify.old.json"
cmp -s "$B" "$D/verify.old.json" \
  && echo "   旧字节字节级一致 ✅ 旧版从此有自己的地址" \
  || { echo "FAIL 旧快照内容不一致 —— 停手"; exit 3; }

# ② 写原 key
echo "② 写原 key: $( cd "$CUR" && node r2putkey.mjs "$A" "$KEY" application/json 2>&1 | tail -1 )"
sleep 3
curl -s -m 30 -A "$UA" "https://cdn.cssstudio.app/$KEY" -o "$D/verify.new.json"
cmp -s "$A" "$D/verify.new.json" && echo "③ 原 key = 新内容 ✅" || { echo "③ ‼ 原 key 不是新内容"; exit 3; }
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$okey")
echo "   旧快照仍可取: HTTP $code → https://cdn.cssstudio.app/$okey"
python3 -I -c "
import json
d=json.load(open('$D/verify.new.json',encoding='utf-8'))
print('   新内容条目:', [(L.get('lang'), sum(len(s.get('lines') or []) for s in (L.get('sections') or []))) for L in (d.get('languages') or [])])
"
