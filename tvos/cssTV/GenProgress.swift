// CSSOS_WAVE_2321 20261115 — 生成进度条(cssTV 所有创作入口共用)。
//
// Jing:「无论在 cssTV 哪个生成入口, 生成作品的过程, 是否可以让屏幕显示为类似:
//        ✨ 选角锁定 — 创作中…            ~90s    歌词+封面 ×3 部
//        🎼 正在为《西施三部曲》作曲…      ~2-5min 音乐×3 + 画面×3 + 字幕×3
//        ▶ 就绪 — 正在打开…」
//
// 为什么做成【一个共用组件】而不是在两个入口各写一串文案:
//   · 两个入口(导演台 Action ▶ / 数字演员 Cast & generate)对用户必须是同一种体验 ——
//     分两份写, 下次改文案必然只改一半(今晚已经在失败文案上吃过这个亏);
//   · "现在到哪一步了 / 还要多久" 是这一整串改动要消灭"猜"的最后一块。
//     单行 status 会把上一步覆盖掉, 用户看不到【已经走完几步】。
//
// 视觉沿用平台既有语言, 不另造:
//   · 每一阶段一个 12 步谱系 hue(与 CSSPillBar 同一张表, 见 PillBar.swift:43)——
//     平台宪法说进度条「carry per-stage hue + breathing」, 那就照做;
//   · 当前阶段【呼吸】(缓慢明暗), 已完成打勾压暗, 未开始更暗。
//   · 不用 data-pill-bar 那套凸嵌凹: 宪法明确写了进度条【不是】胶囊切换器
//     (「Progress strips … their CONTAINER aligns, their children must diverge」)。

import SwiftUI

/// 一个阶段。eta/detail 允许为空(单曲时不必显示"×3 部")。
struct CSSGenStage: Identifiable, Equatable {
    let id: String
    var icon: String        // 直接用 emoji, 与 Jing 给的样子一致
    var title: String
    var eta: String = ""
    var detail: String = ""
}

/* 阶段表的【唯一真源】。两个创作入口共用同一份 —— 文案与节奏对用户必须一致,
 * 分两份写, 下次改必然只改一半。
 * partCount: 这一次要出几部(单曲 1, 三部曲 3)。 */
@MainActor
func cssGenStages(partCount n: Int, title: String) -> [CSSGenStage] {
    let multi = n > 1
    let name = title.isEmpty ? tr("your new work") : title
    return [
        CSSGenStage(
            id: "write", icon: "✨",
            title: tr("Casting locked — writing “{title}”…", ["title": name]),
            eta: "~90s",
            detail: multi ? tr("lyrics + cover × {n} parts", ["n": String(n)])
                          : tr("lyrics + cover")),
        CSSGenStage(
            id: "compose", icon: "🎼",
            title: multi ? tr("Composing — {n} parts…", ["n": String(n)])
                         : tr("Composing the music…"),
            eta: "~2-5min",
            detail: multi ? tr("music × {n} + visuals × {n} + subtitles × {n}", ["n": String(n)])
                          : tr("music + visuals + subtitles")),
        CSSGenStage(
            id: "play", icon: "▶",
            title: tr("Ready — opening “{title}”…", ["title": name]),
            eta: "",
            detail: multi ? tr("plays 1 → 2 → 3 back to back", ["n": String(n)]) : ""),
    ]
}

/// 阶段推进状态: 第 index 个正在进行; index < 0 表示还没开始; index >= stages.count 表示全部完成。
struct CSSGenProgress: View {
    let stages: [CSSGenStage]
    let current: Int
    /// 失败时传入: 当前这一阶段显示为失败, 后面的不再显示为"待办"。
    var failedMessage: String = ""

    private static let hues: [Double] = [155, 192, 235, 268, 310, 342, 22, 48, 82, 118, 168, 210]
    private func hue(_ i: Int) -> Double { Self.hues[i % Self.hues.count] }

    var body: some View {
        // TimelineView 驱动【呼吸】: 不用 withAnimation 的 repeatForever —— 那个在
        // tvOS 上一旦视图重建就会叠加多条动画, 越跑越快(平台在别处栽过)。
        TimelineView(.periodic(from: .now, by: 1.0 / 20.0)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(stages.enumerated()), id: \.element.id) { idx, st in
                    row(idx: idx, st: st, t: t)
                }
                if !failedMessage.isEmpty {
                    Text(failedMessage)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Color(hue: 10.0 / 360.0, saturation: 0.75, brightness: 0.95))
                        .padding(.top, 4)
                }
            }
        }
    }

    @ViewBuilder
    private func row(idx: Int, st: CSSGenStage, t: Double) -> some View {
        let done = idx < current
        let active = idx == current && failedMessage.isEmpty
        let failed = idx == current && !failedMessage.isEmpty
        let hh = hue(idx) / 360.0
        // 呼吸: 0.72 ~ 1.0 之间缓慢起伏, 只给【当前】这一行。
        let breath = active ? (0.86 + 0.14 * sin(t * 1.6)) : 1.0
        let tint = Color(hue: hh, saturation: failed ? 0.75 : 0.80, brightness: failed ? 0.80 : 0.92)

        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(done ? "✓" : (failed ? "✕" : st.icon))
                .font(.system(size: 30))
                .frame(width: 44, alignment: .leading)
                .opacity(done ? 0.55 : 1.0)

            VStack(alignment: .leading, spacing: 3) {
                Text(st.title)
                    .font(.system(size: 28, weight: active ? .bold : .semibold))
                    .foregroundStyle(done ? Color.white.opacity(0.45)
                                     : (active || failed ? tint : Color.white.opacity(0.28)))
                if !st.detail.isEmpty {
                    Text(st.detail)
                        .font(.system(size: 19))
                        .foregroundStyle(Color.white.opacity(done ? 0.28 : (active ? 0.62 : 0.22)))
                }
            }

            Spacer(minLength: 20)

            if !st.eta.isEmpty && !done {
                Text(st.eta)
                    .font(.system(size: 19, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.white.opacity(active ? 0.55 : 0.20))
            }
        }
        .opacity(breath)
        // 当前阶段给一圈本阶段 hue 的柔光 —— 与平台"进度条每段自己的颜色"一致。
        .shadow(color: active ? tint.opacity(0.45) : .clear, radius: 18)
    }
}
