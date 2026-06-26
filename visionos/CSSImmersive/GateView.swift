// CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(阶段2)。整个大厅在沉浸空间里, 不再是 2D 窗口。
//   · 星空(cosmos)环绕环境;
//   · 大厅 UI(LobbyView)作为浮空面板 attachment, 悬在你正前方;
//   · 捏大厅金球 → 头部锚点 AnchorEntity(.head) 上随机色光束【一波接一波真飞进眼睛、穿到脑后】(同一空间内, 不退出) → Optic ID;
//   · 选作品/创作/咒语 → 经 GateRouter 回传给窗口 ContentView 编排(切影院/开AI窗)。
//   头部坐标系: -Z = 正前方, +Z = 脑后。

import SwiftUI
import RealityKit
import UIKit

private final class GateViewRefs { var head: Entity?; var orbAnchor: Entity?; var lobby: Entity? }

struct GateView: View {
    @EnvironmentObject var auth: CSSAuth
    @EnvironmentObject var router: GateRouter
    @State private var refs = GateViewRefs()
    @State private var showLobby = false   // W1376 — 大厅沉浸面板显隐(捏魔镜→光束→登录→显)
    @State private var dragBase: SIMD3<Float>? = nil   // W1377 — 捏住金球拖动整个门

    var body: some View {
        // W1376 — Jing 铁律「沉浸里一切皆沉浸, 零 2D」: 星空 + 魔镜 3D 实体 + 大厅 LobbyView 作为
        //   沉浸 attachment(悬浮星空里), 全部在 GateSpace 内。2D 窗(ContentView)仅作隐形逻辑宿主。
        RealityView { content, attachments in
            content.add(ImmersiveScene.makeEnvironment(named: "cosmos"))
            let head = AnchorEntity(.head)
            content.add(head)
            refs.head = head
            // 魔镜 3D 实体(头前 1.4m, 略上移给下方大厅腾位; 自转 + 可凝视捏)。
            let orb = MagicMirrorOrb.make(size: 0.22)
            orb.name = "gate-orb"
            let anchor = AnchorEntity(.head)
            orb.position = [0, 0.12, -1.4]
            anchor.anchoring.trackingMode = .once
            anchor.addChild(orb)
            content.add(anchor)
            refs.orbAnchor = anchor
            // 大厅沉浸面板(初始隐藏, 与魔镜同锚, 悬在其下方)。
            if let lobby = attachments.entity(for: "lobby") {
                lobby.position = [0, -0.32, -1.45]
                lobby.isEnabled = false
                anchor.addChild(lobby)
                refs.lobby = lobby
            }
        } update: { _, _ in
            refs.lobby?.isEnabled = showLobby
        } attachments: {
            Attachment(id: "lobby") {
                LobbyView(
                    onEnter: { router.enter($0) },         // → ContentView 宿主接力开 ImmersiveCinema
                    onCreate: { router.doCreate = true },
                    onSpell: { router.spell = $0 },
                    signedIn: auth.isSignedIn,
                    onSignIn: { router.fireBeams = true }
                )
                .frame(width: 980, height: 720)
                .glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 44))
            }
        }
        // W1377 — Jing「删拖拽条, 捏住金球直接拖动」: 统一手势 —— 捏住金球拖 → 整个门(魔镜+大厅同锚)
        //   跟着走; 轻捏一下(几乎没动)→ 发射光点。只对金球生效, 大厅卡片的捏选不受影响。
        .gesture(
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    let n = value.entity.name
                    guard n == "gate-orb" || n == "orb-body" || n == "magic-mirror-orb",
                          let anchor = refs.orbAnchor else { return }
                    if dragBase == nil { dragBase = anchor.position }
                    let d = value.translation3D
                    anchor.position = dragBase! + SIMD3<Float>(Float(d.x) * 0.001, Float(-d.y) * 0.001, 0)
                }
                .onEnded { value in
                    let n = value.entity.name
                    guard n == "gate-orb" || n == "orb-body" || n == "magic-mirror-orb" else { return }
                    let moved = abs(value.translation3D.x) + abs(value.translation3D.y) + abs(value.translation3D.z)
                    if moved < 12, !router.fireBeams { router.fireBeams = true }   // 几乎没动 = 捏一下 → 光点
                    dragBase = nil
                }
        )
        .onChange(of: router.fireBeams) { _, want in
            guard want else { return }
            router.fireBeams = false
            runBeamRitual()
        }
        // 光束飞完 → 登录成功 → 大厅沉浸面板浮现(零 2D)。
        .onChange(of: auth.isSignedIn) { _, signed in
            if signed { withAnimation(.easeInOut(duration: 0.4)) { showLobby = true } }
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
