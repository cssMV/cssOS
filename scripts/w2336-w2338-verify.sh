#!/usr/bin/env bash
# W2336 / W2337 / W2338 上线后的一次性实测 —— api-vm 恢复之后跑这一条就够。
#
# 为什么要有这个脚本: 这三波都是【改完了但线上没验过】的状态(2026-11-16~17 api-vm
# 两个口都不通, 部署不了)。VM 回来之后不该靠记忆重新推导验证顺序, 尤其 W2337 会花真钱。
#
# 顺序是刻意的:
#   1. 部署(deploy-express.sh 自带 typecheck 闸, 不过不发)
#   2. 免费的先验: 子部到底带上 cover_slides / visual_kind / visual_frames / available_langs 了没
#   3. 存量轨 status 回填(先干跑看会改什么)
#   4. 真视频【只报价】—— 看清要花多少积分、够不够, 再由 Jing 决定要不要真跑
# 第 4 步【不会生成任何东西】。真跑是去掉 dry=1, 那一步故意留给人。
#
# 判据必须把【没达成】和【我没查到】分开(平台教训: 轮询器把 API 报错渲染成"还没出现",
# 空转 30 分钟)。所以每一项要么打 ✅/❌, 要么明确打「查不到 —— 不是通过」。
#
#   bash scripts/w2336-w2338-verify.sh                  # 全套(含部署)
#   SKIP_DEPLOY=1 bash scripts/w2336-w2338-verify.sh    # 只验, 不部署
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${API:-https://cssstudio.app}"
TITLE="${TITLE:-花の色は}"

hr() { printf '\n── %s %s\n' "$1" "$(printf '─%.0s' $(seq 1 $((60 - ${#1}))))"; }

hr "0. api-vm 通不通"
if ! curl -s -o /dev/null -m 12 "$API/api/health"; then
  echo "❌ $API 还是不通 —— 先把 VM 弄回来, 这个脚本后面每一步都要它。"
  echo "   (GCP Console → Compute Engine → api-vm: 看它是不是停了, 或者重启后换了临时 IP)"
  exit 1
fi
echo "✅ 通"

if [ "${SKIP_DEPLOY:-0}" != "1" ]; then
  hr "1. 部署(自带 typecheck 闸)"
  bash scripts/deploy-express.sh || { echo "❌ 部署失败 —— 线上仍是上一版, 后面的验证没有意义。"; exit 1; }
fi

hr "2. 子部的几列(免费, W2336 + W2338)"
ROOT=$(bash scripts/db.sh "SELECT id::text FROM user_works WHERE title='$TITLE' AND structure_role='root' LIMIT 1" 2>/dev/null \
        | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -z "$ROOT" ]; then
  echo "⚠ 查不到《$TITLE》的 root —— 【不是通过】, 是没查到。换 TITLE= 指定别的多部作品再跑。"
else
  echo "root = $ROOT"
  curl -s -m 30 "$API/api/works/market?q=$ROOT&limit=1" > /tmp/_w2336.json
  python3 -I - <<'PY'
import json, sys
try:
    d = json.load(open("/tmp/_w2336.json"))
except Exception as e:
    print(f"⚠ 响应不是 JSON({e}) —— 不是通过, 是没查到"); raise SystemExit(0)
works = d.get("works") or d.get("resolved") or []
def walk(n, out):
    out.append(n)
    for c in (n.get("children") or []): walk(c, out)
flat = []
for w in works: walk(w, flat)
leaves = [n for n in flat if str(n.get("structure_role") or "") in ("scene", "part", "episode")]
if not leaves:
    print(f"⚠ 响应里一个叶子都没有(共 {len(flat)} 个节点)—— 不是通过, 是没查到"); raise SystemExit(0)
print(f"叶子 {len(leaves)} 个。逐列看【有多少个叶子带上了】:")
def count(key, pred):
    n = sum(1 for l in leaves if pred(l.get(key)))
    mark = "✅" if n == len(leaves) else ("⚠" if n else "❌")
    print(f"  {mark} {key:<16} {n}/{len(leaves)}")
    return n == len(leaves)
allok = True
allok &= count("cover_slides",    lambda v: isinstance(v, list) and len(v) > 0)
allok &= count("visual_kind",     lambda v: bool(v))
allok &= count("visual_frames",   lambda v: v not in (None, "", 0, "0"))
allok &= count("available_langs", lambda v: isinstance(v, list) and len(v) > 0)
# cover_slides 全是【同一个 URL】= 其实还是退回了单张封面, 只是形状对了。
multi = sum(1 for l in leaves if isinstance(l.get("cover_slides"), list) and len(set(l["cover_slides"])) > 1)
print(f"  {'✅' if multi == len(leaves) else '⚠'} 帧数 > 1 的叶子    {multi}/{len(leaves)}"
      "   ← 全是同一个 URL 就等于还在放单张封面, 形状对了也不算好")
print("\n" + ("✅ 子部四列齐" if allok else "❌ 还有列没带上 —— 看上面哪一行是 ❌/⚠"))
PY
fi

hr "3. 存量轨 status 回填(干跑, 不改任何东西)"
bash scripts/w2338-backfill-track-status.sh || echo "⚠ 干跑本身出错 —— 不是通过"

hr "3.5 真视频那条 ffmpeg 滤镜(在花钱之前先验它)"
# 为什么单独验: 滤镜串写错的话, 每一次真视频渲染都会在 ffmpeg 这一步失败,
# 然后【安静地降成幻灯】—— 钱已经花在 4 个镜头上了, 屏幕上却看不出哪里不对。
# 本机没有 ffmpeg(api-vm 有), 所以这一步必须在远端跑。
# 滤镜串【从源码里取】, 不在这里另抄一份 —— 抄一份就会漂。
VF=$(grep -oE "crop='min\(iw[^\"]*format=yuv420p" src/index.ts | head -1)
if [ -z "$VF" ]; then
  echo "⚠ 从 src/index.ts 里取不到滤镜串 —— 【不是通过】, 是没查到(源码变了就改这条 grep)"
else
  echo "滤镜: $VF"
  # 拿一个 16:9 的源跑一遍: 裁出来应当恰好 21:9, 且宽度不超过 2520、也没被往上拉。
  ssh api-vm "ffmpeg -y -loglevel error -f lavfi -i 'testsrc=s=1920x1080:d=1:r=25' \
      -vf \"$VF\" -c:v libx264 -preset ultrafast -an /tmp/_vf.mp4 \
    && ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 /tmp/_vf.mp4" \
    > /tmp/_vf.txt 2>/tmp/_vf.err
  WH=$(tr -d ' \r' < /tmp/_vf.txt | tail -1)
  if [ -z "$WH" ]; then
    echo "❌ ffmpeg 跑不过 —— 这条滤镜是坏的, 真视频会每次都静默降幻灯。stderr:"
    head -4 /tmp/_vf.err | sed 's/^/     /'
  else
    W=${WH%%,*}; H=${WH##*,}
    RATIO=$(python3 -I -c "print(round($W/$H, 4))" 2>/dev/null)
    echo "  输出 ${W}×${H}  比例 $RATIO  (21:9 = 2.3333)"
    [ "$W" -le 2520 ] && echo "  ✅ 宽度没超 2520" || echo "  ❌ 宽度超了"
    [ "$W" -le 1920 ] && echo "  ✅ 没有往上拉(源宽 1920)" || echo "  ❌ 被上拉了 —— 放大不增细节, 只增字节"
    case "$RATIO" in 2.33*) echo "  ✅ 恰好 21:9";; *) echo "  ❌ 不是 21:9 —— 画幅铁律";; esac
  fi
fi

hr "4. 真视频【只报价】(W2337, 不生成任何东西)"
TOK=$(ssh api-vm 'sudo grep -E "^CSSOS_ADMIN_TOKEN=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d "\""' 2>/dev/null)
if [ -z "$TOK" ] || [ -z "${ROOT:-}" ]; then
  echo "⚠ 拿不到 admin token 或 root —— 【不是通过】, 是没查到。"
else
  # ⚠ 报价这段用 heredoc, 不用 python3 -c '...':
  #   f-string 的表达式里不许出现反斜杠(3.12 以前直接语法错), 而塞在 bash 单引号里的
  #   内层双引号必须转义 —— 两条规矩对撞。写成 heredoc 就没有这个问题。
  curl -s -m 40 -X POST "$API/api/admin/real-mv/$ROOT?root=1&dry=1" \
       -H "x-admin-token: $TOK" > /tmp/_w2337q.json
  python3 -I - <<'PY'
import json
try:
    d = json.load(open("/tmp/_w2337q.json"))
except Exception as e:
    print(f"  ⚠ 报价响应不是 JSON({e}) —— 不是通过, 是没查到"); raise SystemExit(0)
if not d.get("ok"):
    print("  ⚠ 报价失败:", str(d)[:200], "—— 不是通过"); raise SystemExit(0)
q = d.get("quote") or {}
rows = [
    ("引擎",     q.get("engine")),
    ("目标叶子", f'{q.get("targets")} × {q.get("shots_each")} 镜 × {q.get("shot_secs")}s'),
    ("需要积分", f'{q.get("kie_credits_needed")}   (另留 reserve {q.get("kie_reserve")})'),
    ("当前积分", q.get("kie_credits_now")),
    ("够不够",   "✅ 够" if q.get("kie_affordable") else "❌ 不够 → 会降幻灯"),
    ("我方成本", q.get("worst_case_usd")),
]
for k, v in rows:
    print(f"  {k:<10} {v}")
PY
  echo
  echo "  真跑是【去掉 dry=1】。先只在一个场上跑, 看一眼画面再谈整部:"
  echo "    curl -X POST \"$API/api/admin/real-mv/<一个场的 workId>\" -H \"x-admin-token: \$TOK\""
fi

hr "完" ""
echo "没验到的东西一律当【没验到】, 不要当通过。"
