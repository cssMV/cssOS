-- CSSOS_WAVE_130 20260513 — Jing
-- Extend system_festival_dates back to 2020 so the archive overlay (W128)
-- has 6 years of depth, not just 1. Solar-fixed festivals are obvious;
-- lunar/movable festivals (春节/元宵/端午/中秋/重阳/Easter/Diwali/Eid)
-- use precomputed Gregorian dates from Time-and-Date + HK Observatory.

INSERT INTO system_festival_dates (festival_id, year, greg_date) VALUES
  -- Solar fixed (Jan 1 / Feb 14 / Mar 8 / Jul 4 / Oct 31 / Dec 25) ---
  ('new-year-day',    2020, '2020-01-01'),('new-year-day',    2021, '2021-01-01'),
  ('new-year-day',    2022, '2022-01-01'),('new-year-day',    2023, '2023-01-01'),
  ('new-year-day',    2024, '2024-01-01'),('new-year-day',    2025, '2025-01-01'),
  ('valentine',       2020, '2020-02-14'),('valentine',       2021, '2021-02-14'),
  ('valentine',       2022, '2022-02-14'),('valentine',       2023, '2023-02-14'),
  ('valentine',       2024, '2024-02-14'),('valentine',       2025, '2025-02-14'),
  ('international-women', 2020, '2020-03-08'),('international-women', 2021, '2021-03-08'),
  ('international-women', 2022, '2022-03-08'),('international-women', 2023, '2023-03-08'),
  ('international-women', 2024, '2024-03-08'),('international-women', 2025, '2025-03-08'),
  ('us-independence', 2020, '2020-07-04'),('us-independence', 2021, '2021-07-04'),
  ('us-independence', 2022, '2022-07-04'),('us-independence', 2023, '2023-07-04'),
  ('us-independence', 2024, '2024-07-04'),('us-independence', 2025, '2025-07-04'),
  ('halloween',       2020, '2020-10-31'),('halloween',       2021, '2021-10-31'),
  ('halloween',       2022, '2022-10-31'),('halloween',       2023, '2023-10-31'),
  ('halloween',       2024, '2024-10-31'),('halloween',       2025, '2025-10-31'),
  ('christmas',       2020, '2020-12-25'),('christmas',       2021, '2021-12-25'),
  ('christmas',       2022, '2022-12-25'),('christmas',       2023, '2023-12-25'),
  ('christmas',       2024, '2024-12-25'),('christmas',       2025, '2025-12-25'),
  -- Qingming (solar term, always Apr 4–6) ----------------------------
  ('qingming',        2020, '2020-04-04'),('qingming',        2021, '2021-04-04'),
  ('qingming',        2022, '2022-04-05'),('qingming',        2023, '2023-04-05'),
  ('qingming',        2024, '2024-04-04'),('qingming',        2025, '2025-04-04'),
  -- US Thanksgiving: 4th Thursday of Nov ----------------------------
  ('thanksgiving',    2020, '2020-11-26'),('thanksgiving',    2021, '2021-11-25'),
  ('thanksgiving',    2022, '2022-11-24'),('thanksgiving',    2023, '2023-11-23'),
  ('thanksgiving',    2024, '2024-11-28'),('thanksgiving',    2025, '2025-11-27'),
  -- Easter (Western, movable) ---------------------------------------
  ('easter',          2020, '2020-04-12'),('easter',          2021, '2021-04-04'),
  ('easter',          2022, '2022-04-17'),('easter',          2023, '2023-04-09'),
  ('easter',          2024, '2024-03-31'),('easter',          2025, '2025-04-20'),
  -- 春节 (lunar 1/1) -------------------------------------------------
  ('spring-festival', 2020, '2020-01-25'),('spring-festival', 2021, '2021-02-12'),
  ('spring-festival', 2022, '2022-02-01'),('spring-festival', 2023, '2023-01-22'),
  ('spring-festival', 2024, '2024-02-10'),('spring-festival', 2025, '2025-01-29'),
  -- 元宵 (lunar 1/15) ------------------------------------------------
  ('lantern',         2020, '2020-02-08'),('lantern',         2021, '2021-02-26'),
  ('lantern',         2022, '2022-02-15'),('lantern',         2023, '2023-02-05'),
  ('lantern',         2024, '2024-02-24'),('lantern',         2025, '2025-02-12'),
  -- 端午 (lunar 5/5) -------------------------------------------------
  ('dragon-boat',     2020, '2020-06-25'),('dragon-boat',     2021, '2021-06-14'),
  ('dragon-boat',     2022, '2022-06-03'),('dragon-boat',     2023, '2023-06-22'),
  ('dragon-boat',     2024, '2024-06-10'),('dragon-boat',     2025, '2025-05-31'),
  -- 中秋 (lunar 8/15) ------------------------------------------------
  ('mid-autumn',      2020, '2020-10-01'),('mid-autumn',      2021, '2021-09-21'),
  ('mid-autumn',      2022, '2022-09-10'),('mid-autumn',      2023, '2023-09-29'),
  ('mid-autumn',      2024, '2024-09-17'),('mid-autumn',      2025, '2025-10-06'),
  -- 重阳 (lunar 9/9) -------------------------------------------------
  ('chongyang',       2020, '2020-10-25'),('chongyang',       2021, '2021-10-14'),
  ('chongyang',       2022, '2022-10-04'),('chongyang',       2023, '2023-10-23'),
  ('chongyang',       2024, '2024-10-11'),('chongyang',       2025, '2025-10-29'),
  -- Diwali (Hindu lunar) --------------------------------------------
  ('diwali',          2020, '2020-11-14'),('diwali',          2021, '2021-11-04'),
  ('diwali',          2022, '2022-10-24'),('diwali',          2023, '2023-11-12'),
  ('diwali',          2024, '2024-11-01'),('diwali',          2025, '2025-10-20'),
  -- Eid al-Fitr (Islamic lunar) -------------------------------------
  ('eid-fitr',        2020, '2020-05-24'),('eid-fitr',        2021, '2021-05-13'),
  ('eid-fitr',        2022, '2022-05-02'),('eid-fitr',        2023, '2023-04-21'),
  ('eid-fitr',        2024, '2024-04-10'),('eid-fitr',        2025, '2025-03-30')
ON CONFLICT (festival_id, year) DO NOTHING;
