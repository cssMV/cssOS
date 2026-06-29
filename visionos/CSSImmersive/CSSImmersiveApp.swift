// CSSOS_WAVE_936 — App 入口: 2D 窗口(选作品) + ImmersiveSpace(沉浸影院)。
// 这就是 HBO/Disney 那种"自带沉浸大厅"的标准骨架 —— WindowGroup + ImmersiveSpace。

import SwiftUI

@main
struct CSSImmersiveApp: App {
    @StateObject private var player = PlayerController()
    @StateObject private var shareplay = SharePlayCathedral()
    @StateObject private var settings = CathedralSettings()   // W949
    @StateObject private var auth = CSSAuth()                 // W1062 — Vision 鉴权(Apple + Optic ID)
    @StateObject private var router = GateRouter()            // W1093 — 沉浸大厅 ↔ 窗口编排

    var body: some Scene {
        WindowGroup(id: "launch") {       // W964 — 给窗口 id, 进殿后 dismissWindow 真正关掉(消除拖拽条)
            ContentView()
                .environmentObject(player)
                .environmentObject(shareplay)
                .environmentObject(settings)
                .environmentObject(auth)
                .environmentObject(router)
                .onAppear {
                    shareplay.attach(player)   // CSSOS_WAVE_939
                    shareplay.listen()         // 监听 SharePlay 邀请/发起
                }
        }
        // CSSOS_WAVE_1106 — Jing「去掉魔镜白色底 + 圣殿大门别方角突出苹果圆角窗」:
        //   改回 .windowStyle(.plain)(无系统玻璃方窗)→ 折叠态金球浮在星空前【无白底】;
        //   展开态由 LobbyView 自己的 glassBackgroundEffect(圆角 44)定义窗形 → 圆角干净、
        //   不再有方角苹果窗框突出。代价: plain 无系统拖拽条(可后续按需补)。
        .windowStyle(.plain)
        // W1380 — Jing「干掉宿主窗抓取条」: 大门/大厅/影院全已沉浸化, 宿主窗仅作隐形逻辑host。
        //   缩到 1×1 → 抓取条宽=窗宽=1pt, 基本不可见(plain 无玻璃)。若仍碍眼再做"全搬沉浸+dismiss窗"重构。
        .defaultSize(width: 1, height: 1)
        .windowResizability(.contentSize)

        // W975 — 可拖拽控制窗(原生 WindowGroup, 自带抓取条): 交易 + 多语言/多声线整合一窗。
        WindowGroup(id: "controls") {
            ControlsPanel()
                .environmentObject(player)
                .environmentObject(settings)
        }
        .defaultSize(width: 540, height: 360)

        // W978 — AI 助理: 独立可拖拽窗(多行智能输入 + 提示词建议)。
        WindowGroup(id: "ai") {
            AIAssistantPanel().environmentObject(player).environmentObject(settings)
        }
        .defaultSize(width: 600, height: 520)

        // W1412 — Jing 铁律「删掉另一套, 只保留一套」: 删除独立 ImmersiveCinema 空间。
        //   影院只在【GateSpace 内】由 GateView showCinema→ImmersiveView 渲染(零空间切换), 不再有第二个 ImmersiveSpace
        //   与 GateSpace 互抢(两个空间同时只能开一个 → open 静默 .error 是"捏卡片进不去"的祸根)。
        //   cinemaImmersion 仅剩 GateSpace 用 .full; 表冠调沉浸档后续要的话在 GateSpace 上做。

        // CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅(唯一沉浸空间): 星空 + 大厅 + 光束 + Optic ID + 影院(showCinema)。
        ImmersiveSpace(id: "GateSpace") {
            GateView()
                .environmentObject(auth)
                .environmentObject(router)
                .environmentObject(player)      // W1382 — 编排搬进 GateView, 需 player/settings
                .environmentObject(settings)
        }
        .immersionStyle(selection: .constant(.full), in: .full)

        // CSSOS_WAVE_1483 — M1: 3D 互动电影(独立窗启动 + 独立沉浸空间, 零侵入 GateSpace)。
        //   不与 GateSpace 同时开 → 不抢空间。开发期可从 App 的 ornament/调试入口 openWindow("ifilm")。
        WindowGroup(id: "ifilm") { IFilmLauncherView() }
            .defaultSize(width: 480, height: 280)
        ImmersiveSpace(id: "IFilmSpace") { IFilmSpaceRoot() }
            .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
    }
}
