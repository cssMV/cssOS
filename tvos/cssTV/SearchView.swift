// W1277 — cssTV 搜索。在已加载的作品里按标题即时过滤(Siri Remote 听写=语音搜索)。
// 点结果 → onPick(回到首页用统一 gating/播放链路)。

import SwiftUI

struct SearchView: View {
    let allWorks: [CSSWork]          // 本地 feed: 即时预过滤, 同时后台查全库
    var onPick: (CSSWork) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [CSSWork] = []
    @State private var searching = false
    @State private var searchTask: Task<Void, Never>? = nil
    @FocusState private var fieldFocused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    private let cols = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 28)]

    // W1279 — 全库搜索(后端), 输入防抖 0.3s; 先用本地命中即时占位。
    private func runSearch(_ raw: String) {
        searchTask?.cancel()
        let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { results = []; searching = false; return }
        // 本地即时预过滤(标题), 让用户立刻看到反馈。
        let local = allWorks.filter { ($0.title ?? "").lowercased().contains(q.lowercased()) }
        results = local
        searching = true
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            let remote = await CSSBackend.searchWorks(q)
            if Task.isCancelled { return }
            await MainActor.run {
                // 合并去重(后端为准, 本地补充), 保后端顺序。
                var seen = Set<String>(); var merged: [CSSWork] = []
                for w in remote + local where !seen.contains(w.id) { seen.insert(w.id); merged.append(w) }
                results = merged
                searching = false
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 28) {
                // W1280 — 🔍 在框内(桌面端一致), 去掉 Close(遥控 Menu 键退出)。
                HStack(spacing: 16) {
                    Image(systemName: "magnifyingglass").font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(brandGreen)
                    TextField("Search cssTV — hold 🎙 to speak", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 30, weight: .semibold))
                        .focused($fieldFocused)
                }
                .padding(22)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.08)))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(brandGreen.opacity(fieldFocused ? 0.9 : 0.3), lineWidth: 2))
                .padding(.horizontal, 60).padding(.top, 50)

                if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    Spacer()
                    Text("Type or speak to find a work").font(.system(size: 26))
                        .foregroundStyle(.white.opacity(0.5))
                    Spacer()
                } else if results.isEmpty {
                    Spacer()
                    if searching {
                        ProgressView().scaleEffect(1.4)
                        Text("Searching…").font(.system(size: 24)).foregroundStyle(.white.opacity(0.5)).padding(.top, 8)
                    } else {
                        Text("No works match “\(query)”").font(.system(size: 26))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer()
                } else {
                    ScrollView {
                        LazyVGrid(columns: cols, spacing: 28) {
                            ForEach(results) { w in
                                Button { onPick(w) } label: { resultCard(w) }
                                    .buttonStyle(.card)
                            }
                        }
                        .padding(.horizontal, 60).padding(.bottom, 60)
                    }
                }
            }
        }
        .onAppear { fieldFocused = true }
        .onChange(of: query) { _, q in runSearch(q) }   // W1279 — 输入即查(防抖 0.3s, 全库)
    }

    @ViewBuilder
    private func resultCard(_ w: CSSWork) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                Rectangle().fill(Color.white.opacity(0.06))
                if let c = w.coverURL, let url = URL(string: c) {
                    AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.clear }
                }
            }
            .aspectRatio(2.39, contentMode: .fit)   // 画幅铁律 2.39 宽银幕
            .clipShape(RoundedRectangle(cornerRadius: 10))
            Text(w.title ?? "Untitled").font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white).lineLimit(1)
            if !w.durationLabel.isEmpty {
                Text(w.durationLabel).font(.system(size: 15)).foregroundStyle(.white.opacity(0.55))
            }
        }
    }
}
