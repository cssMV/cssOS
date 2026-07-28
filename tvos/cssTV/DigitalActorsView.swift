// CSSOS_WAVE_1560 — 数字演员(Digital Actors)tvOS 原生屏。套用桌面端 /api/actors 目录:
//   顶部品牌行 + 来源/属性筛选胶囊(All/Original/Legends/Premium/Female/Male/Neutral/Mine) +
//   戏路胶囊(All roles/Hero/Villain/…) + 演员卡网格(封面/名/文明/人设/风格/价格/传奇徽章)。
//   tvOS 无 WebKit → 不能内嵌桌面网页, 这是同数据同观感的原生重制。

import SwiftUI

struct DigitalActorsView: View {
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
    private let originFilters: [(key: String, label: String, icon: String)] = [
        ("all",     "All",      "sparkles"),
        ("original","Original", "wand.and.stars"),
        ("legends", "Legends",  "building.columns.fill"),
        ("premium", "Premium",  "diamond.fill"),
        ("female",  "Female",   "person.fill"),
        ("male",    "Male",     "person.fill"),
        ("neutral", "Neutral",  "person.fill"),
        ("mine",    "Mine",     "person.crop.rectangle.stack.fill"),
    ]
    // 戏路(archetype)。
    private let roles: [(key: String, label: String, icon: String)] = [
        ("",        "All roles", "person.3.fill"),
        ("hero",    "Hero",      "shield.lefthalf.filled"),
        ("villain", "Villain",   "flame.fill"),
        ("antihero","Anti-hero", "theatermask.and.paintbrush.fill"),
        ("ruler",   "Ruler",     "crown.fill"),
        ("action",  "Action",    "figure.run"),
        ("sage",    "Sage",      "book.fill"),
        ("charmer", "Charmer",   "heart.fill"),
        ("tragic",  "Tragic",    "cloud.rain.fill"),
        ("comic",   "Comic",     "face.smiling.inverse"),
        ("enigma",  "Enigma",    "questionmark.circle.fill"),
        ("youth",   "Youth",     "leaf.fill"),
    ]

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
                        Text("No actors match these filters")
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
            Label("Digital Actors", systemImage: "theatermasks.fill")
                .font(.system(size: 46, weight: .heavy))
                .foregroundStyle(brandGreen)
            // 搜索(名字/文明/人设)。tvOS: 聚焦即弹听写/屏幕键盘。
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.5))
                TextField("Search actors…", text: $search)
                    .textFieldStyle(.plain).font(.system(size: 22))
                    .focused($searchFocused)
                    .onSubmit { Task { await reload() } }
            }
            .padding(.vertical, 12).padding(.horizontal, 20)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.08)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(brandGreen.opacity(searchFocused ? 0.9 : 0.25), lineWidth: 2))
            .frame(maxWidth: 520)
            Spacer()
            Button("Close") { dismiss() }
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
    let actor: CSSActor
    @ObservedObject var auth: CSSAuth          // W1578 — 传给导演台(主演创作)
    @Environment(\.dismiss) private var dismiss
    @State private var creating = false        // W1578 — 打开导演台(该演员主演)
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            HStack(alignment: .top, spacing: 60) {
                ZStack(alignment: actor.coverAlignment) {
                    if let c = actor.cover_image, let url = URL(string: c) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                        placeholder: { Color.white.opacity(0.08) }
                    } else { Color.white.opacity(0.08) }
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
                            Label("Create an MV starring \(actor.displayName)", systemImage: "wand.and.stars")
                                .font(.system(size: 24, weight: .heavy))
                        }
                        .buttonStyle(.borderedProminent).tint(brandGreen)
                        Button("Close") { dismiss() }
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
    }
}

// W1578 — 照搬桌面端 openCastPanel: 选中演员=主角槽(带图/名/文明), 按其文明智能联动荐反派(可换) → 定角并生成(带 cast 锁脸)。
private struct ActorCastPanel: View {
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

    private let fmts: [(id: String, name: String)] = [("single", "MV"), ("triptych", "Triptych"), ("opera", "Opera")]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    HStack {
                        Label("Casting", systemImage: "theatermasks.fill")
                            .font(.system(size: 40, weight: .heavy)).foregroundStyle(brandGreen)
                        Spacer()
                        Button("Close") { dismiss() }
                            .font(.system(size: 22, weight: .semibold)).buttonStyle(.bordered).tint(.white.opacity(0.6))
                    }
                    CSSPillBar(items: fmts.map { CSSPillItem(id: $0.id, label: $0.name, icon: nil) },
                               selected: Binding(get: { format }, set: { format = $0; Task { await loadCast() } }))
                    slotView(title: "⭐ Lead", actor: seed, locked: true, pool: [])
                    if loading {
                        ProgressView().tint(brandGreen).frame(maxWidth: .infinity, minHeight: 200)
                    } else {
                        slotView(title: "😈 Villain", actor: antagonist, locked: false, pool: antagPool, onPick: { antagonist = $0 })
                        slotView(title: "🎭 Support", actor: support, locked: false, pool: supportPool, onPick: { support = $0 })
                        // 群演: 系统自动生成(照桌面端默认 auto, 免费)。
                        HStack(spacing: 14) {
                            Text("👥 Extras").font(.system(size: 24, weight: .bold)).foregroundStyle(.white)
                            Text("Auto-generated · free").font(.system(size: 18)).foregroundStyle(brandGreen)
                            Spacer()
                        }.padding(20).background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.05)))
                    }
                    Button { generate() } label: {
                        Label(generating ? "Rolling…" : "Cast & generate  🎬", systemImage: "film.stack")
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
                    Text(actor?.displayName ?? "Recommending…").font(.system(size: 26, weight: .heavy)).foregroundStyle(.white)
                    if let civ = actor?.civilization, !civ.isEmpty { Text(civ).font(.system(size: 18)).foregroundStyle(brandGreen) }
                    if locked { Text("Your pick").font(.system(size: 16)).foregroundStyle(.white.opacity(0.5)) }
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
        guard auth.isSignedIn else { status = "Please sign in first (top-left ✨) to create."; return }
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
        generating = true; status = "✨ Casting locked — generating…"
        Task {
            let r = await CSSBackend.castMV(prompt: prompt, cast: cast)
            await MainActor.run {
                generating = false
                status = r.ok ? "✨ Generating — your work appears in For You when ready." : "Couldn't start it just now. Please try again."
            }
        }
    }
}
