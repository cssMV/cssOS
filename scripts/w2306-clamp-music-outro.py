#!/usr/bin/env python3
# W2306: 把 Jerusalem 两条【真会被用户听到】的尾奏越界收回音频之内。
#
# 坏在哪(不是对齐坏了): 唱词本身完全正确(en 末 234.3s / vi 末 192.4s, 都在音频内)。
# 坏的是尾奏 [Music...] 那一行的【行级 t_end】——
#   en ♪2: 行级 421750, 真音频 258.6s   (injectMusicGaps 按版本行 duration_secs=422 画的)
#   vi ♪2: 行级 301750, 真音频 219.8s   (同理, duration_secs=302)
# 而 app.emotion-subtitle-engine.js 的 _isMusicLine 分支读的就是 line.t_end(_me),
# 一个 token 都不看 —— 所以 W2295 那道「只收 token」的终检对它完全无效。
# 屏幕上的后果: 唱完之后那簇音符一直挂到曲终之后, 歌放完了它还在。
#
# 为什么只改这一个字段、不重跑对齐:
#   重跑会把一份【唱词已经正确】的字幕整个重做 —— 既没必要, 又给自己留一次
#   「对出来不一样」的风险。坏的是一个数, 就只改那一个数。
#   这也不是「重新生成」, 所以不触发 W2086 那条重生成前必须问的闸门;
#   但旧字节照样先落自己的不可变地址(R2 未开版本管理, 同 key 写入就是永久删除)。
#
# 只改【那条轨真会读到的那一个语言条目】。同一文件里别的语言条目对应的是
# 【别的音频】, 拿这段音频的长度去收它们就是把两件事搅在一起(正是我这一轮一开始
# 判错的那个坑)。
#
# 用法:  python3 -I scripts/w2306-clamp-music-outro.py            # 干跑
#        python3 -I scripts/w2306-clamp-music-outro.py --apply
import hashlib, json, os, re, subprocess, sys, urllib.request

APPLY = "--apply" in sys.argv
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
CDN = "https://cdn.cssstudio.app"
WORK = "f4c5e610-d921-433b-8c32-461a52a9d6ea"
D = "/tmp/w2306"
os.makedirs(D, exist_ok=True)

# (说明, 快照 key, 该轨读的语言条目, 那一版的音频 URL)
JOBS = [
    ("en/auto ♪2", f"works/{WORK}/subtitle-take1--a4860fafb0f.json", "en",
     f"{CDN}/artifacts/audio/aud-8444daf12e1d36a300703e10.mp3"),
    ("vi/auto ♪2", f"works/{WORK}/subtitle-take1--a8851c2259a.json", "vi",
     f"{CDN}/artifacts/audio/aud-cd5cba5436878d8a138872c8.mp3"),
]


def fetch(url, out=None, timeout=180):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout)
    b = r.read()
    if out:
        with open(out, "wb") as f:
            f.write(b)
    return b


def head_ok(url):
    c = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "25",
                        "-A", UA, url], capture_output=True, text=True).stdout.strip()
    return c == "200"


def decode_secs(url):
    """实测 = 整条解码。ffprobe 读的是容器头, 头会撒谎(W2302)。"""
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", url, "-f", "null", "-"],
                       capture_output=True, text=True, timeout=1800)
    ts = re.findall(r"time=(\d+):(\d\d):(\d\d\.\d+)", p.stderr)
    if not ts:
        return None
    h, m, s = ts[-1]
    return round(int(h) * 3600 + int(m) * 60 + float(s), 2)


def entry_of(doc, tag):
    hits = [L for L in (doc.get("languages") or []) if str(L.get("lang")) == tag]
    return hits[0] if len(hits) == 1 else None


def scan(entry, lim_ms):
    """返回超界的 (位置, 值) 列表。行/节/token 三层都看。"""
    bad = []
    for si, sec in enumerate(entry.get("sections") or []):
        for k in ("t_start", "t_end"):
            v = sec.get(k)
            if isinstance(v, (int, float)) and v > lim_ms:
                bad.append((f"sec{si}.{k}", v))
        for li, ln in enumerate(sec.get("lines") or []):
            for k in ("t_start", "t_end"):
                v = ln.get(k)
                if isinstance(v, (int, float)) and v > lim_ms:
                    bad.append((f"sec{si}/line{li}.{k}", v))
            for ti, tk in enumerate(ln.get("tokens") or []):
                for k in ("t_start", "t_end"):
                    v = tk.get(k)
                    if isinstance(v, (int, float)) and v > lim_ms:
                        bad.append((f"sec{si}/line{li}/tok{ti}.{k}", v))
    return bad


ok = bad = unk = 0
for label, key, tag, audio in JOBS:
    print("=" * 96)
    print(f"{label}  条目[{tag}]  {key.split('/')[-1]}")
    url = f"{CDN}/{key}"
    try:
        raw = fetch(url, f"{D}/sub.before.json")
    except Exception as e:
        print(f"  ‼ 取不到快照: {e} —— 判不了, 停这一条"); unk += 1; continue
    osha = hashlib.sha1(raw).hexdigest()[:24]
    doc = json.loads(raw)
    entry = entry_of(doc, tag)
    if entry is None:
        print(f"  ‼ 文件里没有【唯一一条】{tag} 条目(有 {[L.get('lang') for L in doc.get('languages') or []]}) —— 判不了")
        unk += 1; continue

    dur = decode_secs(audio)
    if not dur:
        print("  ‼ 音频实测不到 —— 判不了, 停这一条(宁可不夹, 不夹错)"); unk += 1; continue
    lim = round(dur) * 1000          # 与 probeRemoteDurationSecs 同一套取整
    print(f"  音频实测解码 {dur}s  → limMs={lim}")

    # 自检: 这个 limMs 必须与【当初那道终检已经收过的 token 值】一致。
    # 不一致说明我对这份文件的前提判错了 —— 停手, 不要按一个错的上限去改。
    toks = [tk.get("t_end") for sec in (entry.get("sections") or [])
            for ln in (sec.get("lines") or []) for tk in (ln.get("tokens") or [])
            if isinstance(tk.get("t_end"), (int, float))]
    if not toks or max(toks) != lim:
        print(f"  ‼ 自检不过: 条目里 token 最大 t_end={max(toks) if toks else None} ≠ limMs={lim}")
        print("     说明「当初 token 被收到音频末尾」这个前提不成立 —— 停手, 先去看真源")
        unk += 1; continue
    print(f"  自检 ✅ token 最大 t_end = limMs = {lim}(当初确实收过 token, 只漏了行/节)")

    over = scan(entry, lim)
    if not over:
        print("  这个条目已经没有超界字段 —— 不必改"); ok += 1; continue
    print(f"  超界字段 {len(over)} 个:")
    for where, v in over:
        print(f"     {where:30s} {v}  ({v/1000:.2f}s, 超 {(v-lim)/1000:+.2f}s)")
    if any(".t_start" in w for w, _ in over):
        print("  ‼ 有 t_start 超界 —— 那是【整行在音频之外】, 该丢行不是收边。本脚本不处理, 停手")
        unk += 1; continue

    # 按修好的 clampSectionsToAudioMs 同一套语义收: 超过 limMs 就收到 limMs
    for sec in entry.get("sections") or []:
        if isinstance(sec.get("t_end"), (int, float)) and sec["t_end"] > lim:
            sec["t_end"] = lim
        for ln in sec.get("lines") or []:
            if isinstance(ln.get("t_end"), (int, float)) and ln["t_end"] > lim:
                ln["t_end"] = lim

    left = scan(entry, lim)
    if left:
        print(f"  ‼ 收完还有 {len(left)} 个超界 —— 停手: {left[:3]}"); bad += 1; continue

    # 其余条目必须【逐字未动】
    newdoc = doc
    for L in newdoc.get("languages") or []:
        if str(L.get("lang")) == tag:
            continue
        old = next(x for x in json.loads(raw).get("languages") if str(x.get("lang")) == str(L.get("lang")))
        if json.dumps(L, sort_keys=True, ensure_ascii=False) != json.dumps(old, sort_keys=True, ensure_ascii=False):
            print(f"  ‼ 条目[{L.get('lang')}]被我动到了 —— 停手"); bad += 1; break
    else:
        out = json.dumps(newdoc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        nsha = hashlib.sha1(out).hexdigest()[:24]
        with open(f"{D}/sub.after.json", "wb") as f:
            f.write(out)
        print(f"  旧 sha24={osha} ({len(raw)}B)  →  新 sha24={nsha} ({len(out)}B)")
        print(f"  旧字节永久地址: {CDN}/artifacts/subtitle-archive/sub-{osha}.json")
        if not APPLY:
            print("  [干跑] 会先存旧字节, 回读核对, 然后写回原 key"); ok += 1; continue
        env = dict(os.environ); env["D"] = D
        r = subprocess.run(["bash", os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                 "w2302-put-subtitle-json.sh"), key],
                           env=env, capture_output=True, text=True, timeout=600)
        print("  " + "\n  ".join((r.stdout or "").strip().split("\n")))
        if r.returncode != 0:
            print(f"  ‼ 写入脚本 rc={r.returncode} {(r.stderr or '')[:200]}"); bad += 1; continue
        # 独立回读终检: 从 CDN 重取, 自己重判一遍
        chk = json.loads(fetch(url + f"?v={nsha}"))
        e2 = entry_of(chk, tag)
        left2 = scan(e2, lim) if e2 else None
        if e2 is None or left2:
            print(f"  ‼ 回读终检不过: {left2}"); bad += 1; continue
        print(f"  回读终检 ✅ 条目[{tag}] 无一字段超界 (limMs={lim})")
        ok += 1

print()
print(f"汇总: 清单 {len(JOBS)} · 做成 {ok} · 有问题 {bad} · 判不了 {unk}")
print(f"VERDICT: W2306-clamp {'APPLY' if APPLY else 'DRYRUN'} 结束(做成 {ok} / 有问题 {bad} / 判不了 {unk})")
sys.exit(0 if (bad == 0 and unk == 0) else 1)
