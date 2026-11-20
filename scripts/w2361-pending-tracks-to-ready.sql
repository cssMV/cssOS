-- W2361 — 把【确实有活音频】的 pending 轨翻成 ready。
--
-- 为什么要翻: 播放器与胶囊过滤 status='ready'。轨建了、音频也在, 却卡在 pending
-- → 多语言/多声线胶囊里【隐形】, available_langs 也空。这是 W2338 之前"建轨漏 status"
-- 留下的存量(今天那次回填只覆盖了 role=part 的 10 条)。
--
-- 判据【只认两样】, 两样都实测过:
--   ① audio_url 是 http(s) 真 URL  —— 27 条; 抽 6 条 curl 全部 206, 字节拿得到
--   ② duration_secs > 0            —— 这 27 条全都有(实测时长, 不是猜的)
-- 另外 11 条 audio_url 是【空串】(不是 NULL, 所以 IS NOT NULL 滤不掉)且无时长,
-- 是 pre-epic 占位行 —— 【不动】。把没有音频的标成 ready 是撒谎, 比留着 pending 更坏。
BEGIN;
CREATE TABLE IF NOT EXISTS w2361_track_status_pre_backup AS
  SELECT id, work_id, lang, voice, status, audio_url, duration_secs, now() AS backed_up_at
  FROM work_language_tracks WHERE status = 'pending';

UPDATE work_language_tracks
   SET status = 'ready', updated_at = now()
 WHERE status = 'pending'
   AND audio_url ~ '^https?://'
   AND duration_secs IS NOT NULL AND duration_secs > 0;

SELECT status, count(*) AS n,
       count(*) FILTER (WHERE audio_url ~ '^https?://') AS with_real_url
  FROM work_language_tracks GROUP BY 1 ORDER BY 2 DESC;
COMMIT;
