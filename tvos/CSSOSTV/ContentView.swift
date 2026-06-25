// CSSOS_WAVE_1172 / W1227 — 首页: Apple TV 标准多行 rails(不再一堵扁平卡片墙)。
// 每行 = 标题 + 横向滚动作品卡(封面 + 标题 + ♪时长, 时长铁律)。选一首 → 进影院播放。
// 骨架: 先拉 market 公开作品 → buildRails 分轨; 拿不到就只放旗舰单卡。

import SwiftUI

struct ContentView: View {
    @State private var rails: [CSSRail] = []
    @State private var loading = true
    @State private var selected: CSSWork?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 16) {
                        Text("CSS Studio").font(.system(size: 56, weight: .heavy))
                        Text("Apple TV").font(.system(size: 28, weight: .semibold)).foregroundStyle(.green)
                        Spacer()
                    }
                    .padding(.horizontal, 80)
                    .padding(.top, 40)
                    .padding(.bottom, 12)

                    if loading {
                        ProgressView().scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 500)
                    } else {
                        ForEach(rails) { rail in
                            RailRow(rail: rail) { w in
                                Task { selected = await CSSBackend.hydrate(w) }
                            }
                        }
                    }
                }
                .padding(.bottom, 80)
            }
            .background(Color.black.ignoresSafeArea())
            .fullScreenCover(item: $selected) { w in
                PlayerView(work: w)
            }
        }
        .task {
            let works = await CSSBackend.fetchFeed()
            rails = CSSBackend.buildRails(works)
            loading = false
        }
    }
}

/// CSSOS_WAVE_1227 — 一行 rail: 标题 + 横向滚动卡片(tvOS 焦点引擎天然处理左右选中)。
struct RailRow: View {
    let rail: CSSRail
    let onSelect: (CSSWork) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(rail.title)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white.opacity(0.95))
                .padding(.horizontal, 80)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 36) {
                    ForEach(rail.works) { w in
                        Button { onSelect(w) } label: { WorkCard(work: w) }
                            .buttonStyle(.card)
                    }
                }
                .padding(.horizontal, 80)
                .padding(.vertical, 24)   // 给焦点放大留出空间, 不被相邻行裁切
            }
        }
        .padding(.bottom, 18)
    }
}

struct WorkCard: View {
    let work: CSSWork
    // CSSOS_WAVE_1227 — 横向 rail 里卡片定宽; 16:9 封面(420×236)。
    private let cardWidth: CGFloat = 420

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                if let c = work.coverURL, let url = URL(string: c) {
                    AsyncImage(url: url) { img in
                        img.resizable().scaledToFill()
                    } placeholder: {
                        Color.white.opacity(0.08)
                    }
                } else {
                    Color.white.opacity(0.08)
                }
            }
            .frame(width: cardWidth, height: cardWidth * 9 / 16)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Text(work.title ?? "Untitled")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            if !work.durationLabel.isEmpty {
                Text(work.durationLabel)
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
        .frame(width: cardWidth, alignment: .leading)
    }
}
