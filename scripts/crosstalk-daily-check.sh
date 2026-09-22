#!/usr/bin/env bash
# W2138 · 串台每日巡检 —— 照平台既有 probe 约定落盘到 /ops/(与 zh-probe 同一套)。
#
# 判据只看 last_seen, 不看 count: error_reports.count 是【累计】的, 串台指纹自
# 2026-07-27 就存在, 看累计永远是几百上千, 分不清"修好了没有"。
# 某个指纹在【水位线之后又亮了一次】才叫复发。
#   水位线 = 两处修复上线时刻(音频 17:14 UTC / 字幕 17:26 UTC → 取 17:30)。
#
# 同时报【近 24 小时】的复发, 以及【这段时间有没有流量】——
# 没有流量的 0 复发不是证据, 必须让读的人看得出来, 别把"没人用"误当成"修好了"。
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
WATERMARK="${CROSSTALK_WATERMARK:-2026-09-22 17:30}"
OPS_DIR="/srv/cssos/shared/public/ops"
LATEST="$OPS_DIR/crosstalk-latest.json"
HISTORY="$OPS_DIR/crosstalk-history.json"
mkdir -p "$OPS_DIR"

# ⚠ 下面整个 Q 是【双引号串】, 里面【一个英文双引号都不许有】——
#   我连栽两次: 先在 SQL 注释里写了 â近 24 小时â(用的英文引号), 串被提前闭合,
#   24 变成命令; 改的时候又在â不许用双引号â这句话里写了一个双引号。
#   规矩: 说明一律写在 Q 【外面】, SQL 里只留纯 SQL。
#
# activity_since_watermark 必须按【水位线之后】算, 不能按近 24 小时 ——
#   24 小时里的报错大半发生在修复【之前】, 拿它当有流量的证据, 会把
#   【没人用】误判成【修好了】(第一版正是这么把 no_traffic 判成了 clean)。
Q="SELECT json_build_object(
  'checked_at',        to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
  'watermark',         '${WATERMARK}',
  'since_fix',         (SELECT count(*) FROM error_reports
                         WHERE message LIKE '%crosstalk%' AND last_seen > timestamptz '${WATERMARK}'),
  'last_24h',          (SELECT count(*) FROM error_reports
                         WHERE message LIKE '%crosstalk%' AND last_seen > now() - interval '24 hours'),
  'last_crosstalk_at', (SELECT to_char(max(last_seen) AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')
                          FROM error_reports WHERE message LIKE '%crosstalk%'),
  'offenders_since_fix', COALESCE((SELECT json_agg(x) FROM (
        SELECT COALESCE(substring(message from 'offenders=([a-z,/+]+)'),'?') AS channel,
               count(*) AS fingerprints, sum(count) AS hits
          FROM error_reports
         WHERE message LIKE '%crosstalk%' AND last_seen > timestamptz '${WATERMARK}'
         GROUP BY 1) x), '[]'::json),
  'activity_since_watermark', (SELECT count(*) FROM error_reports
                                WHERE last_seen > timestamptz '${WATERMARK}'),
  'any_errors_24h', (SELECT count(*) FROM error_reports
                      WHERE last_seen > now() - interval '24 hours'),
  'total_fingerprints_alltime', (SELECT count(*) FROM error_reports WHERE message LIKE '%crosstalk%')
)::text"

JSON=$(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c "$Q" 2>/dev/null)
[ -z "$JSON" ] && JSON='{"checked_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","error":"db_unreachable"}'

# verdict: 复发>0 = recurred; 复发=0 且有流量 = clean; 复发=0 但没流量 = no_traffic(不算证据)
VERDICT=$(printf '%s' "$JSON" | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: print('unknown'); raise SystemExit
if d.get('error'): print('db_unreachable')
elif (d.get('since_fix') or 0) > 0: print('recurred')
elif (d.get('activity_since_watermark') or 0) == 0: print('no_traffic')
else: print('clean')
")
JSON=$(printf '%s' "$JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin); d['verdict'] = '$VERDICT'
print(json.dumps(d, ensure_ascii=False))
")

printf '%s\n' "$JSON" > "$LATEST.tmp" && mv "$LATEST.tmp" "$LATEST"
# history: 保留最近 120 次(与 zh-probe 同思路, 不无限增长)
python3 - "$HISTORY" "$JSON" <<'PY'
import json, sys, os
path, cur = sys.argv[1], json.loads(sys.argv[2])
hist = []
if os.path.exists(path):
    try: hist = json.load(open(path))
    except Exception: hist = []
if not isinstance(hist, list): hist = []
hist.append(cur)
hist = hist[-120:]
tmp = path + ".tmp"
json.dump(hist, open(tmp, "w"), ensure_ascii=False)
os.replace(tmp, path)
PY
chmod 644 "$LATEST" "$HISTORY" 2>/dev/null || true

# 对外真正被服务的是【当前发布目录】/srv/cssos/current/public/ops, 不是 shared。
# (实测: shared 里的 zh-probe-latest.json 取不到 404, current 里的 history 取得到 200。)
#
# 为什么不做软链: 记忆里那条教训 —— deploy.sh 的 `--exclude 'fonts/'` 带尾斜杠
# 【挡不住符号链接】, 导致字体每次部署被 --delete 删掉。这里不重蹈覆辙, 也不去动 deploy.sh。
# 改成两处都写: shared 是权威副本, current 是对外可读的那份。
# 前端部署会把 current 里这两个文件冲掉, 但下一次巡检(每天一次)会自动补回来 ——
# 代价只是部署后最多一天读到旧值, 换来零部署风险。
SERVED_DIR="/srv/cssos/current/public/ops"
if [ -d "$SERVED_DIR" ]; then
  cp -f "$LATEST"  "$SERVED_DIR/crosstalk-latest.json"  2>/dev/null || true
  cp -f "$HISTORY" "$SERVED_DIR/crosstalk-history.json" 2>/dev/null || true
  chmod 644 "$SERVED_DIR/crosstalk-latest.json" "$SERVED_DIR/crosstalk-history.json" 2>/dev/null || true
fi
echo "[crosstalk-daily] verdict=$VERDICT"
printf '%s\n' "$JSON"
