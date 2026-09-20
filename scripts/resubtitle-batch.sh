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
#
# CSSOS_WAVE_2125 20260920 — 再加两条【库级】核对(接口说成功不等于字幕真写进去了):
#
# ④ **跑前先查库: 已经有字幕的直接跳过, 一个都不碰。**
#    铁律是「已经完整的东西只准新起版本, 绝不覆盖」。这个端点本身【没有】这道闸,
#    它拿到 id 就重做。所以闸门必须装在调用方 —— 清单哪怕只错一个 id,
#    也可能把一首好字幕覆盖掉, 而那正是 W2061 丢掉 17 首音乐的同一种死法。
#
# ⑤ **跑完回库确认 subtitle_take1_json_url 真的有了。**
#    ①说的"内层 results[].ok"只是接口的自述; 真正的判据是那一列非空。
#    两者不一致时以库为准, 并在汇总里单列出来。
# CSSOS_WAVE_2128 20260920 — 加【重做模式】, 因为闸门④本身挡不住一种真实需求:
#
# ⑥ 有时【必须】覆盖一首已有的字幕 —— 比如 W2128 那 129 首, 字幕里烤着 LLM 的
#    JSON 信封, 逐字把 `"lyrics":` 唱上屏, 断行也全错, 手术修不好只能重做。
#    但"需要重做"绝不等于"可以直接覆盖":字幕的 R2 key 是写死的固定名
#    works/<id>/subtitle-take1.json, 重做就是原地覆盖, 而 R2 是 Unversioned。
#
#    所以 --redo 不是把闸门④拆掉, 是把它换成一道更严的:
#    **旧字节必须先有自己的地址(w2128_subtitle_backup 里有登记), 否则照样拒绝。**
#    光有"我要重做"的意图不够 —— W2061 丢掉 17 首音乐时, 意图也是好的。
set -u
LIST="${1:?用法: $0 <list.tsv> [--redo]}"
REDO="${2:-}"
LOG="${LOG:-/tmp/resub_run.log}"
TOKEN=$(grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')
PGPASSWORD="${PGPASSWORD:-}"
# 库级查询: 这首有没有字幕。查不动库就返回 "?" —— 宁可不知道, 也不要假装知道。
has_sub() {
  [ -n "$PGPASSWORD" ] || { echo "?"; return; }
  psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c \
    "SELECT CASE WHEN COALESCE(subtitle_take1_json_url,'')='' THEN 'no' ELSE 'yes' END
       FROM user_works WHERE id='$1'::uuid" 2>/dev/null || echo "?"
}
# 旧字节保住了没有? 查不动库一律返回 "no" —— 拿不准时必须偏向【不覆盖】。
preserved() {
  [ -n "$PGPASSWORD" ] || { echo "no"; return; }
  psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c \
    "SELECT CASE WHEN EXISTS (SELECT 1 FROM w2128_subtitle_backup
       WHERE work_id='$1'::uuid AND old_bytes > 0) THEN 'yes' ELSE 'no' END" 2>/dev/null || echo "no"
}
: > "$LOG"
ok=0; fail=0; n=0; skipped=0; mismatch=0; redone=0; refused=0
total=$(grep -c . "$LIST")
[ "$REDO" = "--redo" ] && echo "⚠ 重做模式: 只覆盖【旧字节已另存】的作品" | tee -a "$LOG"
while IFS=$'\t' read -r id title; do
  [ -z "${id:-}" ] && continue
  n=$((n+1))
  # ④ 跑前闸门: 已有字幕 → 跳过, 绝不覆盖
  pre=$(has_sub "$id")
  if [ "$pre" = "yes" ]; then
    if [ "$REDO" != "--redo" ]; then
      echo "[$n/$total] SKIP 已有字幕, 不覆盖  $title" | tee -a "$LOG"; skipped=$((skipped+1)); continue
    fi
    # ⑥ 重做模式仍要过"旧字节保住了吗"这一关
    if [ "$(preserved "$id")" != "yes" ]; then
      echo "[$n/$total] 拒绝重做(旧字节未另存)  $title" | tee -a "$LOG"; refused=$((refused+1)); continue
    fi
    redone=$((redone+1))
  fi
  for attempt in 1 2 3; do
    body=$(curl -s -m 900 -X POST -H "x-admin-token: $TOKEN" \
      "http://127.0.0.1:3000/api/admin/resubtitle/$id" 2>&1)
    # ← ① 内层判据: results 里至少有一条 "ok":true 才算真成功
    if printf '%s' "$body" | grep -q '"results"' \
       && printf '%s' "$body" | sed 's/.*"results"//' | grep -q '"ok":true'; then
      # ⑤ 接口说成功还不算 —— 回库看那一列是不是真的有了
      post=$(has_sub "$id")
      if [ "$post" = "no" ]; then
        echo "[$n/$total] ⚠ 接口报成功但库里仍无字幕  $title" | tee -a "$LOG"
        mismatch=$((mismatch+1)); fail=$((fail+1)); break
      fi
      echo "[$n/$total] OK   $title" | tee -a "$LOG"; ok=$((ok+1)); break
    fi
    reason=$(printf '%s' "$body" | grep -oE '"reason":"[^"]*"' | head -1)
    # CSSOS_WAVE_2125 — align_failed 是【确定性】失败(歌词与音频对不上), 不是限流也不是抖动。
    # 重试 3 次 = 白等 90 秒再得到同一个答案。只对真·瞬时错误退避重试。
    case "$reason" in
      *align_failed*|*no_audio*|*no_lyrics*)
        echo "[$n/$total] FAIL $title :: $reason (确定性失败, 不重试)" | tee -a "$LOG"
        fail=$((fail+1)); break;;
    esac
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
echo "=== 完成: 成功 $ok / 失败 $fail / 跳过(已有字幕) $skipped / 拒绝重做 $refused / 清单 $total ===" | tee -a "$LOG"
[ "$redone"   -gt 0 ] && echo "   其中重做(覆盖旧字幕, 旧字节已另存) $redone 首" | tee -a "$LOG"
[ "$mismatch" -gt 0 ] && echo "⚠️ 其中 $mismatch 首【接口报成功但库里没有】—— 以库为准" | tee -a "$LOG"
[ $((ok+fail+skipped+refused)) -eq "$total" ] || echo "⚠️ 处理数 $((ok+fail+skipped+refused)) ≠ 清单 $total, 有漏" | tee -a "$LOG"
