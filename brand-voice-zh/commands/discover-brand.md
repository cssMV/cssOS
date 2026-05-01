---
description: "Search connected platforms for brand materials and produce a discovery report | 跨已连接平台搜索品牌素材并生成发现报告 | 跨已連接平台搜尋品牌素材並產生發現報告"
argument-hint: "[company name or platforms to search | 公司名称或要搜索的平台 | 公司名稱或要搜尋的平台]"
---

<!-- ============================================================ -->
<!-- EN — English (source)                                         -->
<!-- ============================================================ -->

Discover brand materials across the user's connected enterprise platforms. Search Notion, Confluence, Google Drive, Box, SharePoint, Figma, Gong, Granola, and Slack for brand guidelines, style guides, messaging frameworks, templates, and conversation transcripts.

If $ARGUMENTS includes a company name, use it for targeted searches. If platforms are specified, limit search to those platforms.

Before doing anything else, briefly orient the user on what's about to happen: the process will search their connected platforms, produce a discovery report, and then (optionally) generate and save brand guidelines to `.claude/brand-voice-guidelines.md` in the working folder. Nothing is saved until they explicitly approve. Keep the orientation to 2-3 sentences — don't recite the full workflow.

Follow the discover-brand skill instructions to:
1. Check `.claude/brand-voice.local.md` for settings (company name, enabled platforms, search depth)
2. Validate platform coverage (stop if no document platforms, warn if gaps)
3. Briefly confirm scope with the user (which platforms, include transcripts?)
4. Delegate to the discover-brand agent for autonomous 4-phase search
5. Present the structured discovery report with sources, brand elements, conflicts, and open questions
6. Offer next steps: generate guidelines, resolve open questions, save report, or expand search

**Platform validation:**
- If **no platforms** are connected, inform the user which MCP servers the plugin supports (Notion, Atlassian Confluence, Box, Figma, Gong, Granola, Microsoft 365) and that Google Drive and Slack are available as native Claude integrations.
- If **no document platforms** (Notion, Confluence, Google Drive, Box, Microsoft 365) are connected — only supplementary platforms like Slack, Gong, Granola, or Figma — stop and tell the user: "You don't have any document storage platforms connected. Brand guidelines and style guides almost always live on Google Drive, SharePoint, Notion, Confluence, or Box. Please connect at least one before running discovery."
- If **no primary file storage** (Google Drive, Microsoft 365, Box) is connected, warn: "None of your primary file storage platforms are connected. Brand documents frequently live on these. Discovery will proceed but results may have significant gaps."
- If **only one platform** is connected, warn: "Discovery works best with 2+ platforms for cross-source validation. Results from a single platform will have lower confidence scores."

**Language output:** Detect the user's preferred Chinese variant from `.claude/brand-voice.local.md` (`language: zh-CN | zh-TW | bilingual`). Default to bilingual (简体中文 + English) if not set. All narrative output (section headings, summaries, open questions) should be produced in the chosen variant(s); file names and code identifiers stay in English.

<!-- ============================================================ -->
<!-- 简体中文 — Simplified Chinese                                   -->
<!-- ============================================================ -->

跨用户已连接的企业平台发现品牌素材。在 Notion、Confluence、Google Drive、Box、SharePoint、Figma、Gong、Granola 和 Slack 中搜索品牌规范、样式指南、信息框架、模板以及对话记录。

如果 $ARGUMENTS 中包含公司名称,则据此进行定向搜索。如果指定了平台,则将搜索范围限定在这些平台。

在开始任何工作之前,先用 2–3 句话向用户说明即将发生的事:将会跨已连接平台搜索素材、生成发现报告,然后(可选)在工作文件夹中生成并保存品牌规范到 `.claude/brand-voice-guidelines.md`。未经用户明确批准不会保存任何文件。不要把完整流程全部复述一遍。

遵循 discover-brand 技能的指引:
1. 读取 `.claude/brand-voice.local.md` 中的设置(公司名称、启用的平台、搜索深度)
2. 校验平台覆盖面(若无文档平台则停止;若有空缺则警告)
3. 用一两句话与用户确认范围(搜索哪些平台?是否包含通话/会议记录?)
4. 将工作委派给 discover-brand 代理,执行自动化的 4 阶段搜索
5. 输出结构化的发现报告,包含来源、品牌要素、冲突与待解问题
6. 提供后续选项:生成品牌规范、解决待解问题、保存报告、或扩大搜索范围

**平台覆盖校验:**
- 若**未连接任何平台**,告知用户本插件支持的 MCP 服务器(Notion、Atlassian Confluence、Box、Figma、Gong、Granola、Microsoft 365),并说明 Google Drive 和 Slack 是 Claude 原生集成,无需安装 MCP。
- 若**未连接任何文档平台**(Notion、Confluence、Google Drive、Box、Microsoft 365)—— 只连接了 Slack、Gong、Granola、Figma 之类的辅助平台,停下来并告诉用户:"您尚未连接任何文档存储平台。品牌规范和样式指南几乎总是保存在 Google Drive、SharePoint、Notion、Confluence 或 Box 中。请至少连接其中一个后再运行发现流程。"
- 若**主要文件存储**(Google Drive、Microsoft 365、Box)均未连接,发出警告:"您的主要文件存储平台均未连接。品牌文档经常保存在这些平台中。发现流程仍会继续,但结果可能存在较大缺口。"
- 若**仅连接了一个平台**,发出警告:"跨源交叉验证需要 2 个及以上平台。仅来自单一平台的结果置信度会较低。"

**语言输出:**从 `.claude/brand-voice.local.md` 的 `language: zh-CN | zh-TW | bilingual` 字段读取中文偏好。未设置时默认输出双语(简体中文 + English)。所有叙述内容(章节标题、摘要、待解问题)按所选语言变体输出;文件名和代码标识符保留英文。

<!-- ============================================================ -->
<!-- 繁體中文 — Traditional Chinese                                 -->
<!-- ============================================================ -->

跨使用者已連接的企業平台發現品牌素材。於 Notion、Confluence、Google Drive、Box、SharePoint、Figma、Gong、Granola 與 Slack 中搜尋品牌規範、樣式指南、訊息框架、範本以及對話記錄。

若 $ARGUMENTS 中包含公司名稱,即據此進行定向搜尋。若已指定平台,則將搜尋範圍限縮於這些平台。

在開始任何工作之前,先以 2–3 句話向使用者說明即將發生的事:流程將跨已連接平台搜尋素材、產出發現報告,接著(可選)於工作資料夾中生成並儲存品牌規範到 `.claude/brand-voice-guidelines.md`。未經使用者明確同意不會儲存任何檔案。請勿將完整流程全部複述。

依照 discover-brand 技能的指引:
1. 讀取 `.claude/brand-voice.local.md` 中的設定(公司名稱、啟用的平台、搜尋深度)
2. 檢核平台涵蓋面(若無文件平台則停止;若有缺口則警告)
3. 以一兩句話與使用者確認範圍(要搜尋哪些平台?是否包含通話/會議記錄?)
4. 將工作委派給 discover-brand 代理,執行自動化的 4 階段搜尋
5. 輸出結構化的發現報告,包含來源、品牌要素、衝突與待解問題
6. 提供後續選項:產生品牌規範、解決待解問題、儲存報告、或擴大搜尋範圍

**平台涵蓋檢核:**
- 若**尚未連接任何平台**,告知使用者本外掛支援的 MCP 伺服器(Notion、Atlassian Confluence、Box、Figma、Gong、Granola、Microsoft 365),並說明 Google Drive 與 Slack 屬 Claude 原生整合,無需另外安裝 MCP。
- 若**尚未連接任何文件平台**(Notion、Confluence、Google Drive、Box、Microsoft 365)—— 僅連接了 Slack、Gong、Granola、Figma 之類的輔助平台,請停下並告知使用者:「您尚未連接任何文件儲存平台。品牌規範與樣式指南幾乎都保存在 Google Drive、SharePoint、Notion、Confluence 或 Box。請至少連接其中一個後再執行發現流程。」
- 若**主要檔案儲存**(Google Drive、Microsoft 365、Box)皆未連接,發出警告:「您的主要檔案儲存平台皆未連接。品牌文件經常保存在這些平台。發現流程仍會繼續,但結果可能存在較大缺口。」
- 若**僅連接單一平台**,發出警告:「跨來源交叉驗證需要兩個以上的平台。僅來自單一平台的結果可信度會較低。」

**語言輸出:**從 `.claude/brand-voice.local.md` 的 `language: zh-CN | zh-TW | bilingual` 欄位讀取中文偏好。未設定時預設輸出雙語(繁體中文 + English)。所有敘述內容(章節標題、摘要、待解問題)按所選語言變體輸出;檔名與程式碼識別符保留英文。
