#!/usr/bin/env bash
# CSSOS_WAVE_1095 — 在【ML worker (cssos-atelier)】上跑: 三件 ML 服务"活着但不响应"(卡死)
#   自愈重启。systemd Restart=on-failure 只管崩溃不管卡死 → 这里检测无响应。
#   连续 MAXFAIL 次(~9 分钟, 长于正常 ~135s 对齐, 防误杀进行中任务)才重启对应服务。
set -uo pipefail
declare -A SVC=( [7891]=cssos-audio-analysis [7892]=cssos-whisperx-align [7893]=cssos-demucs-sep )
MAXFAIL=3
for port in "${!SVC[@]}"; do
  svc="${SVC[$port]}"
  state="/run/cssos-ml-watchdog.${port}.fails"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://127.0.0.1:${port}/" 2>/dev/null); [ -z "$code" ] && code=000
  if [ "$code" != "000" ]; then rm -f "$state"; continue; fi      # 任何 HTTP 响应=活着
  fails=0; [ -f "$state" ] && fails=$(cat "$state" 2>/dev/null || echo 0)
  fails=$((fails + 1)); echo "$fails" > "$state"
  logger -t cssos-ml-watchdog "${svc} (:${port}) unresponsive (${fails}/${MAXFAIL})"
  if [ "$fails" -ge "$MAXFAIL" ]; then
    systemctl restart "$svc" 2>/dev/null || sudo systemctl restart "$svc"
    rm -f "$state"
    logger -t cssos-ml-watchdog "RESTARTED ${svc} after ${fails} consecutive hangs"
  fi
done
