#!/bin/bash
# W2281 —— B 类 8 首重做字幕之前, 先把【旧字节】另存到自己的地址。
#
# Jing 2026-11-08:「B 类那 8 首重做字幕。」
#
# 为什么必须先另存: 字幕的 R2 key 是写死的固定名 works/<id>/subtitle-take1.json,
# 而 R2 是 Unversioned —— 重做就是【原地覆盖】, 旧字节当场消失。
# 这正是 W2061/W2086 丢掉 19 首歌的同一个机制。resubtitle-batch.sh --redo 的闸门
# 判的就是 w2128_subtitle_backup 里有没有这一行(old_bytes > 0), 所以这一步不是形式。
#
# 顺带把 lyrics_preview 也另存 —— 因为 /api/admin/resubtitle?asr=1 会【覆盖这一列】
# (W735B: 用实际唱出来的词重做字幕 + 覆盖 lyrics_preview)。这 8 首的 lyrics_preview
# 本来就是坏的(制作说明被当成歌词 / 文字被打乱), 覆盖它大概是好事,
# 但「大概是好事」不等于「可以不备份」。
#
# 用法: bash w2281-preserve-then-resubtitle.sh <ids.txt>   # 每行一个 work_id
set -u
set -a; . /etc/cssos.env 2>/dev/null || true; set +a
LIST="${1:?用法: $0 <ids.txt>}"
[ -n "${CSSOS_ADMIN_TOKEN:-}" ] || { echo "FAIL: 没有 CSSOS_ADMIN_TOKEN"; exit 1; }
mkdir -p /tmp/w2281-pre
n=0; done_=0; skip=0; fail=0
total=$(grep -c . "$LIST")
psql "$DATABASE_URL" -X -q -c "
  create table if not exists w2281_lyrics_backup (
    work_id uuid, old_lyrics text, old_bytes bigint, preserved_at timestamptz default now());" >/dev/null \
  || { echo "FAIL: 建备份表失败"; exit 1; }

while read -r wid; do
  [ -z "$wid" ] && continue
  n=$((n+1))
  echo "=== [$n/$total] ${wid:0:8}"
  # 已经登记过就跳过 —— 重复登记会把第一次的真备份挤成第二次的(那时字节已经是新的了)
  has=$(psql "$DATABASE_URL" -X -q -t -A -c \
    "select count(*) from w2128_subtitle_backup where work_id='$wid'::uuid and old_bytes>0")
  if [ "${has:-0}" -gt 0 ]; then
    echo "  已登记过备份(old_bytes>0) —— 跳过, 不覆盖第一次的登记"; skip=$((skip+1)); continue
  fi
  # ① 取旧字幕字节
  f="/tmp/w2281-pre/$wid--subtitle-take1-pre.json"
  code=$(curl -s -o "$f" -w "%{http_code}" -A "Mozilla/5.0 (Macintosh) cssos-audit" \
    "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")
  if [ "$code" != "200" ] || [ ! -s "$f" ]; then
    echo "  FAIL: 取旧字幕 http=$code —— 【取不到】和【没有】不是一回事, 不动手"; fail=$((fail+1)); continue
  fi
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" \
    || { echo "  FAIL: 旧字幕不是合法 JSON, 不动手"; fail=$((fail+1)); continue; }
  bytes=$(stat -c %s "$f")
  # ② 推到【独立前缀】—— 不能用 subtitle-take1--aXXX-pre.json 这种兄弟命名,
  #    它会命中 */subtitle-take1--a*.json, 以后扫描把备份当正片(W2149 的教训)。
  ( cd /srv/cssos/current && node r2putkey.mjs "$f" \
      "backups/w2281/$wid/subtitle-take1.json" "application/json" >/dev/null ) \
    || { echo "  FAIL: 推 R2 失败, 不动手"; fail=$((fail+1)); continue; }
  # ③ 登记。old_url 记【备份自己的地址】, 不是原地址 —— 原地址马上就会被覆盖, 记它没用。
  psql "$DATABASE_URL" -X -q -c "
    insert into w2128_subtitle_backup (work_id, old_url, old_bytes, preserved_at)
    values ('$wid'::uuid, 'r2://backups/w2281/$wid/subtitle-take1.json', $bytes, now());
    insert into w2281_lyrics_backup (work_id, old_lyrics, old_bytes)
    select id, coalesce(lyrics_preview,''), length(coalesce(lyrics_preview,''))
      from user_works where id='$wid'::uuid;" >/dev/null \
    || { echo "  FAIL: 登记失败, 不动手"; fail=$((fail+1)); continue; }
  # ④ 回读确认 —— 登记了不等于推上去了
  back=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://cdn.cssstudio.app/backups/w2281/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")
  echo "  旧字幕 ${bytes}B → r2://backups/w2281/$wid/  回读 http=$back  已登记"
  [ "$back" = "200" ] || echo "  ⚠ 回读不是 200 —— 备份地址取不到, 别用 --redo 跑这一首"
  done_=$((done_+1))
done < <(cat "$LIST"; echo)
echo "=== 备份汇总: 清单 $total · 已另存 $done_ · 跳过(已有登记) $skip · 失败 $fail ==="
[ $((done_+skip+fail)) -eq "$total" ] || echo "⚠ 三类加起来 $((done_+skip+fail)) ≠ 清单 $total, 有漏"
