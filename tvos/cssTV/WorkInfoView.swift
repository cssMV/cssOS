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
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    let workId: String
    /// 已知的作品(从首页点进来时有); 顶排深链进来时为 nil → 本屏自己去拉。
    let known: CSSWork?
    /// 用户在本屏按了 Play。交回给 ContentView 开播放器(播放器只该有一个入口)。
    let onPlay: (CSSWork) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var work: CSSWork?
    @State private var loading = true
    private enum InfoFocus: Hashable { case cover, play, lyrics(Int) }
    @FocusState private var focus: InfoFocus?
    /// 生歌词全文, 原样(带 [Verse 1: …] 这类小节标题)。
    /// W2235: 不再和概述比长度 —— 概述已从本屏去掉, 这里就是这屏唯一的歌词来源。
    private func lyricsBody(_ w: CSSWork) -> String { w.displayLyrics }

    /// W2234b — 把歌词切成【若干可聚焦段】。按空行切(歌词本来分节), 太碎的合并。
    private func lyricChunks(_ w: CSSWork) -> [String] {
        let body = lyricsBody(w)
        guard !body.isEmpty else { return [] }
        var out: [String] = []
        var cur = ""
        for block in body.components(separatedBy: "\n\n") {
            let b = block.trimmingCharacters(in: .whitespacesAndNewlines)
            if b.isEmpty { continue }
            // W2235 — [Verse 1: …] 这类小节标题常常自成一段。让它跟着【下面那节】走,
            // 否则会出现"一整屏只有一个标题"的落点, 按一下滚一下, 很蠢。
            if b.hasPrefix("[") && b.hasSuffix("]") && !b.contains("\n") {
                cur = cur.isEmpty ? b : cur + "\n\n" + b
                continue
            }
            // 一段少于 4 行就先攒着 —— 一行一段的话用户要按几十下才到底。
            cur = cur.isEmpty ? b : cur + "\n\n" + b
            if cur.components(separatedBy: "\n").count >= 4 { out.append(cur); cur = "" }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

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
                    Text(tr("This work is no longer available."))
                        .font(.system(size: 30)).foregroundStyle(.white.opacity(0.6))
                    Button(tr("Close")) { dismiss() }.font(.system(size: 24, weight: .semibold))
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
                    Text(w.title ?? tr("Untitled"))
                        .font(.system(size: 52, weight: .heavy))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    metaRow(w)

                    /* W2232 — 动作排在【描述之前】。
                     * 上一版把它放在歌词全文之后 = 排在一屏之外, 等于没有。
                     * 电视上"要往下滚才能找到播放"这件事本身就是设计错误。 */
                    HStack(spacing: 22) {
                        Button { play(w) } label: {
                            Label(tr("Play"), systemImage: "play.fill")
                                .font(.system(size: 26, weight: .bold))
                                .padding(.horizontal, 12)
                        }
                        .focused($focus, equals: .play)
                        Button(tr("Close")) { dismiss() }
                            .font(.system(size: 26, weight: .semibold))
                    }

                    /* CSSOS_WAVE_2235 20260927 — 这屏只显示【生歌词】, 不再另起一段"概述"。
                     *
                     * Jing:「显示的歌词, 是否可以显示"生歌词"版本, 不要显示"熟歌词"版本,
                     *        因为"生歌词"版本有那些标签, 如 [Verse 1 小标题]。」
                     *
                     * 原来这里排着 summaryText —— 它就是【同一段歌词的前几行, 把方括号标签剥掉】。
                     * 也就是说这屏上半截是熟歌词、下半截是生歌词, 同一首词印了两遍, 上面那遍还缺标签。
                     * 既然要生歌词, 这段概述在本屏纯属重复, 直接去掉, 整屏从第一行起就是原样。
                     *
                     * summaryText 本身【保留】—— 顶排那一格是苹果的「summary」概述位, 一段话的篇幅,
                     * 方括号放进去会显得像坏掉。两处的用途本来就不同, 不要顺手把它也删了。
                     */

                    /* CSSOS_WAVE_2234 20260927 — 文字区必须能滚。
                     *
                     * Jing:「More Info 进去之后, 应该设为可以上下滚动, 否则无法看完整个内容。」
                     *
                     * 本来就是 ScrollView —— 但在 tvOS 上【ScrollView 自己不响应方向键】:
                     * 焦点引擎只在【可聚焦的子项之间】移动, 顺带把它们滚进视野。纯 Text 不可聚焦,
                     * 于是整段长文既进不去焦点、也就永远滚不动 —— 看着像滚动条坏了, 其实是
                     * 这一段根本不在焦点系统里。
                     * (这也是为什么上一版把 Play 按钮放在歌词之后 = 永远够不着: 按钮倒是可聚焦,
                     *  但要先"穿过"一段不可聚焦的长文才能到, 焦点引擎不会那样跳。)
                     *
                     * 修法就是把长文本身变成一个可聚焦项, 聚焦时给一点提示(左侧绿条 + 提亮),
                     * 这样 ↑/↓ 就能把它滚起来。 */
                    /* CSSOS_WAVE_2234b 20260927 — 必须拆成【多段】, 一整段滚不到底。
                     *
                     * Jing:「可以往下移动了, 可是还是无法移动到底部, 还有有些底部内容被遮住。」
                     *
                     * 上一版把整段歌词做成【一个】可聚焦项: 焦点引擎的工作是"把当前这一项
                     * 滚进视野", 而这一项本身比屏幕还高 —— 它滚到顶就到头了, 再往下【没有
                     * 下一个落点】, 于是卡在半途, 下半段永远露不出来。
                     * 拆成若干段之后, ↓ 是在段与段之间走, 每走一段就往下滚一屏, 一路能到底。
                     *
                     * 按空行切(歌词本来就是分节的), 太碎的段落合并, 免得按几十下才到底。 */
                    let chunks = lyricChunks(w)
                    if !chunks.isEmpty {
                        Divider().overlay(Color.white.opacity(0.18))
                        ForEach(Array(chunks.enumerated()), id: \.offset) { pair in
                            lyricChunkView(pair.element, index: pair.offset)
                        }
                    }

                    /* 歌词全文。summaryText 只是开头几句(顶排那一格放不下更多),
                     * 但用户既然专门点了 More Info, 就该看到全部, 不是再给一次摘要。 */

                }
                .frame(maxWidth: .infinity, alignment: .leading)
                /* W2234b — 底部留一屏余量。tvOS 焦点滚动是"把当前项滚进视野"就停,
                 * 最后一段若正好贴着内容底边, 它下面没有可滚的空间, 看着就是【被遮住】。
                 * 留白不是美观问题, 是【让最后一段也能滚到舒服的位置】。 */
                .padding(.bottom, 320)
            }
        }
        .padding(.horizontal, 90)
        .padding(.top, 60)
        .padding(.bottom, 20)     // W2234b — 底部别再夹, 可滚区尽量高
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
                Label(tr("Play"), systemImage: "play.circle.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Capsule().fill(.black.opacity(0.55)))
                    .padding(16)
            }
            .mediaFrameGlow(focused: focus == .cover)    // W2242 — 平台特色的散发绿光
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

    /// W2234b — 一段歌词 = 一个焦点落点。聚焦时左侧出绿条 + 提亮(不给提示用户不知道能按)。
    @ViewBuilder
    private func lyricChunkView(_ text: String, index: Int) -> some View {
        let on = focus == .lyrics(index)
        Text(text)
            .font(.system(size: 24))
            .foregroundStyle(.white.opacity(on ? 0.95 : 0.6))
            .lineSpacing(8)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 16)
            .padding(.vertical, 6)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(brandGreen.opacity(on ? 0.9 : 0.0))
                    .frame(width: 4)
            }
            .focusable(true)
            .focused($focus, equals: .lyrics(index))
            .animation(.easeOut(duration: 0.18), value: on)
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


/* ─────────────────────────────────────────────────────────────────────────────
 * CSSOS_WAVE_2242 20260927 — 媒体框「散发绿色光芒」搬上 tvOS。
 *
 * Jing:「More Info 进去后显示的封面图, 请使用图3 的散发绿色光芒的边框风格,
 *        那是我们平台的特色风格。」
 *
 * 【参数不是我捏的, 是从 W1983 那份定稿里逐字取的】(public/style.watch.css 末尾):
 *     box-shadow: 0 0 14px rgba(0,245,160,.34),
 *                 0 0 38px rgba(0,245,160,.22),
 *                 0 0 78px rgba(11,247,255,.12),
 *                 inset 0 0 22px rgba(0,245,160,.13);
 *     border-radius: 0;  background: none;
 * 那条宪法的五条性质这里一条不少:
 *   ① 没有实心绿带 —— 一条 stroke 都不画(W1983 的原话: "太绿"的唯一来源就是那条实边)
 *   ② 只有辉光 —— 向外三层 + 向内一层
 *   ③ 直角 —— 原来是 cornerRadius:18, 现在是 Rectangle。Jing 反复说过不要圆角
 *   ④ 贴画面矩形 —— 贴 640×360 的封面本身, 不贴卡片外框
 *   ⑤ 只在该出现的地方出现
 *
 * 【CSS blur → SwiftUI radius 要折半】: CSS 的 blur-radius B 对应高斯 σ=B/2,
 * 而 SwiftUI .shadow(radius:) 吃的就是那个 σ 量级。直接把 14/38/78 填进去会糊成一团 ——
 * 所以是 7 / 19 / 39。这一步不折算, 观感就不是"同一圈光"。
 *
 * 【这不是改 W1983】那条宪法管的是网页端 .watch-screen::after, 一个字节都没动;
 * 这里是把同一套观感【搬到 tvOS】。要改网页那圈, 仍然必须先拿 Jing 的 yes。
 */
private struct MediaFrameGlow: ViewModifier {
    var focused: Bool
    private let g = Color(red: 0.0, green: 0.96, blue: 0.63)     // rgb(0,245,160)
    private let c = Color(red: 0.043, green: 0.969, blue: 1.0)   // rgb(11,247,255)

    func body(content: Content) -> some View {
        content
            // 直角 —— 先切成矩形, 内辉光才贴得住边
            .clipShape(Rectangle())
            // ④ 向内 22px 绿(inset): 用一圈模糊的描边再裁掉外溢, 就是内辉光
            .overlay(
                Rectangle()
                    .strokeBorder(g.opacity(0.13), lineWidth: 11)
                    .blur(radius: 11)
                    .clipShape(Rectangle())
                    .allowsHitTesting(false)
            )
            // ①②③ 向外三层 —— 顺序照 CSS, 由近及远
            .shadow(color: g.opacity(focused ? 0.46 : 0.34), radius: 7)
            .shadow(color: g.opacity(focused ? 0.30 : 0.22), radius: 19)
            .shadow(color: c.opacity(focused ? 0.18 : 0.12), radius: 39)
            .animation(.easeInOut(duration: 0.28), value: focused)
    }
}

extension View {
    /// W2242 — 平台特色的「散发绿色光芒」媒体框(参数取自 W1983 定稿)。
    /// focused 只把三层光整体提亮一档, 【不加任何描边】—— 加了就违反第 ① 条。
    func mediaFrameGlow(focused: Bool = false) -> some View {
        modifier(MediaFrameGlow(focused: focused))
    }
}
