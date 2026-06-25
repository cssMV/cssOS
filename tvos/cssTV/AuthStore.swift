// W1249 — cssTV 登录(设备码流)。tvOS 无浏览器: 电视显码 → 用户 cssstudio.app/tv 授权 → 轮询拿会话。
// 会话靠 URLSession.shared 的 HTTPCookieStorage(cssos_session cookie, 有 maxAge → 跨启动持久)。

import Foundation
import SwiftUI
import Combine

@MainActor
final class CSSAuth: ObservableObject {
    @Published var user: CSSUser?
    @Published var deviceUserCode: String?      // 电视上显示的码
    @Published var loggingIn = false

    private var deviceCode: String?
    private var pollTask: Task<Void, Never>?

    struct CSSUser: Codable, Equatable {
        let id: String
        let name: String?
        let email: String?
        let avatar: String?
    }

    var isSignedIn: Bool { user != nil }

    /// 启动时恢复会话(cookie 还在则 /api/me 返回用户)。
    func restore() async {
        if let u = await fetchMe() { user = u }
    }

    private func fetchMe() async -> CSSUser? {
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/me") else { return nil }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let env = try JSONDecoder().decode(MeEnvelope.self, from: data)
            if env.resolvedAuthed { return env.resolvedUser }
        } catch { print("[CSSAuth] /api/me failed:", error) }
        return nil
    }

    /// 取设备码 + 开始轮询。
    func startDeviceLogin() async {
        loggingIn = true
        deviceUserCode = nil
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/auth/device/code") else { loggingIn = false; return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data("{}".utf8)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let r = try JSONDecoder().decode(DeviceCodeResp.self, from: data)
            deviceCode = r.device_code
            deviceUserCode = r.user_code
            startPolling(interval: max(2, r.interval ?? 3))
        } catch {
            print("[CSSAuth] device/code failed:", error)
            loggingIn = false
        }
    }

    private func startPolling(interval: Int) {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            for _ in 0..<120 {                       // 最多 ~6 分钟
                try? await Task.sleep(nanoseconds: UInt64(interval) * 1_000_000_000)
                if Task.isCancelled { return }
                if await self?.pollOnce() == true { return }
            }
            await MainActor.run { self?.loggingIn = false }
        }
    }

    private func pollOnce() async -> Bool {
        guard let dc = deviceCode,
              let url = URL(string: "\(CSSBackend.baseURL)/api/auth/device/poll") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["device_code": dc])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let r = try JSONDecoder().decode(PollResp.self, from: data)
            if r.status == "authorized" {
                if let u = r.user { self.user = u } else { self.user = await fetchMe() }
                self.loggingIn = false
                self.deviceUserCode = nil
                return true
            }
            if r.status == "expired" {
                self.loggingIn = false
                self.deviceUserCode = nil
                return true
            }
        } catch { /* 继续轮询 */ }
        return false
    }

    func cancelLogin() {
        pollTask?.cancel()
        loggingIn = false
        deviceUserCode = nil
    }

    func signOut() async {
        if let url = URL(string: "\(CSSBackend.baseURL)/api/auth/logout") {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            _ = try? await URLSession.shared.data(for: req)
        }
        user = nil
    }

    // MARK: 解码
    struct MeEnvelope: Codable {
        let authenticated: Bool?
        let user: CSSUser?
        let data: D?
        struct D: Codable { let authenticated: Bool?; let user: CSSUser? }
        var resolvedAuthed: Bool { authenticated ?? data?.authenticated ?? false }
        var resolvedUser: CSSUser? { user ?? data?.user }
    }
    struct DeviceCodeResp: Codable { let device_code: String; let user_code: String; let interval: Int? }
    struct PollResp: Codable { let status: String; let user: CSSUser? }
}
