// CSSOS_WAVE_1050 — 魔镜金球(App 内自转 logo)。
//   · 金色光球贴图平面, 绕 Z 轴持续旋转(光芒像风车扫过), 可顺/逆时针。
//   · 背后一层光晕(additive halo), 做【随机发光脉动】——不规则地一明一暗, 像有生命的奇迹之光。
//   · 轻微缩放呼吸, 增强"漂浮"感。
//   贴图: 复用资产目录里的 "MirrorOrb"(已更新为干净紧裁金球);
//        缺图时自动回退到程序生成的金色径向光球, 保证一定能跑。
//
//   用法 A(独立窗口/启动 logo):  MagicMirrorOrbView().frame(...)
//   用法 B(塞进沉浸场景):       content.add(MagicMirrorOrb.make(size: 0.4, clockwise: true))

import SwiftUI
import RealityKit
import UIKit
import simd

enum MagicMirrorOrb {

    /// W1370 — 通用贴图加载(按资产名)。给静态尖角托盘 "MirrorRing" 用。
    static func namedTexture(_ name: String) -> TextureResource? {
        if let ui = UIImage(named: name), let cg = ui.cgImage,
           let t = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            return t
        }
        return nil
    }

    /// 金球贴图(复用资产 "MirrorOrb"); 缺图则程序生成金色径向光球。
    static func orbTexture() -> TextureResource? {
        if let ui = UIImage(named: "MirrorOrb"), let cg = ui.cgImage,
           let t = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            return t
        }
        // 回退: 画一个金色径向高光球(中心爆白 → 金边)。
        let px: CGFloat = 512
        let r = UIGraphicsImageRenderer(size: CGSize(width: px, height: px))
        let img = r.image { ctx in
            let c = ctx.cgContext
            let center = CGPoint(x: px/2, y: px/2)
            let cols = [UIColor(white: 1, alpha: 1).cgColor,
                        UIColor(red: 1, green: 0.92, blue: 0.55, alpha: 1).cgColor,
                        UIColor(red: 0.85, green: 0.66, blue: 0.18, alpha: 1).cgColor,
                        UIColor(red: 0.55, green: 0.40, blue: 0.05, alpha: 0).cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: cols,
                               locations: [0, 0.18, 0.72, 1])!
            c.drawRadialGradient(g, startCenter: center, startRadius: 0,
                                 endCenter: center, endRadius: px/2, options: [])
        }
        guard let cg = img.cgImage else { return nil }
        return try? TextureResource(image: cg, options: .init(semantic: .color))
    }

    /// 两版对比: .plane = 平贴金球绕 Z 转(光芒像风车); .sphere = 真 3D 球体绕 Y 转(立体)。
    enum OrbStyle { case plane, sphere }

    /// W1061 — 动态调速引用(引用类型, animate 每帧读): 创作时进度越靠后 mult 越大 → 球转越快。
    final class SpeedRef { var mult: Float = 1; init() {} }

    /// 造一个会自转 + 随机脉动的金球实体。size = 平面边长 / 球直径(米)。
    /// speedRef 传入则自转速度 = 基速 × speedRef.mult(随进度实时变)。
    @discardableResult
    static func make(size: Float = 0.4, clockwise: Bool = true, style: OrbStyle = .plane, speedRef: SpeedRef? = nil) -> Entity {
        let root = Entity()
        root.name = "magic-mirror-orb"

        // 光晕层(背后, 略大, additive 透明) → 脉动发光载体(两版共用)。
        let halo = ModelEntity(mesh: .generatePlane(width: size * 1.6, height: size * 1.6))
        if let tex = orbTexture() {
            var hm = UnlitMaterial()
            hm.color = .init(tint: UIColor(red: 1, green: 0.85, blue: 0.4, alpha: 1), texture: .init(tex))
            hm.blending = .transparent(opacity: 0.0)   // 起始暗, 由脉动驱动
            halo.model?.materials = [hm]
        }
        halo.position = [0, 0, -0.01]
        // W1371 — Jing「删掉背景方块金球」: halo 是 size×1.6 的方 plane 贴金球图 = 那块金色方块背景。
        //   不再加进场景(实体保留供 animate 调用, 不显示)→ 魔镜本体干净浮空, 无方块。
        // root.addChild(halo)   // ← 故意不加: 删背景方块

        // W1370 — Jing: 静态【尖角托盘】(四尖角绿宝石框 MirrorRing), 不旋转; 圆金球在其中心孔里转。
        //   修「圆金球转在方块上」——之前没托盘, 方 plane 整块转=像方块。现在=魔镜本体(托盘静、球转)。
        if style == .plane, let ringTex = namedTexture("MirrorRing") {
            let tray = ModelEntity(mesh: .generatePlane(width: size * 1.12, height: size * 1.12))
            var tm = UnlitMaterial()
            tm.color = .init(tint: .white, texture: .init(ringTex))
            tm.blending = .transparent(opacity: 1.0)
            tray.model?.materials = [tm]
            tray.position = [0, 0, -0.004]   // 略后于金球, 静止不转
            tray.name = "mirror-tray"
            root.addChild(tray)
        }

        // 金球本体: 平面 or 真 3D 球。
        let orb: ModelEntity
        if style == .sphere {
            orb = ModelEntity(mesh: .generateSphere(radius: size * 0.5))   // 真 3D 球体
            // W1053 — 程序生成【发光金属金球】(不用照片贴图, 无包裹感): 金属基色 + 低粗糙(镜面高光)
            //   + 金色自发光(暗场也亮、自带光晕)。有环境光时显金属高光, 无光时靠 emissive 发光。
            var m = PhysicallyBasedMaterial()
            m.baseColor = .init(tint: UIColor(red: 1.0, green: 0.80, blue: 0.32, alpha: 1.0))
            m.metallic = 1.0
            m.roughness = 0.18
            m.emissiveColor = .init(color: UIColor(red: 1.0, green: 0.86, blue: 0.45, alpha: 1.0))
            m.emissiveIntensity = 1.4
            m.clearcoat = 1.0
            m.clearcoatRoughness = 0.1
            orb.model?.materials = [m]
        } else {
            orb = ModelEntity(mesh: .generatePlane(width: size * 0.44, height: size * 0.44))  // W1371 — 再缩小, 不压住托盘内尖角
            if let tex = orbTexture() {
                var m = UnlitMaterial()
                m.color = .init(tint: .white, texture: .init(tex))
                m.blending = .transparent(opacity: 1.0)
                orb.model?.materials = [m]
            }
        }
        orb.name = "orb-body"
        // W1373 — Jing: 金球在托盘上略偏低(托盘底尖角长、中心孔偏上)→ 往上挪一点点对正中心孔。
        if style == .plane { orb.position = [0, size * 0.02, 0] }   // W1375 — 0.045 太高 → 降到 0.02
        root.addChild(orb)

        // W1372 — visionOS 凝视/手捏: 3D 魔镜必须有【碰撞盒 + 输入目标 + 凝视高亮】, 系统才会把它当可交互目标,
        //   否则看它不亮、捏它没反应。碰撞盒覆盖托盘范围, 厚一点便于命中。
        let hit = size * 1.12
        root.components.set(CollisionComponent(shapes: [.generateBox(width: hit, height: hit, depth: 0.04)]))
        root.components.set(InputTargetComponent())
        // W1375 — Jing「删掉魔镜半透明方背景」: 不加 HoverEffectComponent(它=凝视时的圆角方块高亮=那个半透明方背景)。
        //   魔镜保持干干净净; 凝视反馈改日后用"转速加快"表达, 不靠系统方块高亮。

        animate(root: root, orb: orb, halo: halo, clockwise: clockwise, spinY: style == .sphere, speedRef: speedRef)
        return root
    }

    /// 自转(平面绕 Z / 球体绕 Y) + 缩放呼吸 + 随机发光脉动。~60fps Task, 实体离场自动结束。
    static func animate(root: Entity, orb: ModelEntity, halo: ModelEntity, clockwise: Bool, spinY: Bool, speedRef: SpeedRef? = nil) {
        let dir: Float = clockwise ? -1 : 1
        let axis: SIMD3<Float> = spinY ? [0, 1, 0] : [0, 0, 1]
        Task { @MainActor in
            var angle: Float = 0
            var t: Float = 0
            var glow: Float = 0           // 当前光晕强度 0…1
            var nextFlashAt: Float = 0.6  // 下次随机脉动时间(秒)
            let spin: Float = 0.45        // 转速(弧度/秒)
            let dt: Float = 1.0 / 60.0
            while !Task.isCancelled && root.scene != nil {
                t += dt
                angle += dir * spin * (speedRef?.mult ?? 1) * dt   // W1061 — 进度越快球转越快
                orb.orientation = simd_quatf(angle: angle, axis: axis)

                // W1063 — energy = 进度调速倍率: 进度越靠后, 呼吸越快、起伏越大、微光越亮、脉动越密。
                let energy = max(0.6, min(4.4, speedRef?.mult ?? 1))
                // 缩放呼吸(漂浮感): 频率 + 幅度都随 energy 涨。
                let breatheAmp = 0.035 + 0.03 * (energy / 4.4)
                let breathe = 1.0 + breatheAmp * sin(t * (1.4 + energy * 0.7))
                root.scale = [breathe, breathe, breathe]

                // 随机发光脉动: 到点"涌起"再衰减; energy 越高间隔越短(脉动越急促)。
                if t >= nextFlashAt {
                    glow = 1.0
                    nextFlashAt = t + Float.random(in: 0.8...2.6) / energy
                }
                glow = max(0, glow - dt * 1.6)
                let pulse = 0.5 + 0.5 * sin(t * (0.9 + energy * 0.5))
                let base = (0.10 + 0.06 * pulse) * min(1.7, 0.8 + energy * 0.25)  // 常态微光随 energy 抬亮
                let lvl = min(1.0, base + glow * 0.85)
                if var hm = halo.model?.materials.first as? UnlitMaterial {
                    hm.blending = .transparent(opacity: .init(floatLiteral: lvl))
                    halo.model?.materials = [hm]
                }
                // W1053 — 金属球版: 球本体的自发光也随脉动起伏(plane 版是 UnlitMaterial, 自动跳过)。
                if var pm = orb.model?.materials.first as? PhysicallyBasedMaterial {
                    pm.emissiveIntensity = 0.9 + lvl * 1.6
                    orb.model?.materials = [pm]
                }
                try? await Task.sleep(nanoseconds: 16_000_000)
            }
        }
    }
}

/// 独立 SwiftUI 视图: 启动页 / 大厅 logo 直接用。sphere=true 切真 3D 球体版(对比)。
struct MagicMirrorOrbView: View {
    var size: Float = 0.4
    var clockwise: Bool = true
    var sphere: Bool = false
    var speedRef: MagicMirrorOrb.SpeedRef? = nil   // W1061 — 外部动态调速(进度联动)
    var onTap: (() -> Void)? = nil                 // W1372 — 手捏魔镜触发(凝视+pinch)
    var body: some View {
        RealityView { content in
            content.add(MagicMirrorOrb.make(size: size, clockwise: clockwise,
                                            style: sphere ? .sphere : .plane, speedRef: speedRef))
        } update: { _ in }
        // W1372 — 空间手捏: 凝视魔镜实体 + pinch → 触发(实体已带 InputTarget/Collision)。
        .gesture(SpatialTapGesture().targetedToAnyEntity().onEnded { _ in onTap?() })
    }
}
