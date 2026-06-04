# cssOS — 广告视频结尾字幕 CTA 模板（CapCut 用）

> 目标：把"看完惊叹一下就划走"变成"现在就去做一个"。
> 每条视频最后 **2–3 秒** 加一个 end-card，强 CTA + 强动机。

---

## 0. 黄金法则（先记这 5 条）

1. **CTA 出现时机**：视频高潮后 / 最后 2–3 秒，别太早（毁观看完成率）。
2. **一屏只说一件事**：就一个动作 —— "去做一个"。不要又点赞又关注又下载。
3. **降门槛 > 吹功能**："免费 3 次 / 无需信用卡 / 30 秒" 比 "AI 驱动 60+ 引擎" 有用 10 倍。
4. **动词开头**：Make / Try / Create / 做 / 试。不要名词堆砌。
5. **链接同步喊出来**：字幕 + 语音 + 主页链接三处一致 → "link in bio"。

---

## Part A — 通用 End-Card（套任何题材）

### 🅰 英文版（3 行，逐行 0.8s 弹出）

```
Line 1  (大字, 白)     You just watched AI make this.
Line 2  (中字, 绿)     One sentence → a full MV in 30s.
Line 3  (CTA 胶囊)     ▶ Make yours free — link in bio
```

### 🅱 中文版

```
第 1 行  (大字, 白)     这支 MV，AI 30 秒做的。
第 2 行  (中字, 绿)     一句话 → 整支音乐视频。
第 3 行  (CTA 胶囊)     ▶ 免费做一支 · 主页链接
```

### 🅲 双语极简（海外+华人都吃）

```
Make your own.  免费做一支
30s · 3 free · no card
▶ link in bio
```

---

## Part B — 分题材 End-Card（配你的 5 个钩子）

> 用人物自身的"反差"当钩子，结尾再翻成"你也能做"。

### 钩子 1 — Confucius × Hyperpop
```
Confucius just dropped a hyperpop banger.
你能让任何人唱任何歌。
▶ Make yours free — link in bio
```

### 钩子 2 — 李白 × 古风
```
李白的《将进酒》，AI 谱成曲了。
你的诗，也能变成 MV。
▶ 免费做一支 · 主页链接
```

### 钩子 3 — Westworld × 京剧
```
Cowboy androids singing Beijing opera.
If AI can do THIS — imagine your idea.
▶ Make yours free — link in bio
```

### 钩子 4 — Einstein × Drill
```
Einstein on a UK drill beat. Yes, really.
Your turn. One prompt. 30 seconds.
▶ Make yours free — link in bio
```

### 钩子 5 — Cleopatra × Techno
```
Cleopatra just played a Berlin techno set.
Pick anyone. Pick any genre. Go.
▶ Make yours free — link in bio
```

---

## Part C — CapCut 落地参数（直接照抄）

### 文字样式
| 参数 | 值 |
|---|---|
| 字体 | 思源黑体 Bold / Montserrat ExtraBold（粗、无衬线） |
| 主标颜色 | `#FFFFFF` 白 |
| 副标颜色 | `#00F5A0` cssOS 绿 |
| CTA 胶囊底 | `#00F5A0` 填充，文字 `#001B14` 深墨绿 |
| 描边 | 黑色 4–6px（保证任何画面都看得清） |
| 阴影 | Y+4 模糊 8 黑 50% |

### 动画
| 元素 | 入场 | 时长 |
|---|---|---|
| 主标 | 向上滑入 + 淡入 | 0.3s |
| 副标 | 延迟 0.4s 跟上 | 0.3s |
| CTA 胶囊 | 弹性放大 (scale 0.9→1) + 微呼吸循环 | 0.4s 入 + loop |

### 时间轴
```
视频总长 30s
├─ 0:00–0:27   正片（人物 MV 高潮）
├─ 0:27–0:30   End-card 叠在最后一帧（画面降速 50% + 轻暗角）
└─ 整条        右上角常驻小水印 "cssOS" + 主页链接（10% 不透明度）
```

### 语音口播（结尾 2 秒，配字幕）
- EN: *"Make your own — free. Link in bio."*
- 中: *"免费做一支，主页链接。"*

---

## Part D — A/B 测试矩阵（这次别再盲投）

同一条正片，**只改 end-card**，跑 2–3 个变体各 $15：

| 变体 | CTA 文案 | 测什么 |
|---|---|---|
| A | "Make yours free" | 免费驱动 |
| B | "Try it in 30 seconds" | 速度驱动 |
| C | "What would YOU make?" | 好奇驱动 |

**看板指标**（落地页 `share_cta_events` 表已埋点）：
```sql
SELECT utm, action, count(*)
FROM share_cta_events
WHERE created_at > now() - interval '3 days'
GROUP BY utm, action ORDER BY utm;
```
对比 `cta_click / cta_shown`，赢家加预算。

---

## Part E — 一句话总结贴墙上

> **正片让人惊叹，end-card 让人行动。**
> 没有 end-card 的广告 = 给别人免费看戏，自己买单。

---

cssOS · 2026-05-20 · [cssstudio.app](https://cssstudio.app)
