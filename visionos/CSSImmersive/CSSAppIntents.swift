// CSSOS_WAVE_1060 — Siri / App Shortcuts: "用 CSS Vision 创作 《唐伯虎》三部曲"。
//   Siri 唤起 → 打开 App → 把咒语写进 UserDefaults("cssPendingSpell") → ContentView .onAppear
//   读到即启动创作(显示 CreationOrb → 出 MV)。需 App Intents(visionOS 自带, 无需额外权限)。
//   用户可对 Siri 说: "用 CSS Vision 创作 中国古风三部曲唐伯虎" / "Create an epic about 唐伯虎 with CSS Vision"。

import AppIntents
import Foundation

struct CreateWithCSSVisionIntent: AppIntent {
    static var title: LocalizedStringResource = "Create with CSS Vision"
    static var description = IntentDescription("Speak a spell and CSS Vision conjures the MV.")
    static var openAppWhenRun = true

    // 自由文本参数不能嵌进 AppShortcut 短语(仅 AppEntity/AppEnum 可)→ 用 requestValueDialog
    // 让 Siri 在唤起后追问"创作什么", 用户口述即填(支持任意中文/英文长句)。
    @Parameter(title: "What to create", requestValueDialog: "What shall CSS Vision create?")
    var spell: String

    func perform() async throws -> some IntentResult {
        let s = spell.trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.isEmpty {
            UserDefaults.standard.set(s, forKey: "cssPendingSpell")
        }
        return .result()
    }
}

struct CSSVisionShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CreateWithCSSVisionIntent(),
            phrases: [
                "Create with \(.applicationName)",
                "\(.applicationName) create",
                "用 \(.applicationName) 创作",
                "\(.applicationName) 创作",
            ],
            shortTitle: "Create",
            systemImageName: "sparkles"
        )
    }
}
