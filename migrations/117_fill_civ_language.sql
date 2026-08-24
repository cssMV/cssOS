-- CSSOS_WAVE_1908 20260824 — 生成时真正填上 civilization / language(Jing 指示)
--
-- 病因: user_works 有 18 个 INSERT 落点, 其中【11 个完全不填】这两个字段。
--   于是 civilization 和 language 常年为空 → 文明智能联动退化成"看标题猜",
--   W1904 的文明×曲风不变量也只能靠标题里有没有汉字来判, 判据很粗。
--   逐个落点去补, 必然漏掉下个月新增的第 19 个 —— 今天已经在【严禁烧录】和
--   【四轨同步切歌】上各栽过一次: 文档写了规矩, 代码没有拦, 新路径照样绕过去。
--   所以放在触发器里: 这是所有写入都必须经过的唯一一处。
--
-- 原则(与 W1880「宁可少标, 绝不错标」一致): 推不出来就【留空】, 绝不瞎填。
--   已经填了值的行一律不动 —— 触发器只补 NULL, 不覆盖任何人的显式选择
--   (「导演自动流默认律」: 不选不填→系统推荐; 用户干预→系统让位)。

CREATE OR REPLACE FUNCTION cssos_fill_civ_language() RETURNS trigger AS $$
DECLARE
  probe text;
  hit   record;
BEGIN
  -- 判据取【歌词优先, 标题兜底】: 歌词是整段真实文本, 比标题可靠得多。
  probe := left(coalesce(NULLIF(btrim(NEW.lyrics_preview),''), NEW.title, ''), 400);

  ---------------------------------------------------------------- civilization
  -- 唯一可信来源 = 人物档案。标题里出现某位人物的名字 → 用他的文明。
  -- 不做任何"中文标题就算中华文明"这类猜测: 《时间的帝国》是中文标题的科幻题材,
  -- 猜了就错(全平台有 654 首这种, 一刀切会误伤 600+)。
  IF NEW.civilization IS NULL OR btrim(NEW.civilization) = '' THEN
    SELECT p.civilization INTO hit
      FROM person_profiles p
     WHERE p.civilization IS NOT NULL AND btrim(p.civilization) <> ''
       AND (
         (length(coalesce(p.name_zh,'')) >= 2 AND NEW.title LIKE '%'||p.name_zh||'%')
         OR (length(coalesce(p.name_en,'')) >= 4 AND NEW.title ILIKE '%'||p.name_en||'%')
       )
     ORDER BY length(coalesce(p.name_zh, p.name_en)) DESC   -- 最长匹配优先, 免得"李"命中一堆
     LIMIT 1;
    IF FOUND THEN NEW.civilization := hit.civilization; END IF;
  END IF;

  ---------------------------------------------------------------- language
  -- 按【书写系统】判, 不按内容猜。假名要排在汉字之前 —— 日文里也有汉字,
  -- 先判汉字就会把日文误判成中文(这正是"音乐日语、字幕中文"那一类混乱的温床)。
  IF NEW.language IS NULL OR btrim(NEW.language) = '' THEN
    NEW.language := CASE
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
      ELSE NULL                    -- 推不出来 → 留空, 不瞎填
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cssos_fill_civ_lang ON user_works;
CREATE TRIGGER trg_cssos_fill_civ_lang
  BEFORE INSERT ON user_works
  FOR EACH ROW EXECUTE FUNCTION cssos_fill_civ_language();
