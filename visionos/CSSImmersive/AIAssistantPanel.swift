// CSSOS_WAVE_978 — AI 助理: 独立可拖拽窗(原生 WindowGroup, 自带抓取条)。多行智能输入 + 提示词建议。
// 和桌面端一致: 说一段话/打一段字 → 生成 MV → 在圣殿里 player.load 播放。
// 真实生成管线(POST /api/agent/chat → seed → 跑管线 → workId)下一轮接; 现接桩(结构就位)。

import SwiftUI

struct AIAssistantPanel: View {
    @EnvironmentObject var player: PlayerController
    @EnvironmentObject var settings: CathedralSettings   // W982 — 单窗标记
    @State private var prompt = ""
    @State private var busy = false
    @State private var status = ""

    // 智能提示词建议(点一下填入)。W982 — i18n: (en, zh, prompt)。
    private let suggestions: [(en: String, zh: String, prompt: String)] = [
        ("🌊 Epic Ocean", "🌊 史诗海洋", "epic ocean, towering waves, cinematic, mother-tongue chant"),
        ("🏛️ Sacred Temple", "🏛️ 文明圣殿", "ancient civilization temple, sacred chorus, grand orchestral"),
        ("🌌 Cosmic Voyager", "🌌 星空旅人", "cosmic voyage through nebula, ethereal vocals, dreamy synth"),
        ("🔥 Battle Awakening", "🔥 战意觉醒", "rising battle anthem, powerful drums, triumphant brass"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles").foregroundStyle(.purple)
                Text(L("AI Assistant · Create", "AI 助理 · 创作"))
                    .font(.system(size: 24, weight: .black, design: .rounded))
            }
            Text(L("Describe the MV you want — in any language.", "用任意语言描述你想要的 MV。"))
                .font(.footnote).foregroundStyle(.secondary)

            // 多行智能输入(系统键盘自带听写/自动更正/补全)。
            TextEditor(text: $prompt)
                .font(.system(size: 18))
                .frame(width: 520, height: 150)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                .overlay(alignment: .topLeading) {
                    if prompt.isEmpty {
                        Text(L("e.g. A tender lullaby in my mother tongue, snowy night, soft piano…",
                               "例如:一首母语的温柔摇篮曲,雪夜,轻柔钢琴…"))
                            .foregroundStyle(.secondary).padding(18).allowsHitTesting(false)
                    }
                }

            // 提示词建议(胶囊, 点一下填入/追加)。
            Text(L("Quick ideas", "灵感建议")).font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                ForEach(suggestions, id: \.prompt) { s in
                    Button(L(s.en, s.zh)) { prompt = s.prompt }
                        .lineLimit(1).fixedSize()
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)

            HStack {
                if !status.isEmpty { Text(status).font(.footnote).foregroundStyle(.secondary) }
                Spacer()
                Button {
                    let p = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !p.isEmpty else { return }
                    Task { await create(p) }
                } label: {
                    Label(busy ? L("Creating…", "生成中…") : L("Create MV", "生成 MV"),
                          systemImage: "wand.and.stars").foregroundStyle(.white)
                        .padding(.horizontal, 8)
                }
                .disabled(busy)
                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large).tint(.purple)
            }.frame(width: 520)
        }
        .padding(30)
        .onDisappear { settings.aiWindowOpen = false }   // W982 — 关窗后复位, 下次可再开(且只一个)
    }

    private func create(_ p: String) async {
        busy = true; status = L("Generating your MV…", "正在生成你的 MV…")
        defer { busy = false }
        // W978 — 真实管线下一轮接: CSSBackend.createFromPrompt(p) → workId → player.load。
        if let work = await CSSBackend.createFromPrompt(p) {
            player.load(work); player.playAll()
            status = L("Now playing in the Cathedral ✨", "已在圣殿播放 ✨")
        } else {
            status = L("Creation pipeline coming next — prompt captured.", "生成管线下一轮接通 — 提示词已记录。")
        }
    }
}
