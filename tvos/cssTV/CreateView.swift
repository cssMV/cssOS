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

        // W1578 — 把选定 cast(role→actor_id) 发给后端 → create_work 封面锁脸(演员本人形象)。
        let castPayload: [[String: String]] = castSlots.compactMap { slot in
            guard let aid = chosen[slot.role], !aid.isEmpty else { return nil }
            return ["actor_id": aid, "role": slot.role]
        }
        casting = true; status = tr("✨ Sending your direction to the magic mirror…")
        Task {
            let result = await CSSBackend.castMV(prompt: full, cast: castPayload)
            await MainActor.run {
                casting = false
                if result.intent == "ifilm", let fid = result.ifilmId, !fid.isEmpty { dismiss(); onIFilm(fid); return }
                if result.ok {
                    status = tr("✨ Direction received! Your work is generating — it'll appear in For You when ready.")
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
