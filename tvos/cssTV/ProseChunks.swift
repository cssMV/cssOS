// CSSOS_WAVE_2253 20260928 — 长文在 tvOS 上的【可滚动】做法, 抽出来共用。
//
// 为什么长文必须切块: tvOS 的 ScrollView 自己不响应方向键 —— 焦点引擎只在【可聚焦子项】
// 之间移动, 顺带把它们滚进视野。纯 Text 不可聚焦 → 整段长文既进不去焦点也滚不动。
// 而做成【一个】可聚焦项也不行: 焦点引擎只负责"把当前项滚进视野", 一项比屏幕还高时
// 滚到顶就到头, 下半段永远露不出来。必须切成多段, ↓ 在段与段之间走才能一路到底。
// (这两条是 W2234 / W2234b 在《More Info》上一次次试出来的, 别再各写一份。)
import SwiftUI

enum ProseChunks {
    /// 按空行切段; 太碎的合并(否则按几十下才到底); 方括号小标题跟着下一节走
    /// (否则会出现"一整屏只有一个标题"的落点)。
    static func split(_ body: String, minLines: Int = 4) -> [String] {
        let b0 = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !b0.isEmpty else { return [] }
        var out: [String] = []
        var cur = ""
        for block in b0.components(separatedBy: "\n\n") {
            let b = block.trimmingCharacters(in: .whitespacesAndNewlines)
            if b.isEmpty { continue }
            if b.hasPrefix("[") && b.hasSuffix("]") && !b.contains("\n") {
                cur = cur.isEmpty ? b : cur + "\n\n" + b
                continue
            }
            cur = cur.isEmpty ? b : cur + "\n\n" + b
            if cur.components(separatedBy: "\n").count >= minLines { out.append(cur); cur = "" }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    /// 没有空行的整段散文(演员生平就是这种)按句子切, 否则切不出任何落点 = 又滚不动了。
    static func splitProse(_ body: String, perChunk: Int = 3) -> [String] {
        let b0 = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !b0.isEmpty else { return [] }
        if b0.contains("\n\n") { return split(b0) }
        var sentences: [String] = []
        var cur = ""
        for ch in b0 {
            cur.append(ch)
            if "。！？.!?".contains(ch) {
                let t = cur.trimmingCharacters(in: .whitespaces)
                if !t.isEmpty { sentences.append(t) }
                cur = ""
            }
        }
        let t = cur.trimmingCharacters(in: .whitespaces); if !t.isEmpty { sentences.append(t) }
        return stride(from: 0, to: sentences.count, by: perChunk).map {
            sentences[$0 ..< min($0 + perChunk, sentences.count)].joined(separator: " ")
        }
    }
}

/// 一段可聚焦的长文。聚焦时左侧亮一条绿条 + 提亮 —— 让用户看得出焦点在哪一段。
/// 焦点值做成泛型, 每个屏用自己的 Focus 枚举即可。
struct ProseChunkText<F: Hashable>: View {
    let text: String
    @FocusState.Binding var focus: F?
    let value: F
    var size: CGFloat = 24
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        let on = focus == value
        Text(text)
            .font(.system(size: size))
            .foregroundStyle(.white.opacity(on ? 0.95 : 0.6))
            .lineSpacing(8)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 16)
            .padding(.vertical, 6)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(brandGreen.opacity(on ? 0.9 : 0.0))
                    .frame(width: 4)
            }
            .focusable(true)
            .focused($focus, equals: value)
            .animation(.easeOut(duration: 0.18), value: on)
    }
}
