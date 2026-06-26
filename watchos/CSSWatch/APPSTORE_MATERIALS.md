# cssWatch — App Store 上架材料(草稿)

> Apple Watch 版「纯欣赏」。watch-only standalone app。Bundle id: `app.cssstudio.watch`。
> 主语言建议: English(全球默认), 副: 简体中文。

## 基本信息
- **App 名 (Name, ≤30)**: `cssWatch`
- **副标题 (Subtitle, ≤30)**:
  - EN: `Emotion-subtitle music`
  - ZH: `情绪字幕音乐·腕上欣赏`
- **分类**: Primary = **Music**;Secondary = Entertainment
- **年龄分级**: 4+
- **价格**: Free
- **平台**: watchOS(standalone / 无 iOS 伴侣)

## 推广文本 (Promotional Text, ≤170, 可随时改不送审)
EN: `Your wrist, your cinema. Watch words burst to the rim in their own color, font and size — the signature cssOS emotion subtitles, now on Apple Watch.`
ZH: `腕上的小影院。每个字以自己的颜色/字体/大小撞向边框爆开 —— cssOS 招牌情绪字幕,登上 Apple Watch。`

## 描述 (Description)
EN:
```
cssWatch is the Apple Watch companion to cssOS — pure, beautiful listening.

• Square cover that slowly drifts, like a tiny music video on your wrist.
• The signature emotion subtitles: every word bursts at the edge of the screen in a random color, font and size, with its emotion's emoji blooming behind it and a little firework of emoji from its heart.
• During intros and instrumental breaks, small emoji drift in from the four edges.
• Music keeps playing in the background — lower your wrist, the song plays on.

Controls are effortless: turn the Digital Crown for volume, swipe to change songs, tap to play or pause.

No account needed. Just open and enjoy.
```
ZH:
```
cssWatch 是 cssOS 的 Apple Watch 伴侣 —— 纯粹、好看地欣赏。

• 正方形封面缓缓运镜,像腕上的一支小 MV。
• 招牌情绪字幕:每个字在屏幕边框上爆开,随机颜色/字体/大小,背景是它情绪的大 emoji,字心还爆出一簇小 emoji 烟花。
• 前奏与间奏时,小 emoji 从四边轻轻飘入。
• 音乐后台续播 —— 放下手腕,歌声不停。

操作毫不费力:转动数码表冠调音量,左右滑动切歌,点按播放/暂停。

无需账号,打开即赏。
```

## 关键词 (Keywords, ≤100 逗号分隔)
`music,lyrics,emotion,subtitle,MV,karaoke,listen,AI music,cssOS,now playing,player`

## URL
- Support URL: `https://cssstudio.app`(或 /support)
- Marketing URL(可选): `https://cssstudio.app`
- Privacy Policy URL: `https://cssstudio.app/privacy`(已有, 需补 watchOS 一句, 见下)

## App 隐私问卷 (App Privacy)
- **不收集任何数据**(No Data Collected)为目标。当前:
  - 无账号、无登录、不收集个人信息。
  - 仅向 `cssstudio.app` 拉取**公开作品**(音频/封面/字幕)用于播放 = 功能性网络请求, 不追踪、不关联身份。
  - 建议勾选 "Data Not Collected";如审核问网络, 说明仅取公开内容、不含用户标识。
- privacy.html 补一句: cssWatch(watchOS)仅请求公开作品资源播放, 不收集任何个人数据。

## 截图 (Screenshots)
- 尺寸: 模拟器 Apple Watch Series 11 46mm 原生 **416×496**(对应 ASC 的 46mm 槽位; 若 ASC 要别的尺寸, 换对应 watch 模拟器重截)。
- 已截备选(scratchpad/shot4, shot8 = 封面+樱花殿宇+对称角标; 还需 1 张爆字招牌图 + 可选 1 张器乐四边 emoji + 1 张魔镜启动)。
- 建议 3~5 张: ①爆字招牌 ②封面幻灯 ③器乐 emoji 飘入 ④(可选)魔镜启动金球。

## 加密合规 (Export Compliance)
- 仅用 https(标准加密), 选 "None of the algorithms" / 标准加密豁免(同 cssTV)。

## 提交前必做
1. 真机跑通(webp 封面 / 音频 / 背景音频 / Crown / 滑动 / 久播)。
2. Archive(watchOS 真机分发签名)→ altool 上传(API key 35DP8FZLYS / issuer f2936ede-...)。
3. ASC 填本文件内容 + 传截图 → Add for Review → Submit(Jing 操作)。
