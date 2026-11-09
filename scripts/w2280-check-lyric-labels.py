#!/usr/bin/env python3
"""W2280 闸门 —— 一份词进生成管线之前, 先确认它的段落标签都在方括号里。

为什么要闸门而不是只做巡检: 这 43 首的词是 Markdown 风格的 LLM 输出(`⸻` 分隔线 +
裸标题)。音乐引擎只把【方括号里】的东西当指令, 括号外一律当唱词 —— 裸标签要么被
唱出来(实测 2 首真唱了 "Music"), 要么被管线某处静默过滤掉(实测 23 首)。
两种结果都不是我们想要的: 后一种等于那份 prompt 里有一堆引擎看不懂的噪声,
真正该起作用的段落结构【根本没传进去】。

与 W2278 闸门同一套接口, 装在同一个位置(POST 之前、备份之前), 拦住就不花钱:
  退出码 0 = 干净, 可生成
  退出码 1 = 有裸标签, 不许生成
  退出码 2 = 判不了(查不到作品 / 取不到词), 同样不许继续
            ——【取不到】和【没有】不是一回事(W2138 / W2267 的教训)

用法:
  python3 -I scripts/w2280-check-lyric-labels.py <workId>      # 判库里的 lyrics_preview
  python3 -I scripts/w2280-check-lyric-labels.py --file <path> # 判一份手写词文件
  python3 -I scripts/w2280-check-lyric-labels.py --calibrate   # 三向自检
"""
import csv, io, os, re, subprocess, sys
csv.field_size_limit(10 ** 7)

WORDS = (r"pre[-\s]?chorus|post[-\s]?chorus|chorus|verse|bridge|outro|intro|hook|refrain|"
         r"interlude|instrumental|break(?:down)?|drop|coda|prelude|finale|ending|"
         r"music|solo|rap|spoken|ad[-\s]?lib|vamp|tag|build|pre[-\s]?drop|"
         r"segue|reprise|stanza|section|part|movement|act|scene")
LABEL = re.compile(r"^(?:\d{1,2}\s*[.)]\s*)?(?:" + WORDS + r")"
                   r"(?:\s*[-:：]?\s*(?:\d{1,2}|[ivx]{1,4}|[a-c]))?"
                   r"(?:\s*[xX*]\s*\d)?\s*[:：.]?$", re.I)
OPENS = ("[", "【", "〔", "(", "（", "{", "<", "*", "#")
CLOSES = ("]", "】", "〕")
RULES = ("⸻", "—", "---", "***", "___", "–––")


def bare_labels(lyr):
    """判据与 w2280-audit-bare-section-labels.py 的 bare_labels【逐字相同】。
    两处各写一份就会各自漂移 —— 改一处必须改另一处, 校准会抓到不一致。"""
    out = []
    for raw in (lyr or "").split("\n"):
        l = raw.strip()
        if not l or l in RULES: continue
        if l.startswith(OPENS) or l.endswith(CLOSES): continue
        if len(l) > 24: continue
        if LABEL.match(l): out.append(l)
    return out


def calibrate():
    good = ("[Intro]\n在星空下\n[Verse 1]\n一行词\n[Chorus]\n副歌\n"
            "[Bridge]\n桥段\n[Outro]\n尾声\n**Chorus**\n另一种对的写法\n")
    bad = ("Intro\n在星空下\nVerse 1\n一行词\npre-chorus\n过渡\nChorus\n副歌\n"
           "BRIDGE\n桥段\nOutro:\n尾声\nMusic\n⸻\nVerse 2\n")
    innocent = ("[Verse 1]\nEvery promise felt too big to break\n"
                "[Chorus]\nthe music stays when everybody goes\n")
    g, b, i = bare_labels(good), bare_labels(bad), bare_labels(innocent)
    print(f"正向(写坏的必须抓到): {len(b)} {b}")
    print(f"反向(规范的必须不抓): {len(g)} {g}")
    print(f"反向(真歌词必须不抓): {len(i)} {i}")
    if len(b) < 7: sys.exit("FAIL: 判据太窄")
    if g or i: sys.exit("FAIL: 判据太宽 —— 真歌词里的 break / music 被当成标签了")
    print("校准通过(三向)")
    sys.exit(0)


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
    return ""


def main():
    a = sys.argv[1:]
    if not a or "--calibrate" in a: 
        if "--calibrate" in a: calibrate()
        print("用法: w2280-check-lyric-labels.py <workId> | --file <path> | --calibrate")
        sys.exit(2)

    if a[0] == "--file":
        if len(a) < 2 or not os.path.isfile(a[1]):
            print(f"UNKNOWN: 读不到文件 {a[1] if len(a)>1 else ''} —— 判不了, 不许当通过")
            sys.exit(2)
        lyr = open(a[1], encoding="utf-8").read()
        who = os.path.basename(a[1])
    else:
        wid = a[0]
        db = dburl()
        if not db:
            print("UNKNOWN: 没有 DATABASE_URL —— 判不了, 不许当通过"); sys.exit(2)
        q = ("COPY (SELECT coalesce(title,''), coalesce(lyrics_preview,'') FROM user_works "
             f"WHERE id='{wid}'::uuid) TO STDOUT WITH (FORMAT csv)")
        r = subprocess.run(["psql", db, "-X", "-q", "-c", q], capture_output=True, text=True)
        if r.returncode:
            print(f"UNKNOWN: psql 失败 —— 判不了, 不许当通过: {r.stderr[:160]}"); sys.exit(2)
        rows = list(csv.reader(io.StringIO(r.stdout)))
        if not rows:
            print(f"UNKNOWN: 库里没有这个 work {wid[:8]} —— work_id 只能查不能想"); sys.exit(2)
        who, lyr = f"{wid[:8]} [{rows[0][0]}]", rows[0][1]
        if not lyr.strip():
            print(f"UNKNOWN: {who} 的 lyrics_preview 是空的 —— 判不了, 不许当通过"); sys.exit(2)

    lab = bare_labels(lyr)
    nline = len([l for l in lyr.split("\n") if l.strip()])
    print(f"{who}  非空行 {nline} · 裸段落标签 {len(lab)}")
    if lab:
        print(f"  BLOCK: 段落标签没在方括号里: {', '.join(lab[:8])}"
              + (f" … 共 {len(lab)} 个" if len(lab) > 8 else ""))
        print("  → 引擎只认方括号里的指令; 这些要么被唱出来, 要么被静默丢掉,"
              " 两种都等于段落结构没传进去。改成 [Chorus] 这种写法再来。")
        sys.exit(1)
    print("  → 干净, 可生成")
    sys.exit(0)


main()
