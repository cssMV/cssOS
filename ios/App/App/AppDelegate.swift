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
        // (1) Bound the HTTP-layer URLCache. Default is "unlimited" on iOS
        //     which lets video/audio bytes accumulate. 50 MB RAM / 100 MB
        //     disk is generous for a site that lazily loads everything.
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 100 * 1024 * 1024,
            diskPath: nil
        )

        // (2) Wipe WKWebView's disk-cache and offline-app-cache on every
        //     launch. These are the big offenders — they grow unbounded
        //     as the user plays MV videos in the marketplace. We
        //     deliberately keep cookies (session) and localStorage /
        //     IndexedDB (UI state) so the user doesn't get logged out or
        //     lose preferences on launch.
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
            NSLog("[cssos] WKWebsiteDataStore: disk + offline cache wiped on launch")
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
