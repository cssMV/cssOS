#!/usr/bin/env bash
# 跟着批次跑的【自动救回】—— 每 3 分钟扫一次批次日志, 把被 0s 误判还原掉的作品
# 用 w2290-recover-false-short.sh 免费救回(只改指针, 不重新生成, 不花钱)。
#
# 为什么要自动: 实测误判率约 1/5, 74 首里会有十几首。一首一首人工救, 既慢又会漏。
# 作用域严格限定在【日志里确实打过「成品只有 0s」那一句】的作品 —— 不是「所有占位作品」,
# 更不碰正在生成中的那一首(救回脚本自己还会再查一遍: 轨必须仍是占位音 + 版本行里有这一轮的 ♪1)。
# 幂等: 已经救回的再扫到也只会报「这条轨现在不是占位音」。
set -u
LOG="${1:-/tmp/w2290-batch.log}"
OUT="${2:-/tmp/w2290-autorecover.log}"
HERE="$(cd "$(dirname "$0")" && pwd)"
set -a; . /etc/cssos.env; set +a
echo "===== 自动救回开跑 $(date -u +%FT%TZ)  盯 $LOG =====" >>"$OUT"
for i in $(seq 1 480); do           # 3 分钟 × 480 ≈ 24 小时
  # 只认【那一句误判】前面最近的那个 === [n] <uuid> 行
  ids=$(awk '/^=== \[/{gsub(/^=== \[[0-9]+\] /,"");split($0,a," ");w=a[1]}
             /FAIL 验收不过: 成品只有 0s/{print w}' "$LOG" 2>/dev/null | sort -u)
  for wid in $ids; do
    case "$wid" in
      [0-9a-f]*-*-*-*-*) ;;
      *) echo "$(date -u +%T) 跳过形状不像 uuid 的: $wid" >>"$OUT"; continue;;
    esac
    r=$(bash "$HERE/w2290-recover-false-short.sh" --apply "$wid" 2>&1)
    case "$r" in
      *"OK 救回"*) printf '%s %s\n%s\n' "$(date -u +%T)" "救回一首" "$r" >>"$OUT";;
      *) : ;;   # 「不是占位音」= 已经救过, 不必反复记
    esac
  done
  grep -q "批次结束" "$LOG" 2>/dev/null && {
    echo "$(date -u +%T) 批次已结束, 再扫一遍后收工" >>"$OUT"
    for wid in $ids; do bash "$HERE/w2290-recover-false-short.sh" --apply "$wid" >>"$OUT" 2>&1; done
    break; }
  sleep 180
done
echo "===== 自动救回收工 $(date -u +%FT%TZ) =====" >>"$OUT"
