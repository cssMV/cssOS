// CSSOS_WAVE_1560 — 数字演员(Digital Actors)tvOS 原生屏。套用桌面端 /api/actors 目录:
//   顶部品牌行 + 来源/属性筛选胶囊(All/Original/Legends/Premium/Female/Male/Neutral/Mine) +
//   戏路胶囊(All roles/Hero/Villain/…) + 演员卡网格(封面/名/文明/人设/风格/价格/传奇徽章)。
//   tvOS 无 WebKit → 不能内嵌桌面网页, 这是同数据同观感的原生重制。

import SwiftUI

struct DigitalActorsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var actors: [CSSActor] = []
    @State private var loading = true
    @State private var origin = ""          // "" / synthetic / civilization
    @State private var premium = false
    @State private var owned = false
    @State private var gender = ""          // 客户端过滤: "" / female / male / neutral
    @State private var role = ""            // archetype key
    @State private var search = ""          // 搜索: 名字/文明/人设
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
                                ActorCard(actor: a)
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
    @Environment(\.isFocused) private var focused: Bool
    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    private let w: CGFloat = 320
    private var coverH: CGFloat { w * 1.15 }

    var body: some View {
        Button { } label: {
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
