// CSSOS_WAVE_1172 — 大屏影院播放器。画音分层: 视频=静音视觉(AVPlayerLayer 铺满), 音频=独立真声音。
// 两个 AVPlayer 同时 play()。精确同步(音频主时钟)留作下一里程碑 —— 骨架先做到"画在动、歌在响"。

import SwiftUI
import AVKit
import AVFoundation

/// 无控件、铺满全屏的视频层(AVPlayerLayer 包装, tvOS 不显示 transport)。
struct VideoSurface: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerLayerView {
        let v = PlayerLayerView()
        v.playerLayer.player = player
        // CSSOS_WAVE_1228 — 画幅铁律: 2.39 电影宽银幕完整呈现(.resizeAspect = 上下黑边信箱),
        // 绝不用 .resizeAspectFill 裁成 16:9 满屏丢掉宽银幕两侧。
        v.playerLayer.videoGravity = .resizeAspect
        return v
    }
    func updateUIView(_ uiView: PlayerLayerView, context: Context) {}

    final class PlayerLayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}

struct PlayerView: View {
    let work: CSSWork

    @State private var videoPlayer: AVPlayer?
    @State private var audioPlayer: AVPlayer?
    @State private var showTitle = true
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let vp = videoPlayer {
                VideoSurface(player: vp).ignoresSafeArea()
            } else if let cover = work.coverURL, let url = URL(string: cover) {
                // 视频没准备好 → 先铺封面。
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: { Color.black }
                .ignoresSafeArea()
            }

            // 标题浮层(几秒后淡出)。
            if showTitle {
                VStack {
                    Spacer()
                    HStack {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(work.title ?? "Untitled")
                                .font(.system(size: 44, weight: .bold))
                                .foregroundStyle(.white)
                            if !work.durationLabel.isEmpty {
                                Text(work.durationLabel)
                                    .font(.system(size: 24, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                        Spacer()
                    }
                    .padding(64)
                }
                .background(
                    LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
                        .ignoresSafeArea()
                )
                .transition(.opacity)
            }
        }
        .onAppear(perform: start)
        .onDisappear(perform: stop)
        // 遥控器菜单键退出(tvOS 自动把 dismiss 接到 Menu 键)。
    }

    private func start() {
        // 音频会话: 让声音从电视外放。
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)

        if let v = work.videoURL, let vurl = URL(string: v) {
            let p = AVPlayer(url: vurl)
            p.isMuted = true            // 画音分层: 视频永远静音
            p.actionAtItemEnd = .pause
            videoPlayer = p
            p.play()
        }
        if let a = work.audioURL, let aurl = URL(string: a) {
            let p = AVPlayer(url: aurl)
            audioPlayer = p
            p.play()
        }
        // 标题 5 秒后淡出。
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            withAnimation(.easeOut(duration: 0.6)) { showTitle = false }
        }
    }

    private func stop() {
        videoPlayer?.pause(); videoPlayer = nil
        audioPlayer?.pause(); audioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false)
    }
}
