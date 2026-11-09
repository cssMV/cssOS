#!/usr/bin/env python3
"""W2281 —— 把 user_works.style 那几列中文改成英文。

Jing 2026-11-08:「改成英文。」(答的是「库里 style 列那 7 首要不要改成英文」)

为什么这一列重要: renderLanguageTrack 在发给音乐引擎之前把歌词里【所有方括号内容
剥掉】(src/index.ts 的 cleanLyrics, 注释写着「否则 Suno 会把结构标记当歌词唱出来」),
而曲风只有一个通道:

    prompt: [opts.baseTitle, opts.baseStyle, voicePromptHint].filter(Boolean).join(" — ")

→ 手写词里的 `[Style: …]` 根本到不了引擎。库里这一列脏, 出来的就是真的错的曲风。

────────────────────────────────────────────────────────────────────────
改法【分两种】, 不混着来 —— 这是刻意的, 不是偷懒也不是扩权:

  A 直译就够(中文值本来语义就对, 只是语种违反京典模版第 ⑧ 条)
      巴洛克 → Baroque            (Descartes, civ=近代欧洲)
      古筝   → Guzheng            (Su Wu ×4, civ=中华文明 + 中文词)
    信息量一个不加一个不减。原来是一个词, 改完还是一个词。

  B 直译会把错误原样留着 —— 必须按 civ 改对
      古琴                    → German Baroque / Chamber Organ / Fugal Counterpoint
      空灵古风 / 笛箫 / 留白   → Symphonic March / Massed Brass / Minor-Key Chorus
    「古琴」直译成 Guqin 仍然是古琴版莱布尼茨, 那正是我把这两首从批次里暂挂的理由;
    Jing 答这个问题时点名的就是它们。只直译 = 问了一轮、什么也没解决。
────────────────────────────────────────────────────────────────────────

安全性(写库, 四条写死):
  · 先把旧值整列另存进 w2281_style_backup, 存不进去就一个字不改。
  · 只 UPDATE 写死在 PLAN 里的那几个 work_id, 且【带旧值二次匹配】——
    旧值变了说明别人动过, 不写(work_id 只能查不能想, 旧值也一样)。
  · 默认【干跑】, 真写必须显式 --apply。
  · 写完回读逐首核对。
style 是个文本列, 改它不动任何媒体字节。

用法(api-vm):
  python3 -I scripts/w2281-style-to-english.py           # 干跑
  python3 -I scripts/w2281-style-to-english.py --apply
"""
import csv, io, os, subprocess, sys
csv.field_size_limit(10 ** 7)

APPLY = "--apply" in sys.argv

# (work_id, 预期旧值, 新值, 哪一类)
PLAN = [
    ("7b930b95-f034-4059-962a-ce6233029a6a", "古琴",
     "German Baroque / Chamber Organ / Fugal Counterpoint", "B 按 civ 改对"),
    ("9b6e777e-7b77-4bba-a135-a432f7dc873e", "空灵古风 / 笛箫 / 留白",
     "Symphonic March / Massed Brass / Minor-Key Chorus", "B 按 civ 改对"),
    ("18fc4522-1114-4faa-af3c-8edfb0516836", "巴洛克", "Baroque", "A 直译"),
    ("5430722f-b70e-4bb6-a0c0-bb6dfb5857fd", "古筝", "Guzheng", "A 直译"),
    ("62240132-1e29-4ead-8aa5-a6b76a3f0290", "古筝", "Guzheng", "A 直译"),
    ("4ea3ace0-4786-4a54-8c55-c15b52a9f799", "古筝", "Guzheng", "A 直译"),
    ("f2a0ab52-b62d-4b71-bba4-9bc936c1d55e", "古筝", "Guzheng", "A 直译"),
]


def dburl():
    env = os.environ.get("DATABASE_URL")
    if env: return env
    for ln in open("/etc/cssos.env"):
        ln = ln.strip()
        if ln.startswith("DATABASE_URL="):
            return ln.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("FAIL: 找不到 DATABASE_URL —— 别继续")


def psql(db, sql, quiet=True):
    r = subprocess.run(["psql", db, "-X", "-q"] + (["-t", "-A"] if quiet else []) + ["-c", sql],
                       capture_output=True, text=True)
    return r


def main():
    db = dburl()
    # ── 现状: 旧值必须和 PLAN 里写的一致, 不一致就不动那一首 ──────────
    arr = "{" + ",".join(w for w, *_ in PLAN) + "}"
    q = ("COPY (SELECT id::text, coalesce(title,''), coalesce(civilization,''), coalesce(style,'')"
         f" FROM user_works WHERE id = ANY('{arr}'::uuid[])) TO STDOUT WITH (FORMAT csv)")
    r = psql(db, q)
    if r.returncode: sys.exit("FAIL: psql " + r.stderr[:300])
    cur = {x[0]: x for x in csv.reader(io.StringIO(r.stdout)) if len(x) >= 4}
    print(f"清单 {len(PLAN)} 首 · 库里查到 {len(cur)} 首"
          + ("" if len(cur) == len(PLAN) else "  ⚠ 对不上, 下面会逐首说明"))

    todo, skip = [], []
    for wid, old, new, kind in PLAN:
        row = cur.get(wid)
        if not row:
            skip.append((wid, "库里没有这个 work —— work_id 只能查不能想")); continue
        if row[3] != old:
            skip.append((wid, f"旧值不是 {old!r} 而是 {row[3][:40]!r} —— 别人动过, 不写")); continue
        todo.append((wid, row[1], row[2], old, new, kind))

    print(f"\n{'作品':<10}{'标题':<24}{'civ':<12}{'类':<14}旧 → 新")
    for wid, title, civ, old, new, kind in todo:
        print(f"{wid[:8]:<10}{title[:23]:<24}{(civ or '-')[:11]:<12}{kind:<14}{old!r} → {new!r}")
    for wid, why in skip:
        print(f"{wid[:8]:<10}跳过: {why}")

    if not APPLY:
        print(f"\n[干跑] 会改 {len(todo)} 首, 跳过 {len(skip)} 首。真写加 --apply")
        return

    # ── 先另存旧值, 存不进去就一个字不改 ─────────────────────────────
    r = psql(db, """
      create table if not exists w2281_style_backup (
        work_id uuid, old_style text, changed_at timestamptz default now(), note text);""")
    if r.returncode: sys.exit("FAIL: 建备份表失败, 一个字不改: " + r.stderr[:200])
    for wid, title, civ, old, new, kind in todo:
        o = old.replace("'", "''")
        r = psql(db, f"insert into w2281_style_backup (work_id, old_style, note) "
                     f"values ('{wid}'::uuid, '{o}', 'W2281 style→en');")
        if r.returncode: sys.exit(f"FAIL: {wid[:8]} 备份旧值失败, 不改它, 整批停: {r.stderr[:200]}")
    print(f"\n旧值已另存 {len(todo)} 条 → w2281_style_backup")

    # ── 一首一条 UPDATE, 带旧值二次匹配 ─────────────────────────────
    changed = 0
    for wid, title, civ, old, new, kind in todo:
        o, nw = old.replace("'", "''"), new.replace("'", "''")
        r = psql(db, f"update user_works set style='{nw}', updated_at=now() "
                     f"where id='{wid}'::uuid and style='{o}';")
        n = (r.stdout or "").strip()
        if r.returncode:
            print(f"  {wid[:8]} UPDATE 失败: {r.stderr[:160]}"); continue
        changed += 1
    # ── 回读逐首核对 ───────────────────────────────────────────────
    r = psql(db, q)
    back = {x[0]: x for x in csv.reader(io.StringIO(r.stdout)) if len(x) >= 4}
    good = 0
    print("\n回读:")
    for wid, title, civ, old, new, kind in todo:
        got = back.get(wid, ["", "", "", "(查不到)"])[3]
        mark = "OK" if got == new else "⚠ 不是预期值"
        if got == new: good += 1
        print(f"  {wid[:8]}  {got!r}  {mark}")
    print(f"\n汇总: 计划改 {len(todo)} · 跳过 {len(skip)} · 回读一致 {good} / 清单 {len(PLAN)}",
          "OK" if good == len(todo) and len(todo) + len(skip) == len(PLAN) else "⚠ 对不上, 别信")


main()
