-- CSSOS_WAVE_666 #52 — 跨设备按账号同步的用户偏好(首用: 激活语言 activated_locales)。
-- 通用 KV(user_id, key) → jsonb value, 方便以后存更多个性化偏好, 不必每项加列。
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id    UUID        NOT NULL,
  key        TEXT        NOT NULL,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
