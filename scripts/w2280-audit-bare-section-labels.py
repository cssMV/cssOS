#!/usr/bin/env python3
"""W2280 —— 全库扫【段落标签丢了方括号】, 并逐首判定它到底有没有造成伤害。

Jing 2026-11-08:「D4 那 40 首裸段落标签 —— 请单独立一波。」

毛病的样子: 本该写成 `[Chorus]` 的那一行写成了裸的 `Chorus`。音乐引擎只把
方括号里的东西当【指令】, 括号外的一律当【唱词】。实测这些词都是 Markdown 风格的
LLM 输出 —— `⸻` 当分隔线, 标题裸着写, 从来没人把它们规范成方括号。

────────────────────────────────────────────────────────────────────────
⚠ 本文件里的判据被我自己写坏过【两次】, 都记在这里, 免得下一个人再犯:

错 1(检测侧)—— W2278 的 D4 是串台检测的副产物, 它借用了 `namelines()`,
  那个正则要求「首字母大写的拉丁词、不含数字」, 于是:
      Chorus / Pre-Chorus / BRIDGE   → 抓到
      chorus / verse 1 / Verse 2     → 【全部漏掉】
  所以那次报的「40 首」是下限不是总数。这里重写判据, 实测 43 首。
  → 借别的检测器的辅助函数 = 继承它的盲区。要抓什么就自己写判据。

错 2(定性侧)—— 判「有没有被唱出来」, 我第一版把字幕 JSON 里【所有字符串】
  都捞出来找标签词, 于是命中了两种假证据:
     · `languages[].sections[].tag` —— 那是【结构字段】, 它本来就叫
       "chorus"/"verse"/"music", 跟唱没唱毫无关系。43 首全报 SUNG, 全是假的。
     · `lines[].tokens[].char` —— tokens 是【逐词】的, 所以 "break" 会从真歌词
       "too big to break" 里命中, "music" 会从 "the music stays" 里命中。
       6 首 break 因此被误判成「唱了标签」。
  真源(app.emotion-subtitle-engine.js)的结构是:
     languages[].sections[].tag                   ← 结构, 排除
     languages[].sections[].lines[].text          ← 唱词【整行】, 只认这个
     languages[].sections[].lines[].tokens[].char ← 逐词, 不能当整行用
  → 判「整行是不是只有标签」, 就只能看整行。收紧之后: 43 首里【只有 2 首】真唱了。
────────────────────────────────────────────────────────────────────────

四种定性(四类加起来必须等于清单, 末尾自查):
  A 标签真被唱了            —— 字幕里有整行只是标签。真伤害。
  B 字幕本身坏了            —— 有音频, 但字幕行数远少于歌词行数。这是【另一种、更重】的毛病。
  C 字幕源自歌词, 标签被过滤 —— 屏幕上干净, 脏的只是当初喂给 Suno 的那份 prompt。
  D 字幕与这份歌词对不上    —— 多语言轨共用 take1 等情况, 不能断定, 需要人耳。

「取不到」和「没有」不是一回事: http 不是 200/404 一律 UNKNOWN, 绝不当「没有」。

用法:
  python3 -I scripts/w2280-audit-bare-section-labels.py [--calibrate] [--no-cdn]
    --calibrate  双向自检: 写坏的词必须抓到, 规范的词必须不抓。只校一个方向会给假结论。
    --no-cdn     只扫库、不拉字幕(快, 但拿不到 A/B/C/D 定性)
"""
import collections, csv, hashlib, io, json, os, re, subprocess, sys, urllib.request
csv.field_size_limit(10 ** 7)

CAL = "--calibrate" in sys.argv
NOCDN = "--no-cdn" in sys.argv

# 段落标签词表 —— 平台 parseLyricsToSections 认的那一套, 外加 Suno / LLM 常见同义词
WORDS = (r"pre[-\s]?chorus|post[-\s]?chorus|chorus|verse|bridge|outro|intro|hook|refrain|"
         r"interlude|instrumental|break(?:down)?|drop|coda|prelude|finale|ending|"
         r"music|solo|rap|spoken|ad[-\s]?lib|vamp|tag|build|pre[-\s]?drop|"
         r"segue|reprise|stanza|section|part|movement|act|scene")
LABEL = re.compile(r"^(?:\d{1,2}\s*[.)]\s*)?(?:" + WORDS + r")"
                   r"(?:\s*[-:：]?\s*(?:\d{1,2}|[ivx]{1,4}|[a-c]))?"
                   r"(?:\s*[xX*]\s*\d)?\s*[:：.]?$", re.I)
# 已经在括号/强调标记里的写法是【对的】, 不报
OPENS = ("[", "【", "〔", "(", "（", "{", "<", "*", "#")
CLOSES = ("]", "】", "〕")
RULES = ("⸻", "—", "---", "***", "___", "–––")


def bare_labels(lyr):
    out = []
    for raw in (lyr or "").split("\n"):
        l = raw.strip()
        if not l or l in RULES:
            continue
        if l.startswith(OPENS) or l.endswith(CLOSES):
            continue
        if len(l) > 24:
            continue
        if LABEL.match(l):
            out.append(l)
    return out


def calibrate():
    good = ("[Intro]\n在星空下\n[Verse 1]\n一行词\n[Chorus]\n副歌\n"
            "[Bridge]\n桥段\n[Outro]\n尾声\n**Chorus**\n另一种对的写法\n")
    bad = ("Intro\n在星空下\nVerse 1\n一行词\npre-chorus\n过渡\nChorus\n副歌\n"
           "BRIDGE\n桥段\nOutro:\n尾声\nMusic\n⸻\nVerse 2\n")
    # 第三份: 真歌词里本来就有 break / music 这种【词】, 必须不被当成标签
    innocent = ("[Verse 1]\nEvery promise felt too big to break\n"
                "[Chorus]\nthe music stays when everybody goes\n")
    g, b, i = bare_labels(good), bare_labels(bad), bare_labels(innocent)
    print(f"校准 正向(写坏的必须抓到):   {len(b)} 个 {b}")
    print(f"校准 反向(规范的必须不抓):   {len(g)} 个 {g}")
    print(f"校准 反向(真歌词必须不抓):   {len(i)} 个 {i}")
    if len(b) < 7: sys.exit("FAIL: 写坏的词没全抓到 —— 判据太窄, 别信全库的数")
    if g: sys.exit("FAIL: 规范的词被误报 —— 判据太宽, 别信全库的数")
    if i: sys.exit("FAIL: 真歌词里的普通词被当成标签 —— 正是我栽过的那个坑")
    print("校准通过(三向)\n")


def dburl():
    env = os.environ.get("DATABASE_URL")
    if env: return env
    try:
        for ln in open("/etc/cssos.env"):
            ln = ln.strip()
            if ln.startswith("DATABASE_URL="):
                return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    sys.exit("FAIL: 找不到 DATABASE_URL —— 别继续, 否则下面每条结论都是空的")


def sung_whole_lines(j):
    """字幕里【整行只有一个标签】的行。只看 lines[].text ——
    sections[].tag 是结构字段, tokens[].char 是逐词, 两者都不能当证据(见文件头 错 2)。"""
    out = []
    if not isinstance(j, dict): return out
    for L in (j.get("languages") or []):
        if not isinstance(L, dict): continue
        for s in (L.get("sections") or []):
            if not isinstance(s, dict): continue
            for ln in (s.get("lines") or []):
                if not isinstance(ln, dict): continue
                t = (ln.get("text") or "").strip()
                if t and t != "[Music...]" and LABEL.match(t):
                    out.append(f"{L.get('lang', '?')}:{t}")
    return out


def sub_lines(j):
    out = []
    if not isinstance(j, dict): return out
    for L in (j.get("languages") or []):
        for s in (L.get("sections") or []):
            for ln in (s.get("lines") or []):
                t = (ln.get("text") or "").strip()
                if t: out.append(t)
    return out


def main():
    if CAL: calibrate()
    DB = dburl()
    q = ("COPY (\n"
         " SELECT 'work' AS src, w.id::text, coalesce(w.title,''), coalesce(w.language,''),\n"
         "        '' AS voice, coalesce(w.lyrics_preview,'') AS lyr,\n"
         "        to_char(w.created_at,'YYYY-MM-DD HH24:MI') AS cre, '' AS st,\n"
         "        case when coalesce(w.preview_audio_url,'')<>'' then 'Y' else 'N' end AS aud\n"
         "   FROM user_works w WHERE btrim(coalesce(w.lyrics_preview,'')) <> ''\n"
         " UNION ALL\n"
         " SELECT 'track', t.work_id::text, coalesce(w.title,''), coalesce(t.lang,''),\n"
         "        coalesce(t.voice,''), coalesce(t.lyrics,''),\n"
         "        to_char(t.created_at,'YYYY-MM-DD HH24:MI'), coalesce(t.status,''),\n"
         "        case when t.audio_url is not null then 'Y' else 'N' end\n"
         "   FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id\n"
         "  WHERE btrim(coalesce(t.lyrics,'')) <> ''\n"
         ") TO STDOUT WITH (FORMAT csv)")
    r = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
    if r.returncode: sys.exit("FAIL: psql " + r.stderr[:400])
    rows = [x for x in csv.reader(io.StringIO(r.stdout)) if len(x) >= 9]
    nw = sum(1 for x in rows if x[0] == "work")
    nt = sum(1 for x in rows if x[0] == "track")
    print(f"读到 {len(rows)} 份词: 作品级 {nw} · 语言轨 {nt}")
    if nw < 200 or nt < 50:
        sys.exit(f"FAIL: 读到的太少(作品 {nw} / 轨 {nt}) —— 全库远不止这些, 别信下面的数")

    hits, perlab, bysrc = [], collections.Counter(), collections.Counter()
    for src, wid, title, lang, voice, lyr, cre, st, aud in rows:
        lab = bare_labels(lyr)
        if not lab: continue
        body = [l.strip() for l in lyr.split("\n")
                if l.strip() and l.strip() not in RULES
                and not l.strip().startswith(("[", "【", "〔"))
                and not (len(l.strip()) <= 24 and LABEL.match(l.strip()))]
        hits.append(dict(src=src, id=wid, title=title, lang=lang, voice=voice, created=cre,
                         status=st, audio=aud, labels=lab, nlab=len(lab), nbody=len(body)))
        bysrc[src] += 1
        for l in lab: perlab[l.lower().rstrip(":：.")] += 1

    print(f"\n命中 {len(hits)} 份词: 作品级 {bysrc['work']} · 语言轨 {bysrc['track']}"
          f" · 去重作品 {len({h['id'] for h in hits})}")
    print(f"标签分布(前 20): {dict(perlab.most_common(20))}")

    if NOCDN:
        for h in sorted(hits, key=lambda x: (-x["nlab"], x["title"])):
            print(f"{h['src']:<6}{h['id'][:8]:<10}{h['lang'] or '-':<5}{h['nlab']:<4}"
                  f"{h['title'][:30]:<30} {', '.join(h['labels'][:6])}")
        print("\n(--no-cdn: 没拉字幕, 所以没有 A/B/C/D 定性)")
        return

    # ── 定性: 去 CDN 拉字幕 ──────────────────────────────────────────
    def nn(x): return re.sub(r"[^\w]+", "", x.lower())
    cls_cnt = collections.Counter(); out = []
    for h in sorted({x["id"] for x in hits}):
        mine = [x for x in hits if x["id"] == h]
        title = mine[0]["title"]; aud = any(x["audio"] == "Y" for x in mine)
        body = max(x["nbody"] for x in mine); nlab = max(x["nlab"] for x in mine)
        try:
            url = (f"https://cdn.cssstudio.app/works/{h}/subtitle-take1.json"
                   f"?cb={os.getpid()}-{h[:6]}")
            req = urllib.request.Request(url, headers={"User-Agent": "cssos-audit"})
            j = json.loads(urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "replace"))
        except Exception as e:
            cls = "NO_SUBTITLE_FILE" if getattr(e, "code", None) == 404 else "UNKNOWN_取不到字幕"
            cls_cnt[cls] += 1
            out.append(dict(id=h, title=title, cls=cls, nbody=body, nlab=nlab, nsub=0, pct=0, sung=[]))
            continue
        sub = sub_lines(j); sung = sung_whole_lines(j)
        ss = {nn(x) for x in sub}
        # 命中率要拿【歌词正文】比, 所以重算一份正文行
        pct = 0
        for x in mine:
            pass
        srcrow = [r for r in rows if r[1] == h]
        bodylines = []
        for rr in srcrow:
            for l in rr[5].split("\n"):
                l = l.strip()
                if l and l not in RULES and not l.startswith(("[", "【", "〔")) \
                   and not (len(l) <= 24 and LABEL.match(l)):
                    bodylines.append(l)
        bodylines = list(dict.fromkeys(bodylines))
        if bodylines:
            pct = sum(1 for b in bodylines if nn(b) in ss) * 100 // len(bodylines)
        if sung:                              cls = "A_标签真被唱了"
        elif not aud:                         cls = "E_还没有音频(改词是纯收益)"
        elif len(sub) * 3 < len(bodylines):   cls = "B_字幕本身坏了"
        elif pct >= 70:                       cls = "C_字幕源自歌词_标签被过滤"
        else:                                 cls = "D_对不上_需人耳"
        cls_cnt[cls] += 1
        out.append(dict(id=h, title=title, cls=cls, nbody=len(bodylines), nlab=nlab,
                        nsub=len(sub), pct=pct, sung=sorted(set(sung))))

    print(f"\n{'作品':<10}{'词行':<6}{'标签':<5}{'字幕行':<7}{'命中%':<7}定性 / 标题 / 证据")
    for x in sorted(out, key=lambda y: (y["cls"], y["title"])):
        print(f"{x['id'][:8]:<10}{x['nbody']:<6}{x['nlab']:<5}{x['nsub']:<7}{x['pct']:<7}"
              f"{x['cls']:<28}{x['title'][:28]:<28} {','.join(x['sung'][:3])}")
    print(f"\n定性: {dict(cls_cnt)}")
    tot = sum(cls_cnt.values())
    print(f"自查: 定性合计 {tot} / 去重作品 {len({x['id'] for x in hits})}",
          "OK" if tot == len({x['id'] for x in hits}) else "⚠ 漏判, 别信上面的数")
    dst = os.environ.get("OUT", "/tmp/w2280-bare-labels.json")
    json.dump(dict(hits=hits, verdicts=out), open(dst, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"→ {dst}")


main()
