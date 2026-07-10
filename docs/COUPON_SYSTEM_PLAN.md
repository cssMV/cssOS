# 优惠码兑换系统 — Phase 1 已上线 ✅（2026-07-09, W1660）

> **Phase 1 shipped & live.** 表(`migrations/105_coupons.sql`)+ 端点
> (`/api/coupons/redeem`, `/api/admin/coupons`)+ 前端(`app.coupon-redeem.js`,
> `?coupon=CODE` 深链)全部部署。**PHUNT** = subscription·Pro·90 天·上限 500·到 8/14
> 已建。管理 token 在 `/etc/cssos.env` 的 `CSSOS_ADMIN_TOKEN`。Phase 2 待办：
> actor_voice / actor_ask 奖励额度 + language_rights / voice_rights 券种。

---

# 优惠码兑换系统 — 原始计划

目标：生成/发放优惠码 → 用户兑换 → 记账发放对应权益。**每种码只对应一种权益**（Jing：
"发放优惠码的时候，只能对应着用"），单用户单次、可设总量与有效期。首要用途：PH 专属
"3 个月 Pro 免费"码。与现有计费宪法（W219）对齐：钱包=分、gen_rights、membership.tier +
expires_at；**券送的额度/credits 不可提现**（同 bonus/refund 规则）。

## 一、券的类型（每种码 = 一种权益）
| type | amount 含义 | 兑换后发放 | 例子 |
|---|---|---|---|
| **credits** | 分(cents) | 钱包 balance += N（标记不可提现） | `WELCOME500` = $5 |
| **gen_rights** | 次数 | user_credits.gen_rights += N（生成权） | `GEN10` = 10 生成权 |
| **subscription** | 天数 + 档位 | membership.tier = X、expires_at 顺延 N 天 | `PHUNT-PRO-90` = Pro 90 天 |
| **actor_voice** | 条数 | 数字演员**语音**额度 +N（奖励额度） | `VOICE50` = 50 条语音 |
| **actor_ask** | 条数 | 数字演员**文字聊天**额度 +N | `ASK100` = 100 条问 |
| *(后续可扩)* | — | 去水印 / 4K 升频 / lossless 等能力券 | — |

## 二、数据模型
**`coupons`**：`code`(唯一) · `type` · `amount` · `sub_tier`(仅 subscription) ·
`max_redemptions`(总量, null=无限) · `redemptions_used` · `per_user_limit`(默认 1) ·
`expires_at` · `active` · `campaign`(如 "product_hunt") · `note` · `created_by` · `created_at`。

**`coupon_redemptions`**：`coupon_id` · `user_id` · `redeemed_at` · `granted`(jsonb 审计) ·
**主键 (coupon_id, user_id)** → 天然保证"单用户单次"。

## 三、兑换流程
- **前端**：Settings → 订阅/钱包 里加一个「兑换优惠码」输入框；支持深链 `?coupon=CODE` 自动填。
- **`POST /api/coupons/redeem {code}`**（需登录）：
  1. 查券：active、未过期、`redemptions_used < max_redemptions`。
  2. 查该用户是否已兑换（redemptions PK）。
  3. **原子发放**（按 type）：credits→加余额(不可提现) / gen_rights→加权 / subscription→设档+顺延天数
     / actor_voice|ask→加奖励额度（在 actor_voice_meter / actor_ask_meter 旁加一列 bonus，或建 grants 表，
     计费时先扣 bonus 再走月度免费额度）。
  4. 记 redemption + 原子自增 `redemptions_used`。
  5. 返回"发放了什么"。
- **`POST /api/admin/coupons`**（管理，isCssosAdminEmail）：生成码 + 设 type/amount/档/总量/有效期；
  另有 list / 停用。

## 四、防滥用
- 单用户单次（PK）· 总量上限 · 有效期 · 兑换接口限流（每 IP/用户）· 券送的额度**不可提现**。

## 五、PH 专属券（落地示例）
- **`PHUNT` → subscription · Pro · 90 天**，max_redemptions 建议 500，expires 2026-08-14。
- 建好后回 PH「Promo code」填：offer="3 months of Pro, free"、code="PHUNT"、expiration=Aug 14。

## 六、分期（7/14 前来得及）
- **Phase 1（PH 够用）**：coupons/redemptions 表 + 兑换端点 + 3 种核心 type(subscription / credits /
  gen_rights) + 前端兑换框 + 管理建码。→ 足以支撑 "PHUNT 3 个月 Pro"。
- **Phase 2**：actor_voice / actor_ask 奖励额度（需接 meter）。

---
**待你确认**：① 券种类是否就这 5 种（要加/减？）② PH 券给 Pro 90 天 · 上限 500 · 到 8/14，对吗？
③ 先做 Phase 1 就发布，Phase 2 随后？ 你点头我就开工。
