-- CSSOS_WAVE_1925 20260824 — 文明智能联动 · 人物声部
-- Jing:「请以后,特别是数字演员,一定要分清人物性别。」
--
-- 缺口①: user_works 里没有任何指回 digital_actors 的字段 —— 歌和人是断开的。
--   566 首标题点名了演员的作品, 只有 3 首把性别传给了引擎。妲己 6 首全是抛硬币。
-- 这里补上 actor_id, 并把已存在的作品按【标题精确包含演员名】回填一次。
-- 名字长度 >= 2 才参与匹配(单字名会误命中普通词); 同一作品命中多个演员时取最长名。

ALTER TABLE user_works ADD COLUMN IF NOT EXISTS actor_id text;
CREATE INDEX IF NOT EXISTS idx_user_works_actor_id ON user_works(actor_id) WHERE actor_id IS NOT NULL;

-- 回填 actor_id: 每首作品取【标题里命中的最长演员名】那一位
WITH best AS (
  SELECT DISTINCT ON (w.id) w.id AS work_id, a.actor_id
    FROM user_works w
    JOIN digital_actors a
      ON a.name_zh IS NOT NULL AND length(a.name_zh) >= 2
     AND w.title LIKE '%' || a.name_zh || '%'
   WHERE w.status <> 'deleted' AND w.actor_id IS NULL
   ORDER BY w.id, length(a.name_zh) DESC
)
UPDATE user_works w SET actor_id = b.actor_id
  FROM best b WHERE w.id = b.work_id;

-- 回填声部三件套: 只填空的, 已有值的一律不动(用户/调用方的选择优先)
UPDATE user_works w
   SET voice_gender    = COALESCE(w.voice_gender, a.gender),
       vocal_style     = COALESCE(w.vocal_style, NULLIF(a.voice_style, '')),
       updated_at      = now()
  FROM digital_actors a
 WHERE w.actor_id = a.actor_id
   AND w.status <> 'deleted'
   AND (w.voice_gender IS NULL OR w.vocal_style IS NULL)
   AND a.gender IS NOT NULL AND a.gender <> '';
