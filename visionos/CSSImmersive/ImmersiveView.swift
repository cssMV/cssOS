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
    @State private var applied = _ApplyToken()
    /// CSSOS_WAVE_938 — 空间爆字幕容器(身边炸字都挂这里)。
    @State private var burstRoot = Entity()
    /// CSSOS_WAVE_940 — 特效容器 + 环境引用(随情绪变色)。W952 去掉地板。
    @State private var fxRoot = Entity()
    @State private var envModel: ModelEntity? = nil
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

    // W981 — 空间原生【控制球簇】(抛弃 2D 窗口): 一圈漂浮球锚在视野下方、跟着你、凝视高亮、捏合触发。
    //   打赏 / 下一首 / 切场景 / 创作 / 退出。这是空间交互的基石(掌心手势触发下一步真机接)。
    @ViewBuilder private var controlCluster: some View {
        HStack(spacing: 22) {
            // W1068 — 首版无内购(3.1.1): 打赏入口隐藏(IAP 未接前不在 Vision 内售卖)。
            if CSSPayments.visionPurchasesEnabled {
                orb("💝", L("Tip", "打赏"), .green) {
                    let angle = player.variants[safe: player.activeIndex]?.angleDegrees ?? 0
                    SpatialTip.flyTip(to: angle, into: fxRoot)
                    if let id = player.work?.id { Task { await SpatialTip.sendTip(workID: id, amountCents: 100) } }
                }
            }
            orb("⏭", L("Next", "下一首"), .white) {
                let n = player.variants.count
                if n > 1 { player.setActive((player.activeIndex + 1) % n) }
            }
            orb("🌀", L("Scene", "场景"), .white) {
                let envs = CathedralSettings.environments.map { $0.key }
                if let i = envs.firstIndex(of: settings.environment) {
                    settings.customEnvURL = ""; settings.environment = envs[(i + 1) % envs.count]
                }
            }
            orb("⚙", L("Tune", "设置"), .white) { settings.menuOpen.toggle() }
            orb("🤖", L("Create", "创作"), .purple) {
                if !settings.aiWindowOpen { settings.aiWindowOpen = true; openWindow(id: "ai") }   // W982 — 单窗
            }
            orb("✕", L("Exit", "退出"), .red) { exitCathedral() }
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
        .glassBackgroundEffect(in: Capsule())
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
            Text("CSS Cathedral").font(.system(size: 30, weight: .black, design: .rounded))
            Text(L("Surround (you at center)", "环绕(你在圆心)")).font(.headline).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                ForEach([120, 180, 270, 320, 360], id: \.self) { deg in
                    Button("\(deg)°") { settings.arcDegrees = Double(deg); settings.bump() }
                        .lineLimit(1).fixedSize()           // W970 — 不换行
                        .tint(Int(settings.arcDegrees) == deg ? .green : nil)
                }
            }.buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.regular)
            VStack(alignment: .leading) {
                Text(L("Radius \(String(format: "%.1f", settings.radius)) m", "半径 \(String(format: "%.1f", settings.radius)) m")).font(.footnote)
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

            // 2) 每个变体一块弧形银幕, 摆到环绕弧线上, 配一个标签。
            for (i, v) in player.variants.enumerated() {
                let player = self.player
                guard i < player.videoPlayers.count else { continue }
                let screen = ImmersiveScene.makeCurvedScreen(
                    player: player.videoPlayers[i],
                    arcDegrees: Float(settings.arcDegrees),
                    radius: Float(settings.radius),
                    height: Float(settings.screenHeight))
                screen.name = "screen-\(i)"
                // 可被注视+捏合选中。
                screen.components.set(InputTargetComponent())
                screen.generateCollisionShapes(recursive: false)
                ImmersiveScene.placeOnArc(screen, angleDegrees: v.angleDegrees, radius: Float(settings.radius))
                content.add(screen)
                // CSSOS_WAVE_1106 — 纯音频作品(无 final_mv_url)→ 银幕贴作品封面(否则空 VideoMaterial=黑屏)。
                if (v.videoURL ?? "").isEmpty, let cover = player.work?.coverURL, !cover.isEmpty {
                    ImmersiveScene.applyCoverTexture(cover, to: screen)
                }
                // W958 — 去掉每屏语言标签(视频上角看不清的小信息)。语言在菜单里看。
            }

            // 3) 字幕浮层: 贴在视频【底边】(同屏半径, 紧贴下沿)。
            if let subtitle = attachments.entity(for: "subtitle") {
                ImmersiveScene.placeOnArc(subtitle, angleDegrees: 0, radius: Float(settings.radius) - 0.05, height: subtitleHeight)
                content.add(subtitle)
            }

            // 3b) W981 — 空间控制球簇: 头部锚定在视野【下方】, 跟着你、不挡中央, 凝视高亮+捏合触发。
            let headAnchor = AnchorEntity(.head)
            if let cluster = attachments.entity(for: "cluster") {
                cluster.position = SIMD3<Float>(0, -0.42, -0.95)   // 视野下方 HUD
                headAnchor.addChild(cluster)
            }
            content.add(headAnchor)

            // 3c) W964 — 空间菜单浮层: 浮在你正前方稍上, 默认隐藏, 点空间魔镜 logo 才显。
            if let menu = attachments.entity(for: "menu") {
                menu.position = SIMD3<Float>(0, 0.35, -1.15)   // W968 — 降低到视野下方, 不挡中央画面
                menu.isEnabled = settings.menuOpen
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
                                                     height: Float(settings.screenHeight))
                for (i, v) in player.variants.enumerated() {
                    if let s = content.entities.first(where: { $0.name == "screen-\(i)" }) as? ModelEntity {
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
                if let s = content.entities.first(where: { $0.name == "screen-\(i)" }) {
                    let target: Float = (i == player.activeIndex) ? 1.0 : 0.86
                    s.scale = SIMD3<Float>(repeating: target)
                }
            }
            // W950 — 激活屏变了 → 只给激活屏装 VideoMaterial(它解码), 其余屏暗色封面(不解码=省内存)。
            if applied.act != player.activeIndex {
                applied.act = player.activeIndex
                for (i, _) in player.variants.enumerated() {
                    guard let s = content.entities.first(where: { $0.name == "screen-\(i)" }) as? ModelEntity else { continue }
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
            Attachment(id: "cluster") { controlCluster }   // W981 — 空间控制球簇(视野下方 HUD)
            Attachment(id: "menu") { spaceMenu }            // 设置菜单(⚙ 切换: 弧度/半径/场景细节)
            Attachment(id: "subtitle") {
                SubtitleLineView(text: player.currentLineText)
            }
            Attachment(id: "welcome") {
                CathedralWelcomeView()
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
        // CSSOS_WAVE_938/940 — 逐字事件驱动: 身边炸字 + 全套空间特效。
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
            // W1070 — 间奏/前奏/尾声(近期 1.6s 无爆字=器乐段): emoji 从四边飞进画面; 否则天女散花。
            if Date().timeIntervalSince(lastBurstAt) > 1.6 {
                CathedralFX.musicEdgeEmoji(into: fxRoot, emotion: lastEmotion.isEmpty ? "calm" : lastEmotion, count: 6, around: player.headPos)
            } else {
                CathedralFX.petalRain(into: fxRoot, emotion: lastEmotion.isEmpty ? "calm" : lastEmotion, count: 6, around: player.headPos, mesh3D: petal3D)
            }
        }
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
