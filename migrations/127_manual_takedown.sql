-- CSSOS_WAVE_2255 20261029 — 「人工下架」必须扛得住自愈。
--
-- 事故: 2026-09-28 按 Jing 要求把 74cdb324 下架(visibility='private'), 回读确认、
-- 市场接口也查不到了。但十二天后机器重启, 它又回到市场上 —— 因为
-- src/index.ts 的 foryou-reconcile 自愈循环(W545, 开机一次 + 每 10 分钟)会把所有
-- ready/published 的 private 档案【无条件】翻成 public。
--
-- 那条自愈本身没错: 它治的是「Rust 管线写完资产后把档案设成 private, 导致作品
-- 进不了为你创作」。错在它分不清两种 private ——
--   · 管线忘了翻的   → 该翻
--   · 人主动下架的   → 不该碰
-- 于是平台上「下架」这个能力实际并不存在: 任何下架活不过 10 分钟。
--
-- 修法: 给人工下架一个【自己的标记】, 而不是去改 visibility 的取值。
-- 为什么不新增 visibility='private_manual': 市场主查询的判据是
-- `COALESCE(mp.visibility,'public') <> 'private'` —— 是「只要不是 private 就放行」,
-- 新造一个值反而会【漏网上架】。加一列最小、最不容易出错。
ALTER TABLE work_market_profiles
  ADD COLUMN IF NOT EXISTS manual_takedown_at TIMESTAMPTZ;

COMMENT ON COLUMN work_market_profiles.manual_takedown_at IS
  '人工下架时间。非空 = 人主动下的架, foryou-reconcile 自愈必须跳过它。清空即恢复上架资格。';

-- 查得快(自愈每 10 分钟扫一次)
CREATE INDEX IF NOT EXISTS idx_wmp_manual_takedown
  ON work_market_profiles(manual_takedown_at) WHERE manual_takedown_at IS NOT NULL;
