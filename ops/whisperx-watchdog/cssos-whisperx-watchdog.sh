#!/usr/bin/env bash
# CSSOS_WAVE_1095 20260621 — Jing「whisperX 常驻 ML worker, 不搬回弱机 api-vm」后的
#   api-vm 侧健康【监控】(只告警, 不在本机重启 —— 重算力在 worker)。
#   动态读 /etc/cssos.env 的 WHISPERX_ALIGN_URL(现指 worker 10.128.0.5:7892),
#   连续 MAXFAIL 次无响应(~9 分钟, 长于正常 ~135s 对齐, 防误报)→ 上报 error_reports
#   (code=whisperx_worker_down)进免疫 digest, 让你第一时间看到 worker 挂了。
#   ⚠️ worker 自身的卡死【自愈重启】要在 worker 上另装 watchdog(见 ops/whisperx-watchdog/
#   worker-side/), 本脚本不远程重启(无 worker SSH 且不应把算力拉回 api-vm)。
set -uo pipefail
ENV=/etc/cssos.env
URL=$(grep -oE '^WHISPERX_ALIGN_URL=[^ ]+' "$ENV" 2>/dev/null | head -1 | cut -d= -f2-)
[ -z "$URL" ] && exit 0
HEALTH="${URL%/}/health"
STATE=/run/cssos-whisperx-watchdog.fails
MAXFAIL=3
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$HEALTH" 2>/dev/null); [ -z "$code" ] && code=000
if [ "$code" != "000" ]; then
  rm -f "$STATE"   # 任何 HTTP 响应(含 404)= 活着 → 清零
  exit 0
fi
fails=0; [ -f "$STATE" ] && fails=$(cat "$STATE" 2>/dev/null || echo 0)
fails=$((fails + 1)); echo "$fails" > "$STATE"
logger -t cssos-whisperx-watchdog "whisperX ($URL) unresponsive ($fails/$MAXFAIL)"
if [ "$fails" -ge "$MAXFAIL" ]; then
  rm -f "$STATE"
  logger -t cssos-whisperx-watchdog "ALERT whisperX $URL down ~9min — alert only (compute stays on worker)"
  T=$(grep -oE 'CSSOS_ADMIN_TOKEN=[^ ]+' "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
  curl -s --max-time 8 -X POST http://127.0.0.1:3000/api/telemetry/error \
    -H 'content-type: application/json' \
    -d "{\"message\":\"whisperX worker unreachable (${URL}) over ~9min — subtitle alignment down\",\"code\":\"whisperx_worker_down\",\"panel\":\"infra\"}" >/dev/null 2>&1 || true
fi
