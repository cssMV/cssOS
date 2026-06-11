import UIKit
import Capacitor
import WebKit
import AVFoundation

/*
 * CSSOS_WAVE_244 20260520 — Jing: 真全屏沉浸式播放.
 *
 * cssOS 是全屏 cinema MV 体验, 任何系统 chrome 都破坏沉浸感.
 *   • 状态栏 (时间/信号/电量): 用 Capacitor 自带 setStatusBarVisible(false)
 *     从启动起隐藏 + Info.plist UIStatusBarHidden 处理启动闪屏阶段.
 *   • Home 指示条: Capacitor 8 通过 SystemBars 插件 + extension override
 *     prefersHomeIndicatorAutoHidden (public, 子类不可再 override) 控制,
 *     所以这里不直接覆写该属性; 改用 preferredScreenEdgesDeferringSystemGestures
 *     延迟系统手势 → iOS 自动把 Home 指示条淡隐, 第一下边缘滑动先给 App.
 *     (若日后要彻底隐藏 Home 条, 走 JS 的 SystemBars 插件设 hideHomeIndicator.)
 *
 * 通过把 Main.storyboard 的 customClass 设为本类生效 (仍继承
 * CAPBridgeViewController, Capacitor 功能不变).
 */
class MainViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        setStatusBarVisible(false)
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        // CSSOS_WAVE_370 20260523 — Jing「自播」: 让媒体可在 App 内放声(混音不打断
        // 用户其它音频); .playback 类别允许静音键无关的播放, 是自播有声的前提之一.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[cssos] AVAudioSession setup failed: \(error.localizedDescription)")
        }
    }

    // CSSOS_WAVE_678g 20260607 — Jing「Home 指示线半灰碍手碍脚, 取消隐藏」:
    // 苹果不允许真正隐藏 Home 指示线(无此 API); prefersHomeIndicatorAutoHidden / 延迟底部手势
    // 只能把它【淡化变灰】, 永不消失。Jing 觉得半灰状态碍手碍脚 → 去掉 .bottom 延迟,
    // 让指示线【保持正常常显】(不再淡灰)。仅保留 .top(状态栏下拉延迟, 与指示线无关)。
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return [.top]
    }

    // CSSOS_WAVE_370 20260523 — Jing「自播, 全屏. 就这么简单.」:
    // iOS WKWebView 默认要求【用户手势】才放媒体 → 进面板/选歌都不会自播, 必须手点.
    // 在 webview 创建前把 mediaTypesRequiringUserActionForPlayback 清空([])→ 视频/
    // 音频【免手势自动播放(含声音)】; allowsInlineMediaPlayback 保证内联(不强制系统
    // 全屏播放器). 这是"自播"的原生总开关, 配合前端 autoplay 即进面板就放.
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsInlineMediaPlayback = true
        return super.webView(with: frame, configuration: configuration)
    }
}
