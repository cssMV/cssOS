// CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(阶段2)。整个大厅在沉浸空间里, 不再是 2D 窗口。
//   · 星空(cosmos)环绕环境;
//   · 大厅 UI(LobbyView)作为浮空面板 attachment, 悬在你正前方;
//   · 捏大厅金球 → 头部锚点 AnchorEntity(.head) 上随机色光束【一波接一波真飞进眼睛、穿到脑后】(同一空间内, 不退出) → Optic ID;
//   · 选作品/创作/咒语 → 经 GateRouter 回传给窗口 ContentView 编排(切影院/开AI窗)。
//   头部坐标系: -Z = 正前方, +Z = 脑后。

import SwiftUI
import RealityKit
import UIKit

private final class GateViewRefs { var head: Entity? }

struct GateView: View {
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @State private var refs = GateViewRefs()

    var body: some View {
        RealityView { content, attachments in
            // 星空环绕。
            content.add(ImmersiveScene.makeEnvironment(named: "cosmos"))
            // 头部锚点(光束朝眼睛飞用)。
            let head = AnchorEntity(.head)
            content.add(head)
            refs.head = head
            // 大厅面板浮在正前方, 略低于视线中心。
            if let lobby = attachments.entity(for: "lobby") {
                lobby.position = SIMD3<Float>(0, 1.32, -1.7)
                content.add(lobby)
            }
        } attachments: {
            Attachment(id: "lobby") {
                LobbyView(
                    onEnter: { router.enter($0) },
                    onCreate: { router.doCreate = true },
                    onSpell: { router.spell = $0 },
                    signedIn: auth.isSignedIn,
                    onSignIn: { router.fireBeams = true }   // 捏金球 → 在本沉浸空间内放光束
                )
                .frame(width: 920, height: 800)
            }
        }
        // 捏金球 → 头部锚点光束仪式(同一空间, 不退出) → Optic ID。
        .onChange(of: router.fireBeams) { _, want in
            guard want else { return }
            router.fireBeams = false
            runBeamRitual()
        }
    }

    private func runBeamRitual() {
        guard let head = refs.head else { return }
        Task { @MainActor in
            for _ in 0..<10 {
                fireWave(into: head)
                try? await Task.sleep(nanoseconds: 550_000_000)   // 波间隔(慢, 但 < 单束飞行 → 连绵)
            }
            try? await Task.sleep(nanoseconds: 400_000_000)
            await auth.signInViaOrb()                 // 光束飞完 → 系统 Optic ID/Apple
        }
    }

    /// 一波光束: 随机数量、随机色, 从眼前真冲进眼心、穿到脑后(快 = "射")。
    /// CSSOS_WAVE_1096 — Jing「光束太规则显假, 要像影视剧扫描眼睛那种不规则光束」:
    ///   不再是一束齐刷刷平行、同时同速的整齐光柱。每根光束的【长度/粗细/朝向倾斜/
    ///   起射时刻/飞行速度/透明度】全部独立随机 → 长短错落、根根不平行、错峰乱射、
    ///   明暗不一, 像扫描光。
    @MainActor private func fireWave(into head: Entity) {
        // CSSOS_WAVE_1098 — Jing「要像清晨树林里阳光穿透树叶的体积光, 不要细实心棍」:
        //   ① 锥形(tapered)而非圆柱 → 像收束的光柱;② 宽很多(0.04-0.16)+ 暖阳色
        //   (低饱和金白, 非彩虹)+ 低不透明(0.08-0.30)→ 多根半透叠加出"体积光/丁达尔"
        //   的柔软光感;③ 长度/朝向/错峰/速度仍各异。RealityKit 无真体积光后处理, 这是
        //   几何+半透叠加的近似(真·丁达尔尘埃光见 ParticleEmitter, 见下次迭代)。
        let n = Int.random(in: 12...22)                                 // 多根叠加 → 体积感
        for _ in 0..<n {
            // 暖阳色: 金白偏暖, 低饱和(清晨阳光不是彩虹)
            let color = UIColor(hue: CGFloat.random(in: 0.08...0.13),
                                saturation: CGFloat.random(in: 0.18...0.55),
                                brightness: 1.0, alpha: 1.0)
            let soft = Float.random(in: 0.08...0.30)                    // 低不透明 → 多根叠加成柔光
            let len = Float.random(in: 0.45...1.4)                      // 更长, 长短错落
            let rad = Float.random(in: 0.04...0.16)                     // 更宽的光柱(不再是棍)
            let beam = ModelEntity(mesh: .generateCone(height: len, radius: rad))  // 锥形=收束光柱
            beam.model?.materials = [UnlitMaterial(color: color)]       // @MainActor 必须
            beam.components.set(OpacityComponent(opacity: soft))        // 半透(稳妥 API)→ 体积柔光
            let ang = Float.random(in: 0 ..< (2 * .pi))
            let r0 = Float.random(in: 0.02...0.22)
            let sx = cos(ang) * r0
            let sy = sin(ang) * r0 * Float.random(in: 0.5...0.85)
            beam.position = SIMD3<Float>(sx, sy, -1.5)
            let baseTilt = simd_quatf(angle: .pi / 2, axis: [1, 0, 0])
            let jitterAxis = normalize(SIMD3<Float>(Float.random(in: -1...1),
                                                    Float.random(in: -1...1),
                                                    Float.random(in: -1...1)))
            let jitter = simd_quatf(angle: Float.random(in: -0.26...0.26), axis: jitterAxis)
            beam.orientation = jitter * baseTilt
            let delay = Double.random(in: 0 ... 0.45)                   // 错峰
            let dur = Double.random(in: 0.8...2.0)                      // 慢一点 → 像缓缓洒下的光
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                head.addChild(beam)
                var t = beam.transform
                t.translation = SIMD3<Float>(sx * 0.08, sy * 0.08, 0.5)
                beam.move(to: t, relativeTo: head, duration: dur,
                          timingFunction: Bool.random() ? .easeIn : .easeInOut)
                DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.2) { beam.removeFromParent() }
            }
        }
    }
}
