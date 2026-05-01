---
description: "Generate brand voice guidelines from documents, transcripts, discovery reports, or any combination | 从文档、会议记录、发现报告或任意组合中生成品牌规范 | 從文件、會議記錄、發現報告或任意組合中產生品牌規範"
argument-hint: "<sources — documents, transcripts, or description of what you have | 来源 —— 文档、会议记录,或对手头素材的描述 | 來源 —— 文件、會議記錄,或對手上素材的描述>"
---

<!-- ============================================================ -->
<!-- EN — English (source)                                         -->
<!-- ============================================================ -->

**MANDATORY FIRST STEP — do this before anything else, including reading sources or processing arguments.** Check whether the user has a working folder selected for this session. You must verify this before starting any guideline generation work. If there is no working folder, stop and warn the user: "You don't have a working folder selected. Without one, I can't save guidelines to a file — they'll only exist in this conversation and won't persist to future sessions. Please select a working folder and re-run this command. If you'd like to proceed anyway, let me know."  Wait for the user to confirm before continuing.

Generate comprehensive, LLM-ready brand voice guidelines from whatever sources the user provides — brand documents, conversation transcripts, a discovery report from `/brand-voice-zh:discover-brand`, or direct input.

Process the sources specified in $ARGUMENTS. If none specified, check:
1. Whether a discovery report was generated in this session
2. `.claude/brand-voice.local.md` for known brand material locations
3. Connected platforms (Notion, Confluence, Google Drive, Box, SharePoint, Gong) for existing materials
4. If nothing is available, suggest running `/brand-voice-zh:discover-brand` first

Follow the guideline-generation skill instructions to:
1. Identify and classify all available sources (discovery report, documents, transcripts)
2. Delegate to document-analysis and conversation-analysis agents as needed
3. Synthesize findings into unified guidelines with "We Are / We Are Not" table and tone-by-context matrix
4. Assign confidence scores per section
5. Surface open questions with agent recommendations for any ambiguity
6. Present key findings and offer next steps
7. Save guidelines to `.claude/brand-voice-guidelines.md` inside the user's working folder (archiving any existing file first). Do NOT use a relative path from the agent's current working directory — in Cowork, the agent runs from a plugin cache directory, not the user's project.

After generation, guidelines are saved locally so `/brand-voice-zh:enforce-voice` can automatically find them in future sessions.

Supported document formats: PDF, PowerPoint, Word, Markdown, plain text.
Supported transcript sources: Gong (MCP), Granola (MCP), Notion meeting notes, manual uploads.

**Language output:** The guidelines document itself is written in the user's target variant (Simplified, Traditional, or bilingual — read `language:` from `.claude/brand-voice.local.md`, default bilingual zh-CN + English). Terminology, messaging pillars, and voice attributes are produced in all variants the guideline consumer will need — for example, a company with both PRC and Taiwan channels should produce zh-CN, zh-TW, and English variants side by side.

<!-- ============================================================ -->
<!-- 简体中文 — Simplified Chinese                                   -->
<!-- ============================================================ -->

**必做的第一步 —— 在读取来源或处理参数之前,必须先完成这一步。**检查本次会话是否已选择工作文件夹。必须先确认这一点才能开始任何规范生成工作。若尚未选择工作文件夹,停下并告知用户:"您尚未选择工作文件夹。在这种情况下,我无法把规范保存为文件 —— 规范将仅存在于本次对话中,无法延续到未来会话。请选择工作文件夹后重新运行该命令。若仍希望继续,请明确告知。"然后等待用户确认后再继续。

从用户提供的任意来源生成完整、可供大语言模型直接使用的品牌规范 —— 品牌文档、对话记录、`/brand-voice-zh:discover-brand` 产出的发现报告,或直接粘贴的输入。

处理 $ARGUMENTS 中指定的来源。若未指定,依次检查:
1. 本次会话中是否已产出过发现报告
2. `.claude/brand-voice.local.md` 中登记的已知品牌素材位置
3. 已连接平台(Notion、Confluence、Google Drive、Box、SharePoint、Gong)中的现成素材
4. 若全部为空,建议先运行 `/brand-voice-zh:discover-brand`

遵循 guideline-generation 技能的指引:
1. 识别并分类所有可用来源(发现报告、文档、会议记录)
2. 视情况委派给 document-analysis 和 conversation-analysis 代理
3. 将结论合并成统一规范,包含「We Are / We Are Not」对照表和「语境–语气」矩阵
4. 为每个章节分配置信度分数
5. 对任何歧义浮现「待解问题」,并附上代理的推荐答案
6. 呈现关键发现并提供后续步骤
7. 将规范保存到用户工作文件夹下的 `.claude/brand-voice-guidelines.md`(若已存在,先归档旧版)。**不要**使用代理当前工作目录的相对路径 —— 在 Cowork 中,代理运行在插件缓存目录下,而不是用户项目目录。

生成完成后,规范将保存到本地,以便 `/brand-voice-zh:enforce-voice` 在未来会话中自动读取。

支持的文档格式:PDF、PowerPoint、Word、Markdown、纯文本。
支持的会议记录来源:Gong(MCP)、Granola(MCP)、Notion 会议笔记、手动上传。

**语言输出:**规范文档本身以用户的目标变体书写(简体、繁體或双语 —— 读取 `.claude/brand-voice.local.md` 中的 `language:` 字段,默认 zh-CN + English 双语)。术语、信息支柱、声音特征应按规范使用者所需的全部语言并排输出 —— 例如,同时面向大陆与台湾渠道的公司应同时产出 zh-CN、zh-TW 与英文三个版本。

<!-- ============================================================ -->
<!-- 繁體中文 — Traditional Chinese                                 -->
<!-- ============================================================ -->

**必做的第一步 —— 在讀取來源或處理參數之前,必須先完成此步。**檢查本次工作階段是否已選擇工作資料夾。必須先確認這一點才能開始任何規範產出工作。若尚未選擇工作資料夾,請停下並告知使用者:「您尚未選擇工作資料夾。在此情況下,我無法將規範存成檔案 —— 規範僅存在於本次對話,無法延續至未來工作階段。請選擇工作資料夾後重新執行此指令。若仍希望繼續,請明確告知。」然後等候使用者確認後再繼續。

從使用者提供的任意來源產出完整、可供大型語言模型直接使用的品牌規範 —— 品牌文件、對話記錄、`/brand-voice-zh:discover-brand` 產出的發現報告,或直接貼上的輸入。

處理 $ARGUMENTS 中指定的來源。若未指定,依序檢查:
1. 本次工作階段中是否已產出過發現報告
2. `.claude/brand-voice.local.md` 中登錄的已知品牌素材位置
3. 已連接平台(Notion、Confluence、Google Drive、Box、SharePoint、Gong)中的現成素材
4. 若全部為空,建議先執行 `/brand-voice-zh:discover-brand`

依循 guideline-generation 技能的指引:
1. 辨識並分類所有可用來源(發現報告、文件、會議記錄)
2. 視情況委派給 document-analysis 與 conversation-analysis 代理
3. 將結論整合為統一規範,包含「We Are / We Are Not」對照表與「語境–語氣」矩陣
4. 為每個段落指派可信度分數
5. 對任何歧義浮現「待解問題」,並附上代理的推薦答案
6. 呈現關鍵發現並提供後續步驟
7. 將規範保存至使用者工作資料夾下的 `.claude/brand-voice-guidelines.md`(若已存在,先封存舊版)。**請勿**使用代理目前工作目錄的相對路徑 —— 在 Cowork 中,代理執行於外掛快取目錄下,而非使用者專案目錄。

產出完成後,規範將保存至本地,以便 `/brand-voice-zh:enforce-voice` 在未來工作階段中自動讀取。

支援的文件格式:PDF、PowerPoint、Word、Markdown、純文字。
支援的會議記錄來源:Gong(MCP)、Granola(MCP)、Notion 會議筆記、手動上傳。

**語言輸出:**規範文件本身以使用者的目標變體書寫(簡體、繁體或雙語 —— 讀取 `.claude/brand-voice.local.md` 中的 `language:` 欄位,預設 zh-CN + English 雙語)。術語、訊息支柱、聲音特徵應按規範使用者所需的全部語言並列輸出 —— 例如,同時面向大陸與台灣通路的公司應同時產出 zh-CN、zh-TW 與英文三個版本。
