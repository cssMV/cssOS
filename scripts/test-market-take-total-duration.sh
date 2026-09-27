#!/usr/bin/env bash
# W2232 回归 — 市场卡片时长 = 所有 take 时长总和。
#
# Jing 2026-09-27:「标注市场的时候/地方, 应该像三部曲那样, 标注所有 take 的时长总和,
#                   而不只是第一个 take 的时长而已。」
#
# 根因不在显示层: user_works.duration_secs 这一列从 W367 起【只写 ♪1】
# (upsert 音轨处 `UPDATE user_works SET duration_secs = $1`, $1 就是 take1)。
# 三部曲 root 之所以一直是对的, 是因为它那一列是建库时按各部求和写进去的。
#
# 两条最要紧的主张:
#   ① 判据必须复用 takeDedupeKey / 「别的声线不算本轨版本」那套 —— 不许在 SQL 里另抄一份。
#   ② 只准变大不准变小 —— 算出来比原来小, 在定义上就是我们漏算了(实测确有库里自相矛盾的作品:
#      同一个音频文件在两条轨上被记成 194s 和 353s)。
#
# 校准: CALIBRATE=1 读 git HEAD, ①②应当失败。
# 线上核对: LIVE=1 会真的打 /api/works/market 比对。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1" 2>/dev/null || echo ""; else cat "$1" 2>/dev/null || echo ""; fi; }
IDX=$(src src/index.ts)

grep -q 'async function loadTakeTotalDurations' <<<"$IDX" && A=1 || A=0
ok "有批量取 take 总时长的接口" "$A"
grep -q 'work_id = ANY(\$1::uuid\[\])' <<<"$IDX" && A=1 || A=0
ok "是【批量】一次查完, 不是 N+1" "$A" "市场一页最多 1000 个作品, 逐个查会把接口拖垮"
grep -q 'takeDedupeKey' <<<"$IDX" && A=1 || A=0
ok "复用 takeDedupeKey 去重" "$A" "去重是按 URL 的; 在 SQL 里照抄一遍 = 造第二份真源, 迟早分叉"
grep -q 'ownedByAnyTrack' <<<"$IDX" && A=1 || A=0
ok "剔掉别的声线自己的音频" "$A" "「多声线不许伪装成多版本」—— 否则童声那条轨会被算进来"
grep -q 'const workDefault = ts.find((t) => t.is_default)' <<<"$IDX" && A=1 || A=0
ok "只算默认轨(不是把所有语言加一遍)" "$A" "按 W2107, 用户点下去听到的是【这一条轨的 ♪1→♪2→…】"
grep -q 'if (pick > prev) n.duration_secs = pick' <<<"$IDX" && A=1 || A=0
ok "只准变大不准变小" "$A" "算出来比原来小 = 我们漏算了; 让屏幕上的时长缩短比没修还糟"
grep -q 'applyTakeTotalDurationToTree(tree)' <<<"$IDX" && A=1 || A=0
ok "市场端确实调用了" "$A"
grep -q 'kids.length && kidSum > 0 ? kidSum : own' <<<"$IDX" && A=1 || A=0
ok "多部作品 root 按各部重新求和" "$A" "各部涨了 root 不跟着涨就自相矛盾"

if [ "${LIVE:-}" = "1" ]; then
  echo
  echo "线上核对 /api/works/market"
  J=$(curl -s "https://cssstudio.app/api/works/market?limit=60")
  N=$(python3 - "$J" <<'PY'
import sys,json
try: ws=json.loads(sys.argv[1])["data"]["works"]
except Exception: print("0"); raise SystemExit
print(sum(1 for w in ws if int(w.get("duration_secs") or 0) > 0))
PY
)
  [ "${N:-0}" -gt 0 ] && A=1 || A=0
  ok "线上仍返回时长(没被改坏)" "$A" "拿到 $N 条有时长"
  # 白鹤报恩 6 个 take: 307+326+287+290+292+304 = 1806
  D=$(python3 - "$J" <<'PY'
import sys,json
ws=json.loads(sys.argv[1])["data"]["works"]
w=next((x for x in ws if x["id"]=="508e4d1a-30ce-434e-bc66-381ca4e1c9b6"), None)
print(int(w.get("duration_secs") or 0) if w else 0)
PY
)
  [ "${D:-0}" -ge 1800 ] && A=1 || A=0
  ok "白鹤报恩 = 6 个 take 之和(≥1800s)" "$A" "实得 ${D}s; 改动前是 307s(只有 ♪1)"
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] || exit 1
