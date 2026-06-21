// CSSOS_WAVE_936 — 后端桥接(复用现有 cssOS API)。骨架阶段: 拉一首作品 + 它的逐字字幕。
// 真机联调前可先用 sampleWork() 离线样本验证银幕/字幕渲染。

import Foundation

enum CSSBackend {
    /// 线上后端。真机/模拟器都可直连(只读 works 接口, 无需鉴权即可拿公开作品)。
    static let baseURL = "https://cssstudio.app"

    /// 拉单首作品(含 aligned_lyrics)。后端: GET /api/works/:id → { data: { work: {...} } }。
    static func fetchWork(id: String) async throws -> CSSWork {
        guard let url = URL(string: "\(baseURL)/api/works/\(id)") else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        // 后端把 work 包在 data.work / data / work 里(web 端 getApiData 同款容错)。
        let decoder = JSONDecoder()
        if let env = try? decoder.decode(WorkEnvelope.self, from: data),
           let w = env.resolvedWork {
            return w
        }
        // 退路: 顶层就是 work。
        return try decoder.decode(CSSWork.self, from: data)
    }

    private struct WorkEnvelope: Codable {
        let data: DataField?
        let work: CSSWork?
        struct DataField: Codable {
            let work: CSSWork?
        }
        var resolvedWork: CSSWork? { data?.work ?? work }
    }

    /// 我们自己的旗舰《混沌の海 · The Sea of Chaos》。第一束光就放它。
    static let sampleWorkID = "100fee69-4d74-4744-a4c0-f3dc88a4ea52"

    /// 启动默认 = 我们的旗舰《混沌の海》, 真实可播放地址(market 取得; /api/works/:id 在 :3000 不存在)。
    /// 画面=final_mv_url(静音视觉), 声音=独立音轨 a1.m4a(画音分层铁律)。
    /// 情绪字幕需 aligned_lyrics(market 不带, 下一里程碑接专门端点), 暂 nil → 先放真 MV+真声音。
    static func defaultWork() async -> CSSWork {
        let video = "https://cdn.cssstudio.app/artifacts/mv/mv_1777776785412.mp4"
        let audio = "https://cdn.cssstudio.app/artifacts/audio/aud_100fee69-4d74-4744-a4c0-f3dc88a4ea52.a1.m4a"
        // W950 — 多银幕: 拉所有语言轨, 母语(orig)做主屏, 其余语言各占一段环绕弧。
        let langs = await fetchLanguageVariants(workID: sampleWorkID, video: video, audio: audio)
        let origLines = langs.first(where: { $0.id == "orig" })?.alignedLyrics
            ?? langs.first?.alignedLyrics
        let others = langs.filter { $0.id != "orig" }   // 非母语 → variants
        return CSSWork(
            id: sampleWorkID,
            title: "混沌の海 · The Sea of Chaos",
            videoURL: video,
            audioURL: audio,
            coverURL: "https://cssstudio.app/api/cover-webp/898cabba840c128c6517821a233ac19b.webp",
            alignedLyrics: origLines,
            variants: others.isEmpty ? nil : others
        )
    }

    /// W950 — 把字幕 JSON 里的每条语言轨做成一个变体(画面同源, 字幕按语言, 音频暂同源)。
    static func fetchLanguageVariants(workID: String, video: String, audio: String) async -> [CSSVariant] {
        for take in ["take1", "take2"] {
            guard let url = URL(string: "https://cdn.cssstudio.app/works/\(workID)/subtitle-\(take).json"),
                  let (data, _) = try? await URLSession.shared.data(from: url),
                  let doc = try? JSONDecoder().decode(SubtitleDoc.self, from: data),
                  let langs = doc.languages, !langs.isEmpty else { continue }
            var out: [CSSVariant] = []
            for lb in langs {
                let code = (lb.lang ?? "").trimmingCharacters(in: .whitespaces)
                guard !code.isEmpty else { continue }
                let lines = (lb.sections ?? []).flatMap { $0.lines ?? [] }.filter { l in
                    let t = l.resolvedText.trimmingCharacters(in: .whitespaces)
                    if t.isEmpty { return false }
                    if t.hasPrefix("[") || t.hasPrefix("【") || t.hasPrefix("#") { return false }
                    return true
                }
                if lines.isEmpty { continue }
                out.append(CSSVariant(id: code, label: langLabel(code),
                                      videoURL: video, audioURL: audio,
                                      alignedLyrics: lines, angleDegrees: 0))
            }
            if !out.isEmpty { return out }
        }
        return []
    }

    private static func langLabel(_ code: String) -> String {
        switch code.lowercased() {
        case "orig": return "母语 · Orig"
        case "ja", "japanese", "日本語": return "日本語"
        case "en", "english": return "English"
        case "zh", "chinese", "中文": return "中文"
        case "ko", "korean": return "한국어"
        case "es": return "Español"
        case "fr": return "Français"
        default: return code
        }
    }

    // CSSOS_WAVE_942 — 真逐字情绪字幕: 拉 CDN 上的对齐 JSON(whisperX 演出级对齐)。
    // 结构: { languages:[ { lang, sections:[ { lines:[ { text,t_start,t_end,tokens:[{char,t_start,t_end,emotion,emotion_intensity}] } ] } ] } ] }
    // 与我们的 SubtitleLine/SubtitleToken 完全一致, 摊平 sections→lines 即可。
    static func fetchAlignedLyrics(workID: String) async -> [SubtitleLine]? {
        for take in ["take1", "take2"] {
            guard let url = URL(string: "https://cdn.cssstudio.app/works/\(workID)/subtitle-\(take).json"),
                  let (data, _) = try? await URLSession.shared.data(from: url),
                  let doc = try? JSONDecoder().decode(SubtitleDoc.self, from: data) else { continue }
            // 优先母语轨 "orig", 否则第一条。
            let lang = doc.languages?.first(where: { ($0.lang ?? "") == "orig" }) ?? doc.languages?.first
            let lines = (lang?.sections ?? []).flatMap { $0.lines ?? [] }.filter { line in
                let t = line.resolvedText.trimmingCharacters(in: .whitespaces)
                if t.isEmpty { return false }
                // 丢结构标记行([Music...] / 【副歌】 等)。
                if t.hasPrefix("[") || t.hasPrefix("【") || t.hasPrefix("#") { return false }
                return true
            }
            if !lines.isEmpty { return lines }
        }
        return nil
    }

    private struct SubtitleDoc: Codable { let languages: [LangBlock]? }
    private struct LangBlock: Codable { let lang: String?; let sections: [SubSection]? }
    private struct SubSection: Codable { let lines: [SubtitleLine]? }

    /// W976 — AI 生成 360 场景: 后端 POST /api/immersive/scene {prompt} → 跑 Skybox(text→等距柱状 360)
    /// → rehost 到 CDN → 返回 { url }。客户端拿到 URL 设给 settings.customEnvURL 当天空盒。
    /// 合法: 原创生成, 版权归平台; 绝不用哈利波特/权游等他人 IP。
    static func generateScene(prompt: String) async -> String? {
        guard let url = URL(string: "\(baseURL)/api/immersive/scene") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["prompt": prompt])
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let u = obj["url"] as? String, !u.isEmpty else { return nil }
        return u
    }

    /// W978 — AI 助理创作: prompt → 生成 MV → 返回可播放 work。真实管线下一轮接:
    /// POST /api/agent/chat {message} → 解析 ```cssos-seed → 跑 MV 管线 → 轮询 workId → fetchWork。
    /// 现接桩返回 nil(UI 已就位, 不阻塞)。
    /// W1064 — 咒语创作(需登录, CSSAuth 提供 session): 多部走 agent/chat 服务端 create_work,
    ///   单曲走 /api/works/create-single(服务端串歌词+唱+封面)。两者都返回 work_id, 再统一
    ///   【轮询 market】等可播(/api/works/:id 在 :3000 是 404, 故走 market 这条可靠路)。
    static func createFromPrompt(_ prompt: String) async -> CSSWork? {
        let multiKeys = ["三部曲", "trilogy", "歌剧", "opera", "短剧", "连续剧", "电视剧", "series", "电影", "film", "movie"]
        let isMulti = multiKeys.contains { prompt.localizedCaseInsensitiveContains($0) }
        let workId = isMulti ? await startMulti(prompt) : await startSingle(prompt)
        guard let wid = workId, !wid.isEmpty else { return nil }
        return await pollMarketForWork(wid)
    }

    /// 单曲: POST /api/works/create-single → 立即拿 work_id(后台生成)。
    private static func startSingle(_ prompt: String) async -> String? {
        guard let url = URL(string: "\(baseURL)/api/works/create-single") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let lang = Locale.current.identifier.lowercased().hasPrefix("zh") ? "zh" : "en"
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["prompt": prompt, "language": lang])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            return obj?["work_id"] as? String
        } catch { return nil }
    }

    /// 多部: agent/chat 的 create_work 服务端生成, 取首个 work_card.work_id。
    private static func startMulti(_ prompt: String) async -> String? {
        guard let url = URL(string: "\(baseURL)/api/agent/chat") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 220
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["message": prompt, "ui_locale": Locale.current.identifier])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            if let cards = obj?["work_cards"] as? [[String: Any]] {
                if let id = (cards.first?["work_id"] as? String) ?? (cards.first?["id"] as? String), !id.isEmpty { return id }
            }
            if let tcs = obj?["tool_calls"] as? [[String: Any]] {
                for tc in tcs {
                    if let cards = tc["work_cards"] as? [[String: Any]], let id = cards.first?["work_id"] as? String { return id }
                }
            }
            return nil
        } catch { return nil }
    }

    /// 轮询 market(可靠可播路径)直到该 work 出现且有音/视频(最多 ~5 分钟)。
    private static func pollMarketForWork(_ wid: String) async -> CSSWork? {
        for _ in 0..<60 {
            let items = await fetchShelf("for-you", limit: 40)
            if let hit = items.first(where: { $0.id == wid }), !(hit.videoURL.isEmpty && hit.audioURL.isEmpty) {
                return hit.toWork()
            }
            try? await Task.sleep(nanoseconds: 5_000_000_000)
        }
        return nil
    }

    /// 离线占位 —— 拉不到网络时也能验证银幕/字幕渲染。
    static func offlineFallback() -> CSSWork {
        CSSWork(
            id: "sample",
            title: "混沌の海 · The Sea of Chaos",
            // 离线兜底用 Apple 官方公开测试流(保证能放)。在线时会被真作品覆盖。
            videoURL: "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8",
            audioURL: nil,
            alignedLyrics: [
                SubtitleLine(text: "Take me back to those nights we knew", line: nil,
                             tStart: 1000, tEnd: 4200, tokens: nil),
                SubtitleLine(text: "ひとすじの光、名をさがす", line: nil,
                             tStart: 4500, tEnd: 8200, tokens: nil),
                SubtitleLine(text: "混沌の海を越えて", line: nil,
                             tStart: 8600, tEnd: 12000, tokens: nil)
            ],
            variants: nil
        )
    }

    /// 兼容旧调用名(同步, 返回离线占位; 优先用 defaultWork() 拿真作品)。
    static func sampleWork() -> CSSWork { offlineFallback() }

    // ── CSSOS_WAVE_1059 — Cover Arc 大厅: 拉作品列表填货架 ──────────────────────
    struct LobbyItem: Identifiable {
        let id: String
        let title: String
        let coverURL: String
        let meta: String
        let durSecs: Int
        let createdAt: String      // 输出日期(已格式化 yyyy-MM-dd, 空=未知)
        let videoURL: String
        let audioURL: String
        func toWork() -> CSSWork {
            CSSWork(id: id, title: title,
                    videoURL: videoURL.isEmpty ? nil : videoURL,
                    audioURL: audioURL.isEmpty ? nil : audioURL,
                    coverURL: coverURL.isEmpty ? nil : coverURL,
                    alignedLyrics: nil, variants: nil)
        }
    }

    /// 拉货架作品(公开 market 列表, 无需鉴权)。shelf 暂统一走 market(后端日后可按 shelf 细分)。
    static func fetchShelf(_ shelf: String = "for-you", limit: Int = 24) async -> [LobbyItem] {
        guard let url = URL(string: "\(baseURL)/api/works/market?limit=\(limit)") else { return [] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let works = ((obj?["data"] as? [String: Any])?["works"] as? [[String: Any]]) ?? []
            return works.compactMap { w in
                let id = (w["id"] as? String) ?? ""
                if id.isEmpty { return nil }
                let title = (w["title"] as? String) ?? "—"
                let cover = (w["cover_image"] as? String) ?? (w["preview_image_url"] as? String) ?? ""
                let style = (w["style"] as? String) ?? ""
                let wt = (w["work_type"] as? String) ?? ""
                let dur = (w["duration_secs"] as? Int) ?? Int((w["duration_secs"] as? Double) ?? 0)
                let video = (w["final_mv_url"] as? String) ?? (w["preview_video_url"] as? String) ?? ""
                let audio = (w["audio_track_1_url"] as? String) ?? ""
                let meta = [wt, style].filter { !$0.isEmpty }.joined(separator: " · ")
                let createdRaw = (w["created_at"] as? String) ?? (w["createdAt"] as? String) ?? (w["release_date"] as? String) ?? ""
                let created = shortDate(createdRaw)
                return LobbyItem(id: id, title: title, coverURL: cover, meta: meta,
                                 durSecs: dur, createdAt: created, videoURL: video, audioURL: audio)
            }
        } catch { return [] }
    }

    /// ISO8601 / "yyyy-MM-dd…" 原始时间串 → 短日期 yyyy-MM-dd(解析失败回退取前10位)。
    static func shortDate(_ raw: String) -> String {
        if raw.isEmpty { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.dateFormat = "MMM d, yyyy"      // 美国格式 月日年, 如 "Jun 15, 2026"
        if let d = iso.date(from: raw) { return out.string(from: d) }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return out.string(from: d) }
        // 回退: 把 "2026-06-15…" 前10位转成美国格式
        let inFmt = DateFormatter(); inFmt.locale = Locale(identifier: "en_US_POSIX"); inFmt.dateFormat = "yyyy-MM-dd"
        if let d = inFmt.date(from: String(raw.prefix(10))) { return out.string(from: d) }
        return String(raw.prefix(10))
    }
}
