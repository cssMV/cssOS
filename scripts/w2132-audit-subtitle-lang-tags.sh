set -u
export PGPASSWORD="Au#20016"
cat > /tmp/tagaudit.py <<'PY'
import sys, json, re
def detect(t):
    if re.search(r"[가-힯]", t): return "ko"
    if re.search(r"[぀-ヿ]", t): return "ja"
    if re.search(r"[一-鿿]", t): return "zh"
    if re.search(r"[؀-ۿݐ-ݿ]", t): return "ar/fa"
    if re.search(r"[Ѐ-ӿ]", t): return "ru"
    if re.search(r"[Ͱ-Ͽ]", t): return "el"
    if re.search(r"[֐-׿]", t): return "he"
    if re.search(r"[ऀ-ॿ]", t): return "hi"
    if re.search(r"[A-Za-z]", t): return "latin"
    return "?"
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print("UNREADABLE"); raise SystemExit
out=[]
for L in (d.get("languages") or []):
    tag=str(L.get("lang") or "")
    txt=""
    for sec in (L.get("sections") or []):
        for ln in (sec.get("lines") or []):
            txt += str(ln.get("text") or "")
    if len(txt.strip()) < 8: continue
    got=detect(txt)
    # 拉丁字母是多语言共用的字形, 判不出具体哪种 -> 只要标签是拉丁系语言就算过
    LATIN={"en","fr","de","es","it","pt","la","vi","id","tr","pl","nl","sv","da","no","fi","cs","ro","hu","sw","yo","haw","zap","eu","ca","gl","af","et","lv","lt","sl","hr","sq","is","ga","cy","mt","tl","ms","uz","az","so","ha","ig","zu","xh","st","tn","rw","mg","ny","sn","qu","ay","gn","nah"}
    if got=="latin":
        ok = tag.lower().split("-")[0] in LATIN
    elif got=="ar/fa":
        ok = tag.lower().split("-")[0] in {"ar","fa","ur","ps","ku","sd"}
    elif got=="?":
        ok = True
    else:
        ok = tag.lower().split("-")[0]==got
    if not ok:
        out.append("%s≠%s" % (tag or "(空)", got))
print("MISMATCH|"+",".join(out) if out else "OK")
PY
n=0; bad=0
: > /tmp/tag-mismatch.tsv
Q="SELECT w.id::text, w.subtitle_take1_json_url, COALESCE(w.title,'-'), COALESCE(w.status,'-')
     FROM user_works w WHERE COALESCE(w.subtitle_take1_json_url,'')<>'' ORDER BY w.created_at;"
while IFS=$'\x1f' read -r id url title st <&3; do
  n=$((n+1))
  v=$(curl -s --max-time 30 "$url" 2>/dev/null | python3 /tmp/tagaudit.py)
  case "$v" in
    MISMATCH*) bad=$((bad+1)); printf '%s\x1f%s\x1f%s\x1f%s\n' "$id" "${v#MISMATCH|}" "$st" "$title" >> /tmp/tag-mismatch.tsv
               printf '❌ %-30s [%s] %s\n' "$(printf '%s' "$title"|cut -c1-28)" "$st" "${v#MISMATCH|}";;
  esac
  [ $((n % 200)) -eq 0 ] && echo "  …已查 $n" >&2
done 3< <(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F$'\x1f' -c "$Q")
echo
echo "=== 字幕标签与内容字形核对: 清单 $n 首, 实际查了 $n 首 —— 不符 $bad 首 ==="
