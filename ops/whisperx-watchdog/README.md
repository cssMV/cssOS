# whisperX align watchdog (WAVE_1093)

自愈: `cssos-whisperx-align.service`(api-vm :7892)进程"活着但不响应"(卡死)时,
systemd `Restart=on-failure` 不触发 → 这个 watchdog 检测【无响应】(curl 超时/000),
连续 3 次(~9 分钟, 长于任何正常对齐任务, 避免误杀进行中的 ~135s 对齐)才重启。
重启即 `logger` + 上报 `/api/telemetry/error`(code=whisperx_watchdog_restart)→ 进 error-digest。

## 安装(已部署 api-vm)
    sudo cp cssos-whisperx-watchdog.sh /usr/local/bin/ && sudo chmod 755 /usr/local/bin/cssos-whisperx-watchdog.sh
    sudo cp cssos-whisperx-watchdog.{service,timer} /etc/systemd/system/
    sudo systemctl daemon-reload && sudo systemctl enable --now cssos-whisperx-watchdog.timer

## 查
    systemctl list-timers cssos-whisperx-watchdog.timer
    journalctl -t cssos-whisperx-watchdog -n 20
