// CSS Watch — 数据模型(复用 cssOS 字幕 JSON 结构)。
import Foundation

struct CSSWatchWork: Identifiable {
    let id: String
    let title: String
    let coverURL: String
    let audioURL: String
    let durationSecs: Int
    var lines: [WSubLine] = []
}

/// 一行歌词(ms)。
struct WSubLine: Codable {
    var text: String?
    var line: String?
    var tStart: Double?
    var tEnd: Double?
    var tokens: [WSubToken]?
    enum CodingKeys: String, CodingKey {
        case text, line, tokens
        case tStart = "t_start"
        case tEnd = "t_end"
    }
}

/// 逐字 token(带情绪)。
struct WSubToken: Codable {
    var char: String?
    var text: String?
    var tStart: Double?
    var tEnd: Double?
    var emotion: String?
    var emotionIntensity: Double?
    enum CodingKeys: String, CodingKey {
        case char, text, emotion
        case tStart = "t_start"
        case tEnd = "t_end"
        case emotionIntensity = "emotion_intensity"
    }
    var resolved: String { char ?? text ?? "" }
    var startSec: Double { (tStart ?? 0) / 1000.0 }
}
