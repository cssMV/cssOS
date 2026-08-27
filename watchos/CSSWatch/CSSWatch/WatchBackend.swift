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
        /* CSSOS_WAVE_1984f 20260826 — Jing:「Watch 端也检查一下。」
         * Watch 这边【没有】客户端重排(这点是对的, 三处别的端都栽了), 但它有另一个漏:
         * 只读顶层 works, 不看 children —— 而多部作品(三部曲/歌剧/剧集)的【根节点是个
         * 只有封面的容器】, 自己没有音频, 下面那句 guard !audio.isEmpty 会把它丢掉,
         * 分集又在 children 里从没被读过 → 整部作品在表上彻底消失。
         * 实测:《李清照·声声慢三部曲》根节点 audio_track_1_url / preview_audio_url 都是 null。
         * 修法: 先把树摊平(根 + 各分集), 再走原来的逐条映射 —— 有音频的分集就能上表,
         * 没音频的容器仍旧被 guard 丢掉, 原有行为不变。 */
        var flat: [[String: Any]] = []
        for w in works {
            flat.append(w)
            if let kids = w["children"] as? [[String: Any]] { flat.append(contentsOf: kids) }
        }
        return flat.compactMap { w in
            let id = (w["id"] as? String) ?? ""
            guard !id.isEmpty else { return nil }
            let title = (w["title"] as? String) ?? "—"
            let rawCover = (w["cover_image"] as? String) ?? (w["preview_image_url"] as? String) ?? ""
            // W1438 — 真机用原 webp(体积更小, watchOS7+ 支持); 仅【模拟器】走 jpg 代理(模拟器无 webp 解码器)。
            #if targetEnvironment(simulator)
            let cover = thumbJpg(rawCover)
            #else
            let cover = rawCover
            #endif
            let audio = ((w["audio_track_1_url"] as? String).flatMap { $0.isEmpty ? nil : $0 })
                ?? (w["preview_audio_url"] as? String) ?? ""
            guard !audio.isEmpty else { return nil }
            let dur = (w["duration_secs"] as? Int) ?? Int((w["duration_secs"] as? Double) ?? 0)
            return CSSWatchWork(id: id, title: title, coverURL: cover, audioURL: audio, durationSecs: dur)
        }
    }

    /// W1437 — 封面经 /api/img-thumb 转 jpg(避开 webp; 顺带缩到 ~390px 适配表盘、省流)。
    static func thumbJpg(_ raw: String, w: Int = 390) -> String {
        guard raw.hasPrefix("http"),
              let enc = raw.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return raw }
        return "\(base)/api/img-thumb?u=\(enc)&w=\(w)&fmt=jpg"
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
