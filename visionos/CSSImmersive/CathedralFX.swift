// CSSOS_WAVE_940 — CathedralFX: 魔镜圣殿空间特效全家桶。全部由已有的逐字情绪/强度时间轴驱动,
// 与 W938 爆字幕同源(burstSubject)。包含:
//   · 天女散花(emoji/花瓣从天而降, 真 3D 景深)
//   · 高音爆闪(强度峰值 → 整个圣殿一闪)
//   · 节拍地板(脚下光环随强度脉冲)
//   · 环境随情绪(天空盒色调跟当前情绪走)
//   · 音浪粒子(强度驱动周身光点)

import RealityKit
import UIKit
import simd

enum CathedralFX {

    static let petals = ["🌸", "✨", "🔥", "💧", "⭐️", "🌟", "❄️", "🍃"]

    // W956 — 真因: RealityKit generateText 画不出【彩色 emoji】(只渲染字形轮廓→emoji 是彩色位图
    //   字形→空网格→看不见)。所以花瓣/背景 emoji 一直不出现。修: 把 emoji 画进 UIImage → 贴到
    //   小平面(textured quad), 彩色 emoji 正常显示。汉字爆字仍可用 generateText(那是矢量字形)。
    static func emojiPlane(_ glyph: String, size: Float) -> ModelEntity {
        let px: CGFloat = 128
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: px, height: px))
        let img = renderer.image { _ in
            let s = NSString(string: glyph)
            let font = UIFont.systemFont(ofSize: 100)
            let b = s.size(withAttributes: [.font: font])
            s.draw(at: CGPoint(x: (px - b.width) / 2, y: (px - b.height) / 2), withAttributes: [.font: font])
        }
        let plane = ModelEntity(mesh: .generatePlane(width: size, height: size))
        if let cg = img.cgImage, let tex = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            var m = UnlitMaterial()
            m.color = .init(tint: .white, texture: .init(tex))
            m.blending = .transparent(opacity: 1.0)   // 用贴图 alpha → emoji 周围透明
            m.opacityThreshold = nil
            plane.model?.materials = [m]
        }
        return plane
    }

    // CSSOS_WAVE_1051 — 双面 emoji 卡(正反两面贴同一字), 翻滚时永远可见(单面平面翻到背面会消失)。
    static func emojiCard(_ glyph: String, size: Float) -> Entity {
        let card = Entity()
        let front = emojiPlane(glyph, size: size)
        let back = emojiPlane(glyph, size: size)
        back.orientation = simd_quatf(angle: .pi, axis: SIMD3<Float>(0, 1, 0))  // 翻 180° 贴背面
        card.addChild(front)
        card.addChild(back)
        return card
    }

    // CSSOS_WAVE_1051 — 翻滚注册表: 一个共享 30fps 定时器驱动所有飘落卡片【绕随机倾斜轴持续翻转】,
    //   不给每片花瓣单开 Task(几十片同时会很重)。平移仍由 RealityKit move(to:) GPU 驱动。
    private struct CSpin { let e: Entity; let axis: SIMD3<Float>; let speed: Float; let deadline: Date }
    private static var spins: [CSpin] = []
    private static var spinTimer: Timer?
    static func spinTumble(_ e: Entity, dur: Double) {
        let axis = simd_normalize(SIMD3<Float>(Float.random(in: -0.6...0.6),
                                               Float.random(in: 0.4...1.0),
                                               Float.random(in: -0.6...0.6)))
        // W1055 — 翻滚速度旋钮(控制台滑杆写 UserDefaults)。
        let spinMul = (UserDefaults.standard.object(forKey: "cssPetalSpin") as? Double).map { Float($0) } ?? 1.0
        let speed = Float.random(in: 1.6...3.4) * spinMul * (Bool.random() ? 1 : -1)   // rad/s, 顺/逆随机
        spins.append(CSpin(e: e, axis: axis, speed: speed, deadline: Date().addingTimeInterval(dur)))
        if spinTimer == nil {
            spinTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { _ in tickSpins() }
        }
    }
    private static func tickSpins() {
        let now = Date(); let dt: Float = 1.0 / 30.0
        spins = spins.filter { it in
            guard it.e.parent != nil, now < it.deadline else { return false }
            it.e.orientation = it.e.orientation * simd_quatf(angle: it.speed * dt, axis: it.axis)
            return true
        }
        if spins.isEmpty { spinTimer?.invalidate(); spinTimer = nil }
    }

    // ── 天女散花(3D 翻滚版): 从头顶正上方随机落下, 边落边绕随机轴翻滚, 飘到脚下淡出 ──────
    //   W967 — around = 头显实时位置; W1051 — 双面卡 + 翻滚 = 真 3D 飘落感, 不再是平贴卡片下滑。
    static func petalRain(into root: Entity, emotion: String, count: Int,
                          around center: SIMD3<Float> = SIMD3<Float>(0, 1.5, 0),
                          mesh3D: Bool = false) {
        for _ in 0..<count {
            let glyph = petals.randomElement() ?? "✨"
            let size = Float.random(in: 0.06...0.12)   // W970 — 花瓣调小, 不抢字心爆字的戏
            let x = center.x + Float.random(in: -1.5...1.5)
            let z = center.z + Float.random(in: -1.5...1.5)
            // carrier 负责平移(GPU), card 负责翻滚(共享定时器) → 两者互不打架。
            let carrier = Entity()
            carrier.position = SIMD3<Float>(x, center.y + 1.4, z)
            // W1054/W1056 — mesh3D = 真 3D 网格(MeshPetal3D, 覆盖全部用到的 emoji); 无对应网格则回退 emoji 双面卡。
            let card: Entity
            if mesh3D, let m3 = MeshPetal3D.make(for: glyph) {
                card = m3
                let sc = max(0.55, size / 0.08) * MeshPetal3D.sizeMul()
                card.scale = SIMD3<Float>(sc, sc, sc)
            } else {
                card = emojiCard(glyph, size: size)
            }
            card.orientation = simd_quatf(angle: Float.random(in: 0...(.pi * 2)),
                                          axis: simd_normalize(SIMD3<Float>(Float.random(in: -1...1), 1, Float.random(in: -1...1))))
            carrier.addChild(card)
            carrier.components.set(OpacityComponent(opacity: 0.95))   // 层级不透明, 含子卡
            root.addChild(carrier)
            var down = carrier.transform
            down.translation = SIMD3<Float>(x + Float.random(in: -0.5...0.5), center.y - 1.6, z)
            let dur = Double.random(in: 2.6...4.2)
            carrier.move(to: down, relativeTo: root, duration: dur, timingFunction: .easeIn)
            spinTumble(card, dur: dur + 0.2)
            DispatchQueue.main.asyncAfter(deadline: .now() + dur - 0.6) {
                carrier.components.set(OpacityComponent(opacity: 0))
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.1) { carrier.removeFromParent() }
        }
    }

    // ── W1070 间奏/前奏/尾声: emoji 从【四边】飞进画面中央(对应桌面"四边框小 emoji 飘进媒体框")──
    //   没在唱的器乐段触发(ImmersiveView 按"近期无爆字"判定); 左/右/上/下各发射, 飘向画面深处中央后淡出。
    //   注: 真·音量同步需音频分析器(Vision 暂无)→ 现版定时发射, 数量可由调用方按强度给。
    static func musicEdgeEmoji(into root: Entity, emotion: String, count: Int,
                               around center: SIMD3<Float> = SIMD3<Float>(0, 1.5, 0)) {
        let mesh3D = (UserDefaults.standard.object(forKey: "cssPetal3D") as? Bool) ?? false
        let pool = SpatialSubtitleSystem.emojiPool(for: emotion)
        for i in 0..<max(1, count) {
            let glyph = pool.randomElement() ?? "✨"
            let node: Entity = (mesh3D ? MeshPetal3D.make(for: glyph) : nil)
                ?? emojiPlane(glyph, size: Float.random(in: 0.06...0.11))
            if mesh3D { let s = Float.random(in: 0.7...1.2); node.scale = SIMD3<Float>(s, s, s) }
            let spread = Float.random(in: -1.3...1.3)
            var start = center
            switch i % 4 {
            case 0:  start = center + SIMD3<Float>(-1.7, spread * 0.5, -1.0)   // 左边框进
            case 1:  start = center + SIMD3<Float>( 1.7, spread * 0.5, -1.0)   // 右
            case 2:  start = center + SIMD3<Float>(spread, 1.1, -1.2)          // 上
            default: start = center + SIMD3<Float>(spread, -0.9, -1.0)         // 下
            }
            node.position = start
            node.components.set(OpacityComponent(opacity: 0.92))
            root.addChild(node)
            var to = node.transform
            to.translation = center + SIMD3<Float>(Float.random(in: -0.3...0.3), Float.random(in: -0.2...0.3), -1.7)
            let dur = Double.random(in: 2.2...3.6)
            node.move(to: to, relativeTo: nil, duration: dur, timingFunction: .easeOut)
            DispatchQueue.main.asyncAfter(deadline: .now() + dur - 0.6) { node.components.set(OpacityComponent(opacity: 0)) }
            DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.1) { node.removeFromParent() }
        }
    }

    // ── 高音爆闪: 一层包裹用户的半透明球, 瞬间亮一下再消 ────────────────────
    static func highNoteFlash(into root: Entity, emotion: String) {
        let mesh = MeshResource.generateSphere(radius: 6)
        var mat = UnlitMaterial(color: SpatialSubtitleSystem.color(for: emotion).withAlphaComponent(0.16))
        mat.blending = .transparent(opacity: .init(floatLiteral: 0.16))
        let flash = ModelEntity(mesh: mesh, materials: [mat])
        flash.scale = .init(x: -1, y: 1, z: 1)               // 从内部可见
        flash.components.set(OpacityComponent(opacity: 0))
        root.addChild(flash)
        flash.components.set(OpacityComponent(opacity: 0.9))
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            flash.components.set(OpacityComponent(opacity: 0))
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { flash.removeFromParent() }
    }

    // ── 节拍地板: 脚下一圈光环, 强度越大涨得越大 ──────────────────────────
    static func makeFloorRing() -> ModelEntity {
        let mesh = MeshResource.generatePlane(width: 3, depth: 3, cornerRadius: 1.5)
        var mat = UnlitMaterial(color: UIColor(white: 1, alpha: 0.06))
        mat.blending = .transparent(opacity: .init(floatLiteral: 0.06))
        let ring = ModelEntity(mesh: mesh, materials: [mat])
        ring.position = SIMD3<Float>(0, -1.3, -1.0)
        return ring
    }
    static func pulseFloor(_ ring: ModelEntity, intensity: Float, emotion: String) {
        let s = 1.0 + 0.5 * max(0, min(1, intensity))
        var grow = ring.transform
        grow.scale = SIMD3<Float>(s, 1, s)
        ring.move(to: grow, relativeTo: ring.parent, duration: 0.12, timingFunction: .easeOut)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            var back = ring.transform; back.scale = .one
            ring.move(to: back, relativeTo: ring.parent, duration: 0.5, timingFunction: .easeOut)
        }
    }

    // ── 环境随情绪: 天空盒底色朝当前情绪色平滑过渡 ────────────────────────
    static func tintEnvironment(_ envModel: ModelEntity, emotion: String) {
        let c = SpatialSubtitleSystem.color(for: emotion)
        // 压暗当背景(别太亮抢戏)。
        var dim = UIColor(white: 0, alpha: 1)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        c.getRed(&r, green: &g, blue: &b, alpha: &a)
        dim = UIColor(red: r * 0.18, green: g * 0.18, blue: b * 0.22, alpha: 1)
        envModel.model?.materials = [UnlitMaterial(color: dim)]
    }
}
