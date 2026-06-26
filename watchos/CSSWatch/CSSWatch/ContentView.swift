// CSS Watch — 主界面: 正方形封面 + 半圆爆情绪字幕 + 加载时魔镜金球转 + 表冠音量 / 滑动切歌 / 点按暂停。
import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var player = WatchPlayer()
    @State private var vol = 0.85
    @State private var orbSpin = 0.0

    var body: some View {
        ZStack {
            Color.black

            // 正方形封面裁满 + 缓慢运镜(手动 URLSession+UIImage)。
            CoverImage(urlString: player.current?.coverURL ?? "")

            RadialGradient(colors: [.clear, .black.opacity(0.5)], center: .center, startRadius: 38, endRadius: 135)

            // 器乐段: 小 emoji 从四边框响应音量往里飘(前奏/间奏/尾声/无歌声)。
            InstrumentalEdgeEmoji(active: player.instrumental, emotion: player.lastEmotion)

            // 招牌: 靠边框爆情绪字幕(半字出框; 大 emoji 当背景, 小 emoji 从字心爆烟花)。
            MiniEmotionSubtitle(token: player.burst, tick: player.burstTick)

            // 左上角: 音乐时长倒计时(右上角是系统时间)。
            if !player.loading, !player.remainingText.isEmpty {
                // W1433 — 左上倒计时与右上系统时间【同样大、对称】(去胶囊底, 加阴影保证可读)。
                VStack {
                    HStack {
                        Text(player.remainingText)
                            .font(.system(size: 17, weight: .medium))   // W1435 — 与系统时间一致(原22粗体过大被切)
                            .foregroundStyle(.white)
                            .lineLimit(1).fixedSize()                    // 永不被截
                            .shadow(color: .black.opacity(0.6), radius: 2)
                        Spacer()
                    }
                    Spacer()
                }
                .padding(.leading, 16).padding(.top, 15)   // W1436 — 下移到与右上系统时间同一行(原 5 太高)
            }

            // 加载时: 魔镜(尖角托盘 + 金球居中【自转】), 和别的平台一样。
            if player.loading {
                ZStack {
                    Image("MirrorRing").resizable().scaledToFit().frame(width: 96, height: 96)
                    Image("MirrorOrb").resizable().scaledToFit().frame(width: 44, height: 44)
                        .rotationEffect(.degrees(orbSpin))
                }
                .onAppear {
                    withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) { orbSpin = 360 }
                }
            }

            // 音量指示(调表冠时短暂显示)。
            if player.showVol {
                VStack {
                    HStack(spacing: 6) {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 11))
                        ProgressView(value: player.volume).frame(width: 80)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(.black.opacity(0.55), in: Capsule())
                    Spacer()
                }
                .padding(.top, 6)
                .transition(.opacity)
            }

            // 底部标题 + 播放态。
            if !player.loading {
                VStack {
                    Spacer()
                    HStack(spacing: 5) {
                        Image(systemName: player.isPlaying ? "waveform" : "pause.fill").font(.system(size: 10))
                        Text(player.current?.title ?? "CSS").font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    }
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(.bottom, 3)
                }
            }
        }
        .ignoresSafeArea()
        .onTapGesture { player.togglePlay() }                          // 点按 = 播放/暂停
        // 左右滑动 = 上/下首(侧边按钮系统占用, 不可用 → 用滑动, 手表最自然)。
        .simultaneousGesture(
            DragGesture(minimumDistance: 28)
                .onEnded { v in
                    if v.translation.width < -34 { player.next() }
                    else if v.translation.width > 34 { player.prev() }
                }
        )
        // Digital Crown 转 = 音量。
        .focusable()
        .digitalCrownRotation($vol, from: 0, through: 1, by: 0.03,
                              sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true)
        .onChange(of: vol) { _, v in player.setVolume(v) }
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
                image = Self.centerSquare(ui)   // W1430 — 从超宽幅(2.39:1)截取中央正方形, 手表绝不用宽屏
                kenBurns = true
            }
        }
    }

    /// 中央正方形裁切: 取图中心边长 = min(宽,高) 的方块。手表只显示方图, 永不宽屏。
    static func centerSquare(_ img: UIImage) -> UIImage {
        guard let cg = img.cgImage else { return img }
        let w = CGFloat(cg.width), h = CGFloat(cg.height)
        let side = min(w, h)
        let rect = CGRect(x: ((w - side) / 2).rounded(), y: ((h - side) / 2).rounded(), width: side, height: side)
        if let c = cg.cropping(to: rect) { return UIImage(cgImage: c) }
        return img
    }
}
