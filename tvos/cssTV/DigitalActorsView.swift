// CSSOS_WAVE_1560 — 数字演员(Digital Actors)tvOS 原生屏。套用桌面端 /api/actors 目录:
//   顶部品牌行 + 来源/属性筛选胶囊(All/Original/Legends/Premium/Female/Male/Neutral/Mine) +
//   戏路胶囊(All roles/Hero/Villain/…) + 演员卡网格(封面/名/文明/人设/风格/价格/传奇徽章)。
//   tvOS 无 WebKit → 不能内嵌桌面网页, 这是同数据同观感的原生重制。

import SwiftUI

struct DigitalActorsView: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    @ObservedObject var auth: CSSAuth          // W1578 — 详情页「主演创作」需要传给导演台
    @Environment(\.dismiss) private var dismiss
    @State private var actors: [CSSActor] = []
    @State private var loading = true
    @State private var origin = ""          // "" / synthetic / civilization
    @State private var premium = false
    @State private var owned = false
    @State private var gender = ""          // 客户端过滤: "" / female / male / neutral
    @State private var role = ""            // archetype key
    @State private var search = ""          // 搜索: 名字/文明/人设
    @State private var detailActor: CSSActor? = nil   // W1578 — 点击卡片 → 进入该演员详情
    @FocusState private var searchFocused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    // 顶部来源/属性筛选(桌面端同款)。
    /* W2251 — 改成【计算属性】: tr() 是 @MainActor, 存储属性的初始化器在非隔离
     * 上下文里求值, 调不了它。计算属性在 View 的 body 里求值, 天然在主线程。*/
    private var originFilters: [(key: String, label: String, icon: String)] { [
        ("all",     tr("All"),      "sparkles"),
        ("original",tr("Original"), "wand.and.stars"),
        ("legends", tr("Legends"),  "building.columns.fill"),
        ("premium", tr("Premium"),  "diamond.fill"),
        ("female",  tr("Female"),   "person.fill"),
        ("male",    tr("Male"),     "person.fill"),
        ("neutral", tr("Neutral"),  "person.fill"),
        ("mine",    tr("Mine"),     "person.crop.rectangle.stack.fill"),
    ] }
    // 戏路(archetype)。
    /* W2251 — 改成【计算属性】: tr() 是 @MainActor, 存储属性的初始化器在非隔离
     * 上下文里求值, 调不了它。计算属性在 View 的 body 里求值, 天然在主线程。*/
    private var roles: [(key: String, label: String, icon: String)] { [
        ("",        tr("All roles"), "person.3.fill"),
        ("hero",    tr("Hero"),      "shield.lefthalf.filled"),
        ("villain", tr("Villain"),   "flame.fill"),
        ("antihero",tr("Anti-hero"), "theatermask.and.paintbrush.fill"),
        ("ruler",   tr("Ruler"),     "crown.fill"),
        ("action",  tr("Action"),    "figure.run"),
        ("sage",    tr("Sage"),      "book.fill"),
        ("charmer", tr("Charmer"),   "heart.fill"),
        ("tragic",  tr("Tragic"),    "cloud.rain.fill"),
        ("comic",   tr("Comic"),     "face.smiling.inverse"),
        ("enigma",  tr("Enigma"),    "questionmark.circle.fill"),
        ("youth",   tr("Youth"),     "leaf.fill"),
    ] }

    // 当前来源筛选高亮键。
    private var activeOriginKey: String {
        if owned { return "mine" }
        if premium { return "premium" }
        if !gender.isEmpty { return gender }
        if origin == "synthetic" { return "original" }
        if origin == "civilization" { return "legends" }
        return "all"
    }

    private var filtered: [CSSActor] {
        guard !gender.isEmpty else { return actors }
        return actors.filter { ($0.gender ?? "").lowercased() == gender }
    }

    private let cols = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 32)]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    header
                    originBar
                    roleBar
                    if loading {
                        ProgressView().scaleEffect(1.5).tint(brandGreen)
                            .frame(maxWidth: .infinity, minHeight: 400)
                    } else if filtered.isEmpty {
                        Text(tr("No actors match these filters"))
                            .font(.system(size: 26, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity, minHeight: 400)
                    } else {
                        LazyVGrid(columns: cols, spacing: 40) {
                            ForEach(filtered) { a in
                                ActorCard(actor: a, onTap: { detailActor = a })
                            }
                        }
                        .padding(.bottom, 60)
                    }
                }
                .padding(.horizontal, 60)
                .padding(.top, 40)
            }
        }
        .task { await reload() }
        .onExitCommand { dismiss() }
        // W1578 — 点击演员卡 → 进入详情(大肖像 + 名/文明/人设 + 价格)。
        .fullScreenCover(item: $detailActor) { a in ActorDetailView(actor: a, auth: auth) }
    }

    private var header: some View {
        HStack(spacing: 20) {
            Label(tr("Digital Actors"), systemImage: "theatermasks.fill")
                .font(.system(size: 46, weight: .heavy))
                .foregroundStyle(brandGreen)
            // 搜索(名字/文明/人设)。tvOS: 聚焦即弹听写/屏幕键盘。
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.5))
                TextField(tr("Search actors…"), text: $search)
                    .textFieldStyle(.plain).font(.system(size: 22))
                    .focused($searchFocused)
                    .onSubmit { Task { await reload() } }
            }
            .padding(.vertical, 12).padding(.horizontal, 20)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.08)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(brandGreen.opacity(searchFocused ? 0.9 : 0.25), lineWidth: 2))
            .frame(maxWidth: 520)
            Spacer()
            Button(tr("Close")) { dismiss() }
                .font(.system(size: 22, weight: .semibold))
                .buttonStyle(.bordered).tint(.white.opacity(0.6))
        }
    }

    // W1563 — 平台签名凸嵌凹胶囊。
    private var originBar: some View {
        CSSPillBar(items: originFilters.map { CSSPillItem(id: $0.key, label: $0.label, icon: $0.icon) },
                   selected: Binding(get: { activeOriginKey }, set: { applyOrigin($0) }))
    }

    private var roleBar: some View {
        CSSPillBar(items: roles.map { CSSPillItem(id: $0.key, label: $0.label, icon: $0.icon) },
                   selected: Binding(get: { role }, set: { role = $0; Task { await reload() } }))
    }

    private func applyOrigin(_ key: String) {
        // 互斥切换: 来源/付费/我建/性别是并列筛选面, 点谁高亮谁, 其余清零(桌面端行为)。
        origin = ""; premium = false; owned = false; gender = ""
        switch key {
        case "original": origin = "synthetic"
        case "legends":  origin = "civilization"
        case "premium":  premium = true
        case "mine":     owned = true
        case "female", "male", "neutral": gender = key
        default: break   // all
        }
        Task { await reload() }
    }

    private func reload() async {
        loading = true
        let list = await CSSBackend.fetchActors(origin: origin, premium: premium, owned: owned,
                                                archetype: role, search: search, limit: 200)
        await MainActor.run { actors = list; loading = false }
    }
}

// 单张演员卡 — 竖版肖像(桌面端同款): 封面 + 名 + 文明 + 人设 + 风格 + 价格/传奇徽章。
private struct ActorCard: View {
    let actor: CSSActor
    var onTap: () -> Void = {}                 // W1578 — 点击进入演员详情(之前是空动作 → 无法点击)
    @Environment(\.isFocused) private var focused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    private let w: CGFloat = 320
    private var coverH: CGFloat { w * 1.15 }

    var body: some View {
        Button { onTap() } label: {
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .topLeading) {
                    ZStack(alignment: actor.coverAlignment) {
                        if let c = actor.cover_image, let url = URL(string: c) {
                            AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                            placeholder: { Color.white.opacity(0.08) }
                        } else { Color.white.opacity(0.08) }
                    }
                    .frame(width: w, height: coverH)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                    // 左上: 传奇/原创徽章。右上: 价格。
                    HStack {
                        Image(systemName: actor.isLegend ? "building.columns.fill" : "sparkles")
                            .font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                            .padding(8).background(Circle().fill(.black.opacity(0.5)))
                        Spacer()
                        Text(actor.priceLabel)
                            .font(.system(size: 15, weight: .heavy)).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(brandGreen.opacity(0.9)))
                    }
                    .frame(width: w)
                    .padding(10)
                }
                .frame(width: w, height: coverH)
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(brandGreen, lineWidth: focused ? 5 : 0))
                .shadow(color: focused ? brandGreen.opacity(0.7) : .clear, radius: focused ? 20 : 0)

                Text(actor.displayName)
                    .font(.system(size: 23, weight: .bold))
                    .foregroundStyle(focused ? brandGreen : .white)
                    .lineLimit(1)
                if let civ = actor.civilization, !civ.isEmpty {
                    Text(civ).font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                }
                if let p = actor.persona ?? actor.style_descriptor, !p.isEmpty {
                    Text(p).font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.5)).lineLimit(2)
                        .frame(height: 42, alignment: .top)
                }
            }
            .frame(width: w)
        }
        .buttonStyle(.card)
    }
}

// W1578 — 演员详情(点击卡片进入): 大肖像 + 名 + 文明 + 完整人设 + 风格 + 价格。Menu/返回关闭。
private struct ActorDetailView: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    let actor: CSSActor
    @ObservedObject var auth: CSSAuth          // W1578 — 传给导演台(主演创作)
    @Environment(\.dismiss) private var dismiss
    @State private var creating = false        // W1578 — 打开导演台(该演员主演)
    @State private var asking = false          // W2220 —《问道》与该演员第一人称对话
    @State private var auditioning = false     // W2221 — 三段试戏(自我介绍/正派/反派)
    @State private var codexing = false        // W2253 — 典故(生平/参演/同文明演员)
    @State private var stage: CSSStageRig?     // W2254 — 这位演员的演播厅
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            HStack(alignment: .top, spacing: 60) {
                ZStack(alignment: actor.coverAlignment) {
                    if let c = actor.cover_image, let url = URL(string: c) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                        placeholder: { Color.white.opacity(0.08) }
                    } else { Color.white.opacity(0.08) }
                    /* W2254 — 会动的演员。全库 200 位只有 4 位有循环片, 没有就什么都不渲染,
                     * 原样露出下面的静态肖像 —— 绝不留黑框。 */
                    ActorLoopVideo(idleURL: actor.f2f_idle_url, talkURL: actor.f2f_talk_url)
                        .frame(width: 460, height: 620).clipped()
                }
                .frame(width: 460, height: 620)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(RoundedRectangle(cornerRadius: 24).stroke(brandGreen.opacity(0.4), lineWidth: 2))

                VStack(alignment: .leading, spacing: 22) {
                    Text(actor.displayName)
                        .font(.system(size: 52, weight: .heavy)).foregroundStyle(.white)
                    if let civ = actor.civilization, !civ.isEmpty {
                        Label(civ, systemImage: actor.isLegend ? "building.columns.fill" : "sparkles")
                            .font(.system(size: 24, weight: .semibold)).foregroundStyle(brandGreen)
                    }
                    Text(actor.priceLabel)
                        .font(.system(size: 22, weight: .heavy)).foregroundStyle(.black)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(Capsule().fill(brandGreen))
                    if let p = actor.persona, !p.isEmpty {
                        Text(p).font(.system(size: 24)).foregroundStyle(.white.opacity(0.85))
                            .lineSpacing(6).fixedSize(horizontal: false, vertical: true)
                    }
                    if let s = actor.style_descriptor, !s.isEmpty {
                        Text(s).font(.system(size: 20)).foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer()
                    HStack(spacing: 20) {
                        // W1578 — 照搬桌面端: 主动作 = 选该演员主演, 创作一支 MV。
                        Button { creating = true } label: {
                            Label(tr("Create an MV starring {name}", ["name": actor.displayName]), systemImage: "wand.and.stars")
                                .font(.system(size: 24, weight: .heavy))
                        }
                        .buttonStyle(.borderedProminent).tint(brandGreen)
                        // CSSOS_WAVE_2220 —《问道》: 与该演员第一人称对话(母语古/现代 · 逐字流式 · 朗读)。
                        //   桌面端它就紧贴在封面下方, 是演员专页的主体; 这里放在「主演创作」旁边,
                        //   因为 TV 的详情页只有这一排动作。
                        Button { asking = true } label: {
                            Label(tr("Ask {name}", ["name": actor.displayName]), systemImage: "bubble.left.and.text.bubble.right.fill")
                                .font(.system(size: 24, weight: .heavy))
                        }
                        .buttonStyle(.bordered).tint(brandGreen)
                        // CSSOS_WAVE_2221 — 三段试戏: 母语配音 + 逐字字幕 + 英文译文。
                        /* CSSOS_WAVE_2253 — 典故: 生平长文 + 参演作品 + 同文明演员。
                         * 桌面早有, TV 零引用; 而这屏原本只显示 文明/persona/曲风/价格 四个字段,
                         * 后端 codex 里那段完整生平一直没地方显示。 */
                        Button { codexing = true } label: {
                            Label(tr("Codex"), systemImage: "book.closed.fill")
                                .font(.system(size: 24, weight: .heavy))
                        }
                        .buttonStyle(.bordered).tint(brandGreen)
                        Button { auditioning = true } label: {
                            Label(tr("Audition"), systemImage: "theatermasks.fill")
                                .font(.system(size: 24, weight: .heavy))
                        }
                        .buttonStyle(.bordered).tint(brandGreen)
                        Button(tr("Close")) { dismiss() }
                            .font(.system(size: 24, weight: .semibold))
                            .buttonStyle(.bordered).tint(.white.opacity(0.6))
                    }
                }
                .frame(maxWidth: 760, alignment: .leading)
                Spacer()
            }
            .padding(80)
        }
        .onExitCommand { dismiss() }
        // W1578 — 照搬桌面端: 点「主演创作」→ 开【选角面板】(该演员=主角, 按其文明荐反派), 而非通用导演台。
        .fullScreenCover(isPresented: $creating) {
            ActorCastPanel(seed: actor, auth: auth)
        }
        // W2220 —《问道》屏。
        .fullScreenCover(isPresented: $asking) {
            ActorAskView(actor: actor)
        }
        // W2221 — 三段试戏屏。
        .fullScreenCover(isPresented: $auditioning) {
            ActorShowcaseView(actor: actor)
        }
        .fullScreenCover(isPresented: $codexing) { ActorCodexView(actor: actor) }
        /* W2254 — 背幕走 .background 不走 ZStack 兄弟: 作为兄弟时它的 .ignoresSafeArea()
         * 会把整个 ZStack 的安全区一起吃掉, 内容左移、右侧被屏幕裁(典故屏实测栽过)。 */
        .background(ActorStageBackdrop(rig: stage).ignoresSafeArea())
        .task { stage = await CSSBackend.fetchActorStage(actor.id) }
    }
}

// W1578 — 照搬桌面端 openCastPanel: 选中演员=主角槽(带图/名/文明), 按其文明智能联动荐反派(可换) → 定角并生成(带 cast 锁脸)。
private struct ActorCastPanel: View {
    /* W2251 — i18n 订阅点。@ObservedObject 只要【声明】就订阅了 objectWillChange,
     * 不要求 body 里读到它(那是 @Observable 宏的规矩, 不是 ObservableObject 的)。
     * 每个用 tr() 的 View 都要有这一行: 字典是异步到货的, 父 body 重算时子视图
     * 属性没变 → SwiftUI 跳过子 body → 那一屏永远停在英文(W2251 实测栽过)。
     * 【不用 private】: 私有存储属性会把 memberwise init 降级, 带参构造的视图会编不过。*/
    @ObservedObject var i18n = I18n.shared
    let seed: CSSActor
    @ObservedObject var auth: CSSAuth
    @Environment(\.dismiss) private var dismiss
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    @State private var format = "single"
    @State private var antagonist: CSSActor? = nil
    @State private var antagPool: [CSSActor] = []
    @State private var support: CSSActor? = nil
    @State private var supportPool: [CSSActor] = []
    @State private var loading = true
    @State private var generating = false
    @State private var status = ""

    private let fmts: [(id: String, name: String)] = [("single", tr("MV")), ("triptych", tr("Triptych")), ("opera", tr("Opera"))]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    HStack {
                        Label(tr("Casting"), systemImage: "theatermasks.fill")
                            .font(.system(size: 40, weight: .heavy)).foregroundStyle(brandGreen)
                        Spacer()
                        Button(tr("Close")) { dismiss() }
                            .font(.system(size: 22, weight: .semibold)).buttonStyle(.bordered).tint(.white.opacity(0.6))
                    }
                    CSSPillBar(items: fmts.map { CSSPillItem(id: $0.id, label: $0.name, icon: nil) },
                               selected: Binding(get: { format }, set: { format = $0; Task { await loadCast() } }))
                    slotView(title: tr("⭐ Lead"), actor: seed, locked: true, pool: [])
                    if loading {
                        ProgressView().tint(brandGreen).frame(maxWidth: .infinity, minHeight: 200)
                    } else {
                        slotView(title: tr("😈 Villain"), actor: antagonist, locked: false, pool: antagPool, onPick: { antagonist = $0 })
                        slotView(title: tr("🎭 Support"), actor: support, locked: false, pool: supportPool, onPick: { support = $0 })
                        // 群演: 系统自动生成(照桌面端默认 auto, 免费)。
                        HStack(spacing: 14) {
                            Text(tr("👥 Extras")).font(.system(size: 24, weight: .bold)).foregroundStyle(.white)
                            Text(tr("Auto-generated · free")).font(.system(size: 18)).foregroundStyle(brandGreen)
                            Spacer()
                        }.padding(20).background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.05)))
                    }
                    Button { generate() } label: {
                        Label(generating ? tr("Rolling…") : tr("Cast & generate  🎬"), systemImage: "film.stack")
                            .font(.system(size: 28, weight: .heavy)).frame(maxWidth: .infinity)
                    }.buttonStyle(.card).disabled(generating)
                    if !status.isEmpty { Text(status).font(.system(size: 20)).foregroundStyle(brandGreen) }
                }
                .padding(60)
            }
        }
        .task { await loadCast() }
        .onExitCommand { dismiss() }
    }

    @ViewBuilder private func slotView(title: String, actor: CSSActor?, locked: Bool, pool: [CSSActor], onPick: ((CSSActor) -> Void)? = nil) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
            HStack(spacing: 20) {
                actorThumb(actor, size: 120)
                VStack(alignment: .leading, spacing: 6) {
                    Text(actor?.displayName ?? tr("Recommending…")).font(.system(size: 26, weight: .heavy)).foregroundStyle(.white)
                    if let civ = actor?.civilization, !civ.isEmpty { Text(civ).font(.system(size: 18)).foregroundStyle(brandGreen) }
                    if locked { Text(tr("Your pick")).font(.system(size: 16)).foregroundStyle(.white.opacity(0.5)) }
                }
                Spacer()
            }
            if !pool.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 16) {
                        ForEach(pool) { c in
                            Button { onPick?(c) } label: {
                                VStack(spacing: 6) {
                                    actorThumb(c, size: 90)
                                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(brandGreen, lineWidth: antagonist?.actor_id == c.actor_id ? 4 : 0))
                                    Text(c.displayName).font(.system(size: 14)).lineLimit(1).frame(width: 90)
                                }
                            }.buttonStyle(.card)
                        }
                    }.padding(.vertical, 8)
                }
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.05)))
    }

    @ViewBuilder private func actorThumb(_ a: CSSActor?, size: CGFloat) -> some View {
        ZStack {
            if let c = a?.cover_image, let url = URL(string: c) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.08) }
            } else { Color.white.opacity(0.08) }
        }
        .frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func loadCast() async {
        loading = true
        // W1578 — 照桌面端明确要【反派(evil)】+【配角(neutral)】池, 不再随手拿通用池第一个当反派(庄子)。
        let needed = [["role": "antagonist", "alignment": "evil"], ["role": "supporting", "alignment": "neutral"]]
        let slots = await CSSBackend.castRecommend(format: format, civ: seed.civilization ?? "", needed: needed)
        await MainActor.run {
            let antag = slots.first(where: { $0.role.lowercased().contains("antag") })
            antagPool = (antag?.candidates ?? []).filter { $0.actor_id != seed.actor_id }
            if antagonist == nil || !antagPool.contains(where: { $0.actor_id == antagonist?.actor_id }) { antagonist = antagPool.first }
            let supp = slots.first(where: { $0.role.lowercased().contains("support") })
            supportPool = (supp?.candidates ?? []).filter { $0.actor_id != seed.actor_id && $0.actor_id != antagonist?.actor_id }
            if support == nil || !supportPool.contains(where: { $0.actor_id == support?.actor_id }) { support = supportPool.first }
            loading = false
        }
    }

    private func generate() {
        guard auth.isSignedIn else { status = tr("Please sign in first (top-left ✨) to create."); return }
        var cast: [[String: String]] = [["actor_id": seed.actor_id, "role": "protagonist"]]
        var costars: [String] = []
        var prompt = "Create an MV starring the digital actor \"\(seed.displayName)\"."
        if let ant = antagonist { cast.append(["actor_id": ant.actor_id, "role": "antagonist"]); costars.append("\(ant.displayName) (villain)") }
        if let sup = support { cast.append(["actor_id": sup.actor_id, "role": "supporting"]); costars.append("\(sup.displayName) (support)") }
        if !costars.isEmpty {
            prompt += " Co-starring " + costars.joined(separator: ", ") + ", plus auto-generated background extras. Weave every cast member into the story and lyrics, each true to their role."
        }
        switch format {
        case "triptych": prompt += " — make it a 3-part triptych"
        case "opera":    prompt += " — make it a multi-act opera"
        default: break
        }
        if let civ = seed.civilization, !civ.isEmpty { prompt += " Civilization: \(civ)." }
        generating = true; status = tr("✨ Casting locked — generating…")
        Task {
            let r = await CSSBackend.castMV(prompt: prompt, cast: cast)
            await MainActor.run {
                generating = false
                status = r.ok ? tr("✨ Generating — your work appears in For You when ready.") : tr("Couldn't start it just now. Please try again.")
            }
        }
    }
}
