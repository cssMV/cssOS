#!/usr/bin/env python3
# W2302 第6件 独立复核 v2。
# v1 的漏: 按 lang 找「第一个有该语言条目的版本行」→ ♪2 被当成 ♪1 判了一遍, 真正的 ♪2 一次没查。
#   身份只能是 URL, 不能是 lang(平台 seedTakes/app.takes.js 同规则)。
# v2: 枚举该作品该语言的【每一个】带字幕的版本行, 一个不跳; 并核对颗数 = 应有的 ♪ 数。
import json, os, re, subprocess, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"

# (work_id前8, lang, voice, 这一轮做了几颗♪)
WORKS = [
 ("1040ce1c","am","pre-epic",1), ("d35e5d11","akk","auto",1), ("4f72b1e3","qu","auto",1),
 ("f4c5e610","vi","auto",2),     ("82a6f65c","xh","auto",1),  ("f467c6a7","haw","pre-epic",1),
 ("9a1e578a","quc","auto",1),    ("767cca0e","quc","auto",1), ("c5ab48df","quc","auto",1),
 ("7733e91f","man","pre-epic",1),("a31d2cb7","mi","auto",1),  ("4dab1768","zu","pre-epic",1),
 ("3425bc6a","la","auto",2),
]
EXPECT_TOTAL = sum(w[3] for w in WORKS)   # 应判的 ♪ 总数

def psql(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-At", "-F", "|", "-c", sql],
                       capture_output=True, text=True, timeout=120)
    if r.returncode: print("SQL FAIL:", r.stderr[:300]); sys.exit(2)
    return [l.split("|") for l in r.stdout.strip().split("\n") if l.strip()]

def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()

def decode_dur(u):
    out = subprocess.run(["ffmpeg","-nostdin","-hide_banner","-i",u,"-f","null","-"],
                         capture_output=True, text=True, timeout=900, stdin=subprocess.DEVNULL).stderr
    m = re.findall(r"time=(\d+):(\d+):(\d+\.?\d*)", out)
    return (int(m[-1][0])*3600+int(m[-1][1])*60+float(m[-1][2])) if m else None

bad, unk, ok, judged = [], [], 0, 0
for (w8, lang, voice, want) in WORKS:
    tr = psql("SELECT lang, voice FROM work_language_tracks WHERE work_id::text LIKE '%s%%' "
              "AND lang='%s' AND COALESCE(voice,'auto')='%s'" % (w8, lang, voice))
    if len(tr) != 1:
        unk.append(("%s %s/%s" % (w8, lang, voice), "轨不唯一: %d 条" % len(tr))); continue
    trk_lang = tr[0][0]
    rows = psql("SELECT url, subtitle_url, COALESCE(label,'(无名)') FROM work_media_versions "
                "WHERE work_id::text LIKE '%s%%' AND kind='audio' AND subtitle_url IS NOT NULL "
                "AND subtitle_url <> '' ORDER BY created_at" % w8)
    # 只留【字幕里真有这门语言条目】的行 —— 并且每一行单独判
    mine = []
    for url, sub, label in rows:
        try: d = json.loads(get(sub))
        except Exception as e:
            unk.append(("%s %s %s" % (w8, lang, sub[-24:]), "字幕取不到: %s" % str(e)[:40])); continue
        if lang in [str(L.get("lang","")) for L in (d.get("languages") or [])]:
            mine.append((url, sub, label, d))
    if len(mine) != want:
        bad.append(("%s %s/%s" % (w8, lang, voice),
                    "带 %s 条目的版本行有 %d 个, 这一轮应该是 %d 个" % (lang, len(mine), want)))
        if not mine: continue
    for url, sub, label, doc in mine:
        judged += 1
        ent = next(L for L in doc["languages"] if str(L.get("lang","")) == lang)
        lines, notok, ends = 0, 0, []
        for s in (ent.get("sections") or []):
            for ln in (s.get("lines") or []):
                t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
                if not t or re.match(r"^\s*\[", t): continue
                lines += 1
                tk = [x for x in (ln.get("tokens") or []) if x.get("t_end") is not None] if isinstance(ln, dict) else []
                if not tk: notok += 1
                ends += [x["t_end"] for x in tk]
        dur = decode_dur(url)
        mx = max(ends)/1000 if ends else -1
        tag = "%s %-4s %s" % (w8, lang, url.rsplit("/",1)[-1][:34])
        probs = []
        if dur is None: unk.append((tag, "音频解不出时长 —— 判不了")); continue
        if mx > dur + 3: probs.append("越界 %.1f > %.1f" % (mx, dur))
        if lines == 0: probs.append("正文空")
        if notok: probs.append("%d/%d 行无 token" % (notok, lines))
        if trk_lang != lang: probs.append("轨 lang=%r≠%r" % (trk_lang, lang))
        print("%-52s 行%-3d 无token%-3d 末%6.1f/音频%6.1f (%3d%%) %-12s %s"
              % (tag, lines, notok, mx, dur, round(100*mx/dur), label[:12],
                 "❌ " + " · ".join(probs) if probs else "✅"))
        if probs: bad.append((tag, " · ".join(probs)))
        else: ok += 1

print()
print("自检: 应判 %d 颗 ♪ · 实判 %d 颗 %s" % (EXPECT_TOTAL, judged, "✅" if judged == EXPECT_TOTAL else "‼ 不相等"))
print("好 %d · 有问题 %d · 判不了 %d" % (ok, len(bad), len(unk)))
for t, r in bad: print("  ❌ %s — %s" % (t, r))
for t, r in unk: print("  ❓ %s — %s" % (t, r))
