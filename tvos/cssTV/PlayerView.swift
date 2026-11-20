// CSSOS_WAVE_1172 — 大屏影院播放器。画音分层: 视频=静音视觉(AVPlayerLayer 铺满), 音频=独立真声音。
// 两个 AVPlayer 同时 play()。精确同步(音频主时钟)留作下一里程碑 —— 骨架先做到"画在动、歌在响"。

import SwiftUI
import AVKit
import AVFoundation
import UIKit   // W1266 — UIApplication.isIdleTimerDisabled(播放时禁屏保)

/* ═══════════════════════════════════════════════════════════════════════════
 * CSSOS_WAVE_2346 20261120 — 画幅铁律的【唯一真源】(tvOS 端)
 *
 * Jing 2026-11-20:「21:9 铁律: 构图, 取景, 输出, 而不要用其他比例的来剪裁,
 *                   必须是源输出就是 21:9。」「不再使用 2.39:1, 改为 21:9。」
 *
 * 在这之前 tvOS 这边有 20 多处写死的 `2.39` —— 而源头(src/index.ts 的
 * CINEMA_LANDSCAPE)出的是 21:9(2520×1080 = 2.3333)。
 * 用 2.39 的框去装 2.3333 的片, resizeAspectFill 会再切掉约 2.4% 的高度:
 * 【源已经是对的, 却在播放端被裁了一刀】—— 那正是铁律禁止的事。
 *
 * 所以这里只留一个常量, 全端几何都指向它。要改画幅只改这一行, 并且必须与
 * src/index.ts 的 CINEMA_LANDSCAPE 一起改 —— 两处分叉 = 播放端又开始裁。
 * ═══════════════════════════════════════════════════════════════════════════ */
let CSS_CINEMA_RATIO: CGFloat = 21.0 / 9.0   // = 2.3333…, 与后端 CINEMA_LANDSCAPE 一致

/// 无控件、铺满全屏的视频层(AVPlayerLayer 包装, tvOS 不显示 transport)。
struct VideoSurface: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerLayerView {
        let v = PlayerLayerView()
        v.playerLayer.player = player
        /* W1319 / W2346 — 画幅铁律(desktop 同款): 播放器锁定 21:9 影院标准,
         * resizeAspectFill 填满外层 21:9 框。
         *
         * W2346 改的是框本身: 原来这个框是 2.39, 而源头出的是 21:9(2.3333)——
         * 于是【源明明已经是对的, 还要在播放端再被裁掉约 2.4% 的高度】。
         * 现在 框 = 源 = 21:9, 新作一帧不裁。
         * 老的 16:9 片源仍会被裁上下 —— 它本来就不是 21:9, 那是存量, 不是新账。 */
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

/* CSSOS_WAVE_2350 — 舞台层那个"隐形确认键"专用的按钮样式: 原样返回 label, 不叠任何装饰。
 *
 * 为什么不能用 .plain: tvOS 的 .plain 去掉了卡片背景, 但【按下时仍会改 label 的透明度】,
 * 而且不负责关焦点高亮。这个 Button 的 label 是铺满全屏的透明层, 任何一点装饰都会
 * 变成"整个画面蒙了一层" —— 正是 Jing 报的白色层。
 * 这里要的是一个【只收按键、一个像素都不画】的按钮。 */
private struct StageTapButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label }
}

struct PlayerView: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
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
    /// CSSOS_WAVE_2219 20260926 — Jing:「cssTV 仍然只把《白鹤报恩》当成一首单曲只播放 take 1
    /// 就跳到下一首歌, 应该播放完毕一首歌所有的 takes, 才能切换到下一首歌。」
    /// 当前播到第几个 ♪(0-based)。换分部 / 换语言轨都归 0。
    @State private var takeIndex: Int = 0
    @State private var selectedTrackId: String?
    @Environment(\.dismiss) private var dismiss

    /* CSSOS_WAVE_2231 20260927 — 胶囊改成【按确认键才浮现】。
     *
     * Jing:「按确认键, 浮现显示胶囊。」
     *
     * 【顺带修掉一个方向键打架】: 胶囊常驻时它里面的 Button 是可聚焦的, 和整块舞台
     * (.focusable + .onMoveCommand 的 ←/→ 快退快进)抢同一组方向键 —— 焦点落在哪边,
     * 另一边的方向键就全废。藏起来之后两者【在时间上错开】, 各自都完整:
     *   胶囊没浮现 → 焦点在舞台 → ←/→ 快退快进, ↑/↓ 切枝(原行为, 一个字没改)
     *   胶囊浮现   → 焦点在胶囊 → ←/→ 在各语言/声线之间走, 确认键切轨并收起
     * 收起后焦点【必须显式还给舞台】, 否则 SwiftUI 会把焦点甩到别处, 方向键当场失灵。 */
    @State private var showPills = false
    @FocusState private var stageFocused: Bool
    /// 浮现后 8 秒无操作自动收起 —— 电视上任何常驻浮层都是在挡画面。
    @State private var pillHideToken = 0
    /// W2243 — 当前展开的模式头。顺序与命名照电脑端那一组固定导航。
    @State private var pillMode = "lang"
    /// W2247 — 用户是否主动点过模式头。只有点过之后, 焦点才自动下到第二行;
    /// 刚浮现那一下焦点该留在模式行。
    @State private var pillModeTouched = false
    /* CSSOS_WAVE_2248 — 子胶囊行是否展开。
     * Jing:「再次在 take(胶囊头)上按一下, 应该收起子胶囊。」
     * 模式头因此是个【开关】: 按别的头 = 换模式并展开; 按【当前这个头】= 收起 / 再展开。
     * CSSPillBar 的按钮无论值变没变都会回调, 所以"按了同一个头"这件事接得住。 */
    @State private var pillRowOpen = true
    /* CSSOS_WAVE_2250 — 多画面胶囊。key: "video" / "hybrid" / "slides"。
     * 记忆走 UserDefaults, 与桌面 localStorage "cssos.visual.mode" 同一条规矩:
     * 没选过 → 用该作品能给出的【最高形态】; 选过一次 → 之后每首都优先用它, 该作品没有才回落。
     * (导演自动流默认法: 不选不填→系统推荐; 用户干预→系统让位。) */
    @State private var visualMode: String = ""
    @State private var videoPixelHeight: Int = 0     // 解码器给的真值, 0 = 还没读到 → 不标清晰度
    private static let visualPrefKey = "cssos.visual.mode"
    /// W2243 — 确认键去抖时间戳(tap / longPress 两条路共用)。
    @State private var lastPillToggle: Date = .distantPast

    // W1329 — 连播队列(多部=各 part; 单曲=自己一首)+ 当前 part。
    private var parts: [CSSWork] { work.playbackParts }
    /// W2219 — 当前选中语言轨的 ♪N 列表。后端没给(老作品 / 出口挂了)→ 空数组 = 按单版处理,
    /// 行为与本波之前完全一致, 不会把任何作品打哑。
    private var currentTakes: [CSSBackend.CSSTake] {
        guard let sel = selectedTrackId,
              let tr = langTracks.first(where: { $0.id == sel }) else { return [] }
        return tr.takes
    }
    private var currentPart: CSSWork { parts[min(partIndex, max(parts.count - 1, 0))] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // W1319 — 强制 21:9 宽银幕框(满宽 × 宽/(21/9), 垂直居中, 上下电影黑边); 内容 fill 裁满。
            GeometryReader { geo in
                let boxH = geo.size.width / CSS_CINEMA_RATIO
                /* CSSOS_WAVE_2250 — 画面层按【多画面胶囊】选中的形态渲染。
                 * 语义照桌面 applyForm():
                 *   video  = 只有视频, 幻灯层撤掉
                 *   hybrid = 视频照放, 幻灯层【垫在底下】—— 视频有空档/放不出时画面不塌成黑屏
                 *   slides = 有渲染好的 mp4 就用它(那条 mp4 本身就是幻灯), 没有才实时放封面帧
                 * 【音频一概不动】—— 四轨分离铁律: 换画面不该影响声音, 换的只是这一层。 */
                ZStack {
                    let mode = chosenVisual
                    if mode != "video" {
                        SlideshowLayer(frames: currentPart.slideFrames,
                                       alignment: currentPart.coverAlignment)
                    }
                    // W1344 — 短视频播完即转封面/幻灯(videoEnded), 不再循环铺满。
                    if let vp = videoPlayer, !videoEnded {
                        VideoSurface(player: vp)
                    } else if mode == "video", let cover = currentPart.coverURL, let url = URL(string: cover) {
                        // 真视频形态下没有幻灯垫底 —— 视频不在时至少给封面, 别露黑屏。
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.black }
                    }
                }
                // W1526 — 封面裁剪锚人脸焦点(视频层无 focal, alignment 对视频无影响=居中铺满)。
                .frame(width: geo.size.width, height: boxH, alignment: currentPart.coverAlignment)
                .clipped()
                .position(x: geo.size.width / 2, y: geo.size.height / 2)

                /* CSSOS_WAVE_2231 20260927 — 取消静态绿色描边。
                 *
                 * Jing:「请取消媒体播放器的绿色边框, 让进度条来描绘就好了。」
                 *
                 * 原来这里是一圈【常亮】的 1.5px 绿边 + 28px 柔光(W1348 之前抄的桌面
                 * .panel-active)。它和下面那条【边框进度条】画在同一条线上 —— 两条描边
                 * 叠在一起, 进度走到哪里看不出来, 因为底下那圈本来就是满的。
                 * 现在这条线【只归进度条】: 亮到哪里 = 播到哪里, 边框本身就是进度。
                 *
                 * 【这不是 W1983 媒体框宪法那一圈】。那一条管的是网页端
                 * public/style.watch.css 的 .watch-screen::after(散发绿色光芒, 已锁),
                 * 与本文件无关, 一个字都没动。别把这两处混成一件事。
                 */

                // W1348 — 取消静态绿光; 改为【边框进度条】(一字照搬桌面 app.watch-stage-bars.js):
                //   沿 21:9 画框四周走一圈的描边, 长度 = 音频主时钟 currentTime/duration, 颜色 6 段流动 + 柔光。
                if let ap = audioPlayer {
                    BorderProgressBar(player: ap, width: geo.size.width, height: boxH)
                        .position(x: geo.size.width / 2, y: geo.size.height / 2)
                        .allowsHitTesting(false)
                }

                // W1551 — 首次点进 hydrate + 起播前会有一小段空窗: 之前只剩黑底 + "Untitled" 像坏掉。
                //   这里补一个绿色加载圈, 明确是"加载中"; 视频一就绪(videoPlayer 有值)立即消失。
                if videoPlayer == nil && !videoEnded {
                    ProgressView()
                        .scaleEffect(1.8)
                        .tint(Color(red: 0.0, green: 0.96, blue: 0.63))
                        .position(x: geo.size.width / 2, y: geo.size.height / 2)
                        .allowsHitTesting(false)
                }
            }
            .ignoresSafeArea()

            // W1526 — 防盗用/品牌: 左上固定 ♪ + 标题淡角标(照搬 [[antitheft_branding_watermark]] 品牌曝光)。
            //   常驻但极淡, 不抢戏; 播放中始终署名"这是 cssOS 作品"。
            VStack {
                HStack {
                    HStack(spacing: 8) {
                        Text("♪").font(.system(size: 26, weight: .heavy))
                            .foregroundStyle(Color(red: 0.0, green: 0.96, blue: 0.63).opacity(0.7))
                        Text(currentPart.title ?? "cssOS")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.55))
                            .lineLimit(1)
                    }
                    .shadow(color: .black.opacity(0.6), radius: 3)
                    .padding(.horizontal, 40).padding(.top, 30)
                    Spacer()
                }
                Spacer()
            }
            .allowsHitTesting(false)

            // W1247 — 大屏逐字情绪字幕(招牌): 音频主时钟驱动, 底部卡拉OK + 中央逐字爆。
            if let sub = subtitle, let ap = audioPlayer {
                EmotionSubtitleOverlay(lines: sub.lines, player: ap, themeEmoji: sub.themeEmoji, level: meter.level)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            // 标题浮层(几秒后淡出)。W1554 — Jing: 抬进【视频框内】下缘之上, 绝不落下方黑边
            //   (黑边留给传统字幕, 免打架)。渐变也只铺在框内下部, 不进黑边。
            if showTitle {
                GeometryReader { geo in
                    let boxH = geo.size.width / CSS_CINEMA_RATIO
                    let blackBar = max(0, (geo.size.height - boxH) / 2)   // 下方黑边高度
                    ZStack(alignment: .bottom) {
                        // 可读性渐变: 只在视频框下半部, 不进黑边。
                        VStack(spacing: 0) {
                            Spacer()
                            LinearGradient(colors: [.clear, .black.opacity(0.5)], startPoint: .top, endPoint: .bottom)
                                .frame(height: boxH * 0.5)
                        }
                        .padding(.bottom, blackBar)
                        // 标题 + 时长 + 1/3, 贴视频框内下缘(离黑边 36)。
                        HStack {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(currentPart.title ?? tr("Untitled"))
                                    .font(.system(size: 44, weight: .bold))
                                    .foregroundStyle(.white)
                                    .shadow(color: .black.opacity(0.7), radius: 4)
                                HStack(spacing: 12) {
                                    if !currentPart.durationLabel.isEmpty {
                                        Text(currentPart.durationLabel)
                                            .font(.system(size: 24, weight: .medium))
                                            .foregroundStyle(.white.opacity(0.75))
                                    }
                                    // W1329 — 多部连播分部指示(唯一的一个: 左下角 square.stack 已删)。
                                    if parts.count > 1 {
                                        Text("\(partIndex + 1) / \(parts.count)")
                                            .font(.system(size: 22, weight: .heavy))
                                            .foregroundStyle(.white)
                                            .padding(.horizontal, 10).padding(.vertical, 3)
                                            .background(Capsule().fill(Color.green.opacity(0.85)))
                                    }
                                    // W2219 — ♪N 徽章: 照分部徽章同一套样式(不另造), 只在真有多版时出现。
                                    //   没有它的话, 修好了连播用户也看不出来自己在听第几版。
                                    if currentTakes.count > 1 {
                                        Text("\u{266A}\(min(takeIndex, currentTakes.count - 1) + 1) / \(currentTakes.count)")
                                            .font(.system(size: 22, weight: .heavy))
                                            .foregroundStyle(.black)
                                            .padding(.horizontal, 10).padding(.vertical, 3)
                                            .background(Capsule().fill(Color(red: 0.0, green: 0.96, blue: 0.63)))
                                    }
                                }
                            }
                            .shadow(color: .black.opacity(0.6), radius: 3)
                            Spacer()
                        }
                        .padding(.horizontal, 64)
                        .padding(.bottom, blackBar + 36)
                    }
                }
                .ignoresSafeArea()
                .transition(.opacity)
                .allowsHitTesting(false)
            }

            /* CSSOS_WAVE_2243 20260927 — 确认键浮现【多胶囊条】(照电脑端那一条)。
             *
             * Jing:「我试了, 还没有显示, 应该像电脑端显示的多胶囊。」
             *
             * 【上一版为什么一按没反应】不是手势没接住, 是我自己加的闸门挡死了:
             *     .onTapGesture { if langTracks.count >= 2 { togglePills() } }
             * 《白鹤报恩》只有【一条】语言轨(ja) → count==1 → 按了什么也不发生。
             * 那个 `>= 2` 是从旧的"只放语言胶囊"时代留下的判据 —— 现在这条轨上还有
             * 声线 / ♪N / 画面, 一条语言轨的作品照样该能调, 闸门本身就是错的。
             *
             * 【模式头照搬电脑端那六个】(public/app.lang-flag-pills.js 的原话:
             *  "模式头(Settings/Fine-tune/Languages/Voices/Visuals/Takes)是一组固定的导航"),
             * 不自己另起一套顺序或命名。
             *
             * 位置仍守原铁律: 放在 21:9 画框【下边缘之下】那条黑边里, 不压画面、不进过扫描区。
             */
            if showPills {
                /* 版式照电脑端那一条: 【压在画面底部的半透明轨】, 不是塞进 21:9 的黑边。
                 * 第一版我按黑边算坐标, 结果面板中心落到 1027、132 高跨到 1093 —— 屏幕只有 1080,
                 * 下半截被切掉(实测截图里"日本語"那行只露出上沿)。根因是我写的
                 *     max(boxBottom + 20, min(boxBottom + 24, maxTop))
                 * 外层的 max 把过扫描上限 maxTop 直接盖掉了 —— 写了限位却没生效, 比没写更糟。
                 * 现在不算坐标了: 贴底 + 固定留白, 没有能算错的东西。 */
                /* 位置: 【紧贴 21:9 媒体框的下沿】。
                 *
                 * Jing:「取消 10px 靠边规则, 因这不是电脑端, 这是 TV 端, 改为紧贴媒体框下方。」
                 * 这其实是回到 W1370 原本那条位置铁律 —— 胶囊放在画框下边缘之下那条黑边里,
                 * 既不压画面, 又跟着画面走。10px 贴边是网页端的规则, 那里没有"画框下边缘"这回事。
                 *
                 * 【必须 ignoresSafeArea 才量得准】: 不穿过安全区, geo.size.height 会少掉
                 * tvOS 那 ~60pt 过扫描留白, 算出来的画框下沿就整体偏上。
                 * 用"上面垫一个 Spacer"来定位, 不用 .position —— 后者要先知道自己的高度,
                 * 而这条 bar 的高度随模式行有无而变, 猜高度正是上一版落错位的原因。 */
                GeometryReader { geo in
                  let boxBottom = geo.size.height / 2 + (geo.size.width / CSS_CINEMA_RATIO) / 2
                  VStack(spacing: 0) {
                    // CSSPillBar 自带约 7pt 透明上边 —— 抵掉它, 让【看得见的胶囊】贴住画框下沿。
                    Spacer().frame(height: max(0, boxBottom - 7))
                    VStack(spacing: 12) {
                        CSSPillBar(items: pillModes, selected: Binding(
                            get: { pillMode },
                            set: { m in
                                if m == pillMode {
                                    // 按的是【当前这个头】→ 收起 / 再展开子胶囊行
                                    pillRowOpen.toggle()
                                    pillModeTouched = pillRowOpen
                                } else {
                                    pillMode = m; pillRowOpen = true; pillModeTouched = true
                                }
                                schedulePillHide()
                            }
                        ), hug: true, autofocus: !pillModeTouched,
                           onChange: { _ in schedulePillHide() })
                        /* 【不要给它 .fixedSize】—— CSSPillBar 内部是 GeometryReader,
                         * GeometryReader 没有固有宽度, .fixedSize(horizontal:) 会把它压成 0。
                         * 实测就是这么塌的: 屏幕上只剩选项行那枚"日本語", 模式行变成它上面一条细缝。 */
                        .focusSection()

                        pillModeRow                                 // 当前模式下的可选项
                            .focusSection()
                    }
                    Spacer(minLength: 0)
                  }
                  .frame(width: geo.size.width, height: geo.size.height)
                }
                .ignoresSafeArea()
                .allowsHitTesting(true)
                .transition(.opacity)
            }

            /* W2244c — 方向键层。【只在胶囊收起时存在】, 展开时整层消失, 方向键归胶囊。
             * 放在 ZStack 最后 = 盖在画面之上, 但它是透明的、也不挡胶囊(胶囊在它之后渲染?
             * 不 —— 胶囊在它【之前】, 所以这里用 allowsHitTesting 只收键不挡点)。 */
            if !showPills {
              /* CSSOS_WAVE_2348 20261120 — 确认键【一次】就出胶囊。
               *
               * Jing:「那个必须按好几次才能呼出胶囊的按键问题解决了吗?让他每次按一次键
               *        就容易呼出。」—— W2310 改过一轮, 但那一轮【没能验证】(当时这台机器的
               * tvOS 模拟器起不来, 提交说明里写着"待真机确认"), 而它的修法本身留了个洞:
               *
               *     DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { stageFocused = true }
               *
               * 这是【猜一个延迟, 只写一次, 不看结果】。它自己的注释已经点明了风险 ——
               * "这一帧透明层还没进渲染树, 此刻写 @FocusState 等于写给一个不存在的视图,
               * 静默失效" —— 然后用 50ms 去赌那一帧过去了。真机起播要建 AVPlayerLayer、
               * 还要 hydrate 网络(playQueueItem 就在它前一行), 50ms 赌不赢的时候,
               * 那一次写静默丢掉, 【之后再没有人重试】。于是又变回"要按好几次"。
               *
               * 两件事一起改, 缺一不可:
               *   ① .defaultFocus —— 声明式初始焦点, 由 SwiftUI 在焦点系统就绪时自己施加,
               *      根本没有"早写一帧"这回事。这不是我新造的办法: 平台在
               *      ContentView.swift:939 已经栽过同一个坑并解决了 ——
               *      「W1523 深嵌 prefersDefaultFocus 失效 → 用 defaultFocus 钉死」。
               *   ② 这一层【自己的 onAppear】去抢焦点, 而且抢完【读回来核对】, 没到就重试。
               *      绑在 onAppear 上才是绑在"视图真的出现了"这件事上, 而不是绑在一个猜的毫秒数上。
               *
               * 教训(和 W2310 同一句): 一次性的定时写入, 在它赌输的时候【没有任何迹象】。
               * 要么做成声明式, 要么写完去读回来核对 —— 不要写完就当成功。 */
              ZStack {
                /* CSSOS_WAVE_2349 20261120 — 确认键改走 Button, 把那对手势整个拆掉。
                 *
                 * Jing 实测把 W2348 的诊断证伪了:「一次一次按【总是】不出来, 必须快速连按
                 * 两次/三次才出来。」—— 如果是焦点没到位, 第一次按会把焦点挪过来,
                 * 【第二次慢按就该成】。慢按永远不成、只有"快"管用 → 不是焦点, 是手势仲裁。
                 *
                 * 原来这一层同时挂着:
                 *     .onTapGesture { revealPills() }
                 *     .onLongPressGesture(minimumDuration: 0.01) { revealPills() }
                 * 同一个视图上 tap + longPress = UIKit 手势仲裁: tap 必须等 longPress
                 * 【失败】才能识别。而 longPress 带 maximumDistance —— 在 Siri Remote 的
                 * 触控板上【手指一动就算超距】。慢而用力地按, 手指在板面上挪得多 →
                 * longPress 判失败, 而 tap 早已被它压着 → 两条路一起落空, 屏幕上毫无反应。
                 * 快速连点接触短、几乎不挪 → 偶尔有一条能过。这正是 Jing 描述的形状。
                 *
                 * W2246 当时已经点破这对手势有毒(「为了保险接两条路本身制造了新的失败模式」),
                 * 但那一轮只把动作改成幂等 —— 【没有把危险本身拆掉】, 于是它换个形状又回来了。
                 *
                 * tvOS 上接「确认键」的标准原语是 Button: 它经焦点/按键系统直达,
                 * 没有手势仲裁这一层, 也没有 maximumDistance 这种会被手指挪动否掉的条件。
                 * Button 自带可聚焦, 所以 .focusable(true) 去掉(给 Button 再加一层反而会打架)。
                 * .buttonStyle(.plain) 是必须的 —— tvOS 默认的 .card 样式会给这层透明层
                 * 画出卡片背景和浮起效果。 */
                /* CSSOS_WAVE_2350 20261120 — 白色蒙层是上一条的连锁反应, 必须一起治。
                 *
                 * Jing:「现在一按键就呼出胶囊了, 但不呼出胶囊的时候, 画面被一层白色层遮住了。」
                 *
                 * 根因: tvOS 会给【获得焦点的 Button】画焦点高亮。而这个 Button 的 label 是
                 * 【铺满全屏的透明层】, 加上 W2348 特意保证它一直拿着焦点 —— 于是那层高亮
                 * 也铺满全屏, 看起来就是"画面蒙了一层白"。
                 *
                 * .buttonStyle(.plain) 去掉的只是【卡片背景】, 不是【焦点效果】—— 这是两件事,
                 * 我上一轮把它们当成了一件。两道一起关:
                 *   ① 自定义 ButtonStyle: makeBody 原样返回 label, 不叠任何装饰
                 *      (.plain 在 tvOS 上仍会按下时改透明度)。
                 *   ② .focusEffectDisabled() —— tvOS 17 起专门用来关系统焦点效果的 API,
                 *      只关【观感】, 不动焦点本身(焦点仍然要在, 否则确认键又收不到)。 */
                Button(action: { revealPills() }) {
                    Color.black.opacity(0.0001)
                        .contentShape(Rectangle())   // 整层都可按, 不只不透明像素
                }
                    .buttonStyle(StageTapButtonStyle())
                    .focusEffectDisabled()
                    .focused($stageFocused)
                    .onMoveCommand { dir in
                        switch dir {
                        case .left:  seekBy(-10)
                        case .right: seekBy(10)
                        case .up:    gotoPrev()
                        case .down:  gotoNext()
                        @unknown default: break
                        }
                    }
                    /* CSSOS_WAVE_2246 — 确认键【只负责打开, 永远不负责关闭】。
                     *
                     * Jing:「还不大灵敏, 一般要按几次才显示多胶囊, 应该按一次就要显示。
                     *        用户不会知道需要按几次的, 用户只知道按一次而已。」
                     *
                     * 是我那个"两条路都接"的设计在反噬: tap 与 longPress 若相隔【超过 350ms】
                     * (按下触发一个、松手触发另一个), 去抖拦不住 → toggle 两次 = 开了又关,
                     * 看起来就是"按了没反应", 于是用户得再按一次。
                     * 把去抖调长只是掩盖, 而且会压掉真正的连按。
                     *
                     * 真正的修法是让这个动作【幂等】: 按确认键 = 打开。开了再触发一次还是开着,
                     * 双触发就此无害。关闭交给 Menu 键和 10 秒自动收起 —— 而且这一层
                     * 在胶囊展开时根本不渲染(W2244c), 确认键那时归胶囊, 不会打架。
                     *
                     * 教训: "为了保险接两条路"本身制造了新的失败模式。保险要做成【幂等】,
                     * 不能做成【互相抵消】。
                     *
                     * ⚠ W2349 补完这条教训: 做成幂等【只挡住了"开了又关"】, 没挡住
                     * 【两条路一起落空】。两条路本身才是病根, 幂等只是让它换了个形状复发。
                     *   「为了保险多接一条路」→ 正确的做法不是给它加保险, 是【只留一条对的路】。
                     * 那两行 .onTapGesture / .onLongPressGesture 已删, 由上面的 Button 取代。
                     * revealPills() 仍然保持幂等 —— 那条性质本身是对的, 留着不花钱。 */
                    .ignoresSafeArea()
              }
              .defaultFocus($stageFocused, true)
              .ignoresSafeArea()
              /* 胶囊收起后这一层会重新出现 —— 那时也要把焦点抢回来, 否则下一次确认键
               * 又得先挪焦点。所以挂在这一层的 onAppear 上, 它【每次出现都跑】。 */
              .onAppear { claimStageFocus() }
            }

            // W1553 — 删掉左下角的「选枝胶囊(square.stack 1 2 3)」: 与标题栏里的「1 / 3」徽章重复。
            //   只保留标题栏的 1/3(见上, 与时长同排)。切枝仍靠 ↑↓ 遥控(见下 onMoveCommand)。
        }
        .onAppear(perform: start)
        .onDisappear(perform: stop)
        /* CSSOS_WAVE_2244c — 方向键的归属【按状态切换整个修饰器, 不是加条件】。
         *
         * 探针实测(前两版都猜错, 这次量的):
         *     [probe] showPills → true  stageFocused=true
         *     [probe] PillBar autofocus 写入 focused=lang
         *     [probe] PillBar 焦点落到 lang        ← 焦点【本来就已经在胶囊上了】
         * 所以焦点从来不是问题。真凶是 `.onMoveCommand` 挂在【根 ZStack】上 ——
         * 它是胶囊条的祖先, 方向键在整棵子树上都被它先截走, 焦点引擎根本没机会
         * 在胶囊之间移动。`.focusable(false)` 治不了它: onMoveCommand 不看焦点在不在自己身上。
         * 在闭包里 `guard !showPills else { return }` 也不行 —— 闭包跑过就算消费掉了。
         *
         * 只能让这个修饰器在胶囊展开时【根本不存在】: 把 focusable / onMoveCommand /
         * 确认键手势整体搬到一层【只在胶囊收起时才渲染】的透明层上。
         * 胶囊一展开, 这一层连同它的 onMoveCommand 一起从视图树里消失, 方向键自然归胶囊。
         *
         * (教训: 前两次都是"改一个属性 + 祈祷"; 这次先打点量出焦点其实早就对了,
         *  才找到真凶在修饰器的作用域上。量一次胜过猜三次。) */
        .onExitCommand { if showPills { hidePills() } else { dismiss() } }
        .animation(.easeOut(duration: 0.22), value: showPills)
    }

    // MARK: - W2231 胶囊浮现 / 收起

    private func togglePills() {
        // 同一次按键可能从 tap / longPress 两条路各来一次 —— 350ms 内只认头一次。
        let now = Date()
        guard now.timeIntervalSince(lastPillToggle) > 0.35 else { return }
        lastPillToggle = now
        if showPills { hidePills() } else { revealPills() }
    }

    private func revealPills() {
        // 幂等: 已经开着就只把自动收起的计时重置, 不做任何切换(见上面 W2246 的注释)。
        if showPills { schedulePillHide(); return }
        /* W2349 探针: 看到这行 = 确认键【确实走到了】。若 Jing 按了一次而日志里没有它,
         * 说明按键根本没送达(焦点/按键层), 而不是后面的展开逻辑有问题 —— 两者的修法
         * 完全不同, 分清楚才不会再修错一轮。 */
        print("[probe][w2349] 确认键送达 → 展开胶囊")
        showPills = true
        /* 焦点【必须晚一拍再给】: 这一帧胶囊按钮还没进入渲染树, 此刻写 focusedPill
         * 等于写给一个不存在的视图, 静默失效 —— 表现就是"浮现了但方向键动不了"。 */
        /* W2244 — 焦点交给【模式行】(CSSPillBar autofocus), 不再自己去点选项行。
         *
         * 原来这里写 focusedPill = selectedTrackId —— 那是【选项行】的 id。
         * 而单语言作品的选项行根本不渲染(W2243b), 于是焦点落在一个不存在的视图上、
         * 静默失效, 焦点留在舞台 → ←/→ 继续快进, 正是 Jing 说的"方向键还在媒体框上"。
         * 模式行是永远都在的那一行, 焦点该落在它身上。 */
        schedulePillHide()
    }

    private func hidePills() {
        pillModeTouched = false     // W2247 — 下次浮现, 焦点重新从模式行开始
        pillRowOpen = true          // W2248 — 收起整条后复位, 下次展开子胶囊行仍然是开的
        pillHideToken &+= 1        // 作废在途的自动收起, 免得它把刚浮现的又关掉
        showPills = false
        // 焦点还给舞台, 否则 ←/→ ↑/↓ 全部失灵(SwiftUI 不会自己还)。
        claimStageFocus()
    }

    /* CSSOS_WAVE_2348 — 抢舞台层焦点, 【写完读回来核对】, 没到就重试。
     *
     * 为什么不能"写一次就算":  @FocusState 的写入是一个【请求】。如果那一帧目标视图
     * 还没进焦点系统, 这个请求被静默丢弃 —— 没有返回值、没有报错、没有任何迹象。
     * W2310 就是写一次(延迟 50ms)然后当成功, 赌输的时候表现正是 Jing 说的"要按好几次"。
     *
     * 这里 stageFocused 是可以【读】的 —— 真焦点落上去它就是 true。所以这件事
     * 本来就可以核对, 不必猜。tries 封顶, 免得胶囊展开 / 退出播放器后还在空转。 */
    private func claimStageFocus(_ tries: Int = 6) {
        guard !showPills else { return }   // 胶囊展开时焦点归胶囊, 不许来抢
        if stageFocused {
            // 到位了。第 6 次=第一发就中(.defaultFocus 自己搞定了), 更小的数说明重试救了场。
            if tries < 6 { print("[probe][w2348] 舞台焦点到位, 用了 \(7 - tries) 次") }
            return                         // 这就是"核对", 不是假设
        }
        stageFocused = true
        guard tries > 1 else {
            /* 探针: 走到这里 = 两道闸都没拿到焦点, 确认键还会要按好几次。
             * 留这一行是为了让下一轮排查【有话可说】—— W2310 的修法赌输时没有任何迹象,
             * 于是这个 bug 又活了一周。看到这行就不用再猜 .defaultFocus 有没有生效。 */
            print("[probe][w2348] ⚠ 舞台焦点 6 次都没拿到 —— 确认键仍需多按, 焦点被谁占了?")
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { claimStageFocus(tries - 1) }
    }

    /// 无操作自动收起。token 比对 = 每次操作都把上一个计时作废(去抖)。
    /// 10 秒是平台默认闲置时长(Jing:「没有刻意要求的, 默认都是 10 秒」), 不要自己另定。
    private func schedulePillHide() {
        pillHideToken &+= 1
        let mine = pillHideToken
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
            guard mine == pillHideToken, showPills else { return }
            hidePills()
        }
    }

    // W1526 — 遥控器快退/快进(音频=主时钟, 视频跟随一起 seek)。
    private func seekBy(_ delta: Double) {
        guard let ap = audioPlayer else { return }
        let cur = ap.currentTime().seconds
        let dur = ap.currentItem?.duration.seconds ?? 0
        guard dur > 0, cur.isFinite else { return }
        let t = max(0, min(dur - 0.5, cur + delta))
        let ct = CMTime(seconds: t, preferredTimescale: 600)
        ap.seek(to: ct, toleranceBefore: .zero, toleranceAfter: .zero)
        videoPlayer?.seek(to: ct, toleranceBefore: .zero, toleranceAfter: .zero)
        withAnimation { showTitle = true }   // 短暂亮出标题/进度反馈
    }
    /* CSSOS_WAVE_2328 20261115 — 「生成就播放」要对【单曲到电影】都成立, 第一道坎在这里。
     *
     * parts 来自 work.playbackParts, 而 playbackParts 只取【已经有可播媒体】的子部,
     * 并且 work 在 hydrate 那一刻就定死了。于是一部【还在生成中】的多部作品被打开时,
     * parts.count 可能只有 1 —— 第一部播完, 这一行就走 else 跳到【队列里的下一个作品】,
     * 第二、三部永远不播了。
     *
     * 那正是播放顺序铁律明令禁止的事:「三部曲是一个整体, 不允许播放第一部之后乱插入
     * 别的歌曲, 必须 1,2,3 连播」。所以在跳走之前【必须先回头问一次服务端】:
     * 新的部出来了没有? 出来了就接着播本作品, 没有才允许离开。
     *
     * 为什么装在这里: 这是"翻页"的必经之路(gotoNext 与播完自动接续都走它)——
     * 平台已经吃过一次教训:闸门装在 setActive() 里等于没装, 要装在每次翻页必经的那一处。
     *
     * 代价是多部作品播到最后一部时多一次 HTTP(只在 parts 用尽那一刻, 不是每首)。
     * 生成速度本来就快于播放速度(一首约 40s 出, 一首歌放 3 分钟), 所以几乎总能接上。 */
    private func gotoNext() {
        if partIndex + 1 < parts.count { loadPart(partIndex + 1); return }
        guard work.isMultiPart, !work.id.isEmpty else { playQueueItem(queueIndex + 1); return }
        let known = parts.count
        let wid = work.id
        Task {
            let fresh = await CSSBackend.fetchWorkById(wid)
            await MainActor.run {
                guard work.id == wid else { return }     // 期间用户已经切走 → 放弃
                let old = parts.map { $0.id }
                guard let f = fresh else { playQueueItem(queueIndex + 1); return }
                let new = f.playbackParts
                /* 必须是【前缀一致】才认。
                 * playbackParts 只收【已经有可播媒体】的子部, 所以万一第二部还没好、
                 * 第三部先好了, 新列表会是 [一, 三] —— 这时按下标取 known 拿到的是第三部,
                 * 等于【跳过第二部】, 那同样违反 1,2,3 连播的铁律。
                 * 引擎本来是按 sequence_index 串行生成的(不并发), 正常不会出现这种空洞;
                 * 但"正常不会"不能当保证 —— 前缀不一致就宁可不接, 按老行为走队列。 */
                let isPrefix = new.count > known && Array(new.prefix(known)).map { $0.id } == old
                if isPrefix {
                    work = f                              // 新的部真出来了, 且顺序没有空洞 → 接着播
                    loadPart(known)
                } else {
                    playQueueItem(queueIndex + 1)         // 真的没有下一部(或顺序有洞), 才离开
                }
            }
        }
    }
    private func gotoPrev() {
        let cur = audioPlayer?.currentTime().seconds ?? 0
        if cur > 3 { audioPlayer?.seek(to: .zero); videoPlayer?.seek(to: .zero); return }
        if partIndex > 0 { loadPart(partIndex - 1) } else { playQueueItem(queueIndex - 1) }
    }

    private func start() {
        // W1266 — 播放时禁屏保(自绘 AVPlayerLayer 不会自动阻止屏保, 否则赏 MV 中途黑屏跳屏保)。
        UIApplication.shared.isIdleTimerDisabled = true
        // 音频会话: 让声音从电视外放。
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
        playQueueItem(queueIndex)   // W1523 — hydrate 起始作品并起播; 播完自动接队列下一个(循环)
        /* CSSOS_WAVE_2310 — 一进播放器就把焦点交给舞台层, 否则确认键要按好几次才出胶囊。
         *
         * Jing:「cssTV 端, 总是需要按好几次确认键, 才能调出"多语言/多字幕/多画面/多音轨"胶囊,
         *        能不能改进一下, 按确认键一次就可以调出?」
         *
         * 根因【不在去抖、也不在幂等】—— W2246 已经把 revealPills() 做成幂等的了, 那一轮
         * 修的是"开了又关"。这次剩下的是另一半: `stageFocused` 从头到尾【只在 hidePills()
         * 里被写过 true】, 进播放器时没有任何人给那层透明层焦点。
         * 而 tvOS 的 .onTapGesture / .onLongPressGesture 是【焦点驱动】的 —— 视图没拿到焦点,
         * 确认键根本不会走到闭包里。于是头几次按键被焦点引擎用来"把焦点挪过来",
         * 挪到了才开始生效。表现就是"要按好几次", 且时快时慢(取决于焦点当时落在哪)。
         *
         * 这也解释了为什么【第二次之后就正常】: hidePills() 那句 stageFocused = true
         * 把焦点还回来了, 所以只有"刚进播放器的第一次"难按 —— 和 Jing 说的"总是"吻合
         * (每开一部作品就是一次全新的第一次)。
         *
         * 晚一拍再给: 这一帧透明层还没进渲染树, 此刻写 @FocusState 等于写给一个不存在的
         * 视图, 静默失效 —— 与 revealPills() 里那条注释同一个坑。
         *
         * ⚠ CSSOS_WAVE_2348 20261120 — 上面这段诊断是对的, 但那个修法【赌了一个毫秒数】:
         * 延迟 50ms 写一次, 写完就当成功。playQueueItem() 就在它前一行(建 AVPlayerLayer
         * + hydrate 网络), 真机上 50ms 常常不够, 那一次写就静默丢了, 而且【没有人重试】——
         * 于是又变回"要按好几次", 这正是 Jing 2026-11-20 再次报回来的现象。
         *
         * 现在改成两道:(a) 那一层自己带 .defaultFocus(声明式, 不赌帧);
         *              (b) 它自己的 onAppear 调 claimStageFocus(), 写完读回来核对、没到就重试。
         * start() 这里不再需要写焦点 —— 焦点该绑在"那一层真的出现了"上, 不是绑在
         * "播放开始后 50 毫秒"上。 */
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
        takeIndex = 0        // W2219 — 新枝丫: ♪ 从头数起
        partIndex = idx
        let part = parts[min(idx, max(parts.count - 1, 0))]

        if let v = part.bestVideo, let vurl = URL(string: v) {   // W1329 — 兜底 preview 列
            let p = AVPlayer(url: vurl)
            // W1470 — 只在【有独立音轨】时静音视频(音乐 MV 画音分层); 叙事预告声音烧在视频里
            //   (有声有画, 无独立 audioURL)→ 不静音, 用视频自带声。
            p.isMuted = (part.bestAudio != nil)
            p.actionAtItemEnd = .none
            videoPlayer = p
            readVideoResolution()      // W2250 — 清晰度只信解码器, 起播后读一次
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

    // MARK: - W2243 多胶囊条

    /* 模式头 —— 顺序与命名照电脑端那一组固定导航, 不自己另起。
     * 【只列 TV 端真接得上料的】: Languages / Voices / Takes 背后都有实数据,
     * 按下去真的会换轨换版本。Settings / Fine-tune / Visuals 在 TV 端【还没有控件】——
     * 与其摆两枚按下去什么也不发生的胶囊(那比不摆更糟, 用户会以为坏了), 不如先不摆,
     * 等它们在 TV 上真有东西可调时再加回来。这一条我会明确告诉 Jing, 不当作"做完了"。 */
    private var pillModes: [CSSPillItem] {
        [
            CSSPillItem(id: "settings", label: tr("Settings"),  icon: "gearshape"),
            CSSPillItem(id: "tune",     label: tr("Fine-tune"), icon: "slider.horizontal.3"),
            CSSPillItem(id: "lang",     label: tr("Languages"), icon: "globe"),
            CSSPillItem(id: "voice",    label: tr("Voices"),    icon: "waveform"),
            CSSPillItem(id: "visual",   label: tr("Visuals"),   icon: "photo.on.rectangle"),
            CSSPillItem(id: "take",     label: tr("Takes"),     icon: "music.note.list"),
        ]
    }

    // MARK: - W2250 多画面(Visuals)

    struct VisualForm: Identifiable {
        let key: String          // video / hybrid / slides
        let label: String
        let spec: String         // 清晰度 或 "N img"
        let icon: String
        var id: String { key }
    }

    /* 当前作品【真实可用】的画面形态。判据来自后端 visual_kind —— 绝不用"有没有 mp4"猜
     * (桌面原话: 平台很多 mp4 是我们自己用封面拼的幻灯片视频, 按有 mp4 标真视频就是在撒谎)。
     * 后端没给 kind 一律按幻灯处理: 宁可少标, 绝不错标。 */
    private var visualForms: [VisualForm] {
        let w = currentPart
        let kind = (w.visualKind ?? "").lowercased()
        let slides = w.slideFrames
        let n = max(w.visualFrames ?? slides.count, 1)
        let res = resolutionLabel
        switch kind {
        case "video":
            return [VisualForm(key: "video", label: tr("Real video"), spec: res, icon: "film")]
        case "hybrid":
            return [VisualForm(key: "hybrid", label: tr("Hybrid video"), spec: res, icon: "film.stack"),
                    VisualForm(key: "slides", label: tr("Slideshow"), spec: tr("{n} img", ["n": "\(n)"]), icon: "photo.on.rectangle")]
        default:
            return [VisualForm(key: "slides", label: tr("Slideshow"), spec: tr("{n} img", ["n": "\(n)"]), icon: "photo.on.rectangle")]
        }
    }

    /* 清晰度【只信解码器】。后端的 frame_width/height 实测大面积为空, 拿不到。
     * 竖屏作品按【短边】算, 否则 1080x1920 会被误标成 4K。读不到就返回空 → 不标。 */
    private var resolutionLabel: String {
        let h = videoPixelHeight
        guard h > 0 else { return "" }
        if h >= 4320 { return "8K" }
        if h >= 2160 { return "4K" }
        if h >= 1440 { return "1440P" }
        if h >= 1080 { return "1080P" }
        if h >= 720  { return "720P" }
        if h >= 480  { return "480P" }
        return "\(h)P"
    }

    /// 选中哪一种: 用户选过的优先, 否则最高形态(列表第一个 = 最新生成的那一层)。
    private var chosenVisual: String {
        let list = visualForms
        if !visualMode.isEmpty, list.contains(where: { $0.key == visualMode }) { return visualMode }
        let pref = UserDefaults.standard.string(forKey: Self.visualPrefKey) ?? ""
        if !pref.isEmpty, list.contains(where: { $0.key == pref }) { return pref }
        return list.first?.key ?? ""
    }

    private var visualPillItems: [CSSPillItem] {
        visualForms.map {
            CSSPillItem(id: $0.key,
                        label: $0.spec.isEmpty ? $0.label : "\($0.label) · \($0.spec)",
                        icon: $0.icon)
        }
    }

    private func pickVisual(_ key: String) {
        visualMode = key
        UserDefaults.standard.set(key, forKey: Self.visualPrefKey)   // 跨作品记住
        schedulePillHide()
    }

    /* 读解码器的真实像素高。AVPlayer 的轨道要异步载, 所以在起播后调一次。
     * 拿不到就保持 0 —— 对应"不标清晰度", 而不是标一个猜的值。 */
    private func readVideoResolution() {
        guard let item = videoPlayer?.currentItem else { videoPixelHeight = 0; return }
        Task {
            guard let track = try? await item.asset.loadTracks(withMediaType: .video).first,
                  let size = try? await track.load(.naturalSize) else { return }
            let h = Int(min(abs(size.width), abs(size.height)).rounded())
            await MainActor.run { videoPixelHeight = h }
        }
    }

    /// 当前语言下的全部声线(多声线胶囊的料)。
    private var voicesOfCurrentLang: [CSSBackend.CSSLangTrack] {
        let l = langTracks.first(where: { $0.id == selectedTrackId })?.lang
            ?? langTracks.first?.lang ?? ""
        return langTracks.filter { $0.lang == l }
    }

    /// 当前语言(按 lang 去重, 每种语言取默认/第一条轨代表)。
    private var languageHeads: [CSSBackend.CSSLangTrack] {
        var seen = Set<String>(); var out: [CSSBackend.CSSLangTrack] = []
        for t in langTracks where !seen.contains(t.lang) {
            seen.insert(t.lang)
            out.append(langTracks.first(where: { $0.lang == t.lang && $0.isDefault }) ?? t)
        }
        return out
    }

    /// 选中模式下那一行可选项。与模式行【同一个 CSSPillBar】, 不另造一套胶囊样式。
    @ViewBuilder
    private var pillModeRow: some View {
        /* CSSOS_WAVE_2243b — 【只有真的有得选才出这一行】。
         *
         * Jing:「删掉旧版(日本语)。」—— 他看到的那枚孤零零的"日本語"其实是新版的选项行,
         * 但《白鹤报恩》只有一种语言, 那一枚按下去也是它自己, 摆着纯属噪音, 还把胶囊条撑高一截。
         * 只有一个选项 = 没有选择 = 不该占一行。Takes 有 ♪1–♪6, 那一行才是真的多胶囊。 */
        switch pillMode {
        case "voice":
            if pillRowOpen && voicePillItems.count > 1 {
                itemPillBar(voicePillItems, selected: selectedTrackId ?? "") { id in
                    if let t = voicesOfCurrentLang.first(where: { $0.id == id }) { switchTrack(t); hidePills() }
                }
            }
        case "take":
            if pillRowOpen && takePillItems.count > 1 {
                itemPillBar(takePillItems, selected: "take-\(min(takeIndex, max(currentTakes.count - 1, 0)))") { id in
                    if let k = Int(id.replacingOccurrences(of: "take-", with: "")) { playTake(k); hidePills() }
                }
            }
        case "visual":
            /* 【这一行即使只有一枚也显示】—— 与 Languages/Voices 不同, 这枚胶囊本身带信息
             * (是幻灯还是真视频、几张 / 什么清晰度), 不只是"可选项"。桌面端也是这样。 */
            if pillRowOpen && !visualPillItems.isEmpty {
                itemPillBar(visualPillItems, selected: chosenVisual) { key in pickVisual(key) }
            }
        case "settings", "tune":
            /* 【实话实说】这三格在 TV 端还没有控件 —— 桌面上它们各自连着一整套面板
             * (设置 / 情绪字幕微调 / 多画面切换), 那些不是一行胶囊能搬过来的。
             * 与其摆几枚按下去什么也不发生的胶囊(那比不摆更糟: 用户会以为坏了),
             * 不如把话说清楚。哪一格 Jing 要先做, 我就先做哪一格。 */
            /* CSSOS_WAVE_2249 — 文案去掉网址。
             * 原文是 "Not on TV yet — available on cssstudio.app" —— 它在【引导用户离开 App 去网站】。
             * 虽然不涉及购买, 但正在送审, 审核员看到这种指向站外的句子容易多想, 而这句话的
             * 全部作用只是"这一格 TV 上还没有" —— 网址并不增加任何信息。去掉, 风险归零。 */
            if pillRowOpen { pillNote(tr("Not available on TV")) }
        default:
            if pillRowOpen && languagePillItems.count > 1 {
                itemPillBar(languagePillItems, selected: selectedTrackId ?? "") { id in
                    if let t = languageHeads.first(where: { $0.id == id }) { switchTrack(t); hidePills() }
                }
            }
        }
    }

    @ViewBuilder
    private func pillNote(_ t: String) -> some View {
        Text(t)
            .font(.system(size: 20))
            .foregroundStyle(.white.opacity(0.45))
            .frame(height: 50)
    }

    /* CSSOS_WAVE_2245 — 选项行【直接用 CSSPillBar】, 不再手写一套。
     *
     * Jing:「切换前的那个白色胶囊, 类似电脑端的 hover, 太大了, 大过了常规的胶囊尺寸,
     *        而且按照电脑端, 这个 hover 应该是随机色的。」
     *
     * 病根是我违反了「不许重复造轮子」: 模式行用的是 CSSPillBar(自定义 FlatButtonStyle,
     * 压掉了系统焦点样式, 并按 CSSOS_PILL_HUES 给每枚自己的色相), 而 ♪ 这一行是我
     * 【另外手写的一套】, 用了 .buttonStyle(.plain) —— tvOS 于是把【系统默认焦点效果】
     * 套上来: 白底 + 整枚放大, 比常规胶囊大一圈, 而且没有随机色。
     * 两行本该是同一个东西, 却有两份实现, 差异必然从这种地方漏出来。
     *
     * 改成同一个组件之后, 焦点观感、尺寸、随机色、凸嵌凹咬合全部自动一致 —— 不用我再对齐一遍。
     */
    private var languagePillItems: [CSSPillItem] {
        languageHeads.map { CSSPillItem(id: $0.id, label: $0.label, icon: "globe") }
    }
    private var voicePillItems: [CSSPillItem] {
        voicesOfCurrentLang.map { CSSPillItem(id: $0.id, label: $0.voiceLabel, icon: "waveform") }
    }
    private var takePillItems: [CSSPillItem] {
        currentTakes.enumerated().map { (i, tk) in
            CSSPillItem(id: "take-\(i)",
                        label: tk.label.isEmpty ? "\u{266A}\(i + 1)" : tk.label,
                        icon: "music.note")
        }
    }

    /* CSSOS_WAVE_2247 — 选中模式后, 焦点自动下到第二行。
     *
     * Jing:「选中 take 之后, 焦点应该自动移动到第二行的子胶囊。」
     *
     * 两个细节, 少一个就不对:
     *  ① autofocus 只在【用户主动点了模式头】之后才开 —— 刚浮现那一下焦点该在模式行
     *     (不然多语言作品一展开就直接跳到第二行, 用户还没选模式呢)。用 pillModeTouched 区分。
     *  ② 必须带 .id(pillMode): CSSPillBar 的 autofocus 挂在 onAppear 上, 而模式之间切换时
     *     这一行的视图身份不变 → onAppear 不会再触发 → 从 Takes 换到 Voices 时焦点就不动了。
     *     给它一个随模式变化的身份, 每换一次模式就是一次全新出现。 */
    @ViewBuilder
    private func itemPillBar(_ items: [CSSPillItem], selected: String,
                             onPick: @escaping (String) -> Void) -> some View {
        CSSPillBar(items: items, selected: Binding(
            get: { selected },
            set: { v in onPick(v) }
        ), hug: true, autofocus: pillModeTouched, onChange: { _ in schedulePillHide() })
        .id(pillMode)
    }

    // W1364 — 切换语言×声线: 只换音频(主时钟)+ 字幕, 视频画面不动(画音分层铁律)。
    //   重挂音频轨从 0 起, 重新接 meter/时钟/结束观察者; 字幕按该轨语言重拉。
    private func switchTrack(_ track: CSSBackend.CSSLangTrack) {
        guard track.id != selectedTrackId, let aurl = URL(string: track.audioURL) else { return }
        selectedTrackId = track.id
        // W2219 — 换了语言/声线就是换了一条轨, ♪ 从头数起(每条轨有自己的 ♪N)。
        takeIndex = 0
        // 挂载逻辑与 playTake 共用一份(W2219 提出的 attachAudio), 不再在这里各写一遍。
        attachAudio(aurl)
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
        // W2219 — 原来这里是 `p.play()`(p = 本函数里自己建的那个 AVPlayer)。挂载逻辑提进
        // attachAudio 之后 p 已不在本作用域, 改用 audioPlayer —— 它就是 attachAudio 刚挂上的
        // 同一个实例, 语义不变。(真编译抓到的; swiftc -parse 没报。)
        audioPlayer?.play()
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
        /* CSSOS_WAVE_2219 20260926 — 推进顺序多了【最里面的一层】: ♪N。
         *
         *   ♪1 → ♪2 → … → ♪N  →  下一分部  →  队列下一首
         *
         * 这一层此前根本不存在, 所以《白鹤报恩》放完 ♪1 就跳下一首 —— 后端从 W2116 起
         * 每条轨都带 takes, 只是 TV 没解(见 CSSBackend.swift 的 LangTracksFull.T.takes)。
         *
         * 宪法依据(W2107 播放顺序铁律):「每一首歌的 ♪1/♪2 是连胞胎, 不可分割; 三部曲也是
         * 一个整体, 必须 1,2,3 这样连播。」两层绑定都在这一个函数里, 顺序不能颠倒 ——
         * 先走完 ♪, 再走分部, 最后才翻页到下一首。
         *
         * W1329/W1523 原有两层一字未动。 */
        if takeIndex + 1 < currentTakes.count {
            playTake(takeIndex + 1)
        } else if partIndex + 1 < parts.count {
            loadPart(partIndex + 1)
        } else {
            playQueueItem(queueIndex + 1)
        }
    }

    /* W2219 — 切到本轨的第 k 个 ♪。只换音频(主时钟)与字幕, 视频画面不动 ——
     * 与 switchTrack 同一套「画音分层」规矩, 所以两边共用下面的 attachAudio,
     * 不各写一份挂载逻辑(两份迟早会走样)。 */
    private func playTake(_ k: Int) {
        let list = currentTakes
        guard k >= 0, k < list.count, let aurl = URL(string: list[k].url) else { return }
        takeIndex = k
        attachAudio(aurl)
        videoEnded = false
        videoPlayer?.seek(to: .zero)
        audioPlayer?.play()
        videoPlayer?.play()
        // 这一版有自己的字幕就用自己的, 没有则保持作品级(W2175 同语义)。
        if let su = list[k].subtitleURL, !su.isEmpty {
            let lang = langTracks.first(where: { $0.id == selectedTrackId })?.lang ?? "orig"
            subtitle = nil
            Task {
                let sd = await CSSBackend.fetchSubtitle(jsonURL: su, lang: lang)
                await MainActor.run { if takeIndex == k { subtitle = sd } }
            }
        }
        withAnimation { showTitle = true }   // 让观众看见换了 ♪
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            withAnimation(.easeOut(duration: 0.6)) { showTitle = false }
        }
    }

    /* W2219 — 挂一条音频轨(拆旧观察者 → 建 player → 接 meter/时钟/结束观察者)。
     * 从 switchTrack 里原样提出来的同一段, 现在 playTake 也用它。 */
    private func attachAudio(_ aurl: URL) {
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
///  · 沿 21:9 画框四周走一圈的圆角矩形描边, trim 长度 = 音频主时钟 currentTime/duration(0→1 绕一圈)。
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
        // W2310 — 原来这里还有 cp / burstOp 两个量, 专门给【背景 emoji 的瞬时淡出】用。
        // 背景 emoji 现在跟字同寿(走 charOp), 这两个量没有别的用处, 一并删掉, 免得留个
        // 看起来还在管事、其实没人读的相位(下一个人会以为背景 emoji 仍是瞬时的)。
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
            /* CSSOS_WAVE_2310 — 背景大 emoji 与爆大字是【同一个单位】: 一起生、一起停留到行尾、
             * 一起淡出。照桌面端来(Jing:「请参照桌面端的情绪字幕」)。
             *
             * 桌面端的结构是硬证据, 不是我的解读: cssosEmotionCenterBurst 把 emoji 背景与大字
             * 前景放进【同一个 grp】做兄弟节点, 注释写明「组合容器: emoji 背景 + 大字前景,
             * 共用同一缩放/淡出节奏」(app.emotion-fx.js:227), 而每字背景那一段更是直说
             * 「比字大、半透明、【随字驻留(不消失)】, 衬在字后」(同文件 :469)。
             * grp 整体被压进 _lineStage.els, 整句淡出时才一起移除。
             *
             * 原来这里 emoji 挂的是 burst 相位 p<1(= burstDur 2.4s), 而字挂的是 charOp
             * (停留到 lineEnd 再整行淡出, W1335)。两条寿命不同 → 2.4s 后屏幕上只剩字、
             * 背景没了, 正是 Jing 看到的「缺少字幕爆出来时的背景 emoji」。
             *
             * W1336 当初把它做成瞬时是为了【省内存】(爆完即移出视图树)。那个顾虑仍然成立,
             * 所以这里不是改成常驻, 而是改成【跟字同寿】: charOp 归零时它同样从视图树消失,
             * 多出来的存活视图上限 = 当前行的字数(activeBurstTokens 本来就只收这一行), 不会累积。 */
            if charOp > 0.01 {
                Text(emoji)
                    .font(.system(size: bgSize))
                    .opacity(charOp * 0.30)
                    .scaleEffect(scale)
            }
            // 字心烟花【仍是一次性的】: 桌面端 _fireworkAt 同样是爆入→扩散→淡出, 不驻留。
            // 爆完即移出视图树(W1336 的省内存考虑, 这一半不动)。
            if p < 1.0 {
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


/* ─────────────────────────────────────────────────────────────────────────────
 * CSSOS_WAVE_2250 20260927 — 幻灯层(多画面胶囊的「幻灯」形态)。
 *
 * 为什么 TV 上非要有这一层: 桌面端切到「幻灯」时, 若作品没有渲染好的 mp4, 由幻灯模块
 * 实时把封面帧放出来。TV 端原来只会显示【一张】封面 —— 切过去等于看一张静图,
 * 那不是幻灯, 是"没实现"。
 *
 * 【不驱动音频, 也不被音频驱动】—— 四轨分离: 这一层只管画面自己的节奏。
 * 用 TimelineView 而不是 Timer: 页面不可见时 TimelineView 自动停, 不会在后台空转烧电。
 */
private struct SlideshowLayer: View {
    let frames: [String]
    var alignment: Alignment = .top
    /// 每帧停留秒数。6 秒是大屏上"看得清又不拖沓"的常见值; 帧少时不必更快。
    private let dwell: Double = 6

    var body: some View {
        if frames.isEmpty {
            Color.black
        } else if frames.count == 1 {
            frame(frames[0])
        } else {
            TimelineView(.periodic(from: .now, by: dwell)) { ctx in
                let i = Int(ctx.date.timeIntervalSince1970 / dwell) % frames.count
                frame(frames[i])
                    .id(i)                                   // 换帧 = 新身份 → 过渡真的会跑
                    .transition(.opacity)
                    .animation(.easeInOut(duration: 0.8), value: i)
            }
        }
    }

    @ViewBuilder private func frame(_ u: String) -> some View {
        if let url = URL(string: u) {
            ZStack(alignment: alignment) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { Color.black }
            }
        } else { Color.black }
    }
}
