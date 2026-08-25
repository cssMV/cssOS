// CSSOS_WAVE_1940 20260824 — 圣殿大厅重做:【星穹作品阵】, 取代 2D 面板。
//
// Jing 看到穿门之后的样子, 说「这是旧的圣殿大门, 请重新设计」。他指的就是这块 ——
// 一块灰色圆角面板飘在星空里, 上面是 For you / Mine / Flagship 三个标签 + 一排横滑
// 小卡片。那是【手机界面搬进头显】。
//
// 更要命的是, 它违反了这个工程自己写在 GateView 里的原则:
//   「Jing 铁律『沉浸里一切皆沉浸, 零 2D』」
// 门环那一版做对了(真拱门、围成一圈、世界固定), 穿过门却又回到一块面板 —— 前后
// 不是一个语言。
//
// 这一版的想法: **作品不装在面板里, 作品就悬在你面前的空间里。**
//
// 四个设计决定:
//
// ① 星座式排布, 不是一排。
//    一排横滑 = 列表(你在外面翻); 有远有近、有高有低的星座 = 你站在其中。
//    深度和高度都参与编码 —— 越近越新, 这样"最新的先撞见你", 不必读日期。
//
// ② 每张作品是【无框的画面本身】, 没有卡片底、没有标题栏。
//    框和标题栏是面板的语汇。空间里画面自己就是主体, 名字只在你看它时才浮现 ——
//    不看的时候, 视野里是一片作品而不是一片文字。
//
// ③ 凝视放大 + 名字浮现, 捏合才进影院。
//    与文明之门同一套规矩(W1939): 凝视只做提示, 捏合才是决定。
//    Vision 上视线到处乱扫, 凝视即进 = 误入。两处必须一致, 否则用户学不会。
//
// ④ 贴图异步、逐张就位, 且先立占位。
//    开场不等网络; 没贴上的那张是暗色画框而不是黑洞 —— 与 Jing 的「画面不能是
//    黑乎乎的」同一条底线。

import Foundation
import RealityKit
import SwiftUI
import UIKit

/// 标记组件: 手势只认带它的实体(与 CivGateMarker / GateOrbMarker 各盯各的, 互不截胡)。
struct SpatialWorkMarker: Component {
    var workID: String = ""
    var title: String = ""
}

@MainActor
enum SpatialShelf {

    /// 画面尺寸(米)。32:9 是平台铁律, 但大厅里挂 32:9 会细成一条 ——
    /// 这里用作品【封面】的常见比例(接近 16:9)做展位, 真 32:9 留给影院银幕。
    static let cardWidth: Float = 0.62
    static let cardHeight: Float = 0.35

    /// 星座范围: 横向扇面 ±55°, 三层深度, 三档高度。
    static let arcDegrees: Float = 110
    static let nearRadius: Float = 1.9
    static let farRadius: Float = 3.1

    /// 凝视时放大与前移。
    static let gazeScale: Float = 1.22
    static let gazeApproach: Float = 0.10

    /// 把一批作品铺成星座。items 顺序 = 新→旧(越前面越新)。
    static func build(into host: Entity, items: [CSSBackend.LobbyItem]) {
        host.children.forEach { $0.removeFromParent() }
        guard !items.isEmpty else { return }
        let n = items.count
        let mesh = MeshResource.generatePlane(width: cardWidth, height: cardHeight, cornerRadius: 0.02)

        for (i, it) in items.enumerated() {
            let t = n == 1 ? 0.5 : Float(i) / Float(n - 1)
            // 横向:扇面均分。深度:越新越近(t 小 → 近)。高度:三档错落, 用序号取模制造起伏。
            let angle = (-arcDegrees / 2 + arcDegrees * t) * .pi / 180
            let radius = nearRadius + (farRadius - nearRadius) * t
            let tier: Float = [0.16, -0.02, 0.30][i % 3]

            var m = UnlitMaterial()
            m.color = .init(tint: UIColor(white: 0.12, alpha: 1.0))   // 占位画框, 不留黑洞
            let e = ModelEntity(mesh: mesh, materials: [m])
            e.name = "work-\(it.id)"
            e.components.set(SpatialWorkMarker(workID: it.id, title: it.title))
            e.components.set(HoverEffectComponent())                  // 系统凝视高亮, 零功耗
            e.components.set(InputTargetComponent())
            e.generateCollisionShapes(recursive: false)

            let x = sin(angle) * radius
            let z = -cos(angle) * radius
            e.position = SIMD3<Float>(x, tier, z)
            e.orientation = simd_quatf(angle: angle, axis: SIMD3<Float>(0, 1, 0))   // 面朝圆心(用户)
            host.addChild(e)

            Task { @MainActor in
                guard let tex = await texture(it.coverURL) else { return }
                var tm = UnlitMaterial()
                tm.color = .init(texture: .init(tex))
                e.model?.materials = [tm]
            }
        }
    }

    /// 凝视反馈: 被看的那张放大 + 前移, 其余归位。发亮交给 HoverEffectComponent。
    static func focus(_ picked: Entity?, among host: Entity) {
        for c in host.children where c.components[SpatialWorkMarker.self] != nil {
            let dir = normalize(SIMD3<Float>(c.position.x, 0, c.position.z))
            let baseR = length(SIMD3<Float>(c.position.x, 0, c.position.z))
            let isPicked = (c === picked)
            let r = isPicked ? max(0.8, baseR - gazeApproach) : baseR
            var t = c.transform
            t.translation = SIMD3<Float>(dir.x * r, c.position.y, dir.z * r)
            t.scale = SIMD3<Float>(repeating: isPicked ? gazeScale : 1.0)
            c.move(to: t, relativeTo: c.parent, duration: 0.25, timingFunction: .easeOut)
        }
    }

    private static func texture(_ urlString: String) async -> TextureResource? {
        guard !urlString.isEmpty, let url = URL(string: urlString),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data), let cg = img.cgImage else { return nil }
        return try? await TextureResource(image: cg, options: .init(semantic: .color))
    }
}
