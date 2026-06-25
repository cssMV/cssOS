// CSSOS_WAVE_1172 — 大屏影院播放器。画音分层: 视频=静音视觉(AVPlayerLayer 铺满), 音频=独立真声音。
// 两个 AVPlayer 同时 play()。精确同步(音频主时钟)留作下一里程碑 —— 骨架先做到"画在动、歌在响"。

import SwiftUI
import AVKit
import AVFoundation

/// 无控件、铺满全屏的视频层(AVPlayerLayer 包装, tvOS 不显示 transport)。
struct VideoSurface: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerLayerView {
        let v = PlayerLayerView()
        v.playerLayer.player = player
        // CSSOS_WAVE_1228 — 画幅铁律: 2.39 电影宽银幕完整呈现(.resizeAspect = 上下黑边信箱),
        // 绝不用 .resizeAspectFill 裁成 16:9 满屏丢掉宽银幕两侧。
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
                EmotionSubtitleOverlay(lines: sub.lines, player: ap)
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
    private let burstDur = 1.1

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.05)) { _ in
            let t = player.currentTime().seconds
            GeometryReader { geo in
                ZStack {
                    ForEach(activeBurstTokens(t)) { tok in
                        burstChar(tok, t: t, size: geo.size)
                    }
                    if let line = currentLine(t), let toks = line.tokens, !toks.isEmpty {
                        karaokeLine(toks, t: t)
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

    private func karaokeLine(_ toks: [CSSSubToken], t: Double) -> some View {
        HStack(spacing: 2) {
            ForEach(toks) { tok in
                Text(tok.char)
                    .font(.system(size: 42, weight: .heavy))
                    .foregroundStyle(t >= tok.startSec ? Color.white : Color.white.opacity(0.32))
                    .shadow(color: .black.opacity(0.85), radius: 6)
            }
        }
        .padding(.horizontal, 30).padding(.vertical, 12)
        .background(Capsule().fill(Color.black.opacity(0.35)))
    }

    private func activeBurstTokens(_ t: Double) -> [CSSSubToken] {
        lines.flatMap { $0.tokens ?? [] }.filter { t >= $0.startSec && t < $0.startSec + burstDur }
    }

    private func burstChar(_ tok: CSSSubToken, t: Double, size: CGSize) -> some View {
        let p: Double = (t - tok.startSec) / burstDur               // 0→1
        let opacityRaw: Double = p < 0.15 ? p / 0.15 : (1 - (p - 0.15) / 0.85)
        let opacity: Double = max(0, opacityRaw) * 0.92             // 快入慢出
        let fontSize: CGFloat = CGFloat(84 * (0.7 + tok.intensity)) // 强度越大越大
        let scale: CGFloat = CGFloat(0.85 + 0.25 * p)
        let pos: CGPoint = burstPosition(tok, size: size)
        let col: Color = emotionColor(tok.emotion)
        return Text(tok.char)
            .font(.system(size: fontSize, weight: .black))
            .foregroundStyle(col)
            .shadow(color: col.opacity(0.7), radius: 26)
            .scaleEffect(scale)
            .opacity(opacity)
            .position(pos)
    }

    // 四周 8 个安全区(避开正中防爆脸), 由 token 哈希定位 → 随机散布但稳定。
    private func burstPosition(_ tok: CSSSubToken, size: CGSize) -> CGPoint {
        let zones: [(CGFloat, CGFloat)] = [
            (0.16, 0.22), (0.50, 0.15), (0.84, 0.22),
            (0.13, 0.50),               (0.87, 0.50),
            (0.18, 0.76), (0.50, 0.82), (0.82, 0.76),
        ]
        let z = zones[abs(tok.id.hashValue) % zones.count]
        return CGPoint(x: size.width * z.0, y: size.height * z.1)
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
