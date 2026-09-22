# 串台每日巡检 (W2138)

**看一眼就够:** https://cssstudio.app/ops/crosstalk-latest.json

```
verdict = clean       水位线之后有流量, 且 0 复发  → 真的稳了
          no_traffic  水位线之后没人用            → 这个 0 不算证据
          recurred    又串台了                    → since_fix / offenders_since_fix 看是哪条道
          db_unreachable  巡检自己坏了
```

- 定时器 `cssos-crosstalk-daily.timer`,每天 05:00 UTC(DB 备份 04:30 之后)
- 脚本 `/srv/cssos/crosstalk-daily.sh`(源:`scripts/crosstalk-daily-check.sh`)
- 历史 https://cssstudio.app/ops/crosstalk-history.json(保留最近 120 次)

## 两条判据上的坑(都是踩过的)

1. **只能看 `last_seen`,不能看 `count`。** `error_reports.count` 是累计的,
   串台指纹自 2026-07-27 就存在,看累计永远几百上千,分不清修没修好。
2. **「有没有流量」必须按水位线之后算,不能按近 24 小时。**
   24 小时里的报错大半发生在修复【之前】,拿它当有流量的证据,
   会把【没人用】误判成【修好了】—— 第一版正是这么把 `no_traffic` 判成了 `clean`。

## 落盘位置

权威副本写 `/srv/cssos/shared/public/ops/`,同时拷一份到**真正被服务的**
`/srv/cssos/current/public/ops/`(实测 shared 那份对外是 404)。
**不做软链** —— deploy.sh 的 `--exclude 'fonts/'` 带尾斜杠挡不住符号链接,
字体就是这么每次部署被删的,不重蹈覆辙。前端部署会冲掉 current 里那两个文件,
下一次巡检自动补回;代价是部署后最多一天读到旧值,换零部署风险。
