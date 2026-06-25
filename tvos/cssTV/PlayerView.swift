// CSSOS_WAVE_1172 — 大屏影院播放器。画音分层: 视频=静音视觉(AVPlayerLayer 铺满), 音频=独立真声音。
// 两个 AVPlayer 同时 play()。精确同步(音频主时钟)留作下一里程碑 —— 骨架先做到"画在动、歌在响"。

import SwiftUI
import AVKit
import AVFoundation
import UIKit   // W1266 — UIApplication.isIdleTimerDisabled(播放时禁屏保)

/// 无控件、铺满全屏的视频层(AVPlayerLayer 包装, tvOS 不显示 transport)。
struct VideoSurface: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerLayerView {
        let v = PlayerLayerView()
        v.playerLayer.player = player
        // W1319 — 画幅铁律(desktop 同款): 播放器统一锁定最终 2.39 影院标准。resizeAspectFill 填满外层 2.39 框,
        //   裁掉源多余上下。源头 W1316 已出 21:9(新作几乎不裁); 老的 16:9 也呈现 2.39(裁上下)。
        v.playerLayer.videoGravity = .resizeAspectFill
        return v
    }
    func updateUIView(_ uiView: PlayerLayerView, context: Context) {}

    final class PlayerLayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}

struct PlayerView: View {
    let work: CSSWork

    @State private var videoPlayer: AVPlayer?
    @State private var audioPlayer: AVPlayer?
    @StateObject private var meter = AudioMeter()   // W1328 — 实时音量表
    @State private var showTitle = true
    // CSSOS_WAVE_1229 — 音频主时钟: audio 上的周期观察者驱动同步; audio.ended 退出。
    @State private var clockObserver: Any?
    @State private var endObserver: NSObjectProtocol?
    @State private var subtitle: CSSBackend.CSSSubtitleData?   // W1247 逐字情绪字幕
    @State private var partIndex = 0                           // W1329 — 多部连播当前枝丫
    @Environment(\.dismiss) private var dismiss

    // W1329 — 连播队列(多部=各 part; 单曲=自己一首)+ 当前 part。
    private var parts: [CSSWork] { work.playbackParts }
    private var currentPart: CSSWork { parts[min(partIndex, max(parts.count - 1, 0))] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // W1319 — 强制 2.39 宽银幕框(满宽 × 宽/2.39, 垂直居中, 上下电影黑边); 内容 fill 裁满。
            GeometryReader { geo in
                let boxH = geo.size.width / 2.39
                Group {
                    if let vp = videoPlayer {
                        VideoSurface(player: vp)
                    } else if let cover = currentPart.coverURL, let url = URL(string: cover) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.black }
                    }
                }
                .frame(width: geo.size.width, height: boxH)
                .clipped()
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
            .ignoresSafeArea()

            // W1247 — 大屏逐字情绪字幕(招牌): 音频主时钟驱动, 底部卡拉OK + 中央逐字爆。
            if let sub = subtitle, let ap = audioPlayer {
                EmotionSubtitleOverlay(lines: sub.lines, player: ap, themeEmoji: sub.themeEmoji, level: meter.level)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            // 标题浮层(几秒后淡出)。
            if showTitle {
                VStack {
                    Spacer()
                    HStack {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(currentPart.title ?? "Untitled")
                                .font(.system(size: 44, weight: .bold))
                                .foregroundStyle(.white)
                            HStack(spacing: 12) {
                                if !currentPart.durationLabel.isEmpty {
                                    Text(currentPart.durationLabel)
                                        .font(.system(size: 24, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.7))
                                }
                                // W1329 — 多部连播分部指示。
                                if parts.count > 1 {
                                    Text("\(partIndex + 1) / \(parts.count)")
                                        .font(.system(size: 22, weight: .heavy))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 10).padding(.vertical, 3)
                                        .background(Capsule().fill(Color.green.opacity(0.85)))
                                }
                            }
                        }
                        Spacer()
                    }
                    .padding(64)
                }
                .background(
                    LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
                        .ignoresSafeArea()
                )
                .transition(.opacity)
            }
        }
        .onAppear(perform: start)
        .onDisappear(perform: stop)
        // 遥控器菜单键退出(tvOS 自动把 dismiss 接到 Menu 键)。
    }

    private func start() {
        // W1266 — 播放时禁屏保(自绘 AVPlayerLayer 不会自动阻止屏保, 否则赏 MV 中途黑屏跳屏保)。
        UIApplication.shared.isIdleTimerDisabled = true
        // 音频会话: 让声音从电视外放。
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
        loadPart(0)   // W1329 — 从第一枝丫起播; 播完自动接下一枝丫
    }

    // W1329 — 加载并起播第 idx 个枝丫(多部连播核心)。
    private func loadPart(_ idx: Int) {
        // 拆上一枝丫的播放器/观察者(不关音频会话)。
        if let o = clockObserver { audioPlayer?.removeTimeObserver(o); clockObserver = nil }
        if let e = endObserver { NotificationCenter.default.removeObserver(e); endObserver = nil }
        videoPlayer?.pause(); videoPlayer = nil
        audioPlayer?.pause(); audioPlayer = nil
        subtitle = nil
        partIndex = idx
        let part = parts[min(idx, max(parts.count - 1, 0))]

        if let v = part.bestVideo, let vurl = URL(string: v) {   // W1329 — 兜底 preview 列
            let p = AVPlayer(url: vurl)
            p.isMuted = true
            p.actionAtItemEnd = .none
            videoPlayer = p
        }
        if let a = part.bestAudio, let aurl = URL(string: a) {
            let p = AVPlayer(url: aurl)
            audioPlayer = p
            if let item = p.currentItem { meter.attach(to: item) }
            let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
            clockObserver = p.addPeriodicTimeObserver(forInterval: interval, queue: .main) { t in
                syncVideoToAudio(t.seconds)
            }
            if let item = p.currentItem {
                endObserver = NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
                ) { _ in onAudioEnded() }
            }
        }
        // 逐字情绪字幕: 按【当前枝丫】拉(每部各自字幕)。
        let wid = part.id
        Task {
            let s = await CSSBackend.fetchSubtitles(workId: wid)
            await MainActor.run { if partIndex == idx { subtitle = s } }
        }
        videoPlayer?.play()
        audioPlayer?.play()
        // 每切一部短暂显标题(让观众知道进了下一部)。
        showTitle = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            withAnimation(.easeOut(duration: 0.6)) { showTitle = false }
        }
    }

    /// CSSOS_WAVE_1229 — 音频是主时钟, 画面跟它走。
    /// - 音频不在播(缓冲/暂停)→ 视频也停, 不许独自跑。
    /// - 视频比音频短很多 = 循环视觉, 铺满音频时长(到尾无痕回 0)。
    /// - 同长 MV = 漂移 > 0.4s 就把视频 seek 回音频当前时刻。
    private func syncVideoToAudio(_ audioTime: Double) {
        // W1266 — 每 0.2s 重新断言禁屏保(防系统在长 MV 中途把它重置 → 跳屏保)。
        if !UIApplication.shared.isIdleTimerDisabled { UIApplication.shared.isIdleTimerDisabled = true }
        guard let vp = videoPlayer, let ap = audioPlayer, audioTime.isFinite else { return }
        guard ap.timeControlStatus == .playing else {
            if vp.timeControlStatus != .paused { vp.pause() }
            return
        }
        if vp.timeControlStatus != .playing { vp.play() }
        let vDur = vp.currentItem?.duration.seconds ?? 0
        let aDur = ap.currentItem?.duration.seconds ?? 0
        let vt = vp.currentTime().seconds
        if vDur > 1, aDur > 1, vDur < aDur * 0.8 {
            if vt >= vDur - 0.25 { vp.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) }
            return
        }
        if vt.isFinite, abs(vt - audioTime) > 0.4 {
            vp.seek(to: CMTime(seconds: audioTime, preferredTimescale: 600),
                    toleranceBefore: .zero,
                    toleranceAfter: CMTime(seconds: 0.1, preferredTimescale: 600))
        }
    }

    private func onAudioEnded() {
        // W1329 — 多部连播: 还有下一枝丫 → 接着播; 全部播完 → 退出影院。
        if partIndex + 1 < parts.count {
            loadPart(partIndex + 1)
        } else {
            stop()
            dismiss()
        }
    }

    private func stop() {
        if let o = clockObserver { audioPlayer?.removeTimeObserver(o); clockObserver = nil }
        if let e = endObserver { NotificationCenter.default.removeObserver(e); endObserver = nil }
        videoPlayer?.pause(); videoPlayer = nil
        audioPlayer?.pause(); audioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false)
    }
}

/// W1247 — 大屏逐字情绪字幕(平台招牌)。【音频主时钟】驱动(TimelineView 每帧读 audioPlayer.currentTime):
///  · 底部卡拉OK行: 当前行逐字, 已唱亮 / 未唱暗(逐字擦除)。
///  · 中央逐字爆: 每字唱到就在【四周散布的安全区】爆一个大字(情绪配色 + 按强度放大, 短暂淡出)。
///    刻意避开正中(胶囊宪法/情绪字幕宪法: 中央爆会"爆脸")。
struct EmotionSubtitleOverlay: View {
    let lines: [CSSSubLine]
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

    private func currentLine(_ t: Double) -> CSSSubLine? {
        lines.first { t >= $0.startSec && t <= $0.endSec && ($0.tokens?.isEmpty == false) }
    }

    // W1251 — 传统底部卡拉OK字幕: 不再压黑底/半透底, 改【白字 + 黑阴影描边】(多层黑 shadow = 描边)。
    private func karaokeLine(_ toks: [CSSSubToken], t: Double) -> some View {
        // W1321 — 整行随机字体 + 随机双色(已唱/未唱), 照桌面端; 每行不同, 行内一致(读得出一句)。
        let lineSeed = Int((toks.first?.tStart ?? 0))
        let sungCol = randomColor(lineSeed)
        let unsungCol = randomColor(lineSeed &+ 97)
        // W1322 — Jing: 传统字幕【细细小小】不抢戏。随机字形但【细体 .light】、18 号。
        let design = fontDesigns[abs(lineSeed) % fontDesigns.count]
        return HStack(spacing: 1) {
            ForEach(toks) { tok in
                Text(tok.char)
                    .font(.system(size: 8, weight: .light, design: design))   // W1327 — Jing: 缩到 8(更不抢戏)
                    .foregroundStyle(t >= tok.startSec ? sungCol.opacity(0.85) : unsungCol.opacity(0.45))
                    .shadow(color: .black.opacity(0.85), radius: 2)
            }
        }
    }

    // W1317 — 器乐段判定 + 随机小音符行(替代 "[Music...]")。
    private func isInstrumental(_ line: CSSSubLine) -> Bool {
        if line.adlib == true { return true }
        return (line.tokens?.first?.char ?? "").contains("Music")
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

    private func activeBurstTokens(_ t: Double) -> [CSSSubToken] {
        lines.flatMap { $0.tokens ?? [] }
            .filter { !$0.char.contains("Music") }   // W1317 — 中央爆排除 "[Music...]" 器乐标记
            .filter { t >= $0.startSec && t < $0.startSec + burstDur }
    }

    // W1251 — 中央逐字爆: 背景大 emoji + 爆大字 + 字心小 emoji 烟花(高强度才放)。
    private func burstGroup(_ tok: CSSSubToken, t: Double, size: CGSize) -> some View {
        let p: Double = (t - tok.startSec) / burstDur            // 字心烟花相位(慢, 跑 sparkOut)
        let cp: Double = min(1.0, (t - tok.startSec) / 1.1)      // 爆大字相位(快, 1.1s 收)
        let charOpRaw: Double = cp < 0.15 ? cp / 0.15 : (1 - (cp - 0.15) / 0.85)
        let charOp: Double = max(0, charOpRaw)
        let charSize: CGFloat = CGFloat(84 * (0.7 + tok.intensity))
        let bgSize: CGFloat = CGFloat(150 * (0.7 + tok.intensity))
        let scale: CGFloat = CGFloat(0.85 + 0.25 * cp)
        let pos: CGPoint = burstPosition(tok, size: size)
        let col: Color = randomColor(abs(tok.id.hashValue))   // W1321 — 逐字随机色(照桌面端, 不再行级情绪色)
        let emoji: String = pickEmoji(tok)
        return ZStack {
            // 背景大 emoji(淡, 衬在爆字后)
            Text(emoji)
                .font(.system(size: bgSize))
                .opacity(charOp * 0.30)
                .scaleEffect(scale)
            // 爆大字 — W1321 随机字体
            Text(tok.char)
                .font(randomFont(charSize, seed: abs(tok.id.hashValue)))
                .foregroundStyle(col)
                .shadow(color: col.opacity(0.7), radius: 26)
                .shadow(color: .black.opacity(0.6), radius: 4)
                .scaleEffect(scale)
                .opacity(charOp * 0.92)
            // 字心小 emoji 烟花: 照搬桌面 cssfxSparkOut(随机角度/距离/选字/字号 + 随机色 halo + 慢淡出)。
            firework(p: p, seed: abs(tok.id.hashValue), maxDist: 220)
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

    private func pickEmoji(_ tok: CSSSubToken) -> String {
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
    private func burstPosition(_ tok: CSSSubToken, size: CGSize) -> CGPoint {
        guard let li = lines.firstIndex(where: { ($0.tokens ?? []).contains(where: { $0.id == tok.id }) }) else {
            return CGPoint(x: size.width * 0.5, y: size.height * 0.85)
        }
        let toks = lines[li].tokens ?? []
        let j = toks.firstIndex(where: { $0.id == tok.id }) ?? 0
        let n = max(toks.count, 1)
        // W1330 — 方向: 拉丁语【只能左→右】; 亚洲语言可左可右(隔行交替); 任何语言绝不下→上。
        let isCJK = tok.char.unicodeScalars.first.map { $0.value >= 0x2E80 } ?? false
        let rtl = isCJK && (li % 2 == 1)
        var frac = (Double(j) + 0.5) / Double(n)
        if rtl { frac = 1 - frac }
        let xMargin = 0.06
        let x = xMargin + frac * (1 - 2 * xMargin)
        // 这一行靠上/下边(隔行交替), 加轻微上下错落(不整齐但成句)。
        let onTop = (li % 2 == 1)
        let jitterY = (CSSFx.rnd(j, abs(tok.id.hashValue)) - 0.5) * 0.07
        let baseY = onTop ? 0.17 : 0.83
        return CGPoint(x: size.width * CGFloat(x), y: size.height * CGFloat(baseY + jitterY))
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
