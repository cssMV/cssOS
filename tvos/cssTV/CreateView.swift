// W1259 — cssTV 创作台「✨ Cast an MV」。对魔镜说出/打出你的 MV(tvOS 输入框支持 Siri Remote 听写=语音)。
// v1: 捕获提示词 → 发给后端 agent → 引导。完整 tvOS 全自动出片需服务端创作端点(下一步)。

import SwiftUI

struct CreateView: View {
    var seedPrompt: String = ""
    @ObservedObject var auth: CSSAuth
    var onIFilm: (String) -> Void = { _ in }   // W1549 — 命中互动多线程电影意图 → 交宿主打开播放屏
    @Environment(\.dismiss) private var dismiss
    @State private var prompt: String = ""
    @State private var status: String = ""
    @State private var casting = false
    @FocusState private var fieldFocused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            // 招牌大爆背景(复用统一 FX)。
            EmojiBurstEffect(active: true, seed: 7, bigEmojiSize: 240, bigPeriod: 12, smallSize: 30,
                             smallSpread: 500, smallN: 22)   // W1276 周期 12s
                .opacity(0.6)
                .allowsHitTesting(false)

            VStack(spacing: 26) {
                Text("✨ Cast an MV")
                    .font(.system(size: 60, weight: .heavy)).foregroundStyle(.white)
                // W1369 — 语音优先 + 「CSS」咒语: 按住 Siri Remote 🎙 念 "CSS, …"。
                Text("Hold the 🎙 mic on your Siri Remote and say the spell:  “CSS,”  then your idea — in any language.")
                    .font(.system(size: 24)).foregroundStyle(.white.opacity(0.82))
                    .multilineTextAlignment(.center).frame(maxWidth: 920)

                TextField("e.g. “CSS, an epic anthem about the Yellow River”", text: $prompt)
                    .textFieldStyle(.plain)
                    .font(.system(size: 30, weight: .semibold))
                    .padding(20)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.08)))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(brandGreen.opacity(fieldFocused ? 0.9 : 0.3), lineWidth: 2))
                    .frame(maxWidth: 900)
                    .focused($fieldFocused)

                Button { cast() } label: {
                    Label(casting ? "Conjuring…" : "Cast ✨", systemImage: "wand.and.stars")
                        .font(.system(size: 28, weight: .bold))
                        .padding(.vertical, 16).padding(.horizontal, 44)
                }
                .buttonStyle(.card)
                .disabled(casting || prompt.trimmingCharacters(in: .whitespaces).isEmpty)

                if !status.isEmpty {
                    Text(status)
                        .font(.system(size: 22, weight: .medium)).foregroundStyle(brandGreen)
                        .multilineTextAlignment(.center).frame(maxWidth: 820)
                }

                Button("Close") { dismiss() }
                    .font(.system(size: 20)).padding(.top, 6).buttonStyle(.plain)
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(60)
        }
        // W1369 — 进来即聚焦输入框 → 用户可立刻按住 🎙 念咒语, 无需先选框。
        .onAppear {
            if prompt.isEmpty { prompt = seedPrompt }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { fieldFocused = true }
        }
    }

    /// W1369 — 剥掉开头的「CSS」唤醒咒语(说/打都剥): "CSS, …" / "css …" / "css。" → 只留灵感本体。
    private func stripSpell(_ s: String) -> String {
        var t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.lowercased().hasPrefix("css") {
            t = String(t.dropFirst(3))
            // 剥掉紧跟的标点/空白(逗号/句号/中文标点等)。
            t = t.drop(while: { $0 == "," || $0 == "，" || $0 == "." || $0 == "。" || $0 == " " || $0 == "、" || $0 == ":" || $0 == "：" }).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return t
    }

    private func cast() {
        let p = stripSpell(prompt)
        guard !p.isEmpty else { return }
        guard auth.isSignedIn else {
            status = "Please sign in first (the ✨ badge, top-left) to create."
            return
        }
        casting = true
        status = "✨ Sending your idea to the magic mirror…"
        Task {
            let result = await CSSBackend.castMV(prompt: p)
            await MainActor.run {
                casting = false
                // W1549 — 互动多线程电影意图(如《时间帝国》)→ 关本页 + 打开 cssTV 互动电影播放屏。
                if result.intent == "ifilm", let fid = result.ifilmId, !fid.isEmpty {
                    dismiss()
                    onIFilm(fid)
                    return
                }
                // W1368 — App Store 3.1.1「对买闭嘴」: 文案绝不提外部站点/充值/购买。
                //   成功=中性"生成中, 稍后进 For You"; 失败=中性"再试一次"。
                status = result.ok
                    ? "✨ Idea received! Your MV is generating — it'll appear here in For You when it's ready."
                    : "Couldn't start it just now. Please try again."
            }
        }
    }
}
