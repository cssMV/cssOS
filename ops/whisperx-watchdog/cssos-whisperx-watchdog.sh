#!/usr/bin/env bash
# CSSOS_WAVE_1093 — Jing「对齐服务卡 9 小时无人管」自愈: whisperX align(:7892)
#   进程"活着但不响应"时 systemd Restart=on-failure 不触发 → 这个 watchdog 检测
#   【无响应】(curl 超时/000), 连续 MAXFAIL 次(~9 分钟, 长于任何正常对齐任务)才
#   重启, 避免误杀进行中的 135s 对齐。重启即写日志 + 上报应用免疫系统(error_reports)。
set -uo pipefail
URL="http://127.0.0.1:7892/"
STATE="/run/cssos-whisperx-watchdog.fails"
MAXFAIL=3
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$URL" 2>/dev/null || echo "000")
if [ "$code" != "000" ]; then
  rm -f "$STATE"   # 任何 HTTP 响应(含 404)= 活着 → 清零
  exit 0
fi
fails=0
[ -f "$STATE" ] && fails=$(cat "$STATE" 2>/dev/null || echo 0)
fails=$((fails + 1))
echo "$fails" > "$STATE"
logger -t cssos-whisperx-watchdog "align unresponsive ($fails/$MAXFAIL)"
if [ "$fails" -ge "$MAXFAIL" ]; then
  systemctl restart cssos-whisperx-align.service
  rm -f "$STATE"
  logger -t cssos-whisperx-watchdog "RESTARTED cssos-whisperx-align after $fails consecutive hangs"
  T=$(grep -oE 'CSSOS_ADMIN_TOKEN=[^ ]+' /etc/cssos.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
  curl -s --max-time 8 -X POST "http://127.0.0.1:3000/api/telemetry/error" \
    -H "content-type: application/json" \
    -d '{"message":"whisperX align hung over ~9min — watchdog auto-restarted","code":"whisperx_watchdog_restart","panel":"infra"}' >/dev/null 2>&1 || true
fi
