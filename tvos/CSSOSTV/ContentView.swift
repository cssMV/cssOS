// CSSOS_WAVE_1172 — 首页: 大屏作品网格(为你创作 / 市场)。选一首 → 进影院播放。
// 骨架: 先拉 market 公开作品; 拿不到就只放旗舰单卡。每张卡显封面 + 标题 + ♪时长(时长铁律)。

import SwiftUI

struct ContentView: View {
    @State private var works: [CSSWork] = []
    @State private var loading = true
    @State private var selected: CSSWork?

    private let columns = [GridItem(.adaptive(minimum: 360, maximum: 480), spacing: 48)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack(spacing: 16) {
                        Text("CSS Studio").font(.system(size: 56, weight: .heavy))
                        Text("Apple TV").font(.system(size: 28, weight: .semibold)).foregroundStyle(.green)
                        Spacer()
                    }
                    .padding(.top, 24)

                    if loading {
                        ProgressView().scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 400)
                    } else {
                        LazyVGrid(columns: columns, spacing: 56) {
                            ForEach(works) { w in
                                Button {
                                    Task { selected = await CSSBackend.hydrate(w) }
                                } label: {
                                    WorkCard(work: w)
                                }
                                .buttonStyle(.card)
                            }
                        }
                    }
                }
                .padding(.horizontal, 80)
                .padding(.bottom, 80)
            }
            .background(Color.black.ignoresSafeArea())
            .fullScreenCover(item: $selected) { w in
                PlayerView(work: w)
            }
        }
        .task {
            works = await CSSBackend.fetchFeed()
            loading = false
        }
    }
}

struct WorkCard: View {
    let work: CSSWork
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
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Text(work.title ?? "Untitled")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            if !work.durationLabel.isEmpty {
                Text(work.durationLabel)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
    }
}
