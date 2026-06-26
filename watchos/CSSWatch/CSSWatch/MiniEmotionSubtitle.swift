// CSS Watch — 迷你情绪字幕(W1426): 半圆爆 —— 字沿【顶部半圆】顶中铺向两边(半字出框, 多字参差淡出)。
//   每团 = ① 大 emoji 背景(字后, 半透明) + ② 字(随机大小/字体/情绪色) + ③ 小 emoji 从字心爆烟花(四散)。
//   = 招牌情绪字幕宪法在圆表盘上的版本。
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
        let emo = t.emotion ?? ""
        let intensity = t.emotionIntensity ?? 0
        let pool = Self.emojiPool(for: emo)
        // 顶部半圆位(0=顶中, ±88°=两边), 靠边 → 半字出框。
        let a = Double.random(in: -88...88) * .pi / 180
        let R = CGFloat.random(in: 48...98)
        let pos = CGSize(width: R * sin(a), height: -abs(R * cos(a)) - 4)
        // ① 大背景 emoji(高情绪才有)。
        let bg: String? = (intensity >= 0.45 || Int.random(in: 0..<100) < 30) ? pool.randomElement() : nil
        // ③ 字心小烟花(几颗向四周)。
        let nSpark = 3 + Int(intensity * 4)
        var sparks: [SparkSeed] = []
        for _ in 0..<max(3, nSpark) {
            sparks.append(SparkSeed(emoji: pool.randomElement() ?? "✨",
                                    angle: Double.random(in: 0 ..< (2 * .pi)),
                                    r: CGFloat.random(in: 22...50),
                                    size: CGFloat.random(in: 11...18)))
        }
        let b = Burst(text: s, color: Self.color(for: emo), pos: pos,
                      sizeMul: CGFloat.random(in: 0.7...1.35),
                      design: Self.designs.randomElement() ?? .rounded,
                      bgEmoji: bg, sparks: sparks)
        bursts.append(b)
        if bursts.count > 8 { bursts.removeFirst() }
        let id = b.id
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

    static func emojiPool(for e: String) -> [String] {
        switch e.lowercased() {
        case "joy", "happy", "ecstatic": return ["✨", "🌟", "💫", "🎉", "☀️"]
        case "love", "tender", "warm":   return ["💖", "🌸", "💗", "🌷", "💕"]
        case "sad", "sorrow", "grief":   return ["💧", "🌧️", "🥀", "🌊", "❄️"]
        case "anger", "rage":            return ["🔥", "💥", "⚡️", "🌋"]
        case "fear", "tense":            return ["🌑", "🕯️", "💀", "🌫️"]
        case "calm", "serene", "peace":  return ["🍃", "🌿", "☁️", "🕊️", "💠"]
        case "power", "epic", "triumph": return ["🔥", "⚔️", "👑", "🦅", "🌟"]
        default:                          return ["✨", "🌸", "💫", "🔥", "🌊"]
        }
    }
}

struct SparkSeed: Identifiable {
    let id = UUID()
    let emoji: String
    let angle: Double
    let r: CGFloat
    let size: CGFloat
}

struct Burst: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let pos: CGSize
    let sizeMul: CGFloat
    let design: Font.Design
    let bgEmoji: String?
    let sparks: [SparkSeed]
}

private struct BurstView: View {
    let burst: Burst
    @State private var pop = false
    @State private var fade = false

    var body: some View {
        ZStack {
            // ① 大 emoji 背景(字后, 半透明)。
            if let bg = burst.bgEmoji {
                Text(bg).font(.system(size: 70 * burst.sizeMul)).opacity(0.30)
            }
            // ② 字(情绪色, 随机大小/字体)。
            Text(burst.text)
                .font(.system(size: 38 * burst.sizeMul, weight: .heavy, design: burst.design))
                .foregroundStyle(burst.color)
                .shadow(color: burst.color.opacity(0.7), radius: 8)
                .shadow(color: .black.opacity(0.6), radius: 2)
            // ③ 小 emoji 从字心爆烟花(向四周散)。
            ForEach(burst.sparks) { s in SparkView(seed: s) }
        }
        .offset(burst.pos)                 // 整组放到半圆位
        .scaleEffect(pop ? 1 : 0.15)
        .opacity(fade ? 0 : 1)
        .onAppear {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.5)) { pop = true }
            withAnimation(.easeIn(duration: 0.55).delay(0.65)) { fade = true }
        }
    }
}

private struct SparkView: View {
    let seed: SparkSeed
    @State private var out = false

    var body: some View {
        Text(seed.emoji)
            .font(.system(size: seed.size))
            .offset(x: out ? CGFloat(cos(seed.angle)) * seed.r : 0,
                    y: out ? CGFloat(sin(seed.angle)) * seed.r : 0)
            .onAppear { withAnimation(.easeOut(duration: 0.5)) { out = true } }   // 从字心炸开
    }
}
