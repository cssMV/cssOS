// CSSOS_WAVE_940 — 空间打赏: 打赏时一束金光从用户面前飞向激活屏(创作者), 落点爆开。
// 后端复用现有打赏接口(这里给桩, 真机接 StoreKit/支付; iOS 支付门铁律: per-work 付费走 StoreKit)。

import RealityKit
import UIKit
import simd

enum SpatialTip {

    /// 金光球从用户前方飞向目标银幕位置, 命中爆开。
    static func flyTip(to targetAngleDegrees: Float, into root: Entity) {
        let orb = ModelEntity(
            mesh: .generateSphere(radius: 0.08),
            materials: [UnlitMaterial(color: UIColor(red: 1.0, green: 0.84, blue: 0.3, alpha: 1))]
        )
        orb.position = SIMD3<Float>(0, 1.3, -0.6)            // 用户面前
        orb.components.set(OpacityComponent(opacity: 1))
        root.addChild(orb)

        let a = targetAngleDegrees * .pi / 180
        let target = SIMD3<Float>(3.0 * sin(a), 1.5, -3.0 * cos(a))
        var t = orb.transform
        t.translation = target
        t.scale = SIMD3<Float>(repeating: 1.6)
        orb.move(to: t, relativeTo: root, duration: 0.7, timingFunction: .easeIn)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            // 命中爆开: 撒一圈金色 emoji。
            CathedralFX.petalRain(into: root, emotion: "power", count: 10)
            orb.components.set(OpacityComponent(opacity: 0))
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { orb.removeFromParent() }
        }
    }

    /// 调后端记打赏(桩)。真机: 走 StoreKit 购买 → 成功后回调这里上报。
    static func sendTip(workID: String, amountCents: Int) async {
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/works/\(workID)/tip") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["amount_cents": amountCents])
        _ = try? await URLSession.shared.data(for: req)
        // iOS 支付门: 真实购买必须 StoreKit; 此处仅为骨架占位上报。
    }
}
