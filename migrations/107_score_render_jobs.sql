-- CSSOS_WAVE_1700 — 乐谱忠实渲染的作业队列。
--
-- 为什么必须有它(Jing:「长久之计」):
--   渲染原本跑在 HTTP 请求路径里 —— 一首 3 分钟圣诗阻塞 4 秒、占满一个核。
--   同时传 4 首, 4 个核全被吃掉, 而这台机器还在跑 API / 影院 / 面对面。
--   这跟 f2f 与 MV 批渲染是同一类病: 延迟敏感的实时工作, 不能和吞吐导向的批处理
--   共享同一个调度池。解法不是换机器, 是把渲染挪出请求路径 + 限并发 + 降优先级。
--
-- 解析(~50ms)仍留在请求内 —— 用户上传即刻拿到歌词与逐字时间轴;
-- 只有渲染(秒级)进队列。
CREATE TABLE IF NOT EXISTS score_render_jobs (
  job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',   -- queued | running | done | failed
  xml_path      TEXT NOT NULL,                    -- 已落盘的 MusicXML(worker 重新解析)
  out_dir       TEXT NOT NULL,                    -- 成品目录(public/uploads/musicxml/<user>)
  url_prefix    TEXT NOT NULL,                    -- 成品对外前缀(/uploads/musicxml/<user>)
  title         TEXT,
  audio_url     TEXT,
  midi_url      TEXT,
  duration_secs INTEGER,
  attempts      INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

-- worker 取活: 按 status + 时间。
CREATE INDEX IF NOT EXISTS score_render_jobs_claim_idx
  ON score_render_jobs (status, created_at);
-- 用户查自己的作业。
CREATE INDEX IF NOT EXISTS score_render_jobs_user_idx
  ON score_render_jobs (user_id, created_at DESC);

-- W1703 — 忠实 MV 成品(音频完成后, 逐行歌词生成画面并合成 mp4)。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS mv_url TEXT;

-- W1706 — 圣诗字幕 JSON(逐字精确时间, 庄严档), 供影院情绪字幕实时驱动。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS subtitle_url TEXT;

-- W1714 — 分享用海报帧(从 MV 抽一帧, 作 og:image)。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS poster_url TEXT;

-- W1716 — 批量入队可选跳过 MV(纯音频+字幕秒出, 先填满画廊; MV 慢, 之后再补)。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS render_mv BOOLEAN NOT NULL DEFAULT true;

-- W1720 — 宗教传统标签(多信仰): christian|buddhist|islamic|hindu|jewish|sikh|secular|other。
-- 引擎对任意 MusicXML 一视同仁; 这个标签只驱动【各传统各自的视觉主题 + 内容红线】。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS tradition TEXT NOT NULL DEFAULT 'secular';

-- W1721 — 只出【一张】2.39:1 影院封面(不跑整部 MV): 音频-only 内容也能有封面图上卡 + og:image。
-- 默认 false, 现有 --no-mv 批次保持零出图成本; 想要封面时显式开(batch --cover)。
ALTER TABLE score_render_jobs ADD COLUMN IF NOT EXISTS render_cover BOOLEAN NOT NULL DEFAULT false;
