// CSSOS_WAVE_1172 / W1227 / W1231 — 首页: HBO Max 风格。
// 顶部 = 自动循环的 featured hero(~5 部精选, 大幅 2.39 背景 + 标题 + 圆点指示, 每 6s 轮播);
// 下面 = Apple TV 标准多行 rails(For You / Fresh / 按类型)。选一首 → 进影院播放。

import SwiftUI
import Combine

struct ContentView: View {
    @State private var rails: [CSSRail] = []
    @State private var featured: [CSSWork] = []
    @State private var loading = true
    @State private var selected: CSSWork?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if loading {
                        ProgressView().scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 500)
                    } else {
                        if !featured.isEmpty {
                            FeaturedHero(works: featured) { w in
                                Task { selected = await CSSBackend.hydrate(w) }
                            }
                        }
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
            featured = Array(works.prefix(5))
            rails = CSSBackend.buildRails(works)
            loading = false
        }
    }
}

/// CSSOS_WAVE_1231 — HBO Max 风格顶部 featured hero: ~5 部精选自动循环轮播。
/// 大幅 2.39 电影宽银幕背景 + 渐变压暗 + 标题/▶播放 + 5 圆点指示。每 6s 自动切, 循环。
/// 焦点落在 hero 上时为可播按钮(遥控器 Select 即播当前那部)。
struct FeaturedHero: View {
    let works: [CSSWork]
    let onSelect: (CSSWork) -> Void

    @State private var index = 0
    private let timer = Timer.publish(every: 6, on: .main, in: .common).autoconnect()

    private var current: CSSWork { works[min(index, works.count - 1)] }

    var body: some View {
        Button { onSelect(current) } label: {
            ZStack(alignment: .bottomLeading) {
                // 背景: 当前精选封面, 2.39 宽银幕满宽; 切换淡入淡出。
                Group {
                    if let c = current.coverURL, let url = URL(string: c) {
                        AsyncImage(url: url) { img in
                            img.resizable().scaledToFill()
                        } placeholder: { Color.white.opacity(0.06) }
                    } else {
                        Color.white.opacity(0.06)
                    }
                }
                .id(current.id)
                .transition(.opacity)

                // 压暗渐变(左下信息可读)。
                LinearGradient(
                    colors: [.black.opacity(0.85), .black.opacity(0.25), .clear],
                    startPoint: .bottomLeading, endPoint: .topTrailing
                )

                // 左上品牌 + 左下标题/播放/圆点。
                VStack(alignment: .leading) {
                    HStack(spacing: 10) {
                        Text("css").font(.system(size: 30, weight: .heavy)).foregroundStyle(.white)
                        Text("TV").font(.system(size: 30, weight: .heavy)).foregroundStyle(.green)
                        Spacer()
                    }
                    Spacer()
                    Text(current.title ?? "Untitled")
                        .font(.system(size: 56, weight: .heavy))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .shadow(radius: 12)
                    HStack(spacing: 20) {
                        Label("Play", systemImage: "play.fill")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(.white)
                        if !current.durationLabel.isEmpty {
                            Text(current.durationLabel)
                                .font(.system(size: 22, weight: .medium))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                        Spacer()
                        // 圆点指示(5)。
                        HStack(spacing: 10) {
                            ForEach(works.indices, id: \.self) { i in
                                Circle()
                                    .fill(i == index ? Color.white : Color.white.opacity(0.35))
                                    .frame(width: 12, height: 12)
                            }
                        }
                    }
                }
                .padding(60)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 720)            // 2.39 宽银幕大幅 hero
            .clipped()
        }
        .buttonStyle(.card)
        .animation(.easeInOut(duration: 0.6), value: index)
        .onReceive(timer) { _ in
            withAnimation { index = (index + 1) % max(works.count, 1) }
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
    // CSSOS_WAVE_1228 — 画幅铁律: 横屏一律 2.39:1 电影宽银幕, 绝不 16:9。卡片 480 宽 → 201 高。
    private let cardWidth: CGFloat = 480
    private let cinemaRatio: CGFloat = 2.39

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
            .frame(width: cardWidth, height: cardWidth / cinemaRatio)
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
