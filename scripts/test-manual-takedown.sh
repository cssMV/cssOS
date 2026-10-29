#!/bin/bash
# CSSOS_WAVE_2255 回归: 人工下架必须扛得住 foryou-reconcile 自愈。
# CALIBRATE=1 读本波之前那一版, 必须全红。
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
no(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }

SRC=src/index.ts
if [ "${CALIBRATE:-0}" = "1" ]; then
  BASE=$(git log --diff-filter=A --format=%H -- migrations/127_manual_takedown.sql | tail -1)
  BASE=${BASE:+$BASE^}; BASE=${BASE:-HEAD}
  echo "== CALIBRATE: 读 $BASE, 期望全红 =="
  T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
  git show "$BASE:src/index.ts" > "$T/index.ts" 2>/dev/null || { echo "取不到 $BASE"; exit 2; }
  SRC="$T/index.ts"
fi

echo "== ① 自愈 SQL 必须跳过人工下架 =="
# 判据取【那条 UPDATE 语句本身】而不是全文搜关键字 —— 全文搜会被注释里的同名词骗过。
if awk '/UPDATE work_market_profiles mp/,/`,/' "$SRC" | grep -q "manual_takedown_at IS NULL"; then
  ok "reconcile 的 UPDATE 带 manual_takedown_at IS NULL"
else
  no "reconcile 会把人工下架翻回 public(下架活不过 10 分钟)"
fi

echo "== ② 开机自愈块必须建这一列 =="
if grep -q "ADD COLUMN IF NOT EXISTS manual_takedown_at" "$SRC"; then
  ok "开机会补建 manual_takedown_at"
else
  no "新库不会有这一列 → 自愈 SQL 直接报错, 整个 reconcile 停摆"
fi

echo "== ③ 线上实测(需要能连 api-vm; 连不上则跳过而不是假绿) =="
if [ "${CALIBRATE:-0}" = "1" ]; then
  echo "  (校准模式不跑线上)"
elif timeout 25 ssh -o ConnectTimeout=10 -o BatchMode=yes api-vm true 2>/dev/null; then
  N=$(timeout 60 ssh api-vm "URL=\$(grep -o 'DATABASE_URL=[^ ]*' /etc/cssos.env | head -1 | cut -d= -f2-); psql \"\$URL\" -tAc \"SELECT count(*) FROM work_market_profiles WHERE manual_takedown_at IS NOT NULL AND visibility<>'private'\"" 2>/dev/null | tr -d ' ')
  if [ -z "$N" ]; then
    echo "  ⚠️  查不到结果 —— 这一条【没测成】, 不计入通过"
  elif [ "$N" = "0" ]; then ok "线上没有「标了人工下架却还公开」的作品"
  else no "线上有 $N 个作品标了人工下架却仍是 public"; fi
else
  echo "  ⚠️  连不上 api-vm —— 这一条【没测成】, 不计入通过(不是通过)"
fi

echo; echo "通过 $PASS · 失败 $FAIL"
if [ "${CALIBRATE:-0}" = "1" ]; then
  [ "$FAIL" -gt 0 ] && { echo "校准正确: 旧码被判红"; exit 0; } || { echo "❌ 校准失败: 旧码全绿, 判据是假的"; exit 1; }
fi
[ "$FAIL" -eq 0 ]
