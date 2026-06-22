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
    // CSSOS_WAVE_1091 — 影院数码表冠调沉浸: .progressive(0.2…1.0, 初始 0.7), 转表冠在"开窗↔全包围"间调。
    @State private var cinemaImmersion: ImmersionStyle = .progressive(0.2...1.0, initialAmount: 1.0)

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
        .defaultSize(width: 320, height: 340)   // 启动折叠态紧贴金球; contentSize 折叠↔展开自动伸缩
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

        ImmersiveSpace(id: "ImmersiveCinema") {
            ImmersiveView()
                .environmentObject(player)
                .environmentObject(settings)
        }
        // CSSOS_WAVE_1091 — 数码表冠调沉浸: progressive 传送门, 转表冠在 0.2(开窗)↔1.0(全包围)间调, 初始 1.0(满档180°)。
        .immersionStyle(selection: $cinemaImmersion, in: .progressive(0.2...1.0, initialAmount: 1.0))

        // CSSOS_WAVE_1093 — 圣殿大门·沉浸大厅: 星空 + 大厅面板(attachment) + 头部锚点光束 + Optic ID。
        ImmersiveSpace(id: "GateSpace") {
            GateView()
                .environmentObject(auth)
                .environmentObject(router)
        }
        .immersionStyle(selection: .constant(.full), in: .full)
    }
}
