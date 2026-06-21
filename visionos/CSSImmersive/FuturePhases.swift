// CSSOS_WAVE_940 — 两件最大的"疯狂"先搭钩子(需要真机手部追踪 / 较大工程, 后续点亮)。
// 这里给出清晰接口与实现指引, 不是死代码 —— 接上真机能力即可启用。

import RealityKit
import Foundation

// MARK: - 手势创作(在空中"画"出一句词 → AI 即时生成 MV)
//
// 实现路径:
//   1. ARKit `HandTrackingProvider` 取指尖关节(.indexFingerTip)世界坐标。
//   2. 捏合(thumbTip 与 indexFingerTip 距离 < 2cm)= "落笔"; 移动指尖记录笔迹点。
//   3. 松开 = 提交; 把笔迹/或语音转成 prompt → 调 cssOS 后端 /api/agent/chat → 拿 cssos-seed
//      → 触发生成 → 新作品从魔镜浮出, 自动载入银幕(复用 PlayerController.load)。
//
// 需要 entitlement: Hand Tracking(Info: NSHandsTrackingUsageDescription)。
enum GestureCreation {
    /// 提交一段空中手写/语音 → 生成新 MV(桩: 接后端 agent/chat 拿 seed)。
    static func submitCreationPrompt(_ prompt: String) async -> CSSWork? {
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/agent/chat") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["message": prompt])
        guard let (data, _) = try? await URLSession.shared.data(for: req) else { return nil }
        // 后端回 ```cssos-seed``` → 解析 → 触发生成 → 轮询拿成品 work。
        // 骨架: 先返回 nil, Phase 4 接 seed→生成→载入完整链路。
        _ = data
        return nil
    }
}

// MARK: - 真·魔镜传送门(伸手穿过 logo 魔镜才进圣殿)
//
// 实现路径:
//   1. 进 ImmersiveSpace 时, 先在用户面前立一面 logo 魔镜(圆环 + 折射材质 + 涟漪 shader)。
//   2. HandTrackingProvider: 检测指尖/手掌 z 坐标穿过魔镜平面(从近到远) = "穿过"。
//   3. 触发传送动画(魔镜涟漪扩散 + 场景从无到有浮现), 再 playAll()。
//
// Phase 4 启用; 现在 CSS Cathedral 用欢迎大字代替仪式。
enum MirrorPortal {
    static let enabled = false
}
