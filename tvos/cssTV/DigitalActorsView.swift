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
    /* W2315 — 创作+作曲完成后把作品交给 ContentView 去开播放器。
     * 不在这里自己 present 播放器: 播放器的身份/队列规矩(PlayRef 每次新身份、
     * 先 fetchWorkById 再开 —— W2233)都归 ContentView 管, 在子视图里再写一份必然走样。 */
    var onPlayWork: (String) -> Void = { _ in }
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
        .fullScreenCover(item: $detailActor) { a in ActorDetailView(actor: a, auth: auth, onPlayWork: onPlayWork) }
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
    var onPlayWork: (String) -> Void = { _ in }   // W2315 — 往下传给选角面板
    @Environment(\.dismiss) private var dismiss
    @State private var creating = false        // W1578 — 打开导演台(该演员主演)
    @State private var asking = false          // W2220 —《问道》与该演员第一人称对话
    @State private var auditioning = false     // W2221 — 三段试戏(自我介绍/正派/反派)
    @State private var codexing = false        // W2253 — 典故(生平/参演/同文明演员)
    @State private var stage: CSSStageRig?     // W2254 — 这位演员的演播厅
    @State private var sharing = false         // W2257 — 分享(二维码)
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
                        /* W2257 — 分享: 出二维码让手机扫走。电视上没有剪贴板可用的去处,
                         * 也没法发消息 —— 扫码是唯一能把链接带离客厅的办法。 */
                        Button { sharing = true } label: {
                            Label(tr("Share"), systemImage: "qrcode")
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
            ActorCastPanel(seed: actor, auth: auth, onPlayWork: onPlayWork)
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
        .fullScreenCover(isPresented: $sharing) { ActorShareView(actor: actor) }
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
    /* W2315 — 创作+作曲完成后把作品一路交回 ContentView 去开播放器。
     * 这条回调要从 DigitalActorsView → ActorDetailView → 这里一路传,
     * 因为「播放器怎么开」的规矩(PlayRef 每次新身份 / 先 fetchWorkById 再开, W2233)
     * 只有 ContentView 知道 —— 在子视图里再写一份必然走样。 */
    var onPlayWork: (String) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    @State private var format = "single"
    @State private var antagonist: CSSActor? = nil
    @State private var antagPool: [CSSActor] = []
    @State private var support: CSSActor? = nil
    @State private var supportPool: [CSSActor] = []
    @State private var loading = true
    @State private var generating = false
    /* W2321 — 生成进度条(与导演台共用同一组阶段, 见 cssGenStages)。 */
    @State private var genStages: [CSSGenStage] = []
    @State private var genStage = -1
    @State private var status = ""

    /* W2323 — 补齐六种戏路, 与导演台对齐(W1561「全戏路开放」)。
     * 原来这里只有 MV/三部曲/歌剧, 从数字演员进去就点不了短剧/连续剧/电影 ——
     * 同一个平台的两个创作入口给出不同的能力, 本身就是缺陷。
     * 【计算属性】: tr() 是 @MainActor, 存储属性的初始化器在非隔离上下文里调不了它(W2251)。 */
    private var fmts: [(id: String, name: String)] { [
        ("single", tr("MV")), ("triptych", tr("Triptych")), ("opera", tr("Opera")),
        ("shortplay", tr("Short Drama")), ("series", tr("Series")), ("film", tr("Movie")),
    ] }

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
                    // W2321 — 同导演台: 生成中显示分阶段进度, status 退为失败/补充说明。
                    if genStage >= 0 && !genStages.isEmpty {
                        CSSGenProgress(stages: genStages, current: genStage, failedMessage: status)
                    } else if !status.isEmpty {
                        Text(status).font(.system(size: 20)).foregroundStyle(brandGreen)
                    }
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

    /* CSSOS_WAVE_2315 — Jing:「能不能改进一下?生成成功就播放?」
     *
     * 创作完【不是终点】: create_work 只出歌词+封面, 音乐要再走一步(网页端是作品卡上的
     * 「生成音乐」按钮, 电视上没有)。所以这里把三步串起来:
     *     ① 创作(agent → create_work) → ② 作曲(generate-audio) → ③ 开播
     * 任何一步失败都【说清楚卡在哪一步】, 不再回那句没信息的「请重试」(W2310 的同一条教训)。 */
    private func playCreatedWork(_ r: CSSBackend.CastResult) {
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
                /* W2233 的教训: 【先把作品取全再开播放器】。塞一个裸 id 进去的话,
                 * 播放器里显示 Untitled 且播不了, 必须退一步重播才好 —— 那条路已经栽过一次。
                 * 取不到就仍然按裸 id 开(不比以前差), 由 PlayerView 自己 hydrate。 */
                onPlayWork(card.playTargetId)
            }
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
        /* W2328 — 六种戏路共用同一份短语(cssGenFormatPhrase)。
         * 这里原来只写了 triptych / opera 两个 case —— 短剧/连续剧/电影三个胶囊点了等于没点。 */
        prompt += cssGenFormatPhrase(format)
        if let civ = seed.civilization, !civ.isEmpty { prompt += " Civilization: \(civ)." }
        generating = true; status = ""
        // W2321 — 阶段①(部数先按戏路猜, 拿到 work_cards 后以真实部数重建)。
        genStages = cssGenStages(workType: format, partCount: cssGenExpectedParts(format), title: seed.displayName)
        genStage = 0
        Task {
            let r = await CSSBackend.castMV(prompt: prompt, cast: cast)
            await MainActor.run {
                generating = false
                guard r.ok else {
                    // W2310 — 说出【为什么】, 不要只说「请重试」。
                    switch r.failure {
                    case .timedOut:
                        status = tr("The magic mirror is taking longer than usual — it may still be working. Check For You in a few minutes.")
                    case .unauthorized:
                        status = tr("Your session expired. Sign in again with the ✨ badge, top-left.")
                    case .serverRefused(let code):
                        status = tr("The server turned it down (code {code}). Nothing was charged.", ["code": String(code)])
                    case .transport(let msg):
                        status = tr("Couldn't reach the server: {msg}", ["msg": msg])
                    case .none:
                        status = tr("Couldn't start it just now. Please try again.")
                    }
                    return
                }
                /* W2315 — 接住 work_cards 才谈得上"生成成功就播放"。
                 * 拿不到卡片(例如助理这一轮只回了文字没真创作)就【不要谎称成功】——
                 * 那正是 Jing 上一轮看到的假阳性:屏幕说 Generating, 库里一行没有。 */
                guard !r.workCards.isEmpty else {
                    status = tr("The assistant replied but didn’t create anything this time. Try rephrasing, or check For You.")
                    return
                }
                playCreatedWork(r)
            }
        }
    }
}
