#!/usr/bin/env bash
# W2131 · 把【占位符语言标签】校正成真实语言。默认干跑, --apply 才真改。
#
# 病根(W2130 在《秦始皇》上撞出来的):
#   work_language_tracks.lang 存着 'orig'/'auto'/'' 这类【占位符】, 它不是语言。
#   字幕引擎(app.emotion-subtitle-engine.js:141)严格按轨的 lang 取字幕条目,
#   占位符兜底(:144)【只在字幕文件里仅有一条时】才放行。
#   → 今天靠兜底还能显示; 一旦给这首加第二种语言, 文件变两条, 兜底失效, 原版字幕当场哑掉。
#
# 所以必须【两半一起改】, 只改一半等于把雷留着:
#   ① 轨的 lang:   'orig' → 真实语言
#   ② 字幕文件里那条 languages[].lang: 'orig' → 同一个真实语言
#   只改①: 文件仍是占位符, 加第二语言后严格匹配失败、兜底也失效 → 照样哑。
#   只改②: 轨还在要 'orig', 文件已经是 'en' → 立刻哑。
#
# 判据优先级(先用证据, 再用声明, 最后才猜):
#   1. 字幕文件里【唯一一条真实语言标签】 —— 最硬, 用它轨就一定对得上
#   2. user_works.language        —— 作品自己声明的
#   3. 歌词字形判定               —— 与后端 detectLyricLang 同一套(谚文ko/假名ja/汉zh/…)
#
# 安全:
#   · 'orig-pre-epic' 【不碰】—— 那是版本备份标记, 旗舰墙的查询按它取(src/index.ts:41667), 改了会塌
#   · 目标 (work_id, lang, voice) 已存在 → 跳过, 绝不制造唯一键冲突
#   · 判不出真实语言 → 跳过, 不猜
#
# ⚠ 读 psql 输出【不许用 TAB 当分隔符】: tab 属于 IFS 空白字符, bash 会把连续分隔符折叠,
#   于是任何一个【空字段】都让整行左移 —— 首跑就栽在这: language 为空的行, URL 被当成了语言,
#   804 条"依据=worklang"里混着一堆 URL。改用 \x1f(非空白), 绝不折叠。
#   · 每一条改动进 w2130_track_lang_backup; 字幕文件旧字节另存 -pre-w2131.json
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
APPLY="${1:-}"
PLAN=/tmp/w2131-plan.tsv
: > "$PLAN"

cat > /tmp/w2131_detect.py <<'PY'
import sys, json, re
PLACE = {"", "orig", "auto", "und"}
def detect(t):
    t = t or ""
    if re.search(r"[가-힯]", t): return "ko"
    if re.search(r"[぀-ヿ]", t): return "ja"      # 假名要在汉字之前
    if re.search(r"[一-鿿]", t): return "zh"
    if re.search(r"[؀-ۿݐ-ݿ]", t): return "fa"
    if re.search(r"[Ѐ-ӿ]", t): return "ru"
    if re.search(r"[Ͱ-Ͽ]", t): return "el"
    if re.search(r"[֐-׿]", t): return "he"
    if re.search(r"[ऀ-ॿ]", t): return "hi"
    return "en"
sub_raw, work_lang, lyrics = sys.stdin.read().split("\x1e")
tags, subtext = [], ""
try:
    d = json.loads(sub_raw) if sub_raw.strip() else None
    for L in (d.get("languages") or []) if d else []:
        tags.append(str(L.get("lang") or ""))
        for sec in (L.get("sections") or [])[:8]:
            for ln in (sec.get("lines") or [])[:8]:
                subtext += str(ln.get("text") or "")
except Exception:
    d = None
real = [t for t in tags if t.lower() not in PLACE]
if len(set(real)) == 1:
    print("%s\tsubtag\t%s" % (real[0], "|".join(tags)))          # 证据最硬
elif work_lang.strip() and work_lang.strip().lower() not in PLACE:
    print("%s\tworklang\t%s" % (work_lang.strip().lower(), "|".join(tags)))
else:
    src = lyrics if lyrics.strip() else subtext
    print("%s\tscript\t%s" % (detect(src), "|".join(tags)) if src.strip() else "\tunknown\t%s" % "|".join(tags))
PY

Q="SELECT w.id::text, COALESCE(w.title,'-'), COALESCE(w.language,''), COALESCE(w.subtitle_take1_json_url,''),
          COALESCE(replace(left(w.lyrics_preview,400), E'\n', ' '),'')
     FROM user_works w
    WHERE COALESCE(w.subtitle_take1_json_url,'') <> ''
      AND EXISTS (SELECT 1 FROM work_language_tracks t
                   WHERE t.work_id=w.id AND t.is_default AND t.lang IN ('orig','auto',''))
    ORDER BY w.created_at;"

n=0; plan=0; skip=0
while IFS=$'\x1f' read -r id title wlang suburl lyr <&3; do
  n=$((n+1))
  sub=$(curl -s --max-time 30 "$suburl" 2>/dev/null)
  out=$(printf '%s\x1e%s\x1e%s' "$sub" "$wlang" "$lyr" | python3 /tmp/w2131_detect.py)
  newlang=$(printf '%s' "$out" | cut -f1); why=$(printf '%s' "$out" | cut -f2); tags=$(printf '%s' "$out" | cut -f3)
  if [ -z "$newlang" ]; then skip=$((skip+1)); continue; fi
  # 自检: 语言码只能是 2-3 位字母。解析一旦错位(见上面那条教训), 这里立刻拦住而不是写一堆垃圾
  case "$newlang" in
    [a-z][a-z]|[a-z][a-z][a-z]) ;;
    *) echo "❌ 解析异常, 得到的不是语言码: '$newlang' (work ${id:0:8})"; skip=$((skip+1)); continue;;
  esac
  printf '%s\x1f%s\x1f%s\x1f%s\x1f%s\n' "$id" "$newlang" "$why" "$tags" "$title" >> "$PLAN"
  plan=$((plan+1))
  [ $((n % 100)) -eq 0 ] && echo "  …已算 $n" >&2
done 3< <(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F$'\x1f' -c "$Q")

echo
echo "=== 干跑: 清单 $n 首, 实际算了 $n 首 ==="
echo "  能定语言 $plan 首 · 判不出跳过 $skip 首"
echo "--- 目标语言分布 ---"
cut -d$'\x1f' -f2 "$PLAN" | sort | uniq -c | sort -rn
echo "--- 依据分布 ---"
cut -d$'\x1f' -f3 "$PLAN" | sort | uniq -c | sort -rn
echo "--- 字幕文件里现有标签的形态 ---"
cut -d$'\x1f' -f4 "$PLAN" | sort | uniq -c | sort -rn | head -8
echo
echo "计划已写入 $PLAN"
[ "$APPLY" = "--apply" ] || echo "(干跑, 未做任何改动。要真改加 --apply)"
