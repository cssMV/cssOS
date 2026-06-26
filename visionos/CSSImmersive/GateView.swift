// CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(阶段2)。整个大厅在沉浸空间里, 不再是 2D 窗口。
//   · 星空(cosmos)环绕环境;
//   · 大厅 UI(LobbyView)作为浮空面板 attachment, 悬在你正前方;
//   · 捏大厅金球 → 头部锚点 AnchorEntity(.head) 上随机色光束【一波接一波真飞进眼睛、穿到脑后】(同一空间内, 不退出) → Optic ID;
//   · 选作品/创作/咒语 → 经 GateRouter 回传给窗口 ContentView 编排(切影院/开AI窗)。
//   头部坐标系: -Z = 正前方, +Z = 脑后。

import SwiftUI
import RealityKit
import UIKit

private final class GateViewRefs { var head: Entity?; var orbAnchor: Entity?; var lobby: Entity?; var orb: Entity?; var creation: Entity?; var welcome: Entity?; var speedRef: MagicMirrorOrb.SpeedRef? }

// W1384 — 金球标记: 手势只盯带此标记的实体(金球), 不再 targetedToAnyEntity 截走大厅卡片的捏。
struct GateOrbMarker: Component {}

struct GateView: View {
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @EnvironmentObject var player: PlayerController     // W1382 — 编排搬进沉浸: 进影院装载作品
    @EnvironmentObject var settings: CathedralSettings
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace   // 从沉浸里开影院(系统自动换掉 GateSpace)
    @Environment(\.openWindow) private var openWindow                   // 创作=开 AI 输入窗(按需)
    @State private var refs = GateViewRefs()
    @State private var showLobby = false   // W1376 — 大厅沉浸面板显隐(捏魔镜→光束→登录→显)
    @State private var dragBase: SIMD3<Float>? = nil   // W1377 — 捏住金球拖动整个门
    // W1382 — 创作管线 + 进度球搬进沉浸(原在 2D 宿主窗 ContentView)。
    @State private var creating = false
    @State private var creatingSpell = ""
    @State private var creatingStage = ""
    @State private var creatingProgress = 0.0
    @State private var pendingSpell = ""

    var body: some View {
        // W1376 — Jing 铁律「沉浸里一切皆沉浸, 零 2D」: 星空 + 魔镜 3D 实体 + 大厅 LobbyView 作为
        //   沉浸 attachment(悬浮星空里), 全部在 GateSpace 内。2D 窗(ContentView)仅作隐形逻辑宿主。
        RealityView { content, attachments in
            content.add(ImmersiveScene.makeEnvironment(named: "cosmos"))
            let head = AnchorEntity(.head)
            content.add(head)
            refs.head = head
            // 魔镜 3D 实体(头前 1.4m, 略上移给下方大厅腾位; 自转 + 可凝视捏)。
            let speed = MagicMirrorOrb.SpeedRef()   // W1383 — 捏的瞬间转速猛增(发力感)
            let orb = MagicMirrorOrb.make(size: 0.22, speedRef: speed)
            orb.name = "gate-orb"
            orb.components.set(GateOrbMarker())   // W1384 — 标记金球, 手势只盯它
            refs.speedRef = speed
            let anchor = AnchorEntity(.head)
            orb.position = [0, 0.12, -1.4]
            anchor.anchoring.trackingMode = .once
            anchor.addChild(orb)
            content.add(anchor)
            refs.orbAnchor = anchor
            refs.orb = orb   // W1381 — 进大厅后隐藏这枚 gate 金球(大厅自带 logo 金球, 避免两个)
            // 大厅沉浸面板(初始隐藏, 与魔镜同锚, 悬在其下方)。
            if let lobby = attachments.entity(for: "lobby") {
                lobby.position = [0, -0.32, -1.45]
                lobby.isEnabled = false
                anchor.addChild(lobby)
                refs.lobby = lobby
            }
            // W1382 — 创作进度球 attachment(头前正中, 初始隐藏)。
            if let creation = attachments.entity(for: "creation") {
                creation.position = [0, 0, -1.4]
                creation.isEnabled = false
                anchor.addChild(creation)
                refs.creation = creation
            }
            // W1386 — 金球下方欢迎词(仅大门态显, 进大厅后隐)。
            if let welcome = attachments.entity(for: "welcome") {
                welcome.position = [0, -0.07, -1.4]   // 金球([0,0.12,-1.4])正下方
                anchor.addChild(welcome)
                refs.welcome = welcome
            }
            // W1386 — 少量【偶尔闪烁】的星(零解码、零新分配 → 内存可忽略): 让星空像活的。
            GateView.addTwinkleStars(to: anchor)
        } update: { _, _ in
            refs.lobby?.isEnabled = showLobby && !creating
            refs.orb?.isEnabled = !showLobby && !creating   // W1381 — 进圣殿大门 → gate 金球消失
            refs.creation?.isEnabled = creating              // W1382 — 创作时显进度球, 盖住大厅/金球
            refs.welcome?.isEnabled = !showLobby && !creating   // W1386 — 欢迎词只在大门态
        } attachments: {
            Attachment(id: "lobby") {
                LobbyView(
                    onEnter: { router.enter($0) },
                    onCreate: { router.doCreate = true },
                    onSpell: { router.spell = $0 },
                    signedIn: auth.isSignedIn,
                    onSignIn: { router.fireBeams = true }
                )
                .frame(width: 980, height: 720)
                .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 44))
            }
            // W1382 — 创作进度球(原 ContentView 2D overlay, 现沉浸 attachment)。
            Attachment(id: "creation") {
                CreationOrbView(spell: creatingSpell, stage: creatingStage, progress: creatingProgress)
                    .frame(width: 700, height: 520)
            }
            // W1386 — 金球下方欢迎词(金球孤零零转 → 加一句迎宾)。
            Attachment(id: "welcome") {
                VStack(spacing: 8) {
                    Text(L("Welcome to CSS Vision", "欢迎来到 CSS Vision"))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(L("Gaze the orb · pinch to enter the sanctuary",
                           "凝视魔镜 · 捏合步入圣殿"))
                        .font(.system(size: 18, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .shadow(color: .black.opacity(0.5), radius: 8, y: 2)
                .multilineTextAlignment(.center)
            }
        }
        // W1379 — 捏金球(纯捏, 不移动)→ 发射光点。SpatialTapGesture 才识别纯捏(DragGesture 需移动→纯捏不触发, 这是 W1377 进不了门的真凶)。
        // W1384 — 手势【只盯金球】(.has(GateOrbMarker)), 不再 targetedToAnyEntity → 大厅卡片的捏不再被截走。
        // W1385 — 大厅态把金球手势【让位给子视图(卡片)】: including:.subviews → RealityView 自身手势停用,
        //   大厅 attachment 里卡片的 onTapGesture 才能收到捏。大门态 .all → 金球手势正常。这是"捏不进卡片"真凶。
        .gesture(
            SpatialTapGesture().targetedToEntity(where: .has(GateOrbMarker.self)).onEnded { _ in
                bumpSpin()                                  // 捏瞬间转速猛增(发力感)
                if !router.fireBeams { router.fireBeams = true }
            },
            including: showLobby ? .subviews : .all
        )
        // 捏住金球【移动】→ 整个门(魔镜+大厅同锚)自由跟手走(3D)。minDist 大 → 纯捏让给上面的 tap。
        .simultaneousGesture(
            DragGesture(minimumDistance: 30).targetedToEntity(where: .has(GateOrbMarker.self))
                .onChanged { value in
                    guard let anchor = refs.orbAnchor else { return }
                    let cur = value.convert(value.location3D, from: .local, to: .scene)
                    if dragBase == nil { dragBase = anchor.position(relativeTo: nil) - cur }
                    anchor.setPosition(dragBase! + cur, relativeTo: nil)
                }
                .onEnded { _ in dragBase = nil },
            including: showLobby ? .subviews : .all
        )
        .onChange(of: router.fireBeams) { _, want in
            guard want else { return }
            router.fireBeams = false
            runBeamRitual()
        }
        // 光束飞完 → 登录成功 → 大厅沉浸面板浮现 + 接力待办咒语(零 2D)。
        .onChange(of: auth.isSignedIn) { _, signed in
            if signed {
                withAnimation(.easeInOut(duration: 0.4)) { showLobby = true }
                if !pendingSpell.isEmpty { let s = pendingSpell; pendingSpell = ""; startSpell(s) }
            }
        }
        // W1382 — 编排全搬进沉浸: 选作品→进影院; 创作→开AI窗; 咒语→创作管线(原在2D宿主窗)。
        .onChange(of: router.enterToken) { _, _ in
            if let w = router.pendingWork { Task { await enterCinema(work: w) } }
        }
        .onChange(of: router.doCreate) { _, v in
            if v { router.doCreate = false; openWindow(id: "ai") }
        }
        .onChange(of: router.spell) { _, s in
            if let s { router.spell = nil; startSpell(s) }
        }
    }

    // W1383 — 捏瞬间转速猛增 → ~0.9s 衰减回常速(发力感; 替代凝视加速——苹果隐私不给读注视点)。
    private func bumpSpin() {
        guard let s = refs.speedRef else { return }
        s.mult = 8
        Task { @MainActor in
            for i in 1...18 {
                try? await Task.sleep(nanoseconds: 50_000_000)
                s.mult = max(1, 8 - 7 * Float(i) / 18)
            }
            s.mult = 1
        }
    }

    // W1382 — 进影院: 装载作品 + 开 ImmersiveCinema(系统自动换掉当前 GateSpace)。
    private func enterCinema(work: CSSWork) async {
        player.load(work)
        _ = await openImmersiveSpace(id: "ImmersiveCinema")
        settings.hasEnteredOnce = true
    }

    // W1382 — 咒语创作(原 ContentView.startSpell 搬来): 进度走 CreationOrbView attachment。
    private func startSpell(_ spell: String) {
        let s = spell.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty, !creating else { return }
        guard auth.isSignedIn else { pendingSpell = s; router.fireBeams = true; return }   // 未登录→先光束登录, 记住咒语
        creatingSpell = s; creatingProgress = 0.05
        creatingStage = L("Reading your spell…", "解读咒语…")
        withAnimation(.easeInOut(duration: 0.3)) { creating = true }
        let stages: [(String, Double)] = [
            (L("Weaving the lyrics…", "吟唱歌词…"), 0.30),
            (L("Painting the cover…", "绘制封面…"), 0.50),
            (L("Composing the music…", "谱写旋律…"), 0.72),
            (L("Filming the visuals…", "绘制画面…"), 0.88),
            (L("Final mix…", "合成成片…"), 0.97),
        ]
        Task {
            for (label, p) in stages {
                try? await Task.sleep(nanoseconds: 1_400_000_000)
                if !creating { return }
                creatingStage = label; creatingProgress = p
            }
        }
        Task {
            let work = await CSSBackend.createFromPrompt(s)
            withAnimation { creating = false }
            if let w = work { await enterCinema(work: w) } else { creatingStage = "" }
        }
    }

    // W1378 — Jing「光束从金球中心射出, 别跟眼睛走」: 改锚到【gate anchor】(=魔镜所在,
    //   trackingMode .once 世界固定), 不再用 live head 锚 → 用户转头, 光束仍从金球中心射出。
    //   且光束飞完 → 直接显圣殿大门(浏览公开, 不卡登录), 同时静默走 Optic ID 同步收藏。
    private func runBeamRitual() {
        guard let anchor = refs.orbAnchor else { return }
        // W1385 — 光束起点动态: 已在大厅(showLobby)→ 从【大厅顶部金球中心】射出; 还在大门 → 从 gate 金球中心射。
        let origin = showLobby ? GateView.lobbyOrbCenter : GateView.orbCenter
        Task { @MainActor in
            for _ in 0..<10 {
                fireWave(from: anchor, origin: origin)
                try? await Task.sleep(nanoseconds: 550_000_000)
            }
            withAnimation(.easeInOut(duration: 0.45)) { showLobby = true }   // 光点散 → 圣殿大门浮现
            try? await Task.sleep(nanoseconds: 250_000_000)
            await auth.signInViaOrb()
        }
    }

    // W1386 — 少量偶尔闪烁的星(让星空像活的)。内存可忽略: 18 颗微小 emissive 球, 无贴图/无解码;
    //   一个 Task 每隔随机间隔挑【一颗】淡入淡出 → 几乎不耗 CPU、零新分配。
    @MainActor static func addTwinkleStars(to anchor: Entity) {
        var stars: [ModelEntity] = []
        for i in 0..<18 {
            let s = ModelEntity(mesh: .generateSphere(radius: Float.random(in: 0.004...0.009)))
            var m = UnlitMaterial(color: UIColor(white: 1, alpha: 1))
            m.blending = .transparent(opacity: 0.0)
            s.model?.materials = [m]
            // 散布在四周中远景(避开正前金球区), 半球壳上随机。
            let az = Float(i) / 18 * 2 * .pi + Float.random(in: -0.3...0.3)
            let el = Float.random(in: -0.5...0.9)
            let rad = Float.random(in: 2.6...4.2)
            s.position = [rad * cos(el) * sin(az), rad * sin(el) + 0.4, -rad * cos(el) * cos(az)]
            s.components.set(OpacityComponent(opacity: 0))
            anchor.addChild(s)
            stars.append(s)
        }
        Task { @MainActor in
            while !Task.isCancelled {
                if anchor.scene == nil { try? await Task.sleep(nanoseconds: 200_000_000); continue }
                guard let star = stars.randomElement() else { break }
                // 淡入 → 停 → 淡出(一颗闪一下), 随机峰值亮度。
                let peak = Float.random(in: 0.6...1.0)
                for k in 0...8 { star.components.set(OpacityComponent(opacity: peak * Float(k) / 8)); try? await Task.sleep(nanoseconds: 30_000_000) }
                try? await Task.sleep(nanoseconds: UInt64.random(in: 250_000_000...700_000_000))
                for k in 0...10 { star.components.set(OpacityComponent(opacity: peak * (1 - Float(k) / 10))); try? await Task.sleep(nanoseconds: 35_000_000) }
                try? await Task.sleep(nanoseconds: UInt64.random(in: 700_000_000...2_200_000_000))   // 下一颗的间隔
            }
        }
    }

    /// 金球所在(gate anchor 局部坐标): 与 body 里 orb.position 一致。
    private static let orbCenter = SIMD3<Float>(0, 0.12, -1.4)
    /// W1385 — 大厅顶部金球中心(LobbyView 面板 [0,-0.32,-1.45], 金球在面板顶部 → 约高 0.18m)。
    private static let lobbyOrbCenter = SIMD3<Float>(0, -0.14, -1.44)

    /// 一波光束: 随机数量、随机色, 从眼前真冲进眼心、穿到脑后(快 = "射")。
    /// CSSOS_WAVE_1096 — Jing「光束太规则显假, 要像影视剧扫描眼睛那种不规则光束」:
    ///   不再是一束齐刷刷平行、同时同速的整齐光柱。每根光束的【长度/粗细/朝向倾斜/
    ///   起射时刻/飞行速度/透明度】全部独立随机 → 长短错落、根根不平行、错峰乱射、
    ///   明暗不一, 像扫描光。
    /// W1378 — 一波光点: 全部【从金球中心射出】, 向用户方向(+Z)冲并散开穿过。每颗大小/速度/
    ///   起射时刻/明暗/颜色各异。锚在世界固定的 gate anchor, 用户转头光束不跟随。
    @MainActor private func fireWave(from anchor: Entity, origin: SIMD3<Float>) {
        let c = origin
        let n = Int.random(in: 22...40)
        for _ in 0..<n {
            let color = UIColor(hue: CGFloat.random(in: 0...1),
                                saturation: CGFloat.random(in: 0.7...1.0),
                                brightness: 1.0, alpha: 1.0)
            let r = Float.random(in: 0.006...0.026)
            let dot = ModelEntity(mesh: .generateSphere(radius: r))
            dot.model?.materials = [UnlitMaterial(color: color)]
            // 起点 = 金球中心(微抖, 像从球心迸出)
            let start = c + SIMD3<Float>(Float.random(in: -0.03...0.03),
                                         Float.random(in: -0.03...0.03), 0)
            dot.position = start
            dot.components.set(OpacityComponent(opacity: Float.random(in: 0.55...1.0)))
            let delay = Double.random(in: 0 ... 0.5)
            let dur = Double.random(in: 0.5...1.8)
            // 终点 = 从球心向用户(+Z)冲并散开、穿过用户(用户在 gate anchor 原点附近)。
            let end = c + SIMD3<Float>(Float.random(in: -0.5...0.5),
                                       Float.random(in: -0.4...0.4),
                                       Float.random(in: 1.6...2.4))
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                anchor.addChild(dot)
                var t = dot.transform
                t.translation = end
                dot.move(to: t, relativeTo: anchor, duration: dur,
                         timingFunction: Bool.random() ? .easeIn : .easeInOut)
                DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.15) { dot.removeFromParent() }
            }
        }
    }
}
