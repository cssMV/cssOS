// CSS Watch — 迷你情绪字幕: 正方形小表盘 → 中央【逐字爆】(一次一字, 随机大小/字体, 情绪色, 爆→停→淡)。
//   招牌情绪字幕的手表版(四边爆太挤, 改中央单字爆)。
import SwiftUI

struct MiniEmotionSubtitle: View {
    let token: WSubToken?
    let tick: Int

    var body: some View {
        ZStack {
            if let t = token, !t.resolved.trimmingCharacters(in: .whitespaces).isEmpty {
                BurstChar(text: t.resolved, color: Self.color(for: t.emotion ?? ""))
                    .id(tick)   // 每个新字重建视图 → 重新触发爆出动画
            }
        }
        .allowsHitTesting(false)
    }

    static func color(for e: String) -> Color {
        switch e.lowercased() {
        case "joy", "happy", "ecstatic": return Color(red: 1.0, green: 0.85, blue: 0.30)
        case "love", "tender", "warm":   return Color(red: 1.0, green: 0.45, blue: 0.65)
        case "sad", "sorrow", "grief":   return Color(red: 0.45, green: 0.65, blue: 1.0)
        case "anger", "rage":            return Color(red: 1.0, green: 0.35, blue: 0.25)
        case "fear", "tense":            return Color(red: 0.65, green: 0.45, blue: 1.0)
        case "calm", "serene", "peace":  return Color(red: 0.55, green: 0.95, blue: 0.80)
        case "power", "epic", "triumph": return Color(red: 1.0, green: 0.70, blue: 0.20)
        default:                          return .white
        }
    }
}

private struct BurstChar: View {
    let text: String
    let color: Color
    @State private var pop = false
    @State private var fade = false
    @State private var sizeMul: CGFloat = 1
    @State private var design: Font.Design = .rounded
    @State private var dx: CGFloat = 0
    @State private var dy: CGFloat = 0
    private let designs: [Font.Design] = [.rounded, .serif, .monospaced, .default]

    var body: some View {
        Text(text)
            .font(.system(size: 42 * sizeMul, weight: .heavy, design: design))
            .foregroundStyle(color)
            .shadow(color: color.opacity(0.7), radius: 9)
            .shadow(color: .black.opacity(0.6), radius: 2)
            .scaleEffect(pop ? 1 : 0.15)
            .opacity(fade ? 0 : 1)
            .offset(x: dx, y: dy)
            .onAppear {
                sizeMul = CGFloat.random(in: 0.7...1.4)
                design = designs.randomElement() ?? .rounded
                dx = CGFloat.random(in: -14...14)   // 不总在正中(招牌:随机位)
                dy = CGFloat.random(in: -10...10)
                withAnimation(.spring(response: 0.22, dampingFraction: 0.5)) { pop = true }   // 爆出
                withAnimation(.easeIn(duration: 0.5).delay(0.55)) { fade = true }             // 停 → 淡出
            }
    }
}
