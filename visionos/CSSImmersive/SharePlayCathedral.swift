// CSSOS_WAVE_939 — SharePlay 共享圣殿: 多人各自 Apple Vision Pro, 同处一个魔镜圣殿一起看
// 同一场 MV, 看见彼此的 Persona 虚拟形象(SharePlay 空间自动), 播放进度帧级同步, 一起切屏。
// 这是 YouTube 给不了的社交护城河。
//
// 需要 entitlement: Group Activities(Xcode Signing & Capabilities 加 "Group Activities")。
//
// 同步两层:
//   ① 媒体进度: AVPlayer.playbackCoordinator.coordinateWithSession → play/pause/seek 自动同步。
//   ② 选曲/切屏: GroupSessionMessenger 广播 { workID, activeIndex }, 大家载同一首、看同一块屏。

import Foundation
import GroupActivities
import Combine
import AVFoundation

/// 「一起看」群活动。携带当前作品 ID。
struct CSSCathedralActivity: GroupActivity {
    var workID: String

    var metadata: GroupActivityMetadata {
        var m = GroupActivityMetadata()
        m.title = "CSS Cathedral · 一起欣赏"
        m.subtitle = "Watch together in the Mirror Cathedral"
        m.type = .watchTogether
        return m
    }
}

/// 在圣殿之间同步的轻量状态。
struct CathedralState: Codable {
    var workID: String
    var activeIndex: Int
}

@MainActor
final class SharePlayCathedral: ObservableObject {
    @Published var isConnected = false
    @Published var participantCount = 0

    private weak var player: PlayerController?
    private var groupSession: GroupSession<CSSCathedralActivity>?
    private var messenger: GroupSessionMessenger?
    private var tasks: [Task<Void, Never>] = []
    private var isApplyingRemote = false

    func attach(_ p: PlayerController) {
        player = p
        // 本地切屏(转头/点选)→ 广播给同殿伙伴; 远端 apply 时不回环。
        p.onActiveSwitched = { [weak self] idx in
            guard let self, self.isConnected, !self.isApplyingRemote else { return }
            self.broadcast(workID: p.work?.id ?? "", activeIndex: idx)
        }
    }

    /// 发起"一起看"(把当前作品共享给 FaceTime 通话里的人)。
    func startSharing(workID: String) {
        Task {
            let activity = CSSCathedralActivity(workID: workID)
            switch await activity.prepareForActivation() {
            case .activationPreferred:
                _ = try? await activity.activate()
            case .activationDisabled, .cancelled:
                break
            @unknown default:
                break
            }
        }
    }

    /// App 启动即监听: 别人邀你 / 你发起 → 都会从这里拿到 session。
    func listen() {
        let task = Task { [weak self] in
            for await session in CSSCathedralActivity.sessions() {
                await self?.configure(session)
            }
        }
        tasks.append(task)
    }

    private func configure(_ session: GroupSession<CSSCathedralActivity>) {
        groupSession = session
        let messenger = GroupSessionMessenger(session: session)
        self.messenger = messenger

        // 人数。
        tasks.append(Task { [weak self] in
            for await participants in session.$activeParticipants.values {
                await MainActor.run { self?.participantCount = participants.count }
            }
        })
        // 连接状态。
        tasks.append(Task { [weak self] in
            for await state in session.$state.values {
                await MainActor.run {
                    if case .invalidated = state { self?.isConnected = false }
                }
            }
        })
        // 收同步消息: 载同一首 + 切同一屏。
        tasks.append(Task { [weak self] in
            for await (msg, _) in messenger.messages(of: CathedralState.self) {
                await self?.apply(msg)
            }
        })

        session.join()
        isConnected = true

        // 用活动里的 workID 载入, 并把激活播放器交给群组协调(帧级同步)。
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let w = try? await CSSBackend.fetchWork(id: session.activity.workID) {
                self.player?.load(w)
            }
            self.coordinateActivePlayer(with: session)
        }
    }

    /// 把当前激活屏的播放器交给 SharePlay 协调(play/pause/seek 自动同步给所有人)。
    func coordinateActivePlayer(with session: GroupSession<CSSCathedralActivity>) {
        player?.activeVideoPlayer?.playbackCoordinator.coordinateWithSession(session)
    }

    /// 广播"我切了曲/切了屏" → 所有人跟随。
    func broadcast(workID: String, activeIndex: Int) {
        guard let messenger else { return }
        Task { try? await messenger.send(CathedralState(workID: workID, activeIndex: activeIndex)) }
    }

    private func apply(_ s: CathedralState) async {
        guard let player else { return }
        isApplyingRemote = true
        defer { isApplyingRemote = false }
        if player.work?.id != s.workID {
            if let w = try? await CSSBackend.fetchWork(id: s.workID) { player.load(w) }
        }
        player.setActive(s.activeIndex)
        if let session = groupSession { coordinateActivePlayer(with: session) }
    }

    func leave() {
        tasks.forEach { $0.cancel() }; tasks.removeAll()
        groupSession?.leave(); groupSession = nil; messenger = nil
        isConnected = false; participantCount = 0
    }
}
