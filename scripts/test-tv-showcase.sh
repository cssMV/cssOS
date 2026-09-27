#!/usr/bin/env bash
# W2221 回归 — 三段试戏(自我介绍/正派/反派)tvOS 原生屏。
#
# 本波最重要的一条不是代码, 是【事实】: Jing 以为这三段是"纯视频播放", 实测不是 ——
# 抽查 12 位演员, 已生成试戏的 5 位共 15 段, 有配音 15 段、有会说话视频【0 段】。
# 所以主体是【母语配音 + 逐字卡拉OK字幕 + 英文译文】, 视频是"有了就用"的分支。
# 这个前提一旦变了(后端开始产视频), 这屏的设计就该重想 —— 所以把它也钉进测试。
#
# 校准: CALIBRATE=1 读 git HEAD, 源码判据应当失败。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1" 2>/dev/null || echo ""; else cat "$1" 2>/dev/null || echo ""; fi; }

SV=$(src tvos/cssTV/ActorShowcaseView.swift)
CB=$(src tvos/cssTV/CSSBackend.swift)
DA=$(src tvos/cssTV/DigitalActorsView.swift)
PV=$(src tvos/cssTV/PlayerView.swift)

ok "ActorShowcaseView.swift 存在" "$([ -n "$SV" ] && echo 1 || echo 0)"

# 顺序与段集
grep -q 'let order = \["intro", "hero", "villain"\]' <<<"$CB" && A=1 || A=0
ok "段序固定 intro→hero→villain(不是字典随机序)" "$A" "桌面端按钮就是这个顺序"
grep -q '"群演"' <<<"$SV" && B=0 || B=1
ok "本波只做 Jing 点名的三段(不夹带群演)" "$B" "桌面第四枚「👥 群演」是说明文字不是试戏"

# 逐字高亮
grep -q 'now >= tok.startSec ? sung : unsung' <<<"$SV" && C=1 || C=0
ok "逐字高亮判据 = token.startSec vs 当前秒" "$C" "与平台情绪字幕同一套判据"
grep -q 'addPeriodicTimeObserver' <<<"$SV" && D=1 || D=0
ok "高亮由播放时钟驱动(不是自己跑计时器)" "$D"
grep -q 'CSSSubToken' <<<"$SV" && E=1 || E=0
ok "复用平台的 CSSSubToken 模型(字段同形, 不另造)" "$E" "字幕 JSON 字段名不许猜"
grep -q 'if c.tokens.isEmpty' <<<"$SV" && F=1 || F=0
ok "没有逐字时间轴时整段显示, 不假装逐字" "$F" "宁可朴素, 不要假的流"

# 不去动 MV 播放器那一份(设计意图相反)
grep -q 'size: 8, weight: .light' <<<"$PV" && G=1 || G=0
ok "MV 播放器的 karaokeLine 仍是 8pt 细体(没被"统一"掉)" "$G" \
   "W1322/W1327 特意做小'不抢戏'; 试戏屏那行本身是主角, 两者意图相反"
grep -q 'size: 34, weight: .semibold' <<<"$SV" && H=1 || H=0
ok "试戏屏用自己的大字号(34pt)" "$H"

# 视频分支留好但不假装
grep -q 'let videoURL: String?' <<<"$CB" && I=1 || I=0
ok "CSSClip 留了 videoURL 分支(将来后端补视频不用改别处)" "$I"
grep -q 'vp.isMuted = true' <<<"$SV" && J=1 || J=0
ok "有视频时静音、配音当主时钟(四轨分离铁律)" "$J"

# 入口 + 自动开演
grep -q 'ActorShowcaseView(actor: actor)' <<<"$DA" && K=1 || K=0
ok "演员详情页接了 Audition 入口" "$K"
grep -q 'segKey = first.key; play(first.key)' <<<"$SV" && L=1 || L=0
ok "进屏即演第一段(电视上不该还要再按一次)" "$L"

# 契约层: 真代码 + 真数据
if [ "${CALIBRATE:-}" = "1" ]; then
  echo "  ⏭  契约层跳过"
else
  T=$(mktemp -d)
  cat > "$T/main.swift" <<'SWIFT'
import Foundation
Task { @MainActor in
    var bad: Int32 = 0
    guard let sc = await CSSBackend.fetchShowcase(actorId: "act-civ-einstein") else { print("NO_SHOWCASE"); exit(1) }
    let order = sc.clips.map { $0.key }
    if order != ["intro","hero","villain"] { print("BAD_ORDER=\(order)"); bad = 1 }
    var vids = 0
    for c in sc.clips {
        if c.voiceURL.isEmpty { print("NO_VOICE=\(c.key)"); bad = 1 }
        if c.text.isEmpty { print("NO_TEXT=\(c.key)"); bad = 1 }
        if c.videoURL != nil { vids += 1 }
        let mono = c.tokens.enumerated().allSatisfy { i, t in i == 0 || t.tStart >= c.tokens[i-1].tStart }
        if !mono { print("TOKENS_NOT_MONOTONIC=\(c.key)"); bad = 1 }
    }
    let toks = sc.clips.map { $0.tokens.count }
    print("lang=\(sc.lang) segs=\(sc.clips.count) tokens=\(toks) videos=\(vids)")
    if vids > 0 { print("NOTE: 后端开始产会说话视频了 —— 本屏的设计前提变了, 值得重想") }
    exit(bad)
}
RunLoop.main.run()
SWIFT
  if xcrun swiftc -O -o "$T/run" tvos/cssTV/CSSBackend.swift tvos/cssTV/Models.swift "$T/main.swift" >"$T/b.log" 2>&1; then
    ok "TV 真代码可独立编译" 1
    OUT=$("$T/run" 2>&1); RC=$?
    ok "线上真数据: 三段齐 + 配音齐 + 逐字递增 [$OUT]" "$([ $RC = 0 ] && echo 1 || echo 0)"
  else
    ok "TV 真代码可独立编译" 0 "$(tail -3 "$T/b.log")"
  fi
  rm -rf "$T"
fi

echo
if [ $FAIL -gt 0 ]; then echo "❌ $PASS 过 / $FAIL 败"; exit 1; else echo "✅ $PASS 过 / 0 败"; fi
