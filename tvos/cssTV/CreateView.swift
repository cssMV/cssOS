// W1259 / W1556 / W1560 — cssTV 导演入口「🎬 Direct a work」。套用桌面端结构:
//   戏路(format) + 文明(civilization, 文明智能联动) + 标题 + ✨起草梗概 + 故事梗概 + 风格 + 系统荐角(可换角) → Action ▶。
// 宪法「导演自动流」: 不选不填 → 系统算法推荐; 用户干预 → 系统让位。所以全空也能开拍。
// tvOS 无 WebKit → 原生重制桌面观感, 同后端 API(/api/director/synopsis · /api/cast/recommend · /api/agent/chat)。

import SwiftUI

struct CreateView: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    var seedPrompt: String = ""
    @ObservedObject var auth: CSSAuth
    var defaultFormat: String = ""            // W1565 — 从某栏尾卡进入时【默认预选】的戏路(""=不预选); 仍可自由改
    var starringActorName: String = ""        // W1578 — 从数字演员进入: 该演员主演(照搬桌面端)
    var starringActorId: String = ""          // W1578 — 主角槽锁定该演员 id(修"不管点谁都是爱因斯坦")
    var onIFilm: (String) -> Void = { _ in }
    /* W2315 — 创作+作曲完成后把作品交给 ContentView 开播放器(播放器的身份/队列规矩归它管)。 */
    var onPlayWork: (String) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss

    @State private var format = "single"
    @State private var civ = ""                 // "" = System(系统自拟世界)
    @State private var title = ""
    @State private var synopsis = ""
    @State private var style = ""
    @State private var status = ""
    /* W2321 — 生成进度条(两个创作入口共用同一组阶段, 见 cssGenStages)。
     * genStage: -1 未开始 / 0 创作中 / 1 作曲中 / 2 就绪开播。 */
    @State private var genStages: [CSSGenStage] = []
    @State private var genStage = -1
    @State private var casting = false
    @State private var drafting = false
    @State private var castSlots: [CSSBackend.CastSlot] = []
    @State private var chosen: [String: String] = [:]   // role → actor_id
    @FocusState private var focusedField: Field?
    private enum Field { case title, synopsis, style }

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    // W1561 — 全戏路开放(原 shortplay/series/film 的"敬请期待"锁移除): 每栏都能创作该类型。
    /* W2251 — 同上: tr() 是 @MainActor, 必须是计算属性。*/
    private var fmts: [(id: String, name: String, icon: String)] { [
        ("single", tr("MV"), "music.note"), ("triptych", tr("Triptych"), "books.vertical.fill"),
        ("opera", tr("Opera"), "theatermasks.fill"), ("shortplay", tr("Short Drama"), "film.fill"),
        ("series", tr("Series"), "tv.fill"), ("film", tr("Movie"), "film.stack.fill"),
    ] }
    // 文明胶囊(文明智能联动)。System = 系统自拟世界(空串)。
    /* W2251 — 同上: tr() 是 @MainActor, 必须是计算属性。*/
    private var civs: [(id: String, name: String, icon: String)] { [
        ("", tr("System"), "globe"), ("Chinese", tr("Chinese"), "globe.asia.australia.fill"),
        ("Japanese", tr("Japanese"), "globe.asia.australia.fill"), ("Greek", tr("Greek"), "building.columns.fill"),
        ("Egyptian", tr("Egyptian"), "triangle.fill"), ("Indian", tr("Indian"), "globe.asia.australia.fill"),
        ("Roman", tr("Roman"), "building.columns.fill"), ("Norse", tr("Norse"), "snowflake"),
        ("Persian", tr("Persian"), "flame.fill"), ("Renaissance Europe", tr("Renaissance"), "paintpalette.fill"),
    ] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            EmojiBurstEffect(active: true, seed: 7, bigEmojiSize: 240, bigPeriod: 0, smallSize: 30,
                             smallSpread: 500, smallN: 22).opacity(0.5).allowsHitTesting(false)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(tr("🎬 Direct a work")).font(.system(size: 52, weight: .heavy)).foregroundStyle(.white)
                        Text(tr("Pick a format — the system casts the actors and writes the rest. Change anything, or just let it roll."))
                            .font(.system(size: 22)).foregroundStyle(.white.opacity(0.75))
                    }

                    pillGroup(tr("🎬 Format")) { formatBar }
                    pillGroup(tr("🌍 Civilization (blank = system)")) { civBar }

                    // 标题 + ✨起草。
                    HStack(spacing: 14) {
                        field(tr("Title — blank = system names it"), text: $title, field: .title)
                        Button { draft() } label: {
                            Label(drafting ? tr("Drafting…") : tr("Draft"), systemImage: "sparkles")
                                .font(.system(size: 22, weight: .bold)).padding(.vertical, 16).padding(.horizontal, 26)
                        }.buttonStyle(.card).disabled(drafting)
                    }
                    // 故事梗概。
                    field(tr("Story synopsis (≤2000 chars) — blank = system writes it"), text: $synopsis, field: .synopsis, minHeight: 150)
                    // 风格。
                    field(tr("Style / vibe — blank = auto"), text: $style, field: .style)

                    // 系统荐角(可换角)。
                    if !castSlots.isEmpty {
                        castSection
                    }

                    // Action ▶
                    HStack {
                        Button { cast() } label: {
                            Label(casting ? tr("Rolling…") : tr("Action  ▶"), systemImage: "film.stack")
                                .font(.system(size: 28, weight: .bold)).padding(.vertical, 16).padding(.horizontal, 44)
                        }.buttonStyle(.card).disabled(casting)
                        Spacer()
                        Button(tr("Close")) { dismiss() }
                            .font(.system(size: 20)).buttonStyle(.plain).foregroundStyle(.white.opacity(0.6))
                    }
                    /* W2321 — 生成中显示【分阶段进度】, 不再是一行会被覆盖掉的 status。
                     * 单行 status 的毛病是看不到"已经走完几步" —— 用户还是得猜。 */
                    if genStage >= 0 && !genStages.isEmpty {
                        CSSGenProgress(stages: genStages, current: genStage, failedMessage: status)
                            .padding(.top, 6)
                    } else if !status.isEmpty {
                        Text(status).font(.system(size: 21, weight: .medium)).foregroundStyle(brandGreen)
                    }
                }
                .padding(50)
                .frame(maxWidth: 1500, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear {
            if title.isEmpty { title = seedPrompt }
            if !defaultFormat.isEmpty { format = defaultFormat }   // W1565 — 默认预选该栏戏路(可改)
            // W1578 — 从数字演员进入: 种下"该演员主演"梗概(照搬桌面端 prompt)。
            if !starringActorName.isEmpty && synopsis.isEmpty {
                synopsis = "Create an MV starring the digital actor \"\(starringActorName)\"."
            }
            Task { await refreshCast() }
        }
        .onChange(of: format) { _, _ in Task { await refreshCast() } }
        .onChange(of: civ) { _, _ in Task { await refreshCast() } }
        .onExitCommand { dismiss() }   // W1564 — Menu 键退回上一级(关导演台), 而非退出平台
    }

    // MARK: - Sections

    @ViewBuilder private func pillGroup<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label).font(.system(size: 20, weight: .bold)).foregroundStyle(brandGreen)
            content()
        }
    }

    // W1563 — 平台签名凸嵌凹胶囊(套用桌面 data-pill-bar)。全戏路可选; 进入时只是【默认预选】某戏路, 可改。
    private var formatBar: some View {
        CSSPillBar(items: fmts.map { CSSPillItem(id: $0.id, label: $0.name, icon: $0.icon) },
                   selected: $format)
    }

    private var civBar: some View {
        CSSPillBar(items: civs.map { CSSPillItem(id: $0.id, label: $0.name, icon: $0.icon) },
                   selected: $civ)
    }

    private var castSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(tr("🎭 Cast (system-recommended, swap freely)"))
                .font(.system(size: 20, weight: .bold)).foregroundStyle(brandGreen)
            ForEach(castSlots) { slot in
                let picked = chosen[slot.role]
                VStack(alignment: .leading, spacing: 10) {
                    Text(roleLabel(slot)).font(.system(size: 22, weight: .heavy)).foregroundStyle(.white)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(slot.candidates) { a in
                                Button { chosen[slot.role] = a.actor_id } label: {
                                    VStack(spacing: 6) {
                                        actorThumb(a)
                                            .overlay(RoundedRectangle(cornerRadius: 12)
                                                .stroke(brandGreen, lineWidth: picked == a.actor_id ? 5 : 0))
                                        Text(a.displayName).font(.system(size: 15, weight: .semibold))
                                            .foregroundStyle(picked == a.actor_id ? brandGreen : .white.opacity(0.85))
                                            .lineLimit(1).frame(width: 120)
                                    }
                                }.buttonStyle(.card)
                            }
                        }.padding(.vertical, 6)
                    }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.12), lineWidth: 1))
            }
        }
    }

    private func actorThumb(_ a: CSSActor) -> some View {
        ZStack(alignment: a.coverAlignment) {
            if let c = a.cover_image, let url = URL(string: c) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { Color.white.opacity(0.08) }
            } else { Color.white.opacity(0.08) }
        }
        .frame(width: 120, height: 138)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func field(_ prompt: String, text: Binding<String>, field: Field, minHeight: CGFloat = 0) -> some View {
        TextField(prompt, text: text, axis: minHeight > 0 ? .vertical : .horizontal)
            .textFieldStyle(.plain)
            .font(.system(size: 26, weight: .semibold))
            .lineLimit(minHeight > 0 ? 3...6 : 1...1)
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(brandGreen.opacity(focusedField == field ? 0.9 : 0.28), lineWidth: 2))
            .focused($focusedField, equals: field)
    }

    // MARK: - Logic

    private func roleLabel(_ slot: CSSBackend.CastSlot) -> String {
        let emoji = slot.alignment == "evil" ? "😈" : (slot.role.lowercased().contains("lead") || slot.role.lowercased().contains("protagonist") ? "⭐️" : "🎬")
        return "\(emoji) \(slot.role.capitalized)"
    }

    private func refreshCast() async {
        let slots = await CSSBackend.castRecommend(format: format, civ: civ)
        await MainActor.run {
            castSlots = slots
            // W1578 — 从数字演员进入: 主角槽【锁定】该演员, 不被系统荐角(首个候选=爱因斯坦)覆盖。
            if !starringActorId.isEmpty, let lead = slots.first { chosen[lead.role] = starringActorId }
            // 其余槽默认选首个候选(系统荐角); 保留用户已换的 + 已锁的主角。
            for s in slots where chosen[s.role] == nil { chosen[s.role] = s.candidates.first?.actor_id }
        }
    }

    private func draft() {
        guard auth.isSignedIn else { status = tr("Sign in (top-left ✨) to let the system draft."); return }
        drafting = true; status = ""
        Task {
            let d = await CSSBackend.directorDraft(title: title, civ: civ)
            await MainActor.run {
                drafting = false
                if let d = d, let syn = d.synopsis, !syn.isEmpty {
                    if let t = d.title, !t.isEmpty { title = t }
                    synopsis = syn
                    status = tr("✨ Draft ready — edit it, or hit Action.")
                } else { status = tr("Couldn't draft just now. Try again, or write your own.") }
            }
        }
    }

    /* W2315 — 作曲再开播。与 DigitalActorsView 那一份是同一套措辞和同一套失败分级,
     * 两个创作入口对用户必须是同一种体验。 */
    private func composeThenPlay(_ r: CSSBackend.CastResult) {
        let cards = r.workCards
        guard let card = cards.first else { return }
        /* W2325 — 作品名优先用【根标题】。树型时 cards.first 是第一幕,
         * 拿它当作品名会写成「正在为《第一幕 · 吴宫春晓》作曲」—— 那是幕名不是作品名。 */
        let name = !r.rootTitle.isEmpty ? r.rootTitle
                 : (card.title.isEmpty ? tr("your new work") : card.title)
        /* W2321 — 阶段②。这时才知道【真实部数】(后端返回几张卡就是几部),
         * 用它重建阶段表 —— 之前按戏路猜的那次可能不准。 */
        status = ""
        /* W2323 — 歌剧要说【几幕·几场】: 场是叶子(作曲的对象), 幕是容器。
         * 其余戏路 acts 传 0, 文案自动退回单一个数。 */
        let actCount = cards.filter { $0.structureRole == "act" }.count
        let leafCount = cards.filter { !$0.isContainer }.count
        /* W2324 — 歌剧:【幕数】用真实的幕, 没有两层时退回"顶层有几部"(歌剧的顶层部就是幕)。
         * 场数与每幕明细由后端决定(W2325 起真带两层)。 */
        let operaActs = actCount > 0 ? actCount : (format == "opera" ? cards.count : 0)
        genStages = cssGenStages(workType: format,
                                 partCount: leafCount > 0 ? leafCount : cards.count,
                                 title: name,
                                 actCount: operaActs,
                                 // 场数只认【真实的 scene 卡片】; 没有就是 0, 文案自动只说幕。
                                 sceneCount: cards.filter { $0.structureRole == "scene" }.count,
                                 actBreakdown: cssGenActBreakdown(cards))
        genStage = 1
        Task {
            /* W2316 — 第一棒失败不等于结束: 服务端很可能还在作曲, 盯到音频出现为止。
             * 就地放弃 = 用户又回到猜, 那正是 Jing 要消灭的状态。 */
            /* W2323 — 只等【叶子】: 歌剧的"幕"是容器, 永远不会有音频, 等它必然超时。
             * 万一一张叶子都没有(形状意外), 退回全部 —— 宁可多等也不要一个都不等。 */
            let leaves = cards.filter { !$0.isContainer }
            let waitIds = (leaves.isEmpty ? cards : leaves).map { $0.workId }
            /* W2325 — 后端引擎已在作曲时【不再下单】, 只盯音频出现。再调一次就是重复计费。 */
            let outcome = await CSSBackend.composeAndWait(workIds: waitIds,
                                                          kickFirst: !r.backendDriven) {
                status = tr("🎼 Still composing “{title}” — it will start playing by itself.", ["title": name])
            }
            await MainActor.run {
                switch outcome {
                /* W2321 — 失败【停在当前阶段】并把原因写进 status; 进度条会把这一行画成 ✕,
                 * 前面已完成的阶段仍然打勾 —— 用户一眼看到"走到哪一步断的"。 */
                case .needsTopUp:
                    status = tr("The work was created, but the wallet is short for the music step. Top up and play it from For You.")
                    return
                case .gaveUp:
                    status = tr("Created ✅ — but the music step didn’t finish. You can find it in For You.")
                    return
                case .ready:
                    break
                }
                // W2321 — 阶段③: 就绪开播。
                status = ""
                genStage = 2
                /* W2320 — 多部作品要打开【根】, 不是第一部。
                 * 根是容器(没有自己的音频), 播放器拿到它才会按 children 1→2→3 连播;
                 * 打开第一部的话, 用户只会听到三部曲的三分之一。 */
                dismiss()
                onPlayWork(card.playTargetId)
            }
        }
    }

    private func cast() {
        guard auth.isSignedIn else { status = tr("Please sign in first (the ✨ badge, top-left) to create."); return }
        // 结构化字段 → 意念串。全空则交系统全自动(导演自动流)。
        var parts: [String] = []
        if !title.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(title) }
        if !synopsis.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(synopsis) }
        if !style.trimmingCharacters(in: .whitespaces).isEmpty { parts.append("Style: \(style)") }
        let castNames = castSlots.compactMap { s in s.candidates.first(where: { $0.actor_id == chosen[s.role] })?.displayName }
        if !castNames.isEmpty { parts.append("Starring \(castNames.joined(separator: ", ")).") }
        var idea = parts.joined(separator: ". ")
        if idea.isEmpty { idea = "Surprise me — direct an original, shootable work from scratch." }
        /* W2328 — 与选角面板共用同一份短语, 并且把【结构数字说死】。
         * 「多幕歌剧」这种不带数字的说法实测会让规划器给出 21 场 → 被闸拒 → 一部都建不出来。 */
        let fmtPhrase = cssGenFormatPhrase(format)
        let civPhrase = civ.isEmpty ? "" : " Civilization: \(civ)."
        let full = idea + fmtPhrase + civPhrase

        // W1578 — 把选定 cast(role→actor_id) 发给后端 → create_work 封面锁脸(演员本人形象)。
        let castPayload: [[String: String]] = castSlots.compactMap { slot in
            guard let aid = chosen[slot.role], !aid.isEmpty else { return nil }
            return ["actor_id": aid, "role": slot.role]
        }
        casting = true; status = ""
        /* W2321 — 阶段①。部数这时还不知道(后端定), 先按戏路猜: 三部曲 3, 其余 1;
         * 拿到 work_cards 后会用【真实部数】重建一次, 以真实为准。 */
        genStages = cssGenStages(workType: format, partCount: cssGenExpectedParts(format), title: title)
        genStage = 0
        Task {
            let result = await CSSBackend.castMV(prompt: full, cast: castPayload)
            await MainActor.run {
                casting = false
                if result.intent == "ifilm", let fid = result.ifilmId, !fid.isEmpty { dismiss(); onIFilm(fid); return }
                if result.ok {
                    /* W2315 — 「生成成功就播放」: 创作 → 作曲 → 开播。
                     * 拿不到 work_cards 就【不要谎称成功】—— 助理只回文字没真创作时,
                     * 原来那句「正在生成, 稍后出现在 For You」是假阳性(实测库里一行没有)。 */
                    guard !result.workCards.isEmpty else {
                        status = tr("The assistant replied but didn’t create anything this time. Try rephrasing, or check For You.")
                        return
                    }
                    composeThenPlay(result)
                    return
                }
                /* W2310 — 说出【为什么】, 不要只说「请重试」。
                 * Jing 看到的「请重试」把一个可定位的故障(客户端 60s 超时)说成了
                 * 「系统无法生成」。无信息的失败文案本身就是缺陷。 */
                switch result.failure {
                case .timedOut:
                    status = tr("The magic mirror is taking longer than usual — it may still be working. Check For You in a few minutes.")
                case .unauthorized:
                    status = tr("Your session expired. Sign in again with the ✨ badge, top-left.")
                /* 占位符必须是 {code} / {msg}, 不能字符串插值 —— 插出来的整句不是固定 key,
                 * 翻译缓存永远对不上(I18n.swift:317 写明了这条)。 */
                case .serverRefused(let code):
                    status = tr("The server turned it down (code {code}). Nothing was charged.",
                                ["code": String(code)])
                case .transport(let msg):
                    status = tr("Couldn't reach the server: {msg}", ["msg": msg])
                case .none:
                    status = tr("Couldn't start it just now. Please try again.")
                }
            }
        }
    }
}
