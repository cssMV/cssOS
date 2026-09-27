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
    private enum InfoFocus: Hashable { case cover, play }
    @FocusState private var focus: InfoFocus?

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

                    /* W2232 — 动作排在【描述之前】。
                     * 上一版把它放在歌词全文之后 = 排在一屏之外, 等于没有。
                     * 电视上"要往下滚才能找到播放"这件事本身就是设计错误。 */
                    HStack(spacing: 22) {
                        Button { play(w) } label: {
                            Label("Play", systemImage: "play.fill")
                                .font(.system(size: 26, weight: .bold))
                                .padding(.horizontal, 12)
                        }
                        .focused($focus, equals: .play)
                        Button("Close") { dismiss() }
                            .font(.system(size: 26, weight: .semibold))
                    }

                    if !w.summaryText.isEmpty {
                        Text(w.summaryText)
                            .font(.system(size: 28))
                            .foregroundStyle(.white.opacity(0.88))
                            .lineSpacing(9)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    /* 歌词全文。summaryText 只是开头几句(顶排那一格放不下更多),
                     * 但用户既然专门点了 More Info, 就该看到全部, 不是再给一次摘要。 */
                    let lp = w.displayLyrics
                    if !lp.isEmpty, lp.count > w.summaryText.count {
                        Divider().overlay(Color.white.opacity(0.18))
                        Text(lp)
                            .font(.system(size: 24))
                            .foregroundStyle(.white.opacity(0.62))
                            .lineSpacing(8)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 40)
            }
        }
        .padding(.horizontal, 90)
        .padding(.vertical, 70)
    }

    /* CSSOS_WAVE_2232 20260927 — 封面【可点即播】。
     * Jing:「More Info 点击进去, 没有一个播放的链接, 不对, 请改进, 图片可以点进播放。」
     * 上一版其实是有 Play 按钮的 —— 但它排在【歌词全文的下面】, 被推出了可视区,
     * 用户看到的就是"没有播放入口"。所以这里两头都治: 封面本身能点, 按钮也提到上面去。
     * 电视上"一张大图能按下去就播"本来就是最自然的操作, 比找按钮快。 */
    private func cover(_ w: CSSWork) -> some View {
        Button { play(w) } label: {
            ZStack(alignment: w.coverAlignment) {
                if let c = w.coverURL, let url = URL(string: c) {
                    AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                    placeholder: { Color.white.opacity(0.07) }
                } else { Color.white.opacity(0.07) }
            }
            .frame(width: 640, height: 360)      // 21:9 太扁、16:9 最接近顶排那一格的观感
            .clipped()
            .overlay(alignment: .bottomLeading) {
                // 明示"这张图是可以按的" —— 没有这个提示, 可点也等于没有。
                Label("Play", systemImage: "play.circle.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Capsule().fill(.black.opacity(0.55)))
                    .padding(16)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
        .focused($focus, equals: .cover)
    }

    /// 关屏 → 再开播放器。两层 fullScreenCover 同帧切换会打架, 必须等这一层真的收完。
    private func play(_ w: CSSWork) {
        dismiss()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onPlay(w) }
    }

    /// 曲风 / 作者 / 时长 / 语言。用平台的胶囊观感, 不另造一套徽章。
    @ViewBuilder
    private func metaRow(_ w: CSSWork) -> some View {
        let langs = (w.availableLangs ?? []).map { $0.uppercased() }
        VStack(alignment: .leading, spacing: 12) {
            let st = w.displayStyle
            if !st.isEmpty {
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
        /* 顶排深链进来时手上只有一个 id —— 必须自己去拉, 否则本屏永远是空的。
         * W2233: 先要市场行(它带 children —— 三部曲的词和曲风都在各部身上, 没有 children
         * 就落不到子作品去取, 简介屏会缺一大半), 详情端点兜底。 */
        let base = known ?? CSSWork(id: workId)
        var full = await CSSBackend.fetchWorkById(workId) ?? base
        if full.displayLyrics.isEmpty || full.displayStyle.isEmpty,
           let d = await CSSBackend.fetchWorkDetail(id: workId) {
            full.style = full.style ?? d.style
            full.lyricsPreview = full.lyricsPreview ?? d.lyricsPreview
            full.ownerName = full.ownerName ?? d.ownerName
        }
        await MainActor.run {
            work = full.title == nil ? base : full
            loading = false
            // 一进来焦点就在 Play 上 —— 打开简介屏最常见的下一步就是"播"。
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { focus = .play }
        }
    }
}
