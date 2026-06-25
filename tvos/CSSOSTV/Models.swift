// CSSOS_WAVE_1172 20260624 — Jing 愿景: Apple TV 原生 App(大屏影院, 不走 WebView —— tvOS 无 WebKit)。
// 数据模型, 与 cssOS 后端对齐(works / 画音分层 / 逐字情绪字幕)。与 visionos/CSSImmersive/Models.swift 同源约定。
//
// 画音分层铁律: videoURL = 静音视觉; audioURL = 独立真声音(永不用视频声)。

import Foundation

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

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case videoURL = "final_mv_url"
        case audioURL = "audio_track_1_url"
        case coverURL = "cover_image"
        case durationSecs = "duration_secs"
        case workType = "work_type"
    }

    var durationLabel: String {
        guard let s = durationSecs, s > 0 else { return "" }
        let m = Int(s) / 60, ss = Int(s) % 60
        return String(format: "♪ %d:%02d", m, ss)
    }
}

/// CSSOS_WAVE_1227 — 首页一行 rail(标题 + 该行作品)。Apple TV 标准横向行布局。
struct CSSRail: Identifiable {
    let id: String
    let title: String
    let works: [CSSWork]
}
