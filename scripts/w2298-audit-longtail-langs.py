#!/usr/bin/env python3
"""长尾语言 24 轨的真判据。三个【互相独立】的来源, 一个都不能省:

  A 语言位: 轨声明的 lang 在不在文件里; 文件里有没有【不该有的】别的语言
            (批量1 带着 realLangCodes 的 bug 跑过 42 行, 可能留下多余的 en)
  B 时间轴: 这门语言最后一个字的结束时间 vs 【整段解码出来的】音频时长
            —— 不读 mp3 头(W2297: 头能谎报 +131s), 也不读库里的 duration_secs
  C 正文量: 字幕里这门语言的字数 vs 这条轨自己的歌词字数
            —— 这一条才抓得住「旧条目还在、只有几分之一的词」(gd 51.6s 那种)

A 判「写对了地方」, B 判「写对了时间」, C 判「写的是不是这首歌」。三件事, 三条判据。
"""
import json, os, re, subprocess, sys, urllib.request

def _norm(x):
    """照抄引擎的归一化: 按 '-' 截断。'orig-pre-epic' → 'orig'。"""
    v = str(x or "").lower().replace("_", "-")
    return v.split("-")[0] or v

# 这个作品库里真有的轨语言 —— 字幕里多一门语言, 只要有轨选得中它就是【正当的多语言胶囊】
TRACK_LANGS = {}
for _l in open(os.environ.get("W2298_TRACKLANGS", "/tmp/w2298-tracklangs.txt"), encoding="utf-8"):
    if "|" in _l:
        _w, _g = _l.rstrip("\n").split("|", 1)
        TRACK_LANGS.setdefault(_w, set()).add(_g.strip().lower())

UA = "Mozilla/5.0 (Macintosh) cssos-audit"

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8", "replace")), None
    except Exception as e:
        return None, str(e)[:70]

_DCACHE_PATH = "/tmp/w2298-dur-cache.json"
try:    _DCACHE = json.load(open(_DCACHE_PATH, encoding="utf-8"))
except Exception: _DCACHE = {}

def decoded_secs(url):
    """整段解码一遍 —— 唯一诚实的尺子(W2297)。结果缓存, 重跑不再付一次解码。"""
    if url in _DCACHE: return _DCACHE[url]
    v = _decode(url)
    if v is not None:
        _DCACHE[url] = v
        try: json.dump(_DCACHE, open(_DCACHE_PATH, "w", encoding="utf-8"))
        except Exception: pass
    return v

def _decode(url):
    try:
        p = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", url, "-f", "null", "-"],
                           capture_output=True, text=True, timeout=600, stdin=subprocess.DEVNULL)
        m = re.findall(r"time=(\d+):(\d+):(\d+\.\d+)", p.stderr)
        if not m: return None
        h, mi, s = m[-1]; return int(h) * 3600 + int(mi) * 60 + float(s)
    except Exception:
        return None

def lang_stats(d, want):
    """这门语言的: 末尾秒 + 字数。"""
    ends, chars = [], 0
    for lg in (d.get("languages") or []):
        if str(lg.get("lang", "")).strip().lower() != want: continue
        for s in (lg.get("sections") or []):
            for ln in (s.get("lines") or []):
                for t in (ln.get("tokens") or []):
                    c = str(t.get("char", ""))
                    if c.strip(): chars += len(c.strip())
                    v = t.get("t_end")
                    if isinstance(v, (int, float)): ends.append(float(v))
    return (max(ends) / 1000 if ends else None), chars

def _sub_lines(d, want):
    out = []
    for lg in (d.get("languages") or []):
        if str(lg.get("lang", "")).strip().lower() != want: continue
        for sec in (lg.get("sections") or []):
            for ln in (sec.get("lines") or []):
                t = "".join(str(tk.get("char", "")) for tk in (ln.get("tokens") or []))
                if t.strip(): out.append(t.strip())
    return out

def _sub_text(d, want): return " ".join(_sub_lines(d, want))

def _latin_share(s):
    s = re.sub(r"[\W_\d]+", "", str(s or ""), flags=re.UNICODE)
    return (sum(1 for c in s if "a" <= c.lower() <= "z") / len(s)) if s else 0.0

def _lyr_lines(lyr):
    raw = (lyr or "").replace("<<NL>>", "\n")
    return [x.strip() for x in raw.split("\n")
            if x.strip() and not x.strip().startswith("[") and not x.strip().startswith("#")
            and not re.fullmatch(r"[\W_]+", x.strip())]

def _flat(s):
    """只留字母与数字。
    ⚠ 原来写的是 [^\w\u0080-\uffff] —— 那个区间把【破折号 U+2014、弯引号】也当成要保留的字符
    (本意只是保住 CJK)。于是歌词里 'Beathach no duine — laoch…' 带着破折号, 字幕 token 里没有,
    一份好字幕被判成对不上(校准时 Cú Chulainn 正是这样被误杀)。\w 在 Python3 对 str 本就是
    Unicode 感知的, CJK/àèì 都算 \w, 不需要补那个区间。"""
    return re.sub(r"[\W_]+", "", str(s or ""), flags=re.UNICODE).lower()

def _tail_pos(d, want, lyr):
    """字幕末句落在歌词第几行(与时长完全无关的另一条来源)。"""
    sl, ll = _sub_lines(d, want), _lyr_lines(lyr)
    if not sl or not ll: return None, len(ll)
    tail = _flat(sl[-1]); pos = None
    for i, L in enumerate(ll):
        f = _flat(L)
        if f and (f in tail or tail in f): pos = i
    return pos, len(ll)

rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
print(f"清单 {len(rows)} 轨\n")
hdr = f"{'判定':12} {'lang':5} {'作品':24} {'字幕末':>8} {'音频':>8} {'字幕字':>6} {'歌词字':>6}  说明"
print(hdr); print("-" * len(hdr))
tally, judged, bad_rows = {}, 0, []
for wid, lang, voice, title, suburl, audurl, lyr in rows:
    judged += 1
    d, err = fetch_json(suburl) if suburl != "-" else (None, "无字幕URL")
    if d is None:
        v = "取不到"; detail = f"字幕取不到: {err}"
        end = aud = None; ch = 0
    else:
        present = [str(x.get("lang", "")).strip().lower() for x in (d.get("languages") or [])]
        end, ch = lang_stats(d, lang)
        aud = decoded_secs(audurl) if audurl != "-" else None
        lyrch = len(re.sub(r"\[[^\]]*\]|\s", "", (lyr or "").replace("<<NL>>", " ")))
        probs, notes = [], []
        # A 语言位
        if lang not in present: probs.append(f"A:文件里没有 {lang}(只有 {','.join(present) or '空'})")
        mine = TRACK_LANGS.get(wid, set())
        orphan = [p for p in present if p != lang
                  and p not in mine and _norm(p) not in {_norm(m) for m in mine}]
        if orphan: probs.append(f"A:孤儿语言 {','.join(orphan)}(库里没有能选中它的轨)")
        # B 时间轴
        if end is None: probs.append("B:这门语言没有时间轴")
        elif aud is None: probs.append("B:音频量不到 —— 判不了(不动)")
        elif end > aud + 3: probs.append(f"B:越界 {end:.1f}s > 音频 {aud:.1f}s")
        # C 正文量
        if lyrch == 0: probs.append("C:轨上没有歌词 —— 判不了")
        elif ch < lyrch * 0.55: probs.append(f"C:字幕只有 {ch} 字, 歌词 {lyrch} 字(不足 55%) —— 像是旧条目没换掉")
        elif ch > lyrch * 1.5:
            sub_latin = _latin_share(_sub_text(d, lang)); lyr_latin = _latin_share(lyr)
            if abs(sub_latin - lyr_latin) > 0.4:
                notes.append(f"C:字数差大但字形不同(字幕拉丁 {sub_latin:.0%} / 歌词 {lyr_latin:.0%}) —— 像是转写, 判不了")
            else:
                probs.append(f"C:字幕 {ch} 字 比歌词 {lyrch} 字 多出一半 —— 唱的不是这份词?")
        # D 覆盖率: 后半首有没有字幕。单问「有没有越界」的判据看不见这一头(W2297 的同一个毛病)
        if end is not None and aud and end < aud * 0.75:
            at, tot = _tail_pos(d, lang, lyr)
            if tot and at is not None and at >= tot - 2:
                notes.append(f"D:只盖了 {end/aud*100:.0f}%, 但字幕唱到歌词第 {at+1}/{tot} 行 —— 后面是尾奏, 不是漏字幕")
            else:
                probs.append(f"D:字幕只到 {end:.1f}s, 音频 {aud:.1f}s —— 只盖了 {end/aud*100:.0f}%" +
                             (f", 且只唱到歌词第 {at+1}/{tot} 行 = 真截断" if (tot and at is not None) else ", 且末句在歌词里对不上"))
        # E 速率: 唱得过来吗。中文极限约 6 字/秒, 拉丁字母按字母数算可到 ~12
        if end is not None and end > 1 and ch:
            rate = ch / end
            if rate > 12: probs.append(f"E:{rate:.1f} 字/秒 —— 唱不出来, 时间轴是压缩的")
        v = "✅ 好" if not probs else "⚠ 有问题"
        detail = "; ".join(probs) if probs else ("; ".join(notes) if notes else "落在音频内, 唱到词尾, 字数相称")
    tally[v] = tally.get(v, 0) + 1
    if v != "✅ 好": bad_rows.append((wid, lang, voice, title, detail))
    lyrch_s = len(re.sub(r"\[[^\]]*\]|\s", "", (lyr or "").replace("<<NL>>", " ")))
    print(f"{v:12} {lang:5} {title[:22]:24} {('%.1f'%end if end else '-'):>8} "
          f"{('%.1f'%aud if aud else '-'):>8} {ch:>6} {lyrch_s:>6}  {detail}")

print(f"\n--- 汇总 ---\n清单 {len(rows)} 轨, 实际判了 {judged} 轨 " +
      ("✅无遗漏" if judged == len(rows) else "⚠有漏"))
for k in sorted(tally): print(f"  {k:12} {tally[k]}")
with open("/tmp/w2298-need.tsv", "w", encoding="utf-8") as f:
    for wid, lang, voice, title, detail in bad_rows:
        f.write(f"{wid}\t{lang}\t{voice}\tLONGTAIL\t{title}\t{detail}\n")
print(f"\n要处理的 {len(bad_rows)} 轨 → /tmp/w2298-need.tsv")
