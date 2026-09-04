\set ON_ERROR_STOP on
BEGIN;
-- W2072 《Popol Wuj · 玛雅三部曲》上线。归属 yidudc@gmail.com(新作品默认归属铁律)。
WITH u AS (SELECT id FROM users WHERE email='yidudc@gmail.com' LIMIT 1),
root AS (
  INSERT INTO user_works (user_id, title, work_type, structure_role, sequence_index,
                          language, civilization, status, is_real_video_mv, duration_secs,
                          preview_video_url, created_at, updated_at)
  SELECT u.id, 'Popol Wuj · 玛雅三部曲', 'triptych', 'root', 0,
         'quc', '玛雅文明', 'published', true, 684,
         'https://cdn.cssstudio.app/artifacts/mv/maya-p1-xkik.mp4', now(), now()
  FROM u RETURNING id
)
INSERT INTO user_works (user_id, title, work_type, structure_role, sequence_index,
                        language, civilization, status, is_real_video_mv, duration_secs,
                        preview_video_url, root_work_id, parent_work_id, created_at, updated_at)
SELECT (SELECT id FROM u), t.title, 'single', 'part', t.seq,
       'quc', '玛雅文明', 'published', true, t.dur, t.url,
       (SELECT id FROM root), (SELECT id FROM root), now(), now()
FROM (VALUES
  ('Popol Wuj · 玛雅三部曲 · Xkik''(血月姑娘)',      1, 218, 'https://cdn.cssstudio.app/artifacts/mv/maya-p1-xkik.mp4'),
  ('Popol Wuj · 玛雅三部曲 · Xib''alb''a(下黄泉)',   2, 224, 'https://cdn.cssstudio.app/artifacts/mv/maya-p2-xibalba.mp4'),
  ('Popol Wuj · 玛雅三部曲 · Ixim(玉米重生)',        3, 242, 'https://cdn.cssstudio.app/artifacts/mv/maya-p3-ixim.mp4')
) AS t(title, seq, dur, url);
COMMIT;

SELECT left(w.title,42) AS 标题, w.structure_role AS 角色, w.sequence_index AS 序,
       w.duration_secs AS 秒, w.id::text AS id
FROM user_works w WHERE w.title LIKE 'Popol Wuj%' ORDER BY w.sequence_index;
