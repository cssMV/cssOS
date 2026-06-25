// CSSOS_WAVE_1172 20260624 — Jing 愿景: cssOS 登上 Apple TV(大屏影院, 原生, 不走 WebView)。
// @main 入口。骨架阶段就一个首页 → 影院播放器。

import SwiftUI

@main
struct CSSOSTVApp: App {
    init() { CSSFonts.registerBundled() }   // W1323 — 启动注册打包花体
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
