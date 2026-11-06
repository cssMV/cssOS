#!/usr/bin/env python3
"""巡检 — 每条轨的每个 ♪N, 客户端到底拿到哪份字幕、它配不配这段音频。 (W2270, 2026-11-05)

在 api-vm 上跑:
    set -a; . /etc/cssos.env; set +a
    python3 -I scripts/audit-take-subtitles.py            # 快: 只判地址(不下载字幕)
    python3 -I scripts/audit-take-subtitles.py --deep      # 慢: 下载字幕, 多判三项
    python3 scripts/audit-take-subtitles.py --self-test    # 校准判据本身, 不碰库
只读, 一个字不写。发现可改项时退出码 1(可挂 cron / 当回归用)。

── 为什么要巡检这件事 ──────────────────────────────────────────────

「覆盖, 就是删掉。」多语言 / 多声线 / 多画面胶囊的定义就是【同一部作品并存多个版本】,
而版本之间最容易悄悄串掉的就是字幕: 它挂在单值字段上, 而一个格子装不下两版。

实测(2026-11-05)全库 153 条 v2+ 音频版本行里, 只有 18 条有自己的字幕 —— 另外
135 条在【借 ♪1 的时间轴】。借用不会报错、不会降级、不会空白: 它照常滚字, 只是
整首渐漂。两版长度差 50-130 秒时, 第二段开始就全错位了。只有人眼能发现。

── 判据【不另造一套】──────────────────────────────────────────────

以【真接口下发的东西】为准: 读 /api/works/<id>/language-tracks, 字幕解析链照搬
public/app.takes.js 的 takeSubtitleUrl()(含 W2269 收窄后的 pre-epic 短路)。
不在这里重写一份 loadWorkTakes —— 重写一份就等于再造一个会和平台漂移的真源。

六类判据, 每一类都是【亲手栽过的坑】:

  BORROWED    ♪N(N≥2) 和 ♪1 解析到同一份文件。W2269 / W2270 两次的本体。
              ⚠ 这一条【时长检查抓不到】: 252s 的版本配 187s 的时间轴不超出,
              按「末尾时间」判会得到「✓ 留 65s」。必须单独判。
  FAKE_EVEN   从 0 秒起、句句相接、每句等长 —— W789 的 even 兜底产物, 不是对齐。
              ⚠ 它也【落在音频长度之内】, 我拿时长判据给它打过 ✓(Chase the
              Stars 的 ja♪2/ko♪2)。判据: 没有前奏 + 句间零间隙。
  LANG_MISSING 文件里没有这条轨的 lang。W1961 严格匹配 → 整首哑掉, 不报错。
  OVERRUN     唱词末尾超出音频长度。
  OUTRO_OVER  含尾奏 [Music...] 的末尾超出 —— W2267 的 207 秒幽灵尾奏就是这个,
              而接口返回的 lastEnd_s 只是词级时间轴, 根本看不出来。
  BLANK_1     ♪1 完全没字幕。(♪N 空白【不算问题】—— W2269 定的: 宁可空白, 绝不错配。)

── 校验器必须报自己的漏 ────────────────────────────────────────────

一晚三次假通过的教训: 汇总一律打印【清单 N / 实际判了 M】, 取不到和时长未知
各自单列, 明说「这不是『对』」。--self-test 用已知答案的合成样本先校准判据本身。

修复: POST /api/admin/resubtitle/<workId>?lang=<l>&voice=<v>&take=<N>
      跑之前先加 &dry=1 看它会挑哪一版(W2268) —— 一个字节都不写。
      ⚠ 重新生成任何已存在的作品级媒体之前, 必须先问 Jing 并拿到明确的 yes(W2086)。
"""
import os, sys, json, csv, io, subprocess, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor

API  = os.environ.get("CSSOS_API", "https://cssstudio.app")
UA   = {"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"}   # CDN 拒默认 python UA(403)
DEEP = "--deep" in sys.argv
ALLW = "--all"  in sys.argv
JSONOUT = "--json" in sys.argv
ONE  = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--work=")), None)
LIMIT = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--limit=")), "0") or 0)

_cache = {}
def get(u):
    if u in _cache: return _cache[u]
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            v = json.loads(r.read())
    except Exception as e:
        v = {"__err": str(e)[:120]}
    _cache[u] = v
    return v

# ── 字幕解析链 —— 照搬 public/app.takes.js takeSubtitleUrl() ────────────────
def sub_url(tr, take):
    if str(tr.get("voice") or "") == "pre-epic":
        tks = tr.get("takes") or []
        if not tks:                                   # 卡片/队列那条路: W2145 原样整条短路
            return (tr.get("subtitle_url") or ""), "轨.subtitle_url(无 takes)"
        hit = tks[take - 1] if len(tks) >= take else None
        if hit and hit.get("subtitle_url"): return hit["subtitle_url"], "版本自带"
        if take == 1: return (tr.get("subtitle_url") or ""), "轨.subtitle_url(仅♪1)"
        return "", "空白(W2269)"
    t = (tr.get("takes") or [])
    t = t[take - 1] if len(t) >= take else None
    if t and t.get("subtitle_url"): return t["subtitle_url"], "版本自带"
    if take >= 2 and tr.get("subtitle_take2_json_url"):
        return tr["subtitle_take2_json_url"], "作品级take2"
    return (tr.get("subtitle_take1_json_url") or ""), "作品级take1"

# ── 时间轴判据 ───────────────────────────────────────────────────────────
def lines_of(entry):
    out = []
    for sec in (entry.get("sections") or []):
        for ln in (sec.get("lines") or []):
            out.append(((ln.get("text") or "").strip(),
                        float(ln.get("t_start") or 0) / 1000.0,
                        float(ln.get("t_end") or 0) / 1000.0))
    return out

def ends(entry):
    ls = lines_of(entry)
    sung = [e for x, _, e in ls if x and x != "[Music...]"]
    return (round(max(sung or [0]), 1), round(max([e for _, _, e in ls] or [0]), 1), len(sung))

def fake_even(entry):
    """从 0 秒起 + 句间零间隙 = 均匀摊出来的, 不是对齐出来的。
    这一条必须和时长判据分开: 假时间轴也落在音频长度之内。"""
    ls = [(s, e) for x, s, e in lines_of(entry) if x and x != "[Music...]"]
    if len(ls) < 6: return None
    gaps = sum(1 for i in range(1, len(ls)) if ls[i][0] - ls[i - 1][1] > 0.3)
    if ls[0][0] < 1.0 and gaps == 0:
        return f"前奏0s, 句间零间隙 {len(ls)}句"
    return None

# ── 自检: 先在已知答案上校准判据, 再去判全库 ──────────────────────────────
# --json 必须【只出 JSON】, 否则没法进管线。所有人读的输出一律走 stderr。
# (第一次全库跑就是被自检那十行打在 stdout 上, json.load 直接崩在第 1 个字符。)
say = (lambda *a: print(*a, file=sys.stderr)) if JSONOUT else print

def self_test():
    say("── 判据自检(合成样本, 不碰库)")
    bad = 0
    def chk(name, got, want):
        nonlocal bad
        good = got == want
        if not good: bad += 1
        say(f"  {'✓' if good else '✗'} {name}" + ("" if good else f" — 得到 {got!r}, 期望 {want!r}"))
    mk = lambda spans: {"sections": [{"lines": [
        {"text": f"第{i}句", "t_start": int(s * 1000), "t_end": int(e * 1000)}
        for i, (s, e) in enumerate(spans, 1)]}]}
    even = [(i * 5.0, i * 5.0 + 5.0) for i in range(8)]                      # 0 起, 零间隙
    real = [(13.5 + i * 7.0, 13.5 + i * 7.0 + 5.0) for i in range(8)]        # 13.5s 前奏 + 间隙
    chk("假均匀 → 抓到", bool(fake_even(mk(even))), True)
    chk("真对齐 → 不误报", fake_even(mk(real)), None)
    chk("行数太少 → 不判(样本不足≠有问题)", fake_even(mk(even[:4])), None)
    e = mk(real); e["sections"][0]["lines"].append({"text": "[Music...]", "t_start": 70000, "t_end": 240000})
    chk("唱词末尾不含尾奏", ends(e)[0], 67.5)   # 13.5 + 7*7 + 5
    chk("含尾奏末尾单独报", ends(e)[1], 240.0)
    chk("只数唱词行", ends(e)[2], 8)
    T = {"voice": "pre-epic", "subtitle_url": "S1", "takes": [{}, {}]}
    chk("pre-epic ♪1 退回轨那一列", sub_url(T, 1)[0], "S1")
    chk("pre-epic ♪2 没有自己的 → 空白, 绝不借 ♪1", sub_url(T, 2)[0], "")
    T2 = {"voice": "auto", "subtitle_take1_json_url": "W1", "takes": [{"subtitle_url": "V1"}, {}]}
    chk("普通轨 ♪2 没有自己的 → 回退作品级(所以才会借用)", sub_url(T2, 2)[0], "W1")
    chk("普通轨 ♪1 用版本自带", sub_url(T2, 1)[0], "V1")
    say(f"  {'✗ 判据自己有 ' + str(bad) + ' 项不对 —— 先修判据' if bad else '✓ 判据在已知答案上全对'}")
    return 1 if bad else 0

if "--self-test" in sys.argv:
    sys.exit(self_test())
if self_test():
    say("判据自检没过 —— 不拿一个坏判据去判全库"); sys.exit(2)
print()

# ── 清单: 哪些作品可能有 ♪2+ ────────────────────────────────────────────
if ONE:
    ids = [(ONE, "(--work)")]
else:
    DB = os.environ.get("DATABASE_URL")
    if not DB:
        say("没有 DATABASE_URL —— 这份要在 api-vm 上跑: set -a; . /etc/cssos.env; set +a"); sys.exit(2)
    # 默认清单 = 【可能有 ♪2+】的作品(有 alt_audio_url 或 ≥2 条音频版本行)。
    #
    # ⚠ 这个清单对「借用 / 假均匀 / 超出」是完整的(没有 ♪2 就不可能借), 但对
    # 「♪1 没字幕 / 文件无该语言」【不完整】—— 只有 ♪1 的作品根本不在清单里。
    # 第一版就是这么报的: 26 处 BLANK_1 听起来像全库, 其实只是那 102 个作品里的。
    # 这正是「校验器必须报自己的漏」要防的事, 所以 --all 必须存在, 汇总必须说清。
    q = """COPY (
      select w.id, coalesce(w.title,'')
        from user_works w
       where exists (select 1 from work_language_tracks t
                      where t.work_id=w.id and coalesce(t.alt_audio_url,'') <> '')
          or (select count(*) from work_media_versions v
               where v.work_id=w.id and v.kind='audio' and coalesce(v.url,'') <> '') >= 2
       order by w.created_at desc) TO STDOUT WITH (FORMAT csv)"""
    if ALLW:
        q = """COPY (
          select w.id, coalesce(w.title,'')
            from user_works w
           where exists (select 1 from work_language_tracks t where t.work_id=w.id)
              or coalesce(w.preview_audio_url,'') <> ''
           order by w.created_at desc) TO STDOUT WITH (FORMAT csv)"""
    out = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
    ids = [(r[0], r[1]) for r in csv.reader(io.StringIO(out.stdout)) if len(r) >= 2]
    if LIMIT: ids = ids[:LIMIT]
SCOPE = "全部有音频的作品(--all)" if ALLW else "有 alt_audio_url 或 ≥2 条音频版本行"
say(f"清单 {len(ids)} 个作品({SCOPE}){'  · --deep 会下载字幕文件' if DEEP else '  · 只判地址, 不下载字幕(加 --deep 多判三项)'}")

# ── 判 ──────────────────────────────────────────────────────────────────
findings = []     # (类, 作品, 标题, 轨, ♪, 说明)
stat = collections.Counter()
judged_works = 0
def do(item):
    wid, title = item
    d = get(f"{API}/api/works/{wid}/language-tracks")
    if "__err" in d: return [("FETCH_FAIL", wid, title, "-", "-", d["__err"])], 0
    rs = []
    for tr in (d.get("tracks") or d.get("language_tracks") or []):
        lang, voice = tr.get("lang"), tr.get("voice") or "auto"
        who = f"{lang}/{voice}"
        tks = tr.get("takes") or []
        if not tks: continue
        seen1 = None
        for i, tk in enumerate(tks, 1):
            u, via = sub_url(tr, i)
            if not u:
                if i == 1: rs.append(("BLANK_1", wid, title, who, f"♪{i}", "♪1 完全没字幕"))
                else: stat["blank_n_ok"] += 1     # W2269 刻意如此, 不算问题
                continue
            if i == 1: seen1 = u
            elif u == seen1:
                rs.append(("BORROWED", wid, title, who, f"♪{i}",
                           f"和 ♪1 同一份文件 …{u[-30:]} —— 两版长度不同必然渐漂"))
                continue
            if not DEEP: stat["ok_url"] += 1; continue
            doc = get(u)
            if "__err" in doc:
                rs.append(("FETCH_FAIL", wid, title, who, f"♪{i}", f"字幕取不到: {doc['__err']}")); continue
            ents = {e.get("lang"): e for e in (doc.get("languages") or [])}
            e = ents.get(lang)
            if e is None:
                rs.append(("LANG_MISSING", wid, title, who, f"♪{i}",
                           f"文件里没有 lang='{lang}'(有 {list(ents)}) —— W1961 严格匹配 → 整首哑掉")); continue
            ev = fake_even(e)
            if ev:
                rs.append(("FAKE_EVEN", wid, title, who, f"♪{i}", f"{ev} —— 不是对齐出来的")); continue
            s, a, n = ends(e)
            dur = tk.get("duration_secs")
            if not dur:
                rs.append(("DUR_UNKNOWN", wid, title, who, f"♪{i}",
                           f"时长未知, 判不了({n}行, 唱词末尾{s}s / 含尾奏{a}s)")); continue
            if s - dur > 5.0:
                rs.append(("OVERRUN", wid, title, who, f"♪{i}", f"唱词末尾{s}s 超出音频{dur}s 共{round(s-dur,1)}s"))
            elif a - dur > 5.0:
                rs.append(("OUTRO_OVER", wid, title, who, f"♪{i}", f"含尾奏到{a}s, 音频只有{dur}s(超{round(a-dur,1)}s)"))
            else:
                stat["ok"] += 1
    return rs, 1

with ThreadPoolExecutor(max_workers=8) as ex:
    for rs, j in ex.map(do, ids):
        findings += rs; judged_works += j

# ── 汇总 —— 必须报自己的漏 ──────────────────────────────────────────────
ERR = {"BORROWED", "FAKE_EVEN", "LANG_MISSING", "OVERRUN", "OUTRO_OVER", "BLANK_1"}
by = collections.Counter(f[0] for f in findings)
if JSONOUT:
    print(json.dumps({"listed": len(ids), "judged": judged_works,
                      "counts": dict(by), "ok": stat["ok"], "blank_n_ok": stat["blank_n_ok"],
                      "findings": [dict(zip(("kind","work","title","track","take","note"), f)) for f in findings]},
                     ensure_ascii=False, indent=1))
else:
    LABEL = {"BORROWED": "借 ♪1 的时间轴(整首渐漂)", "FAKE_EVEN": "假均匀时间轴(不是对齐)",
             "LANG_MISSING": "文件里没有这条轨的语言(整首哑掉)", "OVERRUN": "唱词超出音频",
             "OUTRO_OVER": "幽灵尾奏(含尾奏超出音频)", "BLANK_1": "♪1 完全没字幕",
             "DUR_UNKNOWN": "时长未知 → 判不了", "FETCH_FAIL": "取不到 → 判不了"}
    for kind in ("BORROWED", "FAKE_EVEN", "LANG_MISSING", "OVERRUN", "OUTRO_OVER", "BLANK_1",
                 "DUR_UNKNOWN", "FETCH_FAIL"):
        rows = [f for f in findings if f[0] == kind]
        if not rows: continue
        print(f"\n■ {LABEL[kind]} — {len(rows)} 处" + ("" if kind in ERR else "   (这不是「对」, 是没判)"))
        for _, wid, title, who, take, note in rows[:40]:
            print(f"   {title[:26]:<26} {who:<16} {take}  {note}")
        if len(rows) > 40: print(f"   … 另 {len(rows)-40} 处(用 --json 看全部)")
    print(f"\n清单 {len(ids)} 个作品, 实际判了 {judged_works} 个"
          + (f" ——【少判了 {len(ids)-judged_works} 个, 见上面 FETCH_FAIL】" if judged_works < len(ids) else ""))
    print(f"判出问题 {sum(by[k] for k in ERR)} 处"
          f" · 判不了 {by['DUR_UNKNOWN']+by['FETCH_FAIL']} 处(不是「对」)"
          + (f" · 对上 {stat['ok']} 处"
             if DEEP else
             f" · 地址这一层对上 {stat['ok_url']} 处"
             " ·【没加 --deep: 超出/假均匀/语言缺失这三项根本没判】"))
    if not ALLW:
        print("⚠ 清单只含【可能有 ♪2+】的作品 —— 借用/假均匀/超出 这几类是完整的"
              "(没有 ♪2 就不可能借), 但【♪1 没字幕 / 文件无该语言】在清单之外的作品里"
              "根本没判过。要全库看这两类, 加 --all。")
    print(f"♪N 空白 {stat['blank_n_ok']} 处 —— 不算问题(W2269: 宁可空白, 绝不错配)")
sys.exit(1 if sum(by[k] for k in ERR) else 0)
