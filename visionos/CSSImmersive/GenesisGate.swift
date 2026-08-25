// CSSOS_WAVE_1944 20260824 — 圣殿大门第一层:【开天辟地的巨门】。
//
// Jing:「现在的大门是不是有点小家子气?」「我们做成一个门, 一个开天辟地的大门。」
// 看到生成图后:「就要这个门, 真的是开天辟地, 很震撼。」
//
// 为什么改成两层, 而不是把十六道文明之门放大
//   十六道门各自都不可能大 —— 要围住人, 每道就只能占 22.5°, 再大就互相穿插。
//   而"开天辟地"这四个字要的恰恰是【唯一】和【巨大】: 高到看不见顶, 走近才知道自己
//   有多小。这两件事不可能在同一层里同时成立。
//   所以分层:
//     第一层  一道巨门 —— 给的是气势与仪式(没有选择, 只有"进不进")
//     第二层  一圈文明 —— 给的是选择(这时你已经在里面了)
//   两个都不用牺牲。
//
// 门怎么"推开"
//   生成的是【一张】左右对称、光在正中的图。所以不是做动画特效, 而是把这张图沿中线
//   劈成两半, 各贴半边纹理 —— 左扇的 UV 取 0…0.5, 右扇取 0.5…1。捏合时两扇向两侧滑,
//   中缝的光随之扩张。这样"门扇"是真的门扇, 木纹浮雕跟着一起走, 不是一张图裂开。
//
// 版权
//   场景由我们自己生成(KIE / nano-banana), 提示词里写死了 not fantasy game art /
//   not a castle / not a magic school, 门上浮雕是不属于任何现存文明的原创符号。
//   不移植任何影视作品(Jing:「不能太多移植其他公司的产品, 可能会引起版权问题」)。
//   图已落到我们自己的域名, 不留第三方临时 URL(生成即落 R2 铁律)。

import Foundation
import RealityKit
import SwiftUI
import UIKit

/// 标记: 手势只认它(与 CivGateMarker / GateOrbMarker / SpatialWorkMarker 各盯各的)。
struct GenesisGateMarker: Component {}

@MainActor
enum GenesisGate {

    static let imageURL = "https://cssstudio.app/assets/gate-genesis.webp"

    /// 门的体量。巨门必须【超出视野】才叫巨 —— 6.4m 宽、7.2m 高、摆在 7m 外,
    /// 抬头看不到顶, 左右也出画。小一点就立刻变成"一张海报"。
    static let gateWidth: Float = 6.4
    static let gateHeight: Float = 7.2
    static let distance: Float = 7.0
    /// 门脚沉到视平线下方多少 —— 让人是"站在门前", 不是"飘在门中间"。
    static let footDrop: Float = -2.6

    /// 半扇门的四边形(uMin…uMax 决定取纹理的哪半边)。
    /* CSSOS_WAVE_1946 20260825 — Jing:「大门应该是向着用户打开, 仿佛是用户进入大门的
     * 感觉, 而不是大门的两扇门跑掉了。」
     *
     * 上一版把两扇整体【平移】出画 —— 那是"门跑了", 不是"门开了"。真正的门绕【外侧
     * 边框】转, 内侧那条边朝你扫过来。所以几何必须从铰链边起算, 而不是各自居中:
     *   左扇: x ∈ [0, +halfW], 铰链(x=0)放在门的最左侧 → 自由边在右, 向内向你转
     *   右扇: x ∈ [-halfW, 0], 铰链(x=0)放在门的最右侧 → 自由边在左, 向内向你转
     * 居中的话转起来会绕自己中心打转, 像旋转门, 完全不是推门。 */
    private static func halfQuad(width w: Float, height h: Float,
                                 uMin: Float, uMax: Float, hingeAtLeft: Bool) -> MeshResource? {
        let x0: Float = hingeAtLeft ? 0 : -w
        let x1: Float = hingeAtLeft ? w : 0
        let pos: [SIMD3<Float>] = [
            SIMD3(x0, 0, 0), SIMD3(x1, 0, 0), SIMD3(x1, h, 0), SIMD3(x0, h, 0),
        ]
        // 自定义网格纹理原点在【左下】(W1943 的教训: 按左上算会整张倒立)
        let uv: [SIMD2<Float>] = [
            SIMD2(uMin, 0), SIMD2(uMax, 0), SIMD2(uMax, 1), SIMD2(uMin, 1),
        ]
        var d = MeshDescriptor(name: "genesis-half")
        d.positions = MeshBuffers.Positions(pos)
        d.textureCoordinates = MeshBuffers.TextureCoordinates(uv)
        d.primitives = .triangles([0, 1, 2, 0, 2, 3])
        return try? MeshResource.generate(from: [d])
    }

    /// 造巨门。返回的容器里有 left / right 两扇 + 中缝的光。
    static func make(into host: Entity) {
        host.children.forEach { $0.removeFromParent() }
        let halfW = gateWidth / 2
        guard let lm = halfQuad(width: halfW, height: gateHeight, uMin: 0, uMax: 0.5, hingeAtLeft: true),
              let rm = halfQuad(width: halfW, height: gateHeight, uMin: 0.5, uMax: 1, hingeAtLeft: false) else { return }

        var base = UnlitMaterial()
        base.color = .init(tint: UIColor(white: 0.08, alpha: 1.0))   // 贴图到位前是暗石, 不是黑洞

        // W1946 — 铰链就摆在门的最外侧两根立柱上, 门扇挂在铰链上(局部原点=转轴)。
        let left = ModelEntity(mesh: lm, materials: [base])
        left.name = "genesis-left"
        left.position = SIMD3<Float>(-halfW, footDrop, -distance)   // 左立柱

        let right = ModelEntity(mesh: rm, materials: [base])
        right.name = "genesis-right"
        right.position = SIMD3<Float>(halfW, footDrop, -distance)   // 右立柱

        // 中缝的光: 一条竖直亮面, 夹在两扇之间, 门开时随之变宽变亮。
        let seam = ModelEntity(
            mesh: .generatePlane(width: 0.18, height: gateHeight * 0.98),
            materials: [{
                var m = UnlitMaterial()
                m.color = .init(tint: UIColor(white: 1.0, alpha: 1.0))
                m.blending = .transparent(opacity: .init(floatLiteral: 0.85))
                return m
            }()])
        seam.name = "genesis-seam"
        seam.position = SIMD3<Float>(0, footDrop + gateHeight * 0.01, -distance - 0.02)

        for e in [left, right] {
            e.components.set(GenesisGateMarker())
            e.components.set(HoverEffectComponent())
            e.components.set(InputTargetComponent())
            // W1943 的教训: 平面自动碰撞体零厚度, 射线打不中 → 显式给厚度, 中心抬到门高一半
            // W1946 — 几何不再居中(从铰链边起算), 碰撞盒要跟着偏到门扇实际所在的一侧,
            // 否则盒子长在立柱外面, 又变成"看得见碰不着"(W1943 的同一个坑)。
            let side: Float = (e.name == "genesis-left") ? +halfW / 2 : -halfW / 2
            e.components.set(CollisionComponent(shapes: [
                .generateBox(width: halfW, height: gateHeight, depth: 0.2)
                    .offsetBy(translation: SIMD3<Float>(side, gateHeight / 2, 0))
            ]))
            host.addChild(e)
        }
        host.addChild(seam)

        Task { @MainActor in
            guard let tex = await texture(imageURL) else { return }
            var m = UnlitMaterial()
            m.color = .init(texture: .init(tex))
            left.model?.materials = [m]
            right.model?.materials = [m]
        }
    }

    /// 推开。两扇向两侧滑开并后退, 中缝的光扩张吞没视野 —— 走完回调。
    /* W1946 — 推开 = 两段:
     *   ① 绕铰链【朝用户】外开 82° —— 内侧自由边向你扫过来, 这才是"门朝我开"
     *   ② 整座门从身边掠过(向 +Z 推到用户身后)并让开视野 —— 这才是"我进去了"
     * 上一版缺的就是第二段: 门只是让开, 人没有前进的感觉。
     *
     * 转向怎么定(别再算错): 绕 Y 转 θ 时, 点 (d,0,0) → (d·cosθ, 0, −d·sinθ)。
     * 要自由边朝用户(+Z), 需 −d·sinθ > 0。
     *   左扇自由边在 +x(d>0) → 需 sinθ<0 → θ 取负
     *   右扇自由边在 −x(d<0) → 需 sinθ>0 → θ 取正 */
    static func open(_ host: Entity, completion: @escaping () -> Void) {
        let swing: Float = 82 * .pi / 180
        let d1: TimeInterval = 1.15      // 开门
        let d2: TimeInterval = 1.05      // 穿门

        for c in host.children {
            guard let m = c as? ModelEntity else { continue }
            var t = m.transform
            switch m.name {
            case "genesis-left":
                t.rotation = simd_quatf(angle: -swing, axis: SIMD3<Float>(0, 1, 0))
            case "genesis-right":
                t.rotation = simd_quatf(angle:  swing, axis: SIMD3<Float>(0, 1, 0))
            case "genesis-seam":
                t.scale = SIMD3<Float>(gateWidth * 1.6, 1.1, 1)    // 门缝的光随之涌开
            default: continue
            }
            m.move(to: t, relativeTo: m.parent, duration: d1, timingFunction: .easeInOut)
        }

        Task { @MainActor in
            // ② 穿门: 整座门朝用户推进并掠过身侧 —— 视觉上等于人往前迈了进去。
            try? await Task.sleep(nanoseconds: UInt64(d1 * 0.72 * 1_000_000_000))
            var ht = host.transform
            ht.translation.z += distance + 2.4        // 从 7m 外推到身后
            ht.scale = SIMD3<Float>(repeating: 1.45)  // 逼近时的透视放大
            host.move(to: ht, relativeTo: host.parent, duration: d2, timingFunction: .easeIn)
            try? await Task.sleep(nanoseconds: UInt64(d2 * 0.80 * 1_000_000_000))
            completion()
        }
    }

    private static func texture(_ urlString: String) async -> TextureResource? {
        guard let url = URL(string: urlString),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data), let cg = img.cgImage else { return nil }
        return try? await TextureResource(image: cg, options: .init(semantic: .color))
    }
}
