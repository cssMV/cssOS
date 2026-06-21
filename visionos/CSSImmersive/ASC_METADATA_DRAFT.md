# CSS Vision — App Store Connect 元数据草稿(visionOS 独立 App 记录)

> 平台: visionOS · Bundle ID: `app.cssstudio.vision` · Team: QBG9PRVBYZ
> 注: visionOS 必须建【独立 App 记录】(与 iOS app.cssstudio.studio 不同 bundle id)。
> 字数限制: App 名 ≤30 · 副标题 ≤30 · 关键词共 ≤100(逗号分隔) · 描述 ≤4000。

---

## App 名称 (Name, ≤30)
- 英文: `CSS Vision`
- 中文(简): `CSS Vision · 魔镜`

## 副标题 (Subtitle, ≤30)
- 英文: `Say it. Witness the miracle.`
- 中文(简): `说出 CSS，见证奇迹`

## 宣传文本 (Promotional Text, ≤170, 可随时改不需审核)
- 英文: `Look into the orb to sign in, speak a spell, and watch your music video bloom around you — with per-word emotion lyrics in your mother tongue.`
- 中文: `凝视魔镜球登录，说出咒语，看你的音乐 MV 在身边绽放——母语逐字情绪字幕，全球首创。`

## 关键词 (Keywords, ≤100 chars, 逗号分隔, 无空格更省字)
```
AI music,music video,MV,karaoke,lyrics,spatial,immersive,创作,AI作曲,情绪字幕,沉浸影院,卡拉OK,Vision
```

## 描述 (Description, ≤4000)
英文:
```
CSS Vision turns a spoken spell into a cinematic music video — created, sung, and screened all around you in your own space.

Just say "CSS" and what you want to create. CSS Vision writes the lyrics in your civilization's voice, composes and sings the song, paints the cover, and screens it on a surround cinema screen in your room — while per-word emotion lyrics bloom in the air in your mother tongue.

• Spell to MV — speak a theme, watch the whole music video conjure itself on a living golden orb that spins faster as it nears completion.
• Optic ID sign-in — gaze into the orb, rays of light, and you're in.
• Per-word emotion lyrics — every word has its own color, size, and motion driven by the singing — a world first, now in 3D space around you.
• Browse & play — a floating arc of cover art; gaze a cover, pinch to enter the cinema.
• Surround cinema — your MV plays on a curved screen with you at the center; turn your head to switch language versions.
• Watch together — shared cathedral via SharePlay.

Your civilization, your mother tongue, your miracle — witnessed.
```

中文(简):
```
CSS Vision 把你说出的一句咒语，变成一支在你身边绽放的电影级音乐 MV——创作、演唱、放映，全在你的空间里完成。

只需说"CSS"加上你想创作的内容。CSS Vision 会以你文明的口吻写词、作曲并演唱、绘制封面，在你房间里的环绕银幕上放映——母语逐字情绪字幕在空中绽放。

• 咒语成片——说出主题，看整支 MV 在一颗活的金色魔镜球上孕育，越接近完成转得越快。
• Optic ID 登录——凝视魔镜球，光束射出，即刻进入。
• 逐字情绪字幕——每个字独特的颜色、字号、随演唱跳动，全球首创，现在 3D 环绕你。
• 浏览即播——封面浮成弧形，凝视封面、捏合进影院。
• 环绕影院——你在圆心，MV 在曲面银幕上放映，转头切换语言版本。
• 一起看——SharePlay 共享圣殿。

你的文明、你的母语、你的奇迹——被见证。
```

## What's New (版本说明)
- `First release of CSS Vision for Apple Vision Pro — speak a spell, witness the miracle.`
- `CSS Vision 首发——说出咒语，见证奇迹。`

---

## 隐私问卷 (App Privacy) 答案
> 原则: 我们采集账号 + 你创作的内容; 不做跨 App 追踪。

| 数据类型 | 是否采集 | 用途 | 关联身份 | 用于追踪 |
|---|---|---|---|---|
| 联系信息 · 姓名/邮箱 (Apple 登录) | 是 | App 功能(账号) | 是 | 否 |
| 用户内容 · 你创作的歌词/作品 | 是 | App 功能 | 是 | 否 |
| 音频数据 · 语音指令 | 是* | App 功能(语音创作/搜索) | 否 | 否 |
| 标识符 · 用户 ID | 是 | App 功能 | 是 | 否 |
| 使用数据 / 诊断 | 是 | 分析、App 功能 | 否 | 否 |

\* 语音说明: 麦克风音频经 **Apple 设备端/系统 Speech 识别**转文字; 我们只收到**文本指令**, 不上传/存储原始录音。

权限用途串(Info.plist, 已写):
- 麦克风: `用于语音说出想听的作品或创作咒语。`
- 语音识别: `用于把你说的话转成创作/搜索指令。`
- 世界感知: `用于让 MV 银幕随你的视线环绕摆放、转头切换语言版本。`
- 手势: `用于在空中以手势创作 MV。`

---

## 审核备注 (App Review Notes) — 重要
```
- Sign-in: We use "Sign in with Apple" via a web OAuth flow served by our own backend
  (api/auth/apple → handoff token → /api/auth/handoff/exchange). On visionOS this is
  completed with Optic ID. A test account is provided below.
- No in-app purchases in this version. All listening/creation here uses the signed-in
  user's existing account; buying/topping-up is not offered inside visionOS.
- Voice: speech is recognized on-device via Apple Speech; only text reaches our server.
- All generated personas/content are original; no living real people, no third-party IP.

Test account: <jingdudc@gmail.com 的测试账户 / 或专门 demo 账户>
Demo spell to try: say "CSS" then "create an epic about 唐伯虎".
```

---

## 截图清单(已用 visionOS 26.5 模拟器实拍 5 张, 存 ~/Desktop/CSSVision-shots/)
> ASC visionOS 截图位最多 10 张; 第 1 张 = 搜索/列表缩略图(最重要)。按下表顺序上传。
> 模拟器图即提交可用; 日后头显实拍可逐张替换(主图 1 最值得真机拍)。

| 位 | 文件 | 画面 | 建议标题(ASC 不强制) |
|---|---|---|---|
| **1 主图** | `4_cinema.png` | 环绕银幕《混沌の海》巨浪 + 居中逐字情绪大字「桃花仙人种桃树」+ emoji 光晕 | 母语逐字情绪字幕,在你身边绽放 |
| **2** | `1_lobby.png` | Cover Arc 大厅(金球 logo + 封面弧 + 货架 + 语音/创作) | 凝视封面,捏合进影院 |
| **3** | `2_signin.png` | 科幻登录门户「凝视魔镜球登录」+ 射光 | 一瞥登录 · Optic ID |
| **4** | `3_creation_orb.png` | 创作球(满屏金光孕育 + 进度弧) | 说出 CSS,见证奇迹诞生 |
| **5** | `5_music_edge.png` | 间奏四边 emoji(✨🔥🎉💠)飞向银幕中央 | 间奏不冷场,emoji 随乐飞舞 |

注: 模拟器音频不起播 → 情绪字幕/间奏 emoji 无法自然触发, 这 5 张用内置展示模式
    (`SIMCTL_CHILD_CSS_SHOWCASE=signin|orb|cinema|music`)强制渲染, 画面真实。

## 还需准备(非文本)
- [x] **截图**: 5 张模拟器实拍已就位(见上表)。可选: 头显实拍替换主图 1。
- [x] **App 图标**: 分层 .solidimagestack(环 RING_FIT 0.99 充满 + Back 白底), 编译通过。
- [ ] **年龄分级问卷**: 同 iOS app(创作平台, 无成人内容)。
- [ ] **支持 URL / 隐私政策 URL**: 复用现有 cssstudio.app 的对应页。
- [ ] **类别**: 主 = 娱乐(Entertainment) / 音乐(Music); 次 = 照片与视频 或 图形与设计。
- [x] **首版砍 Vision 内购**(规避 3.1.1): 打赏/买断已隐藏(CSSPayments.visionPurchasesEnabled=false, W1068)。
