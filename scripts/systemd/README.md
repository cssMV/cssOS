# W2086 媒体覆盖风险巡检 · 部署方式

装到 api-vm(已装,此处留档以便重建):

```bash
sudo install -m 755 scripts/audit-media-overwrite-risk.sh /srv/cssos/bin/audit-media-overwrite-risk.sh
sudo install -m 755 scripts/systemd/media-audit-run.sh     /srv/cssos/bin/media-audit-run.sh
sudo cp scripts/systemd/cssos-media-audit.{service,timer}  /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now cssos-media-audit.timer
```

- 每天跑一次,报告落 `/srv/cssos/media-audit.last.txt`,摘要进 journald
- `journalctl -u cssos-media-audit` 看历史
- **退出码 1 = 发现风险**,systemd 会把这个 oneshot 标成 failed

## 两个踩过的坑(别再犯)

1. `Documentation=` 里写中文和空格 → systemd 当成多个 URL 报 `Invalid URL`。
2. **`ExecStart` 里写复杂 shell**(`bash -c "... rc=\$? ... exit \$rc"`)经过嵌套 heredoc
   转义会被写坏成 `rc=\0`,单元报 `Unbalanced quoting` → **单元加载不了 → 定时器拒绝启动**,
   而且报错信息指向 timer,很容易误判成 timer 的问题。
   → 复杂逻辑一律放到磁盘上的脚本里,单元只写 `ExecStart=<脚本路径>`。

## 一个已知的告警设计缺陷

目前有 39 条轨仍用写死的 `a1.mp3` 命名,所以巡检**每天都会报风险、单元长期显示 failed**。
长期红灯 = 没人再看 —— 必须把那 39 条迁到内容哈希命名,让绿灯有意义。
在那之前,「failed」既可能是发现风险,也可能是巡检自己坏了,**两者分不开**。
