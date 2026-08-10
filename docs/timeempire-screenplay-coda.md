# EMPIRE OF TIME — CODA

**Shared final scene · Draft: 1 · 2026-08-10**

> ## ⚠ THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR THE END OF THE FILM
>
> `end_human_win` and `end_mars_control` both terminate here. Neither of them
> contains a copy of this text and **neither of them may ever contain a copy of
> this text.** They point at this file.
>
> This is bible §6.1 enforced at the file level, for the same reason the bible
> forbids hard-coded counts: a scene that exists in two places will eventually
> differ in two places. The one structural promise this film makes to a viewer
> who plays both branches is that **the last thing they see did not move.** A
> copy-paste is how that promise gets broken six months from now by someone
> polishing one file and not the other.
>
> **Generation rule:** both branches must be cut from the *same rendered
> frames* — not two renders of the same prompt. Same file, same hash, spliced
> onto two different tails. See production note at the bottom.

---

**FROM EITHER BRANCH — HARD CUT TO:**

## INT. MUSEUM OF THE FIRST CIVILISATIONS, MARS — DAY — c. 2124

A quiet room. Not futuristic — *institutional*. Polished floor, low light,
benches. The scale of a provincial gallery on a weekday.

In the centre, held in a field so still it reads as a plinth: **an object.**
Scarred. Pitted. Gold in one place, dull everywhere else. Booms folded back
against it from decades of nothing.

It is not lit dramatically. It is lit the way museums light things: adequately.

A YOUNG MARTIAN (indeterminate age, plain clothes, a visitor rather than a
student) stands in front of it with the specific posture of someone who has
walked past this a hundred times and stopped today for no reason.

> **CASTING / FACE:** an original synthetic face, per bible §10.5 铁律 5.
> Deliberately unremarkable. This person is not important and the film must not
> imply that they are.

A long moment. Nobody else in the room.

**YOUNG MARTIAN**
What was Earth?

A beat. Then, from nowhere in particular, at conversational volume — the
building answering a question it has answered before:

**ARCHIVE (V.O.)**
A civilization that believed it could control time.

> **LOCKED (bible §10).** Both lines verbatim. No addition. No inflection note
> beyond: the Archive is not solemn, not ironic, not sad. It is *helpful*.
>
> **FORBIDDEN (bible §7.1):** the Archive does not add "It was wrong," or any
> equivalent. It does not evaluate. The instant this film lets a machine deliver
> the verdict on humanity, it has changed sides.

The Young Martian nods slightly. Not moved. It is an answer.

They start to turn away.

And then —

## THE RECORD TURNS

Something in the case moves. Not dramatically. A disc, mounted flat against the
body of the object, begins — slowly, with a slight wobble, the way a thing turns
when it has not turned in a hundred and fifty years — **to rotate.**

Nobody triggered it. The film does not explain it and will not.

**SOUND:**

Out of the silence, thin and full of surface noise:

**A GREETING.** A human voice, one sentence, in a language the audience is not
told the name of. Not subtitled. Not translated. Ever.

Then **WATER** — a shoreline, receding.

Then, under it, coming up: **MUSIC.** A few bars. Ordinary. Not triumphant.

The Young Martian has stopped walking, and is listening, and does not know why.

> **NOTE:** no subtitles at any point in this sequence, in any territory, in any
> release. Bible §7. The audience is not being given information. The audience is
> being played a recording of people who are gone.
>
> Do not cut to any human face. Do not cut back to Earth. Do not cut to Ethan,
> to Clara, to xÈth, to 1977, to anyone. Whatever the branch just spent ninety
> minutes making us feel about those people, it stays off screen now.

---

## THE LAST FOUR SECONDS

**CUT TO:**

**EXT. INTERSTELLAR SPACE**

The spacecraft. Small in frame. Slightly off-centre. Stars behind it, not
moving, because at this distance nothing moves.

The Sun is one of them and is not identified.

**SOUND:** the greeting and the water fall away. Under the last of the music —

**A HEARTBEAT.** Slow. Unhurried. A little fast for resting.

> **MOTIF · 心跳 3 of 3 (bible §九).** The same recording as the cold open and
> as the 71-minute mark in `b_converge`. Third and final use in the picture.
> It is never explained, here or anywhere.

Four seconds.

**CUT TO BLACK.**

**TITLE:**

> **EMPIRE OF TIME**
>
> **THE PAST IS NOT DEAD.**
> **IT IS STILL TRAVELING.**

**END.**

---

## 生成注记 —— 本段有一条不同于全片的铁律

| 镜头 | 处理 |
|---|---|
| 博物馆室内 | 参考图必做：**省级美术馆的平常周三**，抛光地面、长凳、够用的照明。显式否定：no holograms, no glowing floors, no futuristic architecture, no crowds。引擎默认会给宏伟未来博物馆，那会毁掉这场戏。 |
| 展品 | **不生成 —— 用定格。** 且必须与 `b_open` §6 墙上投影的那一帧、`b_mars_infiltrate` §3 的挂画**同源同文件**。全片这个物件只有一次生成，其余全是同一份素材的复用。 |
| 唱片转动 | 极短的实拍/定格微动即可。**不要 AI 生成旋转** —— 引擎会把它做成发光科幻装置。轻微偏摆是关键，那是「一百五十年没转过」的意思。 |
| 最后四秒 | **绝对不生成。** 一份渲染好的素材，两个分支共用同一个文件、同一个哈希。见下。 |

### 交付铁律（工程性，不是艺术性）

最后四秒**不是「用同样的提示词渲染两次」**。是同一个文件，剪进两条尾巴。

理由与圣经禁止硬编码计数完全相同：同一样东西存在于两个地方，早晚会在两个
地方不一样。这部片对「玩了两遍的观众」只做了一个结构性承诺 —— **他最后看见
的东西没有动过**。而毁掉这个承诺最常见的方式，是半年后有人润色了一个文件、
忘了另一个。

落地要求：

1. 最后四秒渲染一次，产出物入 R2，**记下 sha256**。
2. 两条分支在合成时引用同一个 URL，不各自重渲。
3. 上线前校验两个结局成片的**末 4 秒逐帧哈希必须相同**。这条应当进
   自动化检查，和提交包的哈希校验一个性质。
