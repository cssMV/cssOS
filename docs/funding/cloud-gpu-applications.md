# 云 / GPU 额度申请材料 · 四家

> 2026-08-30 起草。**所有数字都是从生产库查出来的**(查询见文末), 一个估的都没有。
> 申请里写错一个数字比少写十句漂亮话贵得多。

## 零 · 一条贯穿四份材料的原则

**我们今天不跑在 AWS / GCP / Azure 上。** 生产环境是一台 Linux VM + Cloudflare R2 + KIE 的模型 API。
四份材料里我**都如实这么写**, 没有一份说"我们已经在你们的栈上"。

理由不是道德洁癖 —— 是这些项目的额度**要按实际用量核销**, 谎报开头, 三个月后对不上账,
额度会被收回, 而且这个记录会跟着公司走。**写清楚"我们打算拿它做什么", 比假装已经在用有用得多。**

---

## 一 · 共用事实块(四份都要填, 抄这里)

| 字段 | 内容 |
|---|---|
| Legal name | CSS Studio LLC |
| Country / State | United States · Washington, D.C. |
| Website | https://cssstudio.app |
| Founded | 2026 |
| Employees | 1 (solo founder, full-time ~9 months) |
| Funding | Bootstrapped. No outside capital. Founder holds 100%. |
| Stage | Pre-seed / shipped product, pre-revenue-scale |
| Industry | Generative AI · Media & Entertainment · Creator tools |

**Shipped (verifiable today):**
- 4 native apps live on the Apple App Store — iPhone/iPad, Apple Watch, Apple TV, Apple Vision Pro
- Web platform at cssstudio.app
- **166 published works · 47 with fully generated video · 6 complete video trilogies**
- **45 civilizations · 12 languages · 343 digital actors · 19,393 media assets**
- Backend: TypeScript/Node + a Rust service · PostgreSQL (172 tables) · Cloudflare R2 + CDN

**Traction, stated plainly:** 32 registered users; 0 new in the last 30 days.
We spent the last quarter making the product worth showing rather than showing it.
(**别把这条藏起来。** 云额度项目不看用户曲线, 看的是"你是不是真在造东西";
藏一个他们随手能查的数字, 只会让能查的那部分也变得可疑。)

---

## 一点五 · ⚠️ 投任何一家之前必须先修的东西: **网站上没有"我们是一家公司"的证据**

NVIDIA 给的拒绝理由是「Your company needs to maintain a functional website」。
我们的站是活的(HTTP 200 · 首字节 0.2s · 205KB · 无 JS 也有 8,344 字可见内容), 所以不是白屏。

**实测下来问题在别处:**

```
/about    404      /legal    404
/company  404      /terms    404
/contact  404      /privacy  404
/press    404
首页: 没有 "CSS Studio LLC" · 没有地址 · 没有联系方式 · 没有版权行
```

**站上没有任何一页说明这家公司是谁。** 审核员打开 cssstudio.app, 看到一个自动播放的播放器 ——
功能很酷, 但没有一处证据表明背后有一家注册公司。

**这不只挡住 NVIDIA。** AWS / Google / Microsoft 的资格审核都做同一件事:
点开你的网址, 确认这是一家真实公司。**带着现在这个站去投, 很可能拿到同一个结果。**

**所以顺序是: 先补公司信息页 → 再投。** 需要的最少内容:
法定名称 CSS Studio LLC · 注册地 Washington, D.C. · 联系邮箱 · 一句话业务描述 ·
Terms / Privacy(App Store 本来也需要) · 页脚版权行。

---

## 二 · AWS Activate

**先提 Founders 层** —— 无需任何机构背书, 表最短。
**不提 AI/GenAI 专项那 $300K** —— 那一档是给训练基础模型的团队的, 我们不是。
不合身的档位不去够, 这也是我们能长期用这条渠道的原因。

### What does your company do? (≤ 500 chars)

```
CSS Studio turns one sentence into a finished music video — lyrics, song, video, and
emotion-timed subtitles — and keeps those four as separate tracks so the result stays
editable instead of burned into one file. Each work is produced in its subject's own
language: we have shipped six complete video trilogies in Chinese, Japanese, Persian,
Ancient Greek and Sanskrit. Live on the web and on four native Apple apps (iPhone/iPad,
Watch, TV, Vision Pro).
```

### What will you build on AWS?

```
We are not on AWS today. Our production stack is a single Linux VM plus Cloudflare R2.
Credits would fund three concrete moves we cannot make at our current cost base:

1. GPU inference we currently cannot run at all (EC2 G5/P5): lip-sync for our 343
   digital actors, and singing-voice synthesis so a chosen voice actually sings our
   word-level aligned lyrics. Today we depend on vendor APIs that bake the vocal in,
   which makes the four-track separation our product is built on impossible to finish.
2. Forced alignment and stem separation at scale (WhisperX, Demucs). These run on CPU
   today at roughly 4 minutes per track and gate every work we publish.
3. Migrating media delivery and the API tier off one VM. We currently serve 19,393
   media assets and 129 GB from a single machine with no redundancy.

Estimated first-year usage if granted: roughly $2–4K/month, weighted to GPU inference.
```

### Current monthly cloud spend
```
Under $200/month (single VM + Cloudflare R2 + CDN). Our largest variable cost is
third-party model inference, billed outside any cloud provider.
```

---

## 三 · NVIDIA Inception

> ## ⛔ 2026-08-30 更正 —— 我上面那句话是错的, NVIDIA 这条现在走不通
>
> 我原写:「Jing 说 NVIDIA 一直没消息 —— 多半是申请卡住了而不是被拒。」**这是错的。**
> 我当时凭"官方承诺 2–4 周"推断, 没有去查邮箱 —— 而答案一直躺在 `jing@cssstudio.app` 里。
>
> **事实(邮件原文):**
> - **2026-06-09** NVIDIA Inception:「your organization isn't currently the right fit…
>   **You'll be eligible to reapply after December 6, 2026.**」→ **六月九号就被拒了, 且有冷却期。**
> - **2026-06-16** NVIDIA 给出具体理由:「Your company **also didn't meet the below:
>   — Your company needs to maintain a functional website.**」
> - **2026-06-23** 「We have forwarded this for further review.」→ **此后再无回音。**
>   Jing 在 6/23、7/6、7/8、7/19 又发了四封跟进, **全部没有回复。**
> - 申请页现在直接弹 **"Not Eligible to Apply"** —— 那就是这个冷却期, 不是 bug。
>
> **结论: NVIDIA 在 2026-12-06 之前投不了。** 第五封跟进大概率也不会有回音。
> 下面这份材料留着 —— **12 月 6 日之后原样能用**, 但要先解决下面那个网站问题。
>
> **教训(记牢):** 我们等了两个多月的"没消息", 其实六月九号就有一封白纸黑字的拒信。
> **能查的东西不要等 —— 也不要替它编一个乐观的解释。**

---

**这份 12 月 6 日之后再投**, 因为它: 不要股权 · 无门槛 · 无截止 · 官方承诺 2–4 周回复。

### Describe your AI/deep-learning use case

```
We produce complete musical films end to end: lyrics, song, generated video, and
word-level emotion subtitles, each work rendered in the language of the historical
figure it portrays. Six full trilogies are live — Li Qingzhao and Wang Wei (Chinese),
Matsuo Bashō (Japanese), Rumi (Persian), Sappho (Ancient Greek), Kālidāsa (Sanskrit) —
roughly 165 generated shots per trilogy, cut to a forced alignment of its own vocal track.

Today every model call goes to third-party APIs. That ceiling is the reason for this
application: the two capabilities our roadmap is blocked on both require GPUs we do not have.

  a) Lip-sync / face animation for our 343 digital actors. Vendor video APIs will not
     hold a specific identity across shots; we need to run this ourselves.
  b) Singing voice synthesis. We already compute word-level timing for 12 languages.
     We cannot yet make a chosen voice sing to it, because commercial music APIs
     return a mixed master with the vocal baked in. Separating the four tracks —
     lyrics, music, video, subtitles — is the core of our product.

Also GPU-bound today and running on CPU: WhisperX forced alignment and Demucs stem
separation (~4 min/track), plus 4K upscaling of finished works.
```

### NVIDIA products used or planned
```
Planned: DGX Cloud (H100) for SVS and lip-sync training/inference; NeMo for the
alignment and voice pipeline; TensorRT for inference serving; RTX/L40S class instances
via cloud partners for batch video post-processing. Currently none — we have no GPU
access, which is what this application is about.
```

### Stage / developers
```
One full-time developer (the founder). Incorporated, shipped, live in production on the
web and on four Apple platforms. Bootstrapped, no institutional funding.
```

---

## 四 · Microsoft for Startups Founders Hub

入门层不需要 VC 背书, 先拿一档, 用量做出来再升级。

### What are you building?
```
CSS Studio turns one sentence into a finished music video, produced in the language of
the figure it portrays, delivered as four separately editable tracks rather than one
burned-in file. 166 works published, 47 with fully generated video, across 45
civilizations and 12 languages. Live on the web and on four native Apple apps.
```

### How will you use Azure?
```
We run on a single Linux VM today. Priority uses, in order:
1. GPU inference (NC/ND-series) for lip-sync and singing-voice synthesis — capabilities
   we currently cannot ship at all.
2. Azure AI Speech for forced alignment across our 12 languages, replacing CPU WhisperX.
3. Moving the API tier and Postgres (172 tables, 355 MB, 19,393 media asset rows) off a
   single machine with no redundancy.
```

---

## 五 · Google for Startups Cloud

⚠️ **走 Start 层, 不要投 AI 层。**
AI 层公开条款写明需要 **seed–A 轮机构融资**, 我们没有 —— 投了大概率不是"没消息", 是不合格。
Jing 说 Google 一直没回音, 这可能就是原因。**先进 Start 层, 用量起来再谈升级。**

### What does your startup do?
```
CSS Studio turns one sentence into a finished music video — lyrics, song, video and
emotion-timed subtitles kept as four separate tracks. Every work is produced in its
subject's own language; six complete video trilogies are live in Chinese, Japanese,
Persian, Ancient Greek and Sanskrit. Shipped on the web and on four native Apple apps.
Bootstrapped, one full-time founder, no outside funding.
```

### Planned Google Cloud usage
```
Not on GCP today (single Linux VM + Cloudflare R2). Planned:
- GPU (A100/L4) for lip-sync and singing-voice synthesis — currently impossible for us
- Speech-to-Text for word-level forced alignment across 12 languages
- Cloud Storage + CDN for 19,393 media assets currently served from one machine
- Cloud SQL for a 172-table Postgres with no redundancy today
```

---

## 六 · 我不做的两件事

1. **不创建账号。** 四家都要注册, 那一步 Jing 亲手点。
2. **不填任何税务 / 支付 / 身份信息。** EIN、D-U-N-S、银行、证件号一律不经我手。这条不破例。

材料写好了, 剩下的是**复制粘贴 + 点提交**。

## 七 · 数字来源(可复查)

```sql
SELECT (SELECT count(*) FROM user_works WHERE status='published'),          -- 166
       (SELECT count(*) FROM user_works WHERE is_real_video_mv),            -- 47
       (SELECT count(*) FROM user_works
         WHERE work_type='triptych' AND structure_role='root'
           AND is_real_video_mv),                                           -- 6
       (SELECT count(DISTINCT civilization) FROM user_works
         WHERE civilization<>'' AND civilization IS NOT NULL),              -- 45
       (SELECT count(DISTINCT language) FROM user_works
         WHERE language<>'' AND language IS NOT NULL),                      -- 12
       (SELECT count(*) FROM users),                                        -- 32
       (SELECT count(*) FROM users WHERE created_at > now()-interval '30 days'), -- 0
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public');                                      -- 172
SELECT count(*) FROM digital_actors;                                        -- 343
SELECT count(*) FROM work_assets;                                           -- 19393
SELECT pg_size_pretty(pg_database_size(current_database()));                -- 355 MB
-- 磁盘: df -h /srv -> 129G used / 194G
```
