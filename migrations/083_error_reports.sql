-- CSSOS_WAVE_588 20260602 — Jing「自我康复/净化/修复」: 平台免疫系统的存储层。
-- 客户端每次失败/报错 → beacon → 按【指纹】聚合归类, 供 dev/自愈代理读 digest 精准修复。
CREATE TABLE IF NOT EXISTS error_reports (
  id            BIGSERIAL PRIMARY KEY,
  fingerprint   TEXT NOT NULL UNIQUE,          -- sha1(domain + 归一化 message + code) → 同类只一行
  domain        TEXT NOT NULL DEFAULT 'other', -- payment | generation | auth | network | data | ui | other
  message       TEXT NOT NULL DEFAULT '',
  code          TEXT NOT NULL DEFAULT '',
  sample_action TEXT NOT NULL DEFAULT '',      -- 崩前最后用户动作
  sample_panel  TEXT NOT NULL DEFAULT '',
  build         TEXT NOT NULL DEFAULT '',
  ua_short      TEXT NOT NULL DEFAULT '',
  count         INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'new',   -- new | triaging | fixed | wontfix
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_reports_domain_idx ON error_reports (domain);
CREATE INDEX IF NOT EXISTS error_reports_rank_idx ON error_reports (status, count DESC, last_seen DESC);
