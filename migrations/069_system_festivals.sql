-- CSSOS_WAVE_120 20260513 — Jing
-- Festival auto-MV system. Mirrors the anniversary system (Wave 119) but
-- drives off a hardcoded festival catalog rather than person_profiles.
--
-- Festivals span civilizations. For lunar/movable festivals (春节/中秋/
-- 端午/Easter/Diwali/Eid) we precompute Gregorian dates per year and
-- maintain a small lookup table — far simpler than running a lunar
-- calendar library inside Node.
--
-- system_origin = 'system_festival' on resulting works (see migration 067).

CREATE TABLE IF NOT EXISTS system_festivals (
  festival_id        TEXT PRIMARY KEY,           -- 'spring-festival' | 'mid-autumn' | 'christmas' | ...
  name_zh            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  civilization       TEXT NOT NULL,              -- '中华' | 'Western' | 'Indian' | 'Islamic' | 'Global'
  music_style_hint   TEXT,                       -- "民乐 / 唢呐 / 喜庆 / 鼓"
  core_theme         TEXT,                       -- "团圆 · 红火 · 新年"
  influence_score    INTEGER NOT NULL DEFAULT 0, -- ranking knob for marketplace shelf
  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-year Gregorian dates. For solar-fixed festivals we still write one
-- row per year so cron does pure date comparison and never depends on
-- floating logic. Backfill ~5 years at a time via migration / admin tool.
CREATE TABLE IF NOT EXISTS system_festival_dates (
  festival_id   TEXT NOT NULL REFERENCES system_festivals(festival_id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  greg_date     DATE NOT NULL,
  PRIMARY KEY (festival_id, year)
);

CREATE INDEX IF NOT EXISTS sys_festival_dates_date_idx
  ON system_festival_dates (greg_date);

-- Idempotency log — same shape as system_anniversary_log.
CREATE TABLE IF NOT EXISTS system_festival_log (
  id              BIGSERIAL PRIMARY KEY,
  run_date        DATE NOT NULL,
  festival_id     TEXT NOT NULL REFERENCES system_festivals(festival_id) ON DELETE CASCADE,
  work_id         UUID REFERENCES user_works(id) ON DELETE SET NULL,
  status          TEXT NOT NULL,         -- 'ok' | 'failed' | 'skipped'
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  error_detail    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_date, festival_id)
);

CREATE INDEX IF NOT EXISTS sys_festival_log_date_idx   ON system_festival_log (run_date DESC);
CREATE INDEX IF NOT EXISTS sys_festival_log_status_idx ON system_festival_log (status);

-- ───────────────────────── seed festival catalog ─────────────────────────
INSERT INTO system_festivals (festival_id, name_zh, name_en, civilization, music_style_hint, core_theme, influence_score) VALUES
  ('spring-festival', '春节',     'Chinese New Year',     '中华',    '民乐 / 唢呐 / 喜庆 / 鼓',      '团圆 · 红火 · 新年',         100),
  ('lantern',         '元宵节',   'Lantern Festival',     '中华',    '民乐 / 笛 / 古筝 / 灯影',     '花灯 · 团圆 · 月色',         70),
  ('qingming',        '清明',     'Qingming Festival',    '中华',    '古风 / 箫 / 雨声 / 缅怀',      '追思 · 春雨 · 远山',         75),
  ('dragon-boat',     '端午节',   'Dragon Boat Festival', '中华',    '民乐 / 鼓 / 江水 / 屈原',      '龙舟 · 粽香 · 屈子',         80),
  ('mid-autumn',      '中秋节',   'Mid-Autumn Festival',  '中华',    '古筝 / 月 / 团圆 / 月光',      '月圆 · 思乡 · 团圆',         90),
  ('chongyang',       '重阳节',   'Double Ninth',         '中华',    '古风 / 笛 / 登高 / 菊',         '登高 · 敬老 · 菊酒',         55),
  ('new-year-day',    '元旦',     'New Year''s Day',      'Global',  '管弦 / 钟声 / 跨年',           '辞旧迎新 · 钟声 · 希望',     85),
  ('valentine',       '情人节',   'Valentine''s Day',     'Western', '弦乐 / 钢琴 / 浪漫 / 玫瑰',    '玫瑰 · 心动 · 红色',         70),
  ('easter',          '复活节',   'Easter',               'Western', '管风琴 / 圣咏 / 春 / 复活',    '复活 · 春 · 希望',           65),
  ('halloween',       '万圣节',   'Halloween',            'Western', '怪诞 / 风琴 / 钟声 / 南瓜',    '南瓜 · 幽魂 · 糖果',         60),
  ('thanksgiving',    '感恩节',   'Thanksgiving',         'Western', '乡村 / 钢琴 / 暖 / 感恩',      '感恩 · 家人 · 餐桌',         65),
  ('christmas',       '圣诞节',   'Christmas',            'Western', '颂歌 / 铃铛 / 圣诞 / 暖',      '雪 · 礼物 · 平安',           95),
  ('diwali',          '排灯节',   'Diwali',               'Indian',  '印度古典 / 锡塔尔 / 灯 / 拍',  '光明 · 灯火 · 战胜黑暗',     75),
  ('eid-fitr',        '开斋节',   'Eid al-Fitr',          'Islamic', '中东古调 / 鼓 / 月 / 团聚',    '月 · 斋月结束 · 团聚',       75),
  ('us-independence', '美国独立日','US Independence Day',  'Western', '管乐 / 鼓 / 烟火 / 进行曲',    '自由 · 烟花 · 红蓝白',       55),
  ('international-women', '国际妇女节','International Women''s Day','Global','钢琴 / 弦乐 / 致敬 / 力量','致敬 · 平等 · 力量',     50)
ON CONFLICT (festival_id) DO NOTHING;

-- ───────────────────── seed Gregorian dates 2026 → 2030 ─────────────────
-- Solar-fixed festivals: easy. Lunar/movable festivals: precomputed.
-- (Sources: HK Observatory + Time and Date — verified for 2026..2030.)
INSERT INTO system_festival_dates (festival_id, year, greg_date) VALUES
  -- Solar fixed
  ('new-year-day',    2026, '2026-01-01'),('new-year-day',    2027, '2027-01-01'),
  ('new-year-day',    2028, '2028-01-01'),('new-year-day',    2029, '2029-01-01'),
  ('new-year-day',    2030, '2030-01-01'),
  ('valentine',       2026, '2026-02-14'),('valentine',       2027, '2027-02-14'),
  ('valentine',       2028, '2028-02-14'),('valentine',       2029, '2029-02-14'),
  ('valentine',       2030, '2030-02-14'),
  ('international-women', 2026, '2026-03-08'),('international-women', 2027, '2027-03-08'),
  ('international-women', 2028, '2028-03-08'),('international-women', 2029, '2029-03-08'),
  ('international-women', 2030, '2030-03-08'),
  ('us-independence', 2026, '2026-07-04'),('us-independence', 2027, '2027-07-04'),
  ('us-independence', 2028, '2028-07-04'),('us-independence', 2029, '2029-07-04'),
  ('us-independence', 2030, '2030-07-04'),
  ('halloween',       2026, '2026-10-31'),('halloween',       2027, '2027-10-31'),
  ('halloween',       2028, '2028-10-31'),('halloween',       2029, '2029-10-31'),
  ('halloween',       2030, '2030-10-31'),
  ('christmas',       2026, '2026-12-25'),('christmas',       2027, '2027-12-25'),
  ('christmas',       2028, '2028-12-25'),('christmas',       2029, '2029-12-25'),
  ('christmas',       2030, '2030-12-25'),
  -- Qingming: solar term, always Apr 4–6
  ('qingming',        2026, '2026-04-05'),('qingming',        2027, '2027-04-05'),
  ('qingming',        2028, '2028-04-04'),('qingming',        2029, '2029-04-04'),
  ('qingming',        2030, '2030-04-05'),
  -- US Thanksgiving: 4th Thursday of Nov
  ('thanksgiving',    2026, '2026-11-26'),('thanksgiving',    2027, '2027-11-25'),
  ('thanksgiving',    2028, '2028-11-23'),('thanksgiving',    2029, '2029-11-22'),
  ('thanksgiving',    2030, '2030-11-28'),
  -- Easter (Western): movable
  ('easter',          2026, '2026-04-05'),('easter',          2027, '2027-03-28'),
  ('easter',          2028, '2028-04-16'),('easter',          2029, '2029-04-01'),
  ('easter',          2030, '2030-04-21'),
  -- 春节 (lunar 1/1)
  ('spring-festival', 2026, '2026-02-17'),('spring-festival', 2027, '2027-02-06'),
  ('spring-festival', 2028, '2028-01-26'),('spring-festival', 2029, '2029-02-13'),
  ('spring-festival', 2030, '2030-02-03'),
  -- 元宵 (lunar 1/15)
  ('lantern',         2026, '2026-03-03'),('lantern',         2027, '2027-02-20'),
  ('lantern',         2028, '2028-02-09'),('lantern',         2029, '2029-02-27'),
  ('lantern',         2030, '2030-02-17'),
  -- 端午 (lunar 5/5)
  ('dragon-boat',     2026, '2026-06-19'),('dragon-boat',     2027, '2027-06-09'),
  ('dragon-boat',     2028, '2028-05-28'),('dragon-boat',     2029, '2029-06-16'),
  ('dragon-boat',     2030, '2030-06-05'),
  -- 中秋 (lunar 8/15)
  ('mid-autumn',      2026, '2026-09-25'),('mid-autumn',      2027, '2027-09-15'),
  ('mid-autumn',      2028, '2028-10-03'),('mid-autumn',      2029, '2029-09-22'),
  ('mid-autumn',      2030, '2030-09-12'),
  -- 重阳 (lunar 9/9)
  ('chongyang',       2026, '2026-10-19'),('chongyang',       2027, '2027-10-08'),
  ('chongyang',       2028, '2028-10-26'),('chongyang',       2029, '2029-10-16'),
  ('chongyang',       2030, '2030-10-05'),
  -- Diwali (Hindu lunar)
  ('diwali',          2026, '2026-11-08'),('diwali',          2027, '2027-10-29'),
  ('diwali',          2028, '2028-11-17'),('diwali',          2029, '2029-11-05'),
  ('diwali',          2030, '2030-10-26'),
  -- Eid al-Fitr (Islamic lunar — start of Shawwal, may shift ±1 by sighting)
  ('eid-fitr',        2026, '2026-03-21'),('eid-fitr',        2027, '2027-03-10'),
  ('eid-fitr',        2028, '2028-02-27'),('eid-fitr',        2029, '2029-02-15'),
  ('eid-fitr',        2030, '2030-02-04')
ON CONFLICT (festival_id, year) DO NOTHING;
