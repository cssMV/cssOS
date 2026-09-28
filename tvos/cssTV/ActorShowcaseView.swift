// CSSOS_WAVE_2221 20260927 — 三段试戏(自我介绍 / 正派 / 反派)tvOS 原生屏。
//
// Jing:「请接着做「三段试戏(自我介绍/正派/反派)」。」
//
// 【先说一件与预期不同的事】Jing 说「那是纯视频播放」—— 实测不是。
// 抽查 12 位演员: 已生成试戏的 5 位共 15 段, 有配音的 15 段, 有【会说话视频】的 0 段。
// 桌面端注释写得很清楚:「不再每点必烧对口型视频(omnihuman 不稳/贵): 视频=已生成缓存才播」。
// 所以这屏的主体是【母语配音 + 逐字卡拉OK字幕 + 英文译文】, 视频是"有了就用"的分支
// (CSSClip.videoURL 已经留好, 将来后端补上视频, 这里不用改)。
//
// 这反而比视频更适合电视: 逐字高亮就是平台的情绪字幕签名, 大屏上看得最清楚。
//
// 【为什么不复用 PlayerView 里的 karaokeLine】那一个是【MV 播放器专用】的:
// W1322/W1327 特意做成 8pt 细体、"不抢戏", 因为它压在 MV 画面上、主角是画面。
// 试戏屏上这行【本身就是主角】, 必须大而清楚。两者的设计意图是相反的, 强行合并
// 必然有一方被迫妥协。真正该复用的是【模型】CSSSubToken —— 字段完全同形, 已复用。
// 别来"统一"这两处。

import SwiftUI
import AVFoundation

struct ActorShowcaseView: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    let actor: CSSActor
    @Environment(\.dismiss) private var dismiss

    @State private var showcase: CSSBackend.CSSShowcase?
    @State private var loading = true
    @State private var segKey = "intro"
    @State private var now: Double = 0          // 当前播放秒 —— 驱动逐字高亮
    @State private var playing = false
    @State private var player: AVPlayer?
    @State private var videoPlayer: AVPlayer?
    @State private var clockObserver: Any?
    @State private var endObserver: Any?

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    private var clips: [CSSBackend.CSSClip] { showcase?.clips ?? [] }
    private var clip: CSSBackend.CSSClip? { clips.first { $0.key == segKey } ?? clips.first }

    /// 段胶囊。只做 Jing 点名的三段; 桌面端还有第四枚「👥 群演」, 那是一段说明文字不是试戏, 不在本波。
    private var pillItems: [CSSPillItem] {
        clips.map { c in
            switch c.key {
            case "hero":    return CSSPillItem(id: "hero", label: tr("Hero"), icon: "face.smiling")
            case "villain": return CSSPillItem(id: "villain", label: tr("Villain"), icon: "flame.fill")
            default:        return CSSPillItem(id: "intro", label: tr("Intro"), icon: "play.fill")
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            HStack(alignment: .top, spacing: 56) {
                stageLeft
                VStack(alignment: .leading, spacing: 22) {
                    header
                    if loading {
                        ProgressView().tint(brandGreen).scaleEffect(1.4)
                            .frame(maxWidth: .infinity, minHeight: 260)
                    } else if clips.isEmpty {
                        Text(tr("{name} hasn't recorded an audition yet.", ["name": actor.displayName]))
                            .font(.system(size: 24)).foregroundStyle(.white.opacity(0.55))
                            .frame(maxWidth: .infinity, minHeight: 260, alignment: .topLeading)
                    } else {
                        CSSPillBar(items: pillItems, selected: Binding(
                            get: { segKey },
                            set: { k in segKey = k; play(k) }
                        ), mono: true)
                        lineView
                        Spacer(minLength: 0)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(70)
        }
        .task { await load() }
        .onExitCommand { stop(); dismiss() }
        .onDisappear { stop() }
    }

    // MARK: - 左: 肖像(或将来有了的会说话视频)

    private var stageLeft: some View {
        ZStack {
            if let vp = videoPlayer {
                // 有会说话视频就地开口演(目前全库为空, 这条分支是为将来留的)。
                VideoLayerView(player: vp)
            } else {
                ZStack(alignment: actor.coverAlignment) {
                    if let c = actor.cover_image, let url = URL(string: c) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                        placeholder: { Color.white.opacity(0.08) }
                    } else { Color.white.opacity(0.08) }
                }
            }
        }
        .frame(width: 420, height: 566)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24)
            .stroke(brandGreen.opacity(playing ? 0.95 : 0.35), lineWidth: playing ? 4 : 2))
        .animation(.easeInOut(duration: 0.35), value: playing)
    }

    private var header: some View {
        HStack(spacing: 16) {
            Label(tr("Audition"), systemImage: "theatermasks.fill")
                .font(.system(size: 40, weight: .heavy)).foregroundStyle(brandGreen)
            Text(actor.displayName)
                .font(.system(size: 28, weight: .semibold)).foregroundStyle(.white.opacity(0.9))
            if let l = showcase?.lang, !l.isEmpty {
                Text(l.uppercased())
                    .font(.system(size: 17, weight: .heavy)).foregroundStyle(.black)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(Capsule().fill(brandGreen))
            }
            Spacer()
            Button(tr("Close")) { stop(); dismiss() }
                .font(.system(size: 22, weight: .semibold))
                .buttonStyle(.bordered).tint(.white.opacity(0.6))
        }
    }

    // MARK: - 右: 逐字母语台词 + 英文译文

    private var lineView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if let c = clip {
                    karaoke(c)
                    if !c.textEn.isEmpty {
                        Text(c.textEn)
                            .font(.system(size: 22))
                            .foregroundStyle(.white.opacity(0.5))
                            .lineSpacing(6)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxHeight: 420)
    }

    /// 逐字卡拉OK。唱过的亮, 没唱到的暗 —— 与平台情绪字幕同一套判据(token.startSec vs 当前秒)。
    /// 用 Layout-free 的 flow: tvOS 的 Text 不会自动按 token 换行, 所以自己按宽度折。
    @ViewBuilder
    private func karaoke(_ c: CSSBackend.CSSClip) -> some View {
        if c.tokens.isEmpty {
            // 没有逐字时间轴 → 整段显示, 不假装能逐字(宁可朴素, 不要假的流)。
            Text(c.text).font(.system(size: 34, weight: .semibold))
                .foregroundStyle(.white.opacity(0.92)).lineSpacing(10)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            FlowTokens(tokens: c.tokens, now: now, sung: brandGreen, unsung: Color.white.opacity(0.38))
        }
    }

    // MARK: - 取 / 播

    private func load() async {
        loading = true
        let s = await CSSBackend.fetchShowcase(actorId: actor.actor_id)
        await MainActor.run {
            showcase = s
            loading = false
            // 桌面端默认高亮 intro; 这里也一进来就演第一段, 电视上不该还要再按一次。
            if let first = s?.clips.first { segKey = first.key; play(first.key) }
        }
    }

    private func play(_ key: String) {
        stop()
        guard let c = clips.first(where: { $0.key == key }), let url = URL(string: c.voiceURL) else { return }
        now = 0
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        let p = AVPlayer(url: url)
        player = p
        // 会说话视频(将来): 与配音同起同止, 静音走配音那条主时钟 —— 四轨分离铁律。
        if let v = c.videoURL, let vurl = URL(string: v) {
            let vp = AVPlayer(url: vurl); vp.isMuted = true; videoPlayer = vp; vp.play()
        }
        // 逐字高亮由播放时钟驱动。0.05s 够细(token 最短 ~23ms 也只差一帧观感), 又不至于狂刷。
        clockObserver = p.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.05, preferredTimescale: 600), queue: .main
        ) { t in now = t.seconds }
        if let item = p.currentItem {
            endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
            ) { _ in playing = false; videoPlayer?.pause() }
        }
        p.play()
        playing = true
    }

    private func stop() {
        if let o = clockObserver { player?.removeTimeObserver(o); clockObserver = nil }
        if let e = endObserver { NotificationCenter.default.removeObserver(e); endObserver = nil }
        player?.pause(); player = nil
        videoPlayer?.pause(); videoPlayer = nil
        playing = false
    }
}

/// 逐字流式排版。SwiftUI 没有现成的"按宽度流式折行的逐字着色", 这里用最小实现:
/// 一次一个 token 累加, 超宽就换行。token 是【字】不是【词】, 所以不会把单词劈开 ——
/// 后端 token 本来就按字切(英文按字母), 空格也在 text 里。
private struct FlowTokens: View {
    let tokens: [CSSSubToken]
    let now: Double
    let sung: Color
    let unsung: Color

    var body: some View {
        // 把 token 切成若干行, 每行约 26 个字(电视观看距离下 34pt 大致这个密度)。
        // 不做精确测宽: 这是台词展示, 不是排版引擎; 精确测宽要 GeometryReader × N, 得不偿失。
        let perLine = 26
        let rows = stride(from: 0, to: tokens.count, by: perLine).map {
            Array(tokens[$0..<min($0 + perLine, tokens.count)])
        }
        return VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 0) {
                    ForEach(row) { tok in
                        Text(tok.char)
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(now >= tok.startSec ? sung : unsung)
                    }
                }
            }
        }
    }
}

/// 把 AVPlayer 贴成一层画面(试戏屏将来有会说话视频时用)。
private struct VideoLayerView: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> UIView { PlayerLayerHost(player: player) }
    func updateUIView(_ uiView: UIView, context: Context) {
        (uiView as? PlayerLayerHost)?.setPlayer(player)
    }
    final class PlayerLayerHost: UIView {
        private let layerRef = AVPlayerLayer()
        init(player: AVPlayer) {
            super.init(frame: .zero)
            layerRef.videoGravity = .resizeAspectFill
            layerRef.player = player
            layer.addSublayer(layerRef)
        }
        required init?(coder: NSCoder) { fatalError("no storyboard") }
        func setPlayer(_ p: AVPlayer) { if layerRef.player !== p { layerRef.player = p } }
        override func layoutSubviews() { super.layoutSubviews(); layerRef.frame = bounds }
    }
}
