#!/usr/bin/env python3
"""W2288 —— 把手写补足的歌词写进 user_works.lyrics_preview。

Jing 2026-11-09:「那 33 首歌词不完整的，请一首一首手写补足。」

为什么写这一列: w2285-replace-placeholder-music.sh 的第 155 行就是从
`user_works.lyrics_preview` 取词, 它的歌词闸门也判这一列。词不落到这里,
「补足」就只停在我的工作目录里, 生成时照样取到那份短词。

为什么允许覆盖: 版本铁律 ——「如果是不完整歌词/音乐/画面, 可以覆盖; 已经完整的
不应该再覆盖, 而是新起一个版本」。这 33 首【正是因为不完整才在这张清单上】。
而且新词【逐字包含原词】(verify-kept.py 33/33 核过, 唯一一处是孔子的标题
从可唱行收进了方括号), 所以没有任何一句词是丢掉的。

三条自保:
 1. 旧值一律先存进 w2288_lyrics_backup(就算是半成品也存 —— 删字节正是要避免的事)。
 2. 一行一条 UPDATE, 带【旧值二次匹配】: 旧词在我读它之后变了就不写。
 3. 回读核对 —— 唯一可信的判据是回读, 不看 psql 的命令标签(W2282 栽过)。
默认干跑, 真写必须 --apply。

用法(api-vm):
  python3 -I scripts/w2288-load-handwritten-lyrics.py <词文件目录>
  python3 -I scripts/w2288-load-handwritten-lyrics.py <词文件目录> --apply
词文件名形如 <workId>-<lang>.txt(与 w2279/w2280 闸门同一套命名)。
"""
import os, re, subprocess, sys, glob

APPLY = "--apply" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    sys.exit("用法: w2288-load-handwritten-lyrics.py <词文件目录> [--apply]")
SRC = args[0]


def dburl():
    env = os.environ.get("DATABASE_URL")
    if env:
        return env
    try:
        for ln in open("/etc/cssos.env"):
            ln = ln.strip()
            if ln.startswith("DATABASE_URL="):
                return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    sys.exit("FAIL: 找不到 DATABASE_URL —— 判不了, 停手")


DB = dburl()


def psql(sql, inp=None):
    r = subprocess.run(["psql", DB, "-X", "-q", "-v", "ON_ERROR_STOP=1"],
                       input=(inp if inp is not None else sql),
                       capture_output=True, text=True)
    return r


def one(sql):
    r = subprocess.run(["psql", DB, "-X", "-q", "-t", "-A", "-c", sql],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit("FAIL psql: " + r.stderr[:300])
    return r.stdout


# 备份表
r = psql("""CREATE TABLE IF NOT EXISTS w2288_lyrics_backup (
              id bigserial PRIMARY KEY,
              work_id uuid NOT NULL,
              old_lyrics_preview text,
              new_len int,
              backed_up_at timestamptz NOT NULL DEFAULT now());""")
if r.returncode:
    sys.exit("FAIL 建备份表: " + r.stderr[:300])

files = sorted(glob.glob(os.path.join(SRC, "*.txt")))
print(f"词文件 {len(files)} 份{'  [--apply 真写]' if APPLY else '  [干跑]'}")
if not files:
    sys.exit("FAIL: 一份都没找到 —— 判不了, 停手")

done = bad = skipped = 0
for p in files:
    base = os.path.basename(p)
    m = re.match(r"^([0-9a-f-]{36})-(\w+)\.txt$", base)
    if not m:
        print(f"  跳过 {base} —— 文件名不是 <workId>-<lang>.txt, 不猜")
        skipped += 1
        continue
    wid = m.group(1)
    new = open(p, encoding="utf-8").read()

    old = one(f"SELECT coalesce(lyrics_preview,'') FROM user_works WHERE id='{wid}'::uuid;")
    # psql -t -A 会在末尾加一个换行, 去掉它再比
    old = old[:-1] if old.endswith("\n") else old
    exists = one(f"SELECT count(*) FROM user_works WHERE id='{wid}'::uuid;").strip()
    if exists != "1":
        print(f"  FAIL {wid[:8]} 库里找不到这个作品 —— 【查不到】不等于【没有】, 不写")
        bad += 1
        continue
    if old.strip() == new.strip():
        print(f"  {wid[:8]} 已经是这份词了 —— 幂等, 跳过")
        skipped += 1
        continue
    # 新词必须【装着旧词的每一句内容】才允许覆盖 —— 这是最后一道防线。
    #
    # 比对【内容】, 不比对带壳的原文行: 外壳换了不算丢。孔子那一首就是例子 ——
    # 它的标题写成 `**孔子忌辰纪念**`、舞台提示写成 `(编钟的悠扬声响起…)`,
    # 按宪法「所有非歌词进方括号」规范化成 `[Title: 孔子忌辰纪念]` / `[编钟…]`。
    # 字一个没少, 只是从「会被唱出来」改成「不唱」。按原文行比对会把这 10 处
    # 误判成「丢了 10 句」(首版正是如此), 于是把一次【正确的修正】拦成了失败。
    def core(s):
        s = s.strip().strip("*").strip()
        for a, b in (("[", "]"), ("(", ")"), ("（", "）"), ("【", "】")):
            if s.startswith(a) and s.endswith(b):
                s = s[1:-1].strip()
        # 规范化时可能加了 `Title: ` 这类前缀, 比对时去掉
        s = re.sub(r"^(Title|标题)\s*[:：]\s*", "", s)
        return s

    new_cores = {core(l) for l in new.split("\n") if l.strip()}
    lost = [l for l in old.split("\n")
            if l.strip() and core(l) and core(l) not in new_cores]
    if lost:
        print(f"  FAIL {wid[:8]} 新词里少了旧词的 {len(lost)} 句 —— 不覆盖: {lost[0][:34]}")
        bad += 1
        continue

    print(f"  {wid[:8]} 旧 {len(old)} 字 → 新 {len(new)} 字 (+{len(new) - len(old)})")
    if not APPLY:
        done += 1
        continue

    sql = (
        "BEGIN;\n"
        "INSERT INTO w2288_lyrics_backup (work_id, old_lyrics_preview, new_len)\n"
        f"  SELECT id, lyrics_preview, {len(new)} FROM user_works WHERE id='{wid}'::uuid;\n"
        "UPDATE user_works SET lyrics_preview = $w2288$" + new + "$w2288$, updated_at = now()\n"
        f"  WHERE id='{wid}'::uuid\n"
        "    AND coalesce(lyrics_preview,'') = $w2288old$" + old + "$w2288old$;\n"
        "COMMIT;\n")
    r = psql("", inp=sql)
    if r.returncode:
        print(f"    FAIL 写库: {r.stderr[:160]}")
        bad += 1
        continue
    back = one(f"SELECT coalesce(lyrics_preview,'') FROM user_works WHERE id='{wid}'::uuid;")
    back = back[:-1] if back.endswith("\n") else back
    if back.strip() != new.strip():
        print(f"    FAIL 回读不是新词(回读 {len(back)} 字) —— 没写进去")
        bad += 1
        continue
    done += 1

print(f"\n汇总: 清单 {len(files)} · 写好 {done} · 跳过 {skipped} · 不过 {bad}"
      + ("" if APPLY else "  [干跑]"))
if done + skipped + bad != len(files):
    sys.exit("FAIL: 账对不上")
sys.exit(1 if bad else 0)
