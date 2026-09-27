#!/usr/bin/env bash
# W2231 回归 — 三件事, 三条线各自钉住。
#
# Jing(2026-09-27, 顶排终于跑通之后):
#   ①「苹果 TV 显示的是标题和概述说明描述文字, 我们是否也可以那样?」
#   ②「请取消媒体播放器的绿色边框, 让进度条来描绘就好了。按确认键, 浮现显示胶囊。」
#   ③「现在点 play 和 More Info 功能一样, 都是播放媒体,
#      我希望是 More Info 区域显示描述性文字。」
#
# ③ 的根因值得单独记一笔: 不是 More Info 没做, 是 TopShelf 把 playAction 和
# displayAction 赋了【同一个 TVTopShelfAction 对象】—— 两个按钮指向同一条深链,
# 自然做同一件事。所以本测最要紧的一条是【两条深链必须不同】。
#
# 校准: CALIBRATE=1 读 git HEAD, ①②③ 的主张都应当失败。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1" 2>/dev/null || echo ""; else cat "$1" 2>/dev/null || echo ""; fi; }

EXT=$(src tvos/TopShelf/ContentProvider.swift)
CB=$(src tvos/cssTV/CSSBackend.swift)
MD=$(src tvos/cssTV/Models.swift)
CV=$(src tvos/cssTV/ContentView.swift)
PV=$(src tvos/cssTV/PlayerView.swift)
WI=$(src tvos/cssTV/WorkInfoView.swift)
PBX=$(src tvos/cssTV.xcodeproj/project.pbxproj)

echo "① 顶排: 标题 + 概述描述"
grep -q 'case lyricsPreview = "lyrics_preview"' <<<"$MD" && A=1 || A=0
ok "作品模型解出 lyrics_preview" "$A" "后端一直在返回, 只是我们没解 —— 不是显示不了, 是没取回来"
grep -q 'case style$' <<<"$MD" && A=1 || A=0
ok "作品模型解出 style(曲风)" "$A"
grep -q 'case ownerName = "owner_name"' <<<"$MD" && A=1 || A=0
ok "作品模型解出 owner_name" "$A"
grep -q 'var summaryText: String' <<<"$MD" && A=1 || A=0
ok "有 summaryText 概述派生" "$A"
grep -q 'hasPrefix("\[")' <<<"$MD" && A=1 || A=0
ok "概述滤掉方括号小节标题" "$A" "京典模版每节带 [Verse 1:…], 原样丢进顶排就是一堆方括号"
grep -q 'd\["summary"\] = sm' <<<"$CB" && A=1 || A=0
ok "App 侧把 summary 写进共享清单" "$A" "扩展【没有网络】, 描述必须和封面一样现在就写好"
for f in genre duration created owner langs; do
  grep -q "d\[\"$f\"\]" <<<"$CB" && A=1 || A=0
  ok "清单带 $f" "$A"
done
grep -q 'item.summary = ' <<<"$EXT" && A=1 || A=0
ok "扩展填 item.summary" "$A"
grep -q 'item.genre = ' <<<"$EXT" && A=1 || A=0
ok "扩展填 item.genre" "$A"
grep -q 'item.duration = ' <<<"$EXT" && A=1 || A=0
ok "扩展填 item.duration" "$A"
grep -q 'item.creationDate = ' <<<"$EXT" && A=1 || A=0
ok "扩展填 item.creationDate" "$A"
grep -q 'TVTopShelfNamedAttribute(name: "Creator"' <<<"$EXT" && A=1 || A=0
ok "扩展填 namedAttributes(作者/语言)" "$A"
grep -q 'withFractionalSeconds' <<<"$EXT" && A=1 || A=0
ok "ISO8601 带小数秒" "$A" "created_at 是 …09.893Z, 不带这个标志【整条解析失败返回 nil】, 发布日期永远空着"

echo
echo "③ Play 与 More Info 必须是两件事"
grep -q 'csstv://work/' <<<"$EXT" && A=1 || A=0
ok "playAction → csstv://work/<id>" "$A"
grep -q 'csstv://info/' <<<"$EXT" && A=1 || A=0
ok "displayAction → csstv://info/<id>" "$A"
# 最要紧的一条: 两个属性不能再指向同一个 action 变量
grep -q 'item.displayAction = action' <<<"$EXT" && A=0 || A=1
ok "两者不再共用同一个 action 对象" "$A" "上一版正是 displayAction = action; playAction = action —— 所以两个按钮一模一样"
grep -q 'case "info":' <<<"$CV" && A=1 || A=0
ok "App 按 host 分流 info" "$A"
grep -q 'WorkInfoView(workId:' <<<"$CV" && A=1 || A=0
ok "info 落到作品简介屏" "$A"
[ -n "$WI" ] && A=1 || A=0
ok "WorkInfoView.swift 存在" "$A"
grep -q 'static func fetchWorkDetail' <<<"$CB" && A=1 || A=0
ok "有【无条件拉全行】的接口" "$A" "hydrate 媒体地址齐了就直接返回不发网络 → 简介屏会永远空着"

echo
echo "② 播放器: 去绿框 / 确认键浮现胶囊"
grep -q 'RoundedRectangle(cornerRadius: 6)' <<<"$PV" && A=0 || A=1
ok "静态绿色描边已取消" "$A" "它和边框进度条画在同一条线上, 底下满着就看不出进度走到哪"
grep -q 'BorderProgressBar(player: ap' <<<"$PV" && A=1 || A=0
ok "边框进度条仍在(由它来描绘)" "$A" "取消的是【常亮那圈】, 不是进度条 —— 两者别一起删"
grep -q 'if showPills && langTracks.count >= 2' <<<"$PV" && A=1 || A=0
ok "胶囊默认收起" "$A"
grep -q 'onTapGesture { if langTracks.count >= 2 { togglePills() } }' <<<"$PV" && A=1 || A=0
ok "确认键浮现胶囊" "$A"
grep -q 'private func hidePills' <<<"$PV" && A=1 || A=0
ok "有收起路径" "$A"
grep -q 'stageFocused = true' <<<"$PV" && A=1 || A=0
ok "收起后焦点还给舞台" "$A" "不还, ←/→ ↑/↓ 全部失灵 —— SwiftUI 不会自己还"
grep -q 'schedulePillHide' <<<"$PV" && A=1 || A=0
ok "8 秒无操作自动收起" "$A"
grep -q 'case .left:  seekBy(-10)' <<<"$PV" && A=1 || A=0
ok "←/→ 快退快进原样还在" "$A" "本波只是让它和胶囊在时间上错开, 不是改掉它"
grep -q 'case .up:    gotoPrev()' <<<"$PV" && A=1 || A=0
ok "↑/↓ 切枝原样还在" "$A"

echo
echo "附: 顶排根因(W2230)不得回退"
# 判据注意: Xcode 打开工程后会把 OTHER_LDFLAGS 规范化成【数组】写法 ——
#   OTHER_LDFLAGS = (
#     "-e",
#     _NSExtensionMain,
#   );
# 照字符串写法去 grep 会得到一个【假的失败】(本测第一版就是这样, 明明装机实测已生效)。
# 所以只认 _NSExtensionMain 这个词出现在工程文件里, 两种写法都能过。
grep -q '_NSExtensionMain' <<<"$PBX" && A=1 || A=0
ok "扩展仍带 -e _NSExtensionMain" "$A" "少了它, appex 走普通 main → 从不注册 XPC 服务 → 20ms 被杀, 顶排永远是静态图"
grep -q 'func loadTopShelfContent(completionHandler:' <<<"$EXT" && A=1 || A=0
ok "重写的是 completion-handler 变体" "$A"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] || exit 1
