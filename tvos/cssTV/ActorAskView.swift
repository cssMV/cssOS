// CSSOS_WAVE_2220 20260926 —《问道》tvOS 原生实现。
//
// Jing:「请先做《问道》的 tvOS 原生实现(第一人称 + 母语古/现代切换 + 逐字流式 + 朗读)。」
//
// 这是桌面端 app.actor-gallery.js 里 wireWendao(W1582 起)的原生重制 ——
// tvOS 没有 WebKit, 内嵌网页这条路本来就不通, 但【契约一个字段都没改】:
// 同一个 /api/actors/:id/ask(SSE)、同一套 native/modern 语气、同一个 /say 朗读。
//
// 三条与桌面对齐的要点, 少一条这屏就不是「问道」了:
//   ① 逐字流式 = 平台视觉签名一「流流流」。绝不能改成转圈 + 一次性出全文
//      (CLAUDE.md:「The stream IS the product.」)。
//   ② 母语古 / 现代 是【语言锚点】, 🔊静音 与 ↻重来 是【动作键】—— 动作键按完要弹回
//      语言锚点, 不抢 active。桌面端这条写在 W1607 里, 这里照做。
//   ③ reset 帧要把【已经显示的全部】清掉重来, 不是接着往后写。后端四级引擎兜底
//      (kie→anthropic→openai→gemini)重来时就发它; 当成"再来一段"会把两次回答拼在一起。
//
// 胶囊用平台已有的 CSSPillBar(W1563), 不另造一套 —— 不重复造轮子。

import SwiftUI
import AVFoundation

struct ActorAskView: View {
    let actor: CSSActor
    @Environment(\.dismiss) private var dismiss

    /// 一条问答。answer 在流式期间会不断增长。
    private struct Turn: Identifiable {
        let id = UUID()
        let question: String
        var answer: String
        var emotion: String = ""
        var streaming: Bool = true
    }

    @State private var turns: [Turn] = []
    @State private var draft: String = ""
    @State private var busy = false
    @State private var mode: String = "native"        // native = 母语古风 / modern = 现代
    @State private var autoVoice = true
    @State private var note: String = ""              // 成本闸/失败的一次性提示
    @State private var convSummary: String = ""       // W1804 — 一句摘要承载更早的对话
    @State private var convSumAt: Int = 0
    @State private var speaking = false
    @State private var player: AVPlayer?
    @FocusState private var inputFocused: Bool

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    /// W1804 — 只发最近 8 条(= 4 轮), 更早的靠 summary。与桌面 SEND_WINDOW 同值。
    private let sendWindow = 8

    /// 头部控件条。语言锚点 + 动作键同处一条胶囊(桌面 W1607 同款)。
    private var pillItems: [CSSPillItem] {
        [
            CSSPillItem(id: "native", label: nativeLabel, icon: "scroll"),
            CSSPillItem(id: "modern", label: tr("Modern"), icon: "globe"),
            CSSPillItem(id: "mute", label: autoVoice ? "Voice on" : "Muted",
                        icon: autoVoice ? "speaker.wave.2.fill" : "speaker.slash.fill"),
            CSSPillItem(id: "reset", label: tr("Restart"), icon: "arrow.counterclockwise"),
        ]
    }
    /// 母语档的标签跟着演员走(传奇 = 他的文明母语古风; 原创 = 本色)。
    private var nativeLabel: String {
        if actor.isLegend, let c = actor.civilization, !c.isEmpty { return "Native · \(c)" }
        return "Native"
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            HStack(alignment: .top, spacing: 48) {
                portrait
                VStack(alignment: .leading, spacing: 20) {
                    header
                    // 语言锚点 + 动作键。动作键点完弹回语言锚点(见 onChange)。
                    CSSPillBar(items: pillItems, selected: Binding(
                        get: { mode },
                        set: { key in handlePill(key) }
                    ), mono: true)
                    transcript
                    if !note.isEmpty {
                        Text(note).font(.system(size: 19))
                            .foregroundStyle(Color.yellow.opacity(0.85))
                    }
                    composer
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(70)
        }
        .onExitCommand { stopVoice(); dismiss() }
        .onDisappear { stopVoice() }
    }

    // MARK: - 片段

    private var portrait: some View {
        ZStack(alignment: actor.coverAlignment) {
            if let c = actor.cover_image, let url = URL(string: c) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { Color.white.opacity(0.08) }
            } else { Color.white.opacity(0.08) }
        }
        .frame(width: 380, height: 512)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24)
            .stroke(brandGreen.opacity(speaking ? 0.95 : 0.35), lineWidth: speaking ? 4 : 2))
        // 朗读时肖像呼吸一下 —— 桌面端那套逐音节张合(lipSync)在电视上看不清, 不照搬,
        // 但「谁在说话」这个信息必须给。
        .animation(.easeInOut(duration: 0.4), value: speaking)
    }

    private var header: some View {
        HStack(spacing: 16) {
            Label(tr("Ask"), systemImage: "bubble.left.and.text.bubble.right.fill")
                .font(.system(size: 40, weight: .heavy)).foregroundStyle(brandGreen)
            Text(actor.displayName)
                .font(.system(size: 30, weight: .semibold)).foregroundStyle(.white.opacity(0.9))
            Spacer()
            Button(tr("Close")) { stopVoice(); dismiss() }
                .font(.system(size: 22, weight: .semibold))
                .buttonStyle(.bordered).tint(.white.opacity(0.6))
        }
    }

    private var transcript: some View {
        ScrollViewReader { sp in
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    if turns.isEmpty && !busy {
                        Text(openingHint)
                            .font(.system(size: 22)).foregroundStyle(.white.opacity(0.45))
                            .lineSpacing(6)
                    }
                    ForEach(turns) { t in
                        VStack(alignment: .leading, spacing: 10) {
                            if !t.question.isEmpty {
                                Text(t.question)
                                    .font(.system(size: 22, weight: .semibold))
                                    .foregroundStyle(brandGreen.opacity(0.85))
                            }
                            // 流流流: answer 每来一块就重绘, 字一个个浮现。
                            Text(t.answer.isEmpty && t.streaming ? "…" : t.answer)
                                .font(.system(size: 26))
                                .foregroundStyle(.white.opacity(0.92))
                                .lineSpacing(8)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .id(t.id)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 420)
            .onChange(of: turns.last?.answer) { _, _ in
                if let last = turns.last { withAnimation { sp.scrollTo(last.id, anchor: .bottom) } }
            }
        }
    }

    private var openingHint: String {
        "Speak to \(actor.displayName) in their own words. "
        + "Press the text field and use the Siri Remote to dictate your question."
    }

    private var composer: some View {
        HStack(spacing: 16) {
            // tvOS: 聚焦即弹屏幕键盘/听写 —— 与数字演员目录的搜索框同一个做法。
            TextField(tr("Ask something…"), text: $draft)
                .textFieldStyle(.plain).font(.system(size: 24))
                .focused($inputFocused)
                .onSubmit { send() }
                .padding(.vertical, 14).padding(.horizontal, 22)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.08)))
                .overlay(RoundedRectangle(cornerRadius: 16)
                    .stroke(brandGreen.opacity(inputFocused ? 0.9 : 0.25), lineWidth: 2))
            Button { send() } label: {
                Label(busy ? "…" : "Ask", systemImage: "paperplane.fill")
                    .font(.system(size: 22, weight: .heavy))
            }
            .buttonStyle(.borderedProminent).tint(brandGreen)
            .disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    // MARK: - 胶囊

    private func handlePill(_ key: String) {
        switch key {
        case "native", "modern":
            mode = key                      // 语言锚点: 记住选择
        case "mute":
            autoVoice.toggle()
            if !autoVoice { stopVoice() }
            // 动作键不抢 active —— mode 不动, 胶囊条自然弹回语言锚点(桌面 W1607 同款)。
        case "reset":
            // ↻ 重来 = 真的从头: 摘要也要清, 否则演员"忘了对话却记得摘要", 比不清更怪(桌面原话)。
            guard !busy else { return }
            stopVoice()
            turns = []; convSummary = ""; convSumAt = 0; note = ""
            askOpening()
        default: break
        }
    }

    // MARK: - 问

    /// 开场白: 桌面端 doReset 之后是 ask("")——空问题让演员先开口。
    private func askOpening() { fire(question: "") }

    private func send() {
        let q = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !busy else { return }
        draft = ""
        fire(question: q)
    }

    private func fire(question: String) {
        busy = true; note = ""
        stopVoice()
        // 历史 = 已有问答摊平 + 本轮提问。与桌面 history 同形。
        var msgs: [CSSBackend.AskMessage] = []
        for t in turns {
            if !t.question.isEmpty { msgs.append(.init(role: "user", content: t.question)) }
            if !t.answer.isEmpty { msgs.append(.init(role: "assistant", content: t.answer)) }
        }
        if !question.isEmpty { msgs.append(.init(role: "user", content: question)) }
        let windowed = Array(msgs.suffix(sendWindow))
        // W1804 — 只在【逐字窗口已经滑过内容】时才请演员顺带更新摘要; 短对话一句都不用多写。
        let want = msgs.count > sendWindow && (msgs.count - convSumAt) >= sendWindow

        turns.append(Turn(question: question, answer: ""))
        let idx = turns.count - 1

        Task { @MainActor in
            await CSSBackend.askStream(
                actorId: actor.actor_id, mode: mode, uiLocale: uiLocale(),
                messages: windowed, summary: convSummary, wantSummary: want,
                onDelta: { d in
                    guard idx < turns.count else { return }
                    turns[idx].answer += d
                },
                onReset: {
                    // 兜底链重来 —— 把已经显示的全部抹掉, 不是接着往后写。
                    guard idx < turns.count else { return }
                    turns[idx].answer = ""
                },
                onDone: { full, emo, sum in
                    guard idx < turns.count else { return }
                    if !full.isEmpty { turns[idx].answer = full }   // done 帧回传的是【去掉机器标记】的干净全文
                    turns[idx].emotion = emo
                    turns[idx].streaming = false
                    if !sum.isEmpty { convSummary = sum; convSumAt = msgs.count }
                    busy = false
                    if autoVoice, !turns[idx].answer.isEmpty {
                        speak(text: turns[idx].answer, emotion: emo)
                    }
                },
                onError: { e in
                    guard idx < turns.count else { return }
                    turns[idx].streaming = false
                    if turns[idx].answer.isEmpty { turns.remove(at: idx) }
                    busy = false
                    note = "Couldn't reach \(actor.displayName) just now. Please try again. (\(e))"
                }
            )
        }
    }

    /// UI 语言码(modern 档用)。tvOS 取系统首选语言, 与桌面 uiLocale() 同义。
    private func uiLocale() -> String {
        String((Locale.preferredLanguages.first ?? "en").prefix(12))
    }

    // MARK: - 朗读

    private func speak(text: String, emotion: String) {
        Task {
            let r = await CSSBackend.say(actorId: actor.actor_id, text: text, emotion: emotion)
            await MainActor.run {
                if r.rateLimited {
                    // 成本闸命中 → 关自动朗读 + 一次性提示(桌面端同样的降级)。
                    autoVoice = false
                    note = "Voice paused (hourly limit reached). Text is always free."
                    return
                }
                guard let u = r.voiceURL, let url = URL(string: u) else { return }
                try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try? AVAudioSession.sharedInstance().setActive(true)
                let p = AVPlayer(url: url)
                player = p
                speaking = true
                NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main
                ) { _ in speaking = false }
                p.play()
            }
        }
    }

    private func stopVoice() {
        player?.pause(); player = nil; speaking = false
    }
}
