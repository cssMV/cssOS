#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# W2119 · 还原演练 —— 【没还原过的备份不算备份】
#
# 拿 R2 上最新那份备份, 完整还原进一个【临时库】, 再逐表把行数和生产库比对。
# 比对不上就退出码非零。
#
# 只碰自己建的临时库 cssstudio_restoretest_<ts>, 一个字节都不碰 cssstudio。
# 跑完删掉那个临时库 —— 那是本脚本自己造的, 不是任何人的数据。
#
# 用法: sudo /usr/local/bin/db-restore-test.sh [备份文件在R2上的路径]
#       不给路径就用 LAST_OK.json 指的那一份。
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PGHOST=127.0.0.1; PGPORT=5432; PGUSER=cssstudio; PGDB=cssstudio
PGBIN=/usr/lib/postgresql/15/bin
R2_DEST="r2:cssos-artifacts/backups/db"
CRED=/etc/cssos-db-backup.env
export RCLONE_CONFIG="${RCLONE_CONFIG:-/home/jing/.config/rclone/rclone.conf}"

log() { echo "[restore-test $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[restore-test] ❌ $*" >&2; exit 1; }

[ -r "$CRED" ] || fail "读不到 $CRED"; . "$CRED"; export PGPASSWORD
WORK=$(mktemp -d /var/tmp/restoretest.XXXXXX)
TESTDB="cssstudio_restoretest_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  # 临时库一定要收掉, 不然它会一直占着实例的磁盘
  psql -h $PGHOST -U $PGUSER -d postgres -q -c "DROP DATABASE IF EXISTS $TESTDB;" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

SRC="${1:-}"
if [ -z "$SRC" ]; then
  LAST=$(rclone cat "$R2_DEST/LAST_OK.json" 2>/dev/null || true)
  [ -n "$LAST" ] || fail "R2 上没有 LAST_OK.json, 也没给路径"
  F=$(echo "$LAST" | sed -E 's/.*"file":"([^"]+)".*/\1/')
  YM=$(echo "$F" | sed -E 's/cssstudio-([0-9]{4})([0-9]{2}).*/\1\/\2/')
  SRC="$R2_DEST/$YM/$F"
fi
log "取备份 $SRC"
rclone copyto "$SRC" "$WORK/b.pgc" || fail "下载失败"
log "下载 $(( $(stat -c%s "$WORK/b.pgc") / 1024 / 1024 )) MB"

log "建临时库 $TESTDB"
psql -h $PGHOST -U $PGUSER -d postgres -q -c "CREATE DATABASE $TESTDB;" || fail "建库失败"

log "完整还原(这一步就是在证明这份备份真的能用)"
# -j4 并行; 忽略 owner/acl 差异带来的噪音警告, 但真错误会让 pg_restore 非零退出
"$PGBIN/pg_restore" -h $PGHOST -U $PGUSER -d "$TESTDB" \
  --no-owner --no-acl --jobs=4 "$WORK/b.pgc" > "$WORK/restore.log" 2>&1 \
  || { tail -20 "$WORK/restore.log"; fail "pg_restore 报错"; }
log "还原完成"

# ── 逐表比对行数 ────────────────────────────────────────────────────────
# 只比对【备份之后没再写过】的风险是存在的: 生产库一直在写, 行数可能已经多了。
# 所以判据是【还原库 <= 生产库 且 差距 < 1%】, 而不是严格相等 —— 严格相等
# 在一个活着的库上必然误报, 那种校验器是自欺欺人。
TABLES="user_works work_language_tracks work_media_versions work_assets work_market_profiles users"
BAD=0; CHECKED=0
printf "\n%-26s %12s %12s %8s\n" "表" "生产库" "还原库" "判定"
for t in $TABLES; do
  LIVE=$(psql -h $PGHOST -U $PGUSER -d $PGDB   -At -c "SELECT count(*) FROM $t;" 2>/dev/null || echo "-")
  REST=$(psql -h $PGHOST -U $PGUSER -d $TESTDB -At -c "SELECT count(*) FROM $t;" 2>/dev/null || echo "-")
  CHECKED=$((CHECKED+1))
  if [ "$LIVE" = "-" ] || [ "$REST" = "-" ]; then
    printf "%-26s %12s %12s %8s\n" "$t" "$LIVE" "$REST" "❌读不到"; BAD=$((BAD+1)); continue
  fi
  if [ "$REST" -eq 0 ] && [ "$LIVE" -gt 0 ]; then
    printf "%-26s %12s %12s %8s\n" "$t" "$LIVE" "$REST" "❌空的"; BAD=$((BAD+1)); continue
  fi
  DIFF=$(( LIVE - REST )); [ $DIFF -lt 0 ] && DIFF=$(( -DIFF ))
  TOL=$(( LIVE / 100 + 1 ))
  if [ "$DIFF" -le "$TOL" ]; then
    printf "%-26s %12s %12s %8s\n" "$t" "$LIVE" "$REST" "✅"
  else
    printf "%-26s %12s %12s %8s\n" "$t" "$LIVE" "$REST" "❌差太多"; BAD=$((BAD+1))
  fi
done

echo
echo "清单 $(echo $TABLES | wc -w) 张表, 实际比对 $CHECKED 张"   # 校验器自报自己的覆盖面
[ "$BAD" -eq 0 ] || fail "$BAD 张表对不上 —— 这份备份不可信"
log "✅ 还原演练通过: 备份能完整还原, 关键表行数与生产库一致"
