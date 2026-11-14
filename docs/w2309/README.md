# W2309 — 12 个作品的 ♪1 情绪字幕重做(2026-11-13)

Jing 2026-11-13 明确同意后执行(W2086 要求的「先问再做」已拿到 yes,
且是把 12 个作品逐条列出来之后的 yes)。

## 为什么要重做

它们的 ♪1 字幕里在唱舞台说明 / 曲风 / 配器 —— 例如
`Tempo: 48 BPM (slow and irregular, like breath in sleep)`、
`The stage is absolute darkness. No star, no horizon, no breath.`。
根因是旧解析器不认【跨行方括号块】(W2302 折叠 / W2303 解转义已修),
块的第二行起被当成歌词。解析器修好了, 但**已经落盘的字幕文件不会自己变干净**。

## 怎么做的

- 词源实测是 `user_works.lyrics_preview`(这 12 个作品 R2 `lyrics.json` 全 404、
  `work_language_tracks.lyrics` 全为空)→ 修好的折叠一定会生效, 不需要 `?lyrics_url=`。
- 写哪个文件由【这颗 ♪ 现在在读哪个】决定: 读作品级 → 普通 POST;
  读快照 → `?take=1&voice=…&snap=1`。反过来做就是白做一趟, 屏幕上一个字不变。
- 12 个作品每个只有一条轨、一条 audio 版本行 → 不存在「修一条毁一条」,
  也碰不到 Jing 要保留的旧情绪字幕。
- 12 颗 ♪ 的时长先逐个**整段解码**核对过(库里 vs 实测差 ≤0.5s, 12/12 一致),
  所以这一趟没有、也不该改任何 duration(否则新字幕的 `[Music...]` 尾奏会按错长度画)。
- 旧字节一律先按内容哈希落 `artifacts/subtitle-archive/sub-<sha24>.json`,
  回读 `cmp` 字节一致才动手; 存不住就什么都不做。
- 串行, 一个一个来。

## 第二趟(`--worklevel`)为什么必须有

`snap` 模式只重写 ♪1 真正在读的那个快照, 作品级 `works/<id>/subtitle-take1.json`
一个字节不碰(W2270 的 `snapshotOnly` 就是为此设计的)。于是那 3 首在作品级
那一份里**还留着污染的副本**。它当时是惰性的 —— 版本行的 `subtitle_url` 指着快照,
没有轨会回退到作品级。但 `user_works.subtitle_take1_json_url` 仍指着它, 而引擎在
「这颗 ♪ 没有自己的 subtitle_url」时就是回退到作品级 ——
**将来任何一次把版本行那一列清空的写入, 污染就当场复活。**
第二趟普通 POST 把作品级那一份也重写干净。实测这 3 首的作品级文件只有一个语言条目,
就是那条轨自己的语言, 所以没有附带影响。

## 结果

12/12 全净。独立复核三道:

- `scripts/w2308-judge-reachable-leaks.py` → **可达泄漏 0**(改前 12)
- `scripts/w2306-judge-overrun-reachability.py` → **可达越界 0 · 陈旧副本 0 · 判不了 0**
- 三份作品级副本按三段式判据复查 → **命中 0**

少唱的说明行合计 **32 行**(只数唱词, 不数 `[Music...]` 器乐段 —— 那是屏幕上的
随机音符 + 四方飘入 emoji, 不是文字, W2217 宪法)。

## 仍然不干净的 6 首: 歌词源本身拼坏了

`1a2188fc` / `2e8571a6`(And the LORD Called Moses)·
`36900764` / `3796e3b1`(בְּרֵאשִׁית הַסֵּפֶר)·
`77c9bbaf` / `baffb2d4`(After Moses, the River Waits)

它们的 `lyrics_preview` 是**物理拼坏的** —— 字节在行中间丢了:

```
ble learned the language of sacrifice,      ← 原本是 …assem|ble
anations listen: from Adam, all streams…    ← 原本是 …let the n|ations
eountain is quiet where Moses fell asleep,  ← 原本是 …the m|ountain
rone. Stage: Illuminated                    ← 说明被揉进了一行唱词里
```

每首还剩 4~10 行行首断字。**这不是解析器能修的** —— 重做只能去掉整行的说明,
断掉的字还在。库里和 R2 都没有干净副本(`work_language_tracks.lyrics` 长度 0、
`works/<id>/lyrics.json` 404), 要彻底干净只能重写歌词本身。

## 另一件只报不动

`adb98e04`(In the Beginning 的同名另一行)**整个作品没有字幕文件**(作品级 404、
轨的 `subtitle_url` 为空)。那是一个缺口, 不是泄漏, 没有在这一趟里动。

## 文件

- `scripts/w2309-redo-12-leaking-subtitles.py` —— 默认干跑, `--apply` 才真做,
  `--worklevel` 是第二趟; 已做干净的会自动跳过(可断点续跑)。
- `w2309-pass1.log` / `w2309-pass2-worklevel.log` —— 两趟的真实输出。
- 旧字节存档(15 份)地址见两份 log 里的 `旧字节已落 R2` 行; a5e80330 那一份是
  `artifacts/subtitle-archive/sub-700212085577305708eca409.json`。
