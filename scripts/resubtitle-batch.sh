#!/bin/bash
# 字幕回填批处理 —— 在 api-vm 上跑。用法: resubtitle-batch.sh <list.tsv>
#   list.tsv 每行: <work_id>\t<title>
#
# CSSOS_WAVE_2052 20260831 — 三条经验内建, 都是踩过才写进来的:
#
# ① **成功判据必须看内层, 不能看信封。** /api/admin/resubtitle 的响应是:
#      {"ok":true,"results":[{"lang":"orig","ok":false,"reason":"align_failed"}]}
#    **外层 ok:true 只表示"请求处理完了", 内层 results[].ok 才是"字幕真做出来了"。**
#    第一版脚本 grep '"ok":true' → 31 首全报成功, 实际只有 19 首写出 take1,
#    12 首是 align_failed 的假阳性。**判据错了, 跑得再顺也是假的。**
#
# ② 顺序跑, 不并发 —— 一次性把限流打满, 会把真错误淹没在 429 里。
#
# ③ 失败时打印服务器返回的**原始 body**, 不要自己编原因。
#    (之前有一次因为没打印真错误, 差点把限流误判成内容审核, 险些重写整份剧本。)
set -u
LIST="${1:?用法: $0 <list.tsv>}"
LOG="${LOG:-/tmp/resub_run.log}"
TOKEN=$(grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')
: > "$LOG"
ok=0; fail=0; n=0
total=$(grep -c . "$LIST")
while IFS=$'\t' read -r id title; do
  [ -z "${id:-}" ] && continue
  n=$((n+1))
  for attempt in 1 2 3; do
    body=$(curl -s -m 900 -X POST -H "x-admin-token: $TOKEN" \
      "http://127.0.0.1:3000/api/admin/resubtitle/$id" 2>&1)
    # ← ① 内层判据: results 里至少有一条 "ok":true 才算真成功
    if printf '%s' "$body" | grep -q '"results"' \
       && printf '%s' "$body" | sed 's/.*"results"//' | grep -q '"ok":true'; then
      echo "[$n/$total] OK   $title" | tee -a "$LOG"; ok=$((ok+1)); break
    fi
    reason=$(printf '%s' "$body" | grep -oE '"reason":"[^"]*"' | head -1)
    if [ "$attempt" -lt 3 ]; then
      w=$((30 * (1 << (attempt-1))))
      echo "[$n/$total] retry$attempt in ${w}s  $title :: ${reason:-$(printf '%s' "$body" | head -c 200)}" | tee -a "$LOG"
      sleep "$w"
    else
      # ← ③ 打原始 body, 不编原因
      echo "[$n/$total] FAIL $title :: $(printf '%s' "$body" | head -c 400)" | tee -a "$LOG"
      fail=$((fail+1))
    fi
  done
done < "$LIST"
# ← 汇总必须自曝: 清单 N / 实际 M, 对不上要看得见
echo "=== 完成: 成功 $ok / 失败 $fail / 清单 $total ===" | tee -a "$LOG"
[ $((ok+fail)) -eq "$total" ] || echo "⚠️ 处理数 $((ok+fail)) ≠ 清单 $total, 有漏" | tee -a "$LOG"
