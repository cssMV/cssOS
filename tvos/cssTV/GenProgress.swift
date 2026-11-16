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
    /* CSSOS_WAVE_2324 — 子行: 歌剧「每一幕之下的场数」(Jing 明确要求)。
     * CSSOS_WAVE_2325 起后端真带两层回来了 → 这里是「第一幕 · 4 场」这样的缩进列表。
     * 扁平戏路(三部曲/短剧/连续剧按集)仍是空数组 → 一行不画, 版面不变。 */
    var subLines: [String] = []
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
/* CSSOS_WAVE_2323 — 歌剧是【幕底下还有场】, 不能只说幕数(Jing 指出)。
 *
 * 实测库里的歌剧 structure_role 就是三层: root → act(幕) → scene(场)。
 * 所以歌剧要同时说【几幕·几场】; 其余戏路是扁平的, 一个数就够。
 * acts = 0 表示还不知道(后端未返回), 按宪法「幕数场数由 AI 推导」不编数。 */
@MainActor
func cssGenUnitLabel(_ workType: String, count n: Int, acts: Int = 0, scenes: Int = 0) -> String {
    switch workType {
    case "opera":
        /* 幕与场是【两个独立的数】, 不能拿同一个数充当两者。
         * 若把 n 既当幕又当场, 屏幕上会出现"3 幕 · 3 场"这种凭空编出来的场数
         * —— 那正是本文件反复要避免的事(W2324 写这段时我自己差点栽进去)。
         * 所以: 有真实的场(scenes>0)才说场, 否则只说幕。
         * W2325 后端带两层回来时这两个数各有来源; 老响应/扁平歌剧仍只说幕。 */
        if acts > 0 && scenes > 0 { return tr("{a} acts · {n} scenes", ["a": String(acts), "n": String(scenes)]) }
        if acts > 0 { return tr("{a} acts", ["a": String(acts)]) }
        return tr("multiple acts and scenes")
    case "shortplay", "series":
        return n > 0 ? tr("{n} episodes", ["n": String(n)]) : tr("multiple episodes")
    case "film":
        return n > 0 ? tr("{n} scenes", ["n": String(n)]) : tr("multiple scenes")
    default:
        return n > 0 ? tr("{n} parts", ["n": String(n)]) : tr("multiple parts")
    }
}

/* CSSOS_WAVE_2324 — 歌剧的「幕 → 每幕几场」明细。
 *
 * Jing:「歌剧名称-幕数-场数, 既要返回幕数, 还要在每一幕之下返回场数。」
 *
 * CSSOS_WAVE_2325 — 这份数据【现在真的有了】。
 * W2324 当时的注释说"后端产出的是扁平结构、所以这里返回空数组"——【那句是错的】:
 * create_work 从 W175 起就真建了 root → act → scene 三层行(我上一轮只读了扁平那一支,
 * 漏看了上面 250 行的树型那一支)。真正缺的是【把树带出响应】:
 * 线上走的 multipart_cinema 那条路只回一个拉平的 parts_plan, 幕的归属在路上丢了。
 * W2325 给每个场补了 parent_id、另给一份 acts_plan, 这个函数才有东西可分组。
 *
 * 分组靠 parent_work_id(场 → 幕); 场数优先用【幕自己报的数】——
 * 一幕的场若一张都没进响应, 数卡片会得到 0, 而库里其实有。 */
@MainActor
func cssGenActBreakdown(_ cards: [CSSBackend.CastWorkCard]) -> [String] {
    let acts = cards.filter { $0.structureRole == "act" }.sorted { $0.sequenceIndex < $1.sequenceIndex }
    guard !acts.isEmpty else { return [] }
    return acts.map { act in
        let counted = cards.filter { $0.structureRole == "scene" && $0.parentWorkId == act.workId }.count
        let n = act.declaredSceneCount > 0 ? act.declaredSceneCount : counted
        let name = act.title.isEmpty ? tr("Act {i}", ["i": String(act.sequenceIndex)]) : act.title
        return n > 0 ? tr("{act} · {n} scenes", ["act": name, "n": String(n)])
                     : tr("{act} · scenes pending…", ["act": name])
    }
}

/* CSSOS_WAVE_2328 — 六种戏路的【提示词短语】: 两个创作入口共用这一份。
 *
 * 为什么必须共用: 选角面板原来只写了 triptych / opera 两个 case, 短剧/连续剧/电影
 * 三个胶囊【点了等于没点】—— 提示里一个字都不加, 后端当单曲处理。
 * (那是 W2323 我自己留下的半成品: 把六个胶囊加上了, 没把它们的提示接上。)
 * 一份文案、两个入口各写一遍, 就一定会这样漏掉一半。
 *
 * 为什么要把【数字说死】: 今晚实测, 「多幕歌剧」这种不带数字的说法会让规划器给出
 * 21 场 —— 直接被生成权闸拒绝(need 21 / have 9), 一部都建不出来, 当然也就无从播放。
 * 所以这里给每种戏路一个【保守的默认结构】, 叶子数都压在 6 以内:
 * 既付得起、出得快, 也就真的能"生成就播放"。
 * 这只是【默认】—— 导演台里用户自己写明"5 幕 4 场"时, 用户的话优先
 * (导演自动流铁律: 不选不填→系统推荐; 用户干预→系统让位)。
 *
 * 这几句是发给后端 LLM 的【指令】, 不是界面文案 —— 所以不走 tr()/data-i18n,
 * 平台的源语言本来就是英文。 */
func cssGenFormatPhrase(_ workType: String) -> String {
    switch workType {
    case "triptych":  return " — make it a triptych with exactly 3 parts"
    case "opera":     return " — make it an opera with exactly 3 acts and exactly 2 scenes in each act"
    case "shortplay": return " — make it a short drama with exactly 6 episodes"
    case "series":    return " — make it an episodic series with exactly 1 season of exactly 3 episodes"
    case "film":      return " — make it a feature film with exactly 3 chapters and exactly 2 scenes in each chapter"
    default:          return ""
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
func cssGenStages(workType: String, partCount n: Int, title: String,
                  actCount: Int = 0, sceneCount: Int = 0, actBreakdown: [String] = []) -> [CSSGenStage] {
    let single = (n == 1)                       // 只有【确知是 1 部】才算单曲排版
    let unit = cssGenUnitLabel(workType, count: n, acts: actCount, scenes: sceneCount)
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
                           : tr("music + visuals + subtitles, for every one of {unit}", ["unit": unit]),
            subLines: actBreakdown),
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
                // W2324 — 歌剧的幕·场明细(后端还没给出两层时为空, 一行不画)。
                ForEach(Array(st.subLines.enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(.system(size: 17))
                        .foregroundStyle(Color.white.opacity(done ? 0.22 : (active ? 0.46 : 0.18)))
                        .padding(.leading, 10)
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
