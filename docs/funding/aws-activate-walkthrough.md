# AWS Activate —— 逐字段对照 (2026-08-30 实读官方页)

> 来源: `aws.amazon.com/startups/credits` + 官方 step-by-step 指南(2026-06-04 版)。
> **不是转述记忆, 是当天读的页面。**

---

## 零 · 结论(2026-08-31 拍板): 走 **Founders $1,000**, Carta 放弃

**Carta 走到第四屏放弃, 原因不是麻烦, 是【那条流程对 LLC 没有对应物】:**

| Carta 要求 | LLC 的现实 |
|---|---|
| Certificate of Incorporation | LLC 没有, 只有 Articles of Organization |
| Share class / par value | LLC 没有股票, 只有 membership units; 无面值 |
| **Board approval date** ——「a director signed a **Board Consent**」 | **单一成员 LLC 没有董事会、没有 director、没有 Board Consent 这份文件。这个日期在现实里不存在。** |

前两项还能当作命名映射; **第三项问的是一份具体文件的签署日期**, 而 Carta 是 SEC 注册的
过户代理机构, 这是公司的股权记录。**为了 $4,000 的差额去填一个不存在的董事会同意日期,
不划算也不该做。** 连续两个字段无对应物 = 这条 flow 本来就不是为 LLC 设计的。

**所以: 直接投 Founders 拿 $1,000(≈1,000 小时 A10G), 零依赖, 一张表。**
W2045 那条规则仍然成立 —— **先拿 $1,000 不作废将来的更高额度, 重复申请拿的是差额。**
将来若有真投资方/加速器给 Org ID, 再补差额即可。

AWS 侧已就绪: 根账号 admin@cssstudio.app · **Paid plan** · ACH(CSS STUDIO LLC) ·
账单地址 Washington DC —— 与官网法人行一致。

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

### Step 0 — 注册 AWS 账号时必须选 **Paid plan**, 选错直接丧失资格

**这是一个会静默取消资格的坑。**

AWS 现在注册时要你二选一(2025 年起的新机制):

| | Free plan | **Paid plan** |
|---|---|---|
| 送 | $100 额度(做任务再送 $100) | 无 |
| 期限 | 6 个月或额度用完 | 无 |
| 服务 | **受限** —— 不含 Savings Plans / Reserved Instances / 部分 Marketplace | **全部服务立即可用** |
| 计费 | 不会产生费用 | 按量付费(**零用量 = 零账单**) |

而 Activate 的资格行白纸黑字写着:

> Eligibility for AWS Activate: Pre-series B, founded in the last 10 years,
> **AWS Account on Paid Tier Plan**, and either new to Activate Credits...

**选了 Free plan = 不满足资格。** 而且 Free plan 那 $100 和 Activate 是两回事,
不要因为"先白拿 $100"去选它 —— 那 $100 会把 $1,000/$5,000 挡在门外。

**Paid plan 不等于要花钱** —— 是按量付费, 不开服务就是零账单。
Activate 额度批下来之后, 也是先抵扣额度再计费。

**W2044 补充 —— 官方计费文档里的定论(比营销页那句硬得多):**

> **"Free account plans are not eligible for other promotional credits and discounts."**
> —— `docs.aws.amazon.com` · Choosing a plan

**Activate credits 就是 promotional credits。所以 Free plan 是明文不合格, 不是推断。**
同一页还有一条更凶的:

> After your free account plan expires, **your account closes automatically**,
> and you lose access to your resources and data.

对照表也写得很清楚:

| Free plan | Paid plan |
|---|---|
| Not eligible for other promotional credits and discounts | **Eligible for other promotional credits and discounts** |
| Account closes when credits are depleted or when the plan duration ends | Account doesn't close when credits are depleted |

**已经注册成 Free plan 怎么补救(官方三步):**

1. 登录 Console
2. 打开 `https://console.aws.amazon.com/billing/home?#/freetier/upgrade`
3. 看完变更点, 点 **Upgrade account**

当前是哪个计划, 在 Billing and Cost Management 首页能看到(会显示 free account plan 信息和额度余额)。


### 邮箱怎么分配(两个地址, 各有职责)

| 用途 | 用哪个 | 为什么 |
|---|---|---|
| **AWS 根账号** | **`admin@cssstudio.app`** | 根账号收账单和安全告警, 是**公司资产**不是个人资产。AWS 自己的建议就是用角色制/共享地址而非个人地址 —— 账号要活得比任何一个人久。admin@ 本来就是平台的运维信箱。 |
| **Builder ID + Activate profile + 申请表** | **`jing@cssstudio.app`** | 批准/拒绝信落在这里, 而融资往来(YC、NVIDIA)本来就都在 jing@。 |

**两个都是 `@cssstudio.app` —— AWS 校验的是【域名一致】, 不是【地址相同】,
所以这样分是安全的。**(官方原话: "use your business email address
**matching your startup's domain**")

⚠️ AWS 指南建议 Builder ID 用**个人**邮箱, 理由是"换公司时 ID 跟着人走"。
**这条对我们不适用 —— 公司是 Jing 自己的。** 用 jing@ 反而域名一致, 更利于审核。

⚠️ 根账号建好**立刻开 MFA**。根账号权限无上限, 且它是唯一能恢复账号的入口。

### 链接(已实测全部 HTTP 200)

- 建 AWS 账号: `https://portal.aws.amazon.com/billing/signup`
- 申请 Activate: `https://aws.amazon.com/startups/join?destination=/credits/apply`

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

## 五 · Carta / Brex 那条路 —— 已查清: 通向 $5,000, 不是 $200,000

W2040 我把这条标为「未核实的线索」, Jing 要求查清。**查完了, 答案是明确的否。**

### Carta —— 官方支持文档原文

> As an Activate Provider, Carta customers are eligible for AWS Activate credits to help
> grow and scale their businesses. **All Carta free and paid customers are eligible for
> the $5K tier when criteria is met.**
>
> Eligibility criteria for $5k:
> · Founded within the past 10 years
> · Must not have previously received AWS Activate credits at equal or greater value
> · Must be associated with an Activate Provider (Carta)
> · Must not have previously raised venture funding greater than a Series A
>
> **The $5k offering expires in 24 months.**

—— `support.carta.com` AWS Credits FAQ(内容藏在分步指南里, 从页面内嵌 JSON 取出)

**四条资格我们全过**(2026 年成立 · 没拿过 · 只要开 Carta 账号 · 从没融过资)。
且 **Carta Launch 免费**(≤25 名持股人 + 累计融资 ≤$1M, 我们是单人 100% 股权, 远在门槛内)。

### Brex —— 官方支持页原文

> **All new Brex customers are eligible for $5,000 in AWS credits** depending on
> Activate eligibility.

—— `brex.com/support/brex-partner-perks`

⚠️ 第三方博客(creditforstartups 等)写 Brex 给「up to $100,000」——
**与 Brex 自己的支持页矛盾, 以官方为准。** 另外 Brex 开企业账户在美国还要 EIN,
公司卡据称要 $50K 现金余额门槛, 比 Carta 重。

### 结论: 我的猜想方向对, 数量级错

**Provider 身份不等于 $200K。** 每家 Provider 自己定发多少:
a16z / Sequoia / YC 这类**真投资方**给自己投的公司开到 $100K–$200K;
Carta / Brex 这类**服务商**面向全体客户, 档位就是 $5K。

所以这条路的真实收益是 **$1,000 → $5,000(5 倍), 不是 $1,000 → $200,000(200 倍)。**

### 那还值不值得走?

| | Founders 直投 | 经 Carta |
|---|---|---|
| 金额 | $1,000(择优才到 $5,000) | **$5,000 直接** |
| 额外成本 | 无 | 开一个 Carta Launch 账号(免费), 录入公司/股权信息 |
| 有效期 | 1–2 年 | 24 个月 |
| 换算 GPU | ~1,000 小时 A10G | **~5,000 小时 A10G** |

**多出来的 4,000 小时 A10G, 代价是开一个免费账号。** 我的判断是值得,
但**开账号 + 录入股权信息是你的事, 我不建账号**。

一个诚实的提醒: Carta 是给有股权结构的公司管股权表的。**单人 100% 股权的 LLC,
股权表本身没什么可管** —— 开它的唯一实际理由就是这 $5K。你要觉得不值这个麻烦,
直接投 Founders 档拿 $1,000 也完全合理, 那条路今天就能走完。

### ✅ 已解决(2026-08-30 实测): Carta Launch **收了**我们这个 LLC

**W2042 我把「免费档可能不收 LLC」标为风险。结果: 没成立。**
Jing 用 `app.carta.com/launch/create-account/` 走完全程, 拿到
"Welcome to Carta Launch — Check your email to activate your account"。
**注册流程里没有出现 certificate of incorporation 的硬墙。**

那份风险提示**仍然值得当时提出** —— 证据是真的(LLC 价目页无免费档、注册页要
"certificate of incorporation"、产品语言全是 shares/stock)。**但证据强不等于结论成立,
所以当时没有下结论, 而是给了最便宜的判定方式(直接注册, 免费不要卡)。那个处理是对的。**

**表单里两个要如实填对的选项(已给 Jing):**

| 问题 | 选 | 为什么 |
|---|---|---|
| Fundraising status | **I have never fundraised** | 属实; 且正对 AWS Activate 的 "not previously raised venture funding greater than a Series A" |
| Do you need a 409A valuation? | **No** | 409A 是给员工发期权时定行权价用的。无员工、无期权池、无股票 → 用不上。选 "I'm not sure" 会被导向销售, 而 409A 是**付费 add-on** |

**下一步(Carta FAQ 原文):**

> Once your Carta account is **activated (set up and live)**, you'll receive a link
> to apply for your AWS credits. Contact your Carta Account Manager or Carta Support
> if you do not receive the code.

**注册完 ≠ 有链接。** 要先点邮件里的激活链接、把公司信息和股权表建起来。
等几天仍未收到 → 直接找 Account Manager 或提工单(FAQ 明确说了这条路)。

---

### (存档) 当时的风险评估 —— 证据与结论的分寸

### ⚠️ 走之前必须知道的一块石头: Carta Launch 免费档可能不收 LLC

**我们是 CSS Studio LLC。Carta 的免费档看起来是给 Corporation 设计的。**

**支持「免费档不收 LLC」的证据(强):**

| 证据 | 出处 |
|---|---|
| Corporation 价目页有 `Launch — Free — 25 名持股人 / $1M 以内 — "Sign up, it's free"` | `carta.com/plans/equity-management/` |
| **LLC 价目页没有 Launch、没有免费档、连价格都不标**, 整页只有 "Schedule a call with sales" | `carta.com/plans/equity-management/llc/` |
| 注册要 **"your certificate of incorporation"** —— **LLC 没有这个东西**, LLC 拿的是 Articles of Organization | Launch 页 |
| 产品语言全是 **shares / stock transfers / ISO / 83(b)** —— 都是股份公司的东西; LLC 用的是 units | Launch 页 |

**支持「可能收」的证据(弱但真实):**

> **"Carta Launch is for startups with under 25 stakeholders and less than $1 million raised."**
> —— Launch 页 FAQ「What companies are eligible?」**官方资格条款里一个字都没提实体类型。**

**我无法从公开页面判定。** 两边都有真凭据, 硬下结论就是今天已经犯过两次的那个错。

**最便宜的判定方式 = 直接去注册。** 免费、**不要信用卡**(官方原话:
"no credit card is needed or required for as long as you're on the Launch platform"),
几分钟就能试出来。**卡点会出现在「上传 certificate of incorporation」那一步** ——
如果它不接受 Articles of Organization / LLC 运营协议, 当场就知道了, 不用往下猜。

**如果 Carta 免费档确实不收 LLC, 两条退路:**

1. **Brex** —— 同样 $5,000, 且企业银行/卡对 LLC 友好(我们有 EIN)。
   代价: 要开企业账户; 公司卡据称有 $50K 现金余额门槛(未核实, 存款账户可能没有)。
2. **直接投 AWS Founders 档拿 $1,000** —— 零依赖, 今天就能走完, 约 1,000 小时 A10G。

**不要为了 $5K 去买 Carta 的 LLC 付费档。** LLC 付费档是销售报价制(页面连价都不标),
单人 100% 股权的 LLC 本来就没有股权表要管 —— 花钱买它来换 $5K 额度, 账是负的。

### 先拿 $1,000 不会作废后面的 $5,000 —— 拿的是差额

**这条决定了「要不要等 Carta」。** 两处官方说法互相印证:

> **Carta 资格:** "Must not have previously received AWS Activate credits
> **at equal or greater value**" —— $1,000 < $5,000, **仍然合格。**

> **AWS FAQ:** "if you applied for more credits than you had before, but have
> already claimed some portion of that total, your new award might only reflect
> **the difference**. For instance, if you have $10K in credits and apply for $100K,
> you could receive an additional $90K."

**即: 先投 Founders 拿 $1,000, 之后 Carta 通了再补 $4,000, 终点一样是 $5,000。**

那还等不等 Carta? **等一下, 但只等几分钟** ——
Carta 注册是免费且不要卡的, LLC 那堵墙(certificate of incorporation)会在几分钟内现形。
- **Carta 通** → 直接一次投 $5,000, 一个审核周期(7–10 工作日)搞定。
- **Carta 不收 LLC** → 当场改投 Founders $1,000, 不再纠缠。

**不建议现在就投 Founders 抢那 7 天** —— 申请提交后不可修改, 改档要取消申请 +
解绑 AWS 账号 + 重新提交, 等于两个审核周期加一次解绑重绑。省下的时间还不够赔的。

### $200K 依然只有一条路

要真的够到 $200K, 必须有**真投资方或加速器**把我们放进它的 portfolio 并给 Org ID。
那回到了同一堵墙 —— 和 YC、和 Google AI 档是同一件事。**不是靠找服务商能绕过去的。**

## 六 · 需要 Jing 拍板 / 动手的两件事

1. **以前申请过 AWS Activate credits 吗?** —— 影响资格第一条。
2. **建 AWS 账号(用 `@cssstudio.app` 邮箱, 需绑卡)** —— 我不建账号、不填支付信息。

这两件有答案, 剩下六步我一次走完。
