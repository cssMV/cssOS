-- CSSOS_WAVE_1904 20260824 — 文明 × 曲风 不变量(Jing:「请现在立那道文明×曲风不变量」)
--
-- 病因(2026-08-23 实测): 《李白·饮者三部曲·天地留名》被写成 style='retro city pop'
--   → Suno 照着唱出日文都市流行 → 封面按 city pop 母题出了西方男人开车的特写。
--   音频、封面、提示词【三者互相一致】, 错的是最上游那个 style。一个唐朝诗人被下单成了 80 年代东京。
--
-- 为什么必须做成数据库触发器, 而不是在代码里加判断:
--   user_works 有 8+ 个 INSERT 落点(创作/纪念日/节日/多部/导入/重生成…),
--   逐个加守卫必然漏 —— 今天已经在【严禁烧录】和【四轨同步切歌】上各栽过一次:
--   文档写了铁律, 代码没有拦, 于是新路径照样绕过去。
--   触发器是唯一一处所有写入都必须经过的地方。这是 W1881 在 spawnFfmpeg 上做的同一件事,
--   换到数据层。
--
-- 判据【故意收得很窄】—— 只拦"点名了另一个具体音乐传统"的情况:
--   全平台有 654 首标题含中文但曲风无中国元素, 其中绝大多数是《时间的帝国》这类科幻题材,
--   'cinematic epic' 对它们是正确的。一刀切会误伤 600+ 首。
--   所以只在【明确点名外国流派】时才拦: city pop / J-pop / K-pop / bossa nova / reggaeton …
--   宁可漏, 绝不误伤 —— 与 W1880「宁可少标, 绝不错标」同一条原则。

CREATE OR REPLACE FUNCTION cssos_assert_civ_style_coherent() RETURNS trigger AS $$
DECLARE
  looks_chinese boolean;
  foreign_genre text;
BEGIN
  IF NEW.style IS NULL OR btrim(NEW.style) = '' THEN RETURN NEW; END IF;

  -- 这首作品是不是中华语境: 标题含汉字, 或 civilization 明确写着中华。
  looks_chinese := (coalesce(NEW.title,'') ~ '[一-龥]')
                   OR (coalesce(NEW.civilization,'') LIKE '中%');
  IF NOT looks_chinese THEN RETURN NEW; END IF;

  -- 曲风里已经有中国元素 → 放行(混搭是合法的, 例如 guofeng + electronic)。
  IF NEW.style ~* '(chin|guofeng|古风|民乐|唐|宋|guqin|pipa|erhu|dizi|guzheng|erhu|中国|华语)' THEN
    RETURN NEW;
  END IF;

  -- 只拦【点名了另一个具体音乐传统】的。泛用词(cinematic / epic / orchestral)一律放行。
  foreign_genre := (regexp_match(NEW.style,
    '(city[ -]?pop|j-?pop|k-?pop|enka|bossa[ -]?nova|reggaeton|flamenco|bhangra|afrobeat|k-?hiphop|shibuya[ -]?kei)',
    'i'))[1];

  IF foreign_genre IS NOT NULL THEN
    RAISE EXCEPTION
      '[CSSOS 文明×曲风不变量] 中华语境作品被写成外国流派曲风: title=% style=% (命中: %)。'
      '文明智能联动要求曲风随人物/作品的文明走 —— 若确实要跨文明混搭, 请在 style 里同时写明中国元素'
      '(如 "guofeng x city pop"), 让意图显式可见, 而不是静默替换。',
      left(coalesce(NEW.title,''), 60), left(NEW.style, 80), foreign_genre
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cssos_civ_style ON user_works;
CREATE TRIGGER trg_cssos_civ_style
  BEFORE INSERT OR UPDATE OF style, title, civilization ON user_works
  FOR EACH ROW EXECUTE FUNCTION cssos_assert_civ_style_coherent();
