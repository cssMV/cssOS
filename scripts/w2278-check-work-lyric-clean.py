#!/usr/bin/env python3
"""W2278 闸门 —— 生成母语轨【之前】判一句: 这个作品的源词是不是它自己的词?

为什么必须有这道闸门:
  母语轨那条路(POST /api/works/:id/language-tracks)取词的顺序是
  default track 的 lyrics → lyrics_preview。而 W2277 那 170 首里 lt.lyrics 几乎都是空的,
  所以【真正被转译的就是 lyrics_preview】。
  WAVE_436(2026-05-25)的注释早就写明这一列会带「上一轮的污染」
  (原话: Jerusalem lyrics bleeding into a Darius MV), 但当时只改了【读的优先级】,
  没有人去判「拿到手的这一份到底干不干净」。
  于是 2026-05-10 那批累加污染的 78 首, 一旦进母语轨, 产出的就是
  「挂着 Einstein 名字的英文兰亭曲」—— 花了钱, 做出来是错的。

判据(只用结构, 不靠关键词):
  C1 词里有【裸名行】, 而那个名字是库里【另一个作品的主题】→ 别人的词混进来了。
     名字集合从库里现算, 不是我手写的表 —— 手写表只能找回我已经看见的几个。
  C2 词是 '[seed]' 种子占位 → 还没生成, 不是词。
  C3 system_origin='system_festival' 且词 = 「标题 + core_theme」两行 → 那是提示词种子, 不是词。
  C4 词太短(非空行 < 4) → 没有可转译的内容。

退出码 0 = 干净可生成; 1 = 不许生成(打印原因); 2 = 判不了(取不到词/取不到库)。
「判不了」单独一个码 —— 【取不到】和【没有】不是一回事, 混在一起就会把事故当通过。
"""
import os, re, sys, subprocess

if len(sys.argv) < 2: sys.exit("用法: w2278-check-work-lyric-clean.py <workId>")
wid = sys.argv[1].strip()
if not re.fullmatch(r"[0-9a-fA-F-]{36}", wid): sys.exit("FAIL: workId 形状不对")

def dburl():
    v = os.environ.get("DATABASE_URL")
    if v: return v
    for ln in open("/etc/cssos.env"):
        ln = ln.strip()
        if ln.startswith("DATABASE_URL="):
            return ln.split("=", 1)[1].strip().strip('"').strip("'")
    print("UNKNOWN: 找不到 DATABASE_URL —— 判不了, 不许当通过"); sys.exit(2)

DB = dburl()
def q(sql):
    r = subprocess.run(["psql", DB, "-X", "-q", "-t", "-A", "-F", "\t", "-c", sql],
                       capture_output=True, text=True)
    if r.returncode:
        print("UNKNOWN: psql 失败 ——", r.stderr.strip()[:200]); sys.exit(2)
    return r.stdout

row = q(f"""SELECT coalesce(title,''), coalesce(system_origin,''),
                   replace(coalesce(lyrics_preview,''), chr(10), '~NL~')
              FROM user_works WHERE id='{wid}'::uuid""").rstrip("\n")
if not row:
    print("UNKNOWN: 库里没有这个 work —— work_id 只能查不能想"); sys.exit(2)
title, origin, lyr = (row.split("\t", 2) + ["", ""])[:3]
lyr = lyr.replace("~NL~", "\n")

subj_out = q("SELECT DISTINCT lower(btrim(title)) FROM user_works "
             "WHERE btrim(coalesce(title,'')) <> '' AND status <> 'deleted'")
STRIP = re.compile(r"\s*(忌辰纪念|诞辰纪念|忌辰|诞辰|纪念日?|纪念)\s*")
def subject(t): return STRIP.sub("", re.split(r"[·•/|(（]", t)[0]).strip().lower()
SUBJ = {subject(s) for s in subj_out.split("\n") if len(subject(s)) >= 3}
if len(SUBJ) < 100:
    print(f"UNKNOWN: 只拿到 {len(SUBJ)} 个主题名 —— 判据的一半是空的, 不许当通过"); sys.exit(2)

me = subject(title)
NAMELINE = re.compile(r"^[A-Z][A-Za-z.'-]+(?:\s+(?:[A-Z][A-Za-z.'-]+|[IVX]{1,4})){0,3}$")
lines = [l.strip() for l in lyr.split("\n")]
nonempty = [l for l in lines if l]
body = [l for l in nonempty if not l.startswith(("[", "【", "〔"))]

bad = []
foreign = [l for l in body
           if NAMELINE.match(l) and l.lower() in SUBJ
           and l.lower() != me and l.lower() not in title.lower()]
if foreign:
    bad.append(f"C1 词里嵌着别的作品的主题名: {', '.join(foreign)}"
               f" —— 这是 2026-05-10 那批累加污染的签名, 转译出来会是别人的歌")
if lyr.lstrip().startswith("[seed]"):
    bad.append("C2 词还是 '[seed]' 占位 —— 还没生成, 没有可转译的内容")
if origin == "system_festival" and len(body) <= 2:
    bad.append("C3 这是节日自动作品的【提示词种子】(标题 + core_theme), 不是歌词")
if len(body) < 4:
    bad.append(f"C4 词行只有 {len(body)} 行 —— 没有可转译的内容")

print(f"{wid[:8]} [{title[:34]}] origin={origin or '-'} 词行={len(body)} 主题池={len(SUBJ)}")
for b in bad: print("  BLOCK:", b)
print("  → " + ("源词干净, 可以生成 OK" if not bad else f"{len(bad)} 项不许生成"))
sys.exit(1 if bad else 0)
