// CSSOS_WAVE_2253 20260928 — 演员典故(桌面早有, TV 零引用)。
//
// Jing:「TV 端…如数字演员市场，该怎么移植？」→ 定的顺序第一波就是这屏。
// 为什么它排第一: 后端 /api/actors/:id/codex 现成, 纯前端; 而内容形态
// (生平长文 + 参演作品 + 同文明演员)正是【大屏靠着读】最合适的东西 ——
// 改之前 TV 的演员详情只显示 文明/persona/曲风/价格 四个字段, 那段完整生平根本没显示。
//
// 长文能滚这件事照搬 ProseChunks(W2234/W2234b 的成果), 不另写一份。
import SwiftUI

struct ActorCodexView: View {
    @ObservedObject var i18n = I18n.shared
    let actor: CSSActor
    @Environment(\.dismiss) private var dismiss

    @State private var codex: CSSActorCodex?
    @State private var loading = true
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    private enum Focus: Hashable { case close, bio(Int), mv(Int), related(Int) }
    @FocusState private var focus: Focus?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            HStack(alignment: .top, spacing: 56) {
                portrait
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        header
                        actionRow
                        bioSection
                        mvSection
                        relatedSection
                        // 底部留一屏余量: tvOS 焦点滚动是"把当前项滚进视野"就停,
                        // 最后一段贴着内容底边时下面没有可滚空间, 看着就是【被遮住】(W2234b)。
                        Color.clear.frame(height: 340)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, 70).padding(.top, 54)
        }
        .task {
            codex = await CSSBackend.fetchActorCodex(actor.id)
            loading = false
            // 焦点先落在关闭键上 —— 不放在长文里, 否则一进来就滚走了。
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { focus = .close }
        }
    }

    // MARK: - 左栏肖像

    private var portrait: some View {
        ZStack(alignment: actor.coverAlignment) {
            // 用 CSSPosterImage 而不是裸 AsyncImage: 它按目标尺寸降采样 + 走 CSSImageCache,
            // 大屏上一堆 4K 原图直解会把解码器吃爆(W1562 的教训)。
            CSSPosterImage(urlString: full?.cover_image ?? actor.cover_image,
                           targetSize: CGSize(width: 440, height: 560))
                .frame(width: 440, height: 560).clipped()
        }
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(brandGreen.opacity(0.28), lineWidth: 1))
    }

    // MARK: - 右栏

    private var full: CSSActorFull? { codex?.actor }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(full?.displayName.isEmpty == false ? full!.displayName : actor.displayName)
                .font(.system(size: 56, weight: .heavy)).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            // 一行元信息。空的项不占位 —— 电视上"· ·"这种空分隔看着像坏了。
            let bits: [String] = [
                actor.isLegend ? tr("Legend") : nil,
                full?.civilization ?? actor.civilization,
                full?.age_range,
                full?.voice_style ?? actor.style_descriptor,
            ].compactMap { $0?.isEmpty == false ? $0 : nil }
            if !bits.isEmpty {
                Text(bits.joined(separator: "  ·  "))
                    .font(.system(size: 24)).foregroundStyle(brandGreen.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let p = full?.persona ?? actor.persona, !p.isEmpty {
                Text(p).font(.system(size: 26)).foregroundStyle(.white.opacity(0.78))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let c = codex?.counts {
                let stats: [String] = [
                    (c.appearances ?? 0) > 0 ? tr("{n} appearances", ["n": "\(c.appearances!)"]) : nil,
                    (c.shares ?? 0) > 0 ? tr("{n} shares", ["n": "\(c.shares!)"]) : nil,
                ].compactMap { $0 }
                if !stats.isEmpty {
                    Text(stats.joined(separator: "  ·  "))
                        .font(.system(size: 20)).foregroundStyle(.white.opacity(0.45))
                }
            }
        }
    }

    /// 动作排在长文【之前】—— 排在长文之后等于排在一屏之外, 焦点也穿不过去(W2232 的教训)。
    private var actionRow: some View {
        HStack(spacing: 22) {
            Button(tr("Close")) { dismiss() }
                .font(.system(size: 26, weight: .semibold))
                .focused($focus, equals: .close)
        }
    }

    @ViewBuilder private var bioSection: some View {
        if loading {
            ProgressView().tint(brandGreen).padding(.vertical, 20)
        } else {
            let chunks = ProseChunks.splitProse(full?.bio ?? "")
            if chunks.isEmpty {
                Text(tr("No background written for this actor yet."))
                    .font(.system(size: 22)).foregroundStyle(.white.opacity(0.45))
            } else {
                Divider().overlay(.white.opacity(0.18))
                ForEach(Array(chunks.enumerated()), id: \.offset) { pair in
                    ProseChunkText(text: pair.element, focus: $focus, value: Focus.bio(pair.offset))
                }
            }
        }
    }

    @ViewBuilder private var mvSection: some View {
        let mvs = codex?.mvs ?? []
        if !mvs.isEmpty {
            Divider().overlay(.white.opacity(0.18))
            Text(tr("Appears in")).font(.system(size: 30, weight: .bold)).foregroundStyle(.white)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 22) {
                    ForEach(Array(mvs.enumerated()), id: \.offset) { pair in
                        tile(cover: pair.element.cover_url,
                             // 作品标题是【内容】, 不翻译; 角色名是后端给的数据, 同理。
                             title: pair.element.title ?? tr("Untitled"),
                             sub: pair.element.role_name,
                             value: Focus.mv(pair.offset))
                    }
                }.padding(.vertical, 8)
            }
        }
    }

    @ViewBuilder private var relatedSection: some View {
        let rel = codex?.related_actors ?? []
        if !rel.isEmpty {
            Divider().overlay(.white.opacity(0.18))
            Text(tr("From the same civilization"))
                .font(.system(size: 30, weight: .bold)).foregroundStyle(.white)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 22) {
                    ForEach(Array(rel.enumerated()), id: \.offset) { pair in
                        tile(cover: pair.element.cover_image,
                             title: pair.element.displayName,
                             sub: pair.element.civilization,
                             value: Focus.related(pair.offset))
                    }
                }.padding(.vertical, 8)
            }
        }
    }

    /// 横滑小卡。**只读** —— 这一波不接点击跳转:
    /// 从典故跳到另一位演员会把"我从哪来"的返回栈搞乱, 那是下一波的事(评论/分享同批)。
    private func tile(cover: String?, title: String, sub: String?, value: Focus) -> some View {
        let on = focus == value
        return VStack(alignment: .leading, spacing: 8) {
            ZStack {
                CSSPosterImage(urlString: cover, targetSize: CGSize(width: 220, height: 280))
                    .frame(width: 220, height: 280).clipped()
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14)
                .stroke(brandGreen.opacity(on ? 0.95 : 0.2), lineWidth: on ? 3 : 1))
            Text(title).font(.system(size: 20, weight: on ? .bold : .medium))
                .foregroundStyle(on ? brandGreen : .white.opacity(0.85))
                .lineLimit(1).frame(width: 220, alignment: .leading)
            if let s = sub, !s.isEmpty {
                Text(s).font(.system(size: 16)).foregroundStyle(.white.opacity(0.45))
                    .lineLimit(1).frame(width: 220, alignment: .leading)
            }
        }
        .scaleEffect(on ? 1.06 : 1.0)
        .focusable(true)
        .focused($focus, equals: value)
        .animation(.easeOut(duration: 0.18), value: on)
    }
}
