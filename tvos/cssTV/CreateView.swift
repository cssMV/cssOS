// W1259 / W1556 / W1560 — cssTV 导演入口「🎬 Direct a work」。套用桌面端结构:
//   戏路(format) + 文明(civilization, 文明智能联动) + 标题 + ✨起草梗概 + 故事梗概 + 风格 + 系统荐角(可换角) → Action ▶。
// 宪法「导演自动流」: 不选不填 → 系统算法推荐; 用户干预 → 系统让位。所以全空也能开拍。
// tvOS 无 WebKit → 原生重制桌面观感, 同后端 API(/api/director/synopsis · /api/cast/recommend · /api/agent/chat)。

import SwiftUI

struct CreateView: View {
    var seedPrompt: String = ""
    @ObservedObject var auth: CSSAuth
    var defaultFormat: String = ""            // W1565 — 从某栏尾卡进入时【默认预选】的戏路(""=不预选); 仍可自由改
    var onIFilm: (String) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss

    @State private var format = "single"
    @State private var civ = ""                 // "" = System(系统自拟世界)
    @State private var title = ""
    @State private var synopsis = ""
    @State private var style = ""
    @State private var status = ""
    @State private var casting = false
    @State private var drafting = false
    @State private var castSlots: [CSSBackend.CastSlot] = []
    @State private var chosen: [String: String] = [:]   // role → actor_id
    @FocusState private var focusedField: Field?
    private enum Field { case title, synopsis, style }

    private let brandGreen = Color(red: 0.0, green: 0.96, blue: 0.63)
    // W1561 — 全戏路开放(原 shortplay/series/film 的"敬请期待"锁移除): 每栏都能创作该类型。
    private let fmts: [(id: String, name: String, icon: String)] = [
        ("single", "MV", "music.note"), ("triptych", "Triptych", "books.vertical.fill"),
        ("opera", "Opera", "theatermasks.fill"), ("shortplay", "Short Drama", "film.fill"),
        ("series", "Series", "tv.fill"), ("film", "Movie", "film.stack.fill"),
    ]
    // 文明胶囊(文明智能联动)。System = 系统自拟世界(空串)。
    private let civs: [(id: String, name: String, icon: String)] = [
        ("", "System", "globe"), ("Chinese", "Chinese", "globe.asia.australia.fill"),
        ("Japanese", "Japanese", "globe.asia.australia.fill"), ("Greek", "Greek", "building.columns.fill"),
        ("Egyptian", "Egyptian", "triangle.fill"), ("Indian", "Indian", "globe.asia.australia.fill"),
        ("Roman", "Roman", "building.columns.fill"), ("Norse", "Norse", "snowflake"),
        ("Persian", "Persian", "flame.fill"), ("Renaissance Europe", "Renaissance", "paintpalette.fill"),
    ]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            EmojiBurstEffect(active: true, seed: 7, bigEmojiSize: 240, bigPeriod: 12, smallSize: 30,
                             smallSpread: 500, smallN: 22).opacity(0.5).allowsHitTesting(false)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("🎬 Direct a work").font(.system(size: 52, weight: .heavy)).foregroundStyle(.white)
                        Text("Pick a format — the system casts the actors and writes the rest. Change anything, or just let it roll.")
                            .font(.system(size: 22)).foregroundStyle(.white.opacity(0.75))
                    }

                    pillGroup("🎬 Format") { formatBar }
                    pillGroup("🌍 Civilization (blank = system)") { civBar }

                    // 标题 + ✨起草。
                    HStack(spacing: 14) {
                        field("Title — blank = system names it", text: $title, field: .title)
                        Button { draft() } label: {
                            Label(drafting ? "Drafting…" : "Draft", systemImage: "sparkles")
                                .font(.system(size: 22, weight: .bold)).padding(.vertical, 16).padding(.horizontal, 26)
                        }.buttonStyle(.card).disabled(drafting)
                    }
                    // 故事梗概。
                    field("Story synopsis (≤2000 chars) — blank = system writes it", text: $synopsis, field: .synopsis, minHeight: 150)
                    // 风格。
                    field("Style / vibe — blank = auto", text: $style, field: .style)

                    // 系统荐角(可换角)。
                    if !castSlots.isEmpty {
                        castSection
                    }

                    // Action ▶
                    HStack {
                        Button { cast() } label: {
                            Label(casting ? "Rolling…" : "Action  ▶", systemImage: "film.stack")
                                .font(.system(size: 28, weight: .bold)).padding(.vertical, 16).padding(.horizontal, 44)
                        }.buttonStyle(.card).disabled(casting)
                        Spacer()
                        Button("Close") { dismiss() }
                            .font(.system(size: 20)).buttonStyle(.plain).foregroundStyle(.white.opacity(0.6))
                    }
                    if !status.isEmpty {
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
            Text("🎭 Cast (system-recommended, swap freely)")
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
            // 默认每槽选首个候选(系统荐角); 保留用户已换的。
            for s in slots where chosen[s.role] == nil { chosen[s.role] = s.candidates.first?.actor_id }
        }
    }

    private func draft() {
        guard auth.isSignedIn else { status = "Sign in (top-left ✨) to let the system draft."; return }
        drafting = true; status = ""
        Task {
            let d = await CSSBackend.directorDraft(title: title, civ: civ)
            await MainActor.run {
                drafting = false
                if let d = d, let syn = d.synopsis, !syn.isEmpty {
                    if let t = d.title, !t.isEmpty { title = t }
                    synopsis = syn
                    status = "✨ Draft ready — edit it, or hit Action."
                } else { status = "Couldn't draft just now. Try again, or write your own." }
            }
        }
    }

    private func cast() {
        guard auth.isSignedIn else { status = "Please sign in first (the ✨ badge, top-left) to create."; return }
        // 结构化字段 → 意念串。全空则交系统全自动(导演自动流)。
        var parts: [String] = []
        if !title.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(title) }
        if !synopsis.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(synopsis) }
        if !style.trimmingCharacters(in: .whitespaces).isEmpty { parts.append("Style: \(style)") }
        let castNames = castSlots.compactMap { s in s.candidates.first(where: { $0.actor_id == chosen[s.role] })?.displayName }
        if !castNames.isEmpty { parts.append("Starring \(castNames.joined(separator: ", ")).") }
        var idea = parts.joined(separator: ". ")
        if idea.isEmpty { idea = "Surprise me — direct an original, shootable work from scratch." }
        let fmtPhrase: String
        switch format {
        case "triptych":  fmtPhrase = " — make it a 3-part triptych"
        case "opera":     fmtPhrase = " — make it a multi-act opera"
        case "shortplay": fmtPhrase = " — make it a short drama"
        case "series":    fmtPhrase = " — make it an episodic series"
        case "film":      fmtPhrase = " — make it a feature film"
        default:          fmtPhrase = ""
        }
        let civPhrase = civ.isEmpty ? "" : " Civilization: \(civ)."
        let full = idea + fmtPhrase + civPhrase

        casting = true; status = "✨ Sending your direction to the magic mirror…"
        Task {
            let result = await CSSBackend.castMV(prompt: full)
            await MainActor.run {
                casting = false
                if result.intent == "ifilm", let fid = result.ifilmId, !fid.isEmpty { dismiss(); onIFilm(fid); return }
                status = result.ok
                    ? "✨ Direction received! Your work is generating — it'll appear in For You when ready."
                    : "Couldn't start it just now. Please try again."
            }
        }
    }
}
