// W1277 — cssTV 搜索。在已加载的作品里按标题即时过滤(Siri Remote 听写=语音搜索)。
// 点结果 → onPick(回到首页用统一 gating/播放链路)。

import SwiftUI

struct SearchView: View {
    let allWorks: [CSSWork]
    var onPick: (CSSWork) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var fieldFocused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    private let cols = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 28)]

    private var results: [CSSWork] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return [] }
        return allWorks.filter { ($0.title ?? "").lowercased().contains(q) }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 28) {
                HStack(spacing: 16) {
                    Image(systemName: "magnifyingglass").font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(brandGreen)
                    TextField("Search works by title — hold 🎙 to speak", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 30, weight: .semibold))
                        .focused($fieldFocused)
                    Button("Close") { dismiss() }
                        .font(.system(size: 20)).buttonStyle(.plain)
                        .foregroundStyle(.white.opacity(0.6))
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
                    Text("No works match “\(query)”").font(.system(size: 26))
                        .foregroundStyle(.white.opacity(0.5))
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
