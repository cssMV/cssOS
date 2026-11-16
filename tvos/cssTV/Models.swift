// CSSOS_WAVE_1172 20260624 — Jing 愿景: Apple TV 原生 App(大屏影院, 不走 WebView —— tvOS 无 WebKit)。
// 数据模型, 与 cssOS 后端对齐(works / 画音分层 / 逐字情绪字幕)。与 visionos/CSSImmersive/Models.swift 同源约定。
//
// 画音分层铁律: videoURL = 静音视觉; audioURL = 独立真声音(永不用视频声)。

import Foundation
import SwiftUI

// MARK: - W1257 情绪 FX 统一规范(一字照搬桌面 app.emotion-fx.js / cssfxSparkOut)。
// 字幕字心烟花、侧栏选中、激活胶囊全调这套, 风格统一, 不再各搞一套。
enum CSSFx {
    /// 桌面 PETALS 池(app.emotion-fx.js:125)。
    static let petals = ["🌸", "🌺", "🌷", "💮", "✨", "🎉", "💖", "🌟"]

    /// 端口自桌面 @keyframes cssfxSparkOut(style.watch.css:1412):
    ///   0% opacity0/scale0.4(中心) → 12% opacity1(爆入) → 62% opacity0.92/travel0.9/scale1.04(停留)
    ///   → 100% opacity0/travel1.0/scale1.06(淡出)。曲线 cubic-bezier(0.2,0.7,0.3,1)。
    /// p ∈ [0,1] 为粒子在自身生命周期内的相位。返回 (透明度, 行进比例 0~1, 缩放)。
    /// 烟花小粒(照桌面手感): 【快速冲出(前15%, ease-out)→ 原地冻结不动 → 原地淡出】。
    /// Jing: 不要"边走边淡懒洋洋飘走"; 是爆出来僵住, 然后淡掉, 才有节奏。
    static func sparkOut(_ p: Double) -> (opacity: Double, travel: Double, scale: Double) {
        // travel: 前 15% ease-out 冲到 0.9, 之后【冻结】(常量 0.9)——淡出阶段绝不再移动。
        let travel: Double
        if p < 0.15 {
            let k = p / 0.15
            travel = 0.9 * (1 - (1 - k) * (1 - k))   // ease-out, 快出
        } else {
            travel = 0.9                             // 冻结, 原地不动
        }
        // opacity: 爆入(0~10%)→ 停留满(10~55%)→ 原地淡出(55~100%)。
        let opacity: Double
        if p < 0.10 { opacity = p / 0.10 }
        else if p < 0.55 { opacity = 1.0 }
        else { opacity = 1.0 - (p - 0.55) / 0.45 }
        // scale: 弹入过冲(0.5→1.2)→ 落定 1.0 → 停 → 淡出微涨。
        let scale: Double
        if p < 0.15 { scale = 0.5 + 0.7 * (p / 0.15) }
        else if p < 0.30 { scale = 1.2 - 0.2 * ((p - 0.15) / 0.15) }
        else if p < 0.55 { scale = 1.0 }
        else { scale = 1.0 + 0.06 * ((p - 0.55) / 0.45) }
        return (max(0, opacity), travel, scale)
    }

    /// 端口自桌面 cssfxCenterPop(大 emoji/大字: 过冲弹入 → 停留 → 淡出, 一次, 不循环)。
    /// p ∈ [0,1] 为这一次爆的生命相位。返回 (透明度, 缩放)。
    static func centerPop(_ p: Double) -> (opacity: Double, scale: Double) {
        let scale: Double
        if p < 0.13 { scale = 0.42 + (1.28 - 0.42) * (p / 0.13) }          // 弹入过冲到 1.28
        else if p < 0.30 { scale = 1.28 - 0.28 * ((p - 0.13) / 0.17) }      // 回落到 1.0
        else if p < 0.64 { scale = 1.0 }                                    // 停留(dwell)
        else { scale = 1.0 + 0.10 * ((p - 0.64) / 0.36) }                   // 淡出时微涨到 1.10
        let opacity: Double
        if p < 0.13 { opacity = p / 0.13 }                                  // 爆入
        else if p < 0.64 { opacity = 1.0 }                                  // 停留满
        else { opacity = 1.0 - (p - 0.64) / 0.36 }                          // 慢淡出
        return (max(0, opacity), scale)
    }

    /// 稳定伪随机 [0,1)(给定整数对 → 同值, 用于每颗粒子/每轮的随机角度·距离·色相·选字)。
    static func rnd(_ a: Int, _ b: Int) -> Double {
        let s = sin(Double(a &* 127 &+ b &* 311) * 0.61803398875) * 43758.5453
        return s - floor(s)
    }

    /// 随机色 halo(桌面 hsl(rand*360,92%,72%))。
    static func haloColor(_ seed: Int) -> Color {
        Color(hue: rnd(seed, 7), saturation: 0.92, brightness: 0.86)
    }
}

/* CSSOS_WAVE_2250 — 数字字段的"两种形状都认"包装。
 *
 * 后端同一个字段在不同行里可能是数字也可能是字符串(visual_frames 实测就是字符串)。
 * Swift 的数组解码是全有或全无 —— 一个元素抛错, 整包作废, 而调用方只会看到"没数据",
 * 根本不知道是解码炸了。这个包装让形状不一致【降级成单个字段为 nil】, 不再拖垮整包。 */
struct LooseInt: Codable {
    let value: Int?
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { value = i }
        else if let s = try? c.decode(String.self) { value = Int(s.trimmingCharacters(in: .whitespaces)) }
        else if let d = try? c.decode(Double.self) { value = Int(d) }
        else { value = nil }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        if let v = value { try c.encode(v) } else { try c.encodeNil() }
    }
}

/// 一首作品(MV)。字段映射 cssOS 后端 work 行(只取大屏影院需要的)。
struct CSSWork: Codable, Identifiable {
    let id: String
    var title: String?
    /// 画面层(静音视觉视频)。后端字段 final_mv_url。
    var videoURL: String?
    /// 独立音轨(真声音)。后端字段 audio_track_1_url。
    var audioURL: String?
    /// 封面图。
    var coverURL: String?
    /// W1526 — Layer 2 封面人脸焦点(0~1 比例; <0 或缺失 = 无脸/未检测, 回落顶部裁剪)。
    var coverFocalX: Double?
    var coverFocalY: Double?
    /// 时长(秒)。
    var durationSecs: Double?
    /* CSSOS_WAVE_2231 20260927 — 顶排要显示【标题 + 概述描述】(Jing:「苹果 TV 显示的是
     * 标题和概述说明描述文字, 我们是否也可以那样?」)。以前这三列一直没解出来, 于是顶排
     * 只有一个标题, 下面空着 —— 不是显示不了, 是我们【根本没把描述取回来】。
     * 后端 /api/works/market 这三列本来就在返回里, 白放着。 */
    /// 曲风(后端 style)。顶排的 genre 一行, 也是描述屏的副标题。
    var style: String?
    /// 歌词开头若干行(后端 lyrics_preview)。顶排/描述屏的概述正文取自它。
    var lyricsPreview: String?
    /// 作者显示名(后端 owner_name)。
    var ownerName: String?
    /// 已有语言轨(后端 available_langs)。
    var availableLangs: [String]?
    /* CSSOS_WAVE_2250 20260927 — 多画面胶囊(Visuals)上 TV 所需的三件。
     *
     * 【判据必须来自后端 visual_kind, 绝不用"有没有 mp4"来猜】——
     * 桌面端 app.watch-visual-pills.js 的原话: 平台的 mp4 很多是【我们自己用封面拼出来的
     * 幻灯片视频】, 按"有 mp4 = 真视频"来标, 屏幕上就是在撒谎。
     * (实测 2026-09-27 全库 244 条: slides 192 / video 49 / hybrid 3, 其中 139 条
     *  既有 mp4 又有幻灯帧 —— 正是最容易被"有 mp4"这条错判据标错的那一批。) */
    var visualKind: String?          // "video" / "hybrid" / "slides"
    /* ⚠ visual_frames 后端发的是【字符串】("6"), 不是数字 —— 实测 48/90 条是 str。
     * 我第一版直接声明 Int? , 于是那 48 条各自抛错 → Swift 的数组解码是【全有或全无】→
     * 【整个 feed 解码失败】→ fetchFeed 一路掉到 [flagship] 兜底。
     * 症状极隐蔽: 首页还有东西(那一首旗舰), 顶排清单从 10 条变成 1 条, Visuals 读不到帧数。
     * 要不是顶排日志打了"清单 1 条", 这个洞能一直带到线上。
     * 教训: 【字段类型要看真实响应, 不要照着语义猜】; 而且解码要能兜住两种形状。 */
    var visualFramesRaw: LooseInt?
    var visualFrames: Int? { visualFramesRaw?.value }
    var coverSlides: [String]?       // 幻灯帧 URL
    /// 作品类型(single/opera/film/series/triptych…)。CSSOS_WAVE_1227 首页分轨用。
    var workType: String?
    /// 创建时间(ISO8601 串)。W1281 — For You 严格从新到旧排序用(字典序=时间序)。
    var createdAt: String?
    /// W1329 — 多部作品的子作品(各 part)。market 序列化带 children。
    var children: [CSSWork]?
    /// CSSOS_WAVE_1984d 20260826 — 真视频 MV 的显式标记(后端 is_real_video_mv)。
    ///   For You 栏靠它把真视频顶在最前, 与 Web 端同一判据 —— 不用 URL 猜。
    var isRealVideoMV: Bool?
    /// W1329 — 媒体兜底列(多部 children 媒体常在 preview 列, 非 work_assets)。
    var previewAudio: String?
    var previewVideo: String?
    /// W1249 聆听/观赏 gating。
    var listenPriceCents: Int?
    var buyoutPriceCents: Int?
    var viewerOrders: [ViewerOrder]?

    struct ViewerOrder: Codable {}   // 只关心"有没有/几条", 字段不限 → 空 Codable 容忍任意对象。

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case videoURL = "final_mv_url"
        case audioURL = "audio_track_1_url"
        case coverURL = "cover_image"
        case coverFocalX = "cover_focal_x"
        case coverFocalY = "cover_focal_y"
        case durationSecs = "duration_secs"
        case style
        case lyricsPreview = "lyrics_preview"
        case ownerName = "owner_name"
        case availableLangs = "available_langs"
        case visualKind = "visual_kind"
        case visualFramesRaw = "visual_frames"
        case coverSlides = "cover_slides"
        case workType = "work_type"
        case createdAt = "created_at"
        case children
        case isRealVideoMV = "is_real_video_mv"
        case previewAudio = "preview_audio_url"
        case previewVideo = "preview_video_url"
        case listenPriceCents = "current_listen_price_cents"
        case buyoutPriceCents = "current_buyout_price_cents"
        case viewerOrders = "viewer_orders"
    }

    /// W1526 — 封面裁剪锚点: 有人脸焦点则对准脸(scaledToFill 溢出朝反方向裁, 保住脸),
    ///   无脸/未检测回落 .top(Layer 1: 人物头通常在上, 顶部对齐防削头)。
    var coverAlignment: Alignment {
        guard let fx = coverFocalX, let fy = coverFocalY, fx >= 0, fy >= 0 else { return .top }
        let h: HorizontalAlignment = fx < 0.34 ? .leading : (fx > 0.66 ? .trailing : .center)
        let v: VerticalAlignment = fy < 0.34 ? .top : (fy > 0.66 ? .bottom : .center)
        return Alignment(horizontal: h, vertical: v)
    }

    /// 收费(聆听价 > 0)。
    var isPaid: Bool { (listenPriceCents ?? 0) > 0 }
    /// 已拥有(本人在该作品上有订单)。
    var isOwned: Bool { (viewerOrders?.isEmpty == false) }
    /// W1365 — Jing: tvOS 端【全免费可看】(扫清 App Store 3.1.1: 不在 TV 上 gate/标价/引导站外购买)。
    ///   付费/解锁留给 Web/未来 StoreKit; TV 纯欣赏入口, 任何作品直接可播。
    var canPlayFree: Bool { true }
    var listenPriceLabel: String {
        let c = listenPriceCents ?? 0
        guard c > 0 else { return "" }
        return "¥" + String(format: "%.2f", Double(c) / 100).replacingOccurrences(of: ".00", with: "")
    }

    /* W2231 — 概述正文。歌词原文直接拿来当描述是不行的:
     *   ① 京典模版的歌词里【每一节都带方括号小节标题】([Verse 1: …] / [Chorus] / [间奏]),
     *      那是给 Suno 的编曲指令, 不是给人看的文案 —— 原样丢进顶排就是一堆方括号。
     *   ② 歌词是【一行一短句】, 连成一段会糊成一团, 要用分隔符断开。
     * 所以这里滤掉方括号行与空行, 取开头几句, 用「 / 」连起来。 */
    /* W2231b — 曲风 / 概述都必须能【落到子作品】去取。
     *
     * 实测(2026-09-27, 顶排前 12 条): 只有【单曲】的根行带 lyrics_preview,
     * 三部曲 / 歌剧 / 短剧的根行是【空的】—— 词和曲风都在各 part 身上。
     * 10 条顶排里 8 条是多部作品, 也就是说不落子的话【八成的描述都是空白】。
     * 这个洞我第一版就埋进去了, 发之前实地查了一遍才发现 —— 只看单曲那一条是查不出来的。 */
    private var firstPartWithText: CSSWork? {
        children?.first(where: { !($0.lyricsPreview ?? "").isEmpty })
    }
    /// 顶排 genre / 简介屏副标题用的曲风。根行没有就取第一部的。
    var displayStyle: String {
        if let st = style, !st.isEmpty { return st }
        return children?.compactMap({ $0.style }).first(where: { !$0.isEmpty }) ?? ""
    }
    /* CSSOS_WAVE_2233 20260927 — 顶排轮播的【真视频】。
     *
     * Jing:「苹果轮播的是首先封面图/静态页面, 随后就是动态的真视频…
     *        没有真视频, 那就老实显示封面图; 如果有真视频…也像苹果的顶排一样播放真视频。」
     *
     * 两条判据缺一不可:
     *   ① 必须是【真视频】(is_real_video_mv)。《白鹤报恩》有一个 canon-*.mp4, 但那是
     *      幻灯渲染出来的片子(visual_kind='slides', is_real_video_mv=false) —— 它动起来
     *      就是几张静图在推拉, 当"真视频"放上去反而露怯。按 Jing 的话: 老实显示封面。
     *   ② 三部曲的根行【标记为真视频, 但 mp4 在各部身上】(实测 6 个三部曲根行 mp4 全空)。
     *      只看根行 = 六个三部曲一个都放不出视频。和曲风/歌词同一个落子模式。 */
    var displayPreviewVideo: String? {
        guard isRealVideoMV == true else { return nil }
        if let v = bestVideo, !v.isEmpty { return v }
        return children?.compactMap({ $0.bestVideo }).first(where: { !$0.isEmpty })
    }

    /// 顶排 / 简介屏真正显示的那段词(根行没有就取第一部的)。
    var displayLyrics: String {
        let own = lyricsPreview ?? ""
        return own.isEmpty ? (firstPartWithText?.lyricsPreview ?? "") : own
    }

    /* W2250 — 幻灯帧列表。照桌面 slideList(): 没有 cover_slides 就退回单张封面,
     * 保证"幻灯"这一形态永远有东西可放, 不会切过去变黑屏。 */
    var slideFrames: [String] {
        let a = (coverSlides ?? []).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if !a.isEmpty { return a }
        if let c = coverURL, !c.isEmpty { return [c] }
        return []
    }

    var summaryText: String {
        let lines = displayLyrics
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { l in
                guard !l.isEmpty else { return false }
                // 方括号小节标题(半角 [ 与全角 【 都有)
                if l.hasPrefix("[") || l.hasPrefix("【") { return false }
                return true
            }
        guard !lines.isEmpty else { return displayStyle }
        var out = ""
        for l in lines.prefix(6) {
            let next = out.isEmpty ? l : out + " / " + l
            if next.count > 200 { break }
            out = next
        }
        return out.isEmpty ? String(lines[0].prefix(200)) : out
    }

    var durationLabel: String {
        guard let s = durationSecs, s > 0 else { return "" }
        let m = Int(s) / 60, ss = Int(s) % 60
        return String(format: "♪ %d:%02d", m, ss)
    }

    // W1259 — 「Want an MV like this?」创作尾卡哨兵(每条 rail / hero 末尾各放一张, 点它进创作台)。
    // W1259 / W1561 — 创作尾卡。id = 前缀 + 目标戏路(format) → 点它进导演台并【锁定该栏目类型】:
    //   三部曲栏尾卡 = 创作三部曲, 电影栏 = 创作电影…(文明智能联动: 在哪栏创作, 成品即该类型, 自动归入该栏)。
    static let createCardId = "__cssos_create__"
    static func createCard(_ format: String = "") -> CSSWork { CSSWork(id: createCardId + format) }
    var isCreateCard: Bool { id.hasPrefix(Self.createCardId) }
    /// 尾卡目标戏路(""=通用, 让导演台自由选)。
    var createFormat: String? { isCreateCard ? String(id.dropFirst(Self.createCardId.count)) : nil }
    /// 尾卡标题(按目标戏路)。
    var createTitle: String {
        switch createFormat ?? "" {
        case "triptych": return "Direct a Trilogy"
        case "opera":     return "Direct an Opera"
        case "shortplay": return "Direct a Short Drama"
        case "series":    return "Direct a Series"
        case "film":      return "Direct a Movie"
        case "single", "mv": return "Direct an MV"
        default:          return "Direct a work"
        }
    }

    // CSSOS_WAVE_1560 — Jing「右栏必须 1:1 映射侧栏所有分类, 哪怕只有一个预告片」: 空分类
    //   (平台暂无作品, 如 Opera)也显示一张"敬请期待"占位卡 → 该栏目始终可见, 苹果审核不会
    //   判"栏目未完善"。占位卡不可播放(choose 里拦截)。
    static let comingSoonId = "__cssos_coming_soon__"
    static func comingSoon(_ label: String) -> CSSWork { CSSWork(id: comingSoonId, title: label) }
    var isComingSoon: Bool { id == Self.comingSoonId }

    // W1329 — 可播媒体(work_assets 优先, 兜底 preview 列)。
    var bestAudio: String? { audioURL ?? previewAudio }
    var bestVideo: String? { videoURL ?? previewVideo }
    /// 连播队列: 有子作品(多部)→ 各 part 按序; 否则 → 自己一首。
    var playbackParts: [CSSWork] {
        // W1472 — 取【有任何可播媒体(视频或音频)】的子项。
        //   · 叙事预告: 子项=空 act 节点(无视频无音频)→ 全筛掉 → 回退 root 整片。
        //   · 音乐三部曲: 子项只有音频(无视频)→ 保留 → 逐部连播(W1470 误判为只认视频→
        //     音频部全被筛→回退到无媒体的 root→"无法播放", 此为根因修复)。
        /* CSSOS_WAVE_2330 20261115 — 歌剧(三层树)要【再下一层】才拿得到能播的东西。
         *
         * 实测《花の色は》: root 的直接子节点是 3 个幕, 三个幕【都没有媒体】(幕是容器,
         * 永远不作曲), 真正有音频的 6 个场在【孙节点】那一层。
         * 于是上面那一行把三个幕全筛掉 → 回退 [self] → 根也没媒体 → 屏幕上"无法播放"。
         * 六场音频其实都在, 只是播放器没下去取。
         *
         * 这是三层树(歌剧/连续剧/电影)独有的; 三部曲是两层, 从来碰不到, 所以藏到今天。
         *
         * 摊平顺序 = 幕1的场 → 幕2的场 → 幕3的场, 正是播放顺序铁律要的
         * 「必须 1,2,3 连播」。不用 sort, 服务端给的就是这个序(客户端不要重排服务端顺序)。
         *
         * W1472 那条回退仍然成立: 幕既没媒体、孙节点也没有 → flat 为空 → 照旧回退 [self]。 */
        guard let ch = children, !ch.isEmpty else { return [self] }
        var flat: [CSSWork] = []
        for c in ch {
            if c.bestVideo != nil || c.bestAudio != nil {
                flat.append(c)                       // 两层: 分部自己有媒体
            } else if let g = c.children?.filter({ $0.bestVideo != nil || $0.bestAudio != nil }),
                      !g.isEmpty {
                flat.append(contentsOf: g)           // 三层: 幕是容器 → 把它的场按序摊进来
            }
        }
        return flat.isEmpty ? [self] : flat
    }

    // W1326 — 多部作品(三部曲/歌剧/剧集/电影): 卡片显示为叠卡 + 类型徽章, 播放连续播整部。
    var isMultiPart: Bool {
        ["triptych", "trilogy", "opera", "series", "film", "movie"].contains((workType ?? "").lowercased())
    }
    var typeBadge: String {   // i18n: 英文默认
        switch (workType ?? "").lowercased() {
        case "triptych", "trilogy": return "Trilogy"
        case "opera": return "Opera"
        case "series": return "Series"
        case "film", "movie": return "Movie"   // W1561 — Films→Movies
        default: return ""
        }
    }
}

/// CSSOS_WAVE_1560 — 数字演员(Digital Actors)。套用桌面端 /api/actors 的数据模型, tvOS 原生渲染。
///   字段名对齐后端 JSON(snake_case), 直接解码, 免 CodingKeys 样板。
struct CSSActor: Codable, Identifiable {
    let actor_id: String
    var id: String { actor_id }
    var name_en: String?
    var name_zh: String?
    var civilization: String?
    var persona: String?
    var cover_image: String?
    var cover_focal_x: Double?
    var cover_focal_y: Double?
    var gender: String?
    var voice_style: String?
    var style_descriptor: String?
    var is_premium: Bool?
    var cast_price_cents: Int?
    var curation_tier: String?      // S/A/B
    var origin_type: String?        // synthetic | civilization | real_person
    var archetypes: [String]?
    /* W2254 — 两态循环片(待机/说话)。全库 200 位演员目前只有 4 位有,
     * 所以取不到是常态, 界面必须原样回落静态肖像, 不能留黑框。 */
    var f2f_idle_url: String?
    var f2f_talk_url: String?

    /* W2251 — 兜底名会上屏, 要翻。标 @MainActor 是因为 tr() 在主线程;
     * 这两个属性本来就只在 View 里读, 不产生传染。*/
    @MainActor var displayName: String { (name_en?.isEmpty == false ? name_en : nil) ?? name_zh ?? tr("Actor") }
    var isLegend: Bool { (origin_type ?? "") == "civilization" }
    @MainActor var priceLabel: String {
        guard let c = cast_price_cents, c > 0 else { return tr("Free") }
        return "💎 ¢" + String(c)
    }
    var coverAlignment: Alignment {
        guard let fx = cover_focal_x, let fy = cover_focal_y, fx >= 0, fy >= 0 else { return .top }
        let h: HorizontalAlignment = fx < 0.34 ? .leading : (fx > 0.66 ? .trailing : .center)
        let v: VerticalAlignment = fy < 0.34 ? .top : (fy > 0.66 ? .bottom : .center)
        return Alignment(horizontal: h, vertical: v)
    }
}

/// CSSOS_WAVE_1227 — 首页一行 rail(标题 + 该行作品)。Apple TV 标准横向行布局。
struct CSSRail: Identifiable {
    let id: String
    let title: String
    let works: [CSSWork]
    var icon: String = "sparkles"   // W1274 — 栏目标题图标(SF Symbol)
}

// MARK: - W1247 逐字情绪字幕(招牌)数据模型
// 源: GET /api/works/:id/language-tracks → subtitle_take1_json_url → subtitle-take1.json
// 时间单位 = 毫秒。languages[].sections[].lines[].tokens[]。

struct CSSSubtitleDoc: Codable {
    let languages: [CSSSubLanguage]
    let themeEmoji: [String]?
    enum CodingKeys: String, CodingKey { case languages; case themeEmoji = "theme_emoji" }
}
struct CSSSubLanguage: Codable {
    let lang: String
    let sections: [CSSSubSection]
}
struct CSSSubSection: Codable {
    let tag: String?
    let emotion: String?
    let lines: [CSSSubLine]
}
struct CSSSubLine: Codable, Identifiable {
    let text: String?
    let tStart: Double            // ms
    let tEnd: Double              // ms
    let tokens: [CSSSubToken]?
    let adlib: Bool?
    var id: String { "\(tStart)-\(text ?? "")" }
    var startSec: Double { tStart / 1000 }
    var endSec: Double { tEnd / 1000 }
    enum CodingKeys: String, CodingKey { case text; case tStart = "t_start"; case tEnd = "t_end"; case tokens; case adlib }
}
struct CSSSubToken: Codable, Identifiable {
    let char: String
    let tStart: Double            // ms
    let tEnd: Double              // ms
    let volume: Double?
    let pitchHz: Double?
    let emotion: String?
    let emotionIntensity: Double?
    var id: String { "\(char)-\(tStart)" }
    var startSec: Double { tStart / 1000 }
    var endSec: Double { tEnd / 1000 }
    var intensity: Double { emotionIntensity ?? 0.6 }
    enum CodingKeys: String, CodingKey {
        case char; case tStart = "t_start"; case tEnd = "t_end"
        case volume; case pitchHz = "pitch_hz"; case emotion; case emotionIntensity = "emotion_intensity"
    }
}

// MARK: - CSSOS_WAVE_2253 演员典故(GET /api/actors/:id/codex)
//   桌面端早有这一屏, TV 零引用 —— 而它恰恰是【最适合电视】的内容形态:
//   靠在沙发上读一位文明人物的生平, 大屏大字, 不需要打字。

struct CSSActorCodex: Decodable {
    var actor: CSSActorFull?
    var mvs: [CSSCodexMV]?
    var related_actors: [CSSActor]?
    var counts: CSSCodexCounts?
}

struct CSSCodexCounts: Decodable {
    var appearances: Int?
    var comments: Int?
    var shares: Int?
    var casts: Int?
}

/// codex 里的 actor 是整行 digital_actors, 比列表用的 CSSActor 多出生平等字段。
struct CSSActorFull: Decodable {
    var actor_id: String?
    var name_zh: String?
    var name_en: String?
    var name_native: String?
    var civilization: String?
    var persona: String?
    var bio: String?
    var voice_style: String?
    var style_descriptor: String?
    var gender: String?
    var age_range: String?
    var origin_type: String?
    var cover_image: String?
    var tags: [String]?
    // W2254 — codex 是 SELECT *, 本来就带这两条; 补进来让典故屏自己也能放循环片,
    // 不必依赖调用方传进来的那份 CSSActor 是否完整。
    var f2f_idle_url: String?
    var f2f_talk_url: String?
    var displayName: String {
        (name_en?.isEmpty == false ? name_en : nil) ?? name_zh ?? name_native ?? ""
    }
}

struct CSSCodexMV: Decodable, Identifiable {
    var work_id: String?
    var title: String?
    var cover_url: String?
    var role_name: String?
    var work_type: String?
    var duration_secs: LooseInt?
    var id: String { work_id ?? UUID().uuidString }
}

// MARK: - CSSOS_WAVE_2254 演播厅(GET /api/actors/:id/stage)
//   rig 只是七个数值(顶光/左灯/右灯 + 三段背景 + 地面) + 可选背幕图。
//   表在 public/app.actor-stage.js(60 间文明厅), 后端把那个文件当数据源跑 ——
//   TV 这边【不存表】, 免得两份数值漂移(妲己那间的左右灯位是照着真背幕定的, 抄错就穿帮)。

struct CSSStageRig: Decodable {
    var id: String?
    var title_zh: String?
    var title_en: String?
    var key: String?          // 顶光
    var left: String?         // 左灯
    var right: String?        // 右灯
    var bg: [String]?         // 三段背景
    var floor: String?        // 地面
    var plate: String?        // 背幕图(可选)
}

// MARK: - CSSOS_WAVE_2257 演员评论(只读)
//   TV 上【只读不写】: 遥控器打字是酷刑, 写评论留在手机/电脑端。
struct CSSActorComment: Decodable, Identifiable {
    var id: String?
    var author_name: String?
    var body: String?
    var created_at: String?
    var parent_id: String?
    var pinned: Bool?
    var region: String?
    var displayId: String { id ?? UUID().uuidString }
}
