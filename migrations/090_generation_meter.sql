-- CSSOS_WAVE_1454 — 每月免费生成计次表(Jing: 免费用户 3 次/月, 超出按量付/买生成权包)。
-- 每用户每自然月一行, used = 本月已计费生成次数(免费+付费都计, 决定第几次起收费)。
-- 原子 upsert 自增(防 re-fire/并发重复计次): INSERT ... ON CONFLICT DO UPDATE used=used+1 RETURNING used。
CREATE TABLE IF NOT EXISTS generation_meter (
  user_id    uuid        NOT NULL,
  ym         text        NOT NULL,                 -- 'YYYY-MM' (UTC)
  used       int         NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ym)
);
