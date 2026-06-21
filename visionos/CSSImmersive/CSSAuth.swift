// CSSOS_WAVE_1062 — Vision 鉴权:复用现有原生 App handoff 流(后端零改动)。
//   ① Sign in with Apple: ASWebAuthenticationSession 打开
//      https://cssstudio.app/api/auth/apple?intent=ios-app
//      → 后端 Apple OAuth 成功 → 302 到 https://cssstudio.app/auth/return?handoff=<token>
//      → .https callback 捕获该 URL → 取 handoff。
//   ② 换 session: POST /api/auth/handoff/exchange {handoff} → URLSession.shared 的
//      HTTPCookieStorage.shared 落 session cookie → 之后 agent/chat 自带身份。
//   ③ Optic ID(视网膜)解锁: 再次进入用 LocalAuthentication 生物识别确认本人后复用会话。
//   分工: 代码我写; 真机签名/钥匙串/Optic ID 真测 = Jing。

import SwiftUI
import AuthenticationServices
import LocalAuthentication

@MainActor
final class CSSAuth: NSObject, ObservableObject {
    @Published var isSignedIn: Bool = UserDefaults.standard.bool(forKey: "cssSignedIn")
    @Published var busy = false
    @Published var lastError = ""
    @Published var requestAuthAfterGate = false   // 纯光束仪式放完+退出沉浸后, 通知窗口弹 Optic ID

    private let base = "https://cssstudio.app"
    private var webSession: ASWebAuthenticationSession?

    /// 发起 Sign in with Apple(走原生 handoff intent)。
    func signIn() {
        guard let url = URL(string: "\(base)/api/auth/apple?intent=ios-app") else { return }
        busy = true; lastError = ""
        let session = ASWebAuthenticationSession(
            url: url,
            callback: .https(host: "cssstudio.app", path: "/auth/return")
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                guard let self = self else { return }
                defer { self.busy = false }
                if let error = error {
                    let e = (error as? ASWebAuthenticationSessionError)
                    if e?.code == .canceledLogin { return }   // 用户取消, 不报错
                    self.lastError = error.localizedDescription
                    return
                }
                guard let cb = callbackURL,
                      let comps = URLComponents(url: cb, resolvingAgainstBaseURL: false),
                      let handoff = comps.queryItems?.first(where: { $0.name == "handoff" })?.value,
                      !handoff.isEmpty else {
                    self.lastError = "no_handoff"; return
                }
                await self.exchange(handoff)
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        webSession = session
        session.start()
    }

    /// handoff → session cookie(落进 URLSession.shared 的 cookie jar)。
    private func exchange(_ handoff: String) async {
        guard let url = URL(string: "\(base)/api/auth/handoff/exchange") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["handoff": handoff])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let ok = (resp as? HTTPURLResponse)?.statusCode == 200
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            if ok, (obj?["ok"] as? Bool) == true {
                isSignedIn = true
                UserDefaults.standard.set(true, forKey: "cssSignedIn")
                UserDefaults.standard.set(true, forKey: "cssHadAccount")   // 曾登录过(signOut 不清, 给 Optic ID 门户判 returning)
            } else {
                lastError = (obj?["error"] as? String) ?? "exchange_failed"
            }
        } catch { lastError = error.localizedDescription }
    }

    /// 大厅金球登录入口:已登录过 → Optic ID 解锁复用会话; 首次 → 原生 Sign in with Apple(Optic ID 表单)。
    func signInViaOrb() async {
        let returning = UserDefaults.standard.bool(forKey: "cssHadAccount")
        if returning {
            let ok = await unlockWithOpticID()
            if ok {                                  // Optic ID 通过 → 复用会话进圣殿
                isSignedIn = true
                UserDefaults.standard.set(true, forKey: "cssSignedIn")
            }
        } else {
            signInWithAppleNative()                  // 首次 → visionOS 原生 Apple 登录(系统原生表单, Optic ID 验证, 非网页)
        }
    }

    /// visionOS 原生 Sign in with Apple(ASAuthorizationController, 非网页 ASWebAuthenticationSession)。
    /// 系统呈现原生表单, 用 Optic ID 验证; 拿 identityToken → POST /api/auth/apple/native 换 session cookie。
    func signInWithAppleNative() {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        busy = true; lastError = ""
        controller.performRequests()
    }

    fileprivate func exchangeNative(token: String, email: String?, given: String?, family: String?) async {
        guard let url = URL(string: "\(base)/api/auth/apple/native") else { busy = false; return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var fullName: [String: String] = [:]
        if let given, !given.isEmpty { fullName["givenName"] = given }
        if let family, !family.isEmpty { fullName["familyName"] = family }
        var bodyObj: [String: Any] = ["identityToken": token]
        if let email, !email.isEmpty { bodyObj["email"] = email }
        if !fullName.isEmpty { bodyObj["fullName"] = fullName }
        req.httpBody = try? JSONSerialization.data(withJSONObject: bodyObj)
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let ok = (resp as? HTTPURLResponse)?.statusCode == 200
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            if ok, (obj?["ok"] as? Bool) == true {
                isSignedIn = true
                UserDefaults.standard.set(true, forKey: "cssSignedIn")
                UserDefaults.standard.set(true, forKey: "cssHadAccount")
            } else {
                lastError = (obj?["error"] as? String) ?? "native_exchange_failed"
            }
        } catch { lastError = error.localizedDescription }
        busy = false
    }

    /// Optic ID(视网膜)解锁:再次进入时确认本人后复用会话(不必重新 Apple 登录)。
    func unlockWithOpticID() async -> Bool {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {
            return isSignedIn   // 设备没生物识别 → 退回 cookie 状态
        }
        let reason = (Locale.current.identifier.hasPrefix("zh"))
            ? "用 Optic ID 解锁你的 CSS Vision 会话" : "Unlock your CSS Vision session with Optic ID"
        do {
            let ok = try await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
            return ok
        } catch { return false }
    }

    func signOut() {
        isSignedIn = false
        UserDefaults.standard.set(false, forKey: "cssSignedIn")
        if let cookies = HTTPCookieStorage.shared.cookies {
            for c in cookies where c.domain.contains("cssstudio.app") { HTTPCookieStorage.shared.deleteCookie(c) }
        }
    }
}

extension CSSAuth: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        return scene?.keyWindow ?? (scene?.windows.first) ?? ASPresentationAnchor()
    }
}

// 原生 Sign in with Apple(ASAuthorizationController)回调 + 表单呈现锚点。
extension CSSAuth: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            lastError = "no_identity_token"; busy = false; return
        }
        let email = cred.email
        let given = cred.fullName?.givenName
        let family = cred.fullName?.familyName
        Task { await self.exchangeNative(token: token, email: email, given: given, family: family) }
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: Error) {
        busy = false
        if (error as? ASAuthorizationError)?.code == .canceled { return }   // 用户取消不报错
        lastError = error.localizedDescription
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        return scene?.keyWindow ?? (scene?.windows.first) ?? ASPresentationAnchor()
    }
}
