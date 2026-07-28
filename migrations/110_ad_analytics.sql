-- CSSOS_WAVE_1774 20260726 — Jing「广告数据表」: 以后能查「在哪些平台投了广告、花了多少、
--   带来多少流量、哪张卡哪个语言带来的、浏览/点击」。
--
-- 为什么要建表（而不是只查 nginx 日志）:
--   ① nginx access.log 只留 14 天(access.log.14.gz 到头), 广告要跨月对比就查不到了。
--   ② 花费(spend) 没有免费 API —— X/Meta 都得手工录, 必须有个地方存。
--   ③ 日志知道「来了」, 库里知道「注册了」, 两边对不上 —— 而这恰恰是唯一重要的问题
--      (2026-07 首波: 162 次点击 → 7 天内 0 个新用户, 是查库才发现的)。
--
-- 数据从哪来: 落地链接一律带 ?cssADS=<来源>（见 memory no-bare-outbound-urls）。
--   来源标签约定: 广告用平台名(x / meta), 社媒队列用「卡名-语种」(wendao-ar / paid-pt),
--   长文用人物名(longform-lilith)。ingest 脚本每天扫 nginx 日志入库(幂等)。

-- ① 落地留痕: 每一次带 cssADS 的落地记一行。
CREATE TABLE IF NOT EXISTS ad_landings (
  id            bigserial PRIMARY KEY,
  source        text        NOT NULL,              -- cssADS 的值, 如 x / meta / wendao-ar
  landed_at     timestamptz NOT NULL,              -- 落地时间(取自 nginx 日志)
  ip_hash       text,                              -- IP 的 sha256 前 16 位。只为「去重独立访客」,
                                                   -- 不存明文 IP(隐私)。
  user_agent    text,
  is_bot        boolean     NOT NULL DEFAULT false,-- UA 命中爬虫特征 → 统计时排除
  path          text,                              -- 完整请求路径(含 query)
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- 幂等键: 同一 (来源, 时间, IP哈希, 路径) 只记一次 —— ingest 脚本可以反复重跑同一份日志。
CREATE UNIQUE INDEX IF NOT EXISTS ad_landings_dedup
  ON ad_landings (source, landed_at, COALESCE(ip_hash, ''), COALESCE(path, ''));
CREATE INDEX IF NOT EXISTS ad_landings_source_time ON ad_landings (source, landed_at DESC);
CREATE INDEX IF NOT EXISTS ad_landings_time        ON ad_landings (landed_at DESC);

-- ② 花费: 手工录入(X/Meta 无免费 API)。一个平台一个 campaign 一天一行。
CREATE TABLE IF NOT EXISTS ad_spend (
  id            bigserial PRIMARY KEY,
  platform      text        NOT NULL,              -- x / meta / google …
  campaign      text        NOT NULL,              -- 如 CSSOS Wave2 Daji Video
  source_tag    text,                              -- 对应的 cssADS 值, 用来和 ad_landings 对账
  day           date        NOT NULL,
  spend_cents   integer     NOT NULL DEFAULT 0,    -- 整数分, 与钱包口径一致(绝不用浮点存钱)
  impressions   integer     NOT NULL DEFAULT 0,
  clicks        integer     NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- 同一平台+campaign+日期只允许一行, 重复录入走 UPDATE(脚本用 ON CONFLICT)。
CREATE UNIQUE INDEX IF NOT EXISTS ad_spend_unique
  ON ad_spend (platform, campaign, day);
CREATE INDEX IF NOT EXISTS ad_spend_day ON ad_spend (day DESC);
