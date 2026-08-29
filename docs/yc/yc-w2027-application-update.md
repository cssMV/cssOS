# YC 下一轮申请更新稿 · 草稿

> 2026-08-28 拒信当晚起草。所有数字都是从生产库里查出来的, 没有一个是估的。
> **英文正文可直接粘贴; 中文部分是给 Jing 看的说明, 不要提交。**

---

## 一 · 先把最难的话说在前面(中文, 不提交)

**我们的短板不是产品, 是用户。**

生产库实测:

| 指标 | 数字 |
|---|---|
| 已发布作品 | 162 |
| 其中真视频 MV | 16 |
| 覆盖文明 | 45 |
| 三部曲 | 34 |
| 歌词语言 | 11 |
| 数字演员 | 343 |
| 苹果原生 App(已上架) | 4(iPhone/iPad · Watch · TV · Vision Pro) |
| **注册用户** | **32** |
| **近 30 天新增用户** | **0** |

YC 看的第一件事就是最后两行。一份把「45 个文明」放在最前面、把「30 天 0 新增」
藏起来的更新稿, 是他们每天要读几百份、最会打折扣的那一种。

**所以这份稿子的写法是: 自己先说破, 再说打算怎么办。** 理由不是谦虚 ——
是因为「东西做得很完整但没人用」本身就是一个可以讲清楚的判断错误,
而**能把自己的判断错误讲清楚的创始人, 恰恰是他们在找的**。

**这一稿现在还不该交。** 它缺的是「上一次申请之后, 用户数从 X 到 Y」那一行。
下面的正文已经把位置留出来了(`[[FILL]]`), 建议先做完两件事再提交:

1. **四部真视频三部曲上线并对外发一轮**(李清照/王维/芭蕉已上线, 鲁米/萨福今晚装配)。
   这是我们唯一别人做不出来的东西 —— 拿它去换第一批真实用户。
2. **拿到 30 天里的第一个非零新增。** 哪怕是 50 个人。
   0 → 50 比 32 → 82 更有说服力, 因为它证明的是【我们知道怎么获得用户】,
   而不是【我们又做了更多东西】。

---

## 二 · 正文(英文, 可直接提交)

### Describe what your company does in 50 characters or less.

```
AI studio that turns a sentence into a real MV.
```
(47 characters)

### If you have applied before, describe how you have evolved since then.

```
Since the last application we stopped trying to be a generator and became a studio.

What changed, concretely:

1. We ship finished works, not demos. Four complete video trilogies are live —
   Li Qingzhao (Song-dynasty Chinese), Wang Wei (Tang), Matsuo Bashō (Edo Japan),
   Rumi (13th-century Persia) — each three songs, ~17 minutes, 163-165 real
   generated shots per trilogy, cut to a word-level alignment of its own vocal
   track. A fifth, Sappho (archaic Greek), is in assembly tonight. Every one is
   in the figure's own mother tongue, not translated: Chinese, Japanese, Persian,
   Greek.

2. We learned that the hard part is not generation, it is direction. Our first
   Persian trilogy was technically clean and artistically wrong — I had written
   it as one ascetic monk, when Rumi's own poetry is full of feasts, turning
   stars, and the beloved. We threw away 163 shots and reshot it. That is the
   real work of this product, and it is the work our users will not do
   themselves. It is why we are building a studio and not a button.

3. We built the boring half. 172 database tables, four native Apple apps
   (iPhone/iPad, Watch, TV, Vision Pro) shipped on the App Store, a
   pay-as-you-go wallet that debits the exact cents the underlying engine
   charges us, word-level subtitle alignment across 11 languages, and a
   fallback that renders a slideshow when a browser refuses video — so a
   Tesla's browser shows the work instead of a black rectangle.

4. Honest number: we still have 32 registered users and added none in the last
   30 days. We spent this period making the product worth showing rather than
   showing it. That was a deliberate trade and, in hindsight, we held it too
   long. [[FILL: 上线 + 发一轮之后, 把这里换成真实的 30 天新增数字]]

What we would do differently, and are now doing: put the finished trilogies in
front of people and let the work recruit its own audience, instead of adding a
fifth civilization before anyone has watched the fourth.
```

### What is your company going to make?

```
CSS Studio turns one sentence into a finished music video — lyrics, song,
video, and emotion-timed subtitles — and keeps the four as separate tracks so
the result stays editable instead of burned into one file.

The unit we ship is not a clip. It is a work: a trilogy, an opera, a short
drama — something with a beginning and an end, in the language and musical
idiom of the civilization it comes from. A song about Sappho is sung in ancient
Greek to a lyre, not in English over a synth pad. That coupling — figure to
language to instrumentation to era — is enforced by the system, not left to the
prompt.

It runs on every Apple surface we could reach: iPhone, iPad, Watch, TV, and
Vision Pro, where a finished work plays in a real immersive environment.
```

### How far along are you?

```
Live in production at cssstudio.app, plus four native apps on the App Store.
162 published works spanning 45 civilizations and 11 languages, 343 digital
actors, 16 works with fully generated video. Payments, wallet, and per-second
engine cost accounting are live. Written by one person over roughly nine months.
```

### What have you learned so far?

```
Three things, all learned the expensive way.

One: the bottleneck moved. Generating a shot is solved and cheap. Knowing which
shot to ask for is not. Our worst failures were never model failures — they
were direction failures that the model executed perfectly.

Two: constraints must say what a shot needs, not what it is allowed to have.
"At most one person" was read by the engine as "put one person in," and put a
figure into 136 shots that were meant to be empty landscapes. "This place is
completely deserted" fixed it. The same lesson cost us three separate reshoots
before we generalized it.

Three: a verifier that cannot report its own blind spots is worse than none. We
had audit scripts that printed "all passed" while silently checking half the
shots. Every summary we write now prints what it intended to check and what it
actually checked, and says so when the two differ.
```

### How do or will you make money?

```
Two layers, deliberately separate. Subscription buys capability — output
length, seats, lossless export, API access — and never a generation quota.
Output is pay-as-you-go from a wallet, debited at the exact cost the underlying
engine bills us, so we are never incentivized to make a user's work worse to
protect a margin. Creators can sell or license finished works and take
commissions; we take a platform cut that narrows as the tier rises.
```
