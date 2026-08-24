-- CSSOS_WAVE_1915 20260824 — 画幅几何四件套(Jing 指示 ①)
--
-- 现状(实测): aspect_ratio / frame_width / frame_height / orientation
--   在 1682 首非删除作品里【全部为空】。四个字段都在, 从来没人填。
--   后果: 画面形态胶囊只能在前端读解码器实时猜(W1880 注释里写着"库里拿不到");
--   32:9 铁律(W1903)也无法验证某首作品到底是不是 32:9。
--
-- 分工:
--   · 真实尺寸只能【探测】—— 由回填脚本用 ffprobe 读真实媒体, 写 frame_width/height;
--   · aspect_ratio 和 orientation 是【从尺寸推导】的, 交给触发器 —— 这样以后无论谁
--     写入尺寸(回填、生成、手工修), 这两个派生字段永远自动跟上, 不会再出现"填了一半"。
--
-- 与 W1908(civ/language)同一套思路: 能推导的交给触发器, 推不出来的留空, 绝不瞎填。

CREATE OR REPLACE FUNCTION cssos_derive_frame_geometry() RETURNS trigger AS $$
DECLARE r numeric;
BEGIN
  IF NEW.frame_width IS NULL OR NEW.frame_height IS NULL
     OR NEW.frame_width <= 0 OR NEW.frame_height <= 0 THEN
    RETURN NEW;
  END IF;

  r := NEW.frame_width::numeric / NEW.frame_height::numeric;

  IF NEW.orientation IS NULL OR btrim(NEW.orientation) = '' THEN
    NEW.orientation := CASE
      WHEN r >= 2.6 THEN 'ultra-wide'     -- 32:9=3.56 / 2.39:1=2.39 之上
      WHEN r > 1.05 THEN 'landscape'
      WHEN r < 0.95 THEN 'portrait'
      ELSE 'square' END;
  END IF;

  IF NEW.aspect_ratio IS NULL OR btrim(NEW.aspect_ratio) = '' THEN
    /* 就近归到平台已知画幅; 都不沾边就写实际比值, 不硬套一个不对的标签
     * (宁可少标, 绝不错标 —— 同 W1880)。 */
    NEW.aspect_ratio := CASE
      WHEN abs(r - 32.0/9.0)  < 0.12 THEN '32:9'
      WHEN abs(r - 2.39)      < 0.10 THEN '2.39:1'
      WHEN abs(r - 21.0/9.0)  < 0.08 THEN '21:9'
      WHEN abs(r - 16.0/9.0)  < 0.06 THEN '16:9'
      WHEN abs(r - 1.0)       < 0.04 THEN '1:1'
      WHEN abs(r - 4.0/5.0)   < 0.04 THEN '4:5'
      WHEN abs(r - 9.0/16.0)  < 0.04 THEN '9:16'
      WHEN abs(r - 9.0/19.5)  < 0.03 THEN '9:19.5'
      ELSE round(r, 2)::text || ':1' END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cssos_frame_geometry ON user_works;
CREATE TRIGGER trg_cssos_frame_geometry
  BEFORE INSERT OR UPDATE OF frame_width, frame_height ON user_works
  FOR EACH ROW EXECUTE FUNCTION cssos_derive_frame_geometry();
