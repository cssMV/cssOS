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
    // CSSOS_WAVE_1471 — 多部连播真凶: 换集时 videoPlayer 换了新 AVPlayer 实例, 但此处原为空,
    //   layer 仍绑着第一集那个(已暂停)player → 后续集"有声无画"。重绑到当前 player 即修。
    func updateUIView(_ uiView: PlayerLayerView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }

    final class PlayerLayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}

struct PlayerView: View {
    // CSSOS_WAVE_1523 — Jing「循环列表播放」: 播放器接收【整个栏目队列】+ 起始下标。
    //   播完当前作品的所有枝丫 → 自动接队列下一个(到尾绕回第一个), 无限循环, 只有 Menu 键退出。
    //   无论从 hero/For You/任何栏目的哪个作品进, 都循环那一整栏。
    let queue: [CSSWork]
    let startIndex: Int
    @State private var queueIndex: Int
    @State private var work: CSSWork          // 当前正在播放的作品(先原始、hydrate 后替换)

    init(queue: [CSSWork], startIndex: Int) {
        self.queue = queue
        let si = queue.isEmpty ? 0 : max(0, min(startIndex, queue.count - 1))
        self.startIndex = si
        _queueIndex = State(initialValue: si)
        _work = State(initialValue: queue.isEmpty ? CSSWork(id: "") : queue[si])
    }

    @State private var videoPlayer: AVPlayer?
    @State private var audioPlayer: AVPlayer?
    @StateObject private var meter = AudioMeter()   // W1328 — 实时音量表
    @State private var showTitle = true
    // CSSOS_WAVE_1229 — 音频主时钟: audio 上的周期观察者驱动同步; audio.ended 退出。
    @State private var clockObserver: Any?
    @State private var endObserver: NSObjectProtocol?
    @State private var subtitle: CSSBackend.CSSSubtitleData?   // W1247 逐字情绪字幕
    @State private var partIndex = 0                           // W1329 — 多部连播当前枝丫
    @State private var videoEnded = false                      // W1344 — 短视频播完 → 转封面/幻灯
    // W1364 — 多语言/多声线: 影院右下语言胶囊, 热切音频+字幕, 母语默认锁定。
    @State private var langTracks: [CSSBackend.CSSLangTrack] = []
    @State private var selectedTrackId: String?
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
                    // W1344 — 短视频播完即转封面/幻灯(videoEnded), 不再循环铺满。
                    if let vp = videoPlayer, !videoEnded {
                        VideoSurface(player: vp)
                    } else if let cover = currentPart.coverURL, let url = URL(string: cover) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.black }
                    }
                }
                .frame(width: geo.size.width, height: boxH)
                .clipped()
                .position(x: geo.size.width / 2, y: geo.size.height / 2)

                // CSSOS 20260701 — Jing「全平台统一: 播放器画框绿色光晕边框」(照搬 web MV 面板那圈亮绿光)。
                //   常驻品牌绿描边 + 双层向外散的绿柔光, 框住 2.39 影院画框。cssTV 大屏尤其需要。
                //   与下方彩虹【边框进度条】分层共存: 绿光=氛围恒亮, 进度条=走时长。
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color(red: 0.0, green: 0.96, blue: 0.63), lineWidth: 3)
                    .frame(width: geo.size.width, height: boxH)
                    .shadow(color: Color(red: 0.0, green: 0.96, blue: 0.63).opacity(0.9), radius: 16)
                    .shadow(color: Color(red: 0.0, green: 0.96, blue: 0.63).opacity(0.5), radius: 34)
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
                    .allowsHitTesting(false)

                // W1348 — 取消静态绿光; 改为【边框进度条】(一字照搬桌面 app.watch-stage-bars.js):
                //   沿 2.39 画框四周走一圈的描边, 长度 = 音频主时钟 currentTime/duration, 颜色 6 段流动 + 柔光。
                if let ap = audioPlayer {
                    BorderProgressBar(player: ap, width: geo.size.width, height: boxH)
                        .position(x: geo.size.width / 2, y: geo.size.height / 2)
                        .allowsHitTesting(false)
                }
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

            // W1370 — 多语言/多声线: 胶囊宪法(像 hero 那样的两头圆胶囊), ≥2 条可播轨才显示。
            //   位置铁律: 放在 2.39 视频框【下边缘之下】那条黑边的【中线】, 既不压画框、又不进电视过扫描区。
            if langTracks.count >= 2 {
                GeometryReader { geo in
                    let halfPill: CGFloat = 25                                  // 胶囊半高(≈50/2)
                    let boxBottom = geo.size.height / 2 + (geo.size.width / 2.39) / 2   // 视频框下边缘 y
                    let bandMid = boxBottom + (geo.size.height - boxBottom) / 2 // 下方黑边中线
                    let maxY = geo.size.height - 60 - halfPill                  // 离屏底 ≥60(过扫描)
                    let minY = boxBottom + 28 + halfPill                        // 离画框 ≥28
                    let y = max(minY, min(bandMid, maxY))
                    let si = langTracks.firstIndex(where: { $0.id == selectedTrackId }) ?? 0
                    HStack {
                        Spacer()
                        HStack(spacing: 14) {
                            Image(systemName: "globe").font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.65))
                            // W1371 — 凹凸镶嵌(胶囊宪法): 选中=凸(两头圆), 左邻凹右、右邻凹左, 都朝选中咬合; 负间距重叠。
                            HStack(spacing: -25) {   // -capR 咬合
                                ForEach(Array(langTracks.enumerated()), id: \.element.id) { pair in
                                    let j = pair.offset
                                    let side: ConcavePill.Side = j == si ? .none : (j < si ? .right : .left)
                                    langCapsule(pair.element, side: side)
                                        .zIndex(j == si ? 100 : Double(langTracks.count - abs(j - si)))
                                }
                            }
                        }
                        .padding(.horizontal, 18).padding(.vertical, 8)
                        .background(Capsule().fill(.black.opacity(0.42)))      // 胶囊轨道底(像 hero 轨道)
                        .focusSection()
                        .padding(.trailing, 56)
                    }
                    .frame(width: geo.size.width)
                    .position(x: geo.size.width / 2, y: y)
                }
                .ignoresSafeArea()
                .allowsHitTesting(true)
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
        playQueueItem(queueIndex)   // W1523 — hydrate 起始作品并起播; 播完自动接队列下一个(循环)
    }

    // CSSOS_WAVE_1523 — 播放队列中第 qi 个作品(下标自动绕回, 实现"循环整栏")。
    //   队列里的作品来自 feed(标题/封面已有, 但可播媒体字段要 hydrate), 故先展示原始、hydrate 后 loadPart。
    private func playQueueItem(_ qi: Int) {
        guard !queue.isEmpty else { return }
        let idx = ((qi % queue.count) + queue.count) % queue.count
        queueIndex = idx
        let raw = queue[idx]
        work = raw
        partIndex = 0
        Task {
            let h = await CSSBackend.hydrate(raw)
            await MainActor.run {
                guard queueIndex == idx else { return }   // 期间又切了别的 → 放弃这次
                work = h
                loadPart(0)
            }
        }
    }

    // W1329 — 加载并起播第 idx 个枝丫(多部连播核心)。
    private func loadPart(_ idx: Int) {
        // 拆上一枝丫的播放器/观察者(不关音频会话)。
        if let o = clockObserver { audioPlayer?.removeTimeObserver(o); clockObserver = nil }
        if let e = endObserver { NotificationCenter.default.removeObserver(e); endObserver = nil }
        videoPlayer?.pause(); videoPlayer = nil
        audioPlayer?.pause(); audioPlayer = nil
        subtitle = nil
        videoEnded = false   // W1344 — 新枝丫: 重置
        partIndex = idx
        let part = parts[min(idx, max(parts.count - 1, 0))]

        if let v = part.bestVideo, let vurl = URL(string: v) {   // W1329 — 兜底 preview 列
            let p = AVPlayer(url: vurl)
            // W1470 — 只在【有独立音轨】时静音视频(音乐 MV 画音分层); 叙事预告声音烧在视频里
            //   (有声有画, 无独立 audioURL)→ 不静音, 用视频自带声。
            p.isMuted = (part.bestAudio != nil)
            p.actionAtItemEnd = .none
            videoPlayer = p
            // W1470 — 无独立音轨(叙事): 没有音频主时钟, 改用【视频结束】驱动连播/退出。
            if part.bestAudio == nil, let item = p.currentItem {
                endObserver = NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
                ) { _ in onAudioEnded() }
            }
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
        // W1364 — 拉该枝丫的语言×声线轨, ≥2 条才出胶囊; 高亮默认(母语)。
        langTracks = []; selectedTrackId = nil
        Task {
            let ts = await CSSBackend.fetchLanguageTracks(workId: wid)
            await MainActor.run {
                if partIndex == idx {
                    langTracks = ts
                    selectedTrackId = (ts.first(where: { $0.isDefault }) ?? ts.first)?.id
                }
            }
        }
        videoPlayer?.play()
        audioPlayer?.play()
        // 每切一部短暂显标题(让观众知道进了下一部)。
        showTitle = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            withAnimation(.easeOut(duration: 0.6)) { showTitle = false }
        }
    }

    // W1371 — 单个语言胶囊(胶囊宪法·凹凸镶嵌): 用 ConcavePill 与 hero 同款。
    //   side=.none 凸(选中, 两头圆), .left/.right 朝选中那侧凹; 凹侧内边距加大让字不被咬。
    @ViewBuilder
    private func langCapsule(_ tr: CSSBackend.CSSLangTrack, side: ConcavePill.Side) -> some View {
        let on = side == .none
        let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
        let capR: CGFloat = 25
        Button { switchTrack(tr) } label: {
            HStack(spacing: 6) {
                if tr.isDefault { Image(systemName: "lock.fill").font(.system(size: 13, weight: .bold)) }
                Text(tr.label).font(.system(size: 22, weight: on ? .bold : .medium))
            }
            .padding(.leading, side == .left ? capR + 10 : 18)
            .padding(.trailing, side == .right ? capR + 10 : 18)
            .frame(height: 50)
            .foregroundStyle(on ? Color.black : Color.white.opacity(0.92))
            .background(ConcavePill(side: side).fill(on ? brandGreen : Color.white.opacity(0.16)))
            .overlay(ConcavePill(side: side).stroke(on ? Color.clear : Color.white.opacity(0.22), lineWidth: 1))
            .shadow(color: .black.opacity(0.5), radius: 4)
        }
        .buttonStyle(.plain)
    }

    // W1364 — 切换语言×声线: 只换音频(主时钟)+ 字幕, 视频画面不动(画音分层铁律)。
    //   重挂音频轨从 0 起, 重新接 meter/时钟/结束观察者; 字幕按该轨语言重拉。
    private func switchTrack(_ track: CSSBackend.CSSLangTrack) {
        guard track.id != selectedTrackId, let aurl = URL(string: track.audioURL) else { return }
        selectedTrackId = track.id
        // 拆旧音频观察者(视频与会话保留)。
        if let o = clockObserver { audioPlayer?.removeTimeObserver(o); clockObserver = nil }
        if let e = endObserver { NotificationCenter.default.removeObserver(e); endObserver = nil }
        audioPlayer?.pause(); audioPlayer = nil
        let p = AVPlayer(url: aurl)
        audioPlayer = p
        if let item = p.currentItem { meter.attach(to: item) }
        let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
        clockObserver = p.addPeriodicTimeObserver(forInterval: interval, queue: .main) { t in
            syncVideoToAudio(t.seconds)
        }
        if let item = p.currentItem {
            endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { _ in onAudioEnded() }
        }
        // 视频回 0 与新音轨对齐(短视频会重新铺满)。
        videoEnded = false
        videoPlayer?.seek(to: .zero)
        // 字幕按该语言重拉。
        subtitle = nil
        let lang = track.lang
        let subURL = track.subtitleURL
        Task {
            let s = await CSSBackend.fetchSubtitle(jsonURL: subURL, lang: lang)
            await MainActor.run { if selectedTrackId == track.id { subtitle = s } }
        }
        p.play()
        videoPlayer?.play()
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
        // W1344 — 短视频(明显短于音频): 播完【一次】即转封面/幻灯, 不再循环铺满。
        if vDur > 1, aDur > 1, vDur < aDur * 0.8 {
            if vt >= vDur - 0.1, !videoEnded { vp.pause(); videoEnded = true }
            return
        }
        if vt.isFinite, abs(vt - audioTime) > 0.4 {
            vp.seek(to: CMTime(seconds: audioTime, preferredTimescale: 600),
                    toleranceBefore: .zero,
                    toleranceAfter: CMTime(seconds: 0.1, preferredTimescale: 600))
        }
    }

    private func onAudioEnded() {
        // W1329 — 多部连播: 还有下一枝丫 → 接着播。
        // W1523 — 本作品所有枝丫播完 → 接【队列下一个作品】(到尾绕回第一个), 循环整栏, 绝不自动退出;
        //   只有用户按 Menu 键才退出(tvOS 自动 dismiss)。单个作品 = 队列长度 1 → 循环重播它自己。
        if partIndex + 1 < parts.count {
            loadPart(partIndex + 1)
        } else {
            playQueueItem(queueIndex + 1)
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

/// W1348 — 边框进度条(照搬桌面 app.watch-stage-bars.js 的 .cssmv-border-bar)。
///  · 沿 2.39 画框四周走一圈的圆角矩形描边, trim 长度 = 音频主时钟 currentTime/duration(0→1 绕一圈)。
///  · 颜色: 6 段 seeded-hue 角向渐变缓慢流动(桌面"随机颜色波动"), 同色 drop-shadow 柔光向外散。
///  · 未播/无时长 → trim=0 不显示(安静)。播完 → 满圈。【音频主时钟】铁律, 不读视频时钟。
struct BorderProgressBar: View {
    let player: AVPlayer
    let width: CGFloat
    let height: CGFloat

    // 桌面同款 6 段色相偏移(app.watch-stage-bars.js HUE_OFFSETS)。
    private static let hueOffsets: [Double] = [0, 36, 90, 180, 270, 360]
    private func flowingColors(_ phase: Double) -> [Color] {
        let seed = (phase * 18).truncatingRemainder(dividingBy: 360)   // 缓慢转色(~20s 一圈)
        return Self.hueOffsets.map { off in
            let h = (seed + off).truncatingRemainder(dividingBy: 360) / 360
            return Color(hue: h, saturation: 0.92, brightness: 0.6)
        }
    }

    var body: some View {
        TimelineView(.animation) { tl in
            let phase = tl.date.timeIntervalSinceReferenceDate
            let d = player.currentItem?.duration.seconds ?? 0
            let t = player.currentTime().seconds
            let prog = (d > 1 && t.isFinite && t >= 0) ? max(0, min(1, t / d)) : 0
            let seedHue = (phase * 18).truncatingRemainder(dividingBy: 360) / 360
            let glow = Color(hue: seedHue, saturation: 0.92, brightness: 0.62)
            Rectangle()
                .trim(from: 0, to: prog)
                .stroke(
                    AngularGradient(gradient: Gradient(colors: flowingColors(phase)), center: .center),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round)
                )
                .frame(width: width, height: height)
                .shadow(color: glow.opacity(0.85), radius: 9)    // 内层柔光
                .shadow(color: glow.opacity(0.5), radius: 22)     // 外层散光(向外发)
        }
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

    private let lineFade = 1.1   // W1335 — 整行一起淡出时长

    // W1335 — 某字所在行的结束时刻(字停留到行尾, 再整行淡出)。
    private func lineEndFor(_ tok: CSSSubToken) -> Double {
        for line in lines where (line.tokens ?? []).contains(where: { $0.id == tok.id }) {
            return line.endSec
        }
        return tok.endSec
    }

    private func activeBurstTokens(_ t: Double) -> [CSSSubToken] {
        lines.flatMap { $0.tokens ?? [] }
            .filter { !$0.char.contains("Music") }   // W1317 — 中央爆排除 "[Music...]" 器乐标记
            // W1335 — 字爆出后停留到【整行结束 + 淡出】, 不再各自一爆即灭。
            .filter { t >= $0.startSec && t < lineEndFor($0) + lineFade }
    }

    // W1251/W1335 — 中央逐字爆: 字爆出→停留到行尾→整行一起淡出; 背景emoji/烟花是爆瞬间的一次性效果。
    private func burstGroup(_ tok: CSSSubToken, t: Double, size: CGSize) -> some View {
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
            Text(tok.char)
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
        // W1333 — 情绪字幕宪法(cssTV=横屏大屏, 四边爆, 所有语言):
        //   · 四边都可爆: 上/下=横排, 左/右=竖排。
        //   · 左/右竖排: 一律【上→下】(任何语言, 绝无下→上)。
        //   · 横排: 拉丁一律左→右; 亚洲可右→左(隔行)。
        let isCJK = tok.char.unicodeScalars.first.map { $0.value >= 0x2E80 } ?? false
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
