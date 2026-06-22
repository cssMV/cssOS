// CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(阶段2)。整个大厅在沉浸空间里, 不再是 2D 窗口。
//   · 星空(cosmos)环绕环境;
//   · 大厅 UI(LobbyView)作为浮空面板 attachment, 悬在你正前方;
//   · 捏大厅金球 → 头部锚点 AnchorEntity(.head) 上随机色光束【一波接一波真飞进眼睛、穿到脑后】(同一空间内, 不退出) → Optic ID;
//   · 选作品/创作/咒语 → 经 GateRouter 回传给窗口 ContentView 编排(切影院/开AI窗)。
//   头部坐标系: -Z = 正前方, +Z = 脑后。

import SwiftUI
import RealityKit
import UIKit

private final class GateViewRefs { var head: Entity?; var rig: Entity? }

struct GateView: View {
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @State private var refs = GateViewRefs()
    @State private var dragStart: SIMD3<Float>? = nil   // CSSOS_WAVE_1101 — 拖拽起点

    var body: some View {
        RealityView { content, attachments in
            // 星空环绕。
            content.add(ImmersiveScene.makeEnvironment(named: "cosmos"))
            // 头部锚点(光束朝眼睛飞用)。
            let head = AnchorEntity(.head)
            content.add(head)
            refs.head = head
            // CSSOS_WAVE_1101 — Jing「圣殿大门没有拖拽条, 无法拖远近」: 把大厅面板放进一个
            //   可移动的 rig 容器, 容器顶部挂一根【拖拽条】(可抓握 InputTarget), 拖它=带着
            //   整个大厅在 3D 里移动(含远近)。沉浸空间里 DragGesture 给的是 3D 位移, 手往
            //   前后伸即调远近, 比 2D 窗口的深度手柄更自然。
            let rig = Entity()
            rig.position = SIMD3<Float>(0, 1.32, -1.7)
            content.add(rig)
            refs.rig = rig
            if let lobby = attachments.entity(for: "lobby") {
                lobby.position = SIMD3<Float>(0, 0, 0)
                rig.addChild(lobby)
            }
            // 拖拽条: 浮在面板上方的一根细横杆, 可凝视+捏住拖动。
            let bar = ModelEntity(mesh: .generateBox(size: SIMD3<Float>(0.24, 0.016, 0.022), cornerRadius: 0.008))
            bar.model?.materials = [UnlitMaterial(color: UIColor(white: 1.0, alpha: 0.85))]
            bar.position = SIMD3<Float>(0, 0.34, 0.01)      // 面板上沿之上
            bar.components.set(InputTargetComponent())
            bar.components.set(CollisionComponent(shapes: [.generateBox(size: SIMD3<Float>(0.34, 0.06, 0.06))]))  // 抓取判定放大些好捏
            bar.components.set(HoverEffectComponent())       // 凝视高亮提示"可拖"
            rig.addChild(bar)
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
        // CSSOS_WAVE_1101 — 拖拽条移动整个大厅(含远近)。沉浸空间 DragGesture 给 3D 位移。
        .gesture(
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    guard let rig = refs.rig else { return }
                    if dragStart == nil { dragStart = rig.position(relativeTo: nil) }
                    let t = value.convert(value.translation3D, from: .local, to: .scene)
                    rig.setPosition(dragStart! + SIMD3<Float>(t), relativeTo: nil)
                }
                .onEnded { _ in dragStart = nil }
        )
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
        // CSSOS_WAVE_1102 — Jing「光束改光点试试」: 改成一群发光小球(光点), 从眼前各方向
        //   飞进眼心、穿到脑后。每颗【大小/速度/起射时刻/明暗/颜色】各异, 像点点星火/扫描点。
        let n = Int.random(in: 22...40)                                 // 点多一些才成"群"
        for _ in 0..<n {
            let color = UIColor(hue: CGFloat.random(in: 0...1),
                                saturation: CGFloat.random(in: 0.7...1.0),
                                brightness: 1.0, alpha: 1.0)
            let r = Float.random(in: 0.006...0.026)                     // 大小不一
            let dot = ModelEntity(mesh: .generateSphere(radius: r))
            dot.model?.materials = [UnlitMaterial(color: color)]        // @MainActor 必须
            let ang = Float.random(in: 0 ..< (2 * .pi))
            let r0 = Float.random(in: 0.02...0.22)
            let sx = cos(ang) * r0
            let sy = sin(ang) * r0 * Float.random(in: 0.5...0.9)
            dot.position = SIMD3<Float>(sx, sy, -1.6)
            dot.components.set(OpacityComponent(opacity: Float.random(in: 0.55...1.0)))  // 明暗不一
            let delay = Double.random(in: 0 ... 0.5)                    // 错峰
            let dur = Double.random(in: 0.5...1.8)                      // 速度不一
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                head.addChild(dot)
                var t = dot.transform
                t.translation = SIMD3<Float>(sx * 0.06, sy * 0.06, 0.5)  // 冲进眼心 + 穿到脑后
                dot.move(to: t, relativeTo: head, duration: dur,
                         timingFunction: Bool.random() ? .easeIn : .easeInOut)
                DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.15) { dot.removeFromParent() }
            }
        }
    }
}
