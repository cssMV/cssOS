-- CSSOS_WAVE_2347 20261120 — 画幅铁律落到【结构】上
--
-- Jing 2026-11-20:
--   「21:9 铁律: 构图, 取景, 输出, 而不要用其他比例的来剪裁, 必须是源输出就是 21:9。」
--   「不再使用 2.39:1, 改为 21:9。」
--   「库里存量作品的 aspect_ratio, 也请批量改成 21:9, 而且只保留 21:9 比例。」
--
-- ─────────────────────────────────────────────────────────────────────────
-- 这一列原来是【实测】, 现在改成【声明】—— 这不是改语义上的小事, 必须写清楚
--
-- W1915 建这一列时, 它存的是 ffprobe 量出来的【这个文件实际是什么】:
--     1:1    793 行, 最常见 1024x1024  —— 其中 695 行根本没有视频, 量的是方形封面
--     2.39:1 529 行, 最常见 2560x1072  —— 真的渲成了 2.39
--     9:16    38 行, 最常见  720x1280  —— 真的是竖屏视频
--
-- 改完之后分工变成:
--     aspect_ratio                      = 平台铁律【声明】的画幅, 永远 21:9
--     frame_width / frame_height        = 这个文件【实际】是什么(ffprobe 实测, 原样不动)
--     orientation                       = 同上, 实测派生(原样不动)
--
-- 两者不再是同一件事, 所以「aspect_ratio=21:9 而 orientation=portrait」不是矛盾,
-- 是【铁律说 21:9, 这个旧文件实际是竖的】。实测证据一个字节都没抹 ——
-- 抹掉就再也量不回来了(W2061 的教训: 记录留住了、字节没留住, 等于没留)。
-- 旧值另存一份在 w2347_aspect_pre_backup。
--
-- ─────────────────────────────────────────────────────────────────────────
-- 为什么是【结构】而不是【批量 UPDATE 一次】
--
-- 一次 UPDATE 只能让「此刻只有 21:9」。库里能冒出别的值的路有两条, 不堵死
-- 下一次写入就破了:
--
--   ① user_works 有 18 条 INSERT 路径, 大多数【根本不写这一列】→ 落 NULL。
--      (这就是改之前 916 行是空的原因。)一条一条去改必漏, 给列设 DEFAULT 一次封住全部。
--
--   ② W1915 的触发器在 aspect_ratio 为空时, 会把【实测标签】写进去 ——
--      下一次回填 / 任何写 frame_* 的动作都会把 2.39:1 / 1:1 / 9:16 放回来。
--
-- 平台铁律的原话: 纪律会松, 结构不会。

-- ① 默认值 —— 封住全部 18 条 INSERT, 包括将来新增的
ALTER TABLE user_works ALTER COLUMN aspect_ratio SET DEFAULT '21:9';

-- ② 触发器不再【推导】画幅, 只填铁律值; orientation 的实测派生原样保留
CREATE OR REPLACE FUNCTION cssos_derive_frame_geometry() RETURNS trigger AS $$
DECLARE r numeric;
BEGIN
  /* 画幅是【声明】, 不再从尺寸推导 —— 空就填铁律值, 和尺寸无关。
   * 放在尺寸判断【之前】: 没量到尺寸的行也要拿到 21:9。 */
  IF NEW.aspect_ratio IS NULL OR btrim(NEW.aspect_ratio) = '' THEN
    NEW.aspect_ratio := '21:9';
  END IF;

  IF NEW.frame_width IS NULL OR NEW.frame_height IS NULL
     OR NEW.frame_width <= 0 OR NEW.frame_height <= 0 THEN
    RETURN NEW;
  END IF;

  r := NEW.frame_width::numeric / NEW.frame_height::numeric;

  /* orientation 仍然是【实测】—— 它描述这个文件实际是横是竖, 那是真信息,
   * 而且播放端的旋转判断虽然不读库(app.watch-face-crop.js:95「不猜、不查库」),
   * 巡检脚本要靠它找出"标着 21:9 其实是竖的"那些旧文件。 */
  IF NEW.orientation IS NULL OR btrim(NEW.orientation) = '' THEN
    NEW.orientation := CASE
      WHEN r >= 2.6 THEN 'ultra-wide'
      WHEN r > 1.05 THEN 'landscape'
      WHEN r < 0.95 THEN 'portrait'
      ELSE 'square' END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/* 触发器原来只在 frame_* 变化时触发 —— 那样 INSERT 不带尺寸就不会补画幅。
 * 改成 BEFORE INSERT 全量 + UPDATE OF frame_* , 这样任何新行都拿得到 21:9。 */
DROP TRIGGER IF EXISTS trg_cssos_frame_geometry ON user_works;
CREATE TRIGGER trg_cssos_frame_geometry
  BEFORE INSERT OR UPDATE OF frame_width, frame_height ON user_works
  FOR EACH ROW EXECUTE FUNCTION cssos_derive_frame_geometry();

-- ③ 存量自愈 —— 正常情况下 0 行, 真有东西漏进来下次启动就归位
UPDATE user_works SET aspect_ratio = '21:9'
 WHERE aspect_ratio IS DISTINCT FROM '21:9';

-- 刻意【不】加 CHECK (aspect_ratio = '21:9'):
--   CHECK 会把"老客户端送了 2.39:1"变成一个用户面前的 500。
--   API 层改成【归一化】更对 —— 把错值修成 21:9, 而不是把请求打回去。
--   见 src/index.ts 的 PATCH 作品端点。
