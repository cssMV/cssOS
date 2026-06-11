# 《Jerusalem》情绪字幕 — 现实 vs 演出级(欣赏 + 设计)

> 取自真实文件 `https://cdn.cssstudio.app/works/f4c5e610.../subtitle-take1.json`(take 1, zh)。
> 同一句歌词「**晨光落在古城墙上**」(3.30s→5.70s)三栏对照。

---

## ① 顶层结构(真实)

```json
{
  "v": 1,
  "work_id": "f4c5e610-d921-433b-8c32-461a52a9d6ea",
  "take": 1,
  "updated_at": "2026-06-01T14:48:59.948Z",
  "languages": [ {"lang":"ja",…}, {"lang":"en",…}, {"lang":"zh",…} ]
}
```
每个 language → `sections[]`(段:Verse/Chorus…)→ `lines[]`(句)→ `tokens[]`(逐字)。
**画音分层铁律**:字幕是独立 JSON,永不烧进视频。每字一个 token,携带演唱的全部"情绪证据"。

---

## ② 现在的真实长相(B 未跑 = 占位)

```json
"晨光落在古城墙上"  // line t_start=3300  t_end=5700 ms  ← 行级时间是真的
tokens: [
  {"char":"晨","t_start":0,"t_end":300,"beat":1.562,"beat_strength":"off-beat","volume":0.108,"pitch_hz":null,"emotion":"serene","emotion_intensity":0.7},
  {"char":"光","t_start":0,"t_end":300,"beat":1.562,"beat_strength":"off-beat","volume":0.108,"pitch_hz":null,"emotion":"serene","emotion_intensity":0.7},
  {"char":"落","t_start":0,"t_end":300, … 完全相同 … },
  …其余 5 字全部一模一样…
]
```
**问题一目了然**:8 个字 `t_start/t_end/volume/emotion` 全相同 → 无法逐字咬字、无法逐字变情绪。
字级是"复制占位",`pitch_hz` 全 null。这就是为什么现在看起来"颜色都差不多"。

---

## ③ B(whisperX/Whisper forced-align + librosa)之后该长成的样子 —— 演出级

> 同一句,字级时间落在真实演唱窗口、音量/音高/情绪逐字不同(示意,数值来自真实对齐时会自动填充):

```json
"晨光落在古城墙上"  // 3.30s → 5.70s
tokens: [
  {"char":"晨","t_start":3300,"t_end":3560,"beat":1.0,"beat_strength":"down-beat","volume":0.42,"pitch_hz":262,"emotion":"serene","emotion_intensity":0.55},
  {"char":"光","t_start":3560,"t_end":4180,"beat":1.5,"beat_strength":"on-beat","volume":0.78,"pitch_hz":330,"emotion":"hope","emotion_intensity":0.82},  // ← 长音:0.62s,音量爆到 0.78 → 字号放大+发光
  {"char":"落","t_start":4180,"t_end":4400,"beat":2.0,"beat_strength":"off-beat","volume":0.40,"pitch_hz":294,"emotion":"serene","emotion_intensity":0.5},
  {"char":"在","t_start":4400,"t_end":4560,"beat":2.5,"beat_strength":"off-beat","volume":0.31,"pitch_hz":277,"emotion":"calm","emotion_intensity":0.45},
  {"char":"古","t_start":4560,"t_end":4980,"beat":3.0,"beat_strength":"down-beat","volume":0.66,"pitch_hz":311,"emotion":"resolve","emotion_intensity":0.7},
  {"char":"城","t_start":4980,"t_end":5240,"beat":3.5,"beat_strength":"on-beat","volume":0.58,"pitch_hz":330,"emotion":"resolve","emotion_intensity":0.68},
  {"char":"墙","t_start":5240,"t_end":5460,"beat":4.0,"beat_strength":"off-beat","volume":0.49,"pitch_hz":294,"emotion":"calm","emotion_intensity":0.55},
  {"char":"上","t_start":5460,"t_end":5700,"beat":4.5,"beat_strength":"on-beat","volume":0.52,"pitch_hz":349,"emotion":"hope","emotion_intensity":0.6}
]
```

前端渲染映射(已就绪):
| 字段 | 表达 |
|---|---|
| `t_start→t_end` | 咬字时刻 + 亮起时长(长音=亮更久) |
| `volume` | 字号 / 爆字 / 发光强度 |
| `pitch_hz` | 音高 → 微微上浮/色温 |
| `beat_strength` | 鼓点重音 → 节拍弹跳 |
| `emotion` + `intensity` | 颜色 / 字体 / 动效(serene 青、hope 金、ignite 火红、grief 紫…) |

「**光**」字唱腔拉长 0.62s + 音量 0.78 + 情绪 hope → 它会**比别的字大一圈、镀金发光、亮得更久** = 你脑中那个画面。

---

## ④ 点睛之笔:情绪 Emoji(你的提议 — 我非常赞同)

**规则(克制、偶发、分层不烧录):**
- 仅当某字 **情绪强烈(intensity ≥ 0.85)且 唱腔拉长(t_end−t_start ≥ 0.8s)** 时,才在该字旁**临时**蹦出对应 emoji + 短动画(浮起→放大→淡出 ~1.2s),不常驻、不挡字。
- 情绪→符号映射(示例):
  - 爱/intimate → 💗💕   ・ joy → ✨🌟   ・ ignite/热烈 → 🔥
  - grief/哀 → 💧   ・ hope/盼 → 🕊️   ・ resolve/坚定 → ⛰️   ・ serene/宁 → 🌙
- 例:「我**爱**你」——「爱」字拉唱 → 旁边浮起 `💗💗`,轻轻放大后淡出。点睛、增美,不喧宾夺主。

**实现位**:前端 `renderWatchKaraokeOverlayModule`,在 active word 满足阈值时注入一个 `.cssmv-emo-emoji`(absolute、pointer-events:none、CSS keyframe float-pop-fade),数据驱动来自 token 的 `emotion`+`emotion_intensity`+时长。后端无需改;B 把真实数值填上后,emoji 自然就在"该爆发的字"上绽放。

> 立项备注:此为 B 上线后的"美学增强层",可作为 W649 紧随其后。
