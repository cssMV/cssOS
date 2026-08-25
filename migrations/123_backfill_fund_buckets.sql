-- CSSOS_WAVE_1953b 20260825 — 回填存量余额的资金来源分桶。
--
-- 存量实况(先 SELECT 查清才写, 不是盲改):
--   30 个钱包共 $3125
--     · $3000 = reviewer@ / jingdudc@ / admin@ 三个内部账号各 $1000
--       —— credit_events 里【没有】对应记录, 说明是当初直接改库授予的。既然来路不是
--          用户充值、也不是创作分成, 按最保守原则归入 bonus(不可提现)。
--          这三个都是官方账号, 本就 credit-exempt, 归错也不影响任何人。
--     · $125 = 25 位用户各 $5 的 welcome_bonus —— 宪法明写"赠送 5 美元不可提现",
--       归入 bonus, 与规则一致。
--
-- 原则: 分不清来路的一律 bonus(不可提现)。宁可少算, 不可多给 ——
-- 提现是把钱真的转出去, 多给一分就是亏损, 而少算只是让用户来问一句。

-- ① welcome_bonus 有据可查的, 按 credit_events 精确回填
UPDATE user_credits c
   SET bonus_cents = COALESCE(e.total, 0)
  FROM (SELECT user_id, SUM(delta)::bigint AS total
          FROM credit_events WHERE delta > 0 AND reason = 'welcome_bonus'
         GROUP BY user_id) e
 WHERE c.user_id = e.user_id;

-- ② 余下"有余额但三个桶加起来对不上"的部分 → 也归 bonus(来路不明, 保守)
UPDATE user_credits
   SET bonus_cents = bonus_cents +
       GREATEST(0, balance - (deposited_cents + earned_cents + bonus_cents))
 WHERE balance > (deposited_cents + earned_cents + bonus_cents);
