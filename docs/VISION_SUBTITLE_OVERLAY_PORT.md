# Vision / tvOS 字幕微调 overlay 移植清单（照着搬到 Swift 即可）

> 目标：让 visionOS / tvOS 端的字幕与桌面端**完全一致** —— 不只是读同一个基底熟字幕文件
> (`subtitle-take1.json`)，还要把用户在桌面做的**非破坏微调**套上去。
> 桌面真源实现：`public/app.emotion-subtitle-engine.js`（本文档逐条对照它）。

---

## 0. 数据来源（你已经在读）

`GET /api/works/:id/language-tracks` 的响应里，**作品级**（对所有轨相同）带这 4 个 overlay 字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `subtitle_offset_ms` | `Int?`（有符号，ms） | **全局对齐**：所有字/句整体前后移 |
| `subtitle_line_offsets` | `[String:Int]?`（`{行号: ms}`） | **单句 / 整体平移**：第 N 句整句前后移 |
| `subtitle_token_offsets` | `[String:Int]?`（`{原始字起始ms: ms}`） | **逐字对齐**：某个字单独前后移 |
| `subtitle_token_edits` | `{added:[…], deleted:[…], renamed:{…}}?` | **加 / 删 / 改字**（见 §2） |

（`vol_curve` 是桌面波形编辑器用的，Vision 显示**不需要**，忽略。）

**基底文件**：`subtitle-take1.json` 顶层 `languages[].sections[].lines[].tokens[]`，
每个 token 有 `char`(或 `text`)、`t_start`(ms)、`t_end`(ms)、`emotion`、`emotion_intensity`、`pitch_hz`、`adlib`。
行有 `t_start`/`t_end`(ms)。

---

## 1. 应用流水线（顺序**不能乱**）

对每一种语言，拿到该语言的 `sections → lines → tokens` 后，按序做：

```
① 解析基底 → 逐句 cue，每句 words[]（秒制：t_ms/1000）
② 占位时间轴检测 + 均匀重分布   （§3，桌面 subtitleJsonToCues 里做的）
③ 应用 token_edits：删 → 改字 → 加   （§2）
④ 应用拖腔：延长每句最后一个字的 end   （§4）
⑤ 应用偏移：全局 + 单句 + 逐字   （§5，最后一步）
```

> 桌面顺序：②③在 `subtitleJsonToCues`/`_applyTokenEdits`，④其实在②之后（本文档把④独立列出更清晰，
> 放④在③之后**更正确**——加/删字后的"最后一个字"才是真的最后一个字），⑤在 `applyWithOffset`。

**关键**：③④用的都是**原始（未偏移）时间**；⑤最后统一加偏移。所有 overlay 的 key 都基于**原始时间**。

---

## 2. token_edits：加 / 删 / 改字

形状（后端存储 & language-tracks 返回）：
```json
{
  "added":   [ { "id":"u123456", "text":"字", "t":12.34, "line":5, "emo":null } ],
  "deleted": [ "12340", "56780" ],
  "renamed": { "12340": "新字" }
}
```

- **key 一律是**「该字**原始起始秒 × 1000 后四舍五入取整**」的**字符串**：`key = String(Int((word.t_start_seconds*1000).rounded()))`。
  （与 `subtitle_token_offsets` / `deleted` / `renamed` 同一套 key。）

应用（对每一句的 words[]）：
1. **删**：若 `deleted` 含某 word 的 key → 从 words 移除。
2. **改字**：若 `renamed[key]` 存在 → 把该 word 的显示文字换成 `renamed[key]`（≤40 字）。**只改文字，时间不动**。
3. **加**：对 `added` 里每条 `a`：
   - 目标句 = `a.line`（若非空且在范围内），否则按时间 `a.t` 落到最近的句。
   - 新 word：`{ text:a.text, t_start:a.t, t_end:a.t+0.5, emotion:a.emo, adlib:true }`（时长默认 0.5s）。
   - 插入该句 words 后**按 t_start 重新排序**；若 `a.t+0.5 > 句.t_end` 则把句 end 撑到 `a.t+0.5`；若 `a.t < 句.t_start` 则句 start 提前到 `a.t`。

（原字幕 JSON 永不改；这些都是叠加。空集 → 完全不动，行为与旧版逐字节一致。）

---

## 3. 占位时间轴 → 均匀重分布（前置）

很多作品的**逐字**时间是占位假数据（整句所有字挤在 0 附近）。判定「真」：
```
tokenTimingReal = words.count > 1
  && words.last.t_start > words.first.t_start + 0.05
  && words.first.t_start >= line.t_start - 1
```
若**不真** → 把该句的字**按字数均匀铺**到 `[line.t_start, cueEnd]`（`cueEnd = line.t_end>line.t_start ? line.t_end : line.t_start+3.5`），
**保留每字的 emotion/emphasis**（招牌情绪不能丢）：
```
step = max(0.4, cueEnd - line.t_start) / words.count
word[i].t_start = line.t_start + i*step
word[i].t_end   = line.t_start + (i+1)*step
```
行级时间是真的（上层 forced-align 对齐过），字级先匀速顶着。

---

## 4. 拖腔公式（每句最后一个字显示延长到下一句）

```
GAP = 0.08          // 与下一句留 80ms 缝
MAX_HOLD = 6.0      // 单字最多再延 6s（跨长间奏封顶，免得一个字亮穿整段间奏）

for i in 0..<cues.count:
    lastWord  = cues[i].words.last          // 无 words 用句 end
    natural   = lastWord.t_end
    nextStart = (i+1 < cues.count) ? cues[i+1].t_start : nil
    if let ns = nextStart, ns > natural:
        target = min(ns - GAP, natural + MAX_HOLD)
    else if nextStart == nil:               // 末句
        target = natural + MAX_HOLD
    else:                                    // 下一句已重叠/更早 → 不动
        target = natural
    if target > natural:
        lastWord.t_end = target
        cues[i].t_end  = max(cues[i].t_end, target)   // 句尾也跟着延
```
**只延不缩**；逐字 onset(start)**不动**，只动 end。这样持续尾音的字幕不早退。

---

## 5. 偏移：全局 + 单句 + 逐字（最后一步）

全部换算成秒：`gOff = subtitle_offset_ms/1000`；`lineOff[i] = (line_offsets["\(i)"] ?? 0)/1000`；
`tokOff(word) = (token_offsets[wordKey] ?? 0)/1000`，其中 `wordKey = String(Int((word.rawStart*1000).rounded()))`（**用原始 start**，不是已偏移的）。

- **句（决定这句何时上/下屏）**：
  ```
  displayLineStart = max(0, cue.t_start + gOff + lineOff[i])
  displayLineEnd   = max(0, cue.t_end   + gOff + lineOff[i])   // t_end 已含拖腔
  ```
- **字（决定逐字点亮/上色时刻）**：每个字**额外**加自己的逐字偏移：
  ```
  wordStart = max(0, word.t_start + gOff + lineOff[i] + tokOff(word))
  wordEnd   = max(0, word.t_end   + gOff + lineOff[i] + tokOff(word))
  ```
  （即：句整体走 全局+单句；每个字再叠自己的逐字偏移。clamp 到 ≥ 0，不能为负。）

---

## 6. 落地建议

- 把 §1 的 ①→⑤ 做成一个纯函数：`func buildCookedCues(base, offsets, lineOffsets, tokenOffsets, tokenEdits) -> [Cue]`，
  输入全来自 language-tracks，输出给现有的 `SpatialSubtitleSystem` / `SubtitleLineView` 用。
- key 计算务必和桌面一致：`Int((seconds*1000).rounded())` 再 `String(...)`。差 1ms 就对不上逐字偏移。
- 空 overlay（都 nil/空）→ 直接返回基底 cues，行为与现在**完全一致**（可先合入，零回归）。
- 桌面对照源：`public/app.emotion-subtitle-engine.js`
  （`subtitleJsonToCues` = ②④、`_applyTokenEdits` = ③、`applyWithOffset` = ⑤）。
