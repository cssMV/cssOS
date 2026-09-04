-- CSSOS_WAVE_2074 20260904 — 众筹拍电影: 意向登记(只收邮箱, 不收钱)。
--
-- 律师过审前【不能对外收钱, 也不能像在收钱】。这张表只做一件事:
-- 记下"谁想第一批参与", 等规则做对了再联系。
--
-- 隐私: 按 Jing 的常驻规矩【只存必要字段】—— 邮箱 + 影片 + 来源 + 时间。
-- **不存 IP、不存 User-Agent、不做任何指纹。** 来源就是外链上的 ?cssADS= 值,
-- 用来看哪个平台带来的人, 仅此而已。
CREATE TABLE IF NOT EXISTS film_interest_signups (
  id          BIGSERIAL PRIMARY KEY,
  film_slug   TEXT NOT NULL,
  email       TEXT NOT NULL,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 同一部片同一个邮箱只记一次(重复提交是善意的, 不该报错也不该重复计数)
CREATE UNIQUE INDEX IF NOT EXISTS film_interest_uniq
  ON film_interest_signups (film_slug, lower(email));
CREATE INDEX IF NOT EXISTS film_interest_film_time
  ON film_interest_signups (film_slug, created_at DESC);
