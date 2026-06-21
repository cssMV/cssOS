// CSSOS_WAVE_957 — 本地化助手。i18n 铁律: 英文默认 + 全球化, 仅 zh 区域显示中文, 绝不中文兜底。
// 原生 Swift 没有 web 的 tr(); 用最简 L(en, zh) 按系统语言挑。以后接全语言可换 String Catalog。
import Foundation

func L(_ en: String, _ zh: String) -> String {
    let code = Locale.current.language.languageCode?.identifier ?? "en"
    return code == "zh" ? zh : en
}
