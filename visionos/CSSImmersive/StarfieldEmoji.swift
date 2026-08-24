// CSSOS_WAVE_1935 20260824 — 3D emoji 星空【50 颗对照版】(Jing 要的 A/B 对比)。
//
// Jing 问:「如果星空全部使用 3D emoji 是否会加重服务器压力?」
// 答: 不会 —— emoji 网格/贴图都在头显本机生成, 服务器一个字节都不多发。
// 压力全在设备端: 每颗一个 ModelEntity + 网格 + 材质, 几百颗就吃掉 90fps 预算。
// 现有星空之所以能铺 1600 颗, 是因为它们【共用同一份网格】, 只靠缩放和贴图变化。
// 所以 emoji 星空能不能上, 取决于能不能同样做到共用。
//
// 这版就是按共用做的, 并且给两种模式让 Jing 在头显里直接比:
//
//   ① .flat  彩色贴图平面(默认)
//      emoji 渲成一张图 → 贴到平面 → 面向用户。保留【彩色】, 与现有星星同构,
//      开销几乎一样。缺点: 严格说不是立体, 是朝向你的贴片。
//
//   ② .extruded  真 3D 挤出网格
//      MeshResource.generateText(extrusionDepth:) 真有厚度, 转头能看到侧面。
//      代价是【掉色】—— 挤出网格只吃字形轮廓, 彩色 emoji 变单色浮雕。
//      这不是 bug, 是 RealityKit 文字网格的固有限制, 先说清楚免得白做一轮。
//
// 共用怎么做到: 按【字形】建网格/贴图, 同一个 emoji 只做一次, 其余实体克隆复用。
// 50 颗 × 10 种表情 = 10 份资源, 不是 50 份。这条是能不能上量的关键。

import Foundation
import RealityKit
import UIKit

@MainActor
enum StarfieldEmoji {

    enum Mode { case flat, extruded }

    /// 对照版默认表情池。星空气质优先: 星/月/闪/花/音符。
    static let defaultGlyphs = ["✨", "⭐️", "🌟", "🌙", "💫", "🎵", "🎶", "🌸", "❄️", "🔆"]

    /// 铺一片 emoji 星空。count 默认 50 —— 对照版刻意少, 先看观感再谈密度。
    static func make(into anchor: Entity,
                     count: Int = 50,
                     mode: Mode = .flat,
                     glyphs: [String] = defaultGlyphs) {
        // ① 按字形建【一份】资源, 后面全部克隆复用 —— 上量的关键在这一步。
        var shared: [String: ModelEntity] = [:]
        for g in glyphs {
            if let proto = makePrototype(glyph: g, mode: mode) { shared[g] = proto }
        }
        guard !shared.isEmpty else { return }

        var placed: [ModelEntity] = []
        for _ in 0..<count {
            guard let g = glyphs.randomElement(), let proto = shared[g] else { continue }
            let e = proto.clone(recursive: true)          // 克隆 = 复用网格/材质, 不新建资源

            // 摆位沿用现有星空那套(整球面均匀 + 有远有近), 这样两版才可比。
            let u = Float.random(in: -1...1)
            let phi = Float.random(in: 0 ..< 2 * .pi)
            let rr = (1 - u * u).squareRoot()
            var dir = SIMD3<Float>(rr * cos(phi), u, rr * sin(phi))
            if abs(dir.z - 1) < 0.001 { dir.x += 0.02 }
            let rad = Float.random(in: 1.6...7.0)
            let pos = dir * rad + SIMD3<Float>(0, 0.2, 0)
            e.position = pos

            // emoji 比星点大得多, 否则看不出是什么表情; 远的略小做景深。
            let s = Float.random(in: 0.055...0.115) * (1 + rad * 0.03)
            e.scale = SIMD3<Float>(repeating: s)

            // 面向用户(与现有星星一致); 挤出版给一点随机偏转, 让厚度看得见。
            e.orientation = simd_quatf(from: SIMD3<Float>(0, 0, 1), to: -simd_normalize(pos))
            if mode == .extruded {
                let yaw = simd_quatf(angle: Float.random(in: -0.35...0.35), axis: SIMD3<Float>(0, 1, 0))
                e.orientation = e.orientation * yaw
            }

            anchor.addChild(e)
            placed.append(e)
        }

        // 呼吸: 随机挑几颗轻微胀缩 —— 只改 scale, 不新建任何资源, 开销可忽略。
        Task { @MainActor in
            while !Task.isCancelled {
                if anchor.scene == nil { try? await Task.sleep(nanoseconds: 200_000_000); continue }
                for _ in 0..<Int.random(in: 1...3) {
                    if let e = placed.randomElement() { Task { @MainActor in await breathe(e) } }
                }
                try? await Task.sleep(nanoseconds: UInt64.random(in: 500_000_000...1_400_000_000))
            }
        }
    }

    // MARK: 原型

    private static func makePrototype(glyph: String, mode: Mode) -> ModelEntity? {
        switch mode {
        case .extruded:
            // 真 3D: 有厚度, 侧面看得见。代价是彩色 emoji 变单色 —— 见文件头说明。
            let mesh = MeshResource.generateText(
                glyph,
                extrusionDepth: 0.06,
                font: .systemFont(ofSize: 0.5),
                containerFrame: .zero,
                alignment: .center,
                lineBreakMode: .byTruncatingTail)
            var m = UnlitMaterial()
            m.color = .init(tint: UIColor(white: 0.96, alpha: 1.0))
            let e = ModelEntity(mesh: mesh, materials: [m])
            recenter(e)
            return e

        case .flat:
            // 彩色: emoji 渲成贴图, 贴到平面, 面向用户。与现有星星同构, 开销几乎一样。
            guard let tex = glyphTexture(glyph) else { return nil }
            var m = UnlitMaterial()
            m.color = .init(texture: .init(tex))
            m.blending = .transparent(opacity: .init(floatLiteral: 1.0))
            let e = ModelEntity(mesh: .generatePlane(width: 1, height: 1), materials: [m])
            return e
        }
    }

    /// 把一个 emoji 画成带透明通道的方形贴图。128px 足够 —— 星空里的表情不需要更细,
    /// 更大只是白占显存(50 颗 × 512px 就是无谓的几十 MB)。
    private static func glyphTexture(_ glyph: String, side: CGFloat = 128) -> TextureResource? {
        let size = CGSize(width: side, height: side)
        let fmt = UIGraphicsImageRendererFormat.default()
        fmt.opaque = false
        fmt.scale = 1
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in
            let f = UIFont.systemFont(ofSize: side * 0.78)
            let attrs: [NSAttributedString.Key: Any] = [.font: f]
            let s = NSString(string: glyph)
            let bb = s.size(withAttributes: attrs)
            s.draw(at: CGPoint(x: (side - bb.width) / 2, y: (side - bb.height) / 2), withAttributes: attrs)
        }
        guard let cg = img.cgImage else { return nil }
        return try? TextureResource(image: cg, options: .init(semantic: .color))
    }

    /// generateText 的网格原点在基线左端 —— 不居中的话每颗都往右下偏。
    private static func recenter(_ e: ModelEntity) {
        guard let b = e.model?.mesh.bounds else { return }
        e.position = -b.center
        let wrap = Entity()
        wrap.addChild(e)
    }

    private static func breathe(_ e: ModelEntity) async {
        let base = e.scale
        let up = base * 1.22
        var t = e.transform; t.scale = up
        e.move(to: t, relativeTo: e.parent, duration: 0.45, timingFunction: .easeInOut)
        try? await Task.sleep(nanoseconds: 460_000_000)
        var back = e.transform; back.scale = base
        e.move(to: back, relativeTo: e.parent, duration: 0.65, timingFunction: .easeInOut)
    }
}
