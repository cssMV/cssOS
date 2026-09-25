-- W2175 · 《鶴の恩返し/白鹤报恩》每个 ♪ 配自己的封面
--
-- Jing:「切到 ♪3 就换成第 3 张画面」。
-- 素材是现成的: 这首名下正好 6 张白鹤定妆照(W2167 从《李清照》迁回来的), 对 6 个版本。
--
-- 存法用 work_media_versions 里【已经存在】的 kind='cover'(全库 2088 行),
-- 按 (lang, version_no) 与 kind='audio' 的版本对齐 —— 不新增列、不另造表。
-- 唯一键是 (work_id, kind, lang, version_no), 所以同一版重跑不会长出第二行。

BEGIN;

INSERT INTO work_media_versions (work_id, kind, lang, version_no, label, url, is_current)
SELECT a.work_id, 'cover', 'ja', a.n,
       '♪' || a.n || ' 的画面',
       a.url,
       (a.n = 1)                      -- 第 1 版是当前封面
  FROM (SELECT work_id, url, row_number() OVER (ORDER BY created_at) AS n
          FROM work_assets
         WHERE left(work_id::text,8) = '508e4d1a' AND asset_type = 'slideshow_frame') a
 WHERE a.n <= 6
ON CONFLICT (work_id, kind, COALESCE(lang,''), version_no) DO NOTHING;

-- 默认干跑(无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
--   ⚠ 文件必须以换行结尾(W2152 踩过)。
-- 回滚: DELETE FROM work_media_versions
--         WHERE left(work_id::text,8)='508e4d1a' AND kind='cover';
