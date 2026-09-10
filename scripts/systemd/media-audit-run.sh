#!/usr/bin/env bash
# W2086 —— 巡检包装: 报告落固定路径, 摘要进 journald, 退出码透传(1 = 发现风险)
OUT=/srv/cssos/media-audit.last.txt
/srv/cssos/bin/audit-media-overwrite-risk.sh > "$OUT" 2>&1
rc=$?
tail -n 20 "$OUT"
exit $rc
