-- CSSOS_WAVE_1777 20260726 — Jing「之前给用户赠送 5 美元现金(不可提现), 用于支付生成费用」。
--
-- 审计发现(2026-07-26): 这个赠送【从未上线】。新用户注册流程(ensureOAuthUser)建完 users 行
-- 和 oauth_identities 就结束了, 没有任何发放调用; 数据库里 17 个真实用户全是 balance=0 /
-- gen_rights=0; credit_events 4000+ 条流水零条 welcome 类。
--
-- 后果是转化漏斗最后一步是断的: 登录 → 输一句话 → 想生成 → 402 insufficient_balance
-- (音乐阶段要 $0.80、视频阶段要 $1.50) → 提示"先去充值"。一个刚从广告点进来、还没做出
-- 任何东西的人不会先掏钱 —— 这正是 162 次广告点击换来 0 注册的机制。
--
-- $5 这个数额的依据: 完整跑一支 MV = 歌词 5 + 封面 8 + 音乐 80 + 视频 150 = 243 分。
-- 500 分让新用户能【免费做出两支完整作品】, 先体验到"我真做出来了", 再谈付费。
--
-- 幂等: creditUserBalance() 本身没有防重(重复调用会重复发钱)。这里用【部分唯一索引】
-- 在数据库层兜死 —— 一个 user_id 最多只能有一条 welcome_bonus 流水, 第二次插入直接冲突。
-- 这比在应用层判断可靠: 并发的两次注册回调也只有一条能成功。
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_welcome_bonus_uidx
  ON credit_events (user_id)
  WHERE reason = 'welcome_bonus';
