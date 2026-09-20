#!/usr/bin/env bash
# W2128 · 字幕文件体检: ①文字里是否残留 LLM 的 JSON 信封 ②时间轴是否真的有值
#
# 为什么必须扫【文件】而不是查库: 歌词已经在 W2126 修好了, 但字幕是在那之前做的 ——
# 坏歌词已经【烤进】字幕 JSON 的 token 里了, 还带着真实时间戳。库里那一列看着好好的,
# 用户屏幕上却在逐字唱出 `"lyrics":`。只有把文件拉下来看内容才知道。
#
# ⚠ 字段名不许猜 —— 真源是 public/app.emotion-subtitle-engine.js:
#     行文本   line.text          行时间 line.t_start / line.t_end (毫秒)
#     token字  tok.char || tok.text
#     token时  tok.t_start / tok.t_end (毫秒)
#   我在这件事上连栽两次: 先猜成 languages[].cues(报出 15 个假"空壳"),
#   再猜成 tok.start/tok.end(报出"全库 1157 首字幕没有时间轴"的假警报)。
#   两次都是【判据错了, 不是数据坏了】。改判据前先去读消费这个 JSON 的代码。
#
# 用法: scan-corrupt-subtitles.sh [输出清单路径]
#   不带参数 = 扫全库; 带 --fixed-lyrics = 只扫 W2126 修过歌词的那批
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
OUT="${1:-/tmp/corrupt-subs.tsv}"
: > "$OUT"

if [ "${2:-}" = "--fixed-lyrics" ]; then
  Q="SELECT w.id::text, COALESCE(w.title,'-'), w.subtitle_take1_json_url
       FROM user_works w JOIN w2126_lyrics_backup b ON b.work_id = w.id
      WHERE COALESCE(w.subtitle_take1_json_url,'') <> '' ORDER BY w.title;"
else
  Q="SELECT w.id::text, COALESCE(w.title,'-'), w.subtitle_take1_json_url
       FROM user_works w
      WHERE COALESCE(w.subtitle_take1_json_url,'') <> '' ORDER BY w.created_at;"
fi

PY='
import sys, json, re
raw = sys.stdin.read()
if not raw.strip(): print("SKIP|0|0"); raise SystemExit
try: d = json.loads(raw)
except Exception: print("UNREADABLE|0|0"); raise SystemExit
texts = []; tot = 0; timed = 0
for L in (d.get("languages") or []):
    for sec in (L.get("sections") or []):
        for ln in (sec.get("lines") or []):
            t = str(ln.get("text") or "")
            if t: texts.append(t)
            for tok in (ln.get("tokens") or []):
                tot += 1
                c = str(tok.get("char") or tok.get("text") or "")
                if c: texts.append(c)
                try:
                    if float(tok.get("t_end") or 0) > 0: timed += 1
                except Exception: pass
blob = chr(10).join(texts)
hits = []
if re.search(r"\"(lyrics?|sections?|lines|theme|mood)\"\s*:", blob): hits.append("JSON键")
if "\\n" in blob or "\\t" in blob:                                    hits.append("字面转义")
if re.search(r"(?m)^\s*[{}\[]", blob):                                hits.append("花括号")
health = "EMPTY" if tot == 0 else ("DEAD" if timed == 0 else "TIMED")
print(("BAD:" + "+".join(hits) if hits else "OK") + "|" + health + "|" + str(tot))
'

n=0; bad=0; dead=0; empty=0
while IFS='|' read -r id title url <&3; do
  n=$((n+1))
  v=$(curl -s --max-time 40 "$url" | python3 -c "$PY")
  txt="${v%%|*}"; rest="${v#*|}"; health="${rest%%|*}"
  case "$txt" in
    BAD*) bad=$((bad+1)); printf '%s\t%s\n' "$id" "$title" >> "$OUT"
          printf '❌ %-38s %-12s %s\n' "$(printf '%s' "$title" | cut -c1-36)" "${txt#BAD:}" "$health";;
  esac
  [ "$health" = "DEAD"  ] && dead=$((dead+1))
  [ "$health" = "EMPTY" ] && empty=$((empty+1)) && printf '⬜ %-38s 空字幕\n' "$(printf '%s' "$title" | cut -c1-36)"
done 3< <(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F'|' -c "$Q")

echo
echo "清单 ${n} 首, 实际查了 ${n} 首"
echo "  文字带污染 ${bad} 首 · 无时间轴 ${dead} 首 · 空字幕 ${empty} 首"
echo "需重做的清单: $OUT"
