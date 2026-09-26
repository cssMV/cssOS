#!/usr/bin/env bash
# W2219 回归 — Jing:「cssTV 仍然只把《白鹤报恩》当成一首单曲只播放 take 1 就跳到下一首歌,
# 应该播放完毕一首歌所有的 takes, 才能切换到下一首歌。」
#
# 两头都判:
#   ① 源码层: 推进顺序必须是 ♪ → 分部 → 队列 三层(W2107 播放顺序铁律), 且不许有人把它改回两层;
#   ② 契约层: 编译【TV 端真代码】(CSSBackend.swift + Models.swift)拿线上真响应跑解码 ——
#      不抄一份结构体, 抄一份就是造一份, 测的就不是上线的那段了。
#
# 校准: CALIBRATE=1 读 git HEAD 的源码, ①应当失败。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1"; else cat "$1"; fi; }

PV=$(src tvos/cssTV/PlayerView.swift)
CB=$(src tvos/cssTV/CSSBackend.swift)

# ① 三层推进, 顺序不能颠倒
grep -q 'if takeIndex + 1 < currentTakes.count' <<<"$PV" && A=1 || A=0
ok "onAudioEnded 第一层是 ♪N" "$A" "先走完 ♪ 才允许翻分部/翻页 —— W2107:「♪1/♪2 是连胞胎, 不可分割」"
grep -q '} else if partIndex + 1 < parts.count {' <<<"$PV" && B=1 || B=0
ok "第二层仍是分部(三部曲 1→2→3 不可拆)" "$B"
grep -q 'playQueueItem(queueIndex + 1)' <<<"$PV" && C=1 || C=0
ok "第三层才是队列下一首" "$C"

# ② ♪ 归零的两个时机
grep -q 'takeIndex = 0        // W2219' <<<"$PV" && D=1 || D=0
ok "换分部时 ♪ 归零" "$D"
grep -q 'takeIndex = 0$' <<<"$(grep -A2 'W2219 — 换了语言/声线' <<<"$PV")" && E=1 || E=0
ok "换语言/声线轨时 ♪ 归零(每条轨有自己的 ♪N)" "$E" "键必须带 voice, 否则多声线串台(W2116)"

# ③ 挂载逻辑只有一份
N=$(grep -c 'private func attachAudio' <<<"$PV")
ok "音轨挂载抽成唯一一份 attachAudio" "$([ "$N" = "1" ] && echo 1 || echo 0)" "playTake 与 switchTrack 共用; 两份迟早会走样"
grep -q 'audioPlayer?.play()' <<<"$(grep -A3 'W2219 — 原来这里是' <<<"$PV")" && G=1 || G=0
ok "switchTrack 结尾改用 audioPlayer(原 p 已不在作用域)" "$G" "这个错 swiftc -parse 不报, 只有真编译抓得到"

# ④ 老字段回退没被抽掉
grep -q 'audioURL: audio' <<<"$CB" && H=1 || H=0
ok "老字段 audioURL 仍然解(后端没给 takes 时的回退路径)" "$H"
grep -q 'var takes: \[CSSTake\] = \[\]' <<<"$CB" && I=1 || I=0
ok "CSSLangTrack 带 takes 且默认空数组" "$I" "空数组 = 按单版处理, 行为与本波之前一致"

# ⑤ 契约层: 真代码 + 真响应
if [ "${CALIBRATE:-}" = "1" ]; then
  echo "  ⏭  契约层跳过(CALIBRATE 只校准源码判据)"
else
  TMP=$(mktemp -d)
  cat > "$TMP/main.swift" <<'SWIFT'
import Foundation
let sem = DispatchSemaphore(value: 0)
var bad = 0
Task {
    let ts = await CSSBackend.fetchLanguageTracks(workId: "508e4d1a-30ce-434e-bc66-381ca4e1c9b6")
    guard let t = ts.first(where: { $0.isDefault }) ?? ts.first else { print("NOTRACK"); bad = 1; sem.signal(); return }
    if t.takes.count < 2 { print("TAKES=\(t.takes.count)"); bad = 1 }
    var expect = 1
    for k in t.takes {
        if k.take != expect || k.url.isEmpty { print("BADTAKE=\(k.take)"); bad = 1 }
        expect += 1
    }
    if t.audioURL.isEmpty { print("NOLEGACY"); bad = 1 }
    if let f = t.takes.first, f.url != t.audioURL { print("HEADMISMATCH"); bad = 1 }
    print("TAKES_OK=\(t.takes.count)")
    sem.signal()
}
sem.wait()
exit(Int32(bad))
SWIFT
  if xcrun swiftc -O -o "$TMP/run" tvos/cssTV/CSSBackend.swift tvos/cssTV/Models.swift "$TMP/main.swift" >"$TMP/build.log" 2>&1; then
    ok "TV 真代码可独立编译(只 import Foundation)" 1
    OUT=$("$TMP/run" 2>&1); RC=$?
    ok "线上《白鹤报恩》解出多个 ♪ 且首版与老字段一致 [$OUT]" "$([ $RC = 0 ] && echo 1 || echo 0)" \
       "首版不一致 = loadPart 用老字段起播、接力到 ♪2 会跳过或重播"
  else
    ok "TV 真代码可独立编译" 0 "$(tail -3 "$TMP/build.log")"
  fi
  rm -rf "$TMP"
fi

echo
if [ $FAIL -gt 0 ]; then echo "❌ $PASS 过 / $FAIL 败"; exit 1; else echo "✅ $PASS 过 / 0 败"; fi
