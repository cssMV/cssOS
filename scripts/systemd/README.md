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

## 告警判据(2026-09-12 定稿)

**只有「共用非内容哈希地址」才报警。** 内容哈希地址的文件结构上不可能被覆盖 ——
两条轨共用一个哈希地址只说明"世界上确实只有这一份字节",不代表将来会丢。

判据收紧前,A 段会把 28 行正常状态报成红色,红灯天天亮。
**长期红灯 = 没人再看** —— 那比没有告警更危险,因为它给未来的真损失盖被子。

现在的输出分三层,**一个都不隐藏**:

| | 当前 | 报警 |
|---|---|---|
| 🔴 共用非哈希地址(真实风险) | 0 | **是** |
| ⚰️ 已知历史损失(`orig-pre-epic`,旧版 2026-08-24 被覆盖) | 17 | 否,木已成舟 |
| ℹ️ 从来只有一个版本(`orig` 与语言轨指同一份字节) | 11 | 否,本就正常 |

**没有采用「手工基线」的做法** —— 基线要靠人记得更新,一旦有新的固定名写法混进来
不会自动感知,而且它的本质是「把告警调成不响」。改判据则是自维护的:
任何人写出一个固定名路径,A 段立刻变红。

实测(2026-09-12):三项全绿,单元退出码 0,定时器自动运行已确认。
