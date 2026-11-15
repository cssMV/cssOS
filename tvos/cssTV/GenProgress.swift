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

/* CSSOS_WAVE_2322 — 六种戏路【共用】这一张阶段表。
 *
 * Jing:「现在单曲/三部曲都是同一个生成视图了, 歌剧/短剧/连续剧/电影是否也应该用同一个?」
 * 答案是【本来就该, 而且本来就是】—— 这张表只认"几部", 不认戏路。
 * 真正不对的是【按下按钮那一刻的部数猜测】: 原来写成 triptych?3:1,
 * 于是歌剧/短剧/连续剧/电影全被当成 1 部。
 *
 * 为什么不能像三部曲那样给个数: 平台宪法写明【幕数场数由 AI 推导, 不预设】
 * (Jing 本人放弃过"五幕歌剧之王"的 20 场上限)。所以这四种戏路在后端返回之前
 * 【真的不知道几部】。不知道就不要编 —— 编一个"1 部"再跳成"7 幕", 比不说更糟。
 *   partCount > 0 → 说出数(单曲 1 / 三部曲 3 / 拿到 work_cards 后的真实数)
 *   partCount <= 0 → 不说数, 只说"多幕/多集", 等真实数到了再重建一次
 *
 * 单位也各随各的戏路(宪法原话: 三部曲 / 歌剧(幕·场) / 短剧(集)):
 *   triptych 部 · opera 幕·场 · shortplay/series 集 · film 场 */
@MainActor
func cssGenUnitLabel(_ workType: String, count n: Int) -> String {
    switch workType {
    case "opera":     return n > 0 ? tr("{n} acts", ["n": String(n)]) : tr("multiple acts")
    case "shortplay", "series":
                      return n > 0 ? tr("{n} episodes", ["n": String(n)]) : tr("multiple episodes")
    case "film":      return n > 0 ? tr("{n} scenes", ["n": String(n)]) : tr("multiple scenes")
    default:          return n > 0 ? tr("{n} parts", ["n": String(n)]) : tr("multiple parts")
    }
}

/// 按下按钮时【能确定】的部数。确定不了返回 0 —— 由后端定, 不猜。
func cssGenExpectedParts(_ workType: String) -> Int {
    switch workType {
    case "single":   return 1
    case "triptych": return 3            // 三部曲按定义就是 3 部
    default:         return 0            // 歌剧/短剧/连续剧/电影: 幕数场数由 AI 推导
    }
}

/* 阶段表的【唯一真源】。两个创作入口、六种戏路共用同一份 ——
 * 文案与节奏对用户必须一致, 分两份写, 下次改必然只改一半。 */
@MainActor
func cssGenStages(workType: String, partCount n: Int, title: String) -> [CSSGenStage] {
    let single = (n == 1)                       // 只有【确知是 1 部】才算单曲排版
    let unit = cssGenUnitLabel(workType, count: n)
    let name = title.isEmpty ? tr("your new work") : title
    return [
        CSSGenStage(
            id: "write", icon: "✨",
            title: tr("Casting locked — writing “{title}”…", ["title": name]),
            eta: "~90s",
            detail: single ? tr("lyrics + cover")
                           : tr("lyrics + cover × {unit}", ["unit": unit])),
        CSSGenStage(
            id: "compose", icon: "🎼",
            title: single ? tr("Composing the music…")
                          : tr("Composing — {unit}…", ["unit": unit]),
            eta: "~2-5min",
            detail: single ? tr("music + visuals + subtitles")
                           : tr("music + visuals + subtitles, for every one of {unit}", ["unit": unit])),
        CSSGenStage(
            id: "play", icon: "▶",
            title: tr("Ready — opening “{title}”…", ["title": name]),
            eta: "",
            // 播放顺序是铁律(1→2→3 连播, 中途不插别的), 多部时说出来让用户知道会连播。
            detail: single ? "" : tr("plays in order, back to back")),
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
