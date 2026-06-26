// CSS Watch — 后端桥接(复用 cssOS 公开 market + CDN 字幕 JSON, 无需鉴权)。
import Foundation

enum WatchBackend {
    static let base = "https://cssstudio.app"
    static let cdn = "https://cdn.cssstudio.app"

    /// 拉公开作品(有音频的), 给手表"只欣赏"用。
    static func fetchWorks(limit: Int = 20) async -> [CSSWatchWork] {
        guard let url = URL(string: "\(base)/api/works/market?limit=\(limit)") else { return [] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let works = (obj["data"] as? [String: Any])?["works"] as? [[String: Any]] else { return [] }
        return works.compactMap { w in
            let id = (w["id"] as? String) ?? ""
            guard !id.isEmpty else { return nil }
            let title = (w["title"] as? String) ?? "—"
            let cover = (w["cover_image"] as? String) ?? (w["preview_image_url"] as? String) ?? ""
            let audio = ((w["audio_track_1_url"] as? String).flatMap { $0.isEmpty ? nil : $0 })
                ?? (w["preview_audio_url"] as? String) ?? ""
            guard !audio.isEmpty else { return nil }
            let dur = (w["duration_secs"] as? Int) ?? Int((w["duration_secs"] as? Double) ?? 0)
            return CSSWatchWork(id: id, title: title, coverURL: cover, audioURL: audio, durationSecs: dur)
        }
    }

    /// 拉该作品母语逐字字幕(subtitle JSON)。
    static func fetchLines(workID: String) async -> [WSubLine] {
        for take in ["take1", "take2"] {
            guard let url = URL(string: "\(cdn)/works/\(workID)/subtitle-\(take).json"),
                  let (data, _) = try? await URLSession.shared.data(from: url),
                  let doc = try? JSONDecoder().decode(SubDoc.self, from: data),
                  let langs = doc.languages, !langs.isEmpty else { continue }
            let lang = langs.first(where: { ($0.lang ?? "") == "orig" }) ?? langs.first
            let lines = (lang?.sections ?? []).flatMap { $0.lines ?? [] }
            if !lines.isEmpty { return lines }
        }
        return []
    }

    private struct SubDoc: Codable { let languages: [LB]? }
    private struct LB: Codable { let lang: String?; let sections: [SS]? }
    private struct SS: Codable { let lines: [WSubLine]? }
}
