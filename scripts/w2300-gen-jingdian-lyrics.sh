#!/bin/bash
# W2300 第一步 —— 只出歌词, 不生成音乐。
# 分两步是为了【先看清词再花 Suno 的钱】: 词不对, 后面整条都白做。
# 走 /api/admin/mv-lyrics —— 平台自己的京典出词口(十节四十行闸门 + 文明智能联动 + 不写一个字进库)。
set -u
TOK=$(grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
[ -n "$TOK" ] || { echo "FAIL 没有 admin token"; exit 2; }
API=http://127.0.0.1:3000
mkdir -p /tmp/w2300

do_one() { # $1=tag $2=title $3=style $4=subject
  echo "===== $1  $2 ====="
  body=$(python3 -I -c '
import json,sys
print(json.dumps({"title":sys.argv[1],"language":"la","style":sys.argv[2],
                  "civilization":"古罗马文明","prompt":sys.argv[3]}, ensure_ascii=False))' "$2" "$3" "$4")
  out=$(curl -s -m 900 -X POST -H "x-admin-token: $TOK" -H 'Content-Type: application/json' \
        -d "$body" "$API/api/admin/mv-lyrics")
  printf '%s' "$out" > /tmp/w2300/$1.resp.json
  python3 -I - "$1" <<'PY'
import json,re,sys
tag=sys.argv[1]
d=json.load(open(f"/tmp/w2300/{tag}.resp.json",encoding="utf-8"))
if not d.get("lyrics"):
    print("  ‼ 没拿到歌词:", json.dumps({k:v for k,v in d.items() if k!="lyrics"}, ensure_ascii=False)[:300]); raise SystemExit(1)
t=d["lyrics"]
open(f"/tmp/w2300/{tag}.lyrics.txt","w",encoding="utf-8").write(t if t.endswith("\n") else t+"\n")
secs=re.findall(r"^\s*\[([^\]\n]*)\]\s*$", t, flags=re.M)
body=[l.strip() for l in t.split("\n") if l.strip() and not re.match(r"^\s*\[", l)]
cjk=len(re.findall(r"[一-鿿぀-ヿ가-힯]", "".join(body)))
latin=sum(1 for c in "".join(body) if c.isalpha() and ord(c)<0x250)
print(f"  ok={d.get('ok')} code={d.get('code')}  接口报 {d.get('sections')} 节 / {d.get('lines')} 行  用了 {d.get('ms')}ms")
print(f"  我自己数: {len(secs)} 节 / {len(body)} 行  段名: {', '.join(secs)}")
print(f"  正文字形: 拉丁字母 {latin} · CJK/假名/韩文 {cjk}")
ok=True
if len(secs) < 10: print(f"  ⚠ 不足 10 节(歌词完整度铁律)"); ok=False
if len(body) < 40: print(f"  ⚠ 不足 40 行(歌词完整度铁律)"); ok=False
if cjk > 0: print(f"  ⚠ 正文里有 {cjk} 个 CJK 字 —— la 的词里不该有(语言标签必须说实话)"); ok=False
if latin < 200: print(f"  ⚠ 拉丁字母太少, 不像拉丁语词"); ok=False
# 非歌词一律进方括号(京典特征 7): 正文行不该是整句英文说明
susp=[l for l in body if len(l)>90 and sum(1 for c in l if "a"<=c.lower()<="z")/max(1,len(re.sub(r"\W","",l)))>0.9]
if susp: print(f"  ⚠ {len(susp)} 行像是说明文字, 首个: {susp[0][:70]}"); ok=False
print("  判定:", "✅ 过闸" if ok else "⚠ 不达标 —— 不要拿它去生成音乐")
PY
  echo
}

do_one caesar   "凯撒 · 罗马号角 / 史诗合唱"      "Roman Horns / Epic Choir"              "凯撒"
do_one augustus "奥古斯都 · 庄严管弦 / 古乐器"    "Solemn Orchestra / Ancient Instruments" "奥古斯都"
echo "文件: /tmp/w2300/{caesar,augustus}.lyrics.txt"
