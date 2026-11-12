#!/bin/bash
# W2302 第五件: 凯撒 / 奥古斯都的【作品级】字幕做成配得上 300 秒新歌的那一份。
#
# Jing:「作品级残留字幕, 请做成 5 分钟左右的歌。」
# 现状: 两份都是 30 秒 demo 时代的残渣 —— 凯撒 3 行 la, 奥古斯都整份就是 2 行 `Thank you.`
#       (whisper 在 30 秒 demo 上的幻听)。音乐已是 300 秒的京典十节。
#
# 顺序是算出来的, 不能颠倒:
#   ① 先清奥古斯都作品级的 `en` 幻听条目 —— upsertSubtitleJson 写作品级时
#      `filter(l => l.lang !== lang)` 只替换【同 lang】, 别的条目一律保留。
#      不先清, 跑完 resubtitle 作品级仍是 [en(幻听), la(52行)], 还得再清一遍两份。
#   ② 再跑 ♪1 【不带 snap】→ 同时写作品级 + ♪1 快照, 两份一次都干净。
#   ③ 奥古斯都再跑 ♪2(take>=2 自带 snapOnly)→ ♪2 快照以干净的作品级做底, en 也没了。
#
# 每一步都: 旧字节先落 R2 自己的地址 → 回读 cmp → 才动原 key。一条一条来。
set -u
APPLY="${1:-}"
set -a; . /etc/cssos.env; set +a
TOK="$CSSOS_ADMIN_TOKEN"
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'
D=/tmp/w2302-wl; mkdir -p "$D"

CAESAR=0b02ba6b-862b-4587-a0ab-8410f4c78056
AUG=4b837997-b212-4240-8b23-c4dad241c33e

show() {  # 打印某份字幕的条目与行数
  curl -s -m 60 -A "$UA" "$1" -o "$D/peek.json" || { echo "        (取不到)"; return; }
  python3 -I -c "
import json,sys
try: d=json.load(open('$D/peek.json',encoding='utf-8'))
except Exception as e: print('        (不是 JSON: %s)'%str(e)[:40]); sys.exit()
rows=[]
for L in (d.get('languages') or []):
    n=sum(len(s.get('lines') or []) for s in (L.get('sections') or []))
    ends=[t['t_end'] for s in (L.get('sections') or []) for ln in (s.get('lines') or [])
          if isinstance(ln,dict) for t in (ln.get('tokens') or []) if t.get('t_end') is not None]
    rows.append('%s: %d 行, 末 %.1fs' % (L.get('lang'), n, (max(ends)/1000 if ends else -1)))
print('        条目 → ' + ' | '.join(rows))
"
}

echo "=== 动作前 ==="
echo "  凯撒 作品级:"; show "https://cdn.cssstudio.app/works/$CAESAR/subtitle-take1.json"
echo "  奥古斯都 作品级:"; show "https://cdn.cssstudio.app/works/$AUG/subtitle-take1.json"
echo

if [ "$APPLY" != "--apply" ]; then
  echo "[干跑] 会做:"
  echo "  ① 奥古斯都作品级 → 移除 en 条目(安全闸: 该条目最多 2 行)"
  echo "  ② 凯撒 ♪1 resubtitle 不带 snap(写作品级)"
  echo "  ③ 奥古斯都 ♪1 resubtitle 不带 snap(写作品级)"
  echo "  ④ 奥古斯都 ♪2 resubtitle(自带 snapOnly, 让 ♪2 快照也不含 en)"
  echo "VERDICT: W2302-worklevel 干跑结束"
  exit 0
fi

bad=0

# ── ① 清奥古斯都作品级的 en 幻听 ───────────────────────────────────────────
echo "① 奥古斯都作品级: 移除 en 幻听条目"
if python3 -I /tmp/w2302-drop-lang.py \
     "https://cdn.cssstudio.app/works/$AUG/subtitle-take1.json" en "$D" 2; then
  D="$D" bash /tmp/w2302-put-sub.sh "works/$AUG/subtitle-take1.json" || { echo "   ‼ 写回失败"; bad=$((bad+1)); }
else
  echo "   ‼ 安全闸拦住了(这个 en 条目超过 2 行 = 可能是真版本)—— 不动它"
  bad=$((bad+1))
fi
echo

# ── ②③④ 跑 resubtitle ─────────────────────────────────────────────────────
run() {  # run <wid> <lang> <voice> <take> <名字> <snap?>
  local wid="$1" lang="$2" voice="$3" take="$4" name="$5" snap="${6:-}"
  local qs="lang=$lang&voice=$voice&take=$take"
  [ -n "$snap" ] && qs="$qs&snap=1"
  echo "  $name  ?$qs"
  local out
  out=$(curl -s -m 1800 -X POST -H "x-admin-token: $TOK" "$API/api/admin/resubtitle/$wid?$qs")
  if ! printf '%s' "$out" | grep -q '"ok":true'; then
    echo "        FAIL 接口没回 ok:true: $(printf '%s' "$out" | head -c 170)"; bad=$((bad+1)); return 1
  fi
  echo "        响应: 语言=$(printf '%s' "$out" | grep -o '"lang":"[^"]*"' | head -1 | cut -d'"' -f4)  $(printf '%s' "$out" | grep -o '"words":[0-9]*' | head -1)  $(printf '%s' "$out" | grep -o '"clamp":{[^}]*}' | head -1 | cut -c1-80)"
}

echo "② 凯撒 ♪1 → 写作品级"
run "$CAESAR" la auto 1 "凯撒 ♪1"
echo
echo "③ 奥古斯都 ♪1 → 写作品级"
run "$AUG" la auto 1 "奥古斯都 ♪1"
echo
echo "④ 奥古斯都 ♪2 → 只写快照(让它也不含 en)"
run "$AUG" la auto 2 "奥古斯都 ♪2"
echo

echo "=== 动作后 ==="
echo "  凯撒 作品级:"; show "https://cdn.cssstudio.app/works/$CAESAR/subtitle-take1.json"
echo "  奥古斯都 作品级:"; show "https://cdn.cssstudio.app/works/$AUG/subtitle-take1.json"
for w in "$CAESAR" "$AUG"; do
  for au in $(PGCONNECT_TIMEOUT=10 psql "$DATABASE_URL" -X -q -t -A -c "SELECT url FROM work_media_versions WHERE work_id='$w'::uuid AND kind='audio' AND url LIKE '%aud-%' ORDER BY created_at;"); do
    k=$(printf '%s' "$au" | sha1sum | cut -c1-10)
    echo "  ${w:0:8} 快照 --a$k:"; show "https://cdn.cssstudio.app/works/$w/subtitle-take1--a$k.json"
  done
done
echo
echo "VERDICT: W2302-worklevel 结束(有问题 $bad)"
