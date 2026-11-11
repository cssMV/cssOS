#!/usr/bin/env python3
"""造两份【干净的纯文本歌词】给 ?lyrics_url= 用。一个字都不新写, 只从已有的干净来源摘。

Cocijo : lyrics.json 的 zap 条目 —— 23 行真词是好的, 只丢掉第 24 行那句英文说明。
Valhǫll: lyrics.json 的 non 条目整份是 LLM 反问 → 不要它, 用 work_language_tracks.lyrics
         里那 22 行古诺斯语真词(库里一直都在, 只是排在 lyrics.json 后面所以从没被用上)。

判「这一行是说明不是歌词」只靠一条: 整行是拉丁字母的长英文句子, 且长度远超其它行。
不靠关键词 —— 关键词永远漏。
"""
import json, re, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"

def get(url):
    return json.loads(urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8", "replace"))

def latin(s):
    s = re.sub(r"[\W_\d]+", "", s, flags=re.UNICODE)
    return (sum(1 for c in s if "a" <= c.lower() <= "z") / len(s)) if s else 0.0

def build_cocijo():
    d = get("https://cdn.cssstudio.app/works/0d8574c2-0f9c-46be-b070-e124ffb8df5d/lyrics.json")
    e = next(x for x in d["languages"] if str(x.get("lang","")).lower() == "zap")
    out, dropped = [], []
    lens = [len(l) for s in e["sections"] for l in (s.get("lines") or [])]
    med = sorted(lens)[len(lens)//2]
    for s in e["sections"]:
        keep = []
        for l in (s.get("lines") or []):
            # 说明行: 比中位行长 3 倍以上 且 几乎全是拉丁字母
            if len(l) > med * 3 and latin(l) > 0.9: dropped.append(l); continue
            keep.append(l)
        # lyrics.json 的 tag 自带方括号, 再包一层就成了 [[Intro]] —— 先剥掉
        _tag = str(s.get("tag") or "Verse").strip().strip("[]【】〔〕").strip() or "Verse"
        if keep: out.append(f"[{_tag}]\n" + "\n".join(keep))
    return "\n\n".join(out), dropped

def build_valholl(track_lyrics):
    # 轨歌词原样用 —— 它本来就是干净的, 只做一次「说明行」体检
    lines = [l for l in track_lyrics.replace("<<NL>>", "\n").split("\n")]
    body = [l for l in lines if l.strip()]
    lens = [len(l) for l in body] or [1]
    med = sorted(lens)[len(lens)//2]
    out, dropped = [], []
    for l in lines:
        t = l.strip()
        if t.startswith("#"): dropped.append(t); continue      # markdown 标题行(端点自己也会丢)
        if t and len(t) > med * 3 and latin(t) > 0.9: dropped.append(t); continue
        out.append(l)
    return "\n".join(out).strip(), dropped

which = sys.argv[1]
if which == "cocijo":
    txt, dr = build_cocijo()
else:
    txt, dr = build_valholl(open(sys.argv[2], encoding="utf-8").read())
print(f"=== {which}: {len(txt)} 字节, {len([l for l in txt.split(chr(10)) if l.strip()])} 行 ===")
print(txt)
print(f"=== 丢掉的 {len(dr)} 行(应当全是说明文字) ===")
for l in dr: print("  ✂", l[:120])
open(f"/tmp/w2298-lyr-{which}.txt", "w", encoding="utf-8").write(txt + "\n")
