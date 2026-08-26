#!/usr/bin/env bash
# CSSOS_WAVE_1907 20260824 — Jing:「给我一个数据库接口, 我自己进去看看。」
#
# 用法:
#   bash scripts/db.sh                    交互式 psql(直接敲 SQL)
#   bash scripts/db.sh "SELECT 1"         跑一句就退
#   bash scripts/db.sh -f 某文件.sql       跑一个文件
#
# 密码不写在这里 —— 从 api-vm 的 /etc/cssos.env 现取, 避免又多一处要维护的口令。
set -euo pipefail
HOST="${CSSOS_DB_HOST:-api-vm}"

if [ $# -eq 0 ]; then
  echo "── cssos 数据库 (只读建议: 先 BEGIN; 再 ROLLBACK;) ──"
  echo "常用:"
  echo "  \\dt            列出所有表"
  echo "  \\d user_works  看 user_works 的全部字段"
  echo "  \\q             退出"
  echo
  ssh -t "$HOST" 'DBU=$(sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d "\"") ; psql "$DBU"'
elif [ "$1" = "-f" ]; then
  scp -q "$2" "$HOST:/tmp/_dbq.sql"
  ssh "$HOST" 'DBU=$(sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d "\"") ; psql "$DBU" -f /tmp/_dbq.sql'
else
  ssh "$HOST" "DBU=\$(sudo grep -E '^DATABASE_URL=' /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '\"') ; psql \"\$DBU\" -c \"$1\""
fi
