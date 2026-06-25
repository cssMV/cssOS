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
        // CSSOS_WAVE_1228 — 画幅铁律: 忠实还原视频源画幅(.resizeAspect), 绝不下游强裁。源头 W1316 已修成 21:9 超宽屏。
        v.playerLayer.videoGravity = .resizeAspect
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
    @State private var showTitle = true
    // CSSOS_WAVE_1229 — 音频主时钟: audio 上的周期观察者驱动同步; audio.ended 退出。
    @State private var clockObserver: Any?
    @State private var endObserver: NSObjectProtocol?
    @State private var subtitle: CSSBackend.CSSSubtitleData?   // W1247 逐字情绪字幕
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let vp = videoPlayer {
                VideoSurface(player: vp).ignoresSafeArea()
            } else if let cover = work.coverURL, let url = URL(string: cover) {
                // 视频没准备好 → 先铺封面。
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: { Color.black }
                .ignoresSafeArea()
            }

            // W1247 — 大屏逐字情绪字幕(招牌): 音频主时钟驱动, 底部卡拉OK + 中央逐字爆。
            if let sub = subtitle, let ap = audioPlayer {
                EmotionSubtitleOverlay(lines: sub.lines, player: ap, themeEmoji: sub.themeEmoji)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            // 标题浮层(几秒后淡出)。
            if showTitle {
                VStack {
                    Spacer()
                    HStack {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(work.title ?? "Untitled")
                                .font(.system(size: 44, weight: .bold))
                                .foregroundStyle(.white)
                            if !work.durationLabel.isEmpty {
                                Text(work.durationLabel)
                                    .font(.system(size: 24, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.7))
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

        if let v = work.videoURL, let vurl = URL(string: v) {
            let p = AVPlayer(url: vurl)
            p.isMuted = true            // 画音分层: 视频永远静音
            p.actionAtItemEnd = .none    // 结尾不暂停: 由音频主时钟决定循环/收尾
            videoPlayer = p
        }
        if let a = work.audioURL, let aurl = URL(string: a) {
            let p = AVPlayer(url: aurl)
            audioPlayer = p
            // CSSOS_WAVE_1229 — 音频主时钟: audio 周期观察者每 0.2s 把视频拽回音频时刻。
            let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
            clockObserver = p.addPeriodicTimeObserver(forInterval: interval, queue: .main) { t in
                syncVideoToAudio(t.seconds)
            }
            // 切歌铁律: 只看 audio.ended(音频播完 = 本作品结束)。
            if let item = p.currentItem {
                endObserver = NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
                ) { _ in onAudioEnded() }
            }
        }
        // W1247 — 异步拉逐字情绪字幕(招牌)。
        let wid = work.id
        Task {
            let s = await CSSBackend.fetchSubtitles(workId: wid)
            await MainActor.run { subtitle = s }
        }

        // 同时起播; 此后由主时钟保持对齐。
        videoPlayer?.play()
        audioPlayer?.play()
        // 标题 5 秒后淡出。
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
        // 本作品播完 → 退出影院(下一里程碑: 自动续播下一首)。
        stop()
        dismiss()
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
    private let burstDur = 2.4    // W1257 — 照搬桌面慢淡出(1.7~3.0s), 字心 emoji 爆→停留→淡出, 不再一爆即灭

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.05)) { _ in
            let t = player.currentTime().seconds
            GeometryReader { geo in
                ZStack {
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
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        .padding(.bottom, 96)
                    }
                }
            }
        }
    }

    private func currentLine(_ t: Double) -> CSSSubLine? {
        lines.first { t >= $0.startSec && t <= $0.endSec && ($0.tokens?.isEmpty == false) }
    }

    // W1251 — 传统底部卡拉OK字幕: 不再压黑底/半透底, 改【白字 + 黑阴影描边】(多层黑 shadow = 描边)。
    private func karaokeLine(_ toks: [CSSSubToken], t: Double) -> some View {
        HStack(spacing: 2) {
            ForEach(toks) { tok in
                Text(tok.char)
                    .font(.system(size: 42, weight: .heavy))
                    .foregroundStyle(t >= tok.startSec ? Color.white : Color.white.opacity(0.45))
                    .shadow(color: .black, radius: 1)
                    .shadow(color: .black, radius: 2)
                    .shadow(color: .black.opacity(0.9), radius: 4)
            }
        }
        .padding(.horizontal, 20)
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
                    .font(.system(size: 38, weight: .bold))
                    .foregroundStyle(.white.opacity(0.92))
                    .shadow(color: .black, radius: 2)
                    .shadow(color: .black.opacity(0.9), radius: 4)
                    .offset(y: i % 2 == 0 ? -5 : 5)   // 高低错落, 像乐谱音符
            }
        }
        .padding(.horizontal, 20)
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
        let col: Color = emotionColor(tok.emotion)
        let emoji: String = pickEmoji(tok)
        return ZStack {
            // 背景大 emoji(淡, 衬在爆字后)
            Text(emoji)
                .font(.system(size: bgSize))
                .opacity(charOp * 0.30)
                .scaleEffect(scale)
            // 爆大字
            Text(tok.char)
                .font(.system(size: charSize, weight: .black))
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
        // CJK(中日韩) → 右到左
        let isCJK = tok.char.unicodeScalars.first.map { $0.value >= 0x2E80 } ?? false
        var frac = (Double(j) + 0.5) / Double(n)
        if isCJK { frac = 1 - frac }
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
