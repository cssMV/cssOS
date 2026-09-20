#!/usr/bin/env bash
# W2128 · 重做字幕【之后】必须跑这个: 把字幕 JSON 里【残留的脏语言条目】摘掉。
#
# 为什么重做本身不够(这是这一波真正的坑):
#   upsertSubtitleJson 是【按语言合并】的 —— 它只替换 languages[lang] 那一条, 别的原样留着。
#   而 W1965 起字幕按【真语言】写(en/zh/…), 这些老作品里那条脏的却挂在占位符 "orig" 下。
#   于是重做完文件里有两条: 新的干净 en + 旧的脏 orig, 文件反而变大。
#   播放端(app.emotion-subtitle-engine.js:141)是 l.lang === lang 【精确匹配】,
#   拿到的仍可能是那条脏的 —— 重做等于白做。
#
# 摘干净之后只剩一条, 引擎的"只有一条就用它"兜底(同文件:144)保证一定能渲染上。
#
# 安全:
#   ① 旧字节早已由 w2128-preserve-subtitles.sh 另存到 subtitle-take1-pre-w2128.json, 并登记在库。
#   ② 摘完若【一条语言都不剩】, 这首【不写】—— 宁可保持现状, 也不要把字幕清空。
#   ③ 主字幕和按音频版本的快照 subtitle-take1--a*.json 是同一份内容, 必须一起改, 否则版本轨还是脏的。
set -u
BUCKET="r2:cssos-artifacts"
LIST="${1:?用法: $0 <ids.txt>}"

cat > /tmp/w2128_strip.py <<'PY'
import sys, json, re
KEYS = re.compile(r'"(lyrics?|sections?|lines|theme|mood)"\s*:')
def dirty(L):
    t = []
    for sec in (L.get("sections") or []):
        for ln in (sec.get("lines") or []):
            s = str(ln.get("text") or "")
            if s: t.append(s)
            for tk in (ln.get("tokens") or []):
                c = str(tk.get("char") or tk.get("text") or "")
                if c: t.append(c)
    blob = "\n".join(t)
    # 方括号不算 —— [Music...] / [Intro] 是我们自己的段落语法, 只有花括号才是 JSON 信封
    return bool(KEYS.search(blob)) or ("\\n" in blob) or ("\\t" in blob) or bool(re.search(r"(?m)^\s*[{}]", blob))
d = json.load(sys.stdin)
langs = d.get("languages") or []
keep = [L for L in langs if not dirty(L)]
drop = [str(L.get("lang")) for L in langs if dirty(L)]
if not keep:
    sys.stderr.write("REFUSE 摘完一条不剩\n"); sys.exit(3)
if not drop:
    sys.stderr.write("NOOP 本来就干净\n"); sys.exit(4)
d["languages"] = keep
sys.stderr.write("DROP " + ",".join(drop) + " KEEP " + ",".join(str(L.get("lang")) for L in keep) + "\n")
json.dump(d, sys.stdout, ensure_ascii=False)
PY

n=0; fixed=0; noop=0; refuse=0; err=0
while read -r id <&3; do
  [ -z "${id:-}" ] && continue
  n=$((n+1))
  main="works/$id/subtitle-take1.json"
  tmp="/tmp/w2128_clean_$$.json"
  msg=$(rclone cat "$BUCKET/$main" 2>/dev/null | python3 /tmp/w2128_strip.py > "$tmp" 2>&1 1>"$tmp"; :)
  msg=$(rclone cat "$BUCKET/$main" 2>/dev/null | python3 /tmp/w2128_strip.py 2>&1 >"$tmp")
  rc=$?
  case "$rc" in
    0) # 写回主字幕 + 所有同名快照
       rclone rcat "$BUCKET/$main" < "$tmp" 2>/dev/null
       for snap in $(rclone lsf "$BUCKET/works/$id/" 2>/dev/null | grep -E '^subtitle-take1--a[0-9a-f]+\.json$'); do
         rclone rcat "$BUCKET/works/$id/$snap" < "$tmp" 2>/dev/null
       done
       fixed=$((fixed+1)); printf '✅ [%d] %s  %s\n' "$n" "${id:0:8}" "$msg";;
    4) noop=$((noop+1));;
    3) refuse=$((refuse+1)); printf '⛔ [%d] %s  摘完一条不剩, 不写\n' "$n" "${id:0:8}";;
    *) err=$((err+1));   printf '❌ [%d] %s  %s\n' "$n" "${id:0:8}" "$msg";;
  esac
  rm -f "$tmp"
done 3< "$LIST"

echo
echo "=== 摘脏语言条目: 清单 $n 首, 实际处理 $n 首 ==="
echo "  摘掉并写回 $fixed 首 · 本来就干净 $noop 首 · 拒绝(会清空) $refuse 首 · 出错 $err 首"
