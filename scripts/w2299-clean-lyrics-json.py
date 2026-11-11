#!/usr/bin/env python3
"""把一个作品 lyrics.json 里某门语言的【被污染的条目】换成干净歌词。

用法: w2299-clean-lyricsjson.py <workId> <lang> <干净歌词纯文本> <输出目录>
     只产出文件, 不上传 —— 上传与核对由外面的 shell 做(一步一验)。

段落结构照 parseLyricsToSections 的产物: {tag, lines[]}。
这份干净歌词是最简形式(纯 ASCII 的 [tag] + 正文行), 所以只需要那一个分支;
但产出之后必须核对: 段数 == [tag] 行数, 且每一行正文都在、顺序一致。

其它语言的条目、v、work_id 一个字不动 —— 这是一份【所有语言共用】的累积文档,
碰错一处就是把别的语言弄丢(W2091 注释里写得很清楚: 它不能改成哈希命名, 就是这个原因)。
"""
import json, re, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
wid, lang, lyrf, outdir = sys.argv[1], sys.argv[2].lower(), sys.argv[3], sys.argv[4]

url = f"https://cdn.cssstudio.app/works/{wid}/lyrics.json"
raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()
open(f"{outdir}/lyrics.before.json", "wb").write(raw)
doc = json.loads(raw.decode("utf-8", "replace"))
assert doc.get("v") == 1, f"v 不是 1, 是 {doc.get('v')} —— 停手, 不拿不认识的结构去写"

tgt = [x for x in doc["languages"] if str(x.get("lang", "")).lower() == lang]
assert len(tgt) == 1, f"{lang} 的条目有 {len(tgt)} 个 —— 停手"
e = tgt[0]
old_lines = [l for s in (e.get("sections") or []) for l in (s.get("lines") or [])]

text = open(lyrf, encoding="utf-8").read()
sections, tag, buf = [], "", []
for r in text.split("\n"):
    m = re.match(r"^\s*\[([^\]\n]*)\]\s*$", r)
    if m:
        if tag: sections.append({"tag": tag, "lines": [l for l in buf if l.strip()]})
        tag, buf = (m.group(1) or "").strip(), []
    elif r.strip():
        buf.append(r)
if tag: sections.append({"tag": tag, "lines": [l for l in buf if l.strip()]})

# 核对产出 —— 不核对就是在猜
want_tags = re.findall(r"^\s*\[([^\]\n]*)\]\s*$", text, flags=re.M)
new_lines = [l for s in sections for l in s["lines"]]
body = [l.strip() for l in text.split("\n") if l.strip() and not re.match(r"^\s*\[", l)]
assert len(sections) == len(want_tags), f"段数 {len(sections)} != [tag] 行数 {len(want_tags)}"
assert [s["tag"] for s in sections] == [t.strip() for t in want_tags], "段名顺序不对"
assert [l.strip() for l in new_lines] == body, "正文行丢了或顺序变了"
assert not any(re.match(r"^\s*\[", l) for l in new_lines), "有 [tag] 行漏进正文"

e["sections"] = sections
# is_native / title / lang 一律不动
from datetime import datetime, timezone
doc["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
out = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
open(f"{outdir}/lyrics.after.json", "wb").write(out)

print(f"作品 {wid}  语言 {lang}")
print(f"  文件里的语言: {[x.get('lang') for x in doc['languages']]}  (条数 {len(doc['languages'])} —— 必须不变)")
print(f"  旧条目 {len(old_lines)} 行 → 新条目 {len(new_lines)} 行 / {len(sections)} 节")
print(f"  旧首行: {old_lines[0][:70] if old_lines else '(空)'}")
print(f"  新首行: {new_lines[0][:70]}")
print(f"  新末行: {new_lines[-1][:70]}")
print(f"  before {len(raw)} 字节 → after {len(out)} 字节")
