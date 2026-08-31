# AWS Activate —— 逐字段对照 (2026-08-30 实读官方页)

> 来源: `aws.amazon.com/startups/credits` + 官方 step-by-step 指南(2026-06-04 版)。
> **不是转述记忆, 是当天读的页面。**

---

## 一 · 先把金额说清楚 —— $200K 是别人的数字

大标题写 "up to $200,000"。三档展开后:

| 档 | 实际金额 | 门槛 | 我们 |
|---|---|---|---|
| **Activate Founders**(自筹) | **$1,000** 起, 择优追加到 $5,000 | 直接申请, **不需要推荐** | ✅ **这是我们的档** |
| Activate Portfolio | 最高 $200,000 | **必须有 Activate Provider 的 Org ID** | ❌ 没有 |
| AI Startups | $200,000+ | 邀请制, 且要先过 Portfolio | ❌ |

**$200K 和 Google 的 AI 档是同一堵墙 —— 要机构背书。**
我们能直接拿的是 **$1,000**。这一点必须先说明白, 不要被大标题带着走。

---

## 二 · Founders 档资格, 逐条对照

| 官方条件 | 我们 | 说明 |
|---|---|---|
| New to AWS Activate Credits | ❓ **待 Jing 确认** | 以前申请过就要按差额算 |
| Self-funded | ✅ | 单人创始, 100% 股权, 无机构资金 |
| **Have a fully functioning company website** | ✅ | `cssstudio.app` 线上; **W2038 刚补上法人行**(© 2026 CSS Studio LLC · Washington, DC · 邮箱), W2039 sitemap 补齐 about/business/privacy/terms |
| Founded in the past 10 years | ✅ | CSS Studio LLC, Washington DC |

**注意第三条不是走过场。** NVIDIA 6 月拒信提的就是 "functional website"。
这次投出去之前站上已经有法人身份和四页法务页在 sitemap 里 —— 时间点是巧合, 相关性不是。

---

## 三 · 七步字段清单

### Step 1 — AWS Builder ID
- **用个人邮箱**建 Builder ID(官方原话: 这个 ID 跨公司跟着人走)。
- 建完要点确认邮件验证。

### Step 2 — Activate profile
- **⚠️ 和 Step 1 不同: profile 和申请表必须用 `jing@cssstudio.app`**(与公司域名一致)。
- 官方明说域名一致是**验证材料真伪的依据**。混用个人邮箱会拖慢或拖死审核。
- **这是整份表里最容易踩的坑 —— Builder ID 用个人邮箱, 申请用公司邮箱, 两处不一样。**

### Step 3 — 选档
- 选 **Founders**(没有 Org ID 就只有这个选项)。

### Step 4 — 公司资料 ← **我能替你写好的部分**

**Business information (product / target market / traction):**

> CSS Studio is a music-video studio that runs on a sentence. A user types or
> speaks one line; the platform writes the lyrics, composes and records the
> song, directs and shoots the video, and times the subtitles — then keeps the
> four tracks separate so the result stays an editable stage, not a flattened
> video file.
>
> The product ships on all four Apple platforms — iPhone, iPad, Apple TV and
> Vision Pro — live on the App Store since 8 July 2026, plus the web app at
> cssstudio.app.
>
> A second layer, Digital Actors, lets historical and cultural figures perform
> the work in their own language and musical tradition: 343 actors across 45
> civilizations, with lyrics language, vocal timbre, instrumentation and era
> derived from each figure's own civilization rather than from the UI language.
>
> Current library: 166 published works, 47 of them real-video productions,
> including six complete real-video trilogies in Chinese, Japanese, Persian,
> Greek and Sanskrit.
>
> Target market: creators and small studios who want finished, releasable
> musical work without a production crew; and cultural/heritage institutions
> that need work produced in a specific language and tradition.

**Current funding stage:** `Pre-seed / bootstrapped — self-funded, no outside capital`

**Most recent funding date:** 留空 / N/A —— **从来没有过融资轮**。
官方要求填最近一轮日期, 我们没有轮, 就不要编一个日期出来填。

### Step 5 — 绑定 AWS 账号 ← **硬门槛, 只有你能做**
- **我实测过代码库: 我们没有任何真实 AWS 账号。**
  `@aws-sdk/client-s3` 只是拿来讲 S3 协议连 **Cloudflare R2**
  (`endpoint: r2.cloudflarestorage.com`, `region: "auto"`);
  `src/index.ts:16949` 那个 `amazonaws.com` 是一条 URL 白名单。**都不是 AWS 账号。**
- 所以要新建一个 AWS 账号, 用 `@cssstudio.app` 邮箱, 需要绑卡。
- **建账号 + 绑支付方式我不做**(这条我们说定过)。你建, 我接着往下走。
- 提示: 需要 root 或 admin 权限; 一个 AWS 账号同时只能绑一个 Builder ID; 浏览器要允许弹窗。

### Step 6 — 验证账号
- 在 AWS Console 点 "Verify your account", 看到 "Accounts linked successfully" 为止。

### Step 7 — 提交
- **提交后不能改。** 填错只能取消 → 解绑 AWS 账号 → 重新申请。所以 Step 4 一次写对。
- 审核 **7–10 个工作日**, 结果发邮件; 可在 Credit Application Status 页看进度。

---

## 四 · 值不值得 —— 诚实的账

**拿到的是 $1,000, 不是 $200,000。** 那 $1,000 的真实用途:

- **只能抵 AWS 的新账单**, 不追溯旧账单, 不能指定抵哪个服务, **1–2 年过期**。
- **不能用来买 KIE 额度** —— 我们所有 API 走 KIE, 这笔钱一分都落不到那儿。
- Bedrock 虽然被官方反复推销, 但**「所有 API 只走 KIE」是铁律**, 不为 $1,000 破例。

**真正对得上的用途只有一个: GPU。**

$1,000 ÷ g5.xlarge (A10G 24GB, ~$1.006/hr) ≈ **1,000 小时 A10G**。
而 SVS(真人声唱词)和 f2f 一直卡在没有 GPU —— 这笔钱刚好能把那件事从"等"变成"试"。

**结论: 值得投, 但要带着正确的预期投。** 成本是你建个 AWS 账号 + 半小时填表 + 等 7–10 天;
回报是约一千小时 A10G。**不要当成 $200K 的机会去投, 那会失望。**

---

## 五 · $200K 那条路的真实入口(下一步值得查的)

Portfolio 档要 Activate Provider 的 **Org ID**。官方页把这几家并列为 Provider:

> Andreessen Horowitz, **Brex**, **Carta**, Greylock Partners, Sequoia, Y Combinator

**Brex 和 Carta 不是 VC —— 是金融/股权管理服务, 门槛远低于 VC。**
如果它们确实向自己的用户发 Org ID, 那就是一条**不需要融资也能够到 Portfolio 档**的路。

⚠️ **这一条我尚未核实**, 只是从官方并列名单里读出的可能性。
不要当结论用。下一步: 去 Carta / Brex 侧确认是否发 Activate Org ID、门槛是什么。

---

## 六 · 需要 Jing 拍板 / 动手的两件事

1. **以前申请过 AWS Activate credits 吗?** —— 影响资格第一条。
2. **建 AWS 账号(用 `@cssstudio.app` 邮箱, 需绑卡)** —— 我不建账号、不填支付信息。

这两件有答案, 剩下六步我一次走完。
