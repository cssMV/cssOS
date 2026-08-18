# 确定性道具

2026-08-12。圣经 v2 全片所需的**确定性道具**：凡是画面里**文字／数字／图表／
界面承担叙事**的镜头，一律走 HTML + Chrome 或纯 Python，**绝不进生成**（铁律 7.6）。

**全部由 `scripts/timeempire-props.py` 生成，渲染用 `scripts/timeempire-props-render.sh`。**
成本 **$0**，任何机器上逐像素可复现。

---

## 为什么是生成器，不是 17 个手写 HTML

这些道具里有大量共享成分：纸张底色、颗粒、暗角，以及 —— 最要紧的 ——
**同一个人的签名必须在两三份文件上一模一样**（Norris 在派工簿与餐巾纸上；
Clara 在派工簿与值班簿上）。

手写 17 个文件，这些共享成分迟早会漂。**而这部片讲的恰好就是副本会漂。**
共享成分只存在一处，是唯一能保证它们真的相同的办法。

**签名用 SVG path，不用字体** —— 字体依赖渲染机器，path 不依赖任何东西。

---

## 清单（17 件 PNG）

| 道具 | 出处 | 承担什么 |
|---|---|---|
| `prop-the-book` | 序章 §2 · 第一部 §8 · 第三部 | 三次同一本、同一书脊。**书脊上没有一个可读的字** —— 不许给书名特写、不许说作者名 |
| `prop-day-of-observance-notice` | 第一部 §3 · `earth` §8 | 全国默哀日 |
| `prop-day-of-observance-DISCONTINUED` | **结局二 §2** | 「因已无可追悼，本年起停办」。全片最恐怖的一张纸 |
| `prop-1931-contact-sheet` | 第一部 §4 | **要能数出 84 个形状**。七行 × 十二个 |
| `prop-birth-ledger-1961` | 序章 §4 · 第一部 | 南方那行伪造的出生。第 0413 号，报案人一栏写着 **Self** |
| `prop-docket-book` | `earth` §1/§4 | Norris 的签名，与餐巾纸上那个同一条 path |
| `prop-norris-diary` | `earth` §4 | 他自己的笔迹。**它不说去了哪儿** |
| `prop-phone-photo-A` / `-B` | `earth` §3 | 唯一一件**故意会变**的道具。两版只差最后那行脚注 |
| `prop-shorthand-notebook` | `earth` §6 | **前后完全不变**。她读得出每个字，而它对她不再意味着任何东西 |
| `prop-daniel-vance-record` | `earth` §9 | 完整、无聊、而且是错的。`NO AMENDMENTS ON FILE` |
| `prop-order-of-ceremony` | `mars` §13（三次）· 第三部 §1/§13 | **一份，五次出现。**June 三次更正失败的那个页眉 |
| `prop-the-list` / `-CORRECTED` | 第三部 §2/§6/§11 · **结局三 §2** | 两版只差第 8 条一个词：**Four → Three** |
| `prop-duty-log` | 第三部 §7 · 结局四 §1 | Clara 端端正正写下自己的名字 |
| `M4-1-the-register` | `mars` §11 | 四万零九百二十一个，只有最后一行没有第二个日期 |
| `M4-1-the-register-40922` | **结局三 §6** | **同一份文件，只改一格与页脚。**那一行终于有了第二个日期 |

---

## 一件分类错误，记在这里

**`prop-1977-group-photo` 不能用 CSS 做，已移出本生成器。**

我先按确定性道具做了一版，渲出来是**四个白色胶囊** —— 跟当初那根渲成鸡蛋的
CSS「手指」是同一种失败：**CSS 画得了文件，画不了人的照片。**

铁律 7.6 管的是「文字／数字／图表／界面承担叙事」的镜头。
这一件承担叙事的**不是文字，是四张脸** —— 那正是生成擅长、而确定性工具做不到的。

它真正属于的类别是**不变量**（`INVARIANT-*`）：生成一次，冻结，记 sha256，
此后任何地方引用都必须是同一份文件，与 `INVARIANT-artifact-voyager.png` 同级。

**硬约束不变**：第一部 §9 里前后两次出现**逐像素相同**。变的是 Helen，不是照片。

---

## 复现

```bash
python3 scripts/timeempire-props.py          # HTML
bash   scripts/timeempire-props-render.sh    # → PNG（尺寸从 HTML 读，不写死）
```
