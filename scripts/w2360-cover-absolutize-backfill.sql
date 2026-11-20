-- W2360 — 把【确实取得到】的相对路径封面补成绝对 URL。
-- 实测过每一种前缀(逐个 curl):
--   /api/work-assets/            200 ✓   53 行
--   /personalization-templates/  200 ✓   17 行
--   /artifacts/mv-fallback/      200 ✓    5 行
--   /uploads/fallbacks/          404 ✗   95 行 —— 【不动】: 文件早就没了(部署清空),
--                                       加上域名只是把坏的相对路径变成坏的绝对路径,
--                                       还会骗过"是不是 http"那道检查, 到 fetch 才炸。
BEGIN;
CREATE TABLE IF NOT EXISTS w2360_cover_pre_backup AS
  SELECT id, title, cover_image, now() AS backed_up_at
  FROM user_works WHERE cover_image LIKE '/%';

UPDATE user_works
   SET cover_image = 'https://cssstudio.app' || cover_image,
       updated_at  = now()
 WHERE cover_image LIKE '/api/work-assets/%'
    OR cover_image LIKE '/personalization-templates/%'
    OR cover_image LIKE '/artifacts/%';

SELECT regexp_replace(cover_image,'^(/[^/]+/[^/]+/).*','\1') AS 剩下的相对前缀, count(*)
  FROM user_works WHERE cover_image LIKE '/%' GROUP BY 1 ORDER BY 2 DESC;
COMMIT;

-- ── 跑完之后的复核(2026-11-20)────────────────────────────────────────────
-- UPDATE 75; 剩下 95 条仍是 /uploads/fallbacks/ 的相对路径。
-- 【那 95 条全部 status='deleted'】(2026-03-24 ~ 06-20 的已删除作品, 只有 1 个有音频)。
-- 在用作品里【封面是相对路径的已经是 0 个】—— 所以不必给它们重新生成封面:
-- 那是在给用户永远看不到的东西付钱。
-- 这一条值得记: 「95 个封面坏了」听起来像个大窟窿, 量一下 status 才发现窟窿在坟地里。
