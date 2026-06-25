// W1323 — 打包字体注册(桌面端那套花体搬上 tvOS)。
//   .ttf 放在 cssTV/Fonts/(同步文件夹自动进 bundle), 启动时 CTFontManagerRegisterFontsForURL 注册,
//   记下每个字体的 PostScript 名供 .custom(name:) 引用。加更多英文/中文花体 = 往 Fonts/ 丢 .ttf 即可。
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
