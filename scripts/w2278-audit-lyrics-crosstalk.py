#!/usr/bin/env python3
"""W2278 —— 全库扫【歌词串台】: 一个作品的词其实是另一个作品的。

起因(2026-11-08): W2277 分类那 31 首短源 en 作品时发现 6 首的词根本不是本人的 ——
4 首 Albert Einstein + 2 首 Marie Curie, 词是「兰亭 / 归去来兮 / 一壶浊酒」(王羲之·陶渊明),
而且开头还挂着一串裸人名(Ptolemy I / Plato / Marie Curie / Tao Yuanming / Wang Xizhi)。

⚠ 判据【不许】靠 grep「兰亭」。那只能找回我已经看见的那 6 首,
  找不到任何我没看见的 —— 用已知答案当判据, 等于把巡检写成同义反复(W2275 的教训)。
  所以这里只用【结构】信号, 与内容无关:

  D1 同一份词(规范化后逐字节相同)挂在【主题不同】的作品上。
     模板复用会命中, 所以 D1 只报「跨主题」的组, 并把组内主题列出来人眼判。
  D2 词里有【裸名行】, 而那个名字恰好是【库里另一个作品的主题】, 且不是本作品的主题。
     「是别的作品的主题」这一条是硬判据, 必须查库 —— 不能只看「像不像人名」:
     第一版就是只看形状, 于是把丢了方括号的段落标签(Chorus / Pre-Chorus / Bridge /
     Outro)全当成人名, 125 首里一多半是这种假阳性。
     那些丢方括号的标签是【另一种】真毛病(会被引擎当歌词唱出来), 单独报成 D4, 不混进串台。
  D3 词的字形与作品 language 字段矛盾(标 zh 却几乎没汉字, 或反之)。

用法: python3 -I scripts/w2278-audit-lyrics-crosstalk.py [--calibrate]
  --calibrate 用【已知答案】自检: 那 6 首必须被 D2 命中; 命中不了就是判据写坏了。
"""
import os, re, sys, subprocess, hashlib, collections, json

CAL = "--calibrate" in sys.argv
KNOWN = {  # 已知答案(只用于校准, 不用于检测)
    "1ca682d9", "f74b4341", "08ec3505", "34cbfbb4",  # Albert Einstein ×4
    "8a187865", "75021606",                           # Marie Curie ×2
}

def dburl():
    env = os.environ.get("DATABASE_URL")
    if env: return env
    for ln in open("/etc/cssos.env"):
        ln = ln.strip()
        if ln.startswith("DATABASE_URL="):
            return ln.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("FAIL: 找不到 DATABASE_URL —— 别继续, 否则下面每条结论都是空的")

DB = dburl()
SQL = ("\\pset pager off\n\\pset format unaligned\n\\pset tuples_only on\n"
       "SELECT w.id||chr(9)||coalesce(w.title,'')||chr(9)||coalesce(w.civilization,'')"
       "||chr(9)||coalesce(w.language,'')||chr(9)||coalesce(w.status,'')"
       "||chr(9)||coalesce(to_char(w.created_at,'YYYY-MM-DD HH24:MI'),'')"
       "||chr(9)||replace(coalesce(w.lyrics_preview,''),chr(10),'~NL~') "
       "FROM user_works w WHERE btrim(coalesce(w.lyrics_preview,'')) <> '';\n")
open("/tmp/w2278-scan.sql", "w").write(SQL)
r = subprocess.run(["psql", DB, "-X", "-q", "-f", "/tmp/w2278-scan.sql"],
                   capture_output=True, text=True)
if r.returncode: sys.exit("FAIL: psql " + r.stderr[:300])
rows = [l.split("\t", 6) for l in r.stdout.strip().split("\n") if l.count("\t") >= 6]
if len(rows) < 200:
    sys.exit(f"FAIL: 只读到 {len(rows)} 个作品 —— 全库远不止这些, 别信下面的数")
print(f"读到 {len(rows)} 个有词的作品\n")

# ── 主题名: 标题里去掉纪念类后缀与副标题 ──────────────────────────────
STRIP = re.compile(r"\s*(忌辰纪念|诞辰纪念|忌辰|诞辰|纪念日?|纪念)\s*")
def subject(title):
    s = re.split(r"[·•/|(（]", title)[0]
    return STRIP.sub("", s).strip().lower()

# 整行只是一个人名: 2–4 个首字母大写的拉丁词, 允许罗马数字/点/撇
NAMELINE = re.compile(r"^[A-Z][A-Za-z.'-]+(?:\s+(?:[A-Z][A-Za-z.'-]+|[IVX]{1,4})){0,3}$")
def namelines(lyr):
    out = []
    for l in (x.strip() for x in lyr.split("\n")):
        if not l or l.startswith(("[", "【", "〔")): continue
        if len(l) > 40 or " " not in l and len(l) < 3: continue
        if NAMELINE.match(l): out.append(l)
    return out

def norm(lyr):
    return "\n".join(x.strip() for x in lyr.split("\n") if x.strip())

works = []
for wid, title, civ, lang, st, cre, lyr in rows:
    lyr = lyr.replace("~NL~", "\n")
    works.append(dict(id=wid, short=wid[:8], title=title, civ=civ, lang=lang,
                      status=st, created=cre, lyr=lyr, subj=subject(title)))

# ── D1 同一份词, 跨主题 ──────────────────────────────────────────────
by = collections.defaultdict(list)
for w in works:
    by[hashlib.sha1(norm(w["lyr"]).encode()).hexdigest()[:16]].append(w)
d1 = [(h, g) for h, g in by.items() if len({w["subj"] for w in g}) > 1]
print(f"── D1 同一份词挂在不同主题上 —— {len(d1)} 组")
for h, g in sorted(d1, key=lambda x: -len(x[1]))[:25]:
    subs = sorted({w["subj"] for w in g})
    print(f"  [{h}] {len(g)} 首 · {len(subs)} 个主题: {', '.join(s[:22] for s in subs[:6])}"
          + (" …" if len(subs) > 6 else ""))
    for w in sorted(g, key=lambda x: x["title"])[:6]:
        print(f"      {w['short']}  {w['title'][:34]:<34} {w['civ'][:12]:<12} {w['created']}")
    if len(g) > 6: print(f"      … 另 {len(g)-6} 首")

# ── D2 裸名行 == 库里另一个作品的主题 ───────────────────────────────
#    判据来自库本身(全部作品主题的集合), 不是我手写的人名表 —— 手写表只能找回我
#    已经看见的那几个。段落标签(chorus/bridge/…)不会是任何作品的主题, 自动被排除。
ALL_SUBJ = {w["subj"] for w in works if len(w["subj"]) >= 3}
d2, d4 = [], []
SECTION = re.compile(r"^(pre[- ]?chorus|chorus|verse|bridge|outro|intro|hook|refrain|"
                     r"interlude|instrumental|coda|music|post[- ]?chorus|breakdown|drop)"
                     r"(\s*\d+)?$", re.I)
for w in works:
    nl = namelines(w["lyr"])
    foreign = [n for n in nl
               if n.lower() in ALL_SUBJ and n.lower() != w["subj"]
               and n.lower() not in w["title"].lower()]
    if foreign: d2.append((w, nl, foreign))
    lab = [n for n in nl if SECTION.match(n)]
    if lab: d4.append((w, lab))
print(f"\n── D2 词里嵌着【别的作品的主题名】—— {len(d2)} 首")
for w, nl, fo in sorted(d2, key=lambda x: (x[0]["created"], x[0]["title"])):
    print(f"  {w['short']}  {w['created']}  {w['title'][:26]:<26} {w['civ'][:10]:<10} "
          f"别人的名字 {len(fo)}: {', '.join(fo)}")
print(f"\n── D4 段落标签丢了方括号(会被引擎当歌词唱出来)—— {len(d4)} 首")
cnt = collections.Counter(n for _, lab in d4 for n in lab)
print(f"  标签分布: {dict(cnt.most_common(10))}")
for w, lab in sorted(d4, key=lambda x: x[0]["title"])[:12]:
    print(f"  {w['short']}  {w['title'][:30]:<30} {', '.join(lab[:5])}")
if len(d4) > 12: print(f"  … 另 {len(d4)-12} 首")

# ── D3 字形与 language 字段矛盾 ─────────────────────────────────────
d3 = []
for w in works:
    body = [l for l in w["lyr"].split("\n")
            if l.strip() and not l.strip().startswith(("[", "【", "〔"))]
    t = "".join(body)
    han = sum(1 for c in t if "一" <= c <= "鿿")
    lat = sum(1 for c in t if c.isalpha() and ord(c) < 0x250)
    if not (han + lat): continue
    if w["lang"] == "zh" and han * 4 < lat: d3.append((w, han, lat, "标 zh 但几乎全是拉丁"))
    elif w["lang"] in ("en", "it", "la", "de", "fr") and han > lat: d3.append((w, han, lat, f"标 {w['lang']} 但主体是汉字"))
print(f"\n── D3 字形与 language 字段矛盾 —— {len(d3)} 首")
for w, han, lat, why in sorted(d3, key=lambda x: x[0]["title"])[:30]:
    print(f"  {w['short']}  {w['title'][:30]:<30} lang={w['lang']:<4} 汉{han:<4} 拉{lat:<5} {why}")
if len(d3) > 30: print(f"  … 另 {len(d3)-30} 首")

hit = {w["short"] for w, _, _ in d2} | {w["short"] for _, g in d1 for w in g} \
      | {w["short"] for w, _, _, _ in d3} | {w["short"] for w, _ in d4}
print(f"\n汇总: D1 {len(d1)} 组 · D2 {len(d2)} 首 · D3 {len(d3)} 首 · D4 {len(d4)} 首"
      f" · 去重命中 {len(hit)} 首 / 全库 {len(works)}")

if CAL:
    miss = KNOWN - {w["short"] for w, _, _ in d2}
    print(f"\n校准(已知的 6 首必须被 D2 命中): 漏 {len(miss)} {sorted(miss) if miss else ''}")
    if miss: sys.exit("FAIL: 判据没抓到已知答案 —— 先修判据, 别信全库的数")
    print("校准通过 —— D2 能抓到已知答案, 全库的数才有意义")
