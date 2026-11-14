#!/usr/bin/env python3
# W2309 —— 那 12 个作品的 ♪1 情绪字幕重做。
#
# Jing 2026-11-13 明确同意:「请重新生成这 12 个作品的【字幕】……同意/yes。」
# (W2086 那条铁律要求的「先问再做」已经拿到 yes, 且是逐条列出 12 个之后的 yes。)
#
# 为什么要重做: 它们现在的 ♪1 字幕里真的在唱舞台说明 / 曲风 / 配器 ——
# 根因是旧解析器不认【跨行方括号块】, 块的第二行起被当成歌词(W2302/W2303 已修)。
# 解析器修好了, 但【已经落盘的字幕文件】不会自己变干净, 必须重跑一遍对齐。
#
# 关键的三件事:
#
# ① 词源是 user_works.lyrics_preview(实测这 12 个作品 R2 lyrics.json 全 404、
#    work_language_tracks.lyrics 全为空)。所以修好的 normalizeLyricMarkupForParsing
#    一定会作用在它们身上 —— 不需要 ?lyrics_url= 另喂干净词。
#    (若词源是 R2 lyrics.json, 污染就在那份 JSON 的 sections 里, 块的第二行起
#     已经被存成了独立的 lines, 没有开括号行可认, 折叠救不了 —— 那种情况必须 ?lyrics_url=。)
#
# ② 写哪一个文件, 由【这颗 ♪ 现在在读哪一个】决定, 不由方便决定:
#      ♪1 读作品级 subtitle-take1.json      → 普通 POST(不带 take/snap), 重写作品级
#      ♪1 读快照 subtitle-take1--aXXXX.json → ?take=1&voice=…&snap=1, 只重写那个快照
#    反过来做就是【白做一趟】: 重写作品级而 ♪1 读的是快照, 屏幕上一个字不变。
#    实测这 12 个作品【每个只有一条轨、一条 audio 版本行】, 所以不存在
#    「修一条毁一条」(W2289 那三首的处境), 也不会碰到 Jing 要保留的旧情绪字幕。
#
# ③ 旧字节必须先有自己的地址再动手。作品级那个键是写死的
#    works/<id>/subtitle-take1.json —— 重写就是原地覆盖, R2 又没开版本管理。
#    所以先把旧文件按【内容哈希】存到 artifacts/subtitle-archive/sub-<sha24>.json,
#    回读 cmp 字节一致才继续; 存不住就【什么都不做】。
#    (W2061/W2086: 「入库 R2 ≠ 保住旧版。同一个 key 就是原地覆盖。」)
#
# 时长已逐个整段解码核对过(库里 vs 实测差 ≤0.5s, 12/12 一致), 所以这一趟
# 不需要、也不会改任何 duration —— 否则新字幕的 [Music...] 尾奏会按错的长度画(W2306/W2307)。
#
# 串行, 一个一个来(Jing:「不要几路并发, 一个一个来」)。默认干跑, --apply 才真做。
import hashlib, json, os, re, subprocess, sys, time, urllib.request

APPLY = "--apply" in sys.argv
ONLY  = [a for a in sys.argv[1:] if not a.startswith("--")]
LIVE  = os.environ.get("W2309_LIVE", "/tmp/w2308-live.json")
API   = "http://127.0.0.1:3000"
CDN   = "https://cdn.cssstudio.app"
UA    = "Mozilla/5.0 (Macintosh) cssos-audit"
ARC   = "/tmp/w2309-arc"
SEP   = "\x1f"
TOKEN = os.environ.get("CSSOS_ADMIN_TOKEN", "").strip()
os.makedirs(ARC, exist_ok=True)


def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A", "-F", SEP,
                        "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=180)
    if r.returncode:
        print("   QERR", r.stderr[:240]); return None
    return [ln.split(SEP) for ln in r.stdout.strip("\n").split("\n") if ln.strip()]


def get(u, timeout=120):
    try:
        rr = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=timeout)
        return rr.status, rr.read()
    except Exception as e:
        return (getattr(e, "code", None) or -1), b""


sq = lambda s: re.sub(r"\s+", "", str(s or ""))

def match(needle, line):
    """与 w2308 判据逐字相同 —— 换一套写法就等于换了一把尺子。"""
    ns, t = sq(needle), sq(line)
    if not ns or not t: return False
    return t == ns or (len(ns) >= 16 and ns in t) or (len(t) >= 16 and t in ns)


def pick_entry(entries, want):
    """照搬 app.emotion-subtitle-engine.js:141-160: 精确 → 同族 → 占位符兜底。"""
    w = str(want or "")
    for tag in entries:
        if tag == w: return tag
    norm = lambda s: (str(s).lower().split("-")[0] or str(s).lower())
    if w:
        for tag in entries:
            if norm(tag) == norm(w): return tag
    if len(entries) == 1 and str(list(entries)[0]).lower() in {"", "orig", "auto", "und"}:
        return list(entries)[0]
    return None


def entry_lines(blob, lang):
    """一份字幕 → 引擎会读的那个条目的行文本 + 节/行/token 三层的末尾时间。"""
    j = json.loads(blob)
    ents = {}
    for L in (j.get("languages") or []): ents[str(L.get("lang") or "")] = L
    tag = pick_entry(ents, lang)
    if tag is None: return None, None, None
    L = ents[tag]
    # t_end 三层【都是毫秒】(src/index.ts:1269 `t_end: number; // ms`;
    # 行/节的值由 tokens 推出, 同单位)。W2306 的教训是三层都要看, 不是只看 token。
    lines, ends = [], []
    for s in (L.get("sections") or []):
        if s.get("t_end") is not None: ends.append(float(s["t_end"]) / 1000.0)
        for ln in (s.get("lines") or []):
            tx = str(ln.get("text") or "") or "".join(
                str(t.get("char") or "") for t in (ln.get("tokens") or []))
            if tx.strip(): lines.append(tx)
            if ln.get("t_end") is not None: ends.append(float(ln["t_end"]) / 1000.0)
            for t in (ln.get("tokens") or []):
                if t.get("t_end") is not None: ends.append(float(t["t_end"]) / 1000.0)
    return tag, lines, (max(ends) if ends else None)


# [Music...] 是【器乐段】, 不是唱词 —— 它在屏幕上是随机音符 + 四方飘入 emoji(W2217 宪法),
# 不是文字。重做之后它的条数会变(时间轴重算 → injectMusicGaps 重新切缝),
# 把它算进「唱词行数」会让 46→53 看起来像【多唱了 7 行】, 实际是【少唱 1 行说明 + 多 8 段音符】。
IS_GAP = lambda t: str(t).strip() in ("[Music...]", "～")
sung = lambda ls: [l for l in ls if not IS_GAP(l)]


def archive(blob, label):
    """旧字节 → 内容哈希地址, 回读 cmp。存不住返回 None(调用方必须停手)。"""
    sha = hashlib.sha1(blob).hexdigest()[:24]
    key = "artifacts/subtitle-archive/sub-%s.json" % sha
    code = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "25",
                           "-A", UA, "%s/%s" % (CDN, key)], capture_output=True, text=True).stdout.strip()
    if code != "200":
        p = os.path.join(ARC, "%s.json" % sha)
        open(p, "wb").write(blob)
        subprocess.run("cd /srv/cssos/current && node r2putkey.mjs %s %s application/json" % (p, key),
                       shell=True, capture_output=True, text=True, timeout=240)
        time.sleep(2)
    st, rb = get("%s/%s?cb=%d" % (CDN, key, time.time()))
    if st != 200 or rb != blob:
        print("        ‼ %s 存档回读%s —— 这一首什么都不做" % (label, "不到" if st != 200 else "不一致"))
        return None
    return key


# ── 清单 ────────────────────────────────────────────────────────────────────
live = json.load(open(LIVE, encoding="utf-8"))["live"]
JOBS = []
for x in live:
    if ONLY and not any(x["wid"].startswith(o) for o in ONLY): continue
    name = x["sub"].rsplit("/", 1)[-1]
    JOBS.append(dict(x, mode=("work" if name == "subtitle-take1.json" else "snap")))

# --worklevel: 第二趟, 专门清【作品级那一份】。
#
# 为什么要有第二趟: snap 模式只重写 ♪1 真正在读的那个快照, 作品级
# works/<id>/subtitle-take1.json 一个字节不碰(W2270 的 snapshotOnly 就是为此设计的)。
# 于是那 3 首里有 2 首(1a2188fc 9 条针 / 77c9bbaf 2 条针)在作品级那一份里
# 【还留着污染的副本】。它现在是惰性的 —— 版本行的 subtitle_url 指着快照,
# 没有任何轨会回退到作品级。但 user_works.subtitle_take1_json_url 仍指着它,
# 而引擎在「这颗 ♪ 没有自己的 subtitle_url」时就是回退到作品级 ——
# 将来任何一次把版本行那一列清空的写入, 污染就当场复活。
#
# 这一趟就是普通 POST(不带 snap), 把作品级那一份也重写成干净的。
# 实测这 2 首的作品级文件【只有一个语言条目】, 就是那条轨自己的语言, 所以没有附带影响。
WORKLEVEL = "--worklevel" in sys.argv
if WORKLEVEL:
    for j in JOBS:
        j["mode"] = "work"
        j["sub"] = "%s/works/%s/subtitle-take1.json" % (CDN, j["wid"])

print("清单 %d 颗 ♪ · %s%s\n" % (len(JOBS), "真做" if APPLY else "干跑",
                                 " · 第二趟(清作品级那一份)" if WORKLEVEL else ""))
if APPLY and not TOKEN:
    print("‼ 没有 CSSOS_ADMIN_TOKEN —— 停手"); sys.exit(2)

report, bad = [], 0
for j in JOBS:
    wid, lang, voice = j["wid"], j["lang"], j["voice"]
    print("[%s] %s  %s/%s ♪%s  模式=%s" % (wid[:8], j["title"][:40], lang, voice, j["take"], j["mode"]))
    print("        现在读: %s" % j["sub"].rsplit("/", 1)[-1])

    st, old = get(j["sub"] + "?cb=%d" % time.time())
    if st != 200:
        print("        ‼ 旧字幕取不到 HTTP %s —— 跳过" % st); bad += 1; continue
    try:
        otag, olines, oend = entry_lines(old, lang)
    except Exception as e:
        print("        ‼ 旧字幕解析不了 %s —— 跳过" % str(e)[:60]); bad += 1; continue
    ohit = [n for n in j["hits"] if any(match(n, l) for l in olines)]
    print("        改前: 条目[%s] 唱词 %d 行 + 器乐段 %d · 命中 %d 条针 · 末尾 %.1fs"
          % (otag, len(sung(olines)), len(olines) - len(sung(olines)), len(ohit), oend or -1))
    if not ohit:
        print("        · 已经干净了(别人先修过?) —— 跳过, 不动"); continue

    if not APPLY:
        qs = "" if j["mode"] == "work" else "?take=1&voice=%s&snap=1" % voice
        print("        干跑: 会存档旧字节 → POST /api/admin/resubtitle/%s%s\n" % (wid[:8] + "…", qs))
        continue

    key = archive(old, wid[:8])
    if key is None: bad += 1; continue
    print("        旧字节已落 R2 ✅ %s (%d B, 字节级一致)" % (key.rsplit("/", 1)[-1], len(old)))

    url = "%s/api/admin/resubtitle/%s" % (API, wid)
    if j["mode"] == "snap": url += "?take=1&voice=%s&snap=1" % voice
    t0 = time.time()
    r = subprocess.run(["curl", "-s", "-m", "1800", "-X", "POST", url,
                        "-H", "x-admin-token: %s" % TOKEN], capture_output=True, text=True, timeout=1860)
    try:
        resp = json.loads(r.stdout)
    except Exception:
        print("        ‼ 接口返回不是 JSON: %s —— 停手看日志" % r.stdout[:200]); bad += 1; continue
    tracks = resp.get("results") or resp.get("tracks") or []
    mine = [t for t in tracks if str(t.get("lang") or "") in (lang, otag)] or tracks
    okrow = next((t for t in mine if t.get("ok")), None)
    print("        接口 %.0fs ok=%s %s" % (time.time() - t0, resp.get("ok"),
          json.dumps({k: okrow.get(k) for k in ("lang", "words", "lastEnd_s", "dtw", "clamp")} if okrow else mine,
                     ensure_ascii=False)[:230]))
    if not okrow:
        print("        ‼ 这一条没做成 —— 旧字节还在 %s" % key); bad += 1; continue

    time.sleep(3)
    st, new = get(j["sub"] + "?cb=%d" % time.time())
    if st != 200:
        print("        ‼ 新字幕回读 HTTP %s —— 旧字节在 %s" % (st, key)); bad += 1; continue
    ntag, nlines, nend = entry_lines(new, lang)
    nhit = [n for n in j["hits"] if any(match(n, l) for l in nlines)]
    dur = (q("SELECT coalesce(duration_secs,0) FROM work_language_tracks WHERE work_id='%s'::uuid "
             "AND lang='%s' AND coalesce(voice,'auto')='%s' ORDER BY is_default DESC, track_order LIMIT 1;"
             % (wid, lang, voice)) or [["0"]])[0][0]
    over = (nend or 0) - float(dur or 0)
    verdict = "✅全净" if not nhit else "部分净(残留 %d 条)" % len(nhit)
    if over > 0.5: verdict += " ‼末尾超音频 %.1fs" % over
    print("        改后: 条目[%s] 唱词 %d 行 + 器乐段 %d · 命中 %d 条针 · 末尾 %.1fs / 音频 %ss → %s"
          % (ntag, len(sung(nlines)), len(nlines) - len(sung(nlines)), len(nhit), nend or -1, dur, verdict))
    print("        少唱说明行 %d(唱词 %d → %d)" % (len(sung(olines)) - len(sung(nlines)),
          len(sung(olines)), len(sung(nlines))))
    if nhit:
        for n in nhit[:3]: print("              残留: %s" % n[:88])
    if new == old:
        print("        ‼ 新旧字节完全一样 —— 这一趟没落盘(写到别的文件去了?)"); bad += 1
    report.append(dict(wid=wid, title=j["title"], lang=lang, voice=voice, mode=j["mode"],
                       archive=key, old_bytes=len(old), new_bytes=len(new),
                       sung_before=len(sung(olines)), sung_after=len(sung(nlines)),
                       gaps_before=len(olines) - len(sung(olines)), gaps_after=len(nlines) - len(sung(nlines)),
                       hits_before=len(ohit), hits_after=len(nhit),
                       residual=nhit, end_after=nend, audio_dur=float(dur or 0)))
    print()

print("=" * 100)
if APPLY:
    out = "/tmp/w2309-report.json"
    json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    full = [r for r in report if not r["hits_after"]]
    part = [r for r in report if r["hits_after"]]
    print("做成 %d 颗 ♪ · 全净 %d · 部分净 %d · 失败/跳过 %d" % (len(report), len(full), len(part), bad))
    print("少唱的说明行合计 %d 行(只数唱词, 不数 [Music...] 器乐段)"
          % sum(r["sung_before"] - r["sung_after"] for r in report))
    print("已写 %s" % out)
print("VERDICT: W2309 %s(失败/跳过 %d)" % ("真做结束" if APPLY else "干跑结束", bad))
sys.exit(1 if bad else 0)
