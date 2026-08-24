// CSSOS_WAVE_1939 20260824 — 圣殿大门重新设计:【文明之门】。
//
// Jing:「请全新, 重新设计圣殿大门。」方向由他选定 = 文明之门 + 凝视捏合。
//
// 旧大门是什么: 星空里一枚自转金球 + 一句「欢迎来到 CSS Vision」+ 捏一下开面板。
// 问题不在好不好看, 在于【它没有说出这个平台是什么】—— 换成任何一个 App 都成立。
//
// 新大门要说的是: **你站在一圈文明中间, 每个文明是一道门。**
// 这不是装饰性的隐喻 —— 平台的底子本来就是这样: 343 位数字演员按文明分属 64 个文明,
// 每个文明有自己的画面、乐器、唱腔、语言(文明智能联动)。进门 = 选一个世界, 而不是
// 按一个按钮。孔子站在中华文明的门口, 奥丁站在北欧神话的门口 —— 一眼认得出是哪个世界。
//
// 三个设计决定, 写下来免得以后被"顺手优化"掉:
//
// ① 门是【真的拱门网格】, 不是贴了图的方卡片。
//    方卡片是"卡片墙"的语汇(浏览), 拱门是"入口"的语汇(进入)。这一版要的是后者,
//    所以下面手工生成了圆顶拱形网格 —— 多写四十行, 换的是"这是门"这个第一直觉。
//
// ② 门围成一圈把人围住, 而不是排成一排。
//    排成一排 = 你在外面看它们; 围成一圈 = 你已经在圣殿中央, 只差选一个方向。
//
// ③ 凝视只做【提示】, 捏合才是【决定】。
//    凝视时门亮起、前倾靠近、名字浮现 —— 告诉你"看的是这个"; 但不自动进去。
//    Vision 上视线会到处乱扫, 凝视即触发 = 误入地狱。这条别改。

import Foundation
import RealityKit
import SwiftUI
import UIKit

// MARK: - 数据

struct CivGate: Codable, Identifiable {
    let civilization: String
    let face_actor_id: String
    let face_name: String
    let cover: String
    let actor_count: Int
    var id: String { civilization }
}

/// 标记组件: 手势只认带它的实体, 免得捏到星星/环境。
struct CivGateMarker: Component {
    var civilization: String = ""
}

extension CSSBackend {
    /// 取文明之门清单。只回门面要用的最少信息(文明名 + 代表演员 + 封面 + 演员数)。
    static func fetchCivGates(limit: Int = 16) async -> [CivGate] {
        guard let url = URL(string: "\(baseURL)/api/civilizations/gates?limit=\(limit)") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return [] }
        struct Env: Codable { let ok: Bool?; let gates: [CivGate]? }
        return (try? JSONDecoder().decode(Env.self, from: data))?.gates ?? []
    }
}

// MARK: - 造门

@MainActor
enum CivilizationGateRing {

    /// 一道门的尺寸(米)。比人略高 —— 门要有"可通过"的体量感, 小了就变成挂画。
    static let gateWidth: Float = 0.86
    static let gateHeight: Float = 1.62
    /// 门环半径: 站在圆心, 门在两三步开外 —— 近到有压迫感, 远到不至于贴脸。
    static let ringRadius: Float = 2.7
    /// 凝视时门前倾靠近的距离。
    static let gazeApproach: Float = 0.16

    /// 拱门网格: 下方矩形 + 上方半圆。
    ///
    /// 为什么不用 generatePlane(cornerRadius:) 凑合 —— 那个四角同圆, 出来是"胶囊", 上下
    /// 都圆, 读起来是标签不是门。门必须【下平上圆】: 脚踩在地上, 头顶是拱。
    static func archMesh(width w: Float, height h: Float, segments: Int = 24) -> MeshResource? {
        let hw = w / 2
        let r = hw                      // 拱半径 = 半宽 → 顶部正好是半圆
        let straight = max(0, h - r)    // 直墙高度
        var pts: [SIMD2<Float>] = []
        pts.append(SIMD2(-hw, 0))
        pts.append(SIMD2( hw, 0))
        pts.append(SIMD2( hw, straight))
        for i in 1...segments {         // 右 → 左 扫过半圆
            let a = Float(i) / Float(segments) * Float.pi
            pts.append(SIMD2(cos(a) * r, straight + sin(a) * r))
        }
        pts.append(SIMD2(-hw, straight))

        let center = SIMD2<Float>(0, h * 0.5)
        var positions: [SIMD3<Float>] = [SIMD3(center.x, center.y, 0)]
        var uvs: [SIMD2<Float>] = [SIMD2((center.x + hw) / w, 1 - center.y / h)]
        for p in pts {
            positions.append(SIMD3(p.x, p.y, 0))
            uvs.append(SIMD2((p.x + hw) / w, 1 - p.y / h))
        }
        var idx: [UInt32] = []
        let n = UInt32(pts.count)
        for i in 0..<n {                // 从中心打扇形三角
            let a = i + 1
            let b = (i + 1) % n + 1
            idx.append(contentsOf: [0, a, b])
        }
        var d = MeshDescriptor(name: "civ-arch")
        d.positions = MeshBuffers.Positions(positions)
        d.textureCoordinates = MeshBuffers.TextureCoordinates(uvs)
        d.primitives = .triangles(idx)
        return try? MeshResource.generate(from: [d])
    }

    /// 把一圈文明之门造进 anchor。onPick 由外部接手势后回调。
    static func build(into anchor: Entity, gates: [CivGate]) {
        guard !gates.isEmpty else { return }
        guard let mesh = archMesh(width: gateWidth, height: gateHeight) else { return }
        let n = gates.count
        // 门环留一个缺口在正后方 —— 人总得有个"背后", 全封死会闷。
        let spanDeg: Float = 300
        for (i, g) in gates.enumerated() {
            let t = n == 1 ? 0.5 : Float(i) / Float(n - 1)
            let angle = (-spanDeg / 2 + spanDeg * t) * .pi / 180

            var m = UnlitMaterial()
            m.color = .init(tint: UIColor(white: 0.14, alpha: 1.0))   // 贴图到位前的门底色, 不留黑洞
            let e = ModelEntity(mesh: mesh, materials: [m])
            e.name = "civ-gate-\(i)"
            e.components.set(CivGateMarker(civilization: g.civilization))
            // 凝视高亮: 用系统 HoverEffect —— 它跟随用户视线且零功耗, 比自己算注视靠谱。
            e.components.set(HoverEffectComponent())
            e.components.set(InputTargetComponent())
            e.generateCollisionShapes(recursive: false)

            let x = sin(angle) * ringRadius
            let z = -cos(angle) * ringRadius
            e.position = SIMD3<Float>(x, -0.55, z)          // 门脚落在眼下方 ≈ 地面
            e.orientation = simd_quatf(angle: angle, axis: SIMD3<Float>(0, 1, 0))   // 门面朝圆心
            anchor.addChild(e)

            // 贴图异步上, 不阻塞开场 —— 门先立起来, 画面随后填进去。
            Task { @MainActor in
                guard let tex = await loadTexture(g.cover) else { return }
                var tm = UnlitMaterial()
                tm.color = .init(texture: .init(tex))
                e.model?.materials = [tm]
            }
        }
    }

    private static func loadTexture(_ urlString: String) async -> TextureResource? {
        guard let url = URL(string: urlString),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data), let cg = img.cgImage else { return nil }
        return try? await TextureResource(image: cg, options: .init(semantic: .color))
    }

    /// 凝视反馈: 被看的门前倾靠近一点, 其余归位。HoverEffect 已负责发亮, 这里补"靠近"。
    static func focus(_ picked: Entity?, among anchor: Entity) {
        for c in anchor.children where c.components[CivGateMarker.self] != nil {
            let base = normalize(SIMD3<Float>(c.position.x, 0, c.position.z))
            let want = (c === picked) ? (ringRadius - gazeApproach) : ringRadius
            var t = c.transform
            t.translation = SIMD3<Float>(base.x * want, c.position.y, base.z * want)
            c.move(to: t, relativeTo: c.parent, duration: 0.28, timingFunction: .easeOut)
        }
    }
}
