// CSSOS_WAVE_936 20260617 — Jing 愿景: Apple Vision Pro 原生沉浸影院(自建空间, 破除 Apple
// 视频沙盒门禁)。数据模型 —— 与 cssOS 后端对齐(works / 音视频 / 逐字情绪字幕时间轴)。
//
// 复用现有后端: GET /api/works/:id 返回 final_mv_url / audio_track_1_url / aligned_lyrics。
// aligned_lyrics 的结构与 web 端 app.emotion-subtitle-engine.js 完全一致(行 t_start/t_end ms,
// tokens[].char/text + t_start/t_end + emotion + emotion_intensity)。这里照搬, 之后 RealityKit
// 文字实体直接吃同一份时间轴 —— 字幕逻辑零重写。

import Foundation

/// 一首作品(MV)。字段映射 cssOS 后端 work 行(只取沉浸影院需要的)。
struct CSSWork: Codable, Identifiable {
    let id: String
    var title: String?
    /// 画面层(静音视觉视频)。
    var videoURL: String?
    /// 独立音轨(真声音, 画音分层铁律: 永不用视频声)。
    var audioURL: String?
    /// 封面图(可当沉浸环境背景 —— 用户的选择权 W954)。
    var coverURL: String?
    /// 逐字情绪字幕时间轴(可空 = 该作品还没对齐)。
    var alignedLyrics: [SubtitleLine]?

    /// CSSOS_WAVE_937 — 多银幕变体: Take 2 / 不同语言版。后端可在 work 里带 variants,
    /// 没有就只有主屏。每个变体一块环绕银幕。
    var variants: [CSSVariant]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case videoURL = "final_mv_url"
        case audioURL = "audio_track_1_url"
        case alignedLyrics = "aligned_lyrics"
        case variants
    }

    /// 组装环绕银幕清单: 主屏(正前 0°)+ 各变体(左右环绕)。
    /// 角度方案: 1 块=前; 2 块=前+右; 3 块=左/前/右; 更多=均分扇形。
    func surroundVariants() -> [CSSVariant] {
        var list: [CSSVariant] = [
            CSSVariant(id: "main", label: title ?? "Original",
                       videoURL: videoURL, audioURL: audioURL,
                       alignedLyrics: alignedLyrics, angleDegrees: 0)
        ]
        if let vs = variants { list.append(contentsOf: vs) }
        // 重排角度: 居中对称扇形(主屏永远在 0°)。
        let n = list.count
        if n > 1 {
            let spread: Float = 62   // 相邻屏间隔角度
            for i in 0..<n {
                // 0,-1,+1,-2,+2 ... 的顺序铺开, 主屏(i=0)留 0°。
                let k = (i + 1) / 2
                let sign: Float = (i % 2 == 1) ? -1 : 1
                list[i].angleDegrees = (i == 0) ? 0 : sign * Float(k) * spread
            }
        }
        return list
    }
}

/// 一块环绕银幕承载的变体(Take 2 / 语言版)。
struct CSSVariant: Codable, Identifiable {
    var id: String
    var label: String
    var videoURL: String?
    var audioURL: String?
    var alignedLyrics: [SubtitleLine]?
    /// 环绕用户的水平角度(度): 0=正前, 负=左, 正=右。
    var angleDegrees: Float = 0

    enum CodingKeys: String, CodingKey {
        case id, label, alignedLyrics, angleDegrees
        case videoURL = "final_mv_url"
        case audioURL = "audio_track_1_url"
    }
}

/// 一行歌词(情绪字幕)。时间单位: 毫秒(与后端一致)。
struct SubtitleLine: Codable {
    var text: String?
    var line: String?
    var tStart: Double?   // ms
    var tEnd: Double?     // ms
    var tokens: [SubtitleToken]?

    enum CodingKeys: String, CodingKey {
        case text, line, tokens
        case tStart = "t_start"
        case tEnd = "t_end"
    }

    /// 行文本: 优先显式 text/line, 否则拼 tokens。
    var resolvedText: String {
        if let t = text, !t.isEmpty { return t }
        if let l = line, !l.isEmpty { return l }
        if let toks = tokens {
            return toks.map { $0.resolvedText }.joined()
        }
        return ""
    }

    var startSeconds: Double { (tStart ?? 0) / 1000.0 }
    var endSeconds: Double { (tEnd ?? 0) / 1000.0 }
}

/// 逐字 token(承载情绪 → 阶段 2 用来做发光/颜色/爆字)。
struct SubtitleToken: Codable {
    var char: String?
    var text: String?
    var tStart: Double?            // ms
    var tEnd: Double?              // ms
    var emotion: String?
    var emotionIntensity: Double?  // 0..1

    enum CodingKeys: String, CodingKey {
        case char, text, emotion
        case tStart = "t_start"
        case tEnd = "t_end"
        case emotionIntensity = "emotion_intensity"
    }

    var resolvedText: String { char ?? text ?? "" }
    var startSeconds: Double { (tStart ?? 0) / 1000.0 }
    var endSeconds: Double { (tEnd ?? 0) / 1000.0 }
}
