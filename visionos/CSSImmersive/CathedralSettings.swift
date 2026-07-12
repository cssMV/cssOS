// CSSOS_WAVE_949 — 圣殿参数化设置: 环绕弧度(半圆/整圆/任意)、半径等, 全可调。
// 点魔镜图标 → 菜单读写这些; ImmersiveView 据此重建环绕银幕。用户永远在圆心。

import SwiftUI

final class CathedralSettings: ObservableObject {
    /// 环绕弧度(度): 60=微弯 … 120=带鱼屏 … 180=半圆 … 360=整圆(全包围, 用户在圆心)。
    /// W1580 — Jing「选了某弧度, 下次进来还是那个」: 持久化到 UserDefaults(初值读存档, 默认 120; 改即存)。
    @Published var arcDegrees: Double = (UserDefaults.standard.object(forKey: "cssArcDegrees") as? Double) ?? 120 {
        didSet { UserDefaults.standard.set(arcDegrees, forKey: "cssArcDegrees") }
    }
    /// 银幕半径(米): 用户到银幕的距离 = 曲率半径(用户在圆心)。360° 时=圈圈大小(近=小圈, 远=大圈)。
    /// W1580 — Jing「远近参数找回来 + 记住」: 持久化到 UserDefaults(初值读存档, 默认 3.2; 改即存)。
    @Published var radius: Double = (UserDefaults.standard.object(forKey: "cssRadius") as? Double) ?? 3.2 {
        didSet { UserDefaults.standard.set(radius, forKey: "cssRadius") }
    }
    /// 银幕高度(米)。
    @Published var screenHeight: Double = 2.0
    /// W953 — 当前场景/环境(天空盒)。值对应 Assets 里的 env_<name> 360 图。
    @Published var environment: String = "cosmos"   // 默认星空宇宙(黑乎乎深空, 衬出银幕)
    /// W954 — 用户自带环境: 远程图 URL(自填 360 图 / 作品封面)。非空则优先用它当天空盒。
    /// 开放平台: 环境也交给用户选择 —— 上传自己的 360 图, 或拿任意作品封面当背景。
    @Published var customEnvURL: String = ""
    /// 可选场景(label 给菜单, key 给资源)。真·哈利波特/权游大厅那种要专门 360 美术,
    /// 这里先备好我们自己的几个氛围场景(虚空/星空/深海/雪峰/圣殿), 之后换高清 360 即生效。
    // W1580 — Jing: 只保留星空(其他不真实); 但「混沌深海」按 Jing 要求加回(截图/可选)。虚空/雪峰/金殿仍撤出。
    static let environments: [(key: String, en: String, zh: String)] = [
        ("cosmos", "Cosmos", "星空"),
        ("deepsea", "Sea of Chaos", "混沌深海"),
    ]

    /// W961 — 菜单开关。空间里的 3D 魔镜 logo 点一下 → 切换它 → 空间菜单浮层显隐。
    @Published var menuOpen: Bool = false
    /// W964 — 已自动进殿过一次(避免退出后重开窗口又被自动拉进去)。
    @Published var hasEnteredOnce: Bool = false
    @Published var lastDiag: String = ""   // W1413 — 临时诊断: enterCinema 跑没跑 + fetch 拿到几条
    /// W982 — AI 助理窗是否已开(防止每点一次创作就新建一个窗)。
    @Published var aiWindowOpen: Bool = false
    /// W975 — 跨窗→沉浸事件: 可拖拽控制窗里点打赏 → 自增 → ImmersiveView 观察到 → 圣殿里金光飞向银幕。
    @Published var tipPulse: Int = 0

    /// 每次改参数自增 → ImmersiveView 比对此 token 决定是否重建网格(避免每帧重建)。
    @Published var generation: Int = 0

    func bump() { generation += 1 }

    /// 预设。
    func applyHalfCircle() { arcDegrees = 180; bump() }    // 半圆环抱
    func applyFullCircle() { arcDegrees = 360; bump() }    // 整圆全包围(用户在正中心)
    func applyCinema()     { arcDegrees = 120; bump() }    // 带鱼屏电影
}
