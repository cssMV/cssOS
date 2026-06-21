// CSSOS_WAVE_975 — 可拖拽空间控制窗(visionOS 原生 WindowGroup, 自带抓取条, 放房间任意处)。
// 整合【交易 + 多语言/多声线】于一窗(不再压在视频上、不再难点)。延续"在哪用在哪改"原则:
// 看着视频, 想打赏/换语言/换声线 → 抓这个小窗到顺手处, 一直在那, 不用找。
//
// 跨窗→沉浸: 打赏的"金光飞向银幕"是沉浸空间特效, 窗口按钮只 settings.tipPulse += 1,
// ImmersiveView 观察到再放特效 + 调后端。

import SwiftUI

struct ControlsPanel: View {
    @EnvironmentObject var player: PlayerController
    @EnvironmentObject var settings: CathedralSettings

    var body: some View {
        VStack(spacing: 22) {
            Text(L("Now Playing", "正在播放"))
                .font(.headline).foregroundStyle(.secondary)
            Text(player.work?.title ?? "—")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .lineLimit(1)

            // 交易: 欣赏 / 聆听(免费)。W1068 — 首版无内购(3.1.1): 打赏/买断隐藏(IAP 未接前不在 Vision 售卖)。
            FlowRow(spacing: 14) {
                if CSSPayments.visionPurchasesEnabled {
                    cap("💝 " + L("Tip", "打赏"), tint: .green) {
                        settings.tipPulse += 1   // → 圣殿金光飞射(ImmersiveView 观察)
                        if let id = player.work?.id { Task { await SpatialTip.sendTip(workID: id, amountCents: 100) } }
                    }
                }
                cap("👁 " + L("View · Free", "欣赏 · 免费")) {}
                cap("🎧 " + L("Listen · Free", "聆听 · 免费")) {}
                if CSSPayments.visionPurchasesEnabled {
                    cap("💎 " + L("Buyout", "买断")) {}
                }
            }

            Divider().frame(width: 460)

            // 🌐 多语言 / 🎤 多声线: 各变体一段, 点切激活屏。
            if player.variants.count > 1 {
                Text(L("Languages / Voices", "多语言 / 多声线"))
                    .font(.headline).foregroundStyle(.secondary)
                FlowRow(spacing: 12) {
                    ForEach(Array(player.variants.enumerated()), id: \.offset) { i, v in
                        cap(v.label, tint: i == player.activeIndex ? .green : .white) {
                            player.setActive(i)
                        }
                    }
                }
            } else {
                Text(L("Single language", "单语言作品"))
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(34)
        .frame(minWidth: 520)
    }

    // W1051 — visionOS 可靠命中胶囊: 背景 + contentShape 都包在 label 内 → 整个胶囊可点(不只文字),
    //   高度≥64 满足 visionOS 触达建议, hoverEffect 抬起整个胶囊。
    private func cap(_ text: String, tint: Color = .white, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(tint == .green ? .green : .white.opacity(0.95))
                .lineLimit(1)
                .padding(.horizontal, 24)
                .frame(minHeight: 64)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(tint == .green ? Color.green.opacity(0.55) : Color.white.opacity(0.18), lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .hoverEffect()
    }
}

// W1051 — 简易自动换行布局(visionOS 16+/iOS 16+ Layout): 胶囊放不下就换行, 不再被压扁难点。
struct FlowRow: Layout {
    var spacing: CGFloat = 12
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0 && x + sz.width > maxW { x = 0; y += rowH + spacing; rowH = 0 }
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
        return CGSize(width: maxW == .infinity ? x : maxW, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxW = bounds.width
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0 && x + sz.width > maxW { x = 0; y += rowH + spacing; rowH = 0 }
            s.place(at: CGPoint(x: bounds.minX + x + sz.width / 2, y: bounds.minY + y + sz.height / 2),
                    anchor: .center, proposal: ProposedViewSize(sz))
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
    }
}
