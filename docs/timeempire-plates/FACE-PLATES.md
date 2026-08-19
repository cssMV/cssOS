# 面部基准板

铁律 8：**跨镜出现的角色必须有自己的面部基准板**，否则身份会漂。
所有板共用同一段规格文字，逐字相同 —— 否则板与板之间的光／角度／景别不一致，
后面拿它们做条件时会互相打架。

> HEAD-AND-SHOULDERS identity reference plate. Flat even frontal light on a plain
> neutral grey background, facing the camera straight on, both ears visible,
> completely neutral expression, mouth closed, no props, no hands in frame.

---

## 全部 24 张

### v1 沿用（5）

`face-xeth` · `face-margot` · `face-woman-1977` · `face-young-martian` · `face-ethan`

### v2 新增（16，2026-08-12）

| 板 | 角色 | 出处 |
|---|---|---|
| `face-ethan-v2` | Ethan Vance，40 代中，两鬓灰、短须 | 全片 |
| `face-clara-v2` | Clara Sinclair，44 岁，及颚栗色短发＋前额一道灰 | 第一部 · `earth` · 第三部 |
| `face-june-v2` | June Hale，白宫，眼下有阴影 | `mars` · 第三部 |
| `face-daniel-vance` | **Ethan 的父亲**，1977 说出那句话的第四个人 | 序章 · 第一部 · `mars` · `earth` |
| `face-helen-reese` | 83 岁，1977 现存最后一个在场者 | 第一部 §9 |
| **`face-audrey-leigh`** | 65 岁，那位要「十一分钟」的母亲 | `mars` §2 |
| `face-novelist` | 45 岁，正在死的小说家 | 序章 §2 |
| `face-parrish` | 55 岁，十九年工龄，全片唯一一次反方陈词 | `mars` §7 |
| `face-norris` | 52 岁，签了字而不记得的档案员 | `earth` §4 |
| `face-harold-beak` | 75 岁，业余无线电 | `earth` §15 · 第三部 §2 |
| `face-priya-shah` | 34 岁，记者 | `earth` §5/§6 |
| `face-holbrook` | 54 岁，被 xÈth 亲自驳回的那一个 | `mars` §3 |
| `face-declan` | 25 岁，被 June 亲自驳回的那一个 | `mars` §4 |
| `face-brewer` | 62 岁，档案馆馆长 | `earth` §10 |
| `face-merritt` | 45 岁，值班员 | 第三部 §7 · 结局四 |
| `face-unknown-president` | **黑白**，1962 年，无人认得的那位总统 | `earth` §2（第 3 罐） |

---

## 这一轮学到的三件事

### 1. 年龄跨度决定能不能派生

| 跨度 | 方法 | 结果 |
|---|---|---|
| **+10 年**（`face-ethan-v2` ← `face-ethan`） | 派生 | ✅ 一次过 |
| **+10 年**（`face-clara-v2` ← `face-clara`） | 派生 | ✅ 一次过 |
| **+50 年**（`face-helen-reese` ← `face-woman-1977`） | 派生 | ❌ **两次都失败** |

两次返工都被**年轻的条件图顶住了** —— 模型把条件图当成答案，出来是五十几岁。

**改成从零生成，一次就对。** 用文字描述骨相，不拿年轻的脸当条件。

风险可控的理由：**Helen 与 1977 年的她全片没有一个镜头同框，也没有闪回对切。**
观众只需要相信是同一个人，而**读得出年龄**比五官吻合重要得多。

> **规则：年龄改动 ≤15 年用派生；>30 年从零生成。**

### 2. 编辑模型不改「摄影」

`face-clara-v2` 的背景是深炭色、光偏氛围，与其余 14 张的平光灰底不一致。
我下过一次明确指令改背景与打光 —— **完全没生效**，这是同一轮里第三次
「编辑模型空转」（前两次是 `face-ethan-v2` 与 `face-helen-reese`）。

**没有再返工，接受现状**，理由不是省钱：
Clara 出现在 `S4-1` / `S4-2` / `E3-2` 三组**已拍并在 v2 下存活**的素材里。
从零生成会拿到对的打光、但很可能拿到一张对不上那三组素材的脸。
**与已拍素材的连贯性 > 基准板之间的打光一致性。**

### 3. 有文字的缺陷，裁掉比重出便宜

`face-daniel-vance` 白大褂口袋上出现了乱码名牌。提示词里写了 `no text` —— 没用；
改写成「那块布是完整不断的白色」之后剩一点残影。

**没有第三次生成，直接从下缘裁掉 14%**（1344×768 → 1344×660）。
确定性、$0、一定成功，而且这是一张头肩板，口袋本来就不该在画面里。

---

## 成本

| | |
|---|---|
| 15 张 × 1 次 | $0.30 |
| 返工 4 次（Helen ×2、Daniel ×1、Clara ×1） | $0.08 |
| 失败仍计费 2 次（KIE timeout / Internal Error） | $0.05 |
| **合计** | **约 $0.43** |

**KIE 侧的 timeout 与 Internal Error 照样计费** —— 这一轮 17 次调用里有 2 次
是白付的。批量生成时要把这一项算进去（约 12%）。
