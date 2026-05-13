-- CSSOS_WAVE_119 20260513 — Jing
-- "今日纪念" 自动 MV 系统标记.
--
-- 系统每日扫描 person_profiles.birth_month_day / death_month_day,
-- 命中今日的人物 → 自动调用 MV pipeline 生成一支纪念 MV. 这些作品
-- 的版权规则（用户指令，硬编码）:
--   owner_user_id = 系统管理员 (system@cssstudio.app)
--   visibility = 'public'
--   listen_price_cents = 0      永久免费
--   buyout_enabled = false      不可买卖
--   tips_enabled = true         接受打赏给系统运营基金
--
-- system_origin 标记拦截任何后续 PATCH 试图修改价格/visibility/owner.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS system_origin TEXT;

-- "system_anniversary" = 出生/忌辰自动 MV
-- "system_festival"    = 节气/节日自动 MV (Wave 120 预留)
-- NULL                 = 普通用户作品 (绝大多数)
CREATE INDEX IF NOT EXISTS user_works_system_origin_idx
  ON user_works (system_origin)
  WHERE system_origin IS NOT NULL;

-- 自动生成日志表 -- 用于幂等保护 (同一人物+同一天不重复生成).
CREATE TABLE IF NOT EXISTS system_anniversary_log (
  id              BIGSERIAL PRIMARY KEY,
  run_date        DATE NOT NULL,
  person_id       TEXT NOT NULL REFERENCES person_profiles(person_id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,            -- "birth" | "death"
  work_id         UUID REFERENCES user_works(id) ON DELETE SET NULL,
  status          TEXT NOT NULL,            -- "queued" | "ok" | "failed" | "skipped"
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  error_detail    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_date, person_id, event_type)
);

CREATE INDEX IF NOT EXISTS sys_anniv_log_date_idx  ON system_anniversary_log (run_date DESC);
CREATE INDEX IF NOT EXISTS sys_anniv_log_status_idx ON system_anniversary_log (status);
