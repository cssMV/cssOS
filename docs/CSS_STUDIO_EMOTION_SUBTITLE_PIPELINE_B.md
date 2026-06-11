# 情绪字幕 · 管线根治(B 方案)立项 — 演出级逐字对齐

> 状态: 立项 / 待实现
> 关联前端 A 方案(已上线): W648 渲染器线性拉伸 + 引擎字级行内重分布(临时顶替)。
> 目标作品基准: 《Jerusalem》`f4c5e610-d921-433b-8c32-461a52a9d6ea`(真实音频 247.4s,旧 take1 字幕只到 146.1s)。

## 1. 愿景(验收的北极星)

情绪字幕 = 平台全球首创。歌声**咬字到哪一个字**,字幕就**精确点亮哪一个字**;唱腔**拉长多少时长**,该字就**亮多久**;**鼓点、音量大小、情绪**(serene/ignite/grief/joy/intimate/resolve…)全部通过字幕的**字号/爆字/颜色/字体/动效**实时表达。整行先以普通字幕铺出(预读),逐字随歌声进入情绪渲染。

## 2. 根因(已定位)

`src/index.ts` 字幕生成(W440/441,约 1818–1860):
- `const whisperTl = Array.isArray(timeline) ? timeline : null;`(~1831)——take1 **只用音乐生成返回的 `timeline`**。Suno/部分引擎不返回逐字 timeline 时 `whisperTl=null`。
- `buildSubtitleSections(reLyrics, null, emo)` 退到 **Phase-1 占位**:token `t_start/t_end` 全 0(见类型注释 ~1129 "0 = unknown (Phase 1 placeholder)"),行级时间退化为匀速平摊。
- 音频富集 `enrichTimelineViaAudioAnalysis`(~1836)有 `if (whisperTl && whisperTl.length>0)` 门槛 → 一并跳过 → beat/volume/pitch 全 null。
- take1 **从不自己跑 forced-alignment**;只有 take2(~1851)调了 `alignWordsViaWhisper(altUrl, lang)`。

结论:take1 在"音乐引擎没给逐字时间"时**直接出厂占位**,这就是 Jerusalem 字幕飘移 + 逐字情绪全是 serene 的根。

## 3. 交付物

### 3.1 whisperX 强制对齐服务(逐字 onset/offset)
- 在现有 Python 音频分析服务(`enrichTimelineViaAudioAnalysis` 调用的那个)旁,新增/升级 **whisperX**(或 WhisperTimestamped + wav2vec2 对齐)端点:输入音频 stem + 参考歌词,输出**逐字** `{char/word, t_start, t_end}`(毫秒级,真实 onset/offset,含长音 sustain 时长)。
- 复用已有 `whisperTranscribe`(~4363)/ `alignWordsViaWhisper`(~4427)作为兜底;whisperX 精度更高,优先。

### 3.2 接通 take1(核心一行级改动 + 富集)
在 ~1831 处:当 `whisperTl` 为空,**对 take1 主音频 `primaryUrl` 跑 `alignWordsViaWhisper(primaryUrl, lang)`** 拿真实逐字时间,再走 `buildSubtitleSections` + `enrichTimelineViaAudioAnalysis`(librosa beat/volume/pitch)。**永不再写占位 take1。**

### 3.3 逐字情绪(不只行级)
- 现 `annotateEmotions` 是 LLM **行级**情绪。升级为把行级情绪**铺到对齐后的 token**,并用**音频特征**调制每字 `emotion_intensity`(volume/pitch 峰值 → 爆字;beat_strength → 鼓点重音)。
- 输出 schema 已就位(`SubToken`:`beat/beat_strength/rhythm/volume/pitch_hz/emotion/emotion_intensity`),只需真实填充而非占位复制。

### 3.4 回填(Jerusalem + 全量)
- 先重跑 Jerusalem `f4c5e610…`,产出真 `subtitle-take1.json`(token t_start 落在 [0,247s],单调递增,末字 ≈ 247s)。
- 批量扫描 `works` 中 take1 为占位(token 全 0)的作品,排队重对齐。可接 admin 端点 + 后台队列,避免一次性打满。

### 3.5 生成器加固(出厂即对)
- 对齐失败 → **不出厂占位**:标记 `subtitle_take1_json_url` 为 pending + 入重试队列(沿用免疫系统 telemetry)。
- 新作品默认走 3.2 路径,保证以后**出厂即演出级对齐**。

## 4. 验收标准
- [ ] Jerusalem take1:token `t_start` 单调递增、落在真实音频时长内、末字 ≈ 音频结尾(±1s)。
- [ ] beat / volume / pitch_hz / emotion / emotion_intensity **非占位**(逐字不同)。
- [ ] 前端无需 W648 线性拉伸即对齐(`clockScale` 自动 ≈ 1,成为 no-op,可保留作兜底)。
- [ ] 间奏/前奏/长音处字幕**停在原地等歌声**,不再匀速飘。
- [ ] 逐字情绪可见差异:爆字/变色/字体随真实音量+情绪变化。
- [ ] 新作品出厂即满足以上;对齐失败不出厂占位。

## 5. 与 A 的关系
A(W648)是匀速拉伸顶替,间奏处仍飘。B 落地后,真实逐字时间使 A 的 `clockScale` 自然≈1;A 代码保留为"无对齐数据时"的优雅降级,不冲突。

## 6. 关键文件
- `src/index.ts`: `buildSubtitleSections`(~1234)、生成块(~1818–1860)、`enrichTimelineViaAudioAnalysis`(~1443)、`whisperTranscribe`(~4363)、`alignWordsViaWhisper`(~4427)、`upsertSubtitleJson`(~1385)、`SubToken/SubLine/SubSection` 类型(~1129–1143)。
- Python 音频分析服务(librosa 富集所在)—— 加 whisperX 对齐端点。
- 前端载体(已就绪,勿动):`app.emotion-subtitle-engine.js`(`subtitleJsonToCues`)、`app.watch-ui.js`(`renderWatchKaraokeOverlayModule`,W648 clockScale)。
