# KIE Claude 通道故障 —— 报障稿 (2026-08-31)

## ⛔ 2026-09-02 更正: **Gemini 没有挂 —— 是我报错了**

**实测(连续 5 次, 全部成功):**

| 调用 | 结果 |
|---|---|
| 纯文字 `gemini-3-pro` ×3 | **3/3 成功, 4–5 秒** |
| 带图 `gemini-3-pro` ×2 | **2/2 成功, 7–16 秒**, 视觉判读正确 |

**W2058 里「Gemini 60s 挂死、只剩 GPT 一家」是错的。** 当时两次探针都超时,
**我从两次瞬时失败推出了一个全局结论** —— 那大概只是一次短暂抖动。

⚠️ **如果那段 Gemini 追问稿已经发给 KIE 客服, 需要撤回或说明** —— 他们查不出问题。
**Claude 那部分依然成立**(厂商已亲口确认「资源短缺、无恢复时间」), 只有 Gemini 这段作废。

**同一个毛病今天犯了五次**(grep|head 截断 / 只试无扩展名路径 / 用磁盘存在性判封面 /
只看首页链接就说"唯一入口" / 两次超时就说 Gemini 挂了)。根都一样:
**样本不足却下了「没有」「唯一」「挂了」这类全称判断。**
→ 规矩: **下全称否定结论之前, 必须问"我这个探测够不够, 要不要多测几次/换个形式"。**

---

## ⚠️ 2026-08-31 后续: KIE 已答复, 且发现 Gemini 也挂了

**KIE 微信客服原话:**

> 「是的 Claude 资源短缺有一段时间了, 目前还没有具体的恢复时间, 我们还在想办法解决」

**即: Claude 通道无限期不可用**, 不是几天的事。我们 W2053 的快速失败是对的应对
(不重试、立即让给下一家), 保持不动, Claude 恢复后会自动回到打前锋。

### 但顺手实测三强, 发现真正的风险不在 Claude

| 通道 | 状态 | 实测 |
|---|---|---|
| Claude `claude-fable-5` | ❌ | 1.5s 报 `Internal error` —— 快速失败生效中 |
| **Gemini `gemini-3-pro`** | ❌ | **60s 整超时, 空响应 —— 不是报错, 是挂住不回** |
| GPT `gpt-5-6-sol` | ✅ | 2.2s 正常 |

(⚠️ 第一次测 Gemini 我把 model 写成了 `gemini-3.1-pro` —— 那是 **URL 路径**,
不是 model 值。改用代码里的真值 `gemini-3-pro` 重测, **仍是 60s 超时**, 结论成立。
**判据要取自代码, 不能照着 URL 猜。**)

### 真正的风险: 单腿走路 + 后面那道保险会卡 2 分钟

```
CAPABLE_TEXT_PREFER = ["kie"(Claude), "kie_gpt", "kie_gemini"]
CAPABLE_TEXT_TIMEOUT_MS = 120_000   ← 每家 2 分钟
```

**Claude 快速失败 → GPT 顶着全部 → Gemini 挂死。**
整个平台的文本能力完全押在 GPT 一家。现在看不出来是因为 GPT 没出过事;
**它一出事, 用户看到的是转满 2 分钟然后失败** —— 因为兜底的 Gemini 不回包。

### 待办

1. **问 KIE: Gemini 通道是不是也挂了**(下面有现成的微信追问稿)
2. **待 Jing 决定**: 要不要给最后一档 provider 单独设一个短超时(如 20s),
   让 GPT 万一失败时快速降级而不是卡 2 分钟。**这是代码改动, 未经同意不动。**

---

## 微信追问稿(Gemini)

> 还想请教一下: 我们这边测 Gemini 通道也不通 —— 端点
> `https://api.kie.ai/gemini-3.1-pro/v1/chat/completions`, model `gemini-3-pro`,
> **60 秒整超时、返回空, 不报错也不回包**(同一把 key、同一时刻, GPT 通道 2 秒正常返回)。
>
> 请问 Gemini 是不是也在资源短缺的范围内? 还是我们的调用姿势有问题?
>
> 另外想确认一下: **目前贵方哪些文本模型是可用的?** 我们想据此调整调用顺序 ——
> 现在 Claude 和 Gemini 都不通, 全部流量压在 GPT 上, 想避免单点。

---

**渠道: ⭐ 微信(Jing 有 KIE 客服微信) —— 最快, 优先走这条。** 以下为备用:

| 方式 | 地址 | KIE 自己的说法 |
|---|---|---|
| 邮件(备用) | **`support@kie.ai`** | "You may also email us at support@kie.ai, **but this is not the preferred or fastest option**" |
| Discord / Telegram | `https://kie.ai/vip-support` | 他们标为 preferred, 授权后开专属私有频道 |

支持时段: **UTC 21:00 – UTC 17:00(次日)**。
他们的法人实体(terms 页): NEXUSAI SERVICES LLC, 118 Krameria St, Denver CO 80220, US。

> ⛔ **Jing 已定: 不授权 Discord / Telegram, 过去现在将来都不走。只发邮件。**
> 慢一点可以接受, 换第三方账号绑定不接受。
>
> 我先前写「官网唯一入口是 vip-support」是错的 —— **只看了首页可见链接就下了结论**,
> `support@kie.ai` 一直写在 `docs.kie.ai` 上。**探测不全, 却下了「唯一」这种全称判断。**
> (顺带澄清一个真实区分, 免得日后误判: Discord/Telegram 是**客服窗口**, 不是 API 通道 ——
> 走它不违反「调用 host 必须是 api.kie.ai」。但 Jing 的决定与铁律无关, 是不绑第三方账号, 照办。)

**发件人建议:** `jing@cssstudio.app`(与 KIE 账户注册邮箱一致最好, 便于他们定位账户)。
**主题:** `Claude endpoint returning no_available_account for 10 days — account credit is fine`

**为什么这份证据够硬:** 余额充足 + 同一把 key 的 GPT 通道正常 + 三个 Claude 型号全挂
→ 问题在他们的 Claude 上游账号池, 不在我们这边。**堵死了「先去查你余额/你的 key」这条回复。**

---

## ⭐ 微信版(Jing 有 KIE 客服微信, 优先走这条)

> KIE 你好，报个障：**Claude 通道已经挂了 10 天，所有 Claude 型号都不可用。**
>
> 端点：`POST https://api.kie.ai/claude/v1/messages`
>
> 三个型号同一时刻实测：
> · `claude-fable-5` → `{"type":"error","error":{"type":"api_error","message":"Internal error, please try again later"}}`
> · `claude-sonnet-5` → 同上
> · `claude-opus-5` → `error code: 502`
>
> **流式调用下更隐蔽：HTTP 状态是 200，但 SSE 流里带 `{"type":"error"}`，消息是
> `no_available_account`，且一个字都没返回。** 这会让客户端把失败误判成成功 ——
> 建议这种情况返回非 2xx 状态码。我们就是因此白跑了 10 天才发现。
>
> **不是我们账户的问题：**
> · 余额充足 —— `/api/v1/chat/credit` 返回 **219.36**
> · **同一把 API key，GPT 通道正常** —— 今天 12:42 还成功走了 `gpt-5-6-sol`
> · `Claude Fable 5` 就列在你们 Market 页面上，型号 ID 没写错
>
> 时间范围：我们日志里最早一次是 **8 月 21 日 20:58**，到 8 月 31 日仍然如此，
> **14 天内出现 188 次 —— 每一次 Claude 调用都中招。**
>
> 想请教三个问题：
> 1. Claude 上游账号池是不是空了或者宕了？大概什么时候能恢复？
> 2. 我们账户上有没有什么设置，导致被排除在 Claude 池之外？
> 3. `no_available_account` 能否改成返回非 2xx，而不是 200 + SSE error？

---

## 直接粘给 KIE 的正文(英文)

> **Claude endpoint returning `no_available_account` for 10 days — all Claude models, same key works for GPT**
>
> Endpoint: `POST https://api.kie.ai/claude/v1/messages`
>
> **Every Claude model fails. Same API key, same moment:**
>
> | Model | Result |
> |---|---|
> | `claude-fable-5` | `{"type":"error","error":{"type":"api_error","message":"Internal error, please try again later"}}` |
> | `claude-sonnet-5` | same `Internal error` |
> | `claude-opus-5` | `error code: 502` |
>
> **In streaming mode the failure looks different and is harder to detect:** the HTTP status is
> **200 OK**, but the SSE stream carries `{"type":"error", ...}` with the message
> **`no_available_account`** and no content. Returning an upstream failure as HTTP 200 means
> naive clients treat it as success — please consider returning a non-2xx status for this case.
>
> **This is not a billing or key problem on our side:**
> - Account credit balance: **219.36** (`/api/v1/chat/credit` returns `{"code":200,"data":219.36}`)
> - The **same API key** successfully serves GPT requests — our logs show
>   `served by kie_gpt/gpt-5-6-sol` at 2026-08-31 12:42, minutes after a Claude failure
> - `Claude Fable 5` is listed in your Market, so the model IDs are current
>
> **Duration:** first occurrence in our logs **2026-08-21 20:58**, still failing on **2026-08-31**.
> **188 occurrences in the last 14 days — every single Claude call.**
>
> **Impact:** Claude is our first-choice model; every request wastes retries and silently falls
> back to GPT, so our production has effectively had no Claude access for 10 days.
>
> **Questions:**
> 1. Is the Claude upstream account pool exhausted or down? Is there an ETA?
> 2. Is there anything on our account that would exclude us from the Claude pool?
> 3. Can `no_available_account` return a non-2xx status instead of 200 + SSE error?

---

## 我们这边已做的缓解(W2053)

`no_available_account` 不再重试, 立即让给下一家 —— 每次调用省约 4 秒。
**上游没修, 只是不再为它白等。** Claude 恢复后自动回到「三强 Claude 打前锋」。

## 复现命令(需要 KIE_API_KEY)

```bash
curl -s -X POST "https://api.kie.ai/claude/v1/messages" \
  -H "Authorization: Bearer $KIE_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"claude-fable-5","max_tokens":8,"messages":[{"role":"user","content":"hi"}]}'
```
