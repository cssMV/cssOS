// CSSOS_WAVE_938 — 空间爆字幕: 唱到的每个字/词不再困在银幕上, 而是【在用户身边 3D 炸开】——
// 围绕用户的球面上随机方位浮现, 按情绪上色 + 缩放脉冲 + 淡出消散。招牌情绪字幕进入空间。
//
// 实现: RealityKit 3D 文字(MeshResource.generateText)+ UnlitMaterial(情绪色)+ OpacityComponent
// 淡出 + move 动画。一个 burstRoot 容器统一收纳, 限活跃数防 OOM(超出回收最旧)。

import RealityKit
import UIKit
import simd

/// 一次爆字事件(由 PlayerController 按逐字时间轴发出)。
struct BurstEvent {
    let text: String
    let emotion: String
    let intensity: Double   // 0..1 → 决定大小/亮度
}

enum SpatialSubtitleSystem {

    /// 情绪 → 颜色(与 web 端 EMO_RGB 大致对齐)。
    static func color(for emotion: String) -> UIColor {
        switch emotion.lowercased() {
        case "joy", "happy", "ecstatic": return UIColor(red: 1.00, green: 0.85, blue: 0.30, alpha: 1)
        case "love", "tender", "warm":   return UIColor(red: 1.00, green: 0.45, blue: 0.65, alpha: 1)
        case "sad", "sorrow", "grief":   return UIColor(red: 0.45, green: 0.65, blue: 1.00, alpha: 1)
        case "anger", "rage":            return UIColor(red: 1.00, green: 0.35, blue: 0.25, alpha: 1)
        case "fear", "tense":            return UIColor(red: 0.65, green: 0.45, blue: 1.00, alpha: 1)
        case "calm", "serene", "peace":  return UIColor(red: 0.55, green: 0.95, blue: 0.80, alpha: 1)
        case "power", "epic", "triumph": return UIColor(red: 1.00, green: 0.70, blue: 0.20, alpha: 1)
        default:                         return UIColor(white: 1.0, alpha: 1)
        }
    }

    /// 情绪 → emoji 池(与 web EMO_PETALS 同源)。背景大 emoji + 四溅小 emoji 都从这取。
    static func emojiPool(for emotion: String) -> [String] {
        switch emotion.lowercased() {
        case "joy", "happy", "ecstatic": return ["✨", "🌟", "💫", "🎉", "☀️"]
        case "love", "tender", "warm":   return ["💖", "🌸", "💗", "🌷", "💕"]
        case "sad", "sorrow", "grief":   return ["💧", "🌧️", "🥀", "🌊", "❄️"]
        case "anger", "rage":            return ["🔥", "💥", "⚡️", "🌋", "🩸"]
        case "fear", "tense":            return ["🌑", "🕯️", "💀", "🌫️", "⚡️"]
        case "calm", "serene", "peace":  return ["🍃", "🌿", "☁️", "🕊️", "💠"]
        case "power", "epic", "triumph": return ["🔥", "⚔️", "👑", "🦅", "🌟"]
        default:                         return ["✨", "🌸", "💫", "🔥", "🌊"]
        }
    }

    // W977 — 把文字画成贴图平面(UIGraphics)→ CJK/拉丁/任意字符都可靠渲染(绕开 generateText 的 CJK 空网格坑)。
    static func textPlane(_ text: String, color: UIColor, heightMeters: Float) -> ModelEntity {
        let fontSize: CGFloat = 130
        let font = UIFont.systemFont(ofSize: fontSize, weight: .heavy)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let s = NSString(string: text)
        let sz = s.size(withAttributes: attrs)
        let pad: CGFloat = 28
        let W = max(40, ceil(sz.width) + pad * 2), H = max(40, ceil(sz.height) + pad * 2)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: W, height: H))
        let img = renderer.image { ctx in
            ctx.cgContext.setShadow(offset: .zero, blur: 18, color: color.withAlphaComponent(0.7).cgColor)
            s.draw(at: CGPoint(x: pad, y: pad), withAttributes: attrs)
        }
        let aspect = Float(W / H)
        let plane = ModelEntity(mesh: .generatePlane(width: heightMeters * aspect, height: heightMeters))
        if let cg = img.cgImage, let tex = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            var m = UnlitMaterial()
            m.color = .init(tint: .white, texture: .init(tex))
            m.blending = .transparent(opacity: 1.0)
            m.opacityThreshold = nil
            plane.model?.materials = [m]
        }
        return plane
    }

    private static func emojiEntity(_ glyph: String, size: CGFloat, opacity: Float) -> Entity {
        // W1056 — 3D 档(控制台「3D 网格花瓣」开关): 情绪 emoji 也用真 3D 网格 + 轻翻滚; 无网格(🕊️🦅💀)
        //   或关闭时回退 emoji 贴图平面(W956: generateText 画不出彩色 emoji)。
        let want3D = (UserDefaults.standard.object(forKey: "cssPetal3D") as? Bool) ?? false
        if want3D, let m3 = MeshPetal3D.make(for: glyph) {
            let sc = max(0.4, Float(size) / 0.08) * MeshPetal3D.sizeMul()
            m3.scale = SIMD3<Float>(sc, sc, sc)
            m3.components.set(OpacityComponent(opacity: opacity))
            CathedralFX.spinTumble(m3, dur: 6.0)   // 轻翻滚, 6s 后停(整组也已淡出回收)
            return m3
        }
        let e = CathedralFX.emojiPlane(glyph, size: Float(size))
        e.components.set(OpacityComponent(opacity: opacity))
        return e
    }

    /// W944 — 在【用户身边/身上】爆一个字(恐龙演示式贴近)。
    /// center = 头显实时位置, forward = 头显前向 → 字就炸在你眼前一臂内, 背景大 emoji + 四溅小 emoji。
    static func spawnBurst(_ event: BurstEvent, into root: Entity,
                           near center: SIMD3<Float> = SIMD3<Float>(0, 1.5, 0),
                           forward: SIMD3<Float> = SIMD3<Float>(0, 0, -1),
                           centerOnScreen: Bool = false) {   // W1069 — 截图: 钉在正前方中央
        let t = String(event.text).trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }

        // 活跃 group 上限 18, 超出回收最旧。
        if root.children.count > 18, let oldest = root.children.first {
            oldest.removeFromParent()
        }

        let intensity = Float(max(0, min(1, event.intensity)))
        let pool = emojiPool(for: event.emotion)
        let group = Entity()

        // 贴近: 以头为中心, 前向一臂内(0.45~0.95m)+ 左右上下小幅散开 → "在你身上/身边爆"。
        // W973 — 真凶: 原来按 ARKit 头位(center)定位, 世界感知没授权→头位卡默认→爆字定位到看不见处
        //   (花瓣用世界坐标所以能看见、爆字看不见)。改: 【世界坐标前方区域】散布, 和花瓣一样可靠可见。
        //   眼高 ~1.5, 前方 0.9~1.7m, 横/纵宽幅散开, 一抬眼就在面前。
        let up = SIMD3<Float>(0, 1, 0)
        let pos = centerOnScreen
            ? SIMD3<Float>(0, 1.45, -1.25)   // 正前方中央(截图招牌位)
            : SIMD3<Float>(
                Float.random(in: -1.0...1.0),
                1.5 + Float.random(in: -0.45...0.65),
                Float.random(in: -1.7 ... -0.85)
            )
        group.position = pos
        group.look(at: SIMD3<Float>(0, 1.5, 0), from: pos, relativeTo: nil)   // 面向用户
        group.orientation = group.orientation * simd_quatf(angle: .pi, axis: SIMD3<Float>(0, 1, 0))

        // ① 背景大 emoji(半透明, 衬在字后)。
        if let bg = pool.randomElement() {
            let bgE = emojiEntity(bg, size: CGFloat(0.16 + 0.14 * Double(intensity)), opacity: 0.38)
            bgE.position = SIMD3<Float>(0, 0, -0.02)
            group.addChild(bgE)
        }

        // ② 主字(情绪色)。W977 — 真凶: generateText 渲染 CJK/emoji 常出空网格(汉字看不见)。
        //   改成【把字画成贴图】(UIGraphics, 和花瓣同一条可靠路), CJK/拉丁/任意字都必出。
        let word = textPlane(t, color: color(for: event.emotion), heightMeters: Float(0.16 + 0.18 * Double(intensity)))
        word.components.set(OpacityComponent(opacity: 1))
        group.addChild(word)

        // ③ 字心小烟花: W1070 — 与桌面 cssosFireworkAt 对齐, 从【字正中心】向四周炸开更多小 emoji。
        let sparkN = 6 + Int(intensity * 10)
        for _ in 0..<sparkN {
            guard let g = pool.randomElement() else { continue }
            let s = emojiEntity(g, size: CGFloat.random(in: 0.045...0.075), opacity: 0.95)
            s.position = SIMD3<Float>(0, 0, 0.02)   // 字心爆出
            group.addChild(s)
            let ang = Float.random(in: 0...(2 * .pi))
            let r = Float.random(in: 0.14...0.40) * (0.7 + 0.6 * intensity)
            var to = s.transform
            to.translation = SIMD3<Float>(cos(ang) * r, sin(ang) * r, Float.random(in: -0.04...0.12))
            s.move(to: to, relativeTo: group, duration: 0.55, timingFunction: .easeOut)
            // W1071b — 真烟花: 立刻随字爆出(上面 0.55s 扩散)→ 停留(每颗错开)→ 再【平滑渐隐 opacity】消失。
            //   不是收缩, 不是延时才出现; 是"爆出→停留→淡出"。逐颗 opacity 逐帧降到 0 再移除。
            let hold = 0.55 + Double.random(in: 0.5...1.1)   // 扩散完 + 停留
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(hold * 1_000_000_000))
                let steps = 22
                for k in 0...steps {
                    if s.scene == nil { return }
                    s.components.set(OpacityComponent(opacity: Float(0.95 * (1.0 - Double(k) / Double(steps)))))
                    try? await Task.sleep(nanoseconds: 40_000_000)   // ~0.9s 渐隐
                }
                s.removeFromParent()
            }
        }

        group.components.set(OpacityComponent(opacity: 0))
        group.scale = SIMD3<Float>(repeating: 0.3)
        root.addChild(group)

        // W971 — 三段分明: ①砰地爆开(0.22s 快弹, 略过冲再回弹更"爆")。
        var pop = group.transform
        pop.scale = SIMD3<Float>(repeating: 1.0 + 0.55 * intensity)
        group.move(to: pop, relativeTo: root, duration: 0.22, timingFunction: .easeOut)
        group.components.set(OpacityComponent(opacity: 1))

        // ②明显停住驻留 ~2.4s(全程不动不淡)→ ③才慢慢淡出(1.1s 柔和淡出)。
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
            var drift = group.transform
            drift.translation += up * 0.12
            group.move(to: drift, relativeTo: root, duration: 1.1, timingFunction: .easeInOut)
            group.components.set(OpacityComponent(opacity: 0))
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.15) { group.removeFromParent() }
        }
    }
}
