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
            // W1943 — 同门环: 平面的自动碰撞体零厚度, 射线打不中 → 显式给厚度。
            e.components.set(CollisionComponent(shapes: [
                .generateBox(width: cardWidth, height: cardHeight, depth: 0.05)
            ]))

            let x = sin(angle) * radius
            let z = -cos(angle) * radius
            e.position = SIMD3<Float>(x, tier, z)
            // W1943b — 同门环的朝向修正: 必须是 −θ 才真的面朝用户(+θ 会让侧面的作品背过去)。
            e.orientation = simd_quatf(angle: -angle, axis: SIMD3<Float>(0, 1, 0))
            host.addChild(e)

            Task { @MainActor in
                guard let tex = await texture(it.coverURL, title: it.title) else { return }
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

    /* CSSOS_WAVE_1942b — 标题【烘进画面下缘】, 而不是"凝视时浮现"。
     *
     * 我上一版写的是"名字只在你凝视它时才浮现" —— 那在 visionOS 上【做不到】:
     * 苹果出于隐私不把注视目标交给 App(HoverEffectComponent 是系统自己画高亮,
     * 不回传是哪一个)。所以那个交互从一开始就不成立, 是我没验证就写了。
     *
     * 可行的替代: 标题烘在画面底部一条压暗的带子里 —— 一直在, 但压得很低。
     * 远看是一片作品(不抢画面), 走近/放大才读得清。既守住"视野里是作品不是文字",
     * 又不依赖拿不到的信号。 */
    static func compose(cover: UIImage, title: String) -> CGImage? {
        let W = cover.size.width, H = cover.size.height
        guard W > 0, H > 0 else { return cover.cgImage }
        let fmt = UIGraphicsImageRendererFormat.default(); fmt.opaque = true; fmt.scale = 1
        let out = UIGraphicsImageRenderer(size: CGSize(width: W, height: H), format: fmt).image { ctx in
            cover.draw(in: CGRect(x: 0, y: 0, width: W, height: H))
            guard !title.isEmpty else { return }
            let bandH = max(28, H * 0.16)
            let band = CGRect(x: 0, y: H - bandH, width: W, height: bandH)
            // 底部渐暗, 让白字在任何封面上都读得出 —— 不是加个黑条, 是让画面自己沉下去。
            if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                  colors: [UIColor.black.withAlphaComponent(0).cgColor,
                                           UIColor.black.withAlphaComponent(0.72).cgColor] as CFArray,
                                  locations: [0, 1]) {
                ctx.cgContext.saveGState(); ctx.cgContext.clip(to: band)
                ctx.cgContext.drawLinearGradient(g,
                    start: CGPoint(x: 0, y: band.minY), end: CGPoint(x: 0, y: band.maxY), options: [])
                ctx.cgContext.restoreGState()
            }
            let f = UIFont.systemFont(ofSize: bandH * 0.42, weight: .semibold)
            let para = NSMutableParagraphStyle(); para.lineBreakMode = .byTruncatingTail
            let attrs: [NSAttributedString.Key: Any] = [
                .font: f, .foregroundColor: UIColor.white.withAlphaComponent(0.92), .paragraphStyle: para]
            let pad = W * 0.045
            let r = CGRect(x: pad, y: H - bandH * 0.72, width: W - pad * 2, height: bandH * 0.55)
            NSString(string: title).draw(in: r, withAttributes: attrs)
        }
        return out.cgImage
    }

    private static func texture(_ urlString: String, title: String = "") async -> TextureResource? {
        guard !urlString.isEmpty, let url = URL(string: urlString),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data) else { return nil }
        guard let cg = compose(cover: img, title: title) ?? img.cgImage else { return nil }
        return try? await TextureResource(image: cg, options: .init(semantic: .color))
    }
}
