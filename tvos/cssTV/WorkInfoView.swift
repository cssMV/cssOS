// CSSOS_WAVE_2231 20260927 — 作品简介屏(顶排「More Info」落点)。
//
// Jing:「现在点 play 和 More Info 功能一样, 都是播放媒体,
//        我希望是 More Info 区域显示描述性文字。」
//
// 【为什么以前一样】不是 More Info 没做, 是 TopShelf 那边把 playAction 和 displayAction
// 赋了【同一个 TVTopShelfAction】—— 两个按钮指向同一条深链 csstv://work/<id>, 自然做同一件事。
// 现在 displayAction 走 csstv://info/<id>, 落到本屏; playAction 仍走 csstv://work/<id> 直接开播。
//
// 本屏只做一件事: 把这首作品【说清楚】。封面 + 标题 + 曲风 + 作者 + 时长 + 语言 + 概述 + 歌词全文。
// 末尾给一个 Play 按钮 —— 看完想听, 不该还要退回去重新找一遍。

import SwiftUI

struct WorkInfoView: View {
    let workId: String
    /// 已知的作品(从首页点进来时有); 顶排深链进来时为 nil → 本屏自己去拉。
    let known: CSSWork?
    /// 用户在本屏按了 Play。交回给 ContentView 开播放器(播放器只该有一个入口)。
    let onPlay: (CSSWork) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var work: CSSWork?
    @State private var loading = true

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if loading {
                ProgressView().tint(brandGreen).scaleEffect(1.6)
            } else if let w = work {
                content(w)
            } else {
                VStack(spacing: 20) {
                    Text("This work is no longer available.")
                        .font(.system(size: 30)).foregroundStyle(.white.opacity(0.6))
                    Button("Close") { dismiss() }.font(.system(size: 24, weight: .semibold))
                }
            }
        }
        .task { await load() }
        .onExitCommand { dismiss() }
    }

    // MARK: - 版式: 左封面 / 右文字。电视观看距离下, 文字列不宜超过屏宽一半。

    private func content(_ w: CSSWork) -> some View {
        HStack(alignment: .top, spacing: 60) {
            cover(w)
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(w.title ?? "Untitled")
                        .font(.system(size: 52, weight: .heavy))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    metaRow(w)

                    if !w.summaryText.isEmpty {
                        Text(w.summaryText)
                            .font(.system(size: 28))
                            .foregroundStyle(.white.opacity(0.88))
                            .lineSpacing(9)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    /* 歌词全文。summaryText 只是开头几句(顶排那一格放不下更多),
                     * 但用户既然专门点了 More Info, 就该看到全部, 不是再给一次摘要。 */
                    if let lp = w.lyricsPreview, !lp.isEmpty, lp.count > w.summaryText.count {
                        Divider().overlay(Color.white.opacity(0.18))
                        Text(lp)
                            .font(.system(size: 24))
                            .foregroundStyle(.white.opacity(0.62))
                            .lineSpacing(8)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    HStack(spacing: 22) {
                        Button {
                            dismiss()
                            // 等本屏真的收完再开播放器, 否则两层 fullScreenCover 会打架。
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onPlay(w) }
                        } label: {
                            Label("Play", systemImage: "play.fill")
                                .font(.system(size: 26, weight: .bold))
                                .padding(.horizontal, 12)
                        }
                        Button("Close") { dismiss() }
                            .font(.system(size: 26, weight: .semibold))
                    }
                    .padding(.top, 10)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 40)
            }
        }
        .padding(.horizontal, 90)
        .padding(.vertical, 70)
    }

    private func cover(_ w: CSSWork) -> some View {
        ZStack(alignment: w.coverAlignment) {
            if let c = w.coverURL, let url = URL(string: c) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { Color.white.opacity(0.07) }
            } else { Color.white.opacity(0.07) }
        }
        .frame(width: 640, height: 360)      // 21:9 太扁、16:9 最接近顶排那一格的观感
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    /// 曲风 / 作者 / 时长 / 语言。用平台的胶囊观感, 不另造一套徽章。
    @ViewBuilder
    private func metaRow(_ w: CSSWork) -> some View {
        let langs = (w.availableLangs ?? []).map { $0.uppercased() }
        VStack(alignment: .leading, spacing: 12) {
            if let st = w.style, !st.isEmpty {
                Text(st)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(brandGreen)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                if let on = w.ownerName, !on.isEmpty { chip(on, icon: "person.fill") }
                if !w.durationLabel.isEmpty { chip(w.durationLabel.replacingOccurrences(of: "\u{266A} ", with: ""), icon: "clock") }
                ForEach(langs, id: \.self) { l in chip(l, icon: "globe") }
            }
        }
    }

    private func chip(_ text: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold))
            Text(text).font(.system(size: 19, weight: .semibold))
        }
        .foregroundStyle(.white.opacity(0.82))
        .padding(.horizontal, 14).padding(.vertical, 7)
        .background(Capsule().fill(Color.white.opacity(0.14)))
    }

    // MARK: - 取

    private func load() async {
        // 顶排深链进来时手上只有一个 id —— 必须自己去拉, 否则本屏永远是空的。
        let base = known ?? CSSWork(id: workId)
        let full = await CSSBackend.fetchWorkDetail(id: workId) ?? base
        await MainActor.run { work = full.title == nil ? base : full; loading = false }
    }
}
