-- CSSOS_WAVE_114 20260702 — Jing「信用积分系统(暂时隐藏)+ 数字演员滥用举报/撤权」。
-- 信用积分 = 行为信用分(像社会信用分), 平台【唯一】用"积分"的地方。
--   与钱包 credits(=cents 可充值)完全不同: 信用分【不能买卖、不能充值、不能转让】, 只由行为增减。
-- 乱用别人的数字演员(恶意/违规)→ 演员本人举报 → 核实后扣该用户信用分。

-- ① 用户信用分(默认 100; 越低越受限)。
CREATE TABLE IF NOT EXISTS user_trust (
  user_id      UUID PRIMARY KEY,
  trust_score  INTEGER NOT NULL DEFAULT 100,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 信用分变更审计(不可篡改)。
CREATE TABLE IF NOT EXISTS trust_events (
  event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  delta        INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_events_user_idx ON trust_events (user_id);

-- ② 数字演员滥用举报(演员本人举报某作品滥用了他的数字演员)。核实后扣被举报者信用分。
CREATE TABLE IF NOT EXISTS actor_misuse_reports (
  report_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         TEXT NOT NULL REFERENCES digital_actors(actor_id) ON DELETE CASCADE,
  work_id          UUID,
  reporter_user_id UUID NOT NULL,     -- 演员本人(owner)
  reported_user_id UUID,              -- 作品创作者(被举报)
  category         TEXT,              -- defamation | sexual | political | hate | brand_abuse | other
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  trust_penalty    INTEGER NOT NULL DEFAULT 0,   -- 核实后实扣分
  reviewer         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS actor_misuse_reports_actor_idx  ON actor_misuse_reports (actor_id);
CREATE INDEX IF NOT EXISTS actor_misuse_reports_status_idx ON actor_misuse_reports (status);
CREATE INDEX IF NOT EXISTS actor_misuse_reports_reported_idx ON actor_misuse_reports (reported_user_id);
