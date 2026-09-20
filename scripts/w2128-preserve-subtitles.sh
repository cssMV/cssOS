#!/usr/bin/env bash
# W2128 · 重做字幕【之前】必须先跑这个: 把旧字幕字节另存到自己的地址。
#
# 为什么非做不可: 字幕的 R2 key 是写死的固定名 works/<id>/subtitle-take1.json ——
# 平台里唯一还没迁到内容哈希的一处(CLAUDE.md 已记)。重做就是原地覆盖,
# 而 R2 是 Unversioned, 覆盖掉的字节【找不回来】。W2061 丢掉 17 首音乐就是这么丢的:
# 库里留了记录, 但新旧指向同一个 key, 记录留住了字节没留住。
#
# 做法: 旧字节 → works/<id>/subtitle-take1-pre-w2128.json (目标已存在就跳过, 绝不二次覆盖)
#       并登记进 w2128_subtitle_backup, 让旧版有据可查、将来能进胶囊轨道。
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
LIST="${1:?用法: $0 <ids.txt>}"
BUCKET="r2:cssos-artifacts"
: > /tmp/w2128-preserved.tsv

psql -h 127.0.0.1 -U cssstudio -d cssstudio -q -c "
CREATE TABLE IF NOT EXISTS w2128_subtitle_backup (
  work_id      uuid PRIMARY KEY,
  old_url      text NOT NULL,
  old_bytes    bigint NOT NULL,
  preserved_at timestamptz NOT NULL DEFAULT now()
);"

n=0; done_=0; already=0; miss=0
while read -r id <&3; do
  [ -z "${id:-}" ] && continue
  n=$((n+1))
  src="works/$id/subtitle-take1.json"
  dst="works/$id/subtitle-take1-pre-w2128.json"
  ssz=$(rclone size --json "$BUCKET/$src" 2>/dev/null | grep -oE '"bytes":[0-9]+' | cut -d: -f2)
  if [ -z "${ssz:-}" ] || [ "$ssz" = "0" ]; then
    echo "⚠ [$n] 源不存在, 跳过(不会去重做它) $id"; miss=$((miss+1)); continue
  fi
  dsz=$(rclone size --json "$BUCKET/$dst" 2>/dev/null | grep -oE '"bytes":[0-9]+' | cut -d: -f2)
  if [ -n "${dsz:-}" ] && [ "$dsz" != "0" ]; then
    already=$((already+1))
  else
    rclone copyto "$BUCKET/$src" "$BUCKET/$dst" 2>&1 | grep -v '^$' || true
    dsz=$(rclone size --json "$BUCKET/$dst" 2>/dev/null | grep -oE '"bytes":[0-9]+' | cut -d: -f2)
  fi
  # 字节数必须一致 —— 不一致就不算保住, 这首不许进重做清单
  if [ "${dsz:-0}" != "$ssz" ]; then
    echo "❌ [$n] 另存后字节对不上 (源 $ssz / 备 ${dsz:-0}) $id"; miss=$((miss+1)); continue
  fi
  psql -h 127.0.0.1 -U cssstudio -d cssstudio -q -c \
    "INSERT INTO w2128_subtitle_backup (work_id, old_url, old_bytes)
     VALUES ('$id'::uuid, 'https://cdn.cssstudio.app/$dst', $ssz)
     ON CONFLICT (work_id) DO NOTHING;"
  printf '%s\n' "$id" >> /tmp/w2128-preserved.tsv
  done_=$((done_+1))
  [ $((n % 20)) -eq 0 ] && echo "  …已处理 $n"
done 3< "$LIST"

echo
echo "=== 旧字幕另存: 清单 $n 首, 实际处理 $n 首 ==="
echo "  已另存(含本次+先前) $done_ 首 · 其中先前已存在 $already 首 · 未能保住 $miss 首"
echo "  可安全重做的清单: /tmp/w2128-preserved.tsv ($(wc -l < /tmp/w2128-preserved.tsv) 首)"
psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c "SELECT '库内登记: '||count(*)||' 首' FROM w2128_subtitle_backup;"
