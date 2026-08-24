-- CSSOS_WAVE_1908b 20260824 — 回填存量的 civilization / language
--
-- W1908 的触发器只管【新写入】。存量实测: 223 首能靠标题匹配到人物文明, 1129 首语言为空。
-- 回填只填 NULL/空, 绝不覆盖已有值 —— 与触发器同一条原则(用户干预优先)。
--
-- 顺带修一个字符变体坑(实测发现): 作品标题写「徳川家康」(日文汉字 徳),
-- 人物档案写「德川家康」(中文 德) —— 差一个字, 匹配不上。
-- 归一表只列【实际撞到的】那几个, 不做全量异体字映射(那是另一个工程, 且容易误伤)。

CREATE OR REPLACE FUNCTION cssos_norm_name(t text) RETURNS text AS $$
  SELECT translate(coalesce($1,''),
    '徳沢桜髙﨑',   -- 日文/异体
    '德泽樱高崎');  -- 中文常用
$$ LANGUAGE sql IMMUTABLE;

-- ① civilization 回填(标题匹配人物, 最长名优先)
UPDATE user_works w
   SET civilization = p.civilization
  FROM LATERAL (
        SELECT pp.civilization
          FROM person_profiles pp
         WHERE pp.civilization IS NOT NULL AND btrim(pp.civilization) <> ''
           AND ( (length(coalesce(pp.name_zh,'')) >= 2
                  AND cssos_norm_name(w.title) LIKE '%'||cssos_norm_name(pp.name_zh)||'%')
              OR (length(coalesce(pp.name_en,'')) >= 4
                  AND w.title ILIKE '%'||pp.name_en||'%') )
         ORDER BY length(coalesce(pp.name_zh, pp.name_en)) DESC
         LIMIT 1) p
 WHERE w.status <> 'deleted'
   AND (w.civilization IS NULL OR btrim(w.civilization) = '');

-- ② language 回填(书写系统判据, 假名必须排在汉字之前)
UPDATE user_works
   SET language = CASE
     WHEN probe ~ '[ぁ-んァ-ヶ]'  THEN 'ja'
     WHEN probe ~ '[가-힣]'       THEN 'ko'
     WHEN probe ~ '[А-Яа-яЁё]'   THEN 'ru'
     WHEN probe ~ '[؀-ۿ]'        THEN 'ar'
     WHEN probe ~ '[֐-׿]'        THEN 'he'
     WHEN probe ~ '[ऀ-ॿ]'        THEN 'hi'
     WHEN probe ~ '[ก-๛]'        THEN 'th'
     WHEN probe ~ '[Ͱ-Ͽἀ-ᾯ]'    THEN 'el'
     WHEN probe ~ '[一-龥]'       THEN 'zh'
     WHEN probe ~ '[A-Za-z]'      THEN 'en'
     ELSE NULL
   END
  FROM (SELECT id AS wid,
               left(coalesce(NULLIF(btrim(lyrics_preview),''), title, ''), 400) AS probe
          FROM user_works) src
 WHERE user_works.id = src.wid
   AND user_works.status <> 'deleted'
   AND (user_works.language IS NULL OR btrim(user_works.language) = '');
