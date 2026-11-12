#!/usr/bin/env python3
"""W2302 第六件: 15 条【版本行上没有字幕】的只读 triage。

Jing 批准了我的建议 —— 先查清【为什么没有】, 再决定动不动。
BLANK_1 这一类从来没被授权过批量做, 因为「没有字幕」有好几种完全不同的原因,
混在一起做就会用同一把锤子砸不同的钉子:

  A 没有版本行          —— 这颗 ♪ 根本没在 work_media_versions 里登记(登记就有地方放字幕)
  B 有版本行, subtitle_url 空 —— 登记了但没做过字幕
  C 作品级能回退读到    —— 播放端其实有字幕看(只是不是这一版自己的)
  D 歌词源脏/空         —— 现在做字幕只会把脏东西对齐一遍(先治歌词)
  E 音频量不到          —— 判不了, 不许动(错尺子比不量更坏)

只读。不写任何东西。
"""
import json, re, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
CACHE = "/tmp/w2298-dur-cache.json"
try:
    dur_cache = json.load(open(CACHE))
except Exception:
    dur_cache = {}


def get(u):
    return urllib.request.urlopen(
        urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read()


def real_dur(url):
    if url in dur_cache:
        return dur_cache[url]
    try:
        out = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", url, "-f", "null", "-"],
                             capture_output=True, text=True, timeout=600,
                             stdin=subprocess.DEVNULL).stderr
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


DIRTY = ("Prompt:", "Lead:", "Ambient:", "Lighting", "Tempo:", "The stage opens",
         "I notice that", "How I can help", "actual target language",
         "This new composition", "If you'd like me to")

rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1]) if l.strip()]
print("%-10s %-5s %-9s %-3s %-22s %s" % ("work", "lang", "voice", "♪", "标题", "诊断"))
buckets = {}
for r in rows:
    wid, lang, voice, take, title, au, has_ver, sub, lyr_len, lyr_head, wlvl = r
    diag = []
    d = real_dur(au) if au else None
    if has_ver == "0":
        diag.append("A 没有版本行(这颗 ♪ 没在 work_media_versions 里登记)")
    elif not sub:
        diag.append("B 有版本行但 subtitle_url 空")
    # 作品级能不能回退读到
    try:
        wd = json.loads(get("https://cdn.cssstudio.app/works/%s/subtitle-take1.json" % wid))
        wlangs = [str(L.get("lang", "")) for L in (wd.get("languages") or [])]
        n = {str(L.get("lang", "")): sum(len(s.get("lines") or [])
                                         for s in (L.get("sections") or []))
             for L in (wd.get("languages") or [])}
        if lang in wlangs:
            diag.append("C 作品级有 %s(%d 行) → 播放端能回退看到" % (lang, n[lang]))
        else:
            diag.append("作品级只有 %s" % wlangs)
    except Exception as e:
        diag.append("作品级取不到(%s)" % str(e)[:28])
    # 歌词源
    if lyr_len == "0":
        diag.append("D 轨上没有歌词")
    elif any(k in lyr_head for k in DIRTY):
        diag.append("D 轨歌词里有不该唱的东西")
    if d is None:
        diag.append("E 音频量不到 —— 判不了")
    else:
        diag.append("音频 %.1fs" % d)
    key = diag[0].split(" ")[0] if diag else "?"
    buckets[key] = buckets.get(key, 0) + 1
    print("%-10s %-5s %-9s %-3s %-22s %s" % (wid[:8], lang, voice, take, title[:22], " · ".join(diag)))

print()
print("清单 %d 条 · 实际判 %d 条 %s" % (
    len(rows), sum(buckets.values()),
    "✅ 无遗漏" if sum(buckets.values()) == len(rows) else "⚠ 对不上"))
print("分桶: " + " · ".join("%s=%d" % (k, v) for k, v in sorted(buckets.items())))
