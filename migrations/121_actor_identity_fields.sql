-- CSSOS_WAVE_1926 20260824 — 数字演员身份参数化 (Jing 批准 ①②③)
--
-- 撞号实测(动手前量的): 343 位演员, 机器可读参数只能区分出 248 种组合
--   → 95 位演员跟别人完全撞号。苏格拉底=柏拉图=亚里士多德=阿基米德=毕达哥拉斯
--   =希波克拉底(6 人同签名); 孔子=老子=孟子=孙子=玄奘(5 人); 妲己=嫦娥。
--   李白 vs 西施 原型同为 {charmer,tragic}, 唯一分开他俩的只有 gender 一个字段。
--
-- 空缺率: 121/343 标签是自动占位 {civilization,文明名}(等于没标签);
--         337/343 无年龄段; 276/343 无外形标签; 0/343 有朝代(这张表没这一列)。
--
-- 真正撑起人物身份的一直是 face_prompt + bio 这两段【散文】—— 画面单点吊在
-- 一句冻结的 face_prompt 上, 音乐引擎/检索/去重/防串播一个字都读不到。
-- 这次把散文里的身份信息【结构化出来】, 让引擎也能用。

ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS dynasty            text;      -- 商 / 盛唐 / 北宋 / 古典希腊…
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS era_start_year     integer;   -- 负数 = 公元前
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS era_end_year       integer;
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS species            text;      -- human / deity / fox-spirit / immortal…
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS source_work        text;      -- 《封神演义》/《三国演义》/ 史实
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS identity_keywords  text[];    -- 拆撞号的关键: 狐妖/苏护之女/帝辛…
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS canonical_actor_id text;      -- 别名合并: 杨贵妃 → 杨玉环
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS identity_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_actors_dynasty  ON digital_actors(dynasty)  WHERE dynasty IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actors_canonical ON digital_actors(canonical_actor_id) WHERE canonical_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actors_idkw ON digital_actors USING gin(identity_keywords);
