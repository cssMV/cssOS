-- CSSOS_WAVE_1828 — 把读者的提问存下来 (Jing, 2026-08-14)
--
-- 病因: 2026-08-14 想回看「今天那 3 个人到底问了妲己什么」, 发现【一句都没有】。
--   /api/actors/:id/ask 从不落库; nginx 只记 URL、referer、UA, 不记请求体;
--   Node 日志只在降级/失败时才写。于是每天最值钱的东西 —— 读者真正想问什么 ——
--   全部流走, 一条不剩。
--
-- 为什么值钱: 这是唯一不经我们引导、由读者自己打出来的字。落地页文案、预置问题、
--   下一批演员选谁, 都该由它决定, 而不是由我们猜。
--
-- Jing 划的边界(只存这四样, 多一样都不存):
--   问题正文 + 演员 + 来源页 + 时间
--   → 不存 IP, 不存 User-Agent, 不存 user_id, 不做任何指纹。
--   访客是匿名的, 存的就只能是他说的话, 不能是他这个人。
--
-- 来源页拆成三列而不是原样存 referer: referer 里挂着 fbclid / _aem_ 这类
--   Meta 的追踪串, 那本身就是一种跨站标识符。只提炼我们自己需要的三样:
--   路径、章节 slug、cssADS 归因标签, 其余丢弃。

CREATE TABLE IF NOT EXISTS actor_ask_log (
  id          BIGSERIAL PRIMARY KEY,
  asked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    TEXT        NOT NULL,
  question    TEXT        NOT NULL,
  source_path TEXT,                 -- 来源页路径, 已剥掉全部 query
  source_slug TEXT,                 -- 故事章节 slug (来自 /story/<slug>), 非故事页则为 NULL
  source_ads  TEXT                  -- cssADS 归因标签
);

-- 「今天问了什么」是最高频的查法
CREATE INDEX IF NOT EXISTS actor_ask_log_asked_at_idx ON actor_ask_log (asked_at DESC);
-- 「这位演员最常被问什么」—— 决定下一批演员和预置问题
CREATE INDEX IF NOT EXISTS actor_ask_log_actor_idx    ON actor_ask_log (actor_id, asked_at DESC);
