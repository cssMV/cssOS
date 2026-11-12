#!/usr/bin/env python3
"""把一个作品 lyrics.json 里【多个】被污染的语言条目换成同一份干净歌词。

W2302。和 w2299-clean-lyrics-json.py 同一套断言, 区别只有两点:
  1. 接受逗号分隔的多个 lang —— Cocijo 两个条目都脏(zap 末行是英文说明,
     orig-pre-epic 整份是 LLM 的反问), 分两次写稳定 key 等于两次覆盖风险。
  2. tag 统一存【不带方括号】。现有条目的 tag 存成了 `[Intro]`, 而 resubtitle
     重建歌词时写 `[${s.tag}]` → 得到 `[[Intro]]`, 再被 parseLyricsToSections
     解析成 tag=`[Intro` (正则在第一个 `]` 就停)。不影响正文行, 但是个说谎的段名。

用法: w2302-clean.py <workId> <lang1,lang2,...> <干净歌词纯文本> <输出目录>
只产出文件, 不上传 —— 上传与核对由外面的 shell 做(一步一验)。
其它语言条目 / v / work_id 一个字不动: 这是一份所有语言共用的累积文档(W2091)。
"""
import json, re, sys, urllib.request
from datetime import datetime, timezone

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
wid, langs_arg, lyrf, outdir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
langs = [x.strip().lower() for x in langs_arg.split(",") if x.strip()]

url = "https://cdn.cssstudio.app/works/%s/lyrics.json" % wid
raw = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()
open("%s/lyrics.before.json" % outdir, "wb").write(raw)
doc = json.loads(raw.decode("utf-8", "replace"))
assert doc.get("v") == 1, "v 不是 1, 是 %r —— 停手, 不拿不认识的结构去写" % doc.get("v")

before_langs = [x.get("lang") for x in doc["languages"]]

# 解析干净歌词 → sections
text = open(lyrf, encoding="utf-8").read()
sections, tag, buf = [], "", []
for r in text.split("\n"):
    m = re.match(r"^\s*\[([^\]\n]*)\]\s*$", r)
    if m:
        if tag:
            sections.append({"tag": tag, "lines": [l for l in buf if l.strip()]})
        tag, buf = (m.group(1) or "").strip(), []
    elif r.strip():
        buf.append(r)
if tag:
    sections.append({"tag": tag, "lines": [l for l in buf if l.strip()]})

# 核对产出 —— 不核对就是在猜
want_tags = re.findall(r"^\s*\[([^\]\n]*)\]\s*$", text, flags=re.M)
new_lines = [l for s in sections for l in s["lines"]]
body = [l.strip() for l in text.split("\n") if l.strip() and not re.match(r"^\s*\[", l)]
assert len(sections) == len(want_tags), "段数 %d != [tag] 行数 %d" % (len(sections), len(want_tags))
assert [s["tag"] for s in sections] == [t.strip() for t in want_tags], "段名顺序不对"
assert [l.strip() for l in new_lines] == body, "正文行丢了或顺序变了"
assert not any(re.match(r"^\s*\[", l) for l in new_lines), "有 [tag] 行漏进正文"
assert not any(t.startswith("[") or t.endswith("]") for t in (s["tag"] for s in sections)), \
    "tag 里混进了方括号"

print("作品 %s" % wid)
print("  文件里的语言: %s  (条数 %d —— 必须不变)" % (before_langs, len(before_langs)))
for lang in langs:
    tgt = [x for x in doc["languages"] if str(x.get("lang", "")).lower() == lang]
    assert len(tgt) == 1, "%s 的条目有 %d 个 —— 停手" % (lang, len(tgt))
    e = tgt[0]
    old_lines = [l for s in (e.get("sections") or []) for l in (s.get("lines") or [])]
    old_tags = [s.get("tag") for s in (e.get("sections") or [])]
    e["sections"] = [dict(s) for s in sections]     # 每个条目一份独立拷贝
    print("  --- %s" % lang)
    print("      旧 %d 行 / %d 节, tag 样本 %r" % (len(old_lines), len(old_tags), old_tags[:2]))
    print("      新 %d 行 / %d 节, tag 样本 %r" % (len(new_lines), len(sections),
                                                 [s["tag"] for s in sections][:2]))
    print("      旧首行: %s" % (old_lines[0][:76] if old_lines else "(空)"))
    print("      新首行: %s" % new_lines[0][:76])

# 写出前最后一道: 条目数、每个条目的 lang / is_native / title 一个都没动
assert [x.get("lang") for x in doc["languages"]] == before_langs, "语言条目被动了"
doc["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
out = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
open("%s/lyrics.after.json" % outdir, "wb").write(out)
print("  产出 %d 字节 (旧 %d)" % (len(out), len(raw)))
