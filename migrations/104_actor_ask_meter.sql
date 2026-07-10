-- CSSOS_WAVE_1636 — 数字演员「问」(LLM 对话)「每演员·每月」免费额度计次表。
-- Jing: 听和问都设免费额度(问额度很大, 普通用户碰不到)。开场问候(history 为空)永久免费;
--   从用户第一个真问题起计。用完走钱包按条扣, 钱包空 → 演员口吻提醒充值(文字回复=提醒本身)。
-- 每 (用户, 演员, 自然月) 一行, used = 本月对该演员已用的免费问答条数。原子 upsert + WHERE used < quota。
CREATE TABLE IF NOT EXISTS actor_ask_meter (
  user_id    uuid        NOT NULL,
  actor_id   text        NOT NULL,
  ym         text        NOT NULL,                 -- 'YYYY-MM' (UTC)
  used       int         NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, actor_id, ym)
);
