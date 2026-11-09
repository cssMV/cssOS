#!/bin/bash
# W2281 —— B 类作品重做字幕。判据【照抄】scripts/resubtitle-batch.sh, 不另立一套;
# 唯一的区别是库查询走 $DATABASE_URL —— 那份脚本用的
# `psql -h 127.0.0.1 -U cssstudio` 在 api-vm 上密码认证失败(库是 Cloud SQL)。
# 改一处判据必须两份一起改。
#
# 照抄过来的五条(每一条都是踩过才写进去的, 见那份脚本的头注):
#  ① 成功判据看【内层 results[].ok】, 不看外层 ok —— 外层只表示「请求处理完了」。
#  ② 顺序跑, 不并发。
#  ③ 失败打服务器返回的原始 body, 不自己编原因。
#  ④ 跑前查库: 已有字幕的要先确认旧字节另存过(w2128_subtitle_backup.old_bytes>0), 否则拒绝。
#  ⑤ 跑完【回库】确认 subtitle_take1_json_url 真的有了 —— 接口自述不算。
#  外加: align_failed / no_audio / no_lyrics 是确定性失败, 不重试(白等 90 秒拿同一个答案)。
#
# W2281 实测: 普通模式(不带 ?asr)就能修好 —— Moses 1a2188fc 的字幕从 4 行变 68 行,
# 歌词正文命中 78%。所以【不用 ?asr】, 也就不会覆盖 lyrics_preview。
#
# 用法: bash w2281-resubtitle.sh <ids.txt>
set -u
set -a; . /etc/cssos.env 2>/dev/null || true; set +a
LIST="${1:?用法: $0 <ids.txt>}"
[ -n "${CSSOS_ADMIN_TOKEN:-}" ] || { echo "FAIL: 没有 CSSOS_ADMIN_TOKEN"; exit 1; }
LOG=/tmp/w2281-resub.log; : > "$LOG"
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1" 2>/dev/null; }
total=$(grep -c . "$LIST"); n=0; ok=0; fail=0; refused=0
while read -r wid; do
  [ -z "$wid" ] && continue
  n=$((n+1))
  pre=$(q "select case when coalesce(subtitle_take1_json_url,'')='' then 'no' else 'yes' end from user_works where id='$wid'::uuid")
  [ -n "$pre" ] || { echo "[$n/$total] ${wid:0:8} 查不动库 —— 拿不准时偏向不覆盖, 拒绝" | tee -a "$LOG"; refused=$((refused+1)); continue; }
  if [ "$pre" = "yes" ]; then
    kept=$(q "select count(*) from w2128_subtitle_backup where work_id='$wid'::uuid and old_bytes>0")
    if [ "${kept:-0}" -lt 1 ]; then
      echo "[$n/$total] ${wid:0:8} 拒绝重做: 旧字节没另存过" | tee -a "$LOG"; refused=$((refused+1)); continue
    fi
  fi
  before=$(q "select coalesce(length(subtitle_take1_json_url),0) from user_works where id='$wid'::uuid")
  echo "[$n/$total] ${wid:0:8} 开始 $(date -u +%T)" | tee -a "$LOG"
  body=$(curl -s -m 1200 -X POST -H "x-admin-token: $CSSOS_ADMIN_TOKEN" \
    "http://127.0.0.1:3000/api/admin/resubtitle/$wid" 2>&1)
  if printf '%s' "$body" | grep -q '"results"' \
     && printf '%s' "$body" | sed 's/.*"results"//' | grep -q '"ok":true'; then
    post=$(q "select case when coalesce(subtitle_take1_json_url,'')='' then 'no' else 'yes' end from user_works where id='$wid'::uuid")
    if [ "$post" = "no" ]; then
      echo "[$n/$total] ${wid:0:8} ⚠ 接口报成功但库里仍无字幕 —— 以库为准, 算失败" | tee -a "$LOG"
      fail=$((fail+1)); continue
    fi
    w=$(printf '%s' "$body" | grep -oE '"words":[0-9]+' | head -1)
    echo "[$n/$total] ${wid:0:8} OK $(date -u +%T)  ${w:-words=?}" | tee -a "$LOG"; ok=$((ok+1))
  else
    reason=$(printf '%s' "$body" | grep -oE '"reason":"[^"]*"' | head -1)
    echo "[$n/$total] ${wid:0:8} FAIL :: ${reason:-$(printf '%s' "$body" | head -c 300)}" | tee -a "$LOG"
    fail=$((fail+1))
  fi
done < <(cat "$LIST"; echo)
echo "=== 汇总: 清单 $total · 成功 $ok · 失败 $fail · 拒绝 $refused ===" | tee -a "$LOG"
[ $((ok+fail+refused)) -eq "$total" ] || echo "⚠ 三类加起来 $((ok+fail+refused)) ≠ 清单 $total, 有漏" | tee -a "$LOG"
