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

    // CSSOS_WAVE_1560 — 数字演员目录(套用桌面 /api/actors)。origin: synthetic(Original)/civilization(Legends)/real_person;
    //   premium=只看付费; owned=只看我建; archetype=戏路大类; search=名字/文明/人设。gender 在客户端过滤(后端无此参)。
    private struct ActorsEnvelope: Decodable {
        let data: Payload?
        struct Payload: Decodable { let actors: [CSSActor]? }
    }
    static func fetchActors(origin: String = "", premium: Bool = false, owned: Bool = false,
                            archetype: String = "", search: String = "", limit: Int = 200) async -> [CSSActor] {
        var comps = URLComponents(string: "\(baseURL)/api/actors")
        var items: [URLQueryItem] = [URLQueryItem(name: "limit", value: String(limit))]
        if !origin.isEmpty { items.append(URLQueryItem(name: "origin", value: origin)) }
        if premium { items.append(URLQueryItem(name: "premium", value: "1")) }
        if owned { items.append(URLQueryItem(name: "owned", value: "1")) }
        if !archetype.isEmpty { items.append(URLQueryItem(name: "archetype", value: archetype)) }
        if !search.isEmpty { items.append(URLQueryItem(name: "search", value: search)) }
        comps?.queryItems = items
        guard let url = comps?.url else { return [] }
        do {
            // URLSession.shared 的 HTTPCookieStorage 自动带上 cssos_session cookie(owned=1 才需登录; 公开浏览无需)。
            let (data, _) = try await URLSession.shared.data(from: url)
            if let env = try? JSONDecoder().decode(ActorsEnvelope.self, from: data), let list = env.data?.actors {
                return list
            }
        } catch { print("[CSSBackend] fetchActors failed:", error) }
        return []
    }

    // CSSOS_WAVE_1560 — 导演入口(套用桌面端): ✨起草标题+梗概 / 系统荐角。
    struct DirectorDraft: Decodable { let title: String?; let synopsis: String? }
    /// POST /api/director/synopsis {title,civilization} → {title,synopsis}(需登录)。
    static func directorDraft(title: String, civ: String) async -> DirectorDraft? {
        guard let url = URL(string: "\(baseURL)/api/director/synopsis") else { return nil }
        var req = URLRequest(url: url); req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["title": title, "civilization": civ])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return try? JSONDecoder().decode(DirectorDraft.self, from: data)
        } catch { print("[CSSBackend] directorDraft failed:", error); return nil }
    }

    struct CastSlot: Decodable, Identifiable {
        let role: String
        let alignment: String?
        let candidates: [CSSActor]
        var id: String { role }
    }
    private struct RecommendEnvelope: Decodable { let results: [CastSlot]? }
    /// POST /api/cast/recommend {format,civilization} → 每个角色槽的候选(同文明/戏路优先)。
    static func castRecommend(format: String, civ: String) async -> [CastSlot] {
        guard let url = URL(string: "\(baseURL)/api/cast/recommend") else { return [] }
        var req = URLRequest(url: url); req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["format": format, "civilization": civ])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return (try? JSONDecoder().decode(RecommendEnvelope.self, from: data))?.results ?? []
        } catch { print("[CSSBackend] castRecommend failed:", error); return [] }
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
        // W1561 — Jing「找回栏尾创作卡 + 联动」: 每栏末尾追加一张创作尾卡; 通用栏=自由选戏路,
        //   类型栏=锁定该栏戏路(在哪栏创作即该类型, 成品自动归入该栏)。
        func rail(_ id: String, _ title: String, _ icon: String, _ items: [CSSWork], min: Int = 1, create: String = "") {
            guard items.count >= min else { return }
            rails.append(CSSRail(id: id, title: title, works: items + [CSSWork.createCard(create)], icon: icon))
        }
        // ① Today's Picks = 系统推荐: 用后端原生序(置顶/活媒体/curation 在前), 这才是"算法推荐"。
        rail("today", "Today's Picks", "sparkles", works)
        // ② For You — 严格从新到旧(W1281: 后端"媒体优先"档会把老成品顶到真正最新前面 → 客户端按 created_at 重排)。
        rail("foryou", "For You", "flame.fill", works.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") })
        // ③ Most Played — 占位排序(后端暂无播放数; TODO 接 play_count)。
        rail("most-played", "Most Played", "chart.bar.fill", works.sorted { $0.id.hashValue > $1.id.hashValue })
        // CSSOS_WAVE_1560 — Jing「右栏 1:1 映射侧栏所有分类(除 Home), 哪怕只有一个预告片; 空分类
        //   也显示占位卡, 绝不隐藏」。侧栏顺序: 收藏 / MV / Opera / Trilogy / Short Drama / Series / Film。
        //   type-栏尾卡锁定该栏戏路(format); 空栏也带尾卡 → 可创作出该栏第一个作品。
        func categoryRail(_ key: String, _ title: String, _ icon: String, _ items: [CSSWork], format: String, empty: String) {
            let base = items.isEmpty ? [CSSWork.comingSoon(empty)] : items
            rails.append(CSSRail(id: "cat-\(key)", title: title, works: base + [CSSWork.createCard(format)], icon: icon))
        }
        func ofType(_ types: [String]) -> [CSSWork] {
            works.filter { types.contains(($0.workType ?? "").lowercased()) }
        }
        categoryRail("favorites", "My Favorites", "heart.fill",
                     works.filter { $0.isOwned }, format: "", empty: "Tap ♥ on any work to save it here")
        categoryRail("mv",        "MV",           "music.note",
                     ofType(["single", "song", "mv"]), format: "single", empty: "More coming soon")
        categoryRail("trilogy",   "Trilogies",    "books.vertical.fill",
                     ofType(["triptych", "trilogy"]), format: "triptych", empty: "More coming soon")
        categoryRail("opera",     "Operas",       "theatermasks.fill",
                     ofType(["opera"]), format: "opera", empty: "More coming soon")
        categoryRail("shortplay", "Short Dramas", "film.fill",
                     ofType(["shortplay", "short-play", "drama"]), format: "shortplay", empty: "More coming soon")
        categoryRail("series",    "Series",       "tv.fill",
                     ofType(["series"]), format: "series", empty: "More coming soon")
        categoryRail("film",      "Movies",       "film.stack.fill",
                     ofType(["film", "movie"]), format: "film", empty: "More coming soon")
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
