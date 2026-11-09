#!/usr/bin/env python3
"""本地预检 —— 判据【照抄】runner 里 --lyrics-file 的 PYGATE, 外加目标语言字形
(照抄 w2277-check-track-lyrics.py 的 need 表)。先在本地全过, 再上机花钱。"""
import re, sys, os
# 汉字算「源语言漏出来」还是「正文」, 取决于目标语言 —— 目标是 zh/ja 时它就是正文(W2281)。
SRC_LEAK_OK = {"zh", "ja"}
SCRIPT = {"el": lambda t: sum(1 for c in t if "Ͱ" <= c <= "Ͽ" or "ἀ" <= c <= "῿"),
          "hi": lambda t: sum(1 for c in t if "ऀ" <= c <= "ॿ"),
          "zh": lambda t: sum(1 for c in t if "一" <= c <= "鿿"),
          "ja": lambda t: sum(1 for c in t if "぀" <= c <= "ヿ" or "一" <= c <= "鿿"),
          "en": lambda t: sum(1 for c in t if c.isalpha() and ord(c) < 0x250)}
bad_all = 0
for path in sys.argv[1:]:
    lang = os.path.basename(path).rsplit(".", 1)[0].rsplit("-", 1)[-1]
    t = open(path, encoding="utf-8").read()
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    secs = [l for l in lines if re.match(r"^\[(Verse|Chorus|Bridge|Outro|Intro)\b", l)]
    body = [l for l in lines if not l.startswith("[")]
    han = sum(1 for l in body for ch in l if "一" <= ch <= "鿿")
    sc = SCRIPT.get(lang, SCRIPT["en"])(t)
    bad = []
    if len(secs) < 10: bad.append(f"节数 {len(secs)} < 10")
    if len(body) < 40: bad.append(f"词行 {len(body)} < 40")
    if han and lang not in SRC_LEAK_OK: bad.append(f"括号外有 {han} 个汉字")
    if sc < 50: bad.append(f"{lang} 字形只有 {sc} 个 < 50")
    # 每节行数也量一下 —— 不是闸门判据, 但不均匀的节会让 Suno 乱切
    per = []
    cur = None
    for l in lines:
        if re.match(r"^\[(Verse|Chorus|Bridge|Outro|Intro)\b", l): per.append(0); cur = True
        elif cur and not l.startswith("["): per[-1] += 1
    flag = "FAIL" if bad else "ok  "
    print(f"{flag} {os.path.basename(path):<34} {len(secs)} 节 · {len(body)} 词行 · {lang}字形 {sc} · 各节 {per}")
    for b in bad: print("        ", b); 
    bad_all += bool(bad)
print(f"\n{len(sys.argv)-1} 份, 不合格 {bad_all}")
sys.exit(1 if bad_all else 0)
