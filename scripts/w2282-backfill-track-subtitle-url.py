#!/usr/bin/env python3
"""W2282 回填 —— 给每条轨挂上【它自己那一版】的字幕快照。

由来: src/index.ts:2681 漏传 audioUrl 整整三个月, 于是 upsertSubtitleJson 里那段
W2086 版本级快照从来没为【生成语言轨】这条路跑过。全库 1355 条轨的 subtitle_url 是空的,
播放端只能回退作品级那一份 —— 同一语言有两个版本时就是「旧版歌声配新版时间轴」。
代码已修(W2282), 这个脚本管存量。

⚠ 只回填【能确定归属】的。作品级 subtitle-take1.json 按语言分条, 一个语言只有一条,
  所以同一语言挂着两条以上轨时, 那一条到底是谁的【判不了】—— 判不了就不写, 不猜。
  (「取不到」≠「没有」, 「判不了」≠「可以蒙一个」。)

归属判据(三条都要过, 不是「有就挂」):
  ① 结构: 同一语言只此一条轨 —— 这一条才是真正确立归属的, 上面那个 SQL 过滤就是它。
  ② 唱词对得上: 作品级那条 languages[lang] 与【这条轨的词】逐行归一化后重合 ≥ 50%。
     词的来源两级: 先用轨自己的 lyrics; 全库 1079 条候选里 985 条这一列是空的,
     那就退到 user_works.lyrics_preview。
     ⚠ 退到 lyrics_preview 不怕它被串台污染(W2278 那 78 首): 这里问的是
       「这份字幕是不是这段音频的」, 字幕本来就是按【实际唱出来的词】对齐的 ——
       污染只会让重合率变低 → 跳过, 是保守方向, 不会挂错。
  ③ 时间轴属于 ♪1: 字幕最后一个字的收尾不得超过这条轨 duration_secs + 5s。
     为什么要这一条: W2270 之前, resubtitle ?take=2 会读-改-写作品级 take1.json,
     于是某些作品的 take1.json 里装的其实是【♪2 的时间轴】。
     ♪1 与 ♪2 唱的是同一份词, 判据 ② 完全分不开它们 —— 只有时长能分。
     时长为空就判不了(不猜), 跳过。

写库四条(与 w2281-style-to-english.py / fill-null-track-duration 同一套, 不另立):
  · 只写 coalesce(subtitle_url,'')='' 的行
  · 一行一条 UPDATE, 带 audio_url 二次匹配(URL 变了说明轨被换过, 不写)
  · 默认干跑, 真写必须 --apply
  · 每条写完回读: 库里的值 / HTTP 200 / 字节与我上传的那份逐字节相同

R2 永不覆盖: 键 = sha1(音频URL)[:10], 已存在就先 cmp —— 字节一样就接受(幂等),
不一样就跳过并报出来。

用法(api-vm, 要 DATABASE_URL, 从 /srv/cssos/current 跑好让 r2putkey.mjs 在手边):
  python3 -I scripts/w2282-backfill-track-subtitle-url.py --calibrate   # 先在已知答案上校准
  python3 -I scripts/w2282-backfill-track-subtitle-url.py               # 干跑全库
  python3 -I scripts/w2282-backfill-track-subtitle-url.py --apply
  python3 -I scripts/w2282-backfill-track-subtitle-url.py --apply --limit=50
"""
import hashlib, json, os, re, subprocess, sys, urllib.request

APPLY = "--apply" in sys.argv
VERIFY = "--verify" in sys.argv
CAL = "--calibrate" in sys.argv
LIMIT = int((next((a for a in sys.argv if a.startswith("--limit=")), "--limit=0")).split("=")[1])
CUR = "/srv/cssos/current"
CDN = "https://cdn.cssstudio.app"
WORK = "/tmp/w2282"
os.makedirs(WORK, exist_ok=True)

def dburl():
    env = os.environ.get("DATABASE_URL")
    if env: return env
    try:
        for ln in open("/etc/cssos.env"):
            ln = ln.strip()
            if ln.startswith("DATABASE_URL="):
                return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError: pass
    sys.exit("FAIL: 找不到 DATABASE_URL —— 别继续, 否则下面每条结论都是空的")
DB = dburl()

def psql(sql):
    r = subprocess.run(["psql", DB, "-X", "-q"],
                       input="\\pset format unaligned\n\\pset tuples_only on\n" + sql,
                       capture_output=True, text=True)
    if r.returncode: sys.exit("FAIL: psql " + r.stderr[:400])
    return r.stdout

def fetch(url, dest=None, tries=3):
    """返回 bytes; 取不到返回 None。【取不到】与【没有】是两件事, 调用方必须分开处理。"""
    for _ in range(tries):
        try:
            req = urllib.request.Request(url + ("&" if "?" in url else "?") + "cb=w2282",
                                         headers={"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"})
            b = urllib.request.urlopen(req, timeout=60).read()
            if dest: open(dest, "wb").write(b)
            return b
        except Exception:
            continue
    return None

# ── 归属判据 ──────────────────────────────────────────────────────────────
_strip = re.compile(r"[^0-9a-z㐀-䶿一-鿿぀-ヿऀ-ॿͰ-ϿЀ-ӿ]+")
def norm(t): return _strip.sub("", str(t).lower())

def lyric_lines(lyr):
    out = []
    for l in str(lyr or "").split("\n"):
        l = l.strip()
        if not l or l[0] in "[【〔(（": continue
        n = norm(l)
        if n: out.append(n)
    return out

def sub_lines(entry):
    out = []
    for sec in (entry.get("sections") or []):
        for li in (sec.get("lines") or []):
            t = str(li.get("text", "")).strip()
            if not t or t[0] in "[【〔": continue
            n = norm(t)
            if n: out.append(n)
    return out

def last_end_s(entry):
    """字幕最后一个字的收尾(秒)。tokens 用 t_end 毫秒(真源: app.emotion-subtitle-engine.js),
    取不到就返回 None —— 【取不到】不等于【0】。"""
    best = None
    for sec in (entry.get("sections") or []):
        for li in (sec.get("lines") or []):
            for tk in (li.get("tokens") or []):
                for k in ("t_end", "end_ms"):
                    v = tk.get(k)
                    if isinstance(v, (int, float)) and v > 0:
                        best = max(best or 0.0, float(v) / 1000.0)
            for k in ("end_s", "t_end_s"):
                v = li.get(k)
                if isinstance(v, (int, float)) and v > 0:
                    best = max(best or 0.0, float(v))
    return best

def belongs(lyr, entry, dur=None):
    """(ok, 说明) —— 判不了时 ok=False 且说明里写清是哪一种判不了。"""
    sl = sub_lines(entry)
    ll = set(lyric_lines(lyr))
    if not sl: return (False, "字幕里一行唱词也没有")
    if not ll: return (False, "没有可比的词(轨与作品都没有)—— 判不了")
    hit = sum(1 for s in sl if s in ll) / len(sl)
    base = f"重合 {hit:.0%}({len(sl)} 行字幕 / {len(ll)} 行唱词)"
    if hit < 0.5: return (False, base)
    # ③ 时间轴必须属于 ♪1
    le = last_end_s(entry)
    if dur is None or dur <= 0:
        return (False, base + " · 但轨时长为空, 分不清是 ♪1 还是 ♪2 的时间轴 —— 判不了")
    if le is None:
        return (False, base + " · 但字幕里取不到收尾时间, 判不了")
    if le > dur + 5:
        return (False, base + f" · 字幕收尾 {le:.0f}s > ♪1 时长 {dur}s+5 —— 像 ♪2 的时间轴, 不挂")
    return (True, base + f" · 收尾 {le:.0f}s ≤ ♪1 {dur}s")

# ── 校准: 拿已知答案三个方向试判据 ────────────────────────────────────────
if CAL:
    print("校准 —— 四个方向用真样本(答案已知, 只读不写), 第五条用合成输入试时长那一维\n")
    rows = psql("SELECT id||'|'||coalesce(subtitle_url,'')||'|'||coalesce(duration_secs,0)||'|'||"
                "replace(coalesce(lyrics,''),chr(10),'~NL~') "
                "FROM work_language_tracks WHERE id IN (1547,1548,1783) ORDER BY id;")
    data = {}
    for ln in rows.strip().split("\n"):
        if not ln.strip(): continue
        tid, su, dur, lyr = ln.split("|", 3)
        data[int(tid)] = (su, int(dur or 0), lyr.replace("~NL~", "\n"))
    need = {1547, 1548, 1783}
    if set(data) != need:
        sys.exit(f"FAIL: 校准样本查到 {sorted(data)}, 要 {sorted(need)} —— 先修样本, 别降判据")
    def ent(url, lang):
        b = fetch(url)
        if b is None: sys.exit(f"FAIL: 校准样本取不到 {url} —— 【取不到】不算校准通过")
        j = json.loads(b)
        hit = [L for L in (j.get("languages") or []) if str(L.get("lang", "")).lower().startswith(lang)]
        if not hit: sys.exit(f"FAIL: 校准样本 {url} 里没有 {lang} 条目")
        return hit[0]
    e_en = ent(data[1547][0], "en")     # 86a49ef7 的英文版
    e_ja = ent(data[1548][0], "ja")     # 同一作品的日文版
    e_new = ent(data[1783][0], "en")    # Dog walker 新版
    checks = [
        ("1547 的英文词 × 它自己的英文字幕 → 对得上", data[1547][2], e_en,  data[1547][1], True),
        ("1547 的英文词 × 同作品的【日文】字幕 → 对不上", data[1547][2], e_ja, data[1547][1], False),
        ("1783 的手写词 × 它自己的新版字幕 → 对得上", data[1783][2], e_new, data[1783][1], True),
        ("1783 的手写词 × 1547 那首的字幕 → 对不上", data[1783][2], e_en,  data[1783][1], False),
        # 合成: 词与字幕本来对得上, 只把时长改成 30s —— 时长这一维必须单独把它拦下
        ("1783 对得上的那对, 但把 ♪1 时长按成 30s → 必须被时长拦下", data[1783][2], e_new, 30, False),
    ]
    bad = 0
    for label, lyr, entry, dur, want in checks:
        ok, why = belongs(lyr, entry, dur)
        if ok != want: bad += 1
        print(f"  {'OK  ' if ok == want else 'FAIL'} {label}  →  判{'对得上' if ok else '对不上'} · {why}")
    print()
    if bad: sys.exit(f"FAIL: 校准 {bad} 项不符 —— 判据写坏了, 全库的数一个也不要信")
    print("校准通过(五个方向都对, 含时长那一维) —— 可以上全库")
    sys.exit(0)

# ── --verify: 把【已经挂上值】的逐条验一遍 ────────────────────────────────
#    判据三条, 任一不过就报出来:
#      · 挂的地址必须等于 sha1(这条轨自己的 audio_url)[:10] 算出来的那个键
#        —— 不等于就说明它挂的是【别人的音频】那一版的字幕
#      · 这个地址取得下来(HTTP 200)
#      · 取下来的内容里有这条轨那个语言的条目
if VERIFY:
    rows = psql("""
    SELECT lt.id||'|'||lt.work_id::text||'|'||lt.lang||'|'||lt.audio_url||'|'||lt.subtitle_url
      FROM work_language_tracks lt
     WHERE coalesce(lt.subtitle_url,'') <> '' AND coalesce(lt.audio_url,'') <> ''
     ORDER BY lt.id;
    """)
    items = []
    for ln in rows.strip().split("\n"):
        if not ln.strip(): continue
        p = ln.split("|", 4)
        if len(p) < 5: continue
        items.append(p)
    print(f"要验 {len(items)} 条（有 subtitle_url 且有音频的轨）\n")
    v_ok = v_bad = 0
    why_cnt = {}
    for tid, wid, lang, au, su in items:
        want = f"{CDN}/works/{wid}/subtitle-take1--a{hashlib.sha1(au.encode()).hexdigest()[:10]}.json"
        prob = []
        if su != want:
            prob.append("挂的地址不是按【自己这条音频】算出来的键")
        b = fetch(su, tries=2)
        if b is None:
            prob.append("取不到(HTTP 非 200)")
        else:
            try:
                j = json.loads(b)
                if not [L for L in (j.get("languages") or [])
                        if str(L.get("lang", "")).lower() == lang.lower()]:
                    prob.append(f"内容里没有 {lang} 条目")
            except Exception:
                prob.append("内容不是合法 JSON")
        if prob:
            v_bad += 1
            for x in prob: why_cnt[x] = why_cnt.get(x, 0) + 1
            print(f"  FAIL 轨{tid} {wid[:8]} {lang}: {', '.join(prob)}")
        else:
            v_ok += 1
    print(f"\n验收汇总: 要验 {len(items)} · 过 {v_ok} · 不过 {v_bad}")
    if why_cnt:
        print("不过的原因分布: " + ", ".join(f"{k} {v}" for k, v in sorted(why_cnt.items(), key=lambda x: -x[1])))
    if v_ok + v_bad != len(items):
        sys.exit("FAIL: 过+不过 ≠ 要验 —— 自己的账对不上")
    sys.exit(1 if v_bad else 0)

# ── 取回填清单 ────────────────────────────────────────────────────────────
rows = psql("""
SELECT lt.id||'|'||lt.work_id::text||'|'||lt.lang||'|'||lt.voice||'|'||lt.audio_url
       ||'|'||w.subtitle_take1_json_url||'|'||coalesce(lt.duration_secs,0)
       ||'|'||replace(coalesce(nullif(btrim(lt.lyrics),''), coalesce(w.lyrics_preview,'')),chr(10),'~NL~')
  FROM work_language_tracks lt
  JOIN user_works w ON w.id = lt.work_id
 WHERE coalesce(lt.subtitle_url,'') = ''
   AND lt.status = 'ready'
   AND coalesce(lt.audio_url,'') <> ''
   AND coalesce(w.subtitle_take1_json_url,'') <> ''
   AND (SELECT count(*) FROM work_language_tracks x
         WHERE x.work_id = lt.work_id AND x.lang = lt.lang) = 1
 ORDER BY lt.work_id, lt.id;
""")
plan = []
for ln in rows.strip().split("\n"):
    if not ln.strip(): continue
    p = ln.split("|", 7)
    if len(p) < 8: continue
    plan.append(dict(tid=int(p[0]), wid=p[1], lang=p[2], voice=p[3], au=p[4],
                     wsub=p[5], dur=int(p[6] or 0), lyr=p[7].replace("~NL~", "\n")))
if LIMIT: plan = plan[:LIMIT]
print(f"清单 {len(plan)} 条轨（ready·有音频·作品有字幕·同语言只此一条）"
      f"{'  [--apply 真写]' if APPLY else '  [干跑]'}\n")

docs = {}   # work-level JSON 缓存: 一个作品只下一次
ok_n = skip_n = bad_n = 0
reasons = {}
def bump(d, k): d[k] = d.get(k, 0) + 1

for i, r in enumerate(plan, 1):
    pre = f"[{i}/{len(plan)}] {r['wid'][:8]} {r['lang']}/{r['voice']} 轨{r['tid']}"
    if r["wid"] not in docs:
        b = fetch(r["wsub"])
        docs[r["wid"]] = b
    raw = docs[r["wid"]]
    if raw is None:
        print(f"  {pre}  作品级字幕取不到 —— 跳过(【取不到】不等于【没有】)")
        skip_n += 1; bump(reasons, "作品级字幕取不到"); continue
    try: doc = json.loads(raw)
    except Exception as e:
        print(f"  {pre}  作品级字幕不是合法 JSON({e}) —— 跳过")
        skip_n += 1; bump(reasons, "作品级字幕不是 JSON"); continue
    hits = [L for L in (doc.get("languages") or [])
            if str(L.get("lang", "")).lower() == r["lang"].lower()]
    if not hits:
        print(f"  {pre}  作品级里没有 {r['lang']} 条目 —— 跳过(这一版确实没有字幕)")
        skip_n += 1; bump(reasons, "作品级没有这个语言"); continue
    okb, why = belongs(r["lyr"], hits[0], r["dur"])
    if not okb:
        print(f"  {pre}  归属判不了: {why} —— 跳过, 不猜")
        skip_n += 1; bump(reasons, "归属判不了"); continue

    tag = hashlib.sha1(r["au"].encode()).hexdigest()[:10]
    key = f"works/{r['wid']}/subtitle-take1--a{tag}.json"
    url = f"{CDN}/{key}"
    if not APPLY:
        print(f"  {pre}  {why} → 会挂 {key}")
        ok_n += 1; continue

    exist = fetch(url, tries=1)
    if exist is not None:
        if exist != raw:
            print(f"  {pre}  {key} 已存在且字节不同 —— 不覆盖, 跳过")
            skip_n += 1; bump(reasons, "键已存在且字节不同"); continue
        # 字节一样 = 幂等, 继续往下挂库
    else:
        src = os.path.join(WORK, f"{r['wid']}--take1.json")
        open(src, "wb").write(raw)
        p = subprocess.run(["node", "r2putkey.mjs", src, key, "application/json"],
                           cwd=CUR, capture_output=True, text=True)
        if p.returncode or '"ok":true' not in p.stdout:
            print(f"  {pre}  推 R2 失败: {(p.stdout + p.stderr)[:160]}")
            bad_n += 1; bump(reasons, "推 R2 失败"); continue
        back = fetch(url, tries=4)
        if back is None or back != raw:
            print(f"  {pre}  推完回读不一致/取不到 —— 不挂库")
            bad_n += 1; bump(reasons, "推完回读不一致"); continue

    # ⚠ 这里【不要】拿 psql 打印的 "UPDATE 1" 当判据 —— `-q` 是 quiet, 它把命令标签
    #   整个吞掉, stdout 永远是空的。第一版就是这么写的: 638 行其实都写进去了,
    #   脚本却逐行报「这一行在我读它之后变了」, 然后跳过回读 —— 写对了, 却一条都没验。
    #   「判据取不到」被我当成了「判据不满足」, 这两件事混在一起比写错更难查。
    #   唯一可信的判据是【回读】。
    up = subprocess.run(
        ["psql", DB, "-X", "-c",
         "UPDATE work_language_tracks SET subtitle_url=$$" + url + "$$, updated_at=now() "
         f"WHERE id={r['tid']} AND coalesce(subtitle_url,'')='' "
         "AND audio_url=$$" + r["au"] + "$$"],
        capture_output=True, text=True)
    if up.returncode:
        print(f"  {pre}  UPDATE 报错: {up.stderr[:160]}")
        bad_n += 1; bump(reasons, "UPDATE 报错"); continue
    chk = psql(f"SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE id={r['tid']};").strip()
    if chk != url:
        print(f"  {pre}  回读库里是 '{chk[:60]}' —— 对不上")
        bad_n += 1; bump(reasons, "库回读不一致"); continue
    print(f"  {pre}  OK {why} → {key}")
    ok_n += 1

print(f"\n汇总: 清单 {len(plan)} · 挂上 {ok_n} · 跳过 {skip_n} · 出错 {bad_n}"
      + ("  [干跑]" if not APPLY else ""))
if reasons:
    print("跳过/出错的原因分布: " + ", ".join(f"{k} {v}" for k, v in sorted(reasons.items(), key=lambda x: -x[1])))
if ok_n + skip_n + bad_n != len(plan):
    sys.exit(f"FAIL: 三类加起来 {ok_n+skip_n+bad_n} ≠ 清单 {len(plan)} —— 自己的账对不上, 上面的数不要信")
print("清单与实际一致  OK")
sys.exit(1 if bad_n else 0)
