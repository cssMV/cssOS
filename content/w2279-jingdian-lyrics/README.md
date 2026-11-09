# W2279 —— 35 首手写京典模版词

Jing 2026-11-08:「那 25 首要不要请照 Shakespeare 这个样子**一首一首**手写。
被拦的 10 首只能手写, 请排进去。」

## 为什么是手写而不是转译

这 35 首的中文源词【转译救不了】, 两种毛病:

| | 首数 | 毛病 |
|---|---|---|
| 短源 | 25 | 源词 18–37 行。`transcreateLyrics` 第 (5) 条明写「roughly the same line count per section」—— **它不会造行**, 所以永远到不了 10 节 40 行的完整度铁律。实测失败样子: 节数 9 / 行数 39 |
| 串台 | 10 | 源词是【别的作品的词】(2026-05-10 累加事故, 见 W2278)。转译出来会是「挂着 Einstein 名字的英文兰亭曲」。W2278 闸门把它们全拦住了 |

## 「一首一首」= 35 首各有自己的词, 没有一份复用

共用同一份中文源词的作品(7 首 Shakespeare 分属两份源, 5 首 Leibniz 同一份源,
4 首 Einstein, 3 首 Marx, 2 首 Curie / Gandhi / Aquinas)**没有共用英文词** ——
每首写一个不同的切面, 于是 35 个作品变成 35 首真不一样的歌, 而不是 35 份拷贝。

核对: `cut -f3 manifest-p1.tsv manifest-p2.tsv | sort -u | wc -l` = 35,
`cut -f1 manifest-p*.tsv | sort -u | wc -l` = 35, 且两者无交集重复。

## 每份词的八个京典特征

1. 十节结构 —— Verse 1·2 / Chorus 1 / Verse 3·4 / Chorus 2 / Bridge / Chorus 3·4 / Outro
2. `[Verse 1: <小节标题>]` —— 英文标签 + 该节自己的标题
3. `[Style: …]` **一律英文**(Suno 的硬要求), 按 civ 定曲风
4. `[Vocal: …]` 按 civ 定唱腔
5. **Bridge 里是该文明最古老的咒语, 每首都不一样** ——
   古英语七篇(Æcerbot · Wið færstice · 旅途咒 · 蜂群咒 · Wið Dweorh · Brunanburh · Wið Wennum)·
   古高地德语八篇(Merseburg 一 / 二 · Wessobrunn · Lorsch 蜂祝 · Pro Nessia ·
   Hildebrandslied · 马咒 · Petruslied · 维也纳犬祝)· 古拉丁三篇(Carmen Arvale ·
   Cato 160 · Cato 141)· 古希伯来四篇(祭司祝福 · Shema · 出海之歌 · 诗篇十九)·
   古希腊两篇(Ἐφέσια γράμματα · 库雷特颂)· 梵语两篇(Gayatri · असतो मा सद्गमय)·
   古意大利(维罗纳谜语)· 古法语两篇(斯特拉斯堡誓言 · 圣欧拉利亚)· 古荷兰(Hebban olla vogala)·
   古波兰两篇(Bogurodzica · 亨里科夫书)· 古教会斯拉夫语(创世之道)
6. 典故 + wiki 链接 —— 每份末尾 `[References — not sung]`
7. 一切非唱词都在方括号里
8. 高潮副歌带**该文明的经典名句逐字** —— Sonnet 55 · All the world's a stage ·
   To be or not to be · Shall I compare thee · Tomorrow and tomorrow · We few, we happy few ·
   Now my charms are all o'erthrown · Calculemus · Cum Deus calculat · Omnibus ex nihilo ·
   Theoria cum praxi · Nihil est sine ratione · Proletarier aller Länder vereinigt euch ·
   Das Kapital ist verstorbene Arbeit · Die Arbeiter haben kein Vaterland ·
   Raffiniert ist der Herrgott · Der glücklichste Gedanke meines Lebens · spukhafte Fernwirkung ·
   Hypotheses non fingo · l'amor che move il sole e l'altre stelle · Pange lingua ·
   Gratia non tollit naturam · Experimentum solum certificat · Cogito ergo sum ·
   Du sublime au ridicule · Freude schöner Götterfunken · Rien dans la vie n'est à craindre ·
   ἀγεωμέτρητος μηδεὶς εἰσίτω · ἄνδρα μοι ἔννεπε · रघुपति राघव राजा राम · करो या मरो

## 跑法

```
bash scripts/w2279-batch-handwritten.sh content/w2279-jingdian-lyrics/manifest-p1.tsv
```

manifest 每行三列 `<workId>\t<lang>\t<手写词文件绝对路径>`。
串行, 断点续跑(已有该语言 ready 轨的跳过), 一首失败不停整批, 末尾打印
「三类加起来 ≠ 清单」自查。

发之前先本地量:

```
python3 -I scripts/w2279-check-handwritten-lyrics.py content/w2279-jingdian-lyrics/*.txt
```

判据照抄 runner 的 PYGATE 与 `w2277-check-track-lyrics.py` 的 need 表:
节数 ≥ 10 · 词行 ≥ 40 · 括号外零源语言 · 目标语言字形 ≥ 50。
**够不上就不许进管线 —— 别花钱买半成品。**

## 还没动的一件事(需要 Jing 发话)

`user_works.style` 这一列会**原样进 Suno 的 prompt**
(`renderLanguageTrack` 的 `prompt: [baseTitle, baseStyle, voicePromptHint]`)。
这 35 首里有三首的 style 是中文、且与 civ 冲突:

| 作品 | 现在的 style |
|---|---|
| Leibniz `7b930b95` | `古琴` |
| Marx `9b6e777e` | `空灵古风 / 笛箫 / 留白` |
| Descartes `18fc4522` | `巴洛克` |

京典模版第 ③ ⑧ 条要求曲风必须英文。手写词里的 `[Style: …]` 已经是英文,
但库里这一列照样会一起喂进去。**改库里的 style 不在这一波的指令范围内, 没改。**
