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
    static func sparkOut(_ p: Double) -> (opacity: Double, travel: Double, scale: Double) {
        let scale: Double = p < 0.62 ? 0.4 + (1.04 - 0.4) * (p / 0.62)
                                      : 1.04 + 0.02 * ((p - 0.62) / 0.38)
        let opacity: Double
        if p < 0.12 { opacity = p / 0.12 }
        else if p < 0.62 { opacity = 1.0 - 0.08 * ((p - 0.12) / 0.50) }
        else { opacity = 0.92 * (1 - (p - 0.62) / 0.38) }
        let travel: Double = p < 0.12 ? 0
            : (p < 0.62 ? 0.9 * ((p - 0.12) / 0.50) : 0.9 + 0.1 * ((p - 0.62) / 0.38))
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
    /// 时长(秒)。
    var durationSecs: Double?
    /// 作品类型(single/opera/film/series/triptych…)。CSSOS_WAVE_1227 首页分轨用。
    var workType: String?
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
        case durationSecs = "duration_secs"
        case workType = "work_type"
        case listenPriceCents = "current_listen_price_cents"
        case buyoutPriceCents = "current_buyout_price_cents"
        case viewerOrders = "viewer_orders"
    }

    /// 收费(聆听价 > 0)。
    var isPaid: Bool { (listenPriceCents ?? 0) > 0 }
    /// 已拥有(本人在该作品上有订单)。
    var isOwned: Bool { (viewerOrders?.isEmpty == false) }
    /// 可免费直接播(免费 或 已拥有)。
    var canPlayFree: Bool { !isPaid || isOwned }
    var listenPriceLabel: String {
        let c = listenPriceCents ?? 0
        guard c > 0 else { return "" }
        return "¥" + String(format: "%.2f", Double(c) / 100).replacingOccurrences(of: ".00", with: "")
    }

    var durationLabel: String {
        guard let s = durationSecs, s > 0 else { return "" }
        let m = Int(s) / 60, ss = Int(s) % 60
        return String(format: "♪ %d:%02d", m, ss)
    }

    // W1259 — 「Want an MV like this?」创作尾卡哨兵(每条 rail / hero 末尾各放一张, 点它进创作台)。
    static let createCardId = "__cssos_create__"
    static var createCard: CSSWork { CSSWork(id: createCardId) }
    var isCreateCard: Bool { id == Self.createCardId }
}

/// CSSOS_WAVE_1227 — 首页一行 rail(标题 + 该行作品)。Apple TV 标准横向行布局。
struct CSSRail: Identifiable {
    let id: String
    let title: String
    let works: [CSSWork]
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
