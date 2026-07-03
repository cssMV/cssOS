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
class MainViewController: CAPBridgeViewController, WKUIDelegate {

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
        let wv = super.webView(with: frame, configuration: configuration)
        // CSSOS_WAVE — 真人数字演员采集需要摄像头/麦克风。iOS 15+ WKWebView 里 getUserMedia
        // 必须由 WKUIDelegate 的 requestMediaCapturePermission 显式授予, 否则权限框永不弹、
        // 前端一直卡在"正在开启摄像头…"(Info.plist 的用途串是必要但不充分条件)。
        wv.uiDelegate = self
        return wv
    }

    // 摄像头/麦克风授权: Info.plist 已声明用途, 用户在录自己 → 直接授予。
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    // 接管 uiDelegate 后, JS 的 alert/confirm/prompt 需自实现, 否则失灵(撤权确认等靠它)。
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}
