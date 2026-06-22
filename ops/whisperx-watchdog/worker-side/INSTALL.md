# Worker-side ML watchdog 安装(在 cssos-atelier 上)

worker 的 whisperX/Demucs/audio-analysis "卡死但进程活着"时 systemd 不会重启它。
这个 watchdog 每 3 分钟健康检查,连续 3 次(~9 分钟)无响应就 restart 对应服务。

## 一条命令装(从你有权限的机器,走 IAP)
```bash
gcloud compute scp ops/whisperx-watchdog/worker-side/cssos-ml-watchdog.sh \
  ops/whisperx-watchdog/worker-side/cssos-ml-watchdog.service \
  ops/whisperx-watchdog/worker-side/cssos-ml-watchdog.timer \
  cssos-atelier:/tmp/ --zone=us-central1-c --tunnel-through-iap

gcloud compute ssh cssos-atelier --zone=us-central1-c --tunnel-through-iap --command '
  sudo install -m 755 /tmp/cssos-ml-watchdog.sh /usr/local/bin/cssos-ml-watchdog.sh
  sudo mv /tmp/cssos-ml-watchdog.service /tmp/cssos-ml-watchdog.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now cssos-ml-watchdog.timer
  systemctl list-timers cssos-ml-watchdog.timer --no-pager
'
```

## 验证
```bash
gcloud compute ssh cssos-atelier --zone=us-central1-c --tunnel-through-iap \
  --command "journalctl -t cssos-ml-watchdog -n 20 --no-pager"
```
(健康时无重启日志 = 正确。)

> 注:若 worker 上服务单元名与 7891=cssos-audio-analysis / 7892=cssos-whisperx-align /
> 7893=cssos-demucs-sep 不符,改 cssos-ml-watchdog.sh 顶部的 SVC 映射即可。
