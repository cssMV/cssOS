# KIE Claude 通道故障 —— 报障稿 (2026-08-31)

**渠道(2026-08-31 复查后更正):**

| 方式 | 地址 | KIE 自己的说法 |
|---|---|---|
| **邮件 ✅ 我们走这条** | **`support@kie.ai`** | "You may also email us at support@kie.ai, **but this is not the preferred or fastest option**" |
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
