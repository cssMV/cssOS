#!/usr/bin/env python3
# W2301: 给批量3(W2296/W2297 的 155 行)补一个【独立维度】——
#        字幕正文里有没有 LLM 的说明行。只读, 不写任何东西。
#
# 为什么用【形状】而不是拿歌词去比:
#   污染常常就在歌词源上(W2298 的 Cocijo / Valhǫll —— 脏的是 R2 lyrics.json)。
#   拿歌词比字幕 = 两边同源 = 同义反复, 必然给出漂亮的假通过(W2275 第 5 条教训)。
#   形状判据与歌词源无关, 是真正独立的第二个来源。
#
# 判据(W2298 实测在两个作品上一次命中、零误伤):
#   整行拉丁字母占比 > 90%  且  长度 > 该条目正文中位行长 × 3
#
# 双向校准(W2298 第 7 条铁律): CALIBRATE=1 必须【已知坏的报错 + 已知好的通过】两头都成立。
#   已知好的样本故意选【拉丁字形的真歌词】(mi / yo / gd …) —— 中文歌词天然没有拉丁长行,
#   拿它校准等于没校准; 尺子最可能误伤的恰恰是拉丁字形的长尾语言。
import json, sys, os, re, statistics, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
ADDR_TSV = "/tmp/w2301-addr.tsv"
BAD_SAMPLE = "/tmp/w2298-archive/0d8574c2-auto-take1.before.json"   # Cocijo 改前: 第24行是英文说明


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as f:
        return f.read()


def latin_ratio(s):
    t = re.sub(r"[\W_\d]+", "", s, flags=re.UNICODE)
    if not t:
        return 0.0
    return sum(1 for c in t if "a" <= c.lower() <= "z") / len(t)


def body_of(doc, lang):
    """取该语言条目的正文行。返回 (body, 实际 lang, 错误原因)"""
    langs = doc.get("languages") or []
    ent = None
    for L in langs:
        if str(L.get("lang", "")) == lang:
            ent = L
            break
    if ent is None and len(langs) == 1:
        ent = langs[0]
    if ent is None:
        return None, None, "文件里没有 %s(有 %s)" % (lang, [L.get("lang") for L in langs])
    out = []
    for sec in (ent.get("sections") or []):
        for ln in (sec.get("lines") or []):
            txt = ln.get("text") if isinstance(ln, dict) else str(ln)
            txt = (txt or "").strip()
            if txt and not re.match(r"^\s*\[", txt):
                out.append(txt)
    return out, str(ent.get("lang", "")), None


def judge(body):
    """返回疑似说明行的列表; None = 正文不足 4 行, 取不出中位 → 判不了, 不算通过"""
    if len(body) < 4:
        return None
    med = statistics.median(len(b) for b in body)
    return [b for b in body if len(b) > med * 3 and latin_ratio(b) > 0.90]


def calibrate():
    ok = True
    # ① 已知坏 —— 必须报出来
    try:
        doc = json.load(open(BAD_SAMPLE))
        body, _, err = body_of(doc, "zap")
        if err:
            print("  ❌ 已知坏样本取不到正文: %s" % err); ok = False
        else:
            h = judge(body)
            hit = bool(h)
            print("  %s 已知坏 · Cocijo zap 改前 —— 正文 %d 行, 中位 %.0f, 报出 %d 行" % (
                "✅" if hit else "❌", len(body), statistics.median(len(b) for b in body), len(h or [])))
            if h:
                print("       首个: %s" % h[0][:100])
            if not hit:
                ok = False
    except Exception as e:
        print("  ❌ 已知坏样本读不到: %s" % e); ok = False

    # ② 已知好 —— 必须干净通过(故意选拉丁字形的真歌词)
    good = os.environ.get("CAL_GOOD", "")
    if not good:
        print("  ❌ 没给 CAL_GOOD='<url>|<lang>' —— 【已知好】那一头没校准, 不算校准过")
        return 1
    for one in good.split(";"):
        one = one.strip()
        if not one:
            continue
        u, _, lg = one.partition("|")
        try:
            doc = json.loads(get(u))
        except Exception as e:
            print("  ❌ 已知好样本取不到(%s): %s" % (lg, e)); ok = False; continue
        body, _, err = body_of(doc, lg)
        if err:
            print("  ❌ 已知好 %s 取不到正文: %s" % (lg, err)); ok = False; continue
        h = judge(body)
        if h is None:
            print("  ❌ 已知好 %s 正文仅 %d 行, 判不了" % (lg, len(body))); ok = False; continue
        clean = not h
        print("  %s 已知好 · %s(拉丁字形真歌词)—— 正文 %d 行, 中位 %.0f, 报出 %d 行" % (
            "✅" if clean else "❌", lg, len(body),
            statistics.median(len(b) for b in body), len(h)))
        if h:
            print("       误伤了: %s" % h[0][:100])
        if not clean:
            ok = False

    print()
    if ok:
        print("校准通过 —— 已知坏的报错 ✅ / 已知好的通过 ✅。两头都站得住, 可以跑全量。")
        return 0
    print("校准没过 —— 不要用它跑全量。一把永远报错(或永远通过)的尺子比不量更坏。")
    return 1


def main():
    if os.environ.get("CALIBRATE") == "1":
        return calibrate()

    addr = {}
    for line in open(ADDR_TSV):
        f = line.rstrip("\n").split("\t")
        if len(f) >= 5:
            addr[(f[0], f[1], f[2], f[3])] = f[4].strip()
        elif len(f) == 4:
            addr[(f[0], f[1], f[2], f[3])] = ""

    rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1]) if l.strip()]
    skip = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else set()

    seen, hits, unk, scanned, skipped = set(), [], [], 0, 0
    for r in rows:
        wid, lang, voice, take = r[0], r[1], r[2], r[3]
        if wid in skip:
            skipped += 1
            continue
        key = (wid, lang, voice, take)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        print("%s %s/%s ♪%s ... " % (wid[:8], lang, voice, take), end="", flush=True)

        u = addr.get(key)
        if u is None:
            unk.append((wid, lang, voice, take, "地址表里没有这一条"))
            print("判不了(地址表无此行)"); continue
        if not u:
            unk.append((wid, lang, voice, take, "版本行上没有字幕"))
            print("判不了(版本行空)"); continue
        try:
            doc = json.loads(get(u))
        except Exception as e:
            unk.append((wid, lang, voice, take, "取不到: %s" % e))
            print("判不了(%s)" % e); continue

        body, wl, err = body_of(doc, lang)
        if err:
            unk.append((wid, lang, voice, take, err))
            print("判不了(%s)" % err); continue
        scanned += 1
        h = judge(body)
        if h is None:
            print("OK(正文仅 %d 行, 取不出中位)" % len(body)); continue
        if h:
            hits.append((wid, lang, voice, take, len(body), h))
            print("‼ %d 行疑似说明 | 首个: %s" % (len(h), h[0][:70]))
        else:
            print("OK(%d 行, 中位 %.0f)" % (len(body), statistics.median(len(x) for x in body)))

    print()
    print("汇总: 清单 %d 行 · 去重后 %d 条 · 跳过 %d · 实际判 %d · 疑似说明 %d · 判不了 %d" % (
        len(rows), len(seen), skipped, scanned, len(hits), len(unk)))
    if scanned + len(unk) != len(seen):
        print("⚠ 对不上: 判了 %d + 判不了 %d ≠ 去重 %d —— 有静默漏检" % (scanned, len(unk), len(seen)))
    if hits:
        print("\n--- 疑似说明行 ---")
        for wid, lang, voice, take, n, h in hits:
            print("%s %s/%s ♪%s (%d 行正文)" % (wid, lang, voice, take, n))
            for b in h:
                print("    %s" % b[:170])
    if unk:
        print("\n--- 判不了(必须单独看, 一个都不算通过)---")
        for x in unk:
            print("   ", x)
    return 0


if __name__ == "__main__":
    sys.exit(main())
