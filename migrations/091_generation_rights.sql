-- CSSOS_WAVE_1455 — 生成权(access right, 按"次"计, 与生成费用 COGS 完全分开)。
-- Jing 铁律: 生成权 ⊥ 生成费用。生成权=订阅/买生成权包/系统发放给的【次数】; 生成费用=第三方引擎费,
-- 永远用户自付(钱包)。要生成必须【有生成权 且 付得起 COGS】, 缺一不可。
-- gen_rights = 额外生成权余额(买的包 + 系统发放, 持久不按月清; 月度额度走 generation_meter 单独算)。
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS gen_rights int NOT NULL DEFAULT 0;
