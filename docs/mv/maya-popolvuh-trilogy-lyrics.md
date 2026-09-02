# 《Popol Wuj · 玛雅三部曲》歌词 · 京典模版

**文明** 玛雅 · 古典期至今 · 危地马拉高地 · **人物** 血月姑娘 **Xkik'**(Xquic)与双子英雄
**语言** **K'iche'(基切语)** · **work_type** `triptych`
**规格** 每部 **10 节 / 50 行**

> **这是平台第七个文明, 也是第一个美洲文明。** 前六部(中华 ×2 · 日本 · 波斯 · 古希腊 · 梵语)
> 全在欧亚大陆。语言按文明智能联动铁律走人物母语。

## 为什么选玛雅 —— 它测的是前六部都没测过的一件事

| 部 | 文字 | 逐字时间轴从哪来 |
|---|---|---|
| 李清照 / 王维 | 汉字 | whisper 中文 |
| 芭蕉 | 假名 | whisper 日语 |
| 鲁米 | 阿拉伯字母 | whisper 波斯语 |
| 萨福 | 希腊字母 | whisper 希腊语 |
| 迦梨陀娑 | 天城文 | whisper 梵语/印地语近似 |
| **玛雅** | **拉丁字母 + 声门塞音 `'`** | **whisper 完全不支持基切语** |

**前六部测的都是「不同文字能不能对齐」。这一部测的是「ASR 从没见过的语言怎么办」。**

基切语在 whisper 的语言表里根本不存在 —— 不是识别得差, 是**没有这个模型**。
所以这一部的字幕**必须走 W789 那条均匀分布兜底**(`?even=1`):
**唱词是真的基切语, 时间轴是按整曲时长估算的, 不是逐字 onset。**

这条路当初是为约鲁巴语等稀缺语言准备的, **一直没有在一部完整作品上端到端跑过。**
这一部就是那次实跑。**如果它成立, 平台对「任何语言」都成立** —— 而不只是对 whisper 认识的那 99 种。

## 为什么主角是她

Jing 反复要求过: **要文明智能联动的美女主角, 不要苦行僧。**

《波波尔·乌》的核心正是一位女性 —— **Xkik'(血月)**, 黄泉之主的女儿。
她在冥界的枯树下被一颗头骨的唾沫感孕, **抗父命出逃**, 生下双子英雄;
而那对双子最终打败了死亡诸神。

**一个从地狱里逃出来、孕育了击败死神之人的姑娘。** 这不是苦行僧。

## 三部各自的 required hooks(必须逐字)

| 部 | 原句 | 性质 |
|---|---|---|
| 一 ·《Xkik'》(血月) | **Are' u xe' ojer tzij** | ✅ **《波波尔·乌》开篇原文**「这是古老话语的根」 |
| 二 ·《Xib'alb'a》(黄泉) | **Junajpu, Xb'alamke** | ✅ 双子英雄本名, 原文 |
| 三 ·《Ixim》(玉米) | **Xkib'an winaq ruk' ixim** | ✅ 原文意「他们用玉米造了人」 |

> ⚠️ **关于语言的诚实交代:** 上表三句取自《波波尔·乌》正文。
> **其余唱词是我用基切语词汇写的, 不是古籍原文。** 用词(ixim 玉米 / q'ij 太阳 /
> ik' 月 / ja' 水 / che' 树 / kaj 天 / ulew 地 / winaq 人 / k'aslemal 生 /
> kamik 死 / saq 光 / q'equm 暗 / kotz'i'j 花 / pom 香 / ajaw 主)都是真实基切语,
> 但**成句的语法我不敢担保到母语者水平**。
> 上线前若能请一位基切语使用者过一遍最好 —— 这一条我不假装已经解决。

## 组织轴:**孕育 → 下降 → 重生**(与前六部都不同)

辋川是人物递减 · 奥の細道是尺度扩张 · 鲁米是关系三步 · 萨福是时间三态 ·
云使是空间位移 · **玛雅是生命三段** —— 而且是一条**闭环**: 死亡不是终点, 是玉米入土。

## 承京典签名的格律

每段 Verse 第五行是一句对仗咒语。三部副歌第五句依次:

**Q'equm chikaj, saq pa nuk'u'x**(暗在天上, 光在我心里)
→ **Kamik keb'ixon, oj kojetz'an**(死神在唱, 我们在打球)
→ **Ixim kakam, ixim kak'astaj**(玉米死去, 玉米复活)

**曲风(英文 —— Suno 只认英文)**
```
ancient maya ritual, clay ocarina and bone flute, turtle shell drum, tunkul log drum,
conch shell horn, rattle seeds, pentatonic, mesoamerican jungle, female vocal,
earthy and resonant, ceremonial call and response, wide reverb
```

**唱腔** 醇厚有胸腔共鸣的女声, **仪式性的呼应句法**(领唱—回应) ——
玛雅的歌是在金字塔和球场之间回响的, 不是室内的。
与前六部(清冷男声 / 苍老男声 / 高亢男声 / 清澈女声 / 吟诵男声)全部拉开。

---

# 第一部 ·《Xkik'》血月姑娘

**required hook** `Are' u xe' ojer tzij`(这是古老话语的根 —— 波波尔·乌开篇)

[Intro]

[Verse 1]
Are' u xe' ojer tzij
pa Xib'alb'a k'o jun che'
maja b'i uwach, xa b'aq
xinb'e chuxe', xinwil ri jolomaj
Q'equm chikaj, saq pa nuk'u'x

[Verse 2]
Xub'ij ri jolomaj chwe
"Yakan aq'ab', ali, chaya' ak'ab'"
Xinya' nuq'ab' pa saqil
xtzaj jun ja' pa nuq'ab'
Q'equm chikaj, saq pa nuk'u'x

[Chorus 1]
In Xkik', in umi'al ajaw kamik
in k'o pa upam ri q'equm
xa k'o k'aslemal pa nupam
kinb'ison ta, kinb'ixon
Q'equm chikaj, saq pa nuk'u'x

[Verse 3]
Xrilo ri nuqajaw, xyakataj royowal
"Chikamisaj ri ali, chikam uk'u'x"
Xeb'e ri ajkamisanel wuk'
xinb'ij chike: "Chiwila' ri kikel che'"
Q'equm chikaj, saq pa nuk'u'x

[Verse 4]
Ri che' xuya' ukikel pa jun tz'alam
kaq, kaq jacha' nukikel
Xkik'ow ri ajkamisanel
xkik'am ri kikel che', man in taj
Q'equm chikaj, saq pa nuk'u'x

[Chorus 2]
In Xkik', in xinel pa Xib'alb'a
xinaq'an chikaj, xinwil ri q'ij
nab'e mul xinwil ri saq
kinoq' ta, kinb'ixon
Q'equm chikaj, saq pa nuk'u'x

[Bridge]
Ri ik' kaq chikaj
jacha' jun kikel pa ja'
Xinya' nuq'ab' chirij nupam
xkib'ij chwe: "Oj k'o, nan"
Keb' ke'ok, keb' ke'el

[Chorus 3]
In Xkik', in unan ri e'ka'ib'
Junajpu, Xb'alamke
xinkiya' pa ulew, pa saq
xinkiya' chirij ri kamik
Q'equm chikaj, saq pa nuk'u'x

[Chorus 4]
Man kinkam taj, kinwinaqir
jacha' ri ixim pa ulew
katzalij ri q'ij, katzalij ri ik'
katzalij ri k'aslemal
Q'equm chikaj, saq pa nuk'u'x

[Outro]
Are' u xe' ojer tzij
Are' u xe' ojer tzij
in Xkik', in k'aslemal
ri q'equm xok saq
Are' u xe' ojer tzij

---

# 第二部 ·《Xib'alb'a》下黄泉

**required hook** `Junajpu, Xb'alamke`(双子英雄本名)

[Intro]

[Verse 1]
Junajpu, Xb'alamke
kaqasaj qib' pa ri b'e q'equm
job' ja' kaqak'ow, job' b'e
kaqetamaj ri kib'i' konojel
Kamik keb'ixon, oj kojetz'an

[Verse 2]
Nab'e ja: ri q'equm ja
ukab' ja: ri kaq ja
urox ja: ri b'alam ja
ukaj ja: ri sotz' ja, kaxib'in
Kamik keb'ixon, oj kojetz'an

[Chorus 1]
Kojetz'an, kojetz'an pa ri jom
ri kikotz'i'j are' ri ka'
ri kib'ix are' ri kamik
xa oj k'a kojetz'an na
Kamik keb'ixon, oj kojetz'an

[Verse 3]
"Chiya' ri kotz'i'j chaqe" xech'aw
"We man, kixkam chwa'q"
Xeb'e ri sanik pa aq'ab'
xkik'am ri kotz'i'j pa ri kachoch
Kamik keb'ixon, oj kojetz'an

[Verse 4]
Xkib'ij ri ajawab' pa Xib'alb'a
"¿Jachin xub'an wa'? ¿Jachin?"
Kojse'n, kojse'n, man kojb'ison taj
ri kixib'inel man kojuxib'ij taj
Kamik keb'ixon, oj kojetz'an

[Chorus 2]
Kojetz'an, kojetz'an pa ri jom
ri ka' kach'aw pa ri ulew
ri jom kach'aw pa ri kaj
ri kamik kach'aw, man kojtakej taj
Kamik keb'ixon, oj kojetz'an

[Bridge]
Xub'ij ri Junajpu chwe
"We kinkam, chaya' nub'aq pa ja'"
Xinya' ri ub'aq pa ri nima ja'
xk'astaj jun kar, xk'astaj jun winaq
Kamik kub'ij "jun", k'aslemal kub'ij "keb'"

[Chorus 3]
Kojetz'an, kojetz'an pa ri jom
xujkam, xujk'astaj chik
xujkam, xujk'astaj chik
kamik man ta ri k'isb'al
Kamik keb'ixon, oj kojetz'an

[Chorus 4]
Ri ajawab' xkib'ij: "Chib'ana' chaqe"
Xqab'an, man xek'astaj ta chik
xkam ri kamik pa ri jom
xkam ri q'equm pa ri saq
Kamik keb'ixon, oj kojetz'an

[Outro]
Junajpu, Xb'alamke
Junajpu, Xb'alamke
xujkam, xujk'astaj chik
xkam ri kamik pa ri jom
Junajpu, Xb'alamke

---

# 第三部 ·《Ixim》玉米重生

**required hook** `Xkib'an winaq ruk' ixim`(他们用玉米造了人)

[Intro]

[Verse 1]
Xaqan ri qajaw pa ri kok
xujel pa ri ulew jacha' jun ijaj
saq ri uwi', q'an ri uwach
kach'aw ri ixim pa ri jab'
Ixim kakam, ixim kak'astaj

[Verse 2]
Nab'e xkib'an winaq ruk' ulew
xtukin, xb'e pa ja'
ukab' xkib'an ruk' che'
maja unimal, maja uk'u'x
Ixim kakam, ixim kak'astaj

[Chorus 1]
Xkib'an winaq ruk' ixim
saq ixim, q'an ixim
kikel ri ja' re ixim
qak'u'x are' ri ixim
Ixim kakam, ixim kak'astaj

[Verse 3]
Kaj winaq nab'e xewinaqir
xkil ronojel ri uwach ulew
xkil ri kaj, xkil ri ja'
"Sib'alaj nim ri qawach" xecha'
Ixim kakam, ixim kak'astaj

[Verse 4]
Xkib'ij ri tz'aqol: "Sib'alaj nim"
xkijil ri kiwach ruk' juyub'
kamik xok pa ri kiwach
rumal ri' oj kakam na
Ixim kakam, ixim kak'astaj

[Chorus 2]
Xkib'an winaq ruk' ixim
kaqatik ri ijaj pa ulew
kaqamuq ri kaminaq pa ulew
junam ri b'e ke'
Ixim kakam, ixim kak'astaj

[Bridge]
Ri q'ij xaqan pa ri juyub'
xoq'ik ri sotz', xtane' ri aq'ab'
Junajpu xok q'ij, Xb'alamke xok ik'
ri Xkik' xok ch'umil
Ronojel ri kamik xok saq

[Chorus 3]
Xkib'an winaq ruk' ixim
ri qatinamit man kakam taj
ri qatzij man kakam taj
kaqab'ij chi ri ojer tzij
Ixim kakam, ixim kak'astaj

[Chorus 4]
Kaqatik, kaqak'ol, kaqatij
kaqaya' chike ri ke'petik
jun ijaj, jun tinamit
jun ixim, jun k'aslemal
Ixim kakam, ixim kak'astaj

[Outro]
Xkib'an winaq ruk' ixim
Xkib'an winaq ruk' ixim
jun ijaj, jun k'aslemal
kaqab'ij chi ri ojer tzij
Are' u xe' ojer tzij

---

## 中文对照(供审阅, **不进 Suno**)

### 第一部 ·《血月》
> 这是古老话语的根 / 黄泉里有一棵树 / 它没有果实, 只有骨头 /
> 我走到树下, 看见那颗头骨 / **暗在天上, 光在我心里**
>
> 头骨对我说:「伸出手来, 姑娘」/ 我把手伸进光里 /
> 一滴水落进我掌心 // 我是血月, 我是死亡之主的女儿 /
> 我在黑暗的腹中, 而腹中有生命 / 我不哭, 我唱
>
> 父亲看见了, 震怒:「杀了她, 取她的心」/ 刽子手随我而去 /
> 我对他们说:「去看那棵树的血」/ 树把树脂滴进碗里, 红得像我的血 /
> 刽子手带走了树的血, 不是我的
>
> 我是血月, 我从黄泉走出来了 / 我升上天, 第一次看见太阳 /
> 第一次看见光, 我不哭, 我唱 //
> 月亮在天上是红的, 像水里的一滴血 /
> 我把手放在腹上, 他们对我说:「我们在, 母亲」/ **两个进来, 两个出去**
>
> 我是双子的母亲: 洪那普与斯巴兰克 / 我把他们生在土地上, 生在光里 /
> 我把他们生来对着死亡 // 我不会死, 我成为人 /
> 像玉米在土里 / 太阳回来, 月亮回来, 生命回来

### 第二部 ·《黄泉》
> 洪那普, 斯巴兰克 / 我们沿黑暗的路下降 / 过五条河, 五条路 /
> 我们知道他们全部的名字 / **死神在唱, 我们在打球**
>
> 第一屋: 黑暗之屋 / 第二屋: 火屋 / 第三屋: 美洲豹之屋 /
> 第四屋: 蝙蝠之屋, 令人惊惧
>
> 我们打球, 在球场上打 / 他们的花是我们的赌注 /
> 他们的歌是死亡 / 而我们还在打 //
> 蚂蚁在夜里去了, 把花从他们自己的屋里搬来 /
> 黄泉诸主说:「这是谁干的? 谁?」/ 我们笑, 我们笑, 我们不怕 /
> 他们的恐吓吓不倒我们
>
> 洪那普对我说:「若我死了, 把我的骨头放进水里」/ 我把他的骨头放进大河 /
> 一条鱼活了, 一个人活了 / **死亡说「一」, 生命说「二」** //
> 我们死了, 又活了 / 我们死了, 又活了 / 死亡不是终点
>
> 诸主说:「也对我们做一次」/ 我们做了, 他们再没有活过来 /
> 死亡死在球场上 / 黑暗死在光里

### 第三部 ·《玉米》
> 我们的主从龟甲里升起 / 从土里出来像一粒种子 /
> 他的头发是白的, 他的脸是黄的 / 玉米在雨里说话 /
> **玉米死去, 玉米复活**
>
> 起初他们用泥造人, 散了, 化进水里 /
> 再用木头造, 没有心, 没有记性 //
> 他们用玉米造了人 / 白玉米, 黄玉米 /
> 水的血也是玉米的 / 我们的心就是玉米
>
> 最初的四个人诞生了 / 他们看见大地的全部面貌 /
> 看见天, 看见水 /「我们的眼睛太大了」他们说 //
> 造物者说:「太大了」/ 用雾遮了他们的眼 /
> 死亡进了他们的眼里 / 从此我们会死
>
> 他们用玉米造了人 / 我们把种子种进土 /
> 我们把死者埋进土 / 是同一条路 //
> 太阳升上山, 蝙蝠哭了, 夜停住 /
> 洪那普成了太阳, 斯巴兰克成了月亮 / 血月成了星 / 所有的死都成了光
>
> 他们用玉米造了人 / 我们的城不会死 / 我们的话不会死 /
> 我们要讲那古老的话语 //
> 我们种, 我们收, 我们吃 / 我们把它交给要来的人 /
> 一粒种子, 一座城 / 一株玉米, 一条命 //
> **他们用玉米造了人 / 这是古老话语的根**
