// CSSOS_WAVE_937 — 沉浸场景: 360 环境 + 【多块弧形环绕银幕】。
// 主 MV 正前方, Take 2 / 语言版在左右弧线上, 都朝向用户。带鱼屏式曲面包裹视野。

import RealityKit
import AVFoundation
import UIKit
import simd

enum ImmersiveScene {

    /// 360° 天空盒环境(占位)。
    static func makeEnvironment(named name: String = "void") -> Entity {
        let sphere = Entity()
        let mesh = MeshResource.generateSphere(radius: 1000)
        let model = ModelEntity(mesh: mesh, materials: [environmentMaterial(named: name)])
        model.scale = .init(x: -1, y: 1, z: 1)   // 翻转法线 → 从内部看
        sphere.addChild(model)
        return sphere
    }

    /// W961 — 空间里的魔镜 logo 贴片(头部锚定角落, 跟随视野, 不挡视频, 点开菜单)。
    static func makeLogoChip(size: Float = 0.11) -> ModelEntity {
        let plane = ModelEntity(mesh: .generatePlane(width: size, height: size))
        if let img = UIImage(named: "MirrorFull"), let cg = img.cgImage,
           let tex = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            var m = UnlitMaterial()
            m.color = .init(tint: .white, texture: .init(tex))
            m.blending = .transparent(opacity: 1.0)   // 透明角, 只剩魔镜
            m.opacityThreshold = nil
            plane.model?.materials = [m]
        } else {
            plane.model?.materials = [UnlitMaterial(color: UIColor(white: 0.1, alpha: 0.6))]
        }
        return plane
    }

    /// W954 — 用户自带环境: 异步拉远程图(自填 360 / 作品封面)→ 做成天空盒材质, 套到 envModel。
    /// 开放平台: 环境也由用户选。拉失败就静默(保留当前环境)。
    static func loadRemoteEnvironment(_ urlString: String, into model: ModelEntity?) {
        guard let model, let url = URL(string: urlString) else { return }
        Task.detached {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let img = UIImage(data: data), let cg = img.cgImage,
                  let tex = try? await TextureResource(image: cg, options: .init(semantic: .color)) else { return }
            await MainActor.run {
                var unlit = UnlitMaterial()
                unlit.color = .init(texture: .init(tex))
                model.model?.materials = [unlit]
            }
        }
    }

    /// W953 — 按场景名取天空盒材质: 优先加载 360 全景图 `env_<name>`(真场景, 以后换成 AI/实拍
    /// 高清 equirectangular 即可), 没有则按情绪兜底纯色。切场景只换这个材质, 不重建球。
    static func environmentMaterial(named name: String) -> RealityKit.Material {
        if let img = UIImage(named: "env_\(name)"), let cg = img.cgImage,
           let tex = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            var unlit = UnlitMaterial()
            unlit.color = .init(texture: .init(tex))
            return unlit
        }
        // 没有 env_cosmos 全景图 → 程序生成真星空(深空 + 上千随机星点 + 几十颗彩色亮星)。
        if name == "cosmos" { return starfieldMaterial() }
        let fallback: UIColor
        switch name {
        case "cosmos":  fallback = UIColor(red: 0.04, green: 0.02, blue: 0.18, alpha: 1)
        case "snow":    fallback = UIColor(red: 0.62, green: 0.78, blue: 0.92, alpha: 1)
        case "deepsea": fallback = UIColor(red: 0.03, green: 0.18, blue: 0.28, alpha: 1)
        case "temple":  fallback = UIColor(red: 0.16, green: 0.11, blue: 0.05, alpha: 1)
        default:        fallback = UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
        }
        return UnlitMaterial(color: fallback)
    }

    /// 程序生成星空 equirectangular 贴图 → 无光材质(从内部看 = 真星空天空盒)。
    static func starfieldMaterial() -> RealityKit.Material {
        let w = 2048, h = 1024
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h))
        let img = renderer.image { ctx in
            let c = ctx.cgContext
            // 深空底
            c.setFillColor(UIColor(red: 0.012, green: 0.012, blue: 0.05, alpha: 1).cgColor)
            c.fill(CGRect(x: 0, y: 0, width: w, height: h))
            // 上千白星(大小/亮度随机)
            for _ in 0..<1600 {
                let x = CGFloat.random(in: 0 ..< CGFloat(w))
                let y = CGFloat.random(in: 0 ..< CGFloat(h))
                let s = CGFloat.random(in: 0.5...2.4)
                let b = CGFloat.random(in: 0.45...1.0)
                c.setFillColor(UIColor(white: 1, alpha: b).cgColor)
                c.fillEllipse(in: CGRect(x: x, y: y, width: s, height: s))
            }
            // 几十颗彩色亮星(带光晕感)
            for _ in 0..<46 {
                let x = CGFloat.random(in: 0 ..< CGFloat(w))
                let y = CGFloat.random(in: 0 ..< CGFloat(h))
                let hue = CGFloat.random(in: 0...1)
                c.setFillColor(UIColor(hue: hue, saturation: 0.55, brightness: 1, alpha: 0.95).cgColor)
                c.fillEllipse(in: CGRect(x: x, y: y, width: 2.8, height: 2.8))
            }
        }
        if let cg = img.cgImage,
           let tex = try? TextureResource(image: cg, options: .init(semantic: .color)) {
            var unlit = UnlitMaterial()
            unlit.color = .init(texture: .init(tex))
            return unlit
        }
        return UnlitMaterial(color: UIColor(red: 0.012, green: 0.012, blue: 0.05, alpha: 1))
    }

    /// 一块弧形视频银幕。width/height 米; curveDepth = 中心相对两端往用户方向凹的深度(米)。
    // 柱面环绕屏的曲率半径 = 摆位半径(用户正好在圆心), 两者必须一致才不变形。
    static let screenRadius: Float = 3.2

    // CSSOS_WAVE_948 — 真·柱面环绕带鱼屏(比三星还弯): 用户在圆心, 银幕沿弧线包住你, 弧度 120°。
    // UV 用【已验证正确的内置平面约定】: u=t(左→右=纹理左→右), 顶 v=0/底 v=1, winding 与
    // generatePlane 同(CCW from +Z)→ 画面正立不镜像。弧朝 +Z(用户)凹进 = 环抱。
    static func makeCurvedScreen(player: AVPlayer, arcDegrees: Float = 120,
                                 radius: Float = screenRadius, height: Float = 2.0) -> ModelEntity {
        let mat = VideoMaterial(avPlayer: player)
        return ModelEntity(mesh: curvedMesh(arcDegrees: arcDegrees, radius: radius, height: height),
                           materials: [mat])
    }

    /// W949 — 按参数(弧度/半径/高)生成环绕网格。整圆(360°)= 全包围, 用户在圆心。
    static func curvedMesh(arcDegrees: Float, radius: Float, height: Float) -> MeshResource {
        let segs = max(24, Int(arcDegrees / 3))   // 弧越大段越多, 保持平滑
        return (try? generateCylinderArc(radius: radius, arcRad: arcDegrees * .pi / 180,
                                         height: height, segments: segs))
            ?? MeshResource.generatePlane(width: 7.0, height: height, cornerRadius: 0.04)
    }

    /// 把银幕摆到环绕用户的弧线上: 角度(度, 0=前/负=左/正=右), 半径, 视线高度。并转向用户。
    static func placeOnArc(_ entity: Entity, angleDegrees: Float, radius: Float = 3.2, height: Float = 1.5) {
        let a = angleDegrees * .pi / 180
        entity.position = SIMD3<Float>(radius * sin(a), height, -radius * cos(a))
        // 绕 Y 转 a, 让银幕正面(+Z)朝向用户(原点)。符号若反, 真机调成 -a。
        entity.orientation = simd_quatf(angle: a, axis: SIMD3<Float>(0, 1, 0))
    }

    /// CSSOS_WAVE_948 — 柱面环绕屏网格: 用户在圆心(local 原点前方 radius 处=曲率中心),
    /// 银幕沿半径 radius 的圆弧铺开, 弧朝 +Z(用户)凹进 = 环抱。配合 placeOnArc(同 radius)
    /// 把实体摆到 (0,h,-radius) 面向用户, local +Z 正好指向用户、距离 = radius = 曲率中心。
    /// UV/winding 对齐 generatePlane(已验证正立): u=t, 顶 v=0, 三角 [tl,bl,tr,tr,bl,br](CCW from +Z)。
    private static func generateCylinderArc(radius: Float, arcRad: Float,
                                            height: Float, segments: Int) throws -> MeshResource {
        var positions: [SIMD3<Float>] = []
        var uvs: [SIMD2<Float>] = []
        var indices: [UInt32] = []

        let halfH = height / 2
        for i in 0...segments {
            let t = Float(i) / Float(segments)               // 0..1 左→右
            let phi = (t - 0.5) * arcRad                      // -arc/2 (左) .. +arc/2 (右)
            // 曲率中心在 local +Z 的 radius 处; 弧面点相对中心张开角 phi, 朝 -Z 方向铺。
            let x = radius * sin(phi)                         // 左(-)→右(+)
            let z = radius - radius * cos(phi)               // 中心 z=0, 两端 z>0(朝 +Z=用户, 环抱)
            // W952 — 真机实测画面倒立 → 翻转 v: 顶=1, 底=0(自搓柱面网格的 v 约定与内置相反)。
            positions.append(SIMD3<Float>(x, halfH, z));  uvs.append(SIMD2<Float>(t, 1))  // 顶
            positions.append(SIMD3<Float>(x, -halfH, z)); uvs.append(SIMD2<Float>(t, 0))  // 底
        }
        for i in 0..<segments {
            let tl = UInt32(i * 2)
            let bl = UInt32(i * 2 + 1)
            let tr = UInt32((i + 1) * 2)
            let br = UInt32((i + 1) * 2 + 1)
            indices.append(contentsOf: [tl, bl, tr,  tr, bl, br])
        }

        var d = MeshDescriptor(name: "cssCylinderScreen")
        d.positions = MeshBuffers.Positions(positions)
        d.textureCoordinates = MeshBuffers.TextureCoordinates(uvs)
        d.primitives = .triangles(indices)
        return try MeshResource.generate(from: [d])
    }
}
