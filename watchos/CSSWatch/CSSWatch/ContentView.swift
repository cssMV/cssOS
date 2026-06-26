// CSS Watch — 主界面: 正方形封面(裁满+缓慢运镜) + 中央逐字爆情绪字幕 + 点按播放/暂停 + 表冠切歌。
import SwiftUI

struct ContentView: View {
    @StateObject private var player = WatchPlayer()
    @State private var crown = 0.0
    @State private var lastCrown = 0.0
    @State private var kenBurns = false

    var body: some View {
        ZStack {
            Color.black

            // 正方形封面裁满 + 缓慢 Ken Burns 运镜(像活的 MV)。
            if let s = player.current?.coverURL, let url = URL(string: s), !s.isEmpty {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    LinearGradient(colors: [.teal.opacity(0.4), .black], startPoint: .top, endPoint: .bottom)
                }
                .scaleEffect(kenBurns ? 1.14 : 1.0)
                .animation(.easeInOut(duration: 12).repeatForever(autoreverses: true), value: kenBurns)
            } else {
                LinearGradient(colors: [.teal.opacity(0.4), .black], startPoint: .top, endPoint: .bottom)
            }

            // 暗角 → 字幕更清楚。
            RadialGradient(colors: [.clear, .black.opacity(0.5)], center: .center, startRadius: 38, endRadius: 135)

            // 招牌: 中央逐字爆情绪字幕。
            MiniEmotionSubtitle(token: player.burst, tick: player.burstTick)

            // 底部标题 + 加载/暂停指示。
            VStack {
                Spacer()
                if player.loading {
                    ProgressView().scaleEffect(0.8)
                } else {
                    HStack(spacing: 5) {
                        Image(systemName: player.isPlaying ? "waveform" : "pause.fill")
                            .font(.system(size: 10))
                        Text(player.current?.title ?? "CSS")
                            .font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    }
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(.bottom, 3)
                }
            }
        }
        .ignoresSafeArea()
        // 点按 = 播放/暂停。
        .onTapGesture { player.togglePlay() }
        // Digital Crown 转动 = 上/下首。
        .focusable()
        .digitalCrownRotation($crown, from: -1_000_000, through: 1_000_000, by: 1,
                              sensitivity: .low, isContinuous: true, isHapticFeedbackEnabled: true)
        .onChange(of: crown) { _, v in
            if v - lastCrown > 3 { lastCrown = v; player.next() }
            else if lastCrown - v > 3 { lastCrown = v; player.prev() }
        }
        .task {
            kenBurns = true
            await player.load()
        }
    }
}
