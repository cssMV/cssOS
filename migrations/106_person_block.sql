-- CSSOS_WAVE_1673 — 隐藏在世真人(可逆) + 治本拦截。
-- Jing: 数字演员市场不得出现在世公众人物(肖像/政治风险)。
-- is_blocked = 可逆隐藏标记: 市场所有列表面(browse / discover-hot / today-in-history /
--   random / by-id / codex)都过滤掉它; 想恢复只需 UPDATE ... is_blocked=false(见下方触发器为何只在 INSERT 触发)。
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS person_profiles_blocked_idx ON person_profiles (is_blocked);

-- ── 治本: 自动生成/入库时, 检测"在世真人"→ 落库即 is_blocked=true(数据保留可复核, 但绝不进市场)。
-- 只挂 BEFORE INSERT(不挂 UPDATE): 这样 Jing 手动 UPDATE is_blocked=false 恢复某人时, 触发器不会再把它拦回去 → 隐藏可逆。
CREATE OR REPLACE FUNCTION cssos_person_block_living() RETURNS trigger AS $$
DECLARE
  ls   text := lower(coalesce(NEW.lifespan, ''));
  yrs  text[];
  birth int;
BEGIN
  IF NEW.is_blocked THEN RETURN NEW; END IF;                 -- 已显式拦截 → 保持
  IF ls ~ '(present|current|ongoing|至今)' THEN               -- 明确"在世"字样
    NEW.is_blocked := true; RETURN NEW;
  END IF;
  -- lifespan 里的 4 位年份: 两个=生卒齐全=已故; 只有一个较晚的出生年且无卒 → 视为在世。
  SELECT array_agg(m[1]) INTO yrs FROM regexp_matches(ls, '([12][0-9]{3})', 'g') AS m;
  IF yrs IS NOT NULL AND array_length(yrs, 1) = 1 THEN
    birth := yrs[1]::int;
    IF birth >= 1935 AND coalesce(NEW.death_month_day, '') = '' THEN
      NEW.is_blocked := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_person_block_living ON person_profiles;
CREATE TRIGGER trg_person_block_living
  BEFORE INSERT ON person_profiles
  FOR EACH ROW EXECUTE FUNCTION cssos_person_block_living();

-- 先隐藏已入库的在世人物: 习近平(1953–present, auto 生成)。幂等; 要恢复就把这行删了再 UPDATE false。
UPDATE person_profiles SET is_blocked = true WHERE person_id = 'xi-jinping';
