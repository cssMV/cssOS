#!/usr/bin/env python3
# 孤儿条目动手前必须先量: 它和正主是【纯重复】还是【两个版本】?
# 纯重复 → 删一份不丢任何东西; 不同 → 那是两个版本, 一律不删(Jing 的铁律)。
import json, re, urllib.request, hashlib
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()

addr = {}
for l in open("/tmp/w2301-addr2.tsv"):
    f = l.rstrip("\n").split("\t")
    if len(f) >= 5 and f[4].strip():
        addr.setdefault((f[0], f[1], f[2], f[3]), f[4].strip())

def rows_of(ent):
    out = []
    for s in (ent.get("sections") or []):
        for ln in (s.get("lines") or []):
            t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
            if not t: continue
            tk = ln.get("tokens") or [] if isinstance(ln, dict) else []
            ts = min([x["t_start"] for x in tk if x.get("t_start") is not None], default=None)
            te = max([x["t_end"] for x in tk if x.get("t_end") is not None], default=None)
            out.append((s.get("tag"), t, ts, te))
    return out

CASES = [("9a1e578a", "quc", "auto", "2", "zh", "Popol Wuj · Ixim"),
         ("767cca0e", "quc", "auto", "2", "zh", "Popol Wuj · Xib'alba"),
         ("c5ab48df", "quc", "auto", "2", "zh", "Popol Wuj · Xkik'"),
         ("4b837997", "la", "auto", "1", "en", "奥古斯都 ♪1"),
         ("4b837997", "la", "auto", "2", "en", "奥古斯都 ♪2")]

for pre, main, voice, take, orph, name in CASES:
    k = next((kk for kk in addr if kk[0].startswith(pre) and kk[1] == main
              and kk[2] == voice and kk[3] == take), None)
    print("=" * 94)
    if not k:
        print("%s: 地址表里找不到" % name); continue
    d = json.loads(get(addr[k]))
    langs = {str(L.get("lang", "")): L for L in (d.get("languages") or [])}
    print("%s   文件条目: %s" % (name, list(langs)))
    a, b = langs.get(main), langs.get(orph)
    if a is None or b is None:
        print("   取不到其中一个条目 —— 判不了"); continue
    ra, rb = rows_of(a), rows_of(b)
    ta = [x[1] for x in ra]; tb = [x[1] for x in rb]
    print("   正主 %-4s : %d 行, 时间 %.1f→%.1fs" % (main, len(ra),
          (min([x[2] for x in ra if x[2] is not None], default=0))/1000,
          (max([x[3] for x in ra if x[3] is not None], default=0))/1000))
    print("   孤儿 %-4s : %d 行, 时间 %.1f→%.1fs" % (orph, len(rb),
          (min([x[2] for x in rb if x[2] is not None], default=0))/1000,
          (max([x[3] for x in rb if x[3] is not None], default=0))/1000))
    same_text = ta == tb
    print("   正文逐行相同? %s" % ("是 —— 纯重复" if same_text else "否"))
    if not same_text:
        only_a = [x for x in ta if x not in tb][:3]
        only_b = [x for x in tb if x not in ta][:3]
        print("     只在正主里: %s" % (only_a or "(无)"))
        print("     只在孤儿里: %s" % (only_b or "(无)"))
    # 时间轴是否也相同
    sa = [(x[2], x[3]) for x in ra]; sb = [(x[2], x[3]) for x in rb]
    print("   时间轴逐行相同? %s" % ("是" if sa == sb else "否"))
    if sa != sb and same_text:
        print("     → 同词不同时间轴 = 两个【版本】, 不是重复")
