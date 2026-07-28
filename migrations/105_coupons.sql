-- CSSOS_WAVE_1660 — 优惠码兑换系统 (Phase 1). Jing: "有付费的地方，就有优惠码".
-- 每个码 = 一种权益(type)，单用户单次(coupon_redemptions 主键)、可设总量与有效期。
-- Phase 1 支持: credits(钱包分,不可提现) · gen_rights(生成权) · subscription(某档+顺延天数)。
-- (actor_voice / actor_ask 等奖励额度留 Phase 2, type 已可扩展。)
CREATE TABLE IF NOT EXISTS coupons (
  code             TEXT PRIMARY KEY,               -- 兑换码(大写规范化)
  type             TEXT NOT NULL,                  -- credits | gen_rights | subscription | actor_voice | actor_ask | ...
  amount           BIGINT NOT NULL DEFAULT 0,      -- 含义随 type: 分 / 次数 / 天数
  sub_tier         TEXT,                           -- type=subscription 时的档: starter|pro|studio
  max_redemptions  INTEGER,                        -- 总量上限(NULL=无限)
  redemptions_used INTEGER NOT NULL DEFAULT 0,
  per_user_limit   INTEGER NOT NULL DEFAULT 1,     -- 单用户可兑次数(默认 1)
  expires_at       TIMESTAMPTZ,                    -- 有效期(NULL=不过期)
  active           BOOLEAN NOT NULL DEFAULT true,
  campaign         TEXT,                           -- 归类, 如 'product_hunt'
  note             TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  code         TEXT NOT NULL,
  user_id      UUID NOT NULL,
  granted      JSONB NOT NULL DEFAULT '{}'::jsonb, -- 审计: 实发了什么
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)                       -- 天然保证单用户单次
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON coupon_redemptions (user_id);
