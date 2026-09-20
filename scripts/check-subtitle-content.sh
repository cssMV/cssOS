#!/usr/bin/env bash
# W2125 · 字幕【内容】抽查 —— 库里那一列非空只证明写了地址, 不证明里面有东西。
#
# ⚠ 这个脚本的第一版把结构猜成 languages[].cues, 于是新做的 15 首全报"0 条空壳"。
#   幸好先在【对照组】(本来就好的旧字幕)上跑了一遍 —— 它们也报 0 条, 说明是解析器错了。
#   真实结构是 languages[].sections[].lines[].tokens。
#   **判据必须先在已知答案上校准**, 否则你会带着一个错判据去"修"一个没坏的东西。
#
# 用法: check-subtitle-content.sh <id 列表文件, 每行一个 uuid>
#       不给文件则随机抽 5 首【旧的】作对照。
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
LIST="${1:-}"

if [ -n "$LIST" ]; then
  Q="SELECT id::text, COALESCE(title,'-'), COALESCE(subtitle_take1_json_url,'')
       FROM user_works WHERE id IN ($(sed 's/^/\x27/; s/$/\x27/' "$LIST" | paste -sd, -)) ORDER BY title;"
else
  Q="SELECT id::text, COALESCE(title,'-'), subtitle_take1_json_url FROM user_works
      WHERE COALESCE(subtitle_take1_json_url,'')<>'' AND created_at < timestamptz '2026-09-01'
      ORDER BY random() LIMIT 5;"
fi

bad=0; n=0
while IFS='|' read -r id title url; do
  n=$((n+1))
  printf '%-36s ' "$(printf '%s' "$title" | cut -c1-34)"
  if [ -z "$url" ]; then printf '❌ 没有 URL\n'; bad=$((bad+1)); continue; fi
  out=$(curl -s --max-time 45 "$url" | python3 -c "
import sys, json
raw = sys.stdin.read()
if not raw.strip(): print('EMPTY|取回来是空的'); raise SystemExit
try: d = json.loads(raw)
except Exception as e: print('BAD|不是合法 JSON: ' + str(e)[:40]); raise SystemExit
langs = d.get('languages') or []
if not langs: print('BAD|没有 languages 段'); raise SystemExit
tot_lines = tot_tok = 0; det = []; first = ''
for L in langs:
    li = tk = 0
    for sec in (L.get('sections') or []):
        for ln in (sec.get('lines') or []):
            li += 1; tk += len(ln.get('tokens') or [])
            if not first:
                t = str(ln.get('text') or '').strip()
                if t and not t.startswith('['): first = t[:36]
    tot_lines += li; tot_tok += tk
    det.append('%s:%d行/%d字' % (L.get('lang'), li, tk))
ok = tot_lines >= 4 and tot_tok >= 10
print(('OK' if ok else 'THIN') + '|' + ', '.join(det) + '  首句: ' + (first or '(只有器乐段)'))
")
  case "$out" in
    OK\|*)   printf '✅ %s\n' "${out#OK|}";;
    THIN\|*) printf '⚠ 内容太少 %s\n' "${out#THIN|}"; bad=$((bad+1));;
    *)       printf '❌ %s\n' "${out#*|}"; bad=$((bad+1));;
  esac
done < <(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F'|' -c "$Q")

echo
echo "清单 ${n} 首, 实际查了 ${n} 首 —— 有问题 ${bad} 首"
[ "$bad" -eq 0 ] || exit 1
