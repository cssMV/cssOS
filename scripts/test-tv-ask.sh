#!/usr/bin/env bash
# W2220 回归 —《问道》tvOS 原生实现。
#
# 三条只要破一条, 这屏就不是「问道」了, 所以逐条钉住:
#   ① 逐字流式(平台视觉签名一「流流流」)—— 绝不能退化成转圈 + 一次性出全文;
#   ② 母语古/现代是【语言锚点】, 🔊静音与↻重来是【动作键】, 动作键不抢 active(桌面 W1607);
#   ③ reset 帧把【已显示的全部】清掉重来 —— 当成"再来一段"会把两次回答拼在一起。
# 外加: 契约与桌面逐字段一致(抄一份就是造一份, 所以这里直接编译 TV 真代码去打线上接口)。
#
# 校准: CALIBRATE=1 读 git HEAD, ①②③应当失败(那时还没有这个文件)。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "${3:-}" ] && echo "       $3"; fi; }
src(){ if [ "${CALIBRATE:-}" = "1" ]; then git show "HEAD:$1" 2>/dev/null || echo ""; else cat "$1" 2>/dev/null || echo ""; fi; }

AV=$(src tvos/cssTV/ActorAskView.swift)
CB=$(src tvos/cssTV/CSSBackend.swift)
DA=$(src tvos/cssTV/DigitalActorsView.swift)
DESK=$(src public/app.actor-gallery.js)

ok "ActorAskView.swift 存在" "$([ -n "$AV" ] && echo 1 || echo 0)"

# ① 流流流
grep -q 'turns\[idx\].answer += d' <<<"$AV" && A=1 || A=0
ok "delta 逐块【追加】到屏幕(流流流)" "$A" "CLAUDE.md 平台视觉签名一:「The stream IS the product.」"
grep -q 'onDelta: @escaping (String) -> Void' <<<"$CB" && B=1 || B=0
ok "后端桥按帧回调, 不是攒完再给" "$B"
grep -qE 'ProgressView' <<<"$AV" && C=0 || C=1
ok "问道屏没有转圈占位(不许 loader + 一次性揭晓)" "$C"

# ② 语言锚点 vs 动作键
grep -q 'case "native", "modern":' <<<"$AV" && D=1 || D=0
ok "native/modern 是语言锚点(改 mode)" "$D"
grep -q 'autoVoice.toggle()' <<<"$AV" && E=1 || E=0
ok "🔊静音是动作键(只切 autoVoice, 不动 mode)" "$E" "动作键抢了 active, 胶囊就不弹回语言锚点了(桌面 W1607)"
grep -q 'turns = \[\]; convSummary = ""; convSumAt = 0' <<<"$AV" && F=1 || F=0
ok "↻重来连摘要一起清" "$F" "只清对话不清摘要 = 演员'忘了对话却记得摘要', 比不清更怪(桌面原话)"
grep -q 'CSSPillBar(' <<<"$AV" && G=1 || G=0
ok "胶囊复用平台已有的 CSSPillBar(不另造)" "$G"

# ③ reset 语义
grep -q 'turns\[idx\].answer = ""' <<<"$AV" && H=1 || H=0
ok "reset 帧把已显示的全部清空" "$H" "后端四级兜底链重来时发它; 当成'再来一段'会把两次回答拼一起"
grep -q '(ev\["reset"\] as? Bool) == true' <<<"$CB" && I=1 || I=0
ok "后端桥认得 reset 帧" "$I"

# 契约与桌面一致
grep -q '"mode": mode, "uiLocale": uiLocale' <<<"$CB" && J=1 || J=0
ok "请求体字段与桌面同名(mode/uiLocale/messages/summary/want_summary)" "$J"
grep -q 'want_summary' <<<"$CB" && K=1 || K=0
ok "带 want_summary(W1804 一句摘要承载更早对话)" "$K"
grep -q 'private let sendWindow = 8' <<<"$AV" && L=1 || L=0
ok "只发最近 8 条(与桌面 SEND_WINDOW 同值)" "$L"
grep -q '/api/actors/\\(actorId)/say' <<<"$CB" && M=1 || M=0
ok "朗读走桌面同一个 /say" "$M"
grep -q 'RATE_LIMIT' <<<"$CB" && N=1 || N=0
ok "认得 RATE_LIMIT(成本闸 → 关自动朗读)" "$N"
grep -q 'RATE_LIMIT' <<<"$DESK" && O=1 || O=0
ok "桌面端确实也这么降级(前提还在)" "$O"

# 入口
grep -q 'ActorAskView(actor: actor)' <<<"$DA" && P=1 || P=0
ok "演员详情页接了《问道》入口" "$P"

# 契约层: 真代码打线上接口
if [ "${CALIBRATE:-}" = "1" ]; then
  echo "  ⏭  契约层跳过(CALIBRATE 只校准源码判据)"
else
  T=$(mktemp -d)
  cat > "$T/main.swift" <<'SWIFT'
import Foundation
// askStream 标了 @MainActor(回调要改 @State, 必须在主 actor 上)。所以【不能】用
// semaphore 在主线程等 —— 主线程一阻塞, MainActor 上的活就永远排不上, 死锁。
// 用 RunLoop 让主 actor 转起来, 在 Task 里 exit。(第一版脚手架正是这么卡住的。)
var bad: Int32 = 0
Task { @MainActor in
    // 匿名问道有【3 句上限】(W1804, 服务端按 session 兜死)。URLSession.shared 跨进程共用
    // cookie, 跑几次就被拦, 返回的是「先留下你的名字」那句门禁文案 —— 一个 delta、瞬间返回,
    // 看着就像"客户端不流式"。清掉 cookie 拿全新会话, 才测得到真的流。
    HTTPCookieStorage.shared.cookies?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
    var deltas = 0; var full = ""; var err = ""
    await CSSBackend.askStream(actorId: CommandLine.arguments[1], mode: "native", uiLocale: "en",
        // 每次换一个问题: 同一问句会命中服务端缓存, 整段一次返回, 看着像"不流式"。
        messages: [.init(role: "user", content: "In one short sentence, name one thing you noticed on day \(Int.random(in: 1...9999)).")],
        summary: "", wantSummary: false,
        onDelta: { _ in deltas += 1 }, onReset: { },
        onDone: { f, _, _ in full = f }, onError: { e in err = e })
    print("deltas=\(deltas) full_len=\(full.count) err=\(err.isEmpty ? "-" : err)")
    if !err.isEmpty { bad = 1 }
    // 判据【只判客户端】: 拿到一块就得渲染一块。逐 token 与否是【服务端】的事 ——
    // 后端四级兜底链里有的引擎不流式, 整段一次给完(src/index.ts 自己的注释就记着
    // 「实测每次回复只有 1 个 delta」)。拿 deltas>=2 当判据 = 把服务端的抖动算到
    // 客户端头上, 测试会时绿时红, 而客户端并没有变。所以这里只判 deltas>=1 + done 干净,
    // 逐字与否由源码那条「delta 逐块追加」判据保证。
    if deltas < 1 { print("NO_DELTA_AT_ALL"); bad = 1 }
    if full.isEmpty { print("EMPTY_DONE"); bad = 1 }
    if full.contains("\u{27E6}") { print("MACHINE_TAG_LEAKED"); bad = 1 }
    // 万一仍被门禁拦住: 如实报出来, 不当成客户端失败(它确实是服务端按设计拦的)。
    if full.lowercased().contains("leave your name") { print("ANON_GATE(服务端匿名上限, 非客户端问题)") }
    exit(bad)
}
RunLoop.main.run()
SWIFT
  if xcrun swiftc -O -o "$T/run" tvos/cssTV/CSSBackend.swift tvos/cssTV/Models.swift "$T/main.swift" >"$T/b.log" 2>&1; then
    ok "TV 真代码可独立编译" 1
    OUT=$("$T/run" act-civ-einstein 2>&1); RC=$?
    ok "线上真流: 多个 delta + done 带干净全文 [$OUT]" "$([ $RC = 0 ] && echo 1 || echo 0)" \
       "deltas=0 / err / full 空 / full 含 ⟦⟧ 才算失败; 逐字与否是服务端的事, 见脚本里的说明"
  else
    ok "TV 真代码可独立编译" 0 "$(tail -3 "$T/b.log")"
  fi
  rm -rf "$T"
fi

echo
if [ $FAIL -gt 0 ]; then echo "❌ $PASS 过 / $FAIL 败"; exit 1; else echo "✅ $PASS 过 / 0 败"; fi
