-- CSSOS_WAVE_1634 — 数字演员语音「每演员·每月」免费额度计次表。
-- Jing 设计: 自我介绍免费(读缓存); 问答语音每档每演员每月有免费额度
--   (free3 / starter20 / pro60 / studio200), 用完走钱包按句扣, 文字永远免费。
-- 每 (用户, 演员, 自然月) 一行, used = 本月对该演员已用的免费语音句数。
-- 原子 upsert 自增 + WHERE used < quota, 只在未超额度时消费(防并发重复计次)。
CREATE TABLE IF NOT EXISTS actor_voice_meter (
  user_id    uuid        NOT NULL,
  actor_id   text        NOT NULL,
  ym         text        NOT NULL,                 -- 'YYYY-MM' (UTC)
  used       int         NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, actor_id, ym)
);
