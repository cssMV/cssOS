#!/usr/bin/env python3
"""W2277 —— 核对一条新轨的【词】: 行数够不够、是不是目标语言、有没有源语言漏出来。

transcreateLyrics 的第 (6) 条就是为「源语言的词漏过来」补的(W2238 实际事故),
所以这一条必须真的量, 不能信提示词写了就以为做到了。
"""
import os, re, subprocess, sys, unicodedata, collections
DB = os.environ["DATABASE_URL"]
wid, lang = sys.argv[1], sys.argv[2]
sql = (f"select coalesce(lyrics,'') from work_language_tracks "
       f"where work_id='{wid}'::uuid and lang='{lang}' and voice='auto'")
t = subprocess.run(["psql", DB, "-X", "-q", "-t", "-A", "-c", sql],
                   capture_output=True, text=True).stdout.rstrip("\n")
if len(t) < 100: sys.exit(f"FAIL: 取到 {len(t)} 字 —— 没取到词, 别信下面任何结论")

body = [l.strip() for l in t.splitlines()
        if l.strip() and not re.match(r"^\s*[\[\u3010\u3014]", l)]
# 段落标记的字符类【照抄 src/index.ts 的 parseLyricsToSections】——
# 它认 ASCII [ 和全角 【 〔(含 LLM 常见的不配对收尾)。只认 [ 就会把
# 日语的【第一節】整批判成「0 节」, 我第一版就是这么误报了 #3 的。
SEC_RE = re.compile(r"^\s*[\[\u3010\u3014]([^\]\u3011\u3015\u300d\u300f\n]*)[\]\u3011\u3015\u300d\u300f]?", re.M)
secs = [m.strip() for m in SEC_RE.findall(t) if m.strip()]
han = sum(1 for ch in t if "一" <= ch <= "鿿")
kana = sum(1 for ch in t if "぀" <= ch <= "ヿ")
hang = sum(1 for ch in t if "가" <= ch <= "힯")
grek = sum(1 for ch in t if "Ͱ" <= ch <= "Ͽ" or "ἀ" <= ch <= "῿")
deva = sum(1 for ch in t if "ऀ" <= ch <= "ॿ")
arab = sum(1 for ch in t if "؀" <= ch <= "ۿ")
latn = sum(1 for ch in t if ch.isalpha() and ord(ch) < 0x250)
print(f"{wid[:8]} lang={lang}: {len(t)} 字, {len(secs)} 节, {len(body)} 行(非段标)")
print(f"  节名: {secs}")
print(f"  字形: 汉 {han} · 假名 {kana} · 谚文 {hang} · 希腊 {grek} · 天城 {deva} · 阿拉伯 {arab} · 拉丁 {latn}")
fails = []
if len(body) < 40: fails.append(f"行数 {len(body)} < 40 —— 够不上完整度铁律")
if len(secs) < 10: fails.append(f"节数 {len(secs)} < 10")
# 源语言(中文)漏出来: 目标不是 zh/ja 时, 汉字就是漏词
if lang not in ("zh", "ja") and han > 0:
    fails.append(f"源语言漏出来: {han} 个汉字")
    print("  漏出来的行:")
    for l in body:
        if any("一" <= c <= "鿿" for c in l): print("   ", l[:70])
# 目标语言字形必须占多数
need = {"el": grek, "ja": kana + han, "hi": deva, "ar": arab, "fa": arab, "ur": arab,
        "la": latn, "it": latn, "sw": latn, "en": latn, "de": latn, "fr": latn, "bo": 0}
if lang in need and need[lang] < 50:
    fails.append(f"目标语言 {lang} 的字形只有 {need[lang]} 个 —— 可能根本没写成这个语言")
for f in fails: print("  FAIL:", f)
print("  → " + ("全部通过 OK" if not fails else f"{len(fails)} 项不合格"))
sys.exit(1 if fails else 0)
