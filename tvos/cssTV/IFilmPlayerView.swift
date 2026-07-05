// CSSOS_WAVE_1549 Slice 3 — cssTV 互动多线程电影播放屏《时间帝国》。
// 蓝图: docs/csstv-creation-and-empire-of-time.md
//   ▶ 开拍(显式起头 → 用户按了才开始生成 = 尊重「先不开拍」/ 花钱可控)
//   → /api/ifilm/:id/next 逐拍生成(LLM 写 beat + TTS 人声 + seedance 视频备料)
//   → 银幕: 视频(静音循环)+ 人声(独立音轨)+ 台词字幕。遥控当导演: 方向 = 微影响(gaze),
//     Play/Select = 继续下一拍, Menu = 退出。收束到结局 → 显示结局标签 + 重看/退出。
// 画音分层铁律沿用 PlayerView: 视频静音铺满(VideoSurface), 声音走独立 AVPlayer。

import SwiftUI
import AVKit
import AVFoundation
import UIKit

struct IFilmPlayerView: View {
    let ifilmId: String
    var title: String = "《时间帝国》 / Empire of Time"

    private enum Phase { case intro, loading, playing, ended }
    @State private var phase: Phase = .intro
    @State private var session = CSSBackend.IFilmSession.start
    @State private var line: String = ""
    @State private var speaker: String = ""
    @State private var endingLabel: String = ""
    @State private var hint: String = ""
    @State private var videoPlayer: AVPlayer?
    @State private var voicePlayer: AVPlayer?
    @State private var videoLoopObserver: NSObjectProtocol?
    @Environment(\.dismiss) private var dismiss
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // 银幕: 当前 beat 的视频(静音, 2.39 铺满)。
            if let vp = videoPlayer {
                VideoSurface(player: vp).ignoresSafeArea()
            }

            // 暗角 + 底部字幕带。
            LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .center, endPoint: .bottom)
                .ignoresSafeArea()

            switch phase {
            case .intro:      introOverlay
            case .loading:    loadingOverlay
            case .playing:    playingOverlay
            case .ended:      endedOverlay
            }
        }
        // 播放/加载阶段无按钮 → 让容器可聚焦, 才能收到遥控方向/Play 指令(intro/ended 有按钮自持焦点)。
        .focusable(phase == .playing || phase == .loading)
        // 遥控当导演: 方向键 = 微影响(倾向哪条线程 / 自由 vs 安宁)。
        .onMoveCommand { dir in
            guard phase == .playing else { return }
            switch dir {
            case .left:  advance(gaze: "用户凝视林墨/苏晚, 倾向抵抗与自由")
            case .right: advance(gaze: "用户被火星信使'消除痛苦'吸引, 倾向被规训的安宁")
            case .up:    advance(gaze: "用户坚定、鼓励角色前进")
            case .down:  advance(gaze: "用户犹豫、让角色迟疑")
            @unknown default: advance(gaze: nil)
            }
        }
        .onPlayPauseCommand { if phase == .playing { advance(gaze: nil) } }
        .onExitCommand { teardown(); dismiss() }   // Menu 键退出
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { teardown(); UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: - Overlays

    private var introOverlay: some View {
        VStack(spacing: 30) {
            Spacer()
            Text(title).font(.system(size: 58, weight: .heavy)).foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("多线程互动电影 · 你就是导演。方向键微影响剧情,Play 继续,Menu 退出。")
                .font(.system(size: 24)).foregroundStyle(.white.opacity(0.8))
                .multilineTextAlignment(.center).frame(maxWidth: 980)
            Button { advance(gaze: nil) } label: {
                Label("开拍  ▶", systemImage: "film.stack")
                    .font(.system(size: 30, weight: .bold)).padding(.vertical, 16).padding(.horizontal, 48)
            }
            .buttonStyle(.card)
            Button("Close") { teardown(); dismiss() }
                .font(.system(size: 20)).buttonStyle(.plain).foregroundStyle(.white.opacity(0.55))
            Spacer().frame(height: 60)
        }
        .padding(60)
    }

    private var loadingOverlay: some View {
        VStack {
            Spacer()
            ProgressView().scaleEffect(1.6).tint(brandGreen)
            Text("导演正在写这一拍 · 边出边播…").font(.system(size: 24, weight: .medium))
                .foregroundStyle(brandGreen).padding(.top, 18)
            Spacer().frame(height: 80)
        }
    }

    private var playingOverlay: some View {
        VStack(alignment: .leading, spacing: 10) {
            Spacer()
            if !speaker.isEmpty {
                Text(speaker).font(.system(size: 22, weight: .bold)).foregroundStyle(brandGreen)
            }
            Text(line).font(.system(size: 34, weight: .semibold)).foregroundStyle(.white)
                .shadow(color: .black.opacity(0.9), radius: 4).frame(maxWidth: 1200, alignment: .leading)
            Text("←/→ 影响剧情    ▶ 继续    Menu 退出")
                .font(.system(size: 18)).foregroundStyle(.white.opacity(0.55)).padding(.top, 8)
        }
        .padding(.horizontal, 80).padding(.bottom, 70).frame(maxWidth: .infinity, alignment: .leading)
    }

    private var endedOverlay: some View {
        VStack(spacing: 26) {
            Spacer()
            Text("结局").font(.system(size: 26, weight: .bold)).foregroundStyle(.white.opacity(0.7))
            Text(endingLabel.isEmpty ? "THE END" : endingLabel)
                .font(.system(size: 52, weight: .heavy)).foregroundStyle(brandGreen)
                .multilineTextAlignment(.center)
            HStack(spacing: 24) {
                Button { restart() } label: {
                    Label("重看", systemImage: "arrow.counterclockwise").font(.system(size: 26, weight: .bold))
                        .padding(.vertical, 14).padding(.horizontal, 40)
                }.buttonStyle(.card)
                Button { teardown(); dismiss() } label: {
                    Label("退出", systemImage: "xmark").font(.system(size: 26, weight: .bold))
                        .padding(.vertical, 14).padding(.horizontal, 40)
                }.buttonStyle(.card)
            }
            Spacer().frame(height: 70)
        }
        .padding(60)
    }

    // MARK: - Beat loop

    private func advance(gaze: String?) {
        guard phase != .loading else { return }
        phase = .loading
        Task {
            let next = await CSSBackend.ifilmNext(id: ifilmId, session: session, gaze: gaze)
            guard let n = next, let beat = n.beat else {
                await MainActor.run { line = "(导演暂歇 —— 按 ▶ 再试一次)"; phase = .playing }
                return
            }
            // 视频备料: ready 直接播; 否则轮询到 ready(seedance 分钟级); 超时则无画面只有声音+字幕。
            var vurl: String? = (n.beat_video?.status == "ready") ? n.beat_video?.video_url : nil
            if vurl == nil, let vp = beat.video_prompt, !vp.isEmpty {
                vurl = await CSSBackend.ifilmBeatVideoReady(id: ifilmId, videoPrompt: vp)
            }
            await MainActor.run {
                if let s = n.session { session = s }
                line = beat.line ?? beat.synopsis ?? ""
                speaker = beat.speaker ?? ""
                if let v = vurl, let u = URL(string: v) { startVideo(u) }
                if let vo = n.voice_url, let uu = URL(string: vo) { startVoice(uu) }
                if n.converged == true { endingLabel = n.ending_label ?? "THE END"; phase = .ended }
                else { phase = .playing }
            }
        }
    }

    private func startVideo(_ url: URL) {
        if let ob = videoLoopObserver { NotificationCenter.default.removeObserver(ob); videoLoopObserver = nil }
        let p = AVPlayer(url: url); p.isMuted = true
        videoLoopObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main) { _ in
            p.seek(to: .zero); p.play()   // 视频短于人声 → 循环, 撑住画面
        }
        videoPlayer = p; p.play()
    }

    private func startVoice(_ url: URL) {
        let p = AVPlayer(url: url); voicePlayer = p; p.play()
    }

    private func restart() {
        teardown()
        session = .start; line = ""; speaker = ""; endingLabel = ""
        advance(gaze: nil)
    }

    private func teardown() {
        videoPlayer?.pause(); voicePlayer?.pause()
        if let ob = videoLoopObserver { NotificationCenter.default.removeObserver(ob); videoLoopObserver = nil }
        videoPlayer = nil; voicePlayer = nil
    }
}
