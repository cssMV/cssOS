#!/usr/bin/env python3
# W2301 收尾账: 那批长尾语言作品的【每一条有音频的轨】, 现在的字幕状况。
# URL 一律从库里现查(不用旧清单里的) —— 凯撒/奥古斯都的音频已换, 旧 URL 会给出过时的结论。
# 只读。时长一律整段解码(容器头会撒谎, W2297)。
import json, os, re, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
CACHE = "/tmp/w2298-dur-cache.json"
try:
    dur_cache = json.load(open(CACHE))
except Exception:
    dur_cache = {}

# 这个作品库里真有的轨语言 —— 字幕里多一门语言, 只有【有轨选得中它】才算正当的多语言胶囊。
# 我在 W2300 的脚本里写过「同文件另有 en, 是多语言胶囊」—— 那句判错了(奥古斯都没有 en 轨),
# 判据太宽。这里用 W2298 的 A 判据: 问库, 不问文件。

# ⚠ 同一个 (work_id, 音频 url) 在 work_media_versions 里可能有【多条】行(实测全库 46 组
#   这样的重复: 5条×1 / 4条×1 / 3条×3 / 2条×41, Jerusalem 一首就有 13 条 audio 版本行)。
#   地址表是 LEFT JOIN 出来的, 所以同一条轨的同一颗 ♪ 会出现多行。
#   不收成【每颗 ♪ 一条】就是笛卡尔积, 汇总会多报 —— 首跑 Jerusalem vi ♪1 印了 5 次。
#   取值规则: 优先取【有字幕】的那一条(多条都有字幕时取第一条)。
_SUB_OF, AUDIO_OF = {}, {}
_dup = 0
for _l in open("/tmp/w2301-addr2.tsv"):
    _f = _l.rstrip("\n").split("\t")
    if len(_f) < 6:
        _f = _f + [""] * (6 - len(_f))
    _k = (_f[0], _f[1], _f[2], _f[3])
    _sub = _f[4].strip()
    if _k in _SUB_OF:
        _dup += 1
        if not _SUB_OF[_k] and _sub:
            _SUB_OF[_k] = _sub
    else:
        _SUB_OF[_k] = _sub
    AUDIO_OF[_k] = _f[5].strip()
print("地址表: %d 行 → 收成 %d 颗 ♪(折叠掉 %d 行重复版本行)" % (
    len(_SUB_OF) + _dup, len(_SUB_OF), _dup))
ADDR_ROWS = [(k[0], k[1], k[2], k[3], v) for k, v in _SUB_OF.items()]

TRACK_LANGS = {}
for l in open("/tmp/w2301-addr2.tsv"):
    f = l.rstrip("\n").split("\t")
    if len(f) >= 2:
        TRACK_LANGS.setdefault(f[0], set()).add(f[1].strip().lower())


def norm(x):
    v = str(x or "").lower().replace("_", "-")
    return v.split("-")[0] or v


def get(u, as_json=True):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    b = urllib.request.urlopen(req, timeout=60).read()
    return json.loads(b.decode("utf-8", "replace")) if as_json else b


def real_dur(url):
    if url in dur_cache:
        return dur_cache[url]
    try:
        out = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", url, "-f", "null", "-"],
                             capture_output=True, text=True, timeout=600, stdin=subprocess.DEVNULL).stderr
        m = re.findall(r"time=(\d+):(\d+):(\d+\.?\d*)", out)
        if not m:
            return None
        h, mi, s = m[-1]
        d = round(int(h) * 3600 + int(mi) * 60 + float(s), 1)
        dur_cache[url] = d
        json.dump(dur_cache, open(CACHE, "w"))
        return d
    except Exception:
        return None


_raw = [l.rstrip("\n").split("\t") for l in open(sys.argv[1]) if l.strip()]
# ⚠ 清单里同一条轨会出现多行(每行带一个具体音频 URL), 而下面按 (wid,lang,voice) 展开
#   所有 take —— 不先去重就是笛卡尔积, 汇总会【多报】。首跑 Jerusalem vi ♪1 印了 5 次。
rows, _seen = [], set()
for _r in _raw:
    _k = (_r[0], _r[1], _r[2])
    if _k in _seen:
        continue
    _seen.add(_k)
    rows.append(_r)
print("清单 %d 行 → 去重后 %d 条轨" % (len(_raw), len(rows)))
print()
PLACEHOLDER = {"orig", "auto", "und", "unknown", "default", "pre-epic", "orig-pre-epic", ""}

stats = {"OK": 0, "WRONGLANG": 0, "OVERRUN": 0, "SHORT": 0, "ORPHAN": 0, "NOSUB": 0, "UNK": 0}
lines_out = []
for r in rows:
    wid, lang, voice, title, sub_old, au_old = r[0], r[1], r[2], r[3], r[4], r[5]
    key = (wid, lang, voice)
    # 现查: 这条轨的 ♪1/♪2 当前 audio_url + 版本行字幕
    cur = [x for x in ADDR_ROWS if x[0] == wid and x[1] == lang and x[2] == voice]
    if not cur:
        stats["UNK"] += 1
        lines_out.append((wid, lang, voice, title, "?", "判不了: 地址表里没有这条轨"))
        continue
    for _, _, _, take, sub in cur:
        if not sub:
            stats["NOSUB"] += 1
            lines_out.append((wid, lang, voice, title, "♪" + take, "版本行上没有字幕(BLANK_1 那一类, 不在本次范围)"))
            continue
        try:
            doc = get(sub)
        except Exception as e:
            stats["UNK"] += 1
            lines_out.append((wid, lang, voice, title, "♪" + take, "判不了: 字幕取不到 %s" % str(e)[:40]))
            continue
        present = [str(L.get("lang", "")) for L in (doc.get("languages") or [])]
        probs = []
        # A: 本语言条目必须在(占位符 lang 例外 —— 接口会算真语言)
        if lang.lower() not in PLACEHOLDER and lang not in present:
            probs.append("A 没有 %s 条目(只有 %s), 播放端读不到" % (lang, present))
        # A2: 孤儿语言 —— 库里没有轨能选中它
        mine = TRACK_LANGS.get(wid, set())
        orphan = [p for p in present if p.lower() not in PLACEHOLDER
                  and p.lower() not in mine and norm(p) not in {norm(m) for m in mine}]
        if orphan:
            probs.append("孤儿语言 %s(库里没有轨能选中它)" % ",".join(orphan))
        # B: 末尾 vs 实测音频
        ent = next((L for L in (doc.get("languages") or []) if str(L.get("lang", "")) == lang), None)
        if ent is None and len(doc.get("languages") or []) == 1:
            ent = doc["languages"][0]
        cov = None
        if ent is not None:
            ends = []
            for s in (ent.get("sections") or []):
                for ln in (s.get("lines") or []):
                    if isinstance(ln, dict):
                        for t in (ln.get("tokens") or []):
                            if t.get("t_end") is not None:
                                ends.append(t["t_end"])
            au = AUDIO_OF.get((wid, lang, voice, take))
            d = real_dur(au) if au else None
            if ends and d:
                mx = max(ends) / 1000
                cov = mx / d
                if mx > d + 3:
                    probs.append("B 越界 %.1fs > 音频 %.1fs" % (mx, d))
                elif cov < 0.70:
                    probs.append("覆盖只有 %.0f%%(%.1fs / %.1fs)" % (cov * 100, mx, d))
            elif not ends:
                probs.append("没有时间轴")
            elif not d:
                probs.append("判不了: 音频时长量不到")
        verdict = "OK" if not probs else "; ".join(probs)
        if not probs:
            stats["OK"] += 1
        elif any("判不了" in p for p in probs):
            stats["UNK"] += 1
        elif any(p.startswith("A ") for p in probs):
            stats["WRONGLANG"] += 1
        elif any("孤儿" in p for p in probs):
            stats["ORPHAN"] += 1
        elif any("越界" in p for p in probs):
            stats["OVERRUN"] += 1
        else:
            stats["SHORT"] += 1
        lines_out.append((wid, lang, voice, title, "♪" + take,
                          verdict + (" [覆盖 %.0f%%]" % (cov * 100) if cov else "")))

print("%-10s %-6s %-9s %-3s %-26s %s" % ("work", "lang", "voice", "♪", "标题", "结论"))
for wid, lang, voice, title, take, v in lines_out:
    print("%-10s %-6s %-9s %-3s %-26s %s" % (wid[:8], lang, voice, take, title[:26], v))
print()
tot = sum(stats.values())
print("汇总: 共判 %d 条 ♪ · " % tot + " · ".join("%s %d" % (k, v) for k, v in stats.items() if v))
_expect = sum(1 for r in rows for x in ADDR_ROWS if x[0] == r[0] and x[1] == r[1] and x[2] == r[2])
if tot != _expect:
    print("⚠ 对不上: 应判 %d 颗 ♪, 实判 %d —— 有漏检或重复" % (_expect, tot))
else:
    print("一致性: 应判 %d = 实判 %d ✅ 无遗漏无重复" % (_expect, tot))
