#!/bin/bash
# CSSOS_WAVE_2251 — tvOS i18n 回归。
#
# CALIBRATE=1 时改读 git HEAD 的旧版源码, **必须整体失败** —— 一个查不出问题的校验器
# 比没有校验器更坏(它发的是假绿灯)。改判据后请先跑一次校准。
#
# 判据四条:
#   ① 用户可见字面量必须包 tr()      ② 可见文案里不许有硬编码中文
#   ③ 每条 tr("字面量") 都在 uiStrings 清单里   ④ 字典拿不到时回退英文(不留空白)
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
no(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }

SRC=$(mktemp -d); trap 'rm -rf "$SRC"' EXIT
if [ "${CALIBRATE:-0}" = "1" ]; then
  # 基准必须是【本波改动之前】那一版, 不能用 HEAD —— 本波一提交, HEAD 就含 I18n.swift 了,
  # 再拿 HEAD 校准等于拿新码校新码, 校出来是假的(第一次就这么翻车)。
  BASE=$(git log --diff-filter=A --format=%H -- tvos/cssTV/I18n.swift | tail -1)
  BASE=${BASE:+$BASE^}; BASE=${BASE:-HEAD}
  echo "== CALIBRATE: 读 $BASE (i18n 之前那一版), 期望【全红】 =="
  git archive "$BASE" tvos/cssTV 2>/dev/null | tar -x -C "$SRC" || { echo "取 $BASE 失败"; exit 2; }
  D="$SRC/tvos/cssTV"
else
  D="tvos/cssTV"
fi
[ -d "$D" ] || { echo "源码目录不存在: $D"; exit 2; }

ZHCHK="$SRC/zhcheck.py"
cat > "$ZHCHK" <<'ZPY'
import re, sys, pathlib
hits = []
for f in pathlib.Path(sys.argv[1]).glob("*.swift"):
    for m in re.finditer(r'(Text|Button|Label|TextField)\(\s*(?:tr\()?"([^"]*)"', f.read_text()):
        if re.search(r'[\u4e00-\u9fff]', m.group(2)):
            hits.append(f"{f.name}: {m.group(0)[:70]}")
print("\n".join(sorted(set(hits))))
ZPY

echo "== ① 用户可见字面量必须包 tr() =="
# 裸字面量 = Text("…")/Button("…")/Label("…")/TextField("…") 里直接跟引号的。
# 白名单: 纯 emoji / 单个符号 / URL / SF Symbol 名 —— 这些翻译了反而坏。
# 判据 ① 交给 scripts/tv-i18n-scan.py。
# 【为什么不内联】第一版内联判据只认「紧跟在 Text( 后面的字面量」, 三元表达式、
# 计算属性、status 变量全漏 —— 实测漏了近一半(85 → 158), 而它照样报绿。
# 现在反过来: 所有含字母的串都当嫌疑, 结构化排除后剩下的必须显式登记。
BARE=$(python3 "$ROOT/scripts/tv-i18n-scan.py" "$D" 2>&1 | grep -vE '^$|未包 tr')
if [ -z "$BARE" ]; then ok "没有裸字面量"
else no "还有 $(echo "$BARE" | wc -l | tr -d ' ') 条没包 tr():"; echo "$BARE" | sed 's/^/       /' | head -12; fi

echo "== ② 可见文案里不许硬编码中文 =="
# 只看会上屏的构造, 不看注释 / print 调试 / 发给 LLM 的 gaze 提示词 / 作品标题。
# 用 python 按真 Unicode 区间判: grep -E 的 [一-龥] 在 macOS 上是【按字节】匹配, 会把
# · … — 这些多字节符号误判成中文(第一次校准就假报了 4 条)。假阳性和漏报一样坏。
ZH=$(python3 "$ZHCHK" "$D")
if [ -z "$ZH" ]; then ok "可见文案零中文硬编码"
else no "$(echo "$ZH" | wc -l | tr -d ' ') 条可见中文:"; echo "$ZH" | sed 's/^/       /' | head -10; fi

echo "== ③ tr(\"字面量\") 必须都在 uiStrings 清单里 =="
python3 - "$D" <<'PY'
import re, sys, pathlib
d = pathlib.Path(sys.argv[1])
i18n = d / "I18n.swift"
if not i18n.exists():
    print("  ❌ 没有 I18n.swift —— 这一波还没做"); sys.exit(1)
src = i18n.read_text()
m = re.search(r'static let uiStrings: \[String\] = \[(.*?)\n    \]', src, re.S)
if not m:
    print("  ❌ I18n.swift 里找不到 uiStrings 清单"); sys.exit(1)
manifest = set(re.findall(r'^\s*"((?:[^"\\]|\\.)*)",\s*$', m.group(1), re.M))
lits = set()
for f in d.glob("*.swift"):
    if f.name == "I18n.swift": continue
    lits |= set(re.findall(r'\btr\(\s*"((?:[^"\\]|\\.)*)"', f.read_text()))
missing = sorted(lits - manifest)
# 「校验器必须报自己的漏」: 两个数都打出来, 别只说 PASS
print(f"  清单 {len(manifest)} 条 | 源码里 tr() 字面量 {len(lits)} 条 | 漏登记 {len(missing)} 条")
if missing:
    print("  ❌ 这些 tr() 用了但没进清单(首次进该语言时不会被翻译):")
    for s in missing[:10]: print("       ", repr(s))
    sys.exit(1)
if len(lits) == 0:
    print("  ❌ 一条 tr() 都没抽到 —— 多半是抽取写错了, 不算通过"); sys.exit(1)
print("  ✅ 清单与源码一致")
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo "== ④ 字典拿不到时必须回退英文 =="
# 判据: t() 里有 miss→返回原文 的分支; refresh() 失败路径不清空已有字典。
if grep -q 'return (v?.isEmpty == false) ? v! : en' "$D/I18n.swift" 2>/dev/null \
   && grep -q 'guard merged != dict else { return }' "$D/I18n.swift" 2>/dev/null; then
  ok "缺词回退原文 + 刷新失败不清空盘上字典"
else
  no "回退/保护分支不在了 —— 拉不到字典会留空白"
fi

echo
echo "通过 $PASS · 失败 $FAIL"
if [ "${CALIBRATE:-0}" = "1" ]; then
  [ "$FAIL" -gt 0 ] && { echo "校准正确: 旧源码确实被判红"; exit 0; } || { echo "❌ 校准失败: 旧源码竟然全绿 —— 判据是假的"; exit 1; }
fi
[ "$FAIL" -eq 0 ]
