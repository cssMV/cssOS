// CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(阶段2)。整个大厅在沉浸空间里, 不再是 2D 窗口。
//   · 星空(cosmos)环绕环境;
//   · 大厅 UI(LobbyView)作为浮空面板 attachment, 悬在你正前方;
//   · 捏大厅金球 → 头部锚点 AnchorEntity(.head) 上随机色光束【一波接一波真飞进眼睛、穿到脑后】(同一空间内, 不退出) → Optic ID;
//   · 选作品/创作/咒语 → 经 GateRouter 回传给窗口 ContentView 编排(切影院/开AI窗)。
//   头部坐标系: -Z = 正前方, +Z = 脑后。

import SwiftUI
import RealityKit
import UIKit
import simd

private final class GateViewRefs { var head: Entity?; var orbAnchor: Entity?; var lobby: Entity?; var orb: Entity?; var creation: Entity?; var welcome: Entity?; var speedRef: MagicMirrorOrb.SpeedRef? }

// W1384 — 金球标记: 手势只盯带此标记的实体(金球), 不再 targetedToAnyEntity 截走大厅卡片的捏。
struct GateOrbMarker: Component {}

struct GateView: View {
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @EnvironmentObject var player: PlayerController     // W1382 — 编排搬进沉浸: 进影院装载作品
    @EnvironmentObject var settings: CathedralSettings
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace   // 从沉浸里开影院
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace  // W1388 — 开影院前必须先关 GateSpace(否则 open 静默 .error)
    @Environment(\.openWindow) private var openWindow                   // 创作=开 AI 输入窗(按需)
    @State private var refs = GateViewRefs()
    @State private var showLobby = false   // W1376 — 大厅沉浸面板显隐(捏魔镜→光束→登录→显)
    @State private var showCinema = false  // W1389 — 同空间内切到影院(不再切独立 ImmersiveCinema 空间)
    @State private var dragBase: SIMD3<Float>? = nil   // W1377 — 捏住金球拖动整个门
    // W1382 — 创作管线 + 进度球搬进沉浸(原在 2D 宿主窗 ContentView)。
    @State private var creating = false
    @State private var creatingSpell = ""
    @State private var creatingStage = ""
    @State private var creatingProgress = 0.0
    @State private var pendingSpell = ""

    var body: some View {
        // W1389 — 卡片进不去真凶根治: 不再切到独立 ImmersiveCinema 空间(GateSpace 还开着时 open 另一个会静默 .error,
        //   且宿主窗已关 → dismiss 后零场景无法续开)。改成【同一个 GateSpace 内】切 gate↔cinema → 零空间切换, 稳。
        if showCinema {
            ImmersiveView()
        } else {
            gateBody
        }
    }

    private var gateBody: some View {
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
            orb.position = GateView.lobbyOrbCenter   // W1389 — 启动金球落在大厅顶部金球位 → 消失即重现的错觉(像同一枚)
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
                welcome.position = [0, -0.42, -1.43]   // W1389 — 金球已下移到大厅金球位 → 欢迎词随之下移到其正下方
                anchor.addChild(welcome)
                refs.welcome = welcome
            }
            // W1391 — 体积星空: 真 3D 散布四周(有远有近=包围感), 随机形状/角数, 随机闪烁 + 偶发流星。
            StarfieldVolume.make(into: anchor)
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

    // W1388 — 进影院(卡片捏出声却进不去的真凶): visionOS 一次只允许一个 ImmersiveSpace,
    //   GateSpace 还开着时直接 openImmersiveSpace 会静默返回 .error → 必须【先 dismiss 当前再 open】。
    //   enterCinema 由独立 Task 调用(非 .task), 不随 GateView 消失而取消 → dismiss 后仍能续开影院。
    private func enterCinema(work: CSSWork) async {
        var w = work
        // W1410 — 情绪字幕 + 多语言胶囊【都能显示】的关键: 大厅作品 toWork 不带 variants/lyrics →
        //   进影院【前】用真 id 拉 subtitle JSON 一次给齐(各语言变体 + 逐字 orig 歌词), 注入后再 load,
        //   这样 ImmersiveView 建银幕/胶囊时就有多变体, 字幕也有逐字 token。无 subtitle JSON 的作品则照常单语言无字幕。
        if (w.variants ?? []).isEmpty, let v = w.videoURL {
            let langs = await CSSBackend.fetchLanguageVariants(workID: w.id, video: v, audio: w.audioURL ?? v)
            if !langs.isEmpty {
                w.alignedLyrics = langs.first(where: { $0.id == "orig" })?.alignedLyrics ?? langs.first?.alignedLyrics
                let others = langs.filter { $0.id != "orig" }
                w.variants = others.isEmpty ? nil : others
            } else if let lines = await CSSBackend.fetchAlignedLyrics(workID: w.id), !lines.isEmpty {
                w.alignedLyrics = lines   // 单语言但有逐字字幕 → 至少情绪字幕出
            }
        }
        player.load(w)                         // 装载(ImmersiveView 读同一 PlayerController, 此时已带多变体+歌词)
        settings.hasEnteredOnce = true
        withAnimation(.easeInOut(duration: 0.35)) { showCinema = true }   // 同空间内切到影院(零空间切换)
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

    /// W1389 — 启动金球 = 大厅顶部金球位(同一坐标 → 消失即重现的错觉)。两态光束同源。
    static let lobbyOrbCenter = SIMD3<Float>(0, -0.14, -1.44)
    private static let orbCenter = lobbyOrbCenter

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

// W1391 — 体积星空: 真 3D 散布于用户【四周】(有远有近=包围感), 每颗随机形状/角数/距离,
//   随机闪烁(变色+胀大+提亮) + 偶发拖尾流星。取代旧的"贴在远球上的平面星点"(无景深)。
//   大厅 + 影院共用。共享少量星形贴图 → 零解码, 内存可忽略。
enum StarfieldVolume {
    /// 多种角数 + 随机旋转的星形 sprite(4~8 角), 每颗星随机选一张 → 形状各异。
    static let sprites: [TextureResource] = {
        var arr: [TextureResource] = []
        for pts in [6, 7, 8, 9, 10, 12, 6, 8, 7] {   // W1401 — Jing: 必须 6 角以上(去掉 3/4/5 角)
            let px = 128
            let r = UIGraphicsImageRenderer(size: CGSize(width: px, height: px))
            let img = r.image { ctx in
                ctx.cgContext.setFillColor(UIColor.white.cgColor)
                ImmersiveScene.fillStar(in: ctx.cgContext, cx: 64, cy: 64, radius: 58,
                                        points: pts, rotation: CGFloat.random(in: 0 ..< .pi))
            }
            if let cg = img.cgImage, let t = try? TextureResource(image: cg, options: .init(semantic: .color)) {
                arr.append(t)
            }
        }
        return arr
    }()

    /// 流星拖尾贴图(头亮→尾透明的横向渐变), 缓存一次。
    static let meteorTex: TextureResource? = {
        let w = 256, h = 32
        let r = UIGraphicsImageRenderer(size: CGSize(width: w, height: h))
        let img = r.image { ctx in
            let cols = [UIColor.white.withAlphaComponent(0).cgColor,
                        UIColor.white.withAlphaComponent(0.12).cgColor,
                        UIColor.white.withAlphaComponent(0.85).cgColor,
                        UIColor.white.cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: cols, locations: [0, 0.62, 0.94, 1.0])!
            ctx.cgContext.drawLinearGradient(g, start: CGPoint(x: 0, y: CGFloat(h) / 2),
                                             end: CGPoint(x: CGFloat(w), y: CGFloat(h) / 2), options: [])
        }
        guard let cg = img.cgImage else { return nil }
        return try? TextureResource(image: cg, options: .init(semantic: .color))
    }()

    /// W1392 — 内存优化: 全体星(及流星)共用【同一张 1×1 网格】, 大小靠 scale →
    ///   不再每颗 generatePlane 各生成一份网格(数百份→1 份)。贴图本就共享。
    static let unitPlane: MeshResource = .generatePlane(width: 1, height: 1)

    @MainActor static func starPlane(tint: UIColor, opacity: Float, tex: TextureResource?) -> ModelEntity {
        var m = UnlitMaterial()
        if let tex { m.color = .init(tint: tint, texture: .init(tex)) } else { m.color = .init(tint: tint) }
        m.blending = .transparent(opacity: .init(floatLiteral: opacity))
        m.opacityThreshold = nil
        return ModelEntity(mesh: unitPlane, materials: [m])   // 共用网格
    }

    @MainActor static func make(into anchor: Entity, count: Int = 2200) {   // W1398 — 近景星密度大增, 逼近背景密度(共用网格内存零头; 若掉帧再降)
        var stars: [(ModelEntity, TextureResource?, UIColor, Float)] = []   // (实体, 贴图, 本色, 本亮度)
        for _ in 0..<count {
            // 均匀分布在【整个球面】→ 四周(含侧后)都有星, 包围感。
            let u = Float.random(in: -1...1)
            let phi = Float.random(in: 0 ..< 2 * .pi)
            let rr = (1 - u * u).squareRoot()
            var dir = SIMD3<Float>(rr * cos(phi), u, rr * sin(phi))
            if abs(dir.z - 1) < 0.001 { dir.x += 0.02 }   // 避开 from==to 退化
            let rad = Float.random(in: 1.3...8.0)         // 有远有近
            let pos = dir * rad + SIMD3<Float>(0, 0.2, 0)
            let w = Float.random(in: 0.025...0.10) * (1 + rad * 0.05)   // W1396 — 允许更大
            let op = Float.random(in: 0.3...0.85) * (rad < 3 ? 1.0 : 0.8)
            let tex = sprites.randomElement() ?? nil
            // W1396 — 约 40% 的星带随机色(其余白): 真实夜空=多数白、少数偏蓝/金/红。
            let tint: UIColor = Float.random(in: 0...1) < 0.40
                ? UIColor(hue: CGFloat.random(in: 0...1), saturation: CGFloat.random(in: 0.4...0.9), brightness: 1, alpha: 1)
                : .white
            let star = starPlane(tint: tint, opacity: op, tex: tex)
            star.scale = SIMD3<Float>(repeating: w)   // 大小靠缩放(共用网格)
            star.position = pos
            star.orientation = simd_quatf(from: SIMD3<Float>(0, 0, 1), to: -simd_normalize(pos))   // 面向用户
            anchor.addChild(star)
            stars.append((star, tex, tint, op))
        }
        // 闪烁: 每隔随机间隔挑 1~3 颗变色+胀大+提亮再复原。
        Task { @MainActor in
            while !Task.isCancelled {
                if anchor.scene == nil { try? await Task.sleep(nanoseconds: 200_000_000); continue }
                for _ in 0..<Int.random(in: 1...3) {
                    if let s = stars.randomElement() { Task { @MainActor in await twinkle(s.0, tex: s.1, restTint: s.2, restOp: s.3) } }
                }
                try? await Task.sleep(nanoseconds: UInt64.random(in: 350_000_000...1_100_000_000))
            }
        }
        // 偶发拖尾流星(一次 1~3 颗, 偶尔成群, 不太多)。
        Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64.random(in: 6_000_000_000...16_000_000_000))
                if anchor.scene == nil { continue }
                let n = [1, 1, 1, 2, 2, 3].randomElement() ?? 1   // 多数 1~2 颗, 偶尔 3
                for i in 0..<n {
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: UInt64(i) * UInt64.random(in: 120_000_000...420_000_000))
                        if anchor.scene != nil { await meteor(in: anchor) }
                    }
                }
            }
        }
    }

    @MainActor static func twinkle(_ star: ModelEntity, tex: TextureResource?, restTint: UIColor, restOp: Float) async {
        let rest = star.scale.x
        let flash = UIColor(hue: CGFloat.random(in: 0...1), saturation: 0.85, brightness: 1, alpha: 1)
        let grow = Float.random(in: 1.8...3.4)
        func paint(_ tint: UIColor, _ op: Float) {
            var m = UnlitMaterial()
            if let tex { m.color = .init(tint: tint, texture: .init(tex)) } else { m.color = .init(tint: tint) }
            m.blending = .transparent(opacity: .init(floatLiteral: op)); m.opacityThreshold = nil
            star.model?.materials = [m]
        }
        for k in 0...8 {   // 涨: 变闪烁色 + 胀大 + 提亮
            let t = Float(k) / 8
            star.scale = SIMD3<Float>(repeating: rest * (1 + (grow - 1) * t))
            paint(flash, 0.5 + 0.5 * t)
            try? await Task.sleep(nanoseconds: 28_000_000)
        }
        try? await Task.sleep(nanoseconds: UInt64.random(in: 120_000_000...360_000_000))
        for k in 0...12 {   // 退: 缩回 + 亮度渐回各自本亮度
            let t = Float(k) / 12
            star.scale = SIMD3<Float>(repeating: rest * (grow - (grow - 1) * t))
            paint(flash, 1.0 + (restOp - 1.0) * t)
            try? await Task.sleep(nanoseconds: 34_000_000)
        }
        paint(restTint, restOp)   // W1396 — 落回这颗星【各自的本色/本亮度】(不再统一白)
        star.scale = SIMD3<Float>(repeating: rest)
    }

    @MainActor static func meteor(in anchor: Entity) async {
        let len = Float.random(in: 0.55...1.0)
        let thick = Float.random(in: 0.03...0.06)
        let m = ModelEntity(mesh: unitPlane)   // 共用网格, 拖尾长短/粗细靠缩放
        m.scale = SIMD3<Float>(len, thick, 1)
        let tint = UIColor(hue: CGFloat.random(in: 0...1), saturation: CGFloat.random(in: 0.55...1.0), brightness: 1, alpha: 1)   // W1410 — 尾巴随机色
        func paint(_ op: Float) {
            var mat = UnlitMaterial()
            if let tex = meteorTex { mat.color = .init(tint: tint, texture: .init(tex)) } else { mat.color = .init(tint: tint) }
            mat.blending = .transparent(opacity: .init(floatLiteral: op)); mat.opacityThreshold = nil
            m.model?.materials = [mat]
        }
        // W1410 — 多方向: 从天际一侧任意角度斜划到对侧(横/竖/斜都行), 飞到天际外消失。
        let z0 = Float.random(in: -5.0 ... -2.6)
        let a = Float.random(in: 0 ..< (2 * .pi))                    // 入场方向(任意)
        let r0 = Float.random(in: 2.2...3.2)
        let start = SIMD3<Float>(cos(a) * r0, 0.7 + sin(a) * r0 * 0.85, z0)
        let across = a + .pi + Float.random(in: -1.0...1.0)          // 出场方向≈对侧 + 随机散
        let r1 = Float.random(in: 2.4...3.6)
        let end = SIMD3<Float>(cos(across) * r1, 0.7 + sin(across) * r1 * 0.85, z0 + Float.random(in: -0.6...0.6))
        m.orientation = simd_quatf(angle: atan2(end.y - start.y, end.x - start.x), axis: [0, 0, 1])
        m.position = start; paint(0); anchor.addChild(m)
        let steps = 28, dur = Double.random(in: 0.7...1.3)
        for k in 0...steps {
            let t = Float(k) / Float(steps)
            m.position = start + (end - start) * t
            paint(max(0, t < 0.16 ? t / 0.16 : (1 - (t - 0.16) / 0.84)))
            try? await Task.sleep(nanoseconds: UInt64(dur * 1_000_000_000 / Double(steps)))
        }
        m.removeFromParent()
    }
}
