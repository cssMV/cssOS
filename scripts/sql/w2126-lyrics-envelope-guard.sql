-- W2126 · 源头闸门: 歌词写入时自动剥掉 LLM 的 JSON 信封
--
-- 为什么装在数据库而不是逐个改代码:
--   src/index.ts 里写 user_works.lyrics_preview 的地方有【9 处】。逐处去加解析,
--   必然漏一处 —— 而"漏一处"正是这 187 首当初混进来的原因。将来还会新增写入点。
--   这个库里已有先例: wmv_reject_shared_url_trg 就是拿触发器当闸门。
--
-- 与那个先例的一点不同: 那条是【拒绝】, 这条是【纠正】。
--   拒绝会让一次正常的创作流程失败(用户丢掉一首歌), 代价太大;
--   而信封本来就是垃圾, 拆掉它不损失任何东西。
--
-- 只在值【确实带信封】时动手, 其余一律原样放行 —— 绝不碰正常歌词。

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION w2126_strip_envelope() RETURNS trigger AS $trg$
DECLARE fixed text;
BEGIN
  IF NEW.lyrics_preview IS NULL THEN RETURN NEW; END IF;
  -- 不像信封就不动(绝大多数写入走这条, 零开销)
  IF NEW.lyrics_preview !~ '"lyrics?"\s*:\s*"' THEN RETURN NEW; END IF;
  fixed := w2126_unwrap(NEW.lyrics_preview);
  IF fixed IS NOT NULL AND length(btrim(fixed)) >= 40 THEN
    RAISE NOTICE '[w2126] 歌词带 JSON 信封, 已自动剥掉 (work=%)', NEW.id;
    NEW.lyrics_preview := fixed;
  END IF;
  RETURN NEW;
END $trg$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS w2126_lyrics_envelope_trg ON user_works;
CREATE TRIGGER w2126_lyrics_envelope_trg
  BEFORE INSERT OR UPDATE OF lyrics_preview ON user_works
  FOR EACH ROW EXECUTE FUNCTION w2126_strip_envelope();

-- ── 自检: 闸门真的管用吗 ────────────────────────────────────────────────
-- 造一条带信封的写入, 看存进去的是不是已经拆好的。测完删掉那行。
DO $t$
DECLARE tid uuid := gen_random_uuid(); uid uuid; got text; bad text;
BEGIN
  SELECT id INTO uid FROM users LIMIT 1;
  bad := '{' || chr(10) || '  "lyrics": "[Intro]\nThis is a guard test line one\nAnd here is line two of it\n\n[Verse 1]\nEnough characters to pass the forty char floor"' || chr(10) || '}';
  INSERT INTO user_works (id, user_id, title, lyrics_preview, status)
       VALUES (tid, uid, 'W2126 GUARD TEST', bad, 'draft');
  SELECT lyrics_preview INTO got FROM user_works WHERE id = tid;
  IF got ~ '"lyrics"\s*:' THEN
    RAISE EXCEPTION '闸门没生效: 信封还在 -> %', left(got, 60);
  END IF;
  IF got !~ 'guard test line one' THEN
    RAISE EXCEPTION '闸门拆坏了: 内容不对 -> %', left(got, 60);
  END IF;
  IF got ~ '\\n' THEN
    RAISE EXCEPTION '闸门没反转义: 字面 \n 还在 -> %', left(got, 60);
  END IF;
  DELETE FROM user_works WHERE id = tid;
  RAISE NOTICE '[w2126] 自检通过: 信封被剥掉、内容完整、换行已还原';
END $t$;

-- 反面自检: 正常歌词【一个字都不许动】
DO $t2$
DECLARE tid uuid := gen_random_uuid(); uid uuid; got text; good text;
BEGIN
  SELECT id INTO uid FROM users LIMIT 1;
  good := '[Intro]' || chr(10) || '水波轻摇叶梢青' || chr(10) || chr(10) || '[Verse 1]' || chr(10) || '清波映照佳人影, 轻云绕指舞丝缕。';
  INSERT INTO user_works (id, user_id, title, lyrics_preview, status)
       VALUES (tid, uid, 'W2126 GUARD TEST 2', good, 'draft');
  SELECT lyrics_preview INTO got FROM user_works WHERE id = tid;
  IF got <> good THEN RAISE EXCEPTION '闸门误伤了正常歌词!'; END IF;
  DELETE FROM user_works WHERE id = tid;
  RAISE NOTICE '[w2126] 反面自检通过: 正常歌词逐字未动';
END $t2$;
