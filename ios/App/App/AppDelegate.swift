import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /* CSSOS_WAVE_126 20260513 — Jing
     * Cap WKWebView's cached footprint. Without this, browsing the
     * marketplace + playing MVs lets WKWebView accumulate gigabytes of
     * audio/video/HTTP cache in `Documents & Data` (a fresh install
     * reached 3 GB after a few sessions of normal use). Strategy:
     *
     *   1. Cap NSURLCache (HTTP layer beneath WKWebView) to 50 MB RAM
     *      / 100 MB disk so it can't spiral.
     *   2. On launch, measure WKWebsiteDataStore. If > 200 MB, wipe
     *      everything EXCEPT cookies (so the session stays logged in —
     *      Stripe/IAP/auth tokens live in cookies).
     */
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // CSSOS_WAVE_220A 20260517 — Jing: arm WebContent termination +
        // memory-warning hooks. See cssmemArmMemoryHooks() below for
        // the full strategy (TL;DR: pre-write crashRecovered flag on
        // iOS memory warning + reload on WebContent process death).
        cssmemArmMemoryHooks()

        // (1) Bound the HTTP-layer URLCache. Default is "unlimited" on iOS
        //     which lets video/audio bytes accumulate. 50 MB RAM / 100 MB
        //     disk is generous for a site that lazily loads everything.
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 100 * 1024 * 1024,
            diskPath: nil
        )

        // (2) Auto-wipe on launch is OPT-IN. Default OFF so first-launch
        //     users don't lose fresh offline assets. iOS exposes a
        //     built-in manual control via Settings → cssOS Studio →
        //     iPhone Storage → "Offload App" (clears caches but keeps
        //     user data). Power users can also enable auto-wipe via
        //     iOS Settings → cssOS Studio → Clear cache on launch
        //     (this toggle is read here on every launch).
        let autoWipeOnLaunch = UserDefaults.standard.bool(forKey: "cssos.wipeCacheOnLaunch")
        if autoWipeOnLaunch {
            let typesToNuke: Set<String> = [
                WKWebsiteDataTypeDiskCache,
                WKWebsiteDataTypeMemoryCache,
                WKWebsiteDataTypeOfflineWebApplicationCache,
                WKWebsiteDataTypeFetchCache,
                WKWebsiteDataTypeServiceWorkerRegistrations,
            ]
            WKWebsiteDataStore.default().removeData(
                ofTypes: typesToNuke,
                modifiedSince: .distantPast
            ) {
                NSLog("[cssos] WKWebView cache wiped — auto-on-launch")
            }
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// =====================================================================
// CSSOS_WAVE_220A 20260517 — Jing: memory-pressure + WebContent-process
// termination instrumentation. Pairs with public/app.memory-probe.js on
// the web side, which beacons crash-recovery snapshots to
// /api/telemetry/memory.
//
// Why this exists
//   iOS WKWebView runs page JS in a separate WebContent process with a
//   ~1.5 GB ceiling on iPhone. When usage approaches the ceiling iOS
//   fires UIApplication.didReceiveMemoryWarning then (if pressure
//   persists) SIGKILLs the WebContent process. There is NO JS error,
//   NO console log, NO crash report — the page silently goes blank or
//   reloads. From the user's perspective the app "just refreshes" mid-
//   work. Without diagnostic instrumentation we are blind.
//
// Strategy
//   1. On memory warning (fires BEFORE the kill), evaluate JS to
//      write `cssos.crashRecovered=1` into localStorage. localStorage
//      is persisted via WKWebsiteDataStore (SQLite on disk) and
//      survives WebContent process recycling.
//   2. On webViewWebContentProcessDidTerminate (the kill itself), try
//      one more JS write (may no-op since the process is gone), then
//      explicitly reload — WKWebView's default after termination is a
//      blank page, NOT auto-reload.
//   3. On next page load, public/app.memory-probe.js reads the flag,
//      clears it, and beacons a "crash_recovered" sample so we know
//      this device crossed the ceiling.
//
// Implementation notes
//   - We install a WKNavigationDelegate PROXY rather than replacing
//     Capacitor's delegate, so we don't break the Capacitor bridge.
//     The proxy forwards every other selector to the original.
//   - Locating the WKWebView is done via recursive subview walk; this
//     is robust across Capacitor versions and the default
//     CAPBridgeViewController layout.
//   - All hooks are best-effort; failures are silently logged.
// =====================================================================

private var __cssmemProxyKey: UInt8 = 0

extension AppDelegate {
    func cssmemArmMemoryHooks() {
        // (1) iOS memory-warning hook. Pre-write the flag so even a
        //     sudden kill leaves a trace.
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            NSLog("[cssos] W220.A — iOS memory warning received")
            self?.cssmemMarkPressure(reason: "memory_warning")
        }

        // (2) Install termination proxy as soon as Capacitor's webview
        //     exists. We try a few times with backoff because Capacitor's
        //     ready signal differs across versions; recursive view walk
        //     is the version-independent way to find the WKWebView.
        for delay in [0.2, 0.8, 2.0, 5.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.cssmemInstallTerminationProxy()
            }
        }
    }

    func cssmemMarkPressure(reason: String) {
        guard let wv = cssmemFindWebView() else {
            NSLog("[cssos] W220.A — markPressure: no WKWebView found")
            return
        }
        let safe = reason.replacingOccurrences(of: "'", with: "")
        let js = """
            try {
              localStorage.setItem('cssos.crashRecovered','1');
              localStorage.setItem('cssos.crashReason','\(safe)');
              if (window.cssmemProbe && window.cssmemProbe.beacon) {
                window.cssmemProbe.beacon('ios_\(safe)');
              }
            } catch(e) {}
        """
        wv.evaluateJavaScript(js, completionHandler: nil)
    }

    func cssmemFindWebView() -> WKWebView? {
        // CSSOS_WAVE_1522 — 采用 UIScene 后系统窗归 scene 所有, AppDelegate.window 为 nil。
        //   优先从已连接的 window scene 取 key window, 回退到旧 self.window。
        var root: UIView? = window?.rootViewController?.view
        if root == nil {
            for scene in UIApplication.shared.connectedScenes {
                if let ws = scene as? UIWindowScene {
                    if let kw = ws.windows.first(where: { $0.isKeyWindow }) ?? ws.windows.first {
                        root = kw.rootViewController?.view
                        if root != nil { break }
                    }
                }
            }
        }
        return cssmemSearch(view: root)
    }

    private func cssmemSearch(view: UIView?) -> WKWebView? {
        guard let v = view else { return nil }
        if let wv = v as? WKWebView { return wv }
        for sub in v.subviews {
            if let found = cssmemSearch(view: sub) { return found }
        }
        return nil
    }

    func cssmemInstallTerminationProxy() {
        guard let wv = cssmemFindWebView() else { return }
        // Install at most once.
        if objc_getAssociatedObject(wv, &__cssmemProxyKey) != nil { return }
        let proxy = CssmemNavProxy(original: wv.navigationDelegate)
        objc_setAssociatedObject(
            wv, &__cssmemProxyKey, proxy, .OBJC_ASSOCIATION_RETAIN_NONATOMIC
        )
        wv.navigationDelegate = proxy
        NSLog("[cssos] W220.A — WKNavigationDelegate proxy installed")
    }
}

class CssmemNavProxy: NSObject, WKNavigationDelegate {
    weak var original: WKNavigationDelegate?

    init(original: WKNavigationDelegate?) {
        self.original = original
    }

    // The signal we care about — iOS killed the WebContent process.
    // Write the flag (may no-op if the process is truly dead) then
    // reload. WKWebView default after termination is a blank page, so
    // explicit reload is REQUIRED — otherwise the user sees white.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        NSLog("[cssos] W220.A — WebContent process terminated; reloading")
        webView.evaluateJavaScript(
            "try { localStorage.setItem('cssos.crashRecovered','1'); localStorage.setItem('cssos.crashReason','process_terminated'); } catch(e){}",
            completionHandler: { _, _ in
                webView.reload()
            }
        )
        // Some Capacitor versions also expect the original delegate
        // to see this signal — forward defensively.
        if let o = original,
           o.responds(to: #selector(WKNavigationDelegate.webViewWebContentProcessDidTerminate(_:))) {
            o.webViewWebContentProcessDidTerminate?(webView)
        }
    }

    // Forward every other selector to Capacitor's original delegate
    // so navigation / bridge / cookie behaviour is unchanged.
    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return original?.responds(to: aSelector) ?? false
    }
    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let o = original, o.responds(to: aSelector) { return o }
        return nil
    }
}
