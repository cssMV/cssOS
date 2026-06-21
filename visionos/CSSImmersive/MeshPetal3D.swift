// CSSOS_WAVE_1054 — 程序生成【真 3D 网格花瓣】(替代 emoji 双面卡的高级档)。
//   只用 box + sphere 两种一定可用的图元拼出: 花/星芒/火苗/水滴/雪花/叶, 配 PBR 金属/发光材质。
//   真几何 + 真打光 + 真翻滚高光, 立体感比 2D emoji 卡片高一个维度(风格化, 非照片级)。
//   照片级"逼真"需逐个 .usdz 建模素材, 不在此档(见 [[visionpro_icon_and_spinning_orb]])。
//
//   尺寸单位米; 各形约 0.06–0.08 跨度, petalRain 再按 size 整体缩放。

import RealityKit
import UIKit
import simd

enum MeshPetal3D {

    // W1055 — 实时旋钮(控制台滑杆写 UserDefaults, 这里读): 发光强度 / 整体大小。缺省 1.0。
    static func glowMul() -> Float { (UserDefaults.standard.object(forKey: "cssPetalGlow") as? Double).map { Float($0) } ?? 1.0 }
    static func sizeMul() -> Float { (UserDefaults.standard.object(forKey: "cssPetalSize") as? Double).map { Float($0) } ?? 1.0 }

    static func mat(_ color: UIColor, emissive: Float = 0, metallic: Float = 0, rough: Float = 0.5) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: color)
        m.metallic = .init(floatLiteral: metallic)
        m.roughness = .init(floatLiteral: rough)
        if emissive > 0 {
            m.emissiveColor = .init(color: color)
            m.emissiveIntensity = emissive * glowMul()   // 发光强度旋钮
        }
        return m
    }

    // ── W1055 火苗内焰抖动: 共享 30fps 定时器驱动注册的内焰(scale.y + 自发光跳动), 实体离场自停。
    private struct Flick { let e: ModelEntity; let base: SIMD3<Float>; let phase: Float; let born: Date }
    private static var flicks: [Flick] = []
    private static var flickTimer: Timer?
    static func registerFlicker(_ e: ModelEntity, base: SIMD3<Float>) {
        flicks.append(Flick(e: e, base: base, phase: Float.random(in: 0...6.28), born: Date()))
        if flickTimer == nil {
            flickTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { _ in tickFlicks() }
        }
    }
    private static func tickFlicks() {
        let now = Date()
        flicks = flicks.filter { f in
            guard f.e.scene != nil else { return false }   // 离开场景图即停(防脱离后空转)
            let t = Float(now.timeIntervalSince(f.born))
            let fl = 1.0 + 0.20 * sin(t * 16 + f.phase) + 0.11 * sin(t * 27 + f.phase * 1.7)  // 双频抖动
            f.e.scale = SIMD3<Float>(f.base.x, f.base.y * fl, f.base.z)
            if var pm = f.e.model?.materials.first as? PhysicallyBasedMaterial {
                pm.emissiveIntensity = (2.4 + 0.9 * sin(t * 20 + f.phase)) * glowMul()
                f.e.model?.materials = [pm]
            }
            return true
        }
        if flicks.isEmpty { flickTimer?.invalidate(); flickTimer = nil }
    }

    // ✨⭐🌟 — 发光核心 + 8 道立体光芒。
    static func sparkle(_ color: UIColor) -> Entity {
        let g = Entity()
        let core = ModelEntity(mesh: .generateSphere(radius: 0.016), materials: [mat(.white, emissive: 2.2)])
        g.addChild(core)
        let rayMat = mat(color, emissive: 1.8)
        for i in 0..<4 {
            let ray = ModelEntity(mesh: .generateBox(width: 0.006, height: 0.075, depth: 0.006), materials: [rayMat])
            ray.orientation = simd_quatf(angle: Float(i) * (.pi / 4), axis: [0, 0, 1])
            g.addChild(ray)
        }
        return g
    }

    // 💧 — 拉长的发光蓝水珠。
    static func droplet(_ color: UIColor) -> Entity {
        let e = ModelEntity(mesh: .generateSphere(radius: 0.03), materials: [mat(color, emissive: 0.6, metallic: 0.1, rough: 0.08)])
        e.scale = [0.8, 1.4, 0.8]
        return e
    }

    // 🔥 — 外焰 + 抖动内焰(橙→金), 内焰注册到 flicker 做火苗跳动。
    static func flame() -> Entity {
        let g = Entity()
        let outer = ModelEntity(mesh: .generateSphere(radius: 0.034),
                                materials: [mat(UIColor(red: 1, green: 0.36, blue: 0.04, alpha: 1), emissive: 2.0)])
        outer.scale = [0.72, 1.55, 0.72]; outer.position = [0, 0.004, 0]
        let inner = ModelEntity(mesh: .generateSphere(radius: 0.019),
                                materials: [mat(UIColor(red: 1, green: 0.87, blue: 0.34, alpha: 1), emissive: 2.8)])
        let innerBase = SIMD3<Float>(0.62, 1.45, 0.62)
        inner.scale = innerBase; inner.position = [0, 0.012, 0.012]
        g.addChild(outer); g.addChild(inner)
        registerFlicker(inner, base: innerBase)   // 内焰抖动
        return g
    }

    // ❄️ — 真六角分形雪花: 6 臂, 每臂带 2 对 ±60° 倒刺(branch)+ 发光中心。
    static func snowflake() -> Entity {
        let g = Entity()
        let m = mat(UIColor(white: 0.97, alpha: 1), emissive: 0.95, metallic: 0.35, rough: 0.07)
        let armLen: Float = 0.085
        func makeArm() -> Entity {
            let a = Entity()
            let main = ModelEntity(mesh: .generateBox(width: 0.007, height: armLen, depth: 0.007), materials: [m])
            main.position = [0, armLen * 0.5, 0]   // 从中心向外伸一根
            a.addChild(main)
            for yf in [Float(0.55), Float(0.74)] {           // 沿臂两处长倒刺
                for side in [Float(1), Float(-1)] {
                    let barb = ModelEntity(mesh: .generateBox(width: 0.005, height: 0.028, depth: 0.005), materials: [m])
                    let q = simd_quatf(angle: side * (.pi / 3), axis: [0, 0, 1])
                    barb.orientation = q
                    let dir = simd_act(q, SIMD3<Float>(0, 0.014, 0))   // 沿倒刺自身方向外移半根
                    barb.position = SIMD3<Float>(0, armLen * yf, 0) + dir
                    a.addChild(barb)
                }
            }
            return a
        }
        for i in 0..<6 {
            let arm = makeArm()
            arm.orientation = simd_quatf(angle: Float(i) * (.pi / 3), axis: [0, 0, 1])
            g.addChild(arm)
        }
        g.addChild(ModelEntity(mesh: .generateSphere(radius: 0.012), materials: [m]))
        return g
    }

    // 🌸 — 双层花瓣(外 5 大 + 内 5 小错开 36° 略抬)+ 金心, 更有层次。
    static func blossom(_ color: UIColor) -> Entity {
        let g = Entity()
        let outerMat = mat(color, emissive: 0.5, rough: 0.4)
        let innerMat = mat(UIColor(red: 1, green: 0.78, blue: 0.88, alpha: 1), emissive: 0.65, rough: 0.35)
        for i in 0..<5 {                                   // 外层
            let p = ModelEntity(mesh: .generateSphere(radius: 0.022), materials: [outerMat])
            p.scale = [1.15, 0.5, 0.35]
            let a = Float(i) * (2 * .pi / 5)
            p.position = [cos(a) * 0.025, sin(a) * 0.025, 0]
            p.orientation = simd_quatf(angle: a, axis: [0, 0, 1])
            g.addChild(p)
        }
        for i in 0..<5 {                                   // 内层(小、错开、略抬)
            let p = ModelEntity(mesh: .generateSphere(radius: 0.015), materials: [innerMat])
            p.scale = [1.05, 0.45, 0.3]
            let a = Float(i) * (2 * .pi / 5) + (.pi / 5)    // 错开 36°
            p.position = [cos(a) * 0.015, sin(a) * 0.015, 0.005]
            p.orientation = simd_quatf(angle: a, axis: [0, 0, 1])
            g.addChild(p)
        }
        g.addChild(ModelEntity(mesh: .generateSphere(radius: 0.013),
                               materials: [mat(UIColor(red: 1, green: 0.85, blue: 0.2, alpha: 1), emissive: 1.1)]))
        return g
    }

    // 🍃 — 扁平绿叶。
    static func leaf() -> Entity {
        let e = ModelEntity(mesh: .generateSphere(radius: 0.03),
                            materials: [mat(UIColor(red: 0.3, green: 0.7, blue: 0.25, alpha: 1), emissive: 0.3, rough: 0.5)])
        e.scale = [0.5, 1.3, 0.18]
        return e
    }

    // ☀️ — 发光金球 + 8 道光芒。
    static func sun() -> Entity {
        let g = Entity()
        g.addChild(ModelEntity(mesh: .generateSphere(radius: 0.022),
                               materials: [mat(UIColor(red: 1, green: 0.82, blue: 0.22, alpha: 1), emissive: 2.4)]))
        let rm = mat(UIColor(red: 1, green: 0.72, blue: 0.12, alpha: 1), emissive: 2.0)
        for i in 0..<8 {
            let holder = Entity()
            let ray = ModelEntity(mesh: .generateBox(width: 0.006, height: 0.05, depth: 0.006), materials: [rm])
            ray.position = [0, 0.042, 0]; holder.addChild(ray)
            holder.orientation = simd_quatf(angle: Float(i) * (.pi / 4), axis: [0, 0, 1])
            g.addChild(holder)
        }
        return g
    }

    // 💖💗💕 — 两瓣球 + 菱形尖 = 心形。
    static func heart(_ color: UIColor) -> Entity {
        let g = Entity()
        let m = mat(color, emissive: 1.0, rough: 0.35)
        let l = ModelEntity(mesh: .generateSphere(radius: 0.018), materials: [m]); l.position = [-0.013, 0.012, 0]
        let r = ModelEntity(mesh: .generateSphere(radius: 0.018), materials: [m]); r.position = [0.013, 0.012, 0]
        let tip = ModelEntity(mesh: .generateBox(width: 0.03, height: 0.03, depth: 0.022), materials: [m])
        tip.position = [0, -0.014, 0]; tip.orientation = simd_quatf(angle: .pi / 4, axis: [0, 0, 1])
        g.addChild(l); g.addChild(r); g.addChild(tip)
        return g
    }

    // ☁️🌫️ — 几个白球簇成云。
    static func cloud(_ color: UIColor) -> Entity {
        let g = Entity()
        let m = mat(color, emissive: 0.22, rough: 0.7)
        let offs: [SIMD3<Float>] = [[-0.026, 0, 0], [0.026, 0, 0], [0, 0.006, 0.004], [-0.012, -0.005, 0], [0.014, -0.005, 0]]
        let rs: [Float] = [0.02, 0.022, 0.026, 0.018, 0.018]
        for (i, o) in offs.enumerated() {
            let s = ModelEntity(mesh: .generateSphere(radius: rs[i]), materials: [m])
            s.position = o; s.scale = [1, 0.8, 0.7]; g.addChild(s)
        }
        return g
    }

    // ⚡️ — 三段折线闪电。
    static func lightning() -> Entity {
        let g = Entity()
        let m = mat(UIColor(red: 1, green: 0.92, blue: 0.4, alpha: 1), emissive: 2.6)
        let segs: [(SIMD3<Float>, Float)] = [([0.01, 0.032, 0], 0.5), ([-0.008, 0, 0], -0.5), ([0.008, -0.032, 0], 0.5)]
        for (p, rot) in segs {
            let b = ModelEntity(mesh: .generateBox(width: 0.008, height: 0.036, depth: 0.006), materials: [m])
            b.position = p; b.orientation = simd_quatf(angle: rot, axis: [0, 0, 1]); g.addChild(b)
        }
        return g
    }

    // 👑 — 金冠: 底环条 + 3 菱形尖。
    static func crown() -> Entity {
        let g = Entity()
        let m = mat(UIColor(red: 1, green: 0.82, blue: 0.25, alpha: 1), emissive: 1.2, metallic: 0.9, rough: 0.2)
        let band = ModelEntity(mesh: .generateBox(width: 0.06, height: 0.018, depth: 0.02), materials: [m])
        band.position = [0, -0.014, 0]; g.addChild(band)
        for x in [Float(-0.024), 0, 0.024] {
            let sp = ModelEntity(mesh: .generateBox(width: 0.014, height: 0.03, depth: 0.012), materials: [m])
            sp.position = [x, 0.006, 0]; sp.orientation = simd_quatf(angle: .pi / 4, axis: [0, 0, 1]); g.addChild(sp)
        }
        return g
    }

    // ⚔️ — 两把交叉的银剑。
    static func swords() -> Entity {
        let g = Entity()
        let blade = mat(UIColor(white: 0.85, alpha: 1), emissive: 0.5, metallic: 0.9, rough: 0.15)
        for s in [Float(1), Float(-1)] {
            let b = ModelEntity(mesh: .generateBox(width: 0.008, height: 0.085, depth: 0.005), materials: [blade])
            b.orientation = simd_quatf(angle: s * 0.6, axis: [0, 0, 1]); g.addChild(b)
        }
        return g
    }

    // 🕯️ — 蜡烛 + 抖动火苗。
    static func candle() -> Entity {
        let g = Entity()
        let body = ModelEntity(mesh: .generateBox(width: 0.016, height: 0.06, depth: 0.016),
                               materials: [mat(UIColor(red: 0.95, green: 0.92, blue: 0.82, alpha: 1), emissive: 0.15, rough: 0.6)])
        body.position = [0, -0.012, 0]; g.addChild(body)
        let base = SIMD3<Float>(0.6, 1.3, 0.6)
        let fl = ModelEntity(mesh: .generateSphere(radius: 0.012),
                             materials: [mat(UIColor(red: 1, green: 0.8, blue: 0.3, alpha: 1), emissive: 2.6)])
        fl.scale = base; fl.position = [0, 0.03, 0]; g.addChild(fl)
        registerFlicker(fl, base: base)
        return g
    }

    // 🎉 — 一簇彩色小纸片。
    static func confetti() -> Entity {
        let g = Entity()
        let cols = [UIColor(red: 1, green: 0.36, blue: 0.54, alpha: 1), UIColor(red: 0.36, green: 0.78, blue: 1, alpha: 1),
                    UIColor(red: 1, green: 0.82, blue: 0.3, alpha: 1), UIColor(red: 0.49, green: 1, blue: 0.54, alpha: 1),
                    UIColor(red: 0.78, green: 0.49, blue: 1, alpha: 1)]
        for i in 0..<7 {
            let c = cols[i % cols.count]
            let p = ModelEntity(mesh: .generateBox(width: 0.012, height: 0.012, depth: 0.003), materials: [mat(c, emissive: 0.9, rough: 0.4)])
            p.position = [Float.random(in: -0.03...0.03), Float.random(in: -0.03...0.03), Float.random(in: -0.02...0.02)]
            p.orientation = simd_quatf(angle: Float.random(in: 0...6.28), axis: simd_normalize(SIMD3<Float>(Float.random(in: -1...1), Float.random(in: -1...1), Float.random(in: -1...1))))
            g.addChild(p)
        }
        return g
    }

    // 💠 — 青色宝石(扁菱形)。
    static func gem() -> Entity {
        let g = Entity()
        let top = ModelEntity(mesh: .generateBox(width: 0.032, height: 0.032, depth: 0.032),
                              materials: [mat(UIColor(red: 0.4, green: 0.85, blue: 0.95, alpha: 1), emissive: 1.2, metallic: 0.3, rough: 0.05)])
        top.orientation = simd_quatf(angle: .pi / 4, axis: [0, 0, 1]); top.scale = [1, 1, 0.6]; g.addChild(top)
        return g
    }

    // 🌑 — 暗球。
    static func darkOrb() -> Entity {
        let g = Entity()
        g.addChild(ModelEntity(mesh: .generateSphere(radius: 0.03),
                               materials: [mat(UIColor(white: 0.12, alpha: 1), emissive: 0.05, metallic: 0.4, rough: 0.5)]))
        return g
    }

    /// 按 emoji 取对应 3D 网格。未知/过难(🕊️🦅💀)→ nil, 调用方回退 emoji 贴图。
    /// 先剥掉变体选择符(FE0F)再匹配, 避免 "⭐️" 隐藏字符导致 case 不中。
    static func make(for glyph: String) -> Entity? {
        let key = String(String.UnicodeScalarView(glyph.unicodeScalars.filter { $0.value != 0xFE0F }))
        let gold = UIColor(red: 1, green: 0.9, blue: 0.45, alpha: 1)
        let pink = UIColor(red: 1, green: 0.6, blue: 0.75, alpha: 1)
        switch key {
        case "🌸", "🌷": return blossom(pink)
        case "🥀":       return blossom(UIColor(red: 0.72, green: 0.32, blue: 0.42, alpha: 1))
        case "✨", "💫", "⭐", "🌟": return sparkle(gold)
        case "💥":       return sparkle(UIColor(red: 1, green: 0.55, blue: 0.2, alpha: 1))
        case "☀":        return sun()
        case "🔥", "🌋":  return flame()
        case "💧", "🌊", "🌧": return droplet(UIColor(red: 0.4, green: 0.7, blue: 1, alpha: 1))
        case "🩸":       return droplet(UIColor(red: 0.85, green: 0.15, blue: 0.2, alpha: 1))
        case "❄":        return snowflake()
        case "💠":       return gem()
        case "🍃", "🌿":  return leaf()
        case "☁", "🌫":   return cloud(UIColor(white: 0.92, alpha: 1))
        case "🌑":       return darkOrb()
        case "⚡":        return lightning()
        case "💖", "💗", "💕", "💝": return heart(UIColor(red: 1, green: 0.45, blue: 0.65, alpha: 1))
        case "👑":       return crown()
        case "⚔":        return swords()
        case "🕯":        return candle()
        case "🎉":       return confetti()
        default:         return nil   // 🕊️🦅💀 等过难 → 回退 emoji 贴图
        }
    }
}
