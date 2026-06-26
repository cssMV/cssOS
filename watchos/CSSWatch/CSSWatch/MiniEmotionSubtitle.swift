// CSS Watch — 迷你情绪字幕(W1427): 靠边框爆 —— 字直接在屏幕【边框】上爆, 只露半个字(半字出框)。
//   每团 = ① 大 emoji 当【字幕背景】(字后, 比字大很多) + ② 字(随机字体/随机色/随机大小)
//          + ③ 小 emoji 从【字心爆烟花】四散。器乐段则小 emoji 从四边框响应音量往里飘。
import SwiftUI

struct MiniEmotionSubtitle: View {
    let token: WSubToken?
    let tick: Int
    let lineId: Int
    @State private var bursts: [Burst] = []
    @State private var curLine = -1               // 当前正在累积的行
    @State private var seqInLine = 0              // 本行第几个字(决定位置, 顺序连成一句)
    @State private var idleWork: DispatchWorkItem? // 这行唱完(久无新字)→ 整句一起淡出

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
        // 逐字爆(每个字唱到才单独爆出, 一字一团); 换行了 → 上一整句【一起淡出】(招牌行为, 全平台一致)。
        if lineId != curLine {
            fadeLine(curLine)
            curLine = lineId
            seqInLine = 0                 // 新行 → 从顶部中间重新开始铺
        }
        let emo = t.emotion ?? ""
        let intensity = t.emotionIntensity ?? 0
        let pool = Self.emojiPool(for: emo)
        // W1442 — 位置【有序】(从顶部正中开始, 1右2左3右…交替沿弧线往两边、往下铺) → 字按唱序连成一句可读歌词。
        //   只位置有序; 颜色/字体/大小/emoji 仍随机(情绪字幕宪法)。
        let step = 21.0                                   // 每个字沿弧线的角度间隔(度)
        let k = Double((seqInLine + 1) / 2)               // 离中心第几圈
        let sign: Double = (seqInLine % 2 == 1) ? 1 : -1  // 奇数→右, 偶数→左
        let deg = max(-150, min(150, sign * k * step))    // 封顶 ±150°(绕到两侧偏下, 不碰正下标题)
        let a = deg * .pi / 180
        let R: CGFloat = 100 + CGFloat.random(in: -5...5)  // 半径基本固定 → 字落在同一条弧上(半字出框); 微抖防呆板
        let pos = CGSize(width: R * sin(a), height: -R * cos(a))
        seqInLine += 1
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
                      lineId: lineId,
                      color: Color(hue: Double.random(in: 0...1),                 // ② 随机色
                                   saturation: Double.random(in: 0.6...1.0), brightness: 1.0),
                      pos: pos,
                      sizeMul: CGFloat.random(in: 0.6...1.05),                       // W1428 — 随机大小(整体缩小, 别占半屏/全屏)
                      design: Self.designs.randomElement() ?? .rounded,            // 随机字体
                      bgEmoji: bg, sparks: sparks)
        bursts.append(b)
        if bursts.count > 14 { bursts.removeFirst() }   // 安全上限(整句通常远少于此)
        // 这行的兜底淡出: 久无新字(行唱完/进器乐)→ 整句一起淡出。每来一字就重置。
        idleWork?.cancel()
        let lid = lineId
        let w = DispatchWorkItem { fadeLine(lid) }
        idleWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6, execute: w)
    }

    /// 把某一行的所有字标记淡出 → 一起淡出后整批移除。
    private func fadeLine(_ id: Int) {
        guard id >= 0, bursts.contains(where: { $0.lineId == id && !$0.fading }) else { return }
        for i in bursts.indices where bursts[i].lineId == id { bursts[i].fading = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
            bursts.removeAll { $0.lineId == id }
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
    let lineId: Int
    let color: Color
    let pos: CGSize
    let sizeMul: CGFloat
    let design: Font.Design
    let bgEmoji: String
    let sparks: [SparkSeed]
    var fading = false   // 整句一起淡出时由父级翻 true(不再每字各自定时消失)
}

private struct BurstView: View {
    let burst: Burst
    @State private var pop = false
    @State private var gone = false

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
        .opacity(gone ? 0 : 1)
        .onAppear {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.5)) { pop = true }   // 撞边框弹一下
        }
        // W1441 — 不再每字各自淡出; 整行唱完/换行时父级翻 fading → 整句一起淡。
        .onChange(of: burst.fading) { _, f in
            if f { withAnimation(.easeIn(duration: 0.6)) { gone = true } }
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
