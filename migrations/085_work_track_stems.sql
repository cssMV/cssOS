-- CSSOS_WAVE_672 #① 人声分离(卡拉 OK + 情绪精修地基)。
-- 每条语言/声线轨除全混 audio_url 外, 再存 Demucs 分离出的两路 stem:
--   instrumental_url = 伴奏(去人声)→ 前端「Vocals/Instrumental」胶囊切到伴奏 = 卡拉 OK。
--   vocal_url        = 纯人声 → 喂 librosa(音量/音高/情绪)+ 未来 SER, 不被鼓点伴奏污染。
-- stems_status: pending / ready / failed —— 回填与生成管线据此判断。
ALTER TABLE work_language_tracks
  ADD COLUMN IF NOT EXISTS instrumental_url TEXT,
  ADD COLUMN IF NOT EXISTS vocal_url        TEXT,
  ADD COLUMN IF NOT EXISTS stems_status     TEXT;
