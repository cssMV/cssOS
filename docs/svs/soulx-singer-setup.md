# SVS 真人声唱词 · SoulX-Singer 接入 (W2083)

## 为什么是 SoulX-Singer

2026-09-05 全面调研后的唯一可选项 —— 四个硬条件同时满足的只有它一家:

| 条件 | SoulX-Singer |
|---|---|
| 授权可商用 | **Apache-2.0,代码和权重都是**(README 明确写「model weights」) |
| 会唱英文 | 4.2 万训练小时里英文约 2 万(另:普通话 2 万、粤语 2 千) |
| 照谱唱不重编曲 | `control=score`,吃音符+歌词 |
| 单卡跑得动 | 实测峰值显存 **1.6–2.7 GB**、RTF≈0.66(T4)。A10G 绰绰有余 |

- 仓库 https://github.com/Soul-AILab/SoulX-Singer · 权重 https://huggingface.co/Soul-AILab/SoulX-Singer
- 论文 arXiv 2602.07803

### 被排除的,以及为什么(踩过才知道)

- **Amphion Vevo2 / YingMusic-Singer**:README 写 MIT/开源,**HF 上的权重实际是 CC-BY-NC** ——
  我们的作品要卖,这类一个都不能用。**看 README 的许可证不算数,要看权重页。**
- **ACE-Step / YuE / DiffRhythm**:是「按文字生成歌」,不是照谱唱,会把圣诗重编曲。
- **NNSVS**:2023-10 之后没动过。
- **so-vits-svc**:已归档,且 AGPL 的网络条款对托管服务是硬伤。
- **RVC 系**:是音色转换,不产生「把词唱在音上」这件事本身,补不上这个环节。
- **openvpi/DiffSinger**:项目活跃,但上游 `dictionaries/` 到 v2.5.1 仍只有 `opencpop-extension.txt`
  一个中文词典;英文声库几乎全是 CC-BY-NC-ND,唯一明确允许商用的是 Hanami Hoshino。
  留作备选,不作首选。

### 两条还没解决的顾虑(不要假装它不存在)

1. **训练数据来源**:论文自述语料是「从商业录音中提取人声」。权重 Apache-2.0
   并不自动回答「拿它的产出去卖」这件事。要卖之前得有个说法。
2. **必须给参考音频**:不支持无参考推理,音色来自一段 prompt 音频。
   商用要用我们有权使用的人声,**不要克隆真实歌手**。

## 数据契约(逐位核对 `example/audio/music.json` 得出,不是照记忆写的)

五条序列 **严格一音符一 token,长度必须相等**:

```
text        <SP> Who says you're you're not pretty
phoneme     <SP> en_HH-UW1 en_S-EH1-Z en_Y-UH1-R en_Y-UH1-R en_N-AA1-T en_P-R-IH1-T-IY0
note_pitch  0    68        67         65         63         63        66
note_type   1    2         2          2          3          2         2
duration    0.16 0.24      0.32       0.15       0.17       0.24      0.15
```

- `note_type` **1=休止 2=新词/新音节 3=拖腔**(承接上一 token 的词)
- 休止:`text`/`phoneme` 都是 `<SP>`,**`note_pitch` 恒为 0**
  (`en_target.json` 里有非零的休止音高,那是 ASR 产物,不是规则 —— 别照抄那份)
- **音素格式:`en_` 前缀只在开头出现一次**,后面音素用 `-` 连 → `en_S-EH1-Z`。
  写成 `en_S-en_EH1-en_Z` 会全部查表落空。**我第一版就写错在这里,是比对真样例才发现的。**
- `phone_set.json` 共 2820 条,其中 **`en_` 只有 70 个单音素,没有任何复合 token** ——
  所以英文是**开放词表**,不是封闭声库。已验证:CMUdict 用到的 69 个 ARPAbet 音素 **100% 命中**。

## 工具:`scripts/svs-score-to-soulx.py`

MusicXML(`.mxl`/`.xml`)→ SoulX metadata JSON。已实测通过。

```bash
python3 scripts/svs-score-to-soulx.py <谱子>                       # 先列声部
python3 scripts/svs-score-to-soulx.py <谱子> --part P3 \
        -o take1.json --phone-set phone_set.json                   # 带词的谱子: 按谱对齐
```

- 谱子自带 `<lyric>` → 直接按谱对齐,**拖腔位置来自谱子,不猜**
- 读 `<tie>` 和 `<slur>` 的续音标记 → `note_type=3`
- `--phone-set` 会逐音素校验词表命中,不命中就拒绝输出(避免模型侧静默查空)
- 五条序列不等长直接拒绝输出

### 一个故意留成开关、没有替模型拿主意的地方

`--align word|syllable`(仅在谱子无歌词、靠外部歌词文件铺排时生效):

仓库英文样例里 "beautiful" 整词占**一个**音符;而圣诗的 "A-ma-zing" 要逐音节分到多个音符。
**模型训练时按哪种对齐,只有渲染出来听才知道。** 所以给开关,第一次 GPU 会话用同一首跑两遍对比。

## 已知的素材缺口 —— 圣诗这条线的真瓶颈不是 GPU

`scratchpad/hymn-inbox-multifaith/christian/` 里 7 份 Sacred Harp 谱子,实测:

```
slur 0   tie 0   lyric 0
```

纯音高+时值。**「哪个音节唱在哪个音符上」这个信息在源文件里根本不存在** ——
Sacred Harp 是形状音符谱,唱者先唱 fa-sol-la 再填词,出版常不印歌词。
(另:Sacred Harp 的**旋律在 tenor 声部**,不在 treble。)

→ 要唱圣诗,得先拿到**带歌词的**谱源。工具在没有依据时会直接拒绝输出,不会瞎铺排。

## GPU 侧待办(机器一到就跑)

1. `g5.xlarge` + Deep Learning OSS Nvidia AMI,装 SoulX-Singer + 权重(fp32 2.82 GB)
2. 先用仓库自带样例跑通 `example/infer.sh`,证明环境对
3. 换成本工具产出的 JSON,渲染一首带词的谱子 —— **这一步是全世界没人验证过的路径**
4. 同曲跑 `--align word` 与 `syllable` 两版,听差异,定下默认
5. 测 A10G 实际 RTF,算出每分钟人声的成本
6. **用完 terminate**(stop 不停止计费)
