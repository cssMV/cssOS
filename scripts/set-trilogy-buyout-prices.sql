-- CSSOS_WAVE_2032 — 买断价改用【系统建议价】(estimateWorkCost.recommendedPriceCents)。
-- Jing 2026-08-29:「买断价格必须使用系统建议价, 不能统一 5.99。」
-- 公式照抄真源 src/index.ts:12224 —— rec = max(档位价, 总成本 × 1.5), triptych 档位 $14.99。
-- 成本按系统 economy 档 3 分/秒: 用系统自己的常量, 不自己发明数字。
-- ⚠️ 李清照那个 id 我第一版又是【凭印象编的】(把封面文件名片段 8f1f358c 当成了 work_id),
-- 与昨天芭蕉那次同一个错。UPDATE 会安静地影响 0 行。真 id 从库里查出来是 96727102。
-- (不用 cinematic 档 24 分/秒 —— 那会算出 $380~410, 比实测成本高 20 倍, 是常量过期的产物。)
UPDATE user_works SET suggested_buyout_price_cents=5062, updated_at=now()
 WHERE id='96727102-ef36-49b7-a127-c7576be8a05d'::uuid OR root_work_id='96727102-ef36-49b7-a127-c7576be8a05d'::uuid;
UPDATE user_works SET suggested_buyout_price_cents=4954, updated_at=now()
 WHERE id='a7c1e5d2-9b3f-4e18-8a06-2f4d7c1b9e30'::uuid OR root_work_id='a7c1e5d2-9b3f-4e18-8a06-2f4d7c1b9e30'::uuid;
UPDATE user_works SET suggested_buyout_price_cents=5522, updated_at=now()
 WHERE id='e5a1c7b3-4d92-4f60-8e17-3a5b6c7d8e91'::uuid OR root_work_id='e5a1c7b3-4d92-4f60-8e17-3a5b6c7d8e91'::uuid;
UPDATE user_works SET suggested_buyout_price_cents=5008, updated_at=now()
 WHERE id='c9e2f4a8-1b73-4d56-8f09-7e2a3b4c5d68'::uuid OR root_work_id='c9e2f4a8-1b73-4d56-8f09-7e2a3b4c5d68'::uuid;
UPDATE user_works SET suggested_buyout_price_cents=4347, updated_at=now()
 WHERE id='a1b2c3d4-5e6f-4a70-8b91-2c3d4e5f6a71'::uuid OR root_work_id='a1b2c3d4-5e6f-4a70-8b91-2c3d4e5f6a71'::uuid;
UPDATE user_works SET suggested_buyout_price_cents=5306, updated_at=now()
 WHERE id='e5f60718-9203-4eb4-8f35-6a7b8c9dab50'::uuid OR root_work_id='e5f60718-9203-4eb4-8f35-6a7b8c9dab50'::uuid;
