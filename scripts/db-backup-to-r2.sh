#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# W2119 · 数据库逻辑备份 → R2  (2026-09-20)
#
# 为什么需要它 —— Cloud SQL 自己是有备份的, 但有三个缺口:
#
#   1. 【只保 7 天】。而 W2061 那 17 首旧版音乐, 是【两周多之后】才被 Jing
#      逐首发现的。我们的「发现延迟」比 Cloud SQL 的保留期长 ——
#      等发现的时候, 那一周的备份早就滚没了。这是补这条的首要理由。
#   2. 【跟实例同生共死】。删实例即删备份; 项目/账号出事, 备份一起没。
#   3. 【只能还原成 Cloud SQL 实例】。不能 grep, 不能单独捞一张表回来看。
#
# 所以这里做的是【逻辑 dump】: 换一家厂商(R2)、长期保留、任何地方都能还原,
# 而且 pg_restore -t 可以只捞一张表。它【补充】Cloud SQL 的 7 天时点恢复, 不替代。
#
# 命名遵循平台铁律: 时间戳 + 内容哈希。同一份内容写回同一个地址(幂等),
# 不同内容必然不同地址 —— 结构上不可能覆盖掉昨天的备份。
#
# 不删任何东西。保留策略留空, 让它长。增长速度见文件末尾注释。
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PGHOST=127.0.0.1
PGPORT=5432
PGUSER=cssstudio
PGDB=cssstudio
PGBIN=/usr/lib/postgresql/15/bin          # 必须是 15 —— 服务端 15.18, 14 的 pg_dump 会直接拒绝
R2_DEST="r2:cssos-artifacts/backups/db"
TMPDIR_BASE=/var/tmp
CRED=/etc/cssos-db-backup.env             # 只含 PGPASSWORD, 0600 root:root, 不进仓库
# rclone 的 R2 凭据在 jing 用户下; 本脚本以 root 跑定时任务, 必须显式指过去,
# 否则 root 读不到任何 remote, 报 "didn't find section in config file (r2)"。
export RCLONE_CONFIG="${RCLONE_CONFIG:-/home/jing/.config/rclone/rclone.conf}"

log() { echo "[db-backup $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[db-backup] ❌ $*" >&2; exit 1; }

[ -r "$CRED" ] || fail "读不到凭据 $CRED"
# shellcheck disable=SC1090
. "$CRED"
[ -n "${PGPASSWORD:-}" ] || fail "$CRED 里没有 PGPASSWORD"
export PGPASSWORD

[ -x "$PGBIN/pg_dump" ] || fail "缺 $PGBIN/pg_dump(装 postgresql-client-15)"

TS=$(date -u +%Y%m%dT%H%M%SZ)
WORK=$(mktemp -d "$TMPDIR_BASE/dbbak.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
RAW="$WORK/dump.pgc"

log "开始 pg_dump(-Fc 自定义格式, 支持 pg_restore -t 单表还原)"
"$PGBIN/pg_dump" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" \
  --format=custom --compress=9 --no-owner --no-acl --file="$RAW" \
  || fail "pg_dump 失败"

BYTES=$(stat -c%s "$RAW")
[ "$BYTES" -gt 1000000 ] || fail "dump 只有 $BYTES 字节, 太小了, 一定不对 —— 不上传"
log "dump 完成 $((BYTES/1024/1024)) MB"

# ── 自检 1: 归档结构完整吗 ──────────────────────────────────────────────
# 截断/损坏的 dump 在这里就现形, 绝不把坏备份传上去当成「有备份」。
#
# 清单【只取一次落盘】, 后面对文件 grep, 不要写成 `pg_restore --list | grep -q`:
# grep -q 一匹配到就退出并关闭管道 → 上游 pg_restore 收 SIGPIPE 非零退出 →
# set -o pipefail 把整条管道判成失败 → 【匹配成功反而报失败】。
# 第一次跑就栽在这上面, 记下来别再犯。
LIST="$WORK/list.txt"
"$PGBIN/pg_restore" --list "$RAW" > "$LIST" 2>/dev/null || fail "pg_restore --list 读不动归档"
NOBJ=$(grep -cE '^[0-9]+;' "$LIST" || true)
[ "${NOBJ:-0}" -gt 100 ] || fail "pg_restore --list 只数出 $NOBJ 个对象, 归档可疑 —— 不上传"

# ── 自检 2: 每张表都要有【数据段】, 不能只有建表语句 ────────────────────
# 「建表条目数 = 数据条目数」是整库没漏表的硬判据; 再单独点名四张最要紧的。
NTAB=$(grep -c " TABLE public " "$LIST" || true)
NDAT=$(grep -c " TABLE DATA public " "$LIST" || true)
[ "$NTAB" = "$NDAT" ] || fail "建表 $NTAB 张但数据段只有 $NDAT 段 —— 有表没备到, 不上传"
for t in user_works work_language_tracks work_media_versions work_assets; do
  grep -q " TABLE DATA public $t " "$LIST" || fail "归档里没有 $t 的数据段 —— 不上传"
done
log "自检: 归档可读, $NOBJ 个对象 / $NTAB 张表都带数据段 / 四张关键表点名核对通过"

SHA=$(sha256sum "$RAW" | cut -c1-12)
NAME="cssstudio-${TS}-${SHA}.pgc"
DEST="$R2_DEST/$(date -u +%Y/%m)/$NAME"

[ -r "$RCLONE_CONFIG" ] || fail "读不到 rclone 配置 $RCLONE_CONFIG"
log "上传 → $DEST"
# 不要写成 `rclone ... | tail`: 管道会把 rclone 的退出码藏起来(pipefail 下也只看最后一段),
# 上传失败会被当成成功继续往下走 —— 那就又是一个「以为有备份」。
rclone copyto "$RAW" "$DEST" --s3-no-check-bucket || fail "rclone 上传失败"

# ── 自检 3: 传上去的字节数对不对 ────────────────────────────────────────
REMOTE=$(rclone size "$DEST" --json 2>/dev/null | sed -E 's/.*"bytes":([0-9]+).*/\1/')
[ "$REMOTE" = "$BYTES" ] || fail "远端 $REMOTE 字节 ≠ 本地 $BYTES 字节 —— 上传不完整"
log "✅ 完成 $NAME ($((BYTES/1024/1024)) MB), 远端字节数一致"

# 心跳: 写一个固定地址的小文件, 好让「备份悄悄停了」这件事能被发现。
# (W2061 的教训之一就是: 没有巡检, 坏了两周没人知道。)
printf '{"last_ok":"%s","file":"%s","bytes":%s}\n' "$TS" "$NAME" "$BYTES" \
  | rclone rcat "$R2_DEST/LAST_OK.json" --s3-no-check-bucket 2>/dev/null || true

# ── 保留策略: 【没有】。一个都不删。 ────────────────────────────────────
# 实测 379 MB 的库压出来约 60-90 MB, 每天一份 ≈ 每年 25-33 GB,
# R2 存储费约 $0.015/GB/月 → 一年的备份约 $0.4-0.5/月。便宜到不值得为省钱冒删错的险。
# 真要加保留期, 先问 Jing —— 删备份也是删。
