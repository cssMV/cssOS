-- CSSOS_WAVE_116 20260702 — 数字演员「戏路层级化」。
-- role_range(自由文字)保留为 vibe(味道/气质一句话); 新增结构化两级戏路:
--   archetypes = 大类 key 数组(hero/villain/antihero/ruler/action/sage/charmer/tragic/comic/enigma/youth)
--   sub_roles  = 细分标签数组(自由字符串, 来自前端 taxonomy)
-- 大类用于: 图鉴筛选 + casting 注入表情路由 + 推荐定价(反派系溢价)。
-- 留有余地: taxonomy 在前端一张表, 增减戏路只改一行, 不改 schema。

ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS archetypes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS sub_roles  TEXT[] NOT NULL DEFAULT '{}';

-- 按大类筛选要快(GIN)。
CREATE INDEX IF NOT EXISTS digital_actors_archetypes_idx ON digital_actors USING GIN (archetypes);
