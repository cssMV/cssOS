#!/usr/bin/env bash
# W2288 —— 守着 KIE 余额, 一到就开跑剩下那批占位音作品。
#
# Jing 2026-11-09:「请接着跑那 42 首。」—— 手写补足之后实际是 73 首(见 manifest)。
# 但 2026-11-09 19:45 余额归零(实测 -1.38), 而充值只在 Jing 一处。
# 所以这个脚本的全部职责是: 等钱到, 然后把批次按既有流程跑起来, 不多做一件事。
#
# 为什么要守候进程而不是我手动再来一次: 钱什么时候到我不知道, 而批次本身
# 已经有完整的闸门(歌词完整度 / W2278 / W2280 / 余额 / 备份 / 失败还原)。
# 等待是唯一缺的那一环。
#
# 刹车在【余额】上, 不在这里: 批次脚本每一次花钱之前都会查一次余额(W2286),
# 低于 KIE_FLOOR 就停整批并还原当前这首。所以 Jing 充多少, 就做多少, 然后干净停住。
# 一首约 2 credit(= $1.99)。73 首全做完约需 146 credit。
#
# 用法(在 api-vm 上):
#   nohup bash w2288-launch-when-funded.sh /tmp/w2285/manifest-73.tsv > /tmp/w2288-waiter.log 2>&1 &
# 停它:  pkill -f 'w2288-launch-when[-]funded'
set -u
MAN=${1:?用法: w2288-launch-when-funded.sh <manifest.tsv>}
FLOOR=${KIE_FLOOR:-6}            # 够做 3 首才开跑, 免得开起来就撞墙
EVERY=${EVERY:-600}              # 每 10 分钟问一次(免费端点, 但没必要更频)
MAXH=${MAXH:-336}                # 最多守 14 天, 到点就退出并说清是【我没等到】

[ -f "$MAN" ] || { echo "FAIL 清单不在: $MAN"; exit 1; }
n=$(grep -cve '^[[:space:]]*$' -e '^#' "$MAN")
echo "===== W2288 守候开始 $(date -u +%FT%TZ) ====="
echo "清单 $n 首 · 开跑下限 $FLOOR credit · 每 ${EVERY}s 问一次 · 最多守 ${MAXH}h"

credit() {
  local key json code
  key=$(grep -m1 '^KIE_API_KEY=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
  [ -n "$key" ] || { echo NOKEY; return; }
  json=$(curl -s -m 20 -H "Authorization: Bearer $key" https://api.kie.ai/api/v1/chat/credit)
  code=$(printf '%s' "$json" | sed -n 's/.*"code":[[:space:]]*\([0-9-]*\).*/\1/p')
  # 【查不到】和【没钱】不是一回事 —— 查不到就继续等, 绝不当成「有钱了」去开跑
  [ "$code" = "200" ] || { echo "ERR"; return; }
  printf '%s' "$json" | sed -n 's/.*"data":[[:space:]]*\(-\?[0-9.]*\).*/\1/p'
}

rounds=$(( MAXH * 3600 / EVERY ))
for i in $(seq 1 "$rounds"); do
  c=$(credit)
  case "$c" in
    ''|NOKEY|ERR)
      echo "[$(date -u +%H:%M:%S)] 余额查不到($c) —— 继续等(这是【我没查到】, 不是【有钱了】)"
      sleep "$EVERY"; continue;;
  esac
  if awk -v c="$c" -v f="$FLOOR" 'BEGIN{exit !(c+0 >= f+0)}'; then
    echo "[$(date -u +%H:%M:%S)] 余额 $c >= $FLOOR —— 开跑"
    cd /tmp/w2281 || exit 1
    KIE_FLOOR=3 bash w2285-replace-placeholder-music.sh "$MAN" --apply
    rc=$?
    echo "===== 批次结束 rc=$rc $(date -u +%FT%TZ) ====="
    exit "$rc"
  fi
  # 每小时打一行就够, 别把日志刷满
  [ $(( i % 6 )) -eq 1 ] && echo "[$(date -u +%H:%M:%S)] 余额 $c < $FLOOR —— 还在等充值"
  sleep "$EVERY"
done
echo "守了 ${MAXH} 小时余额还没到 —— 这是【我没等到】, 不是【它失败了】。清单原样留着, 随时可重跑。"
exit 2
