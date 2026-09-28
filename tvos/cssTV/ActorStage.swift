// CSSOS_WAVE_2254 20260928 — 演播厅背幕 + 会动的演员(数字演员移植第二波)。
//
// 【不抄表】厅的数值表在 public/app.actor-stage.js(60 间文明厅 + 戏路调性 + 按 actor_id 的专厅),
// 每条都带美术考据 —— 妲己那间的注释写着左右灯位是「看着真图定的, 不是想当然」, 抄错一侧
// 火就打在与背幕相反的方向。所以后端把那个文件本身当数据源跑(GET /api/actors/:id/stage),
// TV 只负责画。桌面那份仍是唯一真源, 改一处全端跟着变。
//
// 【几何照抄 CSS, 不重新设计】app.actor-gallery.js:384 那两行是生效声明, 逐项对应:
//   顶光  radial(130% 90% at 50% -12%)  → EllipticalGradient center(0.5,-0.12) end .55
//   左灯  radial(70% 60% at 18% 26%)    → center(0.18,0.26) end .70
//   右灯  radial(70% 60% at 84% 38%)    → center(0.84,0.38) end .72
//   背景  linear(180deg bg1, bg2 55%, bg3)
//   地面  底部 40% 高, linear(transparent → floor 55% → 黑 .55)
//   背幕  opacity .62 + saturate(.82) brightness(.78)  ←【这三个数是对着真背幕调的, 别改】
import SwiftUI
import AVKit

// MARK: - rgba() → Color

extension Color {
    /// 解析 "rgba(214,158,74,0.17)" / "#16110c"。解析不了返回 nil, 由调用方决定兜底。
    static func cssos(_ s: String?) -> Color? {
        guard var t = s?.trimmingCharacters(in: .whitespaces), !t.isEmpty else { return nil }
        if t.hasPrefix("#") {
            t.removeFirst()
            guard t.count == 6, let v = UInt32(t, radix: 16) else { return nil }
            return Color(.sRGB, red: Double((v >> 16) & 0xFF)/255, green: Double((v >> 8) & 0xFF)/255,
                         blue: Double(v & 0xFF)/255, opacity: 1)
        }
        guard t.lowercased().hasPrefix("rgb") , let l = t.firstIndex(of: "("), let r = t.lastIndex(of: ")") else { return nil }
        let parts = t[t.index(after: l)..<r].split(separator: ",").map {
            Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        guard parts.count >= 3 else { return nil }
        return Color(.sRGB, red: parts[0]/255, green: parts[1]/255, blue: parts[2]/255,
                     opacity: parts.count > 3 ? parts[3] : 1)
    }
}

// MARK: - 厅

struct ActorStageBackdrop: View {
    let rig: CSSStageRig?

    private var bg1: Color { Color.cssos(rig?.bg?.first) ?? Color(red: 0.039, green: 0.090, blue: 0.071) }
    private var bg2: Color { Color.cssos(rig?.bg?.dropFirst().first) ?? Color(red: 0.020, green: 0.063, blue: 0.047) }
    private var bg3: Color { Color.cssos(rig?.bg?.dropFirst(2).first) ?? Color(red: 0.008, green: 0.035, blue: 0.024) }

    var body: some View {
        ZStack {
            LinearGradient(stops: [.init(color: bg1, location: 0),
                                   .init(color: bg2, location: 0.55),
                                   .init(color: bg3, location: 1)],
                           startPoint: .top, endPoint: .bottom)

            // 背幕图垫在灯之下: 它是【布景】不是【画面】, 压暗去饱和才不抢主角,
            // 也才让上面那三盏灯看得出来。三个数照抄 CSS, 换了新背幕要重调。
            if let p = rig?.plate, let u = URL(string: p) {
                CSSPosterImage(urlString: p, targetSize: CGSize(width: 1920, height: 1080))
                    .opacity(0.62).saturation(0.82).brightness(-0.11)
                    .allowsHitTesting(false)
                    .id(u)
            }

            lamp(rig?.key,   center: UnitPoint(x: 0.50, y: -0.12), end: 0.55)
            lamp(rig?.left,  center: UnitPoint(x: 0.18, y:  0.26), end: 0.70)
            lamp(rig?.right, center: UnitPoint(x: 0.84, y:  0.38), end: 0.72)

            // 地面: 只占底部 40%
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: Color.cssos(rig?.floor) ?? Color(red: 0, green: 0.96, blue: 0.63).opacity(0.045), location: 0.55),
                    .init(color: .black.opacity(0.55), location: 1),
                ], startPoint: .top, endPoint: .bottom)
                .frame(height: 430)   // ≈ 1080 的 40%
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    @ViewBuilder private func lamp(_ c: String?, center: UnitPoint, end: CGFloat) -> some View {
        if let col = Color.cssos(c) {
            EllipticalGradient(colors: [col, .clear], center: center,
                               startRadiusFraction: 0, endRadiusFraction: end)
        }
    }
}

// MARK: - 会动的演员

/// 两态循环片叠在肖像之上。**全库 200 位目前只有 4 位有片子**(妲己/布伦希尔德/德劳帕蒂/夏娃),
/// 所以「没有」是常态 —— 没有就什么都不渲染, 原样露出下面的静态肖像, 绝不留黑框。
struct ActorLoopVideo: View {
    let idleURL: String?
    let talkURL: String?
    var speaking: Bool = false

    /// 只认同源 /artifacts/ —— 演员数据是可编辑的, 当不可信输入待。
    /// 这条守卫照抄桌面 app.actor-gallery.js:2720 的 _vidOk, 不是我新加的规矩。
    private static func ok(_ u: String?) -> URL? {
        guard let s = u, s.hasPrefix("https://cssstudio.app/artifacts/") else { return nil }
        return URL(string: s)
    }

    var body: some View {
        // 没有待机片就整个不渲染(桌面同样规则: 没待机片就不单挂说话片)。
        if let idle = Self.ok(idleURL) {
            ZStack {
                LoopPlayer(url: idle, playing: !speaking)
                if let talk = Self.ok(talkURL) {
                    LoopPlayer(url: talk, playing: speaking).opacity(speaking ? 1 : 0)
                }
            }
            .animation(.easeInOut(duration: 0.18), value: speaking)
        }
    }
}

/// 静音循环播放器。静音是硬要求 —— 声音走《问道》那条独立音轨(平台四轨分离),
/// 这里出声会和它打架。
private struct LoopPlayer: UIViewControllerRepresentable {
    let url: URL
    let playing: Bool

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let item = AVPlayerItem(url: url)
        let p = AVQueuePlayer()
        p.isMuted = true
        let looper = AVPlayerLooper(player: p, templateItem: item)
        context.coordinator.looper = looper
        context.coordinator.player = p
        let vc = AVPlayerViewController()
        vc.player = p
        vc.showsPlaybackControls = false
        vc.videoGravity = .resizeAspectFill
        vc.view.backgroundColor = .clear
        if playing { p.play() }
        return vc
    }

    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {
        guard let p = context.coordinator.player else { return }
        if playing { if p.rate == 0 { p.play() } } else { if p.rate != 0 { p.pause() } }
    }

    static func dismantleUIViewController(_ vc: AVPlayerViewController, coordinator: Coordinator) {
        // 断源释放解码器: 只 pause 不清 src, 解码器不会还回去(桌面 W1645 的教训, tvOS 更吃紧)。
        coordinator.player?.pause()
        coordinator.player?.removeAllItems()
        coordinator.looper?.disableLooping()
        vc.player = nil
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator {
        var player: AVQueuePlayer?
        var looper: AVPlayerLooper?
    }
}
