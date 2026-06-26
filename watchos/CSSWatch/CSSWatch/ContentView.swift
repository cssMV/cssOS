// CSS Watch — 主界面: 正方形封面(裁满+缓慢运镜) + 半圆爆情绪字幕 + 点按播放/暂停 + 表冠切歌。
import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var player = WatchPlayer()
    @State private var crown = 0.0
    @State private var lastCrown = 0.0

    var body: some View {
        ZStack {
            Color.black

            // 正方形封面裁满 + 缓慢 Ken Burns(W1425: 手动 URLSession+UIImage, 绕开 AsyncImage 对 webp 的怪癖)。
            CoverImage(urlString: player.current?.coverURL ?? "")

            // 暗角 → 字幕更清楚。
            RadialGradient(colors: [.clear, .black.opacity(0.5)], center: .center, startRadius: 38, endRadius: 135)

            // 招牌: 半圆爆情绪字幕(顶部铺向两边)。
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
        .onTapGesture { player.togglePlay() }                          // 点按 = 播放/暂停
        .focusable()
        .digitalCrownRotation($crown, from: -1_000_000, through: 1_000_000, by: 1,
                              sensitivity: .low, isContinuous: true, isHapticFeedbackEnabled: true)
        .onChange(of: crown) { _, v in                                  // 表冠 = 上/下首
            if v - lastCrown > 3 { lastCrown = v; player.next() }
            else if lastCrown - v > 3 { lastCrown = v; player.prev() }
        }
        .task { await player.load() }
    }
}

/// 封面: 手动 URLSession 拉 Data → UIImage(支持 webp), 裁满正方形 + 缓慢运镜。换歌自动重载。
private struct CoverImage: View {
    let urlString: String
    @State private var image: UIImage? = nil
    @State private var kenBurns = false

    var body: some View {
        Group {
            if let img = image {
                Image(uiImage: img).resizable().scaledToFill()
                    .scaleEffect(kenBurns ? 1.14 : 1.0)
                    .animation(.easeInOut(duration: 12).repeatForever(autoreverses: true), value: kenBurns)
            } else {
                LinearGradient(colors: [.teal.opacity(0.4), .black], startPoint: .top, endPoint: .bottom)
            }
        }
        .task(id: urlString) {
            image = nil; kenBurns = false
            guard let url = URL(string: urlString), !urlString.isEmpty else { return }
            if let (data, _) = try? await URLSession.shared.data(from: url), let ui = UIImage(data: data) {
                image = ui
                kenBurns = true
            }
        }
    }
}
