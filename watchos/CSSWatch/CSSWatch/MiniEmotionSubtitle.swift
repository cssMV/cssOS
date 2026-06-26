// CSS Watch — 迷你情绪字幕(W1425): 半圆爆 —— 字沿【顶部半圆】从顶中铺向两边(类似大屏左右边爆),
//   半字可出框; 多字参差停留各自淡出; 高情绪时 emoji 也一起爆。招牌情绪字幕的圆表盘版。
import SwiftUI

struct MiniEmotionSubtitle: View {
    let token: WSubToken?
    let tick: Int
    @State private var bursts: [Burst] = []

    var body: some View {
        ZStack {
            ForEach(bursts) { b in BurstView(burst: b) }
        }
        .allowsHitTesting(false)
        .onChange(of: tick) { _, _ in addBurst() }
    }

    private func addBurst() {
        guard let t = token else { return }
        let s = t.resolved.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return }
        // 顶部半圆: 角度 a 从 -88°..88°(0=顶中), 半径靠边 → 沿上半圆铺开, 边上的半字出框。
        let a = Double.random(in: -88...88) * .pi / 180
        let R = CGFloat.random(in: 48...98)
        let pos = CGSize(width: R * sin(a), height: -abs(R * cos(a)) - 4)   // 永远在上半圆
        let intensity = t.emotionIntensity ?? 0
        let emoji = (intensity >= 0.5 || Int.random(in: 0..<100) < 22) ? Self.emoji(for: t.emotion ?? "") : nil
        let b = Burst(text: s, color: Self.color(for: t.emotion ?? ""), pos: pos,
                      sizeMul: CGFloat.random(in: 0.7...1.35),
                      design: Self.designs.randomElement() ?? .rounded, emoji: emoji)
        bursts.append(b)
        if bursts.count > 8 { bursts.removeFirst() }
        let id = b.id
        // 每字随机停留长短 → 参差消失。
        DispatchQueue.main.asyncAfter(deadline: .now() + Double.random(in: 1.2...2.0)) {
            bursts.removeAll { $0.id == id }
        }
    }

    static let designs: [Font.Design] = [.rounded, .serif, .monospaced, .default]

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

    static func emoji(for e: String) -> String {
        let pool: [String]
        switch e.lowercased() {
        case "joy", "happy", "ecstatic": pool = ["✨", "🌟", "💫", "🎉", "☀️"]
        case "love", "tender", "warm":   pool = ["💖", "🌸", "💗", "🌷", "💕"]
        case "sad", "sorrow", "grief":   pool = ["💧", "🌧️", "🥀", "🌊", "❄️"]
        case "anger", "rage":            pool = ["🔥", "💥", "⚡️", "🌋"]
        case "fear", "tense":            pool = ["🌑", "🕯️", "💀", "🌫️"]
        case "calm", "serene", "peace":  pool = ["🍃", "🌿", "☁️", "🕊️", "💠"]
        case "power", "epic", "triumph": pool = ["🔥", "⚔️", "👑", "🦅", "🌟"]
        default:                          pool = ["✨", "🌸", "💫", "🔥", "🌊"]
        }
        return pool.randomElement() ?? "✨"
    }
}

struct Burst: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let pos: CGSize
    let sizeMul: CGFloat
    let design: Font.Design
    let emoji: String?
}

private struct BurstView: View {
    let burst: Burst
    @State private var pop = false
    @State private var fade = false

    var body: some View {
        ZStack {
            Text(burst.text)
                .font(.system(size: 38 * burst.sizeMul, weight: .heavy, design: burst.design))
                .foregroundStyle(burst.color)
                .shadow(color: burst.color.opacity(0.7), radius: 8)
                .shadow(color: .black.opacity(0.6), radius: 2)
                .offset(burst.pos)
            if let e = burst.emoji {
                Text(e)
                    .font(.system(size: 24))
                    .offset(CGSize(width: burst.pos.width * 0.7, height: burst.pos.height + 34))
            }
        }
        .scaleEffect(pop ? 1 : 0.15)
        .opacity(fade ? 0 : 1)
        .onAppear {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.5)) { pop = true }     // 爆出
            withAnimation(.easeIn(duration: 0.55).delay(0.65)) { fade = true }              // 停 → 淡出
        }
    }
}
