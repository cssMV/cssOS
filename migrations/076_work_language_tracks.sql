-- CSSOS_TIER_C_MULTILINGUAL 20260520 — Jing
-- Multilingual lyric tracks × multi-voice lanes (cssOS world-first).
--
-- A "language track" is an inseparable bundle for one work + one
-- language: re-sung lyrics (transcreation, NOT subtitle translation) +
-- its own Suno voice lane (audio) + its own Whisper-aligned emotional
-- subtitles. The video / slideshow is SHARED across language tracks and
-- is NOT stored here (it lives on work_assets.final_mv as before); the
-- 🌐 player pill swaps audio + lyrics + subtitle live while the picture
-- keeps playing.
--
-- track_order: 0 = the original / default track (always free). 1..N =
-- paid extra languages, in the user's selection order. is_default marks
-- which track auto-plays on open (normally order 0).
--
-- One row per (work_id, lang). A work with only its original language
-- has exactly one row (order 0). Existing single-language works are NOT
-- backfilled here — they keep playing via the legacy audio_track_1 path;
-- a row is created lazily the first time a language track is added.

CREATE TABLE IF NOT EXISTS work_language_tracks (
  id              BIGSERIAL PRIMARY KEY,
  work_id         UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  lang            TEXT NOT NULL,                 -- ISO code: en, zh, ja, …
  track_order     INTEGER NOT NULL DEFAULT 0,    -- 0 = original/default (free)
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  audio_url       TEXT,                          -- Suno voice lane for this lang
  duration_secs   INTEGER,                       -- this lane's own duration
  lyrics          TEXT,                          -- re-sung lyrics (transcreation)
  subtitle_url    TEXT,                          -- Whisper-aligned SRT for this lang
  voice_meta      JSONB NOT NULL DEFAULT '{}'::jsonb, -- timbre/gender/provider/take
  charged_cents   INTEGER NOT NULL DEFAULT 0,    -- what the wallet was debited (0 = free 1st)
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | rendering | ready | failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CSSOS_WAVE_587 — 多声线后, 同一 (work_id, lang) 允许多行(不同 voice)。
-- 原本这里是 UNIQUE(work_id, lang); 但启动重跑此迁移时, 多声线数据已有重复 lang →
-- 建唯一索引失败 → 整个 bootstrap 中止 → 降级模式 → resume 循环不启动(多声线渲染卡死)。
-- 降级为【普通索引】(永不因重复失败); 真正的唯一约束改由 081 的 (work_id, lang, voice) 负责。
CREATE INDEX IF NOT EXISTS work_language_tracks_work_lang_idx
  ON work_language_tracks (work_id, lang);

-- Fast "all tracks for this work, in play order".
CREATE INDEX IF NOT EXISTS work_language_tracks_work_order_idx
  ON work_language_tracks (work_id, track_order);

-- Marketplace language filter ("find Japanese MVs") — only ready tracks
-- of public works matter, but the partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS work_language_tracks_lang_idx
  ON work_language_tracks (lang) WHERE status = 'ready';
