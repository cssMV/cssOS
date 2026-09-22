#!/usr/bin/env bash
# W2138 · 串台复查器 —— 只报【水位线之后又发生过】的, 不看累计数。
#
# 为什么必须有水位线: error_reports.count 是【累计】的, 指纹自 2026-07-27 就存在。
# 直接看 count 永远是几百上千, 分不清"修好了没有"。
# 判据只能是 last_seen: 某个指纹在水位线之后【又亮了一次】, 才叫复发。
#
# 水位线 = 修复上线时刻(音频 17:14 UTC / 字幕 17:26 UTC, 取 17:30 UTC)。
# 用法: check-crosstalk-since.sh ['2026-09-22 17:30']
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
SINCE="${1:-2026-09-22 17:30}"

cat > /tmp/_ct_check.sql <<SQL
\pset border 2
\set since '${SINCE}'
\echo '════ 水位线: ${SINCE} UTC(串台两处修复上线之后)════'

\echo ''
\echo '── ① 串台: 水位线之后【又发生过】的指纹 ──'
SELECT substring(message from 'crosstalk\[([a-z-]+)\]') AS 类型,
       substring(message from 'offenders=([a-z,/+]+)') AS 掉队的道,
       count AS 累计次数,
       to_char(last_seen AT TIME ZONE 'UTC','MM-DD HH24:MI') AS 最后一次,
       left(message, 78) AS 原文
  FROM error_reports
 WHERE message LIKE '%crosstalk%' AND last_seen > timestamptz :'since'
 ORDER BY last_seen DESC;

\echo ''
\echo '── ② 汇总 ──'
SELECT count(*) AS "水位线后复发的指纹数",
       (SELECT count(*) FROM error_reports WHERE message LIKE '%crosstalk%') AS "历史指纹总数",
       (SELECT to_char(max(last_seen) AT TIME ZONE 'UTC','MM-DD HH24:MI')
          FROM error_reports WHERE message LIKE '%crosstalk%') AS "全库最后一次串台"
  FROM error_reports
 WHERE message LIKE '%crosstalk%' AND last_seen > timestamptz :'since';

\echo ''
\echo '── ③ 顺带看这段时间的其它报错(别只盯串台)──'
SELECT COALESCE(domain,'-') AS 域, count(*) AS 指纹数, sum(count) AS 累计,
       left(max(message), 66) AS 样例
  FROM error_reports
 WHERE last_seen > timestamptz :'since'
 GROUP BY 1 ORDER BY 2 DESC LIMIT 8;
SQL
psql -h 127.0.0.1 -U cssstudio -d cssstudio -f /tmp/_ct_check.sql
