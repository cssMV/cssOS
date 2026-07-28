# 「面对面」(Face-to-Face) 路线图 — 演播厅全屏影院化

**定位**:面对面 = 与 MV 面板**同级的旗舰全屏体验**(演播厅模式),不是"和照片聊天"。
像打造 MV「真全屏影院」那样打造它。

**贯穿铁律(GPU 明码实价)**:凡吃第三方引擎 / 自建 GPU 的环节 —— TTS 语音、
口型、视频渲染、3D 实时 —— 一律从钱包按引擎**实际 cents 成本**扣
(`estimateEngineCostCents → debitCredits`),预扣余额门先拦,员工豁免。
UI 上**明码标价 + 实时更新**(像现在 MV 的 cents 显示)。**不学 Sora 免费玩。**
这是 W219 两层计费宪法的延伸。

---

## Tier 0 — 立即(已完成 / 刚修)
- ✅ **独占静音**(W1627 杂音根治):进面对面 → 全平台其它媒体 暂停 + 静音 + 1s 守卫压制自动续播;关闭还原。MV 影院的 Web-Audio/`<audio>` 声音与情绪字幕穿透彻底掐断。
- ✅ 谁说话谁在大屏 + 另一方小窗 PiP。
- ✅ 用户 + 数字演员双方情绪字幕。

## Tier 1 — 近期(会动嘴唇 + 演播厅镜头语言,普通端可跑)
- **说话时"动嘴唇"**:音频驱动口型(audio→viseme)。起步轻量 —— 说话时嘴部循环 + 头部 idle 微动;进阶浏览器端 wav2lip-lite / 预生成口型帧。💰吃算力→计费。
- **演播厅广角开场**:进面对面先一个广角镜头 —— 数字演员 + 用户端坐演播厅。
- **用户虚拟形象**:要求上传真实头像;头部之外身体由系统随机生成(2D 拼贴起步)。
- **多导演视角 / 不定时切镜**:系统随机切换(广角 / 演员大屏 / 用户大屏 / 双人),谁说话谁上大屏。复用 Director 镜头语言。

## Tier 2 — 中期(视频化)
- **短视频级实时口型/表情**:音频+头像 → server GPU(wav2lip / SadTalker / LivePortrait 级)。💰按秒计费、实时价。
- **TV 端接 iPhone 摄像头**(Continuity Camera / 手机当外接摄像头)→ 用户真人入镜。
- 演播厅皮肤:场景 / 灯光 / 机位预设。

## Tier 3 — 远期(实时 3D,肯定上 GPU)
- **实时 3D 数字人**:3D avatar / Gaussian Splatting + 实时 TTS + 实时口型/表情/手势,像数字主持人/播音员,和用户实时对话。💰按秒实时计费。
- **Vision 端空间演播厅**:数字演员"在场"(体积视频 / 3D)。
- **双向同框**:用户也 3D 化,真正"同框"。

---

## 治理口子(已闭合 — 柔性额度模型)
- ✅ **面对面/问道 TTS 软额度计费(W1632 硬门 → W1634 柔性额度, 2026-07-08)**。此前 `/api/actors/:id/say` 零计费(铁律违规)。现行 **Jing 设计的柔性转化**:
  - **自我介绍免费**(读 `digital_actors.showcase` 缓存, 零实时算力)。
  - **问答语音 = 每演员·每月免费额度(按档)→ 用完走钱包按句扣 → 钱包空则无声(文字永远免费)**。
    档位:**free 3 / starter 20 / pro 60 / studio 200**(enterprise/contact 沿用 studio);`actor_voice_meter` 表原子计次(migration 103)。
  - **柔性提醒(签名玩法)**:免费额度最后一句 → 演员口吻提醒(`nudge:last_free`);钱包空 → `nudge:balance`;匿名尝鲜 1 句后 → `nudge:signin`。**永不硬拒** —— 无权发声就 `ok:true` + 空 voice + nudge,前端渲染演员口吻的续费提醒(f2f 底部闪现 / 问道黄条)。文字永远免费。
  - **员工豁免**(`isCssosAdminEmail`)。`estimateEngineCostCents("voice","elevenlabs",chars)` ≈ `chars/60`¢。
  - 线上实测:匿名 1st = 有声+nudge; 2nd = 无声+nudge(非 402)。✅
- ✅ **「问」(LLM `/ask`)软额度 + 演员口吻提醒(W1636/B, 2026-07-09)**。开场问候(history 为空)**永久免费**(发现钩子);真问题起计:**问额度 free50/starter200/pro600/studio3000**(`actor_ask_meter`, migration 104)→ 钱包按条扣(~2¢)→ 柔性提醒。匿名发问 → 演员**开口说**登录提醒(`actorNudgeReply`, 中文古风: 「有缘千里来相会…先留名姓(登录)」),**不烧 LLM**。登录=充值问更多 / 听更多。线上实测通过。
- ✅ **额度放宽(W1635)**:语音 free10/starter40/pro120/studio500(语音便宜);匿名尝鲜 1 句语音(voiced 开场问候)。**暂不给真人演员语音分成**(靠选角 80/20)。
- ✅ **市场匿名策略**:浏览 + 自我介绍(缓存 + 开场问候)对匿名免费(钩子);**发问/语音需登录**(柔性,不硬拒)。
- ✅ **C — Safari STT(W1637, 2026-07-09)**。根因: `webkitSpeechRecognition` 是 Chrome 独有, Safari 直接隐藏麦克风。修法: 后端 `POST /api/actors/stt`(MediaRecorder 录音 → 上传 → OpenAI `whisper-1` 转写, 复用 `whisperTranscribe`), 前端 `agStartRecord()` 取代 SR —— 专页 mic + 面对面语音输入都改成**点录音→再点停止→转写**(Safari 支持)。计费**并进「问」**(需登录; STT 成本极小不单独扣, 后续 /ask 计问额度)。匿名 → 401 提示登录。UX 变化: 从 SR 自动断句 → 手动 tap-to-record/tap-to-stop(MediaRecorder 无自动端点检测; 未来可加静音自动停)。线上验证端点 401 门 + 接线进包。
- ⏳ **待办 D**:3.1 演播厅镜头语言(CSS 抽象舞台 + 随机多导演视角)。
- ⏳ **未来每个吃 GPU 的 Tier(口型/视频/3D)** 复用这套四段式:成本档 → 免费额度 → 钱包 → 柔性 nudge。
