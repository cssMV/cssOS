# W2280 —— 裸段落标签: 43 首, 但伤害比我上一轮说的小得多

Jing 2026-11-08:「D4 那 40 首裸段落标签 —— 请单独立一波。」

## 先更正我自己上一轮的话

我上一轮报的是「**40 首**, `Chorus` / `Pre-Chorus` / `Bridge` 裸着,
**会被引擎当歌词唱出来**」。两处都要修:

| | 上一轮我说的 | 实测 |
|---|---|---|
| 首数 | 40 | **43**(W2278 的 D4 借了串台检测的 `namelines()`, 那个正则要求「首字母大写、不含数字」, 于是 `chorus` / `verse 1` / `Verse 2` 全漏) |
| 伤害 | 会被唱出来 | **43 首里只有 2 首真唱了**。另外 23 首被管线静默过滤, 屏幕上干净 |

「会被唱出来」这句**对 2 首成立, 对另外 41 首不成立**。

## 毛病的样子

这些词是 Markdown 风格的 LLM 输出:`⸻`(U+2E3B)当分隔线, 段落标题裸着写。

```
⸻

Pre-Chorus

We lift our eyes
We're longing for Your glory

⸻

Chorus
```

音乐引擎只把**方括号里**的东西当指令, 括号外一律当唱词。

## 五类定性(43 首, 加起来必须等于 43)

| 类 | 首数 | 是什么 | 该怎么办 |
|---|---|---|---|
| **A 标签真被唱了** | **2** | 字幕里有整行只是标签。`95c68a84`(孔子, 整份 `lyrics_preview` 就是单词 `Music`)· `ff685bc8`(Founding Subscriber, 词里 `Music, Music`) | 这两首的词本身是废的, 要重写 → **须先问 Jing** |
| **B 字幕本身坏了** | **8** | 有音频, 但歌词 48–75 行而字幕只有 2–4 行。这是**另一种、更重**的毛病, 不是裸标签造成的 | 重做字幕(resubtitle) → **须先问 Jing** |
| **C 字幕源自歌词, 标签被过滤** | **23** | 正文行在字幕里命中 74–100%, 标签一个都没进字幕 → **屏幕上干净**。脏的只是当初喂给 Suno 的那份 prompt | 成品不动(版本铁律)。要补就新起版本 → **须先问 Jing** |
| **D 对不上, 需人耳** | **1** | `f2280726` Jerusalem, 5 条语言轨共用 take1, 121 词行 vs 130 字幕行、命中 50% | 先别动 |
| **E 还没有音频** | **9** | 从没唱过。改词是纯收益, 不碰任何成品 | 改词成本最低的一批 |

B 类具体是 4 个标题各两份重复:
`And the LORD Called Moses`(75→4 行)· `The Chains That Built the Cities`(63→2)·
`The Dreams of Mahway`(48→2)· `בְּרֵאשִׁית הַסֵּפֶר`(58→2)。

## 顺手撞到的另一件事: 18 首共用同一份词, 跨三个标题

逐字节哈希比出来的, 不是眼睛看的:

```
词哈希 [d219845836fa6493] —— 18 个作品共用【逐字节相同】的一份词
标题分布: Su Wu ×10 · Jerusalem ×6 · Dog walker ×2
最早: 1b2586c3 'Jerusalem' 2026-05-03 15:35
```

那份词是一首 Jerusalem 赞美诗(`Jerusalem, holy and bright / Coming down in heaven's light`)。
**10 首标 `civ=中华文明` 的《Su Wu》(苏武, 汉代使节)唱的是它**, 另有 2 首《Dog walker》。
这 12 首是 W2278 那类串台, 但 D2 抓不到 —— 因为 "Jerusalem" 不是裸人名行,
它藏在歌词句子里。**处置须先问 Jing(重生成铁律)。**

## 这一波已经落地的(不碰任何数据)

| | |
|---|---|
| `scripts/w2280-audit-bare-section-labels.py` | 全库巡检 + 五类定性。`--calibrate` 三向自检; `--no-cdn` 只扫库 |
| `scripts/w2280-check-lyric-labels.py` | 单首闸门, 退出码 0 干净 / 1 拦 / 2 判不了也拦。接口与 W2278 闸门一致 |
| `scripts/w2277-add-mother-tongue-track.sh` | 闸门接在 POST **之前**、备份之前 —— 拦住不花钱。默认/`--sing-preview` 判库里的 `lyrics_preview`, `--lyrics-file` 判那份文件 |

**一份数据都没改。** A/B/C/D 的处置全部涉及重写词或重做成品,
按 W2086 铁律必须先拿到 Jing 明确的「yes」。

## 我在这一波里把判据写坏过两次 —— 都记下来

**错 1(检测侧)**: 借用 `namelines()` = 继承它的盲区(要求首字母大写、不含数字),
`chorus` / `verse 1` 全漏。**要抓什么就自己写判据, 别借别的检测器的辅助函数。**

**错 2(定性侧)**: 判「有没有被唱出来」, 我第一版把字幕 JSON 里**所有字符串**
都捞出来找标签词, 于是命中两种假证据:

- `languages[].sections[].tag` —— 那是**结构字段**, 它本来就叫 `chorus`/`verse`/`music`,
  跟唱没唱毫无关系。**43 首全报 SUNG, 全是假的。**
- `lines[].tokens[].char` —— tokens 是**逐词**的, 所以 `break` 会从真歌词
  `too big to break` 里命中, `music` 会从 `the music stays` 里命中。
  **6 首 break 因此被误判成「唱了标签」。**

字幕真源(`app.emotion-subtitle-engine.js`)的结构是:

```
languages[].sections[].tag                    ← 结构, 排除
languages[].sections[].lines[].text           ← 唱词【整行】, 只认这个
languages[].sections[].lines[].tokens[].char  ← 逐词, 不能当整行用
```

收紧成「整行 == 标签」之后, 43 首里只剩 2 首。
**判「整行是不是只有标签」, 就只能看整行。** 校准因此加了第三向:
一份含 `too big to break` / `the music stays` 的真歌词必须**不被**命中。

另外:「字幕里没有那个标签」**不能直接当「没唱」** —— 还要先证明字幕是
**从这份歌词来的**(正文行命中率 ≥ 70%)。否则标签缺席只说明 ASR 没听见,
那是把【我没查到】当成【没有】(W2138)。C 类的定性就靠这一步。
