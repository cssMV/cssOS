---
description: "Apply brand guidelines to content creation | 将品牌规范应用到内容创作 | 將品牌規範套用到內容創作"
argument-hint: "<content request | 内容请求 | 內容請求>"
---

<!-- ============================================================ -->
<!-- EN — English (source)                                         -->
<!-- ============================================================ -->

**MANDATORY FIRST STEP — do this before anything else, including loading guidelines or processing the content request.** Check whether the user has a working folder selected for this session. You must verify this before starting any enforcement work. If there is no working folder, stop and warn the user: "You don't have a working folder selected. Without one, I can't load saved guidelines from a previous session, and any guidelines generated in this conversation won't be saved for future sessions either. Please select a working folder and re-run this command. If you'd like to proceed anyway (guidelines will only be usable in this session), let me know."  Wait for the user to confirm before continuing.

Load the user's brand guidelines and apply them to the content request provided in $ARGUMENTS.

Find brand guidelines using this sequence (stop as soon as found):
1. Session context — check if guidelines were generated earlier in this conversation
2. Local guidelines file — check for `.claude/brand-voice-guidelines.md` inside the user's working folder. Do NOT use a relative path from the agent's current working directory (in Cowork, the agent runs from a plugin cache directory). If no working folder is set, skip this step.
3. If not found, ask the user to run `/brand-voice-zh:discover-brand`, `/brand-voice-zh:generate-guidelines`, or paste guidelines directly

Once guidelines are loaded, follow the brand-voice-enforcement skill instructions to:
1. Analyze the content request (type, audience, key messages, requirements)
2. Apply voice constants ("We Are / We Are Not") and flex tone for context (formality, energy, technical depth)
3. Generate content applying voice, tone, messaging, and terminology guidelines
4. Validate output against brand do's and don'ts
5. Present the content with a brief explanation of brand choices made
6. Note any open questions from guidelines that affect this content
7. Offer to refine based on feedback

**Language output:** If the content request is in Chinese, produce the output in the same variant the user wrote in (detect Simplified vs. Traditional from the request itself, or fall back to `language:` in `.claude/brand-voice.local.md`). If the request is mixed or ambiguous, ask which variant to use. Parallel English is produced only when the user explicitly asks for it or when the guidelines specify a bilingual channel (e.g., international press release).

<!-- ============================================================ -->
<!-- 简体中文 — Simplified Chinese                                   -->
<!-- ============================================================ -->

**必做的第一步 —— 在加载规范或处理内容请求之前,必须先完成这一步。**检查本次会话是否已选择工作文件夹。必须先确认这一点才能开始任何执行工作。若没有工作文件夹,停下并告知用户:"您尚未选择工作文件夹。在这种情况下,我无法加载之前会话中保存的品牌规范,本次对话中生成的规范也无法保存到未来会话。请选择工作文件夹后重新运行该命令。若仍希望继续(本次生成的规范仅在本会话有效),请明确告知。"然后等待用户确认后再继续。

加载用户的品牌规范,并将其应用到 $ARGUMENTS 中的内容请求。

按以下顺序查找品牌规范(找到即停止):
1. 会话上下文 —— 检查本次会话中是否已生成过规范
2. 本地规范文件 —— 检查用户工作文件夹下的 `.claude/brand-voice-guidelines.md`。**不要**使用代理当前工作目录的相对路径(在 Cowork 中,代理运行在插件缓存目录下)。若未设置工作文件夹,跳过此步。
3. 若找不到,请用户运行 `/brand-voice-zh:discover-brand`、`/brand-voice-zh:generate-guidelines`,或直接粘贴规范

规范加载后,遵循 brand-voice-enforcement 技能的指引:
1. 分析内容请求(类型、受众、核心信息、硬性要求)
2. 应用"品牌声音恒定项"("We Are / We Are Not")并根据语境调整"语气变量"(正式度、能量、技术深度)
3. 在语音、语气、信息、术语四个维度下生成内容
4. 依据品牌"应做/不应做"清单校验输出
5. 展示内容,并简要说明做出的品牌相关选择
6. 指出规范中与本条内容相关的待解问题
7. 主动询问是否需要根据反馈进一步微调

**语言输出:**若内容请求本身是中文,输出应与用户书写的变体一致(从请求文本中判断简体或繁體,或回退到 `.claude/brand-voice.local.md` 的 `language:` 字段)。若请求混用或不明确,主动询问应使用哪个变体。只在用户明确要求,或规范中指定了双语渠道(如国际性新闻稿)时,才同时输出英文版本。

<!-- ============================================================ -->
<!-- 繁體中文 — Traditional Chinese                                 -->
<!-- ============================================================ -->

**必做的第一步 —— 在載入規範或處理內容請求之前,必須先完成此步。**檢查本次工作階段是否已選擇工作資料夾。必須先確認這一點才能開始任何執行工作。若尚未選擇工作資料夾,請停下並告知使用者:「您尚未選擇工作資料夾。在此情況下,我無法載入先前工作階段儲存的品牌規範,本次對話中產生的規範也無法保存至未來工作階段。請選擇工作資料夾後重新執行此指令。若仍希望繼續(本次產生的規範僅於本工作階段有效),請明確告知。」然後等候使用者確認後再繼續。

載入使用者的品牌規範,並套用至 $ARGUMENTS 中的內容請求。

依下列順序尋找品牌規範(找到即停止):
1. 工作階段上下文 —— 檢查本次對話中是否已產出過規範
2. 本地規範檔案 —— 檢查使用者工作資料夾下的 `.claude/brand-voice-guidelines.md`。**請勿**使用代理目前工作目錄的相對路徑(在 Cowork 中,代理執行於外掛快取目錄下)。若尚未設定工作資料夾,略過此步。
3. 若仍找不到,請使用者執行 `/brand-voice-zh:discover-brand`、`/brand-voice-zh:generate-guidelines`,或直接貼上規範

規範載入後,依循 brand-voice-enforcement 技能的指引:
1. 分析內容請求(類型、受眾、核心訊息、硬性要求)
2. 套用「品牌聲音恆定項」(「We Are / We Are Not」),並依語境調整「語氣變數」(正式程度、能量、技術深度)
3. 在語音、語氣、訊息、術語四個面向下產出內容
4. 依據品牌「應做/不應做」清單檢核輸出
5. 呈現內容,並簡要說明所做的品牌相關抉擇
6. 指出規範中與本條內容相關的待解問題
7. 主動詢問是否需要依回饋進一步微調

**語言輸出:**若內容請求本身為中文,輸出應與使用者書寫的變體一致(由請求文字判斷簡體或繁體,或回退至 `.claude/brand-voice.local.md` 的 `language:` 欄位)。若請求混用或不明確,主動詢問應使用哪個變體。僅在使用者明確要求,或規範中指定了雙語管道(例如國際新聞稿)時,才同時輸出英文版本。
