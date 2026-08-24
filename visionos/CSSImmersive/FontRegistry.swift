// CSSOS_WAVE_1936 20260824 — 打包字体注册, 原样搬自 tvos/cssTV/FontRegistry.swift。
//
// 情绪字幕的「逐字随机字体」(W1323)要从打包花体里挑 —— 不搬这个, TV 那套字幕在 Vision
// 上就只剩四种系统字形, 花体全丢, 视觉立刻退一档。
// .ttf 丢进 CSSImmersive/Fonts/ 即自动进 bundle 并被注册; 加字体不需要改代码。
// 目前 Vision 侧可能还没放 .ttf —— 那样 custom 为空, 字幕自动退回系统字形, 不会崩。

import UIKit
import CoreText
import CoreGraphics

enum CSSFonts {
    /// 注册成功的自定义字体 PostScript 名(情绪字幕随机字体从这里挑)。
    static private(set) var custom: [String] = []

    static func registerBundled() {
        guard custom.isEmpty else { return }
        let urls = Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? []
        for url in urls {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            if let provider = CGDataProvider(url: url as CFURL),
               let cg = CGFont(provider),
               let ps = cg.postScriptName as String? {
                custom.append(ps)
            }
        }
        print("[CSSFonts] registered:", custom)
    }
}
