-- W2170 · 《鶴の恩返し/白鹤报恩》(508e4d1a) 定价 + 置顶 + 默认播放
--
-- Jing: 聆听 66 / 观赏 99 / 买断【无价之宝】, 并置顶、默认播放。
--
-- 三个价各自落在哪(查过真源, 不是猜的):
--   · 聆听 = work_market_profiles.current_listen_price_cents  → 66
--   · 观赏 = 【平台常量 $0.99】, user_works / work_market_profiles 里【没有这一列】
--            (src/index.ts:19230「观赏价 $0.99 保留给以后的真视频, 前端 view 档置灰占位」)
--            所以 ¢99 本来就是它显示的值, 不需要写库, 也无处可写。
--   · 无价之宝 = buyout_enabled=false + 买断价 0 —— 这是平台既有写法, 不是我发明的:
--            《李清照·声声慢三部曲》《مولانا رومی·鲁米三部曲》两个置顶作品都是 0/false。
--            (另有 rights_scope='system_priceless', 但那是【系统模板作品免费】那一套,
--             与这里「聆听收费、买断不卖」不是一回事, 故不用。)
--
-- 置顶 = admin_pinned_at。feed 的排序是「置顶优先, 再按 admin_pinned_at DESC」
-- (src/index.ts:52461-52462), 所以刚置顶的排第一 —— 这就是 Jing 说的「默认播放」。
-- 当前全网置顶 10 个, 上限 12, 不挤掉任何人。
--
-- 原值进 w2170_crane_backup, 回滚一条 UPDATE。

BEGIN;

CREATE TABLE IF NOT EXISTS w2170_crane_backup (
  work_id        uuid PRIMARY KEY,
  old_listen     bigint,
  old_buyout     bigint,
  old_pinned_at  timestamptz,
  old_mp_listen  bigint,
  old_mp_buyout  bigint,
  old_mp_enabled boolean,
  old_mp_vis     text,
  backed_up      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO w2170_crane_backup (work_id, old_listen, old_buyout, old_pinned_at,
                                old_mp_listen, old_mp_buyout, old_mp_enabled, old_mp_vis)
SELECT w.id, w.suggested_listen_price_cents, w.suggested_buyout_price_cents, w.admin_pinned_at,
       p.current_listen_price_cents, p.current_buyout_price_cents, p.buyout_enabled, p.visibility
  FROM user_works w LEFT JOIN work_market_profiles p ON p.work_id = w.id
 WHERE left(w.id::text,8) = '508e4d1a'
ON CONFLICT (work_id) DO NOTHING;

UPDATE user_works
   SET suggested_listen_price_cents = 66,
       suggested_buyout_price_cents = 0,     -- 0 = 不卖(配合 buyout_enabled=false)
       admin_pinned_at = now(),
       updated_at = now()
 WHERE left(id::text,8) = '508e4d1a';

INSERT INTO work_market_profiles (work_id, owner_user_id, current_listen_price_cents,
                                  current_buyout_price_cents, buyout_enabled, tips_enabled,
                                  visibility, rights_scope)
SELECT w.id, w.user_id, 66, 0, false, true, 'public', 'personal_use'
  FROM user_works w WHERE left(w.id::text,8) = '508e4d1a'
ON CONFLICT (work_id) DO UPDATE SET
  current_listen_price_cents = 66,
  current_buyout_price_cents = 0,
  buyout_enabled = false,
  visibility = 'public',
  updated_at = now();

-- 默认干跑(无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
--   ⚠ 文件必须以换行结尾, 否则 COMMIT 被接到注释后整条失效(W2152 踩过)。
-- 回滚: UPDATE user_works w SET suggested_listen_price_cents=b.old_listen,
--         suggested_buyout_price_cents=b.old_buyout, admin_pinned_at=b.old_pinned_at
--         FROM w2170_crane_backup b WHERE w.id=b.work_id;
