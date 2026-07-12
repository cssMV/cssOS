// CSSOS_WAVE_937 — 沉浸视图: 360 环境 + 多块弧形环绕银幕 + 转头/点选切换激活屏 + 字幕跟激活屏。

import SwiftUI
import RealityKit
import simd
import UIKit

final class _ApplyToken { var gen = -1; var act = -1; var env = "" }   // W949/950/953 去重

struct ImmersiveView: View {
    @EnvironmentObject var player: PlayerController
    @EnvironmentObject var settings: CathedralSettings   // W949 — 弧度/半径参数
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace   // W964
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow   // W979 — 退出时销毁辅窗
    /// W1580 — 从影院【退回一步】到大厅另选作品(不销毁沉浸空间)。GateView 传入 → 设 showCinema=false。
    var onBack: (() -> Void)? = nil
    /// W1580 — 上一首/下一首: 换播另一个作品(GateView 传入 → enterCinema(work) 重装 + 重建影院)。
    var onPlayWork: ((CSSWork) -> Void)? = nil
    @State private var applied = _ApplyToken()
    /// CSSOS_WAVE_938 — 空间爆字幕容器(身边炸字都挂这里)。
    @State private var burstRoot = Entity()
    /// CSSOS_WAVE_940 — 特效容器 + 环境引用(随情绪变色)。W952 去掉地板。
    @State private var fxRoot = Entity()
    @State private var envModel: ModelEntity? = nil
    // W1400 — 影院弧形银幕【捏住拖动】(沉浸内自由摆位/拉远近, 无拖拽条): 所有银幕+字幕挂这个容器, 拖它即整组移动。
    @State private var cinemaRoot = Entity()
    @State private var cinemaDragBase: SIMD3<Float>? = nil
    // W1580 C — 通用拖拽/缩放/吸附: 面板(整个即手柄)+ 银幕都可拖可缩; 两面板靠近自动吸附成并排。
    @State private var leftPanelEntity: Entity? = nil
    @State private var rightPanelEntity: Entity? = nil
    @State private var menuEntity: Entity? = nil        // W1580 — ⚙ 设置菜单也可拖(标题栏握把)
    @State private var langvoiceEntity: Entity? = nil   // W1580 — 多语言胶囊条也可拖
    @State private var dragTarget: Entity? = nil
    @State private var dragBase: SIMD3<Float>? = nil
    @State private var magnifyTarget: Entity? = nil
    @State private var magnifyBase: Float = 1
    @State private var panelDragBase: [ObjectIdentifier: SIMD3<Float>] = [:]   // W1580 C — SwiftUI 面板拖拽基准
    @State private var panelScaleBase: [ObjectIdentifier: Float] = [:]         // W1580 C — SwiftUI 面板缩放基准
    // W952 — 独立计时器: 保证天女散花全程飘(脱离字幕时钟; 即便 burst 没发也有花)。
    private let petalTimer = Timer.publish(every: 1.4, on: .main, in: .common).autoconnect()
    // W958 — 字幕/打赏贴视频底边: 视线高 ~1.5, 视频中心在 1.5、半高=screenHeight/2 → 底边=1.5-半高。
    // W964 — 字幕/打赏贴在视频【底边外侧】(不进框、不被画面挡)。
    private var subtitleHeight: Float { 1.5 - Float(settings.screenHeight) / 2 - 0.14 }
    private var tipHeight: Float { 1.5 - Float(settings.screenHeight) / 2 - 0.30 }

    private func exitCathedral() {
        settings.menuOpen = false
        player.pauseAll()
        // W980 — Jing 哲学: 退出=干干净净彻底销毁, 不强留用户。连大门也一起关, 不再重开。
        //   要回来 → 重新点 App 图标(清爽全新)。不玩"假退出留客"那套。
        dismissWindow(id: "controls")
        dismissWindow(id: "ai")
        dismissWindow(id: "launch")
        Task { await dismissImmersiveSpace() }
    }

    // W1580 — Jing「进播放后要能退回一步、另选别的作品」: 退回大厅 ≠ exitCathedral(那是彻底销毁退出系统)。
    //   这里只暂停播放 + 收菜单, 回调 GateView 把 showCinema 设回 false → 回到同一沉浸空间的大厅, 沉浸空间不拆。
    private func backToLobby() {
        settings.menuOpen = false
        player.pauseAll()
        onBack?()
    }

    // W1580 — 上一首/下一首 = 大厅画廊里的【上/下一个作品】(环绕循环)。
    //   当前作品不在画廊(随机/语音进来)→ 回退切【变体屏】(至少不空操作)。
    private func stepWork(_ dir: Int) {
        let g = CSSBackend.lastGallery
        if !g.isEmpty, let cur = player.work?.id, let i = g.firstIndex(where: { $0.id == cur }) {
            onPlayWork?(g[(i + dir + g.count) % g.count])
        } else {
            let n = player.variants.count
            if n > 1 { player.setActive((player.activeIndex + dir + n) % n) }
        }
    }

    // W1580 C — 面板拖拽/缩放走【SwiftUI 手势】(关键: 不给面板加 InputTargetComponent →
    //   不把整块面板变成单一凝视目标 → 内部每个按钮的凝视+捏合照常работает)。整块即手柄, 无独立把手。
    //   2D 捏拖(points)→ 面板本地平面位移(米, ~1360pt/m), 旋到面板朝向 → 世界移动; 拖完做靠近吸附。
    private func panelDrag(_ ref: @escaping () -> Entity?) -> some Gesture {
        DragGesture()
            .onChanged { v in
                guard let e = ref() else { return }
                let key = ObjectIdentifier(e)
                if panelDragBase[key] == nil { panelDragBase[key] = e.position }
                // W1580 — Jing「不能只左右, 要能远近自由拖」: x/y 走 2D(已验证), z 走 translation3D.z(手前后=面板近远)。
                let depth = Float(v.translation3D.z) / 1360
                let local = SIMD3<Float>(Float(v.translation.width) / 1360,
                                         Float(-v.translation.height) / 1360, depth)
                e.position = panelDragBase[key]! + e.orientation.act(local)
            }
            .onEnded { _ in
                guard let e = ref() else { return }
                panelDragBase[ObjectIdentifier(e)] = nil
                snapPanels(moved: e)
            }
    }
    private func panelMagnify(_ ref: @escaping () -> Entity?) -> some Gesture {
        MagnifyGesture()
            .onChanged { v in
                guard let e = ref() else { return }
                let key = ObjectIdentifier(e)
                if panelScaleBase[key] == nil { panelScaleBase[key] = e.scale.x }
                e.scale = SIMD3<Float>(repeating: max(0.4, min(3.0, panelScaleBase[key]! * Float(v.magnification))))
            }
            .onEnded { _ in if let e = ref() { panelScaleBase[ObjectIdentifier(e)] = nil } }
    }

    // 命中的实体(或其某个祖先)属于哪个【可拖根】: 银幕→整组影院 cinemaRoot; 面板→该面板本身。
    private func draggableTarget(for entity: Entity) -> Entity? {
        var e: Entity? = entity
        while let cur = e {
            if cur.name.hasPrefix("screen-") { return cinemaRoot }
            if cur.name.hasPrefix("panel-") { return cur }
            e = cur.parent
        }
        return nil
    }

    // W1580 C — 面板靠近即吸附: 拖完若两面板边缘间距 < 25cm, 把被拖面板并到另一面板边上(同高/同深, x 相邻)。
    private func snapPanels(moved: Entity) {
        guard moved.name.hasPrefix("panel-"),
              let other = (moved === leftPanelEntity ? rightPanelEntity : leftPanelEntity),
              other.name.hasPrefix("panel-") else { return }
        let a = moved.position(relativeTo: nil), b = other.position(relativeTo: nil)
        let mw = moved.visualBounds(relativeTo: nil).extents.x * 0.5
        let bw = other.visualBounds(relativeTo: nil).extents.x * 0.5
        let touch = mw + bw + 0.02
        // W1580 — 能吸也能掰: 只在边缘间距 <12cm 才吸; 拖开超过 12cm 松手就分开(不再回吸)。
        guard simd_distance(a, b) < touch + 0.12 else { return }
        let side: Float = (a.x >= b.x) ? 1 : -1
        moved.setPosition(SIMD3<Float>(b.x + side * touch, b.y, b.z), relativeTo: nil)
    }

    // W981 — 空间原生【控制球簇】(抛弃 2D 窗口): 一圈漂浮球锚在视野下方、跟着你、凝视高亮、捏合触发。
    //   打赏 / 下一首 / 切场景 / 创作 / 退出。这是空间交互的基石(掌心手势触发下一步真机接)。
    // W1580 — Jing「取消跟头的小控制台, 拆成左右两块摆在用户左右」。
    //   左面板 = 观赏(关于本作品: 下一首 / 场景 / 打赏); 右面板 = 操作(去哪·调什么: 大厅 / 设置 / 创作 / 退出)。
    //   竖排, 世界固定(见 make 里 .once 头锚), 各自 toe-in 朝向用户。
    @ViewBuilder private var leftPanel: some View {
        VStack(spacing: 20) {
            panelHeader(L("Watch", "观赏")) { leftPanelEntity }
            orb("⏮", L("Prev", "上一首"), .white) { stepWork(-1) }   // W1580 — 成对: 上一首
            orb("⏭", L("Next", "下一首"), .white) { stepWork(1) }    // W1580 — 下一首(画廊里的下一个作品)
            orb("🌀", L("Scene", "场景"), .white) {
                let envs = CathedralSettings.environments.map { $0.key }
                if let i = envs.firstIndex(of: settings.environment) {
                    settings.customEnvURL = ""; settings.environment = envs[(i + 1) % envs.count]
                }
            }
            // W1580 — Jing: 去掉打赏(内购未接)。
        }
        .padding(.horizontal, 16).padding(.vertical, 18)
        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 34))
    }

    @ViewBuilder private var rightPanel: some View {
        VStack(spacing: 20) {
            panelHeader(L("Menu", "操作")) { rightPanelEntity }
            orb("⬅️", L("Lobby", "大厅"), .white) { backToLobby() }   // W1580 — 退回大厅另选作品(不退出系统)
            orb("⚙", L("Tune", "设置"), .white) { settings.menuOpen.toggle() }
            // W1580 — Jing: 去掉创作。
            orb("✕", L("Exit", "退出"), .red) { exitCathedral() }
        }
        .padding(.horizontal, 16).padding(.vertical, 18)
        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 34))
    }

    // W1580 — Jing「标题栏就是好的信号点」: 面板标题栏 = 拖拽握把 + 凝视高亮(可移动/可吸附信号)。
    //   拖只发生在标题栏 → 下方按钮点按零冲突; 凝视标题栏发亮 = 提示"这里能拖能吸"。捏合标题栏 = 缩放。
    private func panelHeader(_ t: String, _ ref: @escaping () -> Entity?) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "line.3.horizontal").font(.system(size: 13, weight: .bold))
            Text(t).font(.system(size: 15, weight: .bold, design: .rounded)).textCase(.uppercase)
        }
        .foregroundStyle(.white.opacity(0.6))
        .padding(.horizontal, 14).padding(.vertical, 8)
        .contentShape(.hoverEffect, Capsule())
        .hoverEffect()                                  // 凝视 → 高亮 = 可移动信号
        .simultaneousGesture(panelDrag(ref))            // 拖标题栏 → 移动面板(+靠近吸附)
        .simultaneousGesture(panelMagnify(ref))         // 捏合标题栏 → 缩放
    }

    private func orb(_ glyph: String, _ label: String, _ tint: Color, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Text(glyph).font(.system(size: 30))
                Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(tint == .white ? .white.opacity(0.85) : tint)
            }
            .frame(width: 72, height: 72)
            .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .hoverEffect()          // 凝视高亮(visionOS 原生)
    }

    // W969 — 极简未来感【控制胶囊条】(贴视频下沿): 打赏/欣赏/聆听/买断/多语言。与桌面价格条对齐。
    @ViewBuilder private var controlBar: some View {
        HStack(spacing: 9) {
            // W1068 — 首版无内购(3.1.1): 打赏 + 买断隐藏; 保留欣赏/聆听(免费)+ 多语言。
            if CSSPayments.visionPurchasesEnabled {
                capsule("💝 " + L("Tip", "打赏"), tint: .green) {
                    let angle = player.variants[safe: player.activeIndex]?.angleDegrees ?? 0
                    SpatialTip.flyTip(to: angle, into: fxRoot)
                    if let id = player.work?.id { Task { await SpatialTip.sendTip(workID: id, amountCents: 100) } }
                }
            }
            capsule("👁 " + L("View · Free", "欣赏 · 免费")) {}
            capsule("🎧 " + L("Listen · Free", "聆听 · 免费")) {}
            if CSSPayments.visionPurchasesEnabled {
                capsule("💎 " + L("Buyout · Priceless", "买断 · 无价")) {}
            }
            capsule("🌐 " + L("Languages", "多语言")) { settings.menuOpen = true }
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .glassBackgroundEffect(in: Capsule())
    }

    private func capsule(_ text: String, tint: Color = .white, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .foregroundStyle(tint == .green ? .green : .white.opacity(0.92))
                .padding(.horizontal, 14).padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .background(.ultraThinMaterial, in: Capsule())
        .hoverEffect()
    }

    // W964 — 空间菜单浮层(点空间魔镜 logo 浮出, 不再用 2D 窗口)。
    @ViewBuilder private var spaceMenu: some View {
        VStack(spacing: 18) {
            // W1580 — 标题栏 = 拖拽握把(凝视高亮=可移动信号, 拖它移动整个菜单, 捏合缩放)。
            HStack(spacing: 8) {
                Image(systemName: "line.3.horizontal").font(.system(size: 16, weight: .bold)).opacity(0.5)
                Text("CSS Cathedral").font(.system(size: 30, weight: .black, design: .rounded))
            }
            .padding(.horizontal, 16).padding(.vertical, 6)
            .contentShape(.hoverEffect, Capsule())
            .hoverEffect()
            .simultaneousGesture(panelDrag { menuEntity })
            .simultaneousGesture(panelMagnify { menuEntity })
            Text(L("Surround (you at center)", "环绕(你在圆心)")).font(.headline).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                ForEach([120, 180, 270, 320, 360], id: \.self) { deg in
                    Button("\(deg)°") { settings.arcDegrees = Double(deg); settings.bump() }
                        .lineLimit(1).fixedSize()           // W970 — 不换行
                        .tint(Int(settings.arcDegrees) == deg ? .green : nil)
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.regular)
            VStack(alignment: .leading) {
                Text(L("Distance \(String(format: "%.1f", settings.radius)) m (360°=circle size)", "远近 · 屏幕距离 \(String(format: "%.1f", settings.radius)) m(360°=圈圈大小)")).font(.footnote)
                Slider(value: $settings.radius, in: 0.5...6.0, step: 0.1).onChange(of: settings.radius) { _, _ in settings.bump() }
            }.frame(width: 460)
            Text(L("Scene", "场景")).font(.headline).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                ForEach(CathedralSettings.environments, id: \.key) { e in
                    Button(L(e.en, e.zh)) { settings.customEnvURL = ""; settings.environment = e.key }
                        .lineLimit(1).fixedSize()           // W970 — 不换行
                        .tint(settings.customEnvURL.isEmpty && settings.environment == e.key ? .green : nil)
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.regular)

            // W966 — 恢复: 用户自带环境(作品封面 / 自填 360 图)。开放平台, 环境也交给用户。
            HStack(spacing: 10) {
                Button(L("Use cover as scene", "用本作品封面")) {
                    if let c = player.work?.coverURL, !c.isEmpty { settings.customEnvURL = c }
                }.disabled((player.work?.coverURL ?? "").isEmpty)
                if !settings.customEnvURL.isEmpty {
                    Button(L("Reset scene", "恢复内置")) { settings.customEnvURL = "" }.tint(.orange)
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            TextField(L("Your 360° image URL", "自填 360 图 URL"), text: $settings.customEnvURL)
                .textFieldStyle(.roundedBorder).frame(width: 460)

            HStack(spacing: 12) {
                Button { settings.menuOpen = false } label: {
                    Label(L("Collapse", "收起"), systemImage: "arrow.down.right.and.arrow.up.left.circle.fill")
                }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                Button { backToLobby() } label: {   // W1580 — 退回大厅另选作品
                    Label(L("Lobby", "大厅"), systemImage: "chevron.backward.circle.fill")
                }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                Button { exitCathedral() } label: {
                    Label(L("Exit", "退出"), systemImage: "xmark.circle.fill").foregroundStyle(.white)
                }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).tint(.red)
            }
        }
        .padding(34)
        .frame(width: 720)              // W970 — 加宽, 胶囊一行排得下不换行
        .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 40))
    }
    @State private var lastFlashAt: Date = .distantPast
    @State private var lastPetalAt: Date = .distantPast
    @State private var lastEmotion: String = ""
    @State private var lastBurstAt: Date = .distantPast   // W1070 — 判间奏(近期无爆字=器乐段)
    @AppStorage("cssOrbSphere") private var orbSphere = false  // W1052 — 大厅 logo 金球: 平面/3D 球体
    @AppStorage("cssPetal3D") private var petal3D = false      // W1054 — 天女散花: emoji 卡 / 真 3D 网格

    var body: some View {
        RealityView { content, attachments in
            // 0) 特效 + 爆字幕根容器。
            content.add(fxRoot)
            content.add(burstRoot)
            SpatialSubtitleSystem.reset(in: burstRoot)   // W1399 — 进影院清空上一作品残留行容器
            // W1069 — 截图展示模式: 模拟器音频不起播→爆字幕不触发, 这里定时强制喷一个真实情绪爆字幕
            //   (中央大字 + emoji + 四溅), 保证能截到"影院+逐字情绪字幕"招牌图。仅 env 设置时生效。
            let _showcase = ProcessInfo.processInfo.environment["CSS_SHOWCASE"] ?? ""
            if _showcase == "cinema" {
                let demos: [(String, String)] = [
                    ("晨光落在古城墙", "calm"), ("不见五陵豪杰墓", "power"),
                    ("桃花仙人种桃树", "joy"), ("半醒半醉日复日", "love"),
                ]
                let br = burstRoot
                Timer.scheduledTimer(withTimeInterval: 2.6, repeats: true) { _ in
                    let d = demos.randomElement() ?? ("晨光落在古城墙", "calm")
                    SpatialSubtitleSystem.spawnBurst(
                        BurstEvent(text: d.0, emotion: d.1, intensity: 0.92),
                        into: br, near: SIMD3<Float>(0, 1.5, 0), forward: SIMD3<Float>(0, 0, -1),
                        centerOnScreen: true)
                }
            } else if _showcase == "music" {
                // W1071 — 间奏四边 emoji 飞进画面 展示图: 持续喷, 保证截到飞行中的多颗。
                let fx = fxRoot
                Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
                    CathedralFX.musicEdgeEmoji(into: fx, emotion: "joy", count: 8,
                                               around: SIMD3<Float>(0, 1.5, 0))
                }
            }
            // 1) 360 环境/场景(留引用以便切场景 + 随情绪变色)。
            let env = ImmersiveScene.makeEnvironment(named: settings.environment)
            content.add(env)
            envModel = env.children.first as? ModelEntity
            // W1391 — 影院里也铺【体积星空】(四周包围, 有远有近 + 偶发流星), 与大厅一致(cosmos 场景)。
            if settings.environment == "cosmos" {
                // W1393 — Jing「影院星星跟着头转=头晕」: 必须 trackingMode=.once → 放置一次后【世界固定】,
                //   不再持续跟头(与大厅星空一致)。密度也与大厅一致(共用网格后内存是零头, 不必省)。
                let starAnchor = AnchorEntity(.head)
                starAnchor.anchoring.trackingMode = .once
                StarfieldVolume.make(into: starAnchor, count: 1600)   // W1398 — 影院近景星加密(略低于大厅, 给视频解码留余量)
                content.add(starAnchor)
            }

            // CSSOS_WAVE_1106 — Jing「影院里有两个魔镜球, 一个孤零零浮在视频框上」: 删掉这颗悬浮
            //   logo 金球(品牌存在感改由控制窗里的折叠魔镜承担), 影院中央只留画面, 不再有孤球。

            // W1400 — 银幕容器(可整组捏住拖动)。
            content.add(cinemaRoot)
            // 2) 每个变体一块弧形银幕, 摆到环绕弧线上, 配一个标签。
            for (i, v) in player.variants.enumerated() {
                let player = self.player
                guard i < player.videoPlayers.count else { continue }
                let screen = ImmersiveScene.makeCurvedScreen(
                    player: player.videoPlayers[i],
                    arcDegrees: Float(settings.arcDegrees),
                    radius: Float(settings.radius),
                    aspect: player.videoAspect,
                    height: Float(settings.screenHeight))
                screen.name = "screen-\(i)"
                // 可被注视+捏合选中。
                screen.components.set(InputTargetComponent())
                screen.generateCollisionShapes(recursive: false)
                ImmersiveScene.placeOnArc(screen, angleDegrees: v.angleDegrees, radius: Float(settings.radius))
                cinemaRoot.addChild(screen)   // W1400 — 挂容器(随拖动整组移动)
                // CSSOS_WAVE_1106 — 纯音频作品(无 final_mv_url)→ 银幕贴作品封面(否则空 VideoMaterial=黑屏)。
                if (v.videoURL ?? "").isEmpty, let cover = player.work?.coverURL, !cover.isEmpty {
                    ImmersiveScene.applyCoverTexture(cover, to: screen)
                }
                // W958 — 去掉每屏语言标签(视频上角看不清的小信息)。语言在菜单里看。
            }

            // 3) 字幕浮层: 贴在视频【底边】(同屏半径, 紧贴下沿)。
            if let subtitle = attachments.entity(for: "subtitle") {
                ImmersiveScene.placeOnArc(subtitle, angleDegrees: 0, radius: Float(settings.radius) - 0.05, height: subtitleHeight)
                cinemaRoot.addChild(subtitle)   // W1400 — 字幕随银幕一起拖动
            }

            // 3b) W1580 — Jing「面板不许跟头转, 只有我明确拖动才动」: 头锚 .once 实测【仍跟头】→ 改放【世界空间】
            //   (与环绕银幕同一套: 用户进影院时在原点附近、面朝 -Z; 面板摆左右下方的世界坐标 → 世界固定, 绝不跟头)。
            //   拖拽只放在标题栏(见 panelHeader), 下方按钮纯点按零冲突。
            if let left = attachments.entity(for: "leftPanel") {
                let p = SIMD3<Float>(-0.55, 1.10, -0.50)   // 世界: 左下(眼下方)
                left.position = p
                left.orientation = simd_quatf(angle: atan2(-p.x, -p.z), axis: SIMD3<Float>(0, 1, 0))
                left.name = "panel-left"; leftPanelEntity = left
                content.add(left)
            }
            if let right = attachments.entity(for: "rightPanel") {
                let p = SIMD3<Float>(0.55, 1.10, -0.50)   // 世界: 右下
                right.position = p
                right.orientation = simd_quatf(angle: atan2(-p.x, -p.z), axis: SIMD3<Float>(0, 1, 0))
                right.name = "panel-right"; rightPanelEntity = right
                content.add(right)
            }
            // W1418 — Jing「多语言胶囊放视频框【右下角外侧】, 别在控制台」: 挂 cinemaRoot(跟视频走/世界固定/不跟头),
            //   摆到银幕右边沿外侧 + 底边高度(贴框外右下)。
            if let lv = attachments.entity(for: "langvoice") {
                let rightAngle = Float(settings.arcDegrees) / 2 + 5   // 右边沿稍外侧
                ImmersiveScene.placeOnArc(lv, angleDegrees: rightAngle,
                                          radius: Float(settings.radius) - 0.05, height: subtitleHeight - 0.02)
                lv.name = "panel-langvoice"; langvoiceEntity = lv   // W1580 — 可拖
                cinemaRoot.addChild(lv)
            }

            // 3c) W964 — 空间菜单浮层: 浮在你正前方稍上, 默认隐藏, 点空间魔镜 logo 才显。
            if let menu = attachments.entity(for: "menu") {
                menu.position = SIMD3<Float>(0, 0.35, -1.15)   // W968 — 降低到视野下方, 不挡中央画面
                menu.isEnabled = settings.menuOpen
                menu.name = "panel-menu"; menuEntity = menu   // W1580 — 可拖
                content.add(menu)
            }

            // 4) 入殿欢迎大字。
            if let welcome = attachments.entity(for: "welcome") {
                welcome.position = SIMD3<Float>(0, 2.7, -3.0)
                content.add(welcome)
            }

            // W975 — 移除压视频的控制条; 交易/多语言改到【可拖拽控制窗 ControlsPanel】(原生玩法)。

            player.playAll()
        } update: { content, attachments in
            // W964 — 空间菜单显隐(点空间魔镜 logo 切换 settings.menuOpen)。
            attachments.entity(for: "menu")?.isEnabled = settings.menuOpen
            // W949 — 参数(弧度/半径/高)变了 → 重建每块环绕屏网格 + 重新摆位(用户始终在圆心)。
            if applied.gen != settings.generation {
                applied.gen = settings.generation
                let mesh = ImmersiveScene.curvedMesh(arcDegrees: Float(settings.arcDegrees),
                                                     radius: Float(settings.radius),
                                                     aspect: player.videoAspect,
                                                     height: Float(settings.screenHeight))
                for (i, v) in player.variants.enumerated() {
                    if let s = cinemaRoot.findEntity(named: "screen-\(i)") as? ModelEntity {
                        s.model?.mesh = mesh
                        ImmersiveScene.placeOnArc(s, angleDegrees: v.angleDegrees, radius: Float(settings.radius))
                    }
                }
            }
            // W953/W954 — 场景变了 → 换天空盒。自带 URL(作品封面/用户上传)优先, 否则用内置场景。
            let envKey = settings.customEnvURL.isEmpty ? settings.environment : "url:" + settings.customEnvURL
            if applied.env != envKey {
                applied.env = envKey
                if settings.customEnvURL.isEmpty {
                    envModel?.model?.materials = [ImmersiveScene.environmentMaterial(named: settings.environment)]
                } else {
                    ImmersiveScene.loadRemoteEnvironment(settings.customEnvURL, into: envModel)
                }
            }
            // 字幕跟激活屏角度走。
            if let v = player.variants[safe: player.activeIndex] {
                if let subtitle = attachments.entity(for: "subtitle") {
                    ImmersiveScene.placeOnArc(subtitle, angleDegrees: v.angleDegrees, radius: Float(settings.radius) - 0.05, height: subtitleHeight)
                }
            }
            // 激活屏微微放大突出。
            for (i, _) in player.variants.enumerated() {
                if let s = cinemaRoot.findEntity(named: "screen-\(i)") {
                    let target: Float = (i == player.activeIndex) ? 1.0 : 0.86
                    s.scale = SIMD3<Float>(repeating: target)
                }
            }
            // W950 — 激活屏变了 → 只给激活屏装 VideoMaterial(它解码), 其余屏暗色封面(不解码=省内存)。
            if applied.act != player.activeIndex {
                applied.act = player.activeIndex
                for (i, _) in player.variants.enumerated() {
                    guard let s = cinemaRoot.findEntity(named: "screen-\(i)") as? ModelEntity else { continue }
                    let vurl = player.variants[safe: i]?.videoURL ?? ""
                    if i == player.activeIndex, i < player.videoPlayers.count, !vurl.isEmpty {
                        s.model?.materials = [VideoMaterial(avPlayer: player.videoPlayers[i])]
                    } else if i == player.activeIndex, let cover = player.work?.coverURL, !cover.isEmpty {
                        // CSSOS_WAVE_1106 — 激活屏是纯音频作品 → 贴封面静帧(不黑屏)。
                        s.model?.materials = [UnlitMaterial(color: UIColor(white: 0.05, alpha: 1.0))]
                        ImmersiveScene.applyCoverTexture(cover, to: s)
                    } else {
                        s.model?.materials = [UnlitMaterial(color: UIColor(white: 0.05, alpha: 1.0))]
                    }
                }
            }
        } attachments: {
            // W958 — 去掉每屏语言标签(视频上角看不清的小信息)。
            Attachment(id: "leftPanel") { leftPanel }       // W1580 — 左·观赏(下一首/场景/打赏)
            Attachment(id: "rightPanel") { rightPanel }     // W1580 — 右·操作(大厅/设置/创作/退出)
            Attachment(id: "menu") { spaceMenu }            // 设置菜单(⚙ 切换: 弧度/半径/场景细节)
            Attachment(id: "subtitle") {
                SubtitleLineView(text: player.currentLineText)
            }
            Attachment(id: "welcome") {
                CathedralWelcomeView()
            }
            // W1409 — 沉浸内【多语言/多声线胶囊条】(胶囊宪法: 共用轨道 + 各段图标+标签 + 激活高亮)。
            Attachment(id: "langvoice") {
                VStack(spacing: 4) {
                    panelHeader(L("Languages", "语言")) { langvoiceEntity }   // W1580 — 拖此移动多语言条
                    LangVoiceCapsuleBar().environmentObject(player)
                }
            }
        }
        // 注视 + 捏合某块银幕 → 手动切激活屏(转头是自动, 这是手动备选)。
        .gesture(
            SpatialTapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    let name = value.entity.name
                    if name == "cathedral-logo" {
                        settings.menuOpen.toggle()          // W961 — 点空间魔镜 logo → 开/关菜单
                    } else if name.hasPrefix("screen-"), let idx = Int(name.dropFirst("screen-".count)) {
                        player.setActive(idx)
                    }
                }
        )
        // W1580 C — 通用【拖拽】: 面板 + 银幕都可整块跟手拖(整个即手柄, 无拖拽条)。
        //   minDist:30 → 小位移=点按(让给按钮/选屏 tap), 大位移=拖动。拖完调 snapPanels 做靠近吸附。
        .simultaneousGesture(
            DragGesture(minimumDistance: 30)
                .targetedToAnyEntity()
                .onChanged { value in
                    let target = dragTarget ?? draggableTarget(for: value.entity)
                    guard let target else { return }
                    if dragTarget == nil { dragTarget = target }
                    let cur = value.convert(value.location3D, from: .local, to: .scene)
                    if dragBase == nil { dragBase = target.position(relativeTo: nil) - cur }
                    target.setPosition(dragBase! + cur, relativeTo: nil)
                }
                .onEnded { _ in
                    if let t = dragTarget { snapPanels(moved: t) }
                    dragBase = nil; dragTarget = nil
                }
        )
        // W1580 C — 通用【缩放】: 捏合放大/缩小被抓的面板或银幕(0.4×~3×)。
        .simultaneousGesture(
            MagnifyGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    let target = magnifyTarget ?? draggableTarget(for: value.entity)
                    guard let target else { return }
                    if magnifyTarget == nil { magnifyTarget = target; magnifyBase = target.scale.x }
                    target.scale = SIMD3<Float>(repeating: max(0.4, min(3.0, magnifyBase * Float(value.magnification))))
                }
                .onEnded { _ in magnifyTarget = nil }
        )
        // CSSOS_WAVE_938/940 — 逐字事件驱动: 身边炸字 + 全套空间特效。
        // W1399 — Gap2: 某行结束 → 整行字一起淡出。
        .onReceive(player.lineFadeSubject) { idx in
            SpatialSubtitleSystem.fadeLine(idx, in: burstRoot)
        }
        .onReceive(player.burstSubject) { event in
            lastBurstAt = Date()   // W1070 — 有爆字=在唱(非器乐段)
            // 身边炸字。
            // W944 — 炸在用户身边/身上(按头显实时位置+朝向, 恐龙演示式贴近)。
            SpatialSubtitleSystem.spawnBurst(event, into: burstRoot,
                                             near: player.headPos, forward: player.headFwd)
            // W946 — 真因: 这首 emotion_intensity 几乎都是 0.5、情绪基本 "neutral" → 旧的"阈值/换情绪"
            //   触发条件全够不到 → 花瓣/爆闪从不出现。改: 【每个字都飘几片花瓣】(不靠阈值, 限频防过密),
            //   保证天女散花一直在; 峰值(≥0.62, 真出现强拍时)再加大撒花 + 圣殿爆闪。
            let now = Date()
            if now.timeIntervalSince(lastPetalAt) > 0.32 {
                lastPetalAt = now
                CathedralFX.petalRain(into: fxRoot, emotion: event.emotion.isEmpty ? "calm" : event.emotion, count: 4, around: player.headPos, mesh3D: petal3D)
            }
            // 环境随情绪过渡(换情绪才做, 省开销)。
            if event.emotion != lastEmotion, !event.emotion.isEmpty, let env = envModel {
                lastEmotion = event.emotion
                CathedralFX.tintEnvironment(env, emotion: event.emotion)
            }
            // 峰值: 大撒花 + 圣殿爆闪(限频 0.45s)。
            if event.intensity >= 0.62 {
                if now.timeIntervalSince(lastFlashAt) > 0.45 {
                    lastFlashAt = now
                    CathedralFX.petalRain(into: fxRoot, emotion: event.emotion, count: 10, around: player.headPos, mesh3D: petal3D)
                    CathedralFX.highNoteFlash(into: fxRoot, emotion: event.emotion)
                }
            }
        }
        // W952 — 天女散花全程飘(脱离字幕时钟): 每 1.4s 必撒一阵, 颜色跟当前情绪。
        // W975 — 跨窗→沉浸: 控制窗点打赏(settings.tipPulse++) → 圣殿里金光飞向激活银幕。
        .onChange(of: settings.tipPulse) { _, _ in
            let angle = player.variants[safe: player.activeIndex]?.angleDegrees ?? 0
            SpatialTip.flyTip(to: angle, into: fxRoot)
        }
        .onReceive(petalTimer) { _ in
            // W1402 — 间奏/前奏/尾声(近期 1.6s 无爆字=器乐段): emoji 从四边飞进画面, 随【能量包络】起伏涌动。
            //   能量=多正弦合成包络(暂代真音量; 真音量数据源待定: 原生 MTAudioProcessingTap / 后端 vol_curve)。
            if Date().timeIntervalSince(lastBurstAt) > 1.6 {
                // W1404 — 响应【真音量】: 原生 MTAudioProcessingTap 实时 RMS → emoji 密度。安静很少、响时很多。
                let e = max(0.06, min(1.0, player.currentAudioLevel))   // 留低基线: 静默也飘几颗
                let count = 1 + Int(e * 15)
                CathedralFX.musicEdgeEmoji(into: fxRoot, emotion: lastEmotion.isEmpty ? "calm" : lastEmotion,
                                           count: count, around: player.headPos, energy: e)
            } else {
                CathedralFX.petalRain(into: fxRoot, emotion: lastEmotion.isEmpty ? "calm" : lastEmotion, count: 6, around: player.headPos, mesh3D: petal3D)
            }
        }
        // W1580 — 异步读到视频真实宽高比 → 触发银幕网格按真比例重建(不再假设 16:9)。
        .onChange(of: player.videoAspect) { _, _ in settings.bump() }
        .onDisappear { player.pauseAll() }
    }
}

/// 银幕标签(变体名)。激活屏高亮。
struct ScreenLabelView: View {
    let text: String
    let active: Bool
    var body: some View {
        Text(text)
            .font(.system(size: 30, weight: active ? .bold : .medium, design: .rounded))
            .foregroundStyle(active ? .white : .white.opacity(0.55))
            .padding(.horizontal, 18).padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().strokeBorder(active ? .green : .clear, lineWidth: 2))
            .animation(.easeInOut(duration: 0.25), value: active)
    }
}

/// 入殿欢迎大字「CSS Cathedral」: 浮现 → 停留 → 淡出。
struct CathedralWelcomeView: View {
    @State private var shown = false
    @State private var gone = false
    var body: some View {
        VStack(spacing: 6) {
            Text("CSS Cathedral")
                .font(.system(size: 72, weight: .black, design: .serif))
                .foregroundStyle(.white)
                .shadow(color: .white.opacity(0.35), radius: 24)
            Text("魔镜圣殿 · Just say CSS, witness the miracle")
                .font(.system(size: 26, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.8))
        }
        .multilineTextAlignment(.center)
        .opacity(gone ? 0 : (shown ? 1 : 0))
        .scaleEffect(shown ? 1.0 : 0.92)
        .onAppear {
            withAnimation(.easeOut(duration: 1.2)) { shown = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) {
                withAnimation(.easeInOut(duration: 1.4)) { gone = true }
            }
        }
    }
}

/// 字幕行(阶段 1 整行)。阶段 2: 逐字 token 上色 + emoji + 爆字, 并可"在用户身边爆"。
struct SubtitleLineView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 44, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.7), radius: 6, x: 0, y: 2)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 1100)
            .padding(.horizontal, 24)
            .opacity(text.isEmpty ? 0 : 1)
            .animation(.easeInOut(duration: 0.2), value: text)
    }
}
