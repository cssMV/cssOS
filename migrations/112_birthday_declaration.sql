-- CSSOS_WAVE_1791 20260728 — Jing — 生日申报(一处填写, 两处生效)。
--
-- 背景: 仓库里本来就有两套日期, 但从没接通, 而且写入侧是死的:
--   · user_preferences.birthday (DATE)  → 生日 MV 守护进程每 6 小时扫一次
--   · users.birth_year          (INT)   → 内容分级 + W1790 <13 社交门
-- upsertUserPreferences() 这个写入助手全仓库【零调用方】—— 也就是说
-- 生日 MV 自上线起扫的一直是空集, 一次都没触发过。W1791 补上写入侧,
-- 并让一次输入同时喂给这两个字段。
--
-- 锁定策略(Jing 拍板): 年份锁死(防改年龄绕过分级), 月日允许改一次(防手滑)。
-- 这里只加"月日改过几次"的计数器; 年份的锁沿用 users.birth_year 既有的写一次即锁。
--
-- 注意: migrate.ts 每次启动会把 migrations/ 下所有 .sql 重跑一遍, 所以本文件
-- 必须幂等 —— 全部使用 IF NOT EXISTS。

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS birthday_md_edits SMALLINT NOT NULL DEFAULT 0;

-- 申报动作发生的时间。用于:①审计 ②将来若要按"申报时间"而非"注册时间"
-- 计算宽限期时有据可查。可为空 = 还没申报过。
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS birthday_declared_at TIMESTAMPTZ;

COMMENT ON COLUMN user_preferences.birthday_md_edits IS
  'W1791: 月日被修改过的次数。年份不可改; 月日最多改 1 次。';
COMMENT ON COLUMN user_preferences.birthday_declared_at IS
  'W1791: 用户首次申报生日的时间。NULL = 从未申报。';
