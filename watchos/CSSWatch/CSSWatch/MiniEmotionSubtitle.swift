// CSS Watch — 迷你情绪字幕(W1427): 靠边框爆 —— 字直接在屏幕【边框】上爆, 只露半个字(半字出框)。
//   每团 = ① 大 emoji 当【字幕背景】(字后, 比字大很多) + ② 字(随机字体/随机色/随机大小)
//          + ③ 小 emoji 从【字心爆烟花】四散。器乐段则小 emoji 从四边框响应音量往里飘。
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
        // 靠边框: 角度绕一圈(避开正下方标题), 半径很大 → 字心在边框上, 只露半个字。
        let a = Double.random(in: -135...135) * .pi / 180
        let R = CGFloat.random(in: 88...116)
        let pos = CGSize(width: R * sin(a), height: -R * cos(a))
        let bg = pool.randomElement() ?? "✨"                              // ① 大背景 emoji
        let nSpark = 3 + Int(intensity * 4)
        var sparks: [SparkSeed] = []
        for _ in 0..<max(3, nSpark) {
            sparks.append(SparkSeed(emoji: pool.randomElement() ?? "✨",
                                    angle: Double.random(in: 0 ..< (2 * .pi)),
                                    r: CGFloat.random(in: 20...46),
                                    size: CGFloat.random(in: 10...16)))
        }
        let b = Burst(text: s,
                      color: Color(hue: Double.random(in: 0...1),                 // ② 随机色
                                   saturation: Double.random(in: 0.6...1.0), brightness: 1.0),
                      pos: pos,
                      sizeMul: CGFloat.random(in: 0.6...1.05),                       // W1428 — 随机大小(整体缩小, 别占半屏/全屏)
                      design: Self.designs.randomElement() ?? .rounded,            // 随机字体
                      bgEmoji: bg, sparks: sparks)
        bursts.append(b)
        if bursts.count > 9 { bursts.removeFirst() }
        let id = b.id
        DispatchQueue.main.asyncAfter(deadline: .now() + Double.random(in: 1.2...2.0)) {
            bursts.removeAll { $0.id == id }
        }
    }

    static let designs: [Font.Design] = [.rounded, .serif, .monospaced, .default]

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
    let id = UUID(); let emoji: String; let angle: Double; let r: CGFloat; let size: CGFloat
}

struct Burst: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let pos: CGSize
    let sizeMul: CGFloat
    let design: Font.Design
    let bgEmoji: String
    let sparks: [SparkSeed]
}

private struct BurstView: View {
    let burst: Burst
    @State private var pop = false
    @State private var fade = false

    var body: some View {
        ZStack {
            // ① 大 emoji 背景(比字大, 字幕的底; W1428 — 整体缩小 108→58)。
            Text(burst.bgEmoji).font(.system(size: 58 * burst.sizeMul)).opacity(0.30)
            // ② 字(随机字体/随机色/随机大小; W1428 — 34→24)。
            Text(burst.text)
                .font(.system(size: 24 * burst.sizeMul, weight: .heavy, design: burst.design))
                .foregroundStyle(burst.color)
                .shadow(color: burst.color.opacity(0.8), radius: 7)
                .shadow(color: .black.opacity(0.7), radius: 2)
            // ③ 小 emoji 从字心爆烟花。
            ForEach(burst.sparks) { s in SparkView(seed: s) }
        }
        .offset(burst.pos)                  // 直接到边框位(半字出框)
        .scaleEffect(pop ? 1 : 0.2)
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
            .onAppear { withAnimation(.easeOut(duration: 0.5)) { out = true } }
    }
}

// ── 器乐段(前奏/间奏/尾声/无歌声): 小 emoji 从【四边框】响应音量(合成包络)往里飘 ──────────
struct InstrumentalEdgeEmoji: View {
    let active: Bool
    let emotion: String
    @State private var motes: [Mote] = []
    @State private var phase = 0.0

    var body: some View {
        ZStack { ForEach(motes) { m in MoteView(mote: m) } }
            .allowsHitTesting(false)
            // W1427b — 自循环(不被父级频繁重渲染重置): active 时每 0.45s 喷一波。
            .task(id: active) {
                while active && !Task.isCancelled {
                    tick()
                    try? await Task.sleep(nanoseconds: 450_000_000)
                }
                if !active { motes.removeAll() }
            }
    }

    private func tick() {
        phase += 0.45
        // 合成能量包络(暂代真音量)→ 密度。
        let env = 0.5 + 0.3 * sin(phase * 0.6) + 0.15 * sin(phase * 1.9 + 1.0)
        let n = 1 + Int(max(0, min(1, env)) * 4)
        let pool = MiniEmotionSubtitle.emojiPool(for: emotion)
        for _ in 0..<n {
            let edge = Int.random(in: 0..<4)
            var start = CGSize.zero
            switch edge {
            case 0: start = CGSize(width: -110, height: .random(in: -90...90))   // 左
            case 1: start = CGSize(width: 110,  height: .random(in: -90...90))   // 右
            case 2: start = CGSize(width: .random(in: -90...90), height: -110)   // 上
            default: start = CGSize(width: .random(in: -90...90), height: 110)   // 下
            }
            // W1429 — 只往里飘一点点(≤1/3 屏): 从边框朝中央拉 16~30%, 留在外圈, 不穿屏。
            let pull = CGFloat.random(in: 0.16...0.30)
            let m = Mote(emoji: pool.randomElement() ?? "✨", start: start,
                         end: CGSize(width: start.width * (1 - pull) + .random(in: -8...8),
                                     height: start.height * (1 - pull) + .random(in: -8...8)),
                         size: .random(in: 11...18))
            motes.append(m)
            let id = m.id
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.9) { motes.removeAll { $0.id == id } }   // 更短命
        }
        if motes.count > 24 { motes.removeFirst(motes.count - 24) }
    }
}

struct Mote: Identifiable {
    let id = UUID(); let emoji: String; let start: CGSize; let end: CGSize; let size: CGFloat
}

private struct MoteView: View {
    let mote: Mote
    @State private var arrived = false
    @State private var fade = false
    var body: some View {
        Text(mote.emoji)
            .font(.system(size: mote.size))
            .offset(arrived ? mote.end : mote.start)
            .opacity(fade ? 0 : 0.9)
            .onAppear {
                withAnimation(.easeOut(duration: 1.3)) { arrived = true }     // 从边框往里飘一点点
                withAnimation(.easeIn(duration: 0.5).delay(1.2)) { fade = true }
            }
    }
}
