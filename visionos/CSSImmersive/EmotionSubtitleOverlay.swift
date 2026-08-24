// CSSOS_WAVE_1936 20260824 — 情绪字幕: 整套换成 TV 版。
//
// Jing:「情绪字幕还是旧版, 请使用 TV 版的情绪字幕, 现在 Vision 版的情绪字幕错别太多。」
//
// 之前 W1898 只补了一个 adlib 字段就当修好了 —— 那是治标。Vision 这边一直是自己另写的
// 一套 RealityKit 3D 文字实体排版, 和 TV/桌面那套【逐字爆 + 底部卡拉OK + 器乐段 emoji】
// 根本不是同一个东西, 手感、时序、避让规则全都各走各的, 错自然层出不穷。
//
// 这次不修补, 直接把 TV 端跑通了的 W1247 那一套整体搬过来, 包括:
//   · 音频主时钟驱动(TimelineView 每帧读 audioPlayer.currentTime) —— 不自己计时,
//     所以暂停/拖动进度时字幕跟着走, 不会各跑各的;
//   · 底部卡拉OK行: 已唱亮 / 未唱暗, 小字放【左下角】, 不抢情绪字幕的戏(W1320);
//   · 中央逐字爆: 每字唱到就在【四周安全区】爆一个大字, 刻意避开正中 ——
//     情绪字幕宪法: 中央爆会"爆脸"(W1318);
//   · 器乐段(前奏/间奏/尾声)不显示生硬的 "[Music...]", 改成小 emoji 从四边飘入(W1317/W1327);
//   · 动效曲线 CSSFx 一并搬 —— 不搬的话"爆出来僵住再淡掉"的节奏就没了,
//     会退化成 Jing 明确否掉的"边走边淡懒洋洋飘走"。
//
// 唯一的改动是【类型适配】: TV 的 CSSSubLine/CSSSubToken → Vision 的 SubtitleLine/
// SubtitleToken。渲染逻辑一行未改, 这样两端以后能一起演进, 不会再各自长歪。
//
// Vision 上的用法: 当作 SwiftUI attachment 贴在银幕前, 而不是 3D 文字实体 ——
// 2D 浮层在头显里反而更清晰稳定, 也免掉空间排版那一整类错。

import SwiftUI
import AVFoundation

// MARK: - 类型适配层(TV 模型 → Vision 模型)
// 只补 TV 那套渲染代码要用到的计算属性, 不动 Models.swift 里的存储结构。

extension SubtitleLine {
    var startSec: Double { (tStart ?? 0) / 1000 }
    var endSec: Double { (tEnd ?? 0) / 1000 }
    var overlayID: String { "\(tStart ?? 0)-\(text ?? line ?? "")" }
}

extension SubtitleToken: Identifiable {
    /// TV 侧 char 是非可选; Vision 侧可能落在 char 或 text, 这里统一。
    var glyph: String { char ?? text ?? "" }
    public var id: String { "\(glyph)-\(tStart ?? 0)" }
    var startSec: Double { (tStart ?? 0) / 1000 }
    var endSec: Double { (tEnd ?? 0) / 1000 }
    var intensity: Double { emotionIntensity ?? 0.6 }
}

enum CSSFx {   // W1936 — 原样搬自 tvos/cssTV/Models.swift, 一行未改(动效手感靠它)
    /// 桌面 PETALS 池(app.emotion-fx.js:125)。
    static let petals = ["🌸", "🌺", "🌷", "💮", "✨", "🎉", "💖", "🌟"]

    /// 端口自桌面 @keyframes cssfxSparkOut(style.watch.css:1412):
    ///   0% opacity0/scale0.4(中心) → 12% opacity1(爆入) → 62% opacity0.92/travel0.9/scale1.04(停留)
    ///   → 100% opacity0/travel1.0/scale1.06(淡出)。曲线 cubic-bezier(0.2,0.7,0.3,1)。
    /// p ∈ [0,1] 为粒子在自身生命周期内的相位。返回 (透明度, 行进比例 0~1, 缩放)。
    /// 烟花小粒(照桌面手感): 【快速冲出(前15%, ease-out)→ 原地冻结不动 → 原地淡出】。
    /// Jing: 不要"边走边淡懒洋洋飘走"; 是爆出来僵住, 然后淡掉, 才有节奏。
    static func sparkOut(_ p: Double) -> (opacity: Double, travel: Double, scale: Double) {
        // travel: 前 15% ease-out 冲到 0.9, 之后【冻结】(常量 0.9)——淡出阶段绝不再移动。
        let travel: Double
        if p < 0.15 {
            let k = p / 0.15
            travel = 0.9 * (1 - (1 - k) * (1 - k))   // ease-out, 快出
        } else {
            travel = 0.9                             // 冻结, 原地不动
        }
        // opacity: 爆入(0~10%)→ 停留满(10~55%)→ 原地淡出(55~100%)。
        let opacity: Double
        if p < 0.10 { opacity = p / 0.10 }
        else if p < 0.55 { opacity = 1.0 }
        else { opacity = 1.0 - (p - 0.55) / 0.45 }
        // scale: 弹入过冲(0.5→1.2)→ 落定 1.0 → 停 → 淡出微涨。
        let scale: Double
        if p < 0.15 { scale = 0.5 + 0.7 * (p / 0.15) }
        else if p < 0.30 { scale = 1.2 - 0.2 * ((p - 0.15) / 0.15) }
        else if p < 0.55 { scale = 1.0 }
        else { scale = 1.0 + 0.06 * ((p - 0.55) / 0.45) }
        return (max(0, opacity), travel, scale)
    }

    /// 端口自桌面 cssfxCenterPop(大 emoji/大字: 过冲弹入 → 停留 → 淡出, 一次, 不循环)。
    /// p ∈ [0,1] 为这一次爆的生命相位。返回 (透明度, 缩放)。
    static func centerPop(_ p: Double) -> (opacity: Double, scale: Double) {
        let scale: Double
        if p < 0.13 { scale = 0.42 + (1.28 - 0.42) * (p / 0.13) }          // 弹入过冲到 1.28
        else if p < 0.30 { scale = 1.28 - 0.28 * ((p - 0.13) / 0.17) }      // 回落到 1.0
        else if p < 0.64 { scale = 1.0 }                                    // 停留(dwell)
        else { scale = 1.0 + 0.10 * ((p - 0.64) / 0.36) }                   // 淡出时微涨到 1.10
        let opacity: Double
        if p < 0.13 { opacity = p / 0.13 }                                  // 爆入
        else if p < 0.64 { opacity = 1.0 }                                  // 停留满
        else { opacity = 1.0 - (p - 0.64) / 0.36 }                          // 慢淡出
        return (max(0, opacity), scale)
    }

    /// 稳定伪随机 [0,1)(给定整数对 → 同值, 用于每颗粒子/每轮的随机角度·距离·色相·选字)。
    static func rnd(_ a: Int, _ b: Int) -> Double {
        let s = sin(Double(a &* 127 &+ b &* 311) * 0.61803398875) * 43758.5453
        return s - floor(s)
    }

    /// 随机色 halo(桌面 hsl(rand*360,92%,72%))。
    static func haloColor(_ seed: Int) -> Color {
        Color(hue: rnd(seed, 7), saturation: 0.92, brightness: 0.86)
    }
}

/// W1247 — 大屏逐字情绪字幕(平台招牌)。【音频主时钟】驱动(TimelineView 每帧读 audioPlayer.currentTime):
///  · 底部卡拉OK行: 当前行逐字, 已唱亮 / 未唱暗(逐字擦除)。
///  · 中央逐字爆: 每字唱到就在【四周散布的安全区】爆一个大字(情绪配色 + 按强度放大, 短暂淡出)。
///    刻意避开正中(胶囊宪法/情绪字幕宪法: 中央爆会"爆脸")。
struct EmotionSubtitleOverlay: View {
    let lines: [SubtitleLine]
    let player: AVPlayer
    var themeEmoji: [String] = []          // W1251 — 作品主题 emoji(背景大 emoji + 字心烟花用)
    var level: CGFloat = 0                 // W1328 — 实时音量(0~1): 器乐段 emoji 多/少响应
    private let burstDur = 2.4    // W1257 — 照搬桌面慢淡出(1.7~3.0s), 字心 emoji 爆→停留→淡出, 不再一爆即灭

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.05)) { _ in
            let t = player.currentTime().seconds
            GeometryReader { geo in
                ZStack {
                    // W1327 — 前奏/间奏/尾声/无歌声段落: 小 emoji 从屏幕四边飘入(器乐段才显)。
                    if isInstrumentalNow(t) {
                        instrumentalField(t, size: geo.size).allowsHitTesting(false)
                    }
                    ForEach(activeBurstTokens(t)) { tok in
                        burstGroup(tok, t: t, size: geo.size)
                    }
                    if let line = currentLine(t), let toks = line.tokens, !toks.isEmpty {
                        Group {
                            // W1317 — Jing: 前奏/间奏/尾声器乐段不显示生硬的 "[Music...]", 改随机几个小音符。
                            if isInstrumental(line) {
                                instrumentalNotesLine(seed: Int(line.tStart))
                            } else {
                                karaokeLine(toks, t: t)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)   // W1320 — 传统字幕小小的、左下角(不抢情绪字幕戏)
                        .padding(.leading, 60).padding(.bottom, 70)
                    }
                }
            }
        }
    }

    // W1327 — 器乐段判定: 当前无唱词行, 或当前行是 [Music...] 标记。
    private func isInstrumentalNow(_ t: Double) -> Bool {
        if let line = currentLine(t) { return isInstrumental(line) }
        return true   // 没有任何唱词行覆盖此刻 = 无歌声段
    }
    // W1327 — 小 emoji 从四边飘入(沿边、向内漂 30%, 淡入淡出, 稳定循环)。
    private func edgePoint(_ i: Int, _ prog: Double, _ size: CGSize) -> CGPoint {
        let along = CGFloat(CSSFx.rnd(i, 3))
        let depth = CGFloat(prog) * 0.30
        switch i % 4 {
        case 0:  return CGPoint(x: size.width * along, y: size.height * depth)        // 上
        case 1:  return CGPoint(x: size.width * along, y: size.height * (1 - depth))  // 下
        case 2:  return CGPoint(x: size.width * depth, y: size.height * along)        // 左
        default: return CGPoint(x: size.width * (1 - depth), y: size.height * along)  // 右
        }
    }
    private func instrumentalField(_ t: Double, size: CGSize) -> some View {
        let pool = themeEmoji.isEmpty ? ["🎵", "🎶", "✨", "🌸", "🍃", "💧"] : themeEmoji
        // W1331 — 响应音量【只改飘多飘少】(数量), 不碰速度/字号(那会让 emoji 抖)。
        //   速度、大小、轨迹全部恒定; 音量只决定显示几颗(4~24)。
        let active = 4 + Int(level * 20)
        return ZStack {
            ForEach(0..<24) { i in
                if i < active {
                    let prog = (t / (3.0 + CSSFx.rnd(i, 1) * 2.5) + CSSFx.rnd(i, 2)).truncatingRemainder(dividingBy: 1)
                    let op = prog < 0.15 ? prog / 0.15 : (prog > 0.7 ? (1 - prog) / 0.3 : 1.0)
                    Text(pool[Int(CSSFx.rnd(i, 4) * Double(pool.count)) % pool.count])
                        .font(.system(size: 26))             // 恒定
                        .position(edgePoint(i, prog, size))   // 恒定轨迹, 不随音量跳
                        .opacity(max(0, op) * 0.8)
                }
            }
        }
    }

    private func currentLine(_ t: Double) -> SubtitleLine? {
        lines.first { t >= $0.startSec && t <= $0.endSec && ($0.tokens?.isEmpty == false) }
    }

    // W1251 — 传统底部卡拉OK字幕: 不再压黑底/半透底, 改【白字 + 黑阴影描边】(多层黑 shadow = 描边)。
    private func karaokeLine(_ toks: [SubtitleToken], t: Double) -> some View {
        // W1321 — 整行随机字体 + 随机双色(已唱/未唱), 照桌面端; 每行不同, 行内一致(读得出一句)。
        let lineSeed = Int((toks.first?.tStart ?? 0))
        let sungCol = randomColor(lineSeed)
        let unsungCol = randomColor(lineSeed &+ 97)
        // W1322 — Jing: 传统字幕【细细小小】不抢戏。随机字形但【细体 .light】、18 号。
        let design = fontDesigns[abs(lineSeed) % fontDesigns.count]
        return HStack(spacing: 1) {
            ForEach(toks) { tok in
                Text(tok.glyph)
                    .font(.system(size: 8, weight: .light, design: design))   // W1327 — Jing: 缩到 8(更不抢戏)
                    .foregroundStyle(t >= tok.startSec ? sungCol.opacity(0.85) : unsungCol.opacity(0.45))
                    .shadow(color: .black.opacity(0.85), radius: 2)
            }
        }
    }

    // W1317 — 器乐段判定 + 随机小音符行(替代 "[Music...]")。
    private func isInstrumental(_ line: SubtitleLine) -> Bool {
        if line.adlib == true { return true }
        return (line.tokens?.first?.glyph ?? "").contains("Music")
    }
    private let notePool = ["♪", "♫", "♩", "♬", "🎵", "🎶"]
    private func instrumentalNotesLine(seed: Int) -> some View {
        let n = 3 + abs(seed) % 3   // 3~5 个
        return HStack(spacing: 12) {
            ForEach(0..<n, id: \.self) { i in
                Text(notePool[abs(seed &+ i &* 7) % notePool.count])
                    .font(.system(size: 24, weight: .light))           // W1325 — 同传统字幕: 小、细
                    .foregroundStyle(randomColor(seed &+ i &* 31).opacity(0.85))   // W1325 — 走传统字幕的随机变色
                    .shadow(color: .black.opacity(0.85), radius: 2)
                    .offset(y: i % 2 == 0 ? -5 : 5)   // 高低错落, 像乐谱音符
            }
        }
    }

    private let lineFade = 1.1   // W1335 — 整行一起淡出时长

    // W1335 — 某字所在行的结束时刻(字停留到行尾, 再整行淡出)。
    private func lineEndFor(_ tok: SubtitleToken) -> Double {
        for line in lines where (line.tokens ?? []).contains(where: { $0.id == tok.id }) {
            return line.endSec
        }
        return tok.endSec
    }

    private func activeBurstTokens(_ t: Double) -> [SubtitleToken] {
        lines.flatMap { $0.tokens ?? [] }
            .filter { !$0.glyph.contains("Music") }   // W1317 — 中央爆排除 "[Music...]" 器乐标记
            // W1335 — 字爆出后停留到【整行结束 + 淡出】, 不再各自一爆即灭。
            .filter { t >= $0.startSec && t < lineEndFor($0) + lineFade }
    }

    // W1251/W1335 — 中央逐字爆: 字爆出→停留到行尾→整行一起淡出; 背景emoji/烟花是爆瞬间的一次性效果。
    private func burstGroup(_ tok: SubtitleToken, t: Double, size: CGSize) -> some View {
        let p: Double = (t - tok.startSec) / burstDur            // 字心烟花相位(一次性)
        let cp: Double = min(1.0, (t - tok.startSec) / 1.1)      // 弹入相位(1.1s 收)
        let burstOp: Double = cp < 0.15 ? cp / 0.15 : max(0, 1 - (cp - 0.15) / 0.85)  // 背景emoji瞬时
        // W1335 — 字本身: 弹入(0.4s)→停留到行尾→整行淡出。
        let lineEnd = lineEndFor(tok)
        let charOp: Double
        if t < tok.startSec + 0.4 { charOp = max(0, (t - tok.startSec) / 0.4) }
        else if t < lineEnd { charOp = 1.0 }
        else { charOp = max(0, 1 - (t - lineEnd) / lineFade) }
        // W1337 — 字号随【情绪强度 × 随机】双重变化(不再大体一样大): 情绪越强越大 + 每字随机, 拉开差距。
        let emoFactor = 0.55 + tok.intensity * 1.0                          // 情绪强→大(0.55~1.55)
        let randFactor = 0.7 + CSSFx.rnd(abs(tok.id.hashValue), 17) * 0.7   // 每字随机 0.7~1.4
        let sizeMul = emoFactor * randFactor
        let charSize: CGFloat = CGFloat(70 * sizeMul)
        let bgSize: CGFloat = CGFloat(130 * sizeMul)
        // W1434 — Jing「全平台统一手表那个撞边框弹一下手感」: 弹入用 easeOutBack(过冲再回弹), 不再平滑到位。
        let bp: Double = min(1.0, (t - tok.startSec) / 0.5)     // 弹入相位 0.5s(更脆)
        let s1 = 1.70158
        let eob = 1 + (s1 + 1) * pow(bp - 1, 3) + s1 * pow(bp - 1, 2)   // 0→1 过冲回弹
        let scale: CGFloat = CGFloat(0.55 + 0.55 * eob)        // 弹到 ~1.1 过冲 → 回弹 ~1.1 稳定
        let pos: CGPoint = burstPosition(tok, size: size)
        let col: Color = randomColor(abs(tok.id.hashValue))   // W1321 — 逐字随机色(照桌面端, 不再行级情绪色)
        let emoji: String = pickEmoji(tok)
        return ZStack {
            // W1336 — 背景大emoji + 烟花【只在爆瞬间(p<1)渲染】, 爆完即移出视图树(不留 0 透明度占内存)。
            if p < 1.0 {
                Text(emoji)
                    .font(.system(size: bgSize))
                    .opacity(burstOp * 0.30)
                    .scaleEffect(scale)
                firework(p: p, seed: abs(tok.id.hashValue), maxDist: 220)   // 18 粒子, 爆完即清
            }
            // 爆大字: 停留到行尾, 整行一起淡出(停留阶段视图树里只剩这一个字)。
            Text(tok.glyph)
                .font(randomFont(charSize, seed: abs(tok.id.hashValue)))
                .foregroundStyle(col)
                .shadow(color: col.opacity(0.7), radius: 26)
                .shadow(color: .black.opacity(0.6), radius: 4)
                .scaleEffect(scale)
                .opacity(charOp * 0.92)
        }
        .position(pos)
    }

    // W1257 — 字心烟花照搬桌面 _fireworkAt + cssfxSparkOut: 12 颗, 随机随色, 爆入→停留→淡出。
    private func firework(p: Double, seed: Int, maxDist: CGFloat) -> some View {
        let n = 18
        let s = CSSFx.sparkOut(p)
        return ZStack {
            ForEach(0..<n, id: \.self) { i in
                let r1 = CSSFx.rnd(i, seed)
                let r2 = CSSFx.rnd(i, seed &+ 5)
                let r3 = CSSFx.rnd(i, seed &+ 9)
                let r4 = CSSFx.rnd(i, seed &+ 13)
                let ang: Double = r1 * 2 * .pi
                let dist: CGFloat = CGFloat((7 + r2 * 22) / 29) * maxDist
                let emoji = CSSFx.petals[Int(r3 * Double(CSSFx.petals.count)) % CSSFx.petals.count]
                let fontVar: CGFloat = 0.6 + CGFloat(r4) * 0.9
                Text(emoji)
                    .font(.system(size: 18 * fontVar))   // W1261 — 小粒真的小(原 30 太大像喷泉)
                    .scaleEffect(CGFloat(s.scale))
                    .offset(x: CGFloat(cos(ang)) * dist * CGFloat(s.travel),
                            y: CGFloat(sin(ang)) * dist * CGFloat(s.travel))
                    .shadow(color: CSSFx.haloColor(i &+ seed).opacity(0.85), radius: 7)
                    .opacity(s.opacity)
            }
        }
    }

    private func pickEmoji(_ tok: SubtitleToken) -> String {
        if !themeEmoji.isEmpty {
            return themeEmoji[abs(tok.id.hashValue) % themeEmoji.count]
        }
        return emotionEmoji(tok.emotion)
    }

    // W1321 — 随机字体 + 随机颜色(照桌面端)。tvOS 四种系统字形 + 随机字重做字体变化。
    private let fontDesigns: [Font.Design] = [.default, .serif, .rounded, .monospaced]
    private func randomFont(_ size: CGFloat, seed: Int) -> Font {
        // W1323 — 先从打包花体里挑(中文毛笔/细线 + 后续英文 Google 花体); 没有再退系统字形。
        let custom = CSSFonts.custom
        let total = custom.count + fontDesigns.count
        let idx = abs(seed) % max(total, 1)
        if idx < custom.count {
            return .custom(custom[idx], size: size)
        }
        let d = fontDesigns[(idx - custom.count) % fontDesigns.count]
        let weights: [Font.Weight] = [.semibold, .bold, .heavy, .black]
        let w = weights[abs(seed / 7) % weights.count]
        return .system(size: size, weight: w, design: d)
    }
    private func randomColor(_ seed: Int) -> Color {
        Color(hue: CSSFx.rnd(seed, 3), saturation: 0.72, brightness: 0.98)
    }

    private func emotionEmoji(_ e: String?) -> String {
        switch (e ?? "").lowercased() {
        case "haunting", "sad", "melancholy", "sorrow", "grief", "lonely": return "💧"
        case "calm", "serene", "peaceful", "tender", "gentle": return "🍃"
        case "joy", "happy", "bright", "playful", "excited": return "✨"
        case "love", "romantic", "warm", "longing": return "💗"
        case "anger", "intense", "powerful", "fierce", "rage": return "🔥"
        case "hope", "resolve", "triumphant", "uplifting", "soar": return "🌟"
        default: return "✨"
        }
    }

    // 四周 8 个安全区(避开正中防爆脸), 由 token 哈希定位 → 随机散布但稳定。
    // W1318 — 情绪字幕宪法: 同一行的字按【阅读顺序沿一条边铺开】(整体读得出一句, 错落有致),
    //   沿上/下边框爆(绝不正中央=爆脸), 可靠边半溢出; 亚洲语言【右→左】。
    private func burstPosition(_ tok: SubtitleToken, size: CGSize) -> CGPoint {
        guard let li = lines.firstIndex(where: { ($0.tokens ?? []).contains(where: { $0.id == tok.id }) }) else {
            return CGPoint(x: size.width * 0.5, y: size.height * 0.85)
        }
        let toks = lines[li].tokens ?? []
        let j = toks.firstIndex(where: { $0.id == tok.id }) ?? 0
        let n = max(toks.count, 1)
        // W1333 — 情绪字幕宪法(cssTV=横屏大屏, 四边爆, 所有语言):
        //   · 四边都可爆: 上/下=横排, 左/右=竖排。
        //   · 左/右竖排: 一律【上→下】(任何语言, 绝无下→上)。
        //   · 横排: 拉丁一律左→右; 亚洲可右→左(隔行)。
        let isCJK = tok.glyph.unicodeScalars.first.map { $0.value >= 0x2E80 } ?? false
        // W1360 — Jing: 不再刻意铺满整条边、不再刻意半重叠。改【自然字距 + 居中】:
        //   每句以画面中线为中心, 字按固定小间距排开(读起来是一句话, 不疏远);
        //   只有真排不下(超出可用区)时才自动收紧间距(此时才自然变密)。
        let m: CGFloat = 0.05
        let avail = 1 - 2 * m                       // 可用轴长(留两端边距)
        let step0: CGFloat = 0.052                  // 自然字距(轴长比例)
        let span = CGFloat(n - 1) * step0
        let step = (n > 1 && span > avail) ? avail / CGFloat(n - 1) : step0   // 太长才收紧
        let start = 0.5 - CGFloat(n - 1) * step / 2 // 整句居中
        let frac = max(m, min(1 - m, start + CGFloat(j) * step))
        let jit = CGFloat((CSSFx.rnd(j, abs(tok.id.hashValue)) - 0.5) * 0.03)
        let edge = li % 4   // 所有语言都用四边
        switch edge {
        case 0:  // 上 横排
            let f = (isCJK && li % 8 >= 4) ? (1 - frac) : frac   // 亚洲隔行可右→左
            return CGPoint(x: size.width * f, y: size.height * (0.16 + jit))
        case 1:  // 下 横排(一律左→右)
            return CGPoint(x: size.width * frac, y: size.height * (0.84 + jit))
        case 2:  // 左 竖排(上→下)
            return CGPoint(x: size.width * (0.07 + jit), y: size.height * frac)
        default: // 右 竖排(上→下)
            return CGPoint(x: size.width * (0.93 + jit), y: size.height * frac)
        }
    }

    // 情绪 → 配色(对齐 web 6 情绪)。
    private func emotionColor(_ e: String?) -> Color {
        switch (e ?? "").lowercased() {
        case "haunting", "sad", "melancholy", "sorrow", "grief", "lonely":
            return Color(red: 0.45, green: 0.65, blue: 1.0)
        case "calm", "serene", "peaceful", "tender", "gentle":
            return Color(red: 0.30, green: 0.95, blue: 0.80)
        case "joy", "happy", "bright", "playful", "excited":
            return Color(red: 1.0, green: 0.85, blue: 0.30)
        case "love", "romantic", "warm", "longing":
            return Color(red: 1.0, green: 0.50, blue: 0.70)
        case "anger", "intense", "powerful", "fierce", "rage":
            return Color(red: 1.0, green: 0.45, blue: 0.30)
        case "hope", "resolve", "triumphant", "uplifting", "soar":
            return Color(red: 0.40, green: 1.0, blue: 0.60)
        default:
            return .white
        }
    }
}
