// CSSOS_WAVE_1172 — 后端桥接(复用现有 cssOS API)。骨架阶段: 拉一批公开作品 + 开箱即播旗舰。
// 只读公开接口, 无需鉴权。真机/模拟器都可直连。

import Foundation

enum CSSBackend {
    /// 线上后端。
    static let baseURL = "https://cssstudio.app"

    // MARK: - 开箱即播的旗舰样本(与 visionOS 骨架同一首《混沌の海》, 真实可播放地址)。
    static let flagship = CSSWork(
        id: "100fee69-4d74-4744-a4c0-f3dc88a4ea52",
        title: "混沌の海 · The Sea of Chaos",
        videoURL: "https://cdn.cssstudio.app/artifacts/mv/mv_1777776785412.mp4",
        audioURL: "https://cdn.cssstudio.app/artifacts/audio/aud_100fee69-4d74-4744-a4c0-f3dc88a4ea52.a1.m4a",
        coverURL: "https://cssstudio.app/api/cover-webp/898cabba840c128c6517821a233ac19b.webp",
        durationSecs: 307
    )

    /// 拉「为你创作 / 市场」一批公开作品做大屏网格。失败则退回旗舰单卡, 保证骨架永远有东西播。
    static func fetchFeed(limit: Int = 48) async -> [CSSWork] {   // W1287 — 拉多点, 确保新作(三部曲等)进来供 For You 按时间排
        guard let url = URL(string: "\(baseURL)/api/works/market?limit=\(limit)") else { return [flagship] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            // 后端容错: { works: [...] } / { data: { works: [...] } } / 顶层数组。
            if let env = try? decoder.decode(FeedEnvelope.self, from: data), let list = env.resolved, !list.isEmpty {
                return list
            }
            if let arr = try? decoder.decode([CSSWork].self, from: data), !arr.isEmpty {
                return arr
            }
        } catch {
            print("[CSSBackend] fetchFeed failed:", error)
        }
        return [flagship]
    }

    /// W1279 — 全库搜索(后端 /api/works/market?q= 已支持: 标题/作者/风格/歌词 ILIKE)。
    static func searchWorks(_ q: String, limit: Int = 40) async -> [CSSWork] {
        let trimmed = q.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let enc = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)/api/works/market?q=\(enc)&limit=\(limit)") else { return [] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            if let env = try? decoder.decode(FeedEnvelope.self, from: data), let list = env.resolved { return list }
            if let arr = try? decoder.decode([CSSWork].self, from: data) { return arr }
        } catch { print("[CSSBackend] searchWorks failed:", error) }
        return []
    }

    /// CSSOS_WAVE_1227 — 把一批作品分成 Apple TV 标准多行 rails(不再一堵扁平卡片墙)。
    /// For You(全部)/ Fresh(最新)/ 按 work_type(歌剧/电影/剧集/三部曲, 每类≥3才出)。
    static func buildRails(_ works: [CSSWork]) -> [CSSRail] {
        guard !works.isEmpty else { return [] }
        var rails: [CSSRail] = []
        // W1274 — Jing: Today's Picks 第一、For You 第二; 每栏标题带 SF Symbol 图标; 末尾追加创作尾卡。
        func rail(_ id: String, _ title: String, _ icon: String, _ items: [CSSWork], min: Int = 1) {
            guard items.count >= min else { return }
            rails.append(CSSRail(id: id, title: title, works: items, icon: icon))   // W1367 — tvOS 纯欣赏: 行尾不再加创作卡
        }
        // ① Today's Picks = 系统推荐: 用后端原生序(置顶/活媒体/curation 在前), 这才是"算法推荐"。
        rail("today", "Today's Picks", "sparkles", works)
        // ② For You — 严格从新到旧(W1281: 后端"媒体优先"档会把老成品顶到真正最新前面 → 客户端按 created_at 重排)。
        rail("foryou", "For You", "flame.fill", works.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") })
        // ③ My Favorites — 本人有订单(收藏/已购); 空则不显。
        rail("favorites", "My Favorites", "heart.fill", works.filter { $0.isOwned })
        // ④ Most Played — 占位排序(后端暂无播放数; TODO 接 play_count)。
        rail("most-played", "Most Played", "chart.bar.fill", works.sorted { $0.id.hashValue > $1.id.hashValue })
        // ⑤~⑨ 按类型(图标对齐侧栏)。
        let typeDefs: [(key: String, title: String, icon: String, match: [String])] = [
            ("triptych", "Trilogies",    "books.vertical.fill", ["triptych", "trilogy"]),
            ("opera",    "Operas",        "theatermasks.fill",   ["opera"]),
            ("shortplay","Short Dramas",  "film.fill",           ["shortplay", "short-play", "drama"]),
            ("series",   "TV Series",     "tv.fill",             ["series"]),
            ("film",     "Films",         "film.stack.fill",     ["film", "movie"]),
        ]
        for def in typeDefs {
            rail(def.key, def.title, def.icon, works.filter { def.match.contains(($0.workType ?? "").lowercased()) })
        }
        return rails
    }

    /// 拉单首作品的可播放地址(市场卡片常不带 final_mv_url → 用此端点补全)。失败则原样返回。
    static func hydrate(_ work: CSSWork) async -> CSSWork {
        guard work.videoURL == nil || work.audioURL == nil,
              let url = URL(string: "\(baseURL)/api/works/\(work.id)") else { return work }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoder = JSONDecoder()
            if let env = try? decoder.decode(WorkEnvelope.self, from: data), let w = env.resolved {
                var merged = work
                merged.videoURL = merged.videoURL ?? w.videoURL
                merged.audioURL = merged.audioURL ?? w.audioURL
                merged.coverURL = merged.coverURL ?? w.coverURL
                merged.durationSecs = merged.durationSecs ?? w.durationSecs
                return merged
            }
        } catch {
            print("[CSSBackend] hydrate failed:", error)
        }
        return work
    }

    // MARK: - W1247 逐字情绪字幕
    /// 选定语言的字幕(扁平到行)+ 主题 emoji。
    struct CSSSubtitleData {
        let lang: String
        let lines: [CSSSubLine]
        let themeEmoji: [String]
    }

    /// 拉某作品的逐字情绪字幕。language-tracks → subtitle JSON → 选语言(母语优先, 否则 token 最多的)。
    static func fetchSubtitles(workId: String) async -> CSSSubtitleData? {
        // 1) language-tracks 拿 subtitle JSON URL + 母语。
        guard let ltURL = URL(string: "\(baseURL)/api/works/\(workId)/language-tracks") else { return nil }
        var jsonURLStr: String?
        var originLang: String?
        do {
            let (data, _) = try await URLSession.shared.data(from: ltURL)
            let lt = try JSONDecoder().decode(LanguageTracksEnvelope.self, from: data)
            originLang = lt.origin_voice
            jsonURLStr = lt.tracks?.first(where: { $0.subtitle_take1_json_url != nil })?.subtitle_take1_json_url
        } catch { print("[CSSBackend] language-tracks failed:", error) }
        // 兜底: 直接拼 CDN 路径。
        let urlStr = jsonURLStr ?? "https://cdn.cssstudio.app/works/\(workId)/subtitle-take1.json"
        guard let jsonURL = URL(string: urlStr) else { return nil }
        // 2) 拉字幕 JSON。
        do {
            let (data, _) = try await URLSession.shared.data(from: jsonURL)
            let doc = try JSONDecoder().decode(CSSSubtitleDoc.self, from: data)
            guard !doc.languages.isEmpty else { return nil }
            // 3) 选语言: 母语优先, 否则 token 最多的那门。
            func tokenCount(_ l: CSSSubLanguage) -> Int {
                l.sections.reduce(0) { $0 + $1.lines.reduce(0) { $0 + ($1.tokens?.count ?? 0) } }
            }
            let chosen = doc.languages.first(where: { $0.lang == originLang })
                ?? doc.languages.max(by: { tokenCount($0) < tokenCount($1) })
                ?? doc.languages[0]
            // 扁平到行(带 tokens 的)。
            let lines = chosen.sections.flatMap { $0.lines }
            return CSSSubtitleData(lang: chosen.lang, lines: lines, themeEmoji: doc.themeEmoji ?? [])
        } catch { print("[CSSBackend] subtitle JSON failed:", error) }
        return nil
    }

    private struct LanguageTracksEnvelope: Codable {
        let origin_voice: String?
        let tracks: [Track]?
        struct Track: Codable { let lang: String?; let subtitle_take1_json_url: String? }
    }

    // MARK: - W1364 多语言/多声线
    /// 一条可播的语言×声线轨(只取 ready 且有音频的)。
    struct CSSLangTrack: Identifiable {
        let lang: String          // orig / zh / ja / en …
        let voice: String         // auto / 具体声线
        let audioURL: String
        let subtitleURL: String?
        let isDefault: Bool
        var id: String { "\(lang)|\(voice)" }
        /// 胶囊显示名(母语锁定时给🔒)。i18n: 英文/语言原生缩写。
        var label: String {
            let base: String
            switch lang.lowercased() {
            case "orig": base = "Original"
            case "zh", "zh-cn", "zh-hans": base = "中文"
            case "ja": base = "日本語"
            case "en": base = "English"
            case "ko": base = "한국어"
            case "fr": base = "Français"
            case "es": base = "Español"
            case "de": base = "Deutsch"
            default: base = lang.uppercased()
            }
            return base
        }
    }

    private struct LangTracksFull: Codable {
        let origin_voice: String?
        let tracks: [T]?
        struct T: Codable {
            let lang: String?; let voice: String?; let status: String?
            let is_default: Bool?; let audio_url: String?; let subtitle_take1_json_url: String?
        }
    }

    /// 拉作品的全部可播语言×声线轨(给影院语言胶囊)。
    static func fetchLanguageTracks(workId: String) async -> [CSSLangTrack] {
        guard let url = URL(string: "\(baseURL)/api/works/\(workId)/language-tracks") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let env = try? JSONDecoder().decode(LangTracksFull.self, from: data),
              let ts = env.tracks else { return [] }
        return ts.compactMap { t in
            guard let lang = t.lang, let audio = t.audio_url, !audio.isEmpty,
                  (t.status ?? "ready") == "ready" else { return nil }
            return CSSLangTrack(lang: lang, voice: t.voice ?? "auto", audioURL: audio,
                                subtitleURL: t.subtitle_take1_json_url,
                                isDefault: t.is_default ?? false)
        }
    }

    /// 按指定字幕 JSON URL + 语言码取该语言的逐字字幕(语言切换用)。
    static func fetchSubtitle(jsonURL urlStr: String?, lang: String) async -> CSSSubtitleData? {
        let s = urlStr ?? ""
        guard let url = URL(string: s.isEmpty ? "x" : s) else { return nil }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let doc = try? JSONDecoder().decode(CSSSubtitleDoc.self, from: data),
              !doc.languages.isEmpty else { return nil }
        let chosen = doc.languages.first(where: { $0.lang == lang })
            ?? doc.languages[0]
        let lines = chosen.sections.flatMap { $0.lines }
        return CSSSubtitleData(lang: chosen.lang, lines: lines, themeEmoji: doc.themeEmoji ?? [])
    }

    // W1259 — 创作台: 把提示词发给后端 AI 助理(开始创作)。返回是否成功送达。
    /// W1548 — 创作意念 → agent。返回 { ok, intent }。intent=="ifilm" → 打开互动电影播放屏(Slice 3)。
    struct CastResult { let ok: Bool; let intent: String?; let ifilmId: String?; let reply: String? }
    static func castMV(prompt: String) async -> CastResult {
        guard let url = URL(string: "\(baseURL)/api/agent/chat") else { return CastResult(ok: false, intent: nil, ifilmId: nil, reply: nil) }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["message": prompt, "source": "csstv"])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let ok = (resp as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
            let j = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            return CastResult(ok: ok,
                              intent: j?["intent"] as? String,
                              ifilmId: j?["ifilm_id"] as? String,
                              reply: j?["reply"] as? String)
        } catch { print("[CSSBackend] castMV failed:", error) }
        return CastResult(ok: false, intent: nil, ifilmId: nil, reply: nil)
    }

    // MARK: - W1549 Slice 3 — 互动多线程电影(ifilm)客户端
    // 只读/公开(ifilm 端点无鉴权); /next 会触发生成(LLM 写 beat + TTS 声音 + seedance 视频备料),
    // 故播放屏用「▶ 开拍」显式起头, 用户按了才开始花钱(尊重「先不开拍」)。

    struct IFilmSession: Codable {
        var beats: [String]; var step: Int; var tension: Double; var seed: Int
        static let start = IFilmSession(beats: [], step: 0, tension: 0, seed: 0)
    }
    struct IFilmBeatOut: Codable { let thread: String?; let speaker: String?; let line: String?; let synopsis: String?; let video_prompt: String? }
    struct IFilmBeatVideo: Codable { let status: String?; let video_url: String? }
    struct IFilmNext: Codable {
        let ok: Bool?
        let beat: IFilmBeatOut?
        let reaction: String?
        let tension: Double?
        let converged: Bool?
        let ending_id: String?
        let ending_label: String?
        let voice_url: String?
        let beat_video: IFilmBeatVideo?
        let session: IFilmSession?
    }

    /// 推进一拍。gaze/gesture/utterance = 用户此刻的【微影响】(遥控方向/语音)。分钟级 → 长超时。
    static func ifilmNext(id: String, session: IFilmSession,
                          gaze: String? = nil, gesture: String? = nil, utterance: String? = nil) async -> IFilmNext? {
        guard let url = URL(string: "\(baseURL)/api/ifilm/\(id)/next") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 300
        var payload: [String: Any] = ["beats": session.beats, "step": session.step, "tension": session.tension, "seed": session.seed]
        if let g = gaze { payload["gaze"] = g }
        if let ge = gesture { payload["gesture"] = ge }
        if let u = utterance { payload["utterance"] = u }
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return try? JSONDecoder().decode(IFilmNext.self, from: data)
        } catch { print("[CSSBackend] ifilmNext failed:", error); return nil }
    }

    /// 轮询 beat 视频到 ready(懒渲染, seedance 分钟级)。返回可播 video_url;超时返回 nil(用封面/台词兜底)。
    static func ifilmBeatVideoReady(id: String, videoPrompt: String, tries: Int = 45) async -> String? {
        guard !videoPrompt.isEmpty, let url = URL(string: "\(baseURL)/api/ifilm/\(id)/beat-video") else { return nil }
        for _ in 0..<tries {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["video_prompt": videoPrompt])
            if let (data, _) = try? await URLSession.shared.data(for: req),
               let v = try? JSONDecoder().decode(IFilmBeatVideo.self, from: data),
               (v.status ?? "") == "ready", let u = v.video_url, !u.isEmpty {
                return u
            }
            try? await Task.sleep(nanoseconds: 4_000_000_000)  // 4s
        }
        return nil
    }

    private struct FeedEnvelope: Codable {
        let works: [CSSWork]?
        let data: DataField?
        struct DataField: Codable { let works: [CSSWork]? }
        var resolved: [CSSWork]? { works ?? data?.works }
    }
    private struct WorkEnvelope: Codable {
        let work: CSSWork?
        let data: DataField?
        struct DataField: Codable { let work: CSSWork? }
        var resolved: CSSWork? { work ?? data?.work }
    }
}
