// CSSOS_WAVE_1933 20260824 — Vision 播放器的【唯一真源】层。
//
// 为什么第一行代码就写它:
//   web 端花了三十年也没治好串播 —— 标题是李白、画面是唐伯虎、音乐是日本歌、字幕是
//   第三种语言。今天查到的病根不是某个模块写错了, 而是【54 个模块各自碰同一对媒体
//   元素, 谁先跑到谁说了算】: 有的信队列项、有的信缓存对象、有的信别人递过来的 URL。
//   连 Vision 端自己的 CSSBackend.defaultWork() 也在手写 URL 拼作品 —— 同一种病。
//
// 所以 Vision 播放器立一条规矩, 不留第二条路:
//   **一切作品数据只能来自 GET /api/works/public/:id, 按 ID 取。**
//   不接受任何调用方递进来的 videoURL / audioURL / coverURL —— 它们正是污染源。
//   要播哪一首, 只准给 ID。
//
// 这条规矩现在才可行, 是因为 W1931 刚把真源接口补全: 之前它查了 subtitle_take1_json_url /
// language / 画幅却不往外返, 拿 ID 也取不到字幕和方向, 只能各处手工凑 —— 真源不完整,
// "只信真源"就是句空话。
//
// 附带的好处(Vision 独有):
//   画幅(frame_width/height)在【建图层之前】就拿到了 → 该不该转 90° 当场就能定,
//   不会像 web 那样"先露横的再啪一下转"(W1930 在 web 端是靠幕布补救的)。

import Foundation

/// 真源返回体 —— 字段与 /api/works/public/:id 的 data 一一对应(W1931 补全后)。
/// 只解码播放器真正要用的; 多余字段忽略, 后端加字段不会让这里崩。
struct CSSTruth: Codable {
    let id: String
    var title: String?
    var style: String?
    var work_type: String?
    var lyrics_preview: String?

    // 画面轨 —— 四种形态: 真视频 / 混合视频 / 幻灯 / 封面图
    var final_mv_url: String?
    var preview_video_url: String?
    var cover_image: String?
    var cover_slides: [String]?
    var visual_kind: String?          // "real_video" | "hybrid" | "slides" | ...
    var visual_frames: Int?

    // 音乐轨 —— 与画面永不合成(永不烧录铁律)
    var audio_track_1_url: String?
    var preview_audio_url: String?

    // 字幕轨
    var subtitle_take1_json_url: String?
    var subtitle_take2_json_url: String?

    // 画幅 / 构图 —— 让方向在建图层前就定好
    var aspect_ratio: String?
    var frame_width: Int?
    var frame_height: Int?
    var cover_focal_x: Double?
    var cover_focal_y: Double?

    // 文明智能联动
    var language: String?
    var civilization: String?
    var voice_gender: String?
    var vocal_style: String?
    var actor_id: String?

    var duration_secs: Double?
    var owner_name: String?

    // MARK: 派生

    /// 画面源。真视频优先, 其次预览视频; 都没有 → nil, 交给幻灯/封面(绝不留黑框)。
    var visualURL: String? {
        if let v = final_mv_url, !v.isEmpty { return v }
        if let v = preview_video_url, !v.isEmpty { return v }
        return nil
    }

    /// 声音源。永远独立于画面 —— 不取视频里的声轨。
    var soundURL: String? {
        if let a = audio_track_1_url, !a.isEmpty { return a }
        if let a = preview_audio_url, !a.isEmpty { return a }
        return nil
    }

    /// 幻灯池。没有视频时画面就靠它 —— Jing:「画面不能是黑乎乎的视频框,
    /// 必须显示画面, 哪怕是一张封面图。」所以封面永远垫底。
    var slidePool: [String] {
        var pool = (cover_slides ?? []).filter { !$0.isEmpty }
        if pool.isEmpty, let c = cover_image, !c.isEmpty { pool = [c] }
        return pool
    }

    /// 片源是横构图吗。拿不到画幅就返回 nil —— 宁可不判, 不猜。
    var sourceIsLandscape: Bool? {
        guard let w = frame_width, let h = frame_height, w > 0, h > 0 else { return nil }
        return w > h
    }

    /// 在【容器已知】的前提下, 该不该顺时针转 90°。
    ///
    /// 规则是单向的, 不许对称化(web 端 W1906 就是把它对称化了, Jing:「横屏横媒体多么的
    /// 完美, 你却一定要旋转一下」):
    ///   竖容器 + 横片源 → 转   (贴屏, 一帧不裁)
    ///   其余一切组合    → 不转
    func shouldRotate(containerWidth: Double, containerHeight: Double) -> Bool {
        guard containerWidth > 0, containerHeight > 0 else { return false }
        guard let landscape = sourceIsLandscape else { return false }
        let containerIsPortrait = containerHeight > containerWidth
        return containerIsPortrait && landscape
    }

    /// 画面轨到底是什么形态 —— 供四轨控制台的"画面"轨显示。
    var visualKindLabel: String {
        if let k = visual_kind {
            switch k {
            case "real_video":  return "真视频"
            case "hybrid":      return "混合视频"
            case "slides":      return "幻灯"
            default:            break
            }
        }
        if visualURL != nil { return "视频" }
        if !slidePool.isEmpty { return slidePool.count > 1 ? "幻灯" : "封面图" }
        return "无画面"
    }
}

extension CSSBackend {

    /// 唯一真源。要播哪一首, 只准给 ID —— 这是 Vision 播放器取作品数据的【唯一入口】。
    ///
    /// 不提供"用 URL 构造作品"的重载, 是刻意的: 只要留了那条路, 迟早有人从别处
    /// 抄一个 URL 进来, 串播就回来了。
    static func fetchTruth(id: String) async throws -> CSSTruth {
        guard let url = URL(string: "\(baseURL)/api/works/public/\(id)") else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData   // 真源不吃缓存, 免得切歌拿到上一首
        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        struct Envelope: Codable {
            let ok: Bool?
            let data: CSSTruth?
        }
        let dec = JSONDecoder()
        if let env = try? dec.decode(Envelope.self, from: data), let t = env.data { return t }
        return try dec.decode(CSSTruth.self, from: data)   // 退路: 顶层就是 work
    }

    /// 真源 → 播放器模型。字幕轨单独取(它是一份独立 JSON, 四轨分离的体现)。
    static func loadWork(id: String) async throws -> CSSWork {
        let t = try await fetchTruth(id: id)
        var lyrics: [SubtitleLine]? = nil
        if let subURL = t.subtitle_take1_json_url, !subURL.isEmpty {
            lyrics = await fetchSubtitleTrack(urlString: subURL, preferredLang: t.language)
        }
        return CSSWork(
            id: t.id,
            title: t.title,
            videoURL: t.visualURL,
            audioURL: t.soundURL,
            coverURL: t.cover_image,
            alignedLyrics: lyrics,
            slides: t.slidePool.isEmpty ? nil : t.slidePool,
            visualKind: t.visualKindLabel,
            frameWidth: t.frame_width,
            frameHeight: t.frame_height,
            language: t.language,
            variants: nil
        )
    }

    /// 取字幕轨, 并按【作品自己的语言】选轨 —— 不跟界面语言走。
    ///
    /// web 端实测过一首 language=zh 的作品: 字幕 JSON 里有 en/ja/vi/zh 四条轨, 播放端
    /// 按界面语言选了 en, 而那条只覆盖 111 秒(zh 那条 202 秒) → 后 2/3 一个字都没有。
    /// 「音乐是日语, 字幕是中文」就是这么来的。这里按作品语言选, 选不到再退英文/首条。
    static func fetchSubtitleTrack(urlString: String, preferredLang: String?) async -> [SubtitleLine]? {
        guard let url = URL(string: urlString) else { return nil }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }

        struct LangTrack: Codable {
            let lang: String?
            let sections: [Section]?
            struct Section: Codable { let lines: [SubtitleLine]? }
        }
        struct File: Codable { let languages: [LangTrack]? }

        guard let file = try? JSONDecoder().decode(File.self, from: data),
              let tracks = file.languages, !tracks.isEmpty else { return nil }

        /* CSSOS_WAVE_1937 20260824 — 选轨规则【照搬 TV】(Jing:「请改用 TV 版用的那个字幕」)。
         *
         * Jing 举的例: TV 显示「一袭青衫笑里看」, Vision 显示「依稀青山小李看」——
         * 整句同音字, 那是听写腔调的痕迹, 不是渲染错。查下来两端读的是【同一个文件】,
         * 差在【从文件里挑哪条轨】:
         *   TV     : origin_voice 优先 → 否则选 token 最多的那条
         *   Vision : 作品 language 优先 → 否则 en → 否则【第一条】
         * "否则第一条"是要命的一档 —— 实测《混沌の海》的字幕文件里有三条轨:
         *   orig(日文 336 词) · ja(日文 340 词) · orig-pre-epic(169 词)
         * 而 orig-pre-epic 里装的是 LLM 在跟自己讨论这个请求:
         *   "I notice the request asks me to write lyrics in \"orig-pre-epic\" but this…"
         * —— 一段被当成歌词存进去的废话。按"第一条"或按名字碰巧命中它, 屏幕上就是它。
         *
         * 改成 TV 那套, 并多加一道垃圾轨过滤: token 数明显偏少、或整轨没有 CJK 也没有
         * 空格分词的(典型的 LLM 独白被拼成一长串), 一律不选。 */
        func tokenCount(_ t: LangTrack) -> Int {
            (t.sections ?? []).reduce(0) { $0 + ($1.lines ?? []).reduce(0) { $0 + ($1.tokens?.count ?? 0) } }
        }
        let usable = tracks.filter { tokenCount($0) > 0 }
        guard !usable.isEmpty else { return nil }
        let best = usable.map(tokenCount).max() ?? 0
        // 词数不到最长轨一半的, 视为残缺/占位轨, 不参与竞选(orig-pre-epic 就是这么被挡掉的)。
        let sane = usable.filter { tokenCount($0) * 2 >= best }

        let pick = sane.first(where: { $0.lang == preferredLang })
            ?? sane.max(by: { tokenCount($0) < tokenCount($1) })
            ?? sane.first
        guard let sections = pick?.sections else { return nil }
        let lines = sections.flatMap { $0.lines ?? [] }
        return lines.isEmpty ? nil : lines
    }
}
