\set ON_ERROR_STOP on
BEGIN;
-- W2073 定价: 买断用系统建议价 estimateWorkCost.recommendedPriceCents = 1499(Jing 指示,
-- 不用统一 5.99); 聆听 ¢69(新作品常驻规矩)。四个节点(根+三部)一致。
UPDATE work_market_profiles m
   SET current_buyout_price_cents = 1499,
       current_listen_price_cents = 69,
       buyout_enabled = true,
       visibility = 'public',
       updated_at = now()
  FROM user_works w
 WHERE m.work_id = w.id AND w.title LIKE 'Popol Wuj%';
-- 没有 profile 的补建
INSERT INTO work_market_profiles (work_id, owner_user_id, current_listen_price_cents,
                                  current_buyout_price_cents, buyout_enabled, tips_enabled, visibility)
SELECT w.id, w.user_id, 69, 1499, true, true, 'public'
  FROM user_works w
 WHERE w.title LIKE 'Popol Wuj%'
   AND NOT EXISTS (SELECT 1 FROM work_market_profiles m WHERE m.work_id = w.id);
COMMIT;
SELECT left(w.title,34) AS 标题, m.current_buyout_price_cents AS 买断分,
       m.current_listen_price_cents AS 聆听分, m.visibility AS 可见性
FROM user_works w JOIN work_market_profiles m ON m.work_id=w.id
WHERE w.title LIKE 'Popol Wuj%' ORDER BY w.sequence_index;
