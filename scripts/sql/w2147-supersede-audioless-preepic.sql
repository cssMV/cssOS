-- W2147 · 让 8 条【没有任何音频】的 pre-epic 轨安静退场
--
-- 它们是 2026-08-24 丢音频事故的墓碑: 记录还在, 字节没了(R2 Unversioned, 同 key 原地覆盖)。
-- 迁到 voice='pre-epic' 之后, 它们在多声线胶囊里各自画出一颗独立的胶囊 —— 点了没声音。
-- (W2142 那 10 条没暴露这个问题, 因为它们与真轨同 (lang,voice), 被去重吃掉了。)
--
-- 丢掉的是 Suno 当时那一次演绎, 拿不回来 —— 重跑只会得到【另一首】, 不是那一首。
-- 所以这里【不生成任何东西】, 只让那颗哑胶囊退场。
--
-- 一行不删、一个字节不动, 只翻 status。配套 W2147 前端: status='superseded' 的轨
-- 不画格子(光翻 status 不够 —— 胶囊的 meaningful 过滤原本不看 status,
--  退场轨会变成一颗 disabled 的 " ⚠" 格子, tooltip 说「渲染中…」, 比不处理更糟)。
--
-- 回滚: UPDATE work_language_tracks t SET status=b.old_status
--         FROM w2147_audioless_track_backup b WHERE t.id=b.track_id;

BEGIN;

CREATE TABLE IF NOT EXISTS w2147_audioless_track_backup (
  track_id   bigint PRIMARY KEY,
  work_id    uuid NOT NULL,
  old_status text NOT NULL,
  backed_up  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO w2147_audioless_track_backup (track_id, work_id, old_status)
SELECT t.id, t.work_id, t.status
  FROM work_language_tracks t
 WHERE t.voice = 'pre-epic'
   AND t.status = 'ready'
   AND NULLIF(t.audio_url, '')     IS NULL
   AND NULLIF(t.alt_audio_url, '') IS NULL   -- ♪2 也没有才算真的哑
ON CONFLICT (track_id) DO NOTHING;

UPDATE work_language_tracks t
   SET status = 'superseded', updated_at = now()
  FROM w2147_audioless_track_backup b
 WHERE t.id = b.track_id AND t.status = 'ready';

