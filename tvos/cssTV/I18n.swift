// CSSOS_WAVE_2251 20260928 — tvOS i18n。Jing:「先做 tvOS i18n 那一波」「跟设备语言」。
//
// 【为什么不用 Localizable.strings】平台早有一条 i18n 链(W210): 英文原文当 key →
// /api/i18n/catalog/<locale> 拉全量 → 缺的走 /api/i18n/translate-batch 懒翻译 →
// 落 /srv/cssos/shared/i18n-cache/<locale>.json。web/iOS/Vision 都在用它。
// 再往 bundle 里塞一份 .strings 等于【翻译源变两份】——CLAUDE.md 写死「英文是唯一真源」,
// 且记忆里那条「不许重复造轮子」正是为此。cssTV 只是这条链的第四个客户端。
//
// 【离线】字典落盘 Library/Caches/i18n/<locale>.json, init() 同步读回 →
// 第二次开机瞬时、断网照常。拉不到一律回退英文原文, 绝不留空白。
import Foundation
import SwiftUI
import Combine

@MainActor
final class I18n: ObservableObject {
    static let shared = I18n()

    /// 字典换新时 +1。根视图 body 里读一下它, SwiftUI 就会重建子树刷新译文
    /// (故意不用 .id() —— 那是整棵拆了重建, tvOS 上会把焦点甩飞)。
    @Published private(set) var revision = 0

    /// 设备语言归一成平台 locale 码。"" = 英文(不翻译)。
    let locale: String
    private var dict: [String: String] = [:]
    private var refreshed = false

    private init() {
        locale = Self.deviceLocale()
        if !locale.isEmpty { dict = Self.readDisk(locale) }
    }

    // MARK: - 取词

    /// 英文原文进, 当前语言出。查不到一律回退原文。
    func t(_ en: String) -> String {
        guard !locale.isEmpty else { return en }
        let v = dict[en]
        return (v?.isEmpty == false) ? v! : en
    }

    // MARK: - 设备语言

    /// 设备首选语言的【原始码】(如 "zh-Hans-CN")。发给后端/LLM 时用这个 ——
    /// 那边要的是完整 BCP-47, 不是我们为了查缓存文件名而归一过的码。
    /// W2252: ActorAskView 原来自己又取了一遍 Locale.preferredLanguages, 两处各归一各的;
    /// 统一到这里, 下面的 deviceLocale() 也从它出发, 保证永远同源。
    static let rawPreferred: String = String((Locale.preferredLanguages.first ?? "en").prefix(12))

    /// tvOS 的 "zh-Hans-CN" / "ja-JP" / "en-US" → 平台码 "zh" / "ja" / ""。
    /// 服务端 i18nLocalePathSafe 会小写化, 所以 "zh-Hant" 落到 zh-hant.json —— 与 web 同一份。
    static func deviceLocale() -> String {
        let raw = rawPreferred
        let lower = raw.lowercased()
        if lower.hasPrefix("en") { return "" }                  // 英文就是源, 不需要字典
        if lower.hasPrefix("zh") {
            // 繁体的三种写法都归到 zh-Hant; 其余中文归 zh。
            if lower.contains("hant") || lower.contains("-tw") || lower.contains("-hk") || lower.contains("-mo") {
                return "zh-Hant"
            }
            return "zh"
        }
        return String(raw.split(separator: "-").first ?? "en")  // "ja-JP" → "ja"
    }

    // MARK: - 落盘

    private static func diskURL(_ locale: String) -> URL? {
        guard let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let sub = dir.appendingPathComponent("i18n", isDirectory: true)
        try? FileManager.default.createDirectory(at: sub, withIntermediateDirectories: true)
        return sub.appendingPathComponent("\(locale.lowercased()).json")
    }

    private static func readDisk(_ locale: String) -> [String: String] {
        guard let u = diskURL(locale), let d = try? Data(contentsOf: u),
              let m = try? JSONDecoder().decode([String: String].self, from: d) else { return [:] }
        return m
    }

    private static func writeDisk(_ locale: String, _ m: [String: String]) {
        guard let u = diskURL(locale), let d = try? JSONEncoder().encode(m) else { return }
        try? d.write(to: u, options: .atomic)
    }

    // MARK: - 本 App 的全部 UI 文案(字典清单)

    /// 首次进入某语言时一次性送去翻译。**只有 UI 文案** —— 作品标题/演员名/曲风不在此列。
    ///
    /// 【为什么要手写这份清单】SwiftUI 的 render 是同步的, 取词那一刻没法 await 一次网络翻译,
    /// 所以缺词不能"边渲染边补", 只能【开机时一次性补齐】—— 那就必须先知道要补哪些。
    ///
    /// 大部分条目由 scripts/test-tv-i18n.sh 从源码里的 tr("…") 字面量核对, 少了会红。
    /// 下半段那些是 tr(变量) 形式(栏目标题/分类名/尾卡), 抽不出来, 故显式列出。
    static let uiStrings: [String] = [
        "(The director is pausing — press ▶ to try again)",
        "A multithreaded interactive film — you are the director. Arrows nudge the story, Play continues, Menu exits.",
        "Account",
        "Action",
        "Action  ▶",
        "Actor",
        "Actors",
        "All",
        "All roles",
        "Anti-hero",
        "Appearances",
        "Appears in",
        "Ask",
        "Ask something…",
        "Ask {name}",
        "Audition",
        "Auto-generated · free",
        "Cancel",
        "Cast & generate  🎬",
        "Casting",
        "Charmer",
        "Chinese",
        "Close",
        "Codex",
        "Comic",
        "Coming soon",
        "Couldn't draft just now. Try again, or write your own.",
        "Couldn't reach {name} just now. Please try again. ({e})",
        "Couldn't start it just now. Please try again.",
        "Create",
        "Create an MV starring {name}",
        "Create ✨",
        "Default",
        "Digital Actors",
        "Direct",
        "Direct a Movie",
        "Direct a Series",
        "Direct a Short Drama",
        "Direct a Trilogy",
        "Direct a work",
        "Direct an MV",
        "Direct an Opera",
        "Draft",
        "Drafting…",
        "Egyptian",
        "Ending",
        "Enigma",
        "Exit",
        "Favorites",
        "Female",
        "Fine-tune",
        "For You",
        "Free",
        "From the same civilization",
        "Full feature coming soon",
        "Greek",
        "Hero",
        "Home",
        "Hybrid video",
        "Indian",
        "Intro",
        "Japanese",
        "Languages",
        "Legend",
        "Legends",
        "MV",
        "Male",
        "Mine",
        "Modern",
        "More coming soon",
        "Most Played",
        "Movie",
        "Movies",
        "Muted",
        "My Favorites",
        "Native",
        "Native · {c}",
        "Neutral",
        "No actors match these filters",
        "No background written for this actor yet.",
        "No works match “{q}”",
        "Norse",
        "Not available on TV",
        "Nothing here yet",
        "On your phone or computer, open",
        "Opera",
        "Operas",
        "Original",
        "Persian",
        "Pick a format — the system casts the actors and writes the rest. Change anything, or just let it roll.",
        "Play",
        "Please sign in first (the ✨ badge, top-left) to create.",
        "Please sign in first (top-left ✨) to create.",
        "Premium",
        "Press the text field and use the Siri Remote to dictate your question.",
        "Pt 1",
        "Real video",
        "Recommending…",
        "Renaissance",
        "Restart",
        "Rolling…",
        "Roman",
        "Ruler",
        "Sage",
        "Search",
        "Search actors…",
        "Search cssTV — hold 🎙 to speak",
        "Searching…",
        "Series",
        "Settings",
        "Shares",
        "Short Drama",
        "Short Dramas",
        "Sign in",
        "Sign in (top-left ✨) to let the system draft.",
        "Sign in to cssTV",
        "Slideshow",
        "Speak to {name} in their own words. ",
        "Start  ▶",
        "Story synopsis (≤2000 chars) — blank = system writes it",
        "Style / vibe — blank = auto",
        "System",
        "THE END",
        "TRAILER",
        "Takes",
        "Tap ♥ on any work to save it here",
        "The director is writing this shot — streaming as it comes…",
        "This work is no longer available.",
        "Title — blank = system names it",
        "Today's Picks",
        "Tragic",
        "Trilogies",
        "Trilogy",
        "Triptych",
        "Type or speak to find a work",
        "Untitled",
        "Villain",
        "Visuals",
        "Voice",
        "Voice on",
        "Voice paused (hourly limit reached). Text is always free.",
        "Voices",
        "Want an MV like this?",
        "Watch again",
        "Your pick",
        "Youth",
        "and enter this code:",
        "{badge} · {n} parts",
        "{name} hasn't recorded an audition yet.",
        "{n} img",
        "←/→ steer the story    ▶ Continue    Menu Exit",
        "✨ Casting locked — generating…",
        "✨ Create",
        "✨ Direction received! Your work is generating — it'll appear in For You when ready.",
        "✨ Draft ready — edit it, or hit Action.",
        "✨ Generating — your work appears in For You when ready.",
        "✨ Sending your direction to the magic mirror…",
        "⭐ Lead",
        "🌍 Civilization (blank = system)",
        "🎬 Direct a work",
        "🎬 Format",
        "🎭 Cast (system-recommended, swap freely)",
        "🎭 Support",
        "👥 Extras",
        "😈 Villain",
    ]

    // MARK: - 联网刷新(每次启动一次)

    /// 拉全量字典 → 补齐本 App 用到但字典里没有的条目 → 落盘 → 通知界面刷新。
    /// 整个过程任一步失败都只是"这次没更新", 已有的盘上字典照用, 绝不清空。
    func refresh() async {
        guard !locale.isEmpty, !refreshed else { return }
        refreshed = true

        var merged = dict
        if let fetched = await Self.fetchCatalog(locale), !fetched.isEmpty {
            merged.merge(fetched) { _, new in new }
        }

        // 本 App 要用、而字典里还没有的 —— 一次性送去翻译(平台的懒翻译就是这么用的)。
        let misses = Self.uiStrings.filter { (merged[$0]?.isEmpty ?? true) }
        if !misses.isEmpty, let got = await Self.translateBatch(misses, locale), !got.isEmpty {
            merged.merge(got) { _, new in new }
        }

        guard merged != dict else { return }
        dict = merged
        Self.writeDisk(locale, merged)
        revision &+= 1
    }

    private static func fetchCatalog(_ locale: String) async -> [String: String]? {
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/i18n/catalog/\(locale)") else { return nil }
        var req = URLRequest(url: url); req.timeoutInterval = 12
        guard let (d, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        struct R: Decodable { let translations: [String: String]? }
        return (try? JSONDecoder().decode(R.self, from: d))?.translations
    }

    private static func translateBatch(_ strings: [String], _ locale: String) async -> [String: String]? {
        guard let url = URL(string: "\(CSSBackend.baseURL)/api/i18n/translate-batch") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 45          // 真要过一趟 LLM, 给够时间
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["target_locale": locale, "strings": strings])
        guard let (d, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        struct R: Decodable { let translations: [String: String]? }
        return (try? JSONDecoder().decode(R.self, from: d))?.translations
    }
}

/// 带占位符的取词: tr("Ask {name}", ["name": actor.displayName])。
/// 占位符用 {name} 而不是字符串插值, 是因为【插值出来的整句不是固定 key】——
/// 每个演员名都会变成一条新词条, 字典会被撑爆且永远命中不了。
/// 服务端翻译提示词里明确写了「Keep all {placeholders} verbatim」, 所以 {} 能安全穿过 LLM。
@MainActor func tr(_ en: String, _ args: [String: String]) -> String {
    var out = I18n.shared.t(en)
    for (k, v) in args { out = out.replacingOccurrences(of: "{\(k)}", with: v) }
    return out
}

/// 全局取词。**只包 UI 文案** —— 作品标题 / 演员名 / 曲风这些后端来的【内容】不要包,
/// 那是数据不是界面(包了等于把用户的作品名也翻译掉)。
@MainActor func tr(_ en: String) -> String { I18n.shared.t(en) }
