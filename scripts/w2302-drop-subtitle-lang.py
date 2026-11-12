#!/usr/bin/env python3
"""从一份字幕 JSON 里移除某个 lang 条目。只产出文件, 不上传(上传与核对由 shell 做)。

用法: w2302-drop-lang.py <字幕url> <要移除的lang> <输出目录> <此条目必须满足的最大行数>
最后那个参数是【安全闸】: 只允许移除【确认是垃圾】的小条目。
传 2 就是「这个条目最多 2 行, 多于 2 行就停手」—— 防止我判错把一个真版本删掉。

为什么不是无条件移除: Jing 的铁律是「多出来的版本一律不删, 放在胶囊轨道里让用户选择」。
能移除的只有【不是任何版本】的东西 —— 比如 whisper 在 30 秒 demo 上的幻听
`Thank you.` x2。判它是幻听不是版本, 靠的是: 行数极少 + 内容与歌词毫无关系 +
时间轴只覆盖旧 demo 的长度。这三条都得人眼看过, 脚本只负责别让我手滑。
"""
import json, re, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
url, drop, outdir, maxlines = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])

raw = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
open("%s/sub.before.json" % outdir, "wb").write(raw)
doc = json.loads(raw.decode("utf-8", "replace"))
assert doc.get("v") == 1, "v 不是 1, 是 %r —— 停手" % doc.get("v")

before = [str(L.get("lang", "")) for L in (doc.get("languages") or [])]
tgt = [L for L in doc["languages"] if str(L.get("lang", "")) == drop]
assert len(tgt) == 1, "%s 的条目有 %d 个 —— 停手" % (drop, len(tgt))

rows = []
for s in (tgt[0].get("sections") or []):
    for ln in (s.get("lines") or []):
        t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
        if t:
            rows.append(t)
assert len(rows) <= maxlines, \
    "这个 %s 条目有 %d 行 (> 闸门 %d) —— 它可能是一个真版本, 停手不删" % (drop, len(rows), maxlines)

print("作品字幕 %s" % url.rsplit("/", 1)[-1])
print("  条目(动作前): %s" % before)
print("  要移除的 %s: %d 行 → %s" % (drop, len(rows), rows))
doc["languages"] = [L for L in doc["languages"] if str(L.get("lang", "")) != drop]
after = [str(L.get("lang", "")) for L in doc["languages"]]
assert after == [x for x in before if x != drop], "除了 %s 之外还动了别的条目" % drop
print("  条目(动作后): %s" % after)

from datetime import datetime, timezone
doc["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
out = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
open("%s/sub.after.json" % outdir, "wb").write(out)
print("  产出 %d 字节 (旧 %d)" % (len(out), len(raw)))
