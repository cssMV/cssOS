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
    static func fetchFeed(limit: Int = 24) async -> [CSSWork] {
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

    /// CSSOS_WAVE_1227 — 把一批作品分成 Apple TV 标准多行 rails(不再一堵扁平卡片墙)。
    /// For You(全部)/ Fresh(最新)/ 按 work_type(歌剧/电影/剧集/三部曲, 每类≥3才出)。
    static func buildRails(_ works: [CSSWork]) -> [CSSRail] {
        guard !works.isEmpty else { return [] }
        var rails: [CSSRail] = []
        // i18n: 英文默认, 绝不中文硬编码。
        rails.append(CSSRail(id: "foryou", title: "For You", works: works))
        if works.count > 6 {
            rails.append(CSSRail(id: "fresh", title: "Fresh", works: Array(works.prefix(18))))
        }
        let typeDefs: [(key: String, title: String, match: [String])] = [
            ("opera",    "Operas",    ["opera"]),
            ("film",     "Films",     ["film", "movie"]),
            ("series",   "Series",    ["series", "shortplay", "short-play", "drama"]),
            ("triptych", "Trilogies", ["triptych", "trilogy"]),
        ]
        for def in typeDefs {
            let group = works.filter { def.match.contains(($0.workType ?? "").lowercased()) }
            if group.count >= 3 {
                rails.append(CSSRail(id: def.key, title: def.title, works: group))
            }
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
