-- CSSOS_WAVE_1953 20260825 — 账本按【资金来源】分类, 为提现做准备。
--
-- Jing 问「能不能用平台钱包给员工发工资」→ 不能(FLSA 禁止 company scrip)。但顺着这条
-- 问出了一个真问题: 平台钱包【合法】的用途是给创作者分成后提现, 而提现能不能提、
-- 提多少、要不要 KYC, 取决于这笔钱【是哪来的】:
--
--   deposit  用户自己充值的      可退; 但同卡充值 30 天内提现要延迟(反洗钱, 宪法已有)
--   earning  卖作品/打赏的分成    可提现; 年累计 $600 触发 KYC + 1099-K(宪法已有)
--   bonus    赠送/优惠券信用      ❌ 不可提现(宪法已有: bonus/refund credits stay in wallet)
--   refund   退款回来的           跟原路径走
--   spend    支出                 不参与提现计算
--
-- 现在账本只有 type(credit/debit)一列, 分不出这五类。等真有提现请求再回头分, 就要翻
-- 历史账、逐笔考据 —— 那时候成本高得多, 而且很可能分不准。所以现在加最便宜。
--
-- 列可空: rust-api(rust-api/src/billing.rs 三处)也写这张表, 它还不知道这个字段。
-- 空值按"未分类"处理, 提现时保守地【不计入可提现额度】—— 宁可少算, 不可多给。

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS fund_source text;

COMMENT ON COLUMN ledger_entries.fund_source IS
  'deposit|earning|bonus|refund|spend — 资金来源, 决定提现资格(W1953)。NULL=未分类, 提现时不计入。';

CREATE INDEX IF NOT EXISTS idx_ledger_fund_source
  ON ledger_entries(user_id, fund_source) WHERE fund_source IS NOT NULL;

-- 回填存量 743 条: 全部是 engine=cssmv-local 的平台本地免费步骤, 金额 0 → spend。
-- (先 SELECT 确认过打击面才写这条, 不是盲改。)
UPDATE ledger_entries
   SET fund_source = 'spend'
 WHERE fund_source IS NULL
   AND type = 'debit';

-- user_credits 上存三个分桶余额, 免得每次提现都全表扫账本。
-- 这三个是【衍生值】: 真相仍在 ledger_entries, 这里只是加速。对不上时以账本为准。
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS deposited_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS earned_cents    bigint NOT NULL DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS bonus_cents     bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_credits.earned_cents IS
  '卖作品/打赏累计分成(W1953)。提现资格与 1099-K 门槛看它, 不看总余额。';
