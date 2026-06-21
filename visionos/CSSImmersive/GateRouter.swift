// CSSOS_WAVE_1093 — 阶段2: 圣殿大门/大厅整体进沉浸空间。
//   沉浸里的大厅面板(attachment)与窗口(负责开/关沉浸空间)之间的共享路由。
//   大厅面板里的动作 → 设置这里的标志 → 窗口的 ContentView 观察到 → 编排空间切换/创作/登录。

import SwiftUI

@MainActor
final class GateRouter: ObservableObject {
    // CSSWork 非 Equatable → 用 token 触发, work 单独存。
    @Published var enterToken = 0
    private(set) var pendingWork: CSSWork? = nil
    func enter(_ w: CSSWork) { pendingWork = w; enterToken += 1 }

    @Published var doCreate = false            // 点创作 → 开 AI 窗
    @Published var spell: String? = nil        // 语音咒语
    @Published var fireBeams = false           // 捏金球 → 触发头部锚点光束仪式(在大厅沉浸空间内)
}
