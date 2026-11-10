-- W2287 —— 把【我这一轮多立的 current】原样退回去。
--
-- 为什么要退: 我的回填用 `coalesce(v.lang,'')=coalesce(t.lang,'')` 判断
-- 「这条语言有没有 current」, 但 work_media_versions.lang 这一列【不是语言】——
-- 全库 919 行是 'orig'、48 行 'orig-pre-epic'、12 行 'regen-v6'、10 行 'take2'。
-- 老的 current 躺在 lang='orig' 下, 我按 lang='en'/'zh' 去找自然找不到,
-- 于是给 78 个作品各多立了一条 current。实测 Dog walker: 老行 720('orig', 正是
-- 默认轨在播的那条)与我新立的 6123('en')【两条同时 is_current】。
--
-- 为什么只撤 is_current、不删行: 行本身是 Jing 要的修复(语言轨从来没登记过版本行)。
-- 而「哪一版是 current」= 用户在胶囊里看到的默认版 —— 改它是另一件事, 我没被要求做,
-- 也不该顺手做。退回去 = 零行为改变。(版本铁律: 多出来的版本一律不删。)
--
-- 判据写得很窄, 只认【我这一轮创建的、且该作品另有一条更早的 current】的行:
--   · created_at 在最近 45 分钟内(我这一轮)
--   · 同作品另有一条 is_current 且 created_at 更早的音频行
-- 不满足这两条的一律不动 —— 包括贝多芬那种「en 本来真的一条 current 都没有」的情形。

\pset format aligned
\echo '=== 退之前: 我这一轮立的 current 中, 造成重复的有几条 ==='
SELECT count(*) AS 要退的行数, count(DISTINCT work_id) AS 涉及作品
  FROM work_media_versions v
 WHERE v.kind='audio' AND v.is_current
   AND v.created_at > now() - interval '45 minutes'
   AND EXISTS (SELECT 1 FROM work_media_versions o
                WHERE o.work_id=v.work_id AND o.kind='audio' AND o.is_current
                  AND o.id <> v.id AND o.created_at < v.created_at);

BEGIN;

UPDATE work_media_versions v SET is_current = false
 WHERE v.kind='audio' AND v.is_current
   AND v.created_at > now() - interval '45 minutes'
   AND EXISTS (SELECT 1 FROM work_media_versions o
                WHERE o.work_id=v.work_id AND o.kind='audio' AND o.is_current
                  AND o.id <> v.id AND o.created_at < v.created_at);

\echo '=== 回读: 还有多少重复(期望 0 个作品 >1 条 current ... 除了本来就重的) ==='
SELECT n AS current行数, count(*) AS 作品数
  FROM (SELECT work_id, count(*) AS n FROM work_media_versions
         WHERE kind='audio' AND is_current GROUP BY work_id) s
 GROUP BY n ORDER BY n;

\echo '=== 回读: 我这一轮还剩几条 current(应只剩本来一条都没有的, 如贝多芬 en) ==='
SELECT count(*) AS 我这轮仍为current的行
  FROM work_media_versions
 WHERE kind='audio' AND is_current AND created_at > now() - interval '45 minutes';

\echo '=== 回读: Dog walker 两首应当只剩老行 current ==='
SELECT id, coalesce(label,'(无名)') AS label, coalesce(lang,'<NULL>') AS lang, is_current,
       right(url,28) AS url
  FROM work_media_versions
 WHERE (work_id::text LIKE '89be933b%' OR work_id::text LIKE 'a03e39b6%') AND kind='audio'
 ORDER BY work_id, id;

COMMIT;
