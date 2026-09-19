#!/usr/bin/env python3
"""W2116 验收: 逐个作品比对【takes 数组】与【老字段】。

判据(两条, 缺一不可):
  A. 帧同一 —— 凡是没有额外版本的轨, takes 必须正好等于
     [audio_url] (+ [alt_audio_url] 如果有), 顺序一致, 一个不多一个不少。
  B. 多出来的版本要真的冒出来 —— 指定的 6 首三部曲必须出现 source='versions' 的 ♪N。

校验器自己也要报自己的漏(不然就是假通过): 打印【清单 N / 实际查了 M】。
"""
import json, subprocess, sys

WORKS_SQL = """
SELECT DISTINCT w.id::text
  FROM user_works w
  JOIN work_language_tracks lt ON lt.work_id = w.id
 WHERE lt.audio_url IS NOT NULL AND lt.audio_url <> ''
 ORDER BY 1 LIMIT 400;
"""

EXPECT_EXTRA = [  # 应该长出 source=versions 的那几首(唐伯虎 3 + 李清照 3)
    "唐伯虎三部曲 · 春风得意", "唐伯虎 · 桃花三部曲 · 桃花仙",
    "唐伯虎 · 桃花三部曲 · 花落花开",
    "李清照·声声慢三部曲 · 寻寻觅觅", "李清照·声声慢三部曲 · 怎一个愁字",
    "李清照·声声慢三部曲 · 旧时相识",
]

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout


def main():
    open("/tmp/works.sql", "w").write(WORKS_SQL)
    subprocess.run("scp -q /tmp/works.sql api-vm:/tmp/works.sql", shell=True)
    ids = [l.strip() for l in sh(
        'ssh api-vm \'PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio '
        '-d cssstudio -At -f /tmp/works.sql\'').splitlines() if len(l.strip()) == 36]
    planned = len(ids)
    print(f"清单: {planned} 个作品")

    # 一次 ssh 拉全部, 避免 400 次握手
    script = "for W in " + " ".join(ids) + "; do echo \"@@$W\"; curl -s " \
             "\"http://127.0.0.1:3000/api/works/$W/language-tracks\"; echo; done"
    open("/tmp/pull.sh", "w").write(script)
    subprocess.run("scp -q /tmp/pull.sh api-vm:/tmp/pull.sh", shell=True)
    raw = sh("ssh api-vm 'bash /tmp/pull.sh'")

    checked = 0
    bad_identity, gained = [], {}
    cur_id, buf = None, []

    def flush():
        nonlocal checked
        if not cur_id or not buf:
            return
        try:
            d = json.loads("".join(buf))
        except Exception:
            return
        checked += 1
        for t in d.get("tracks") or []:
            takes = t.get("takes") or []
            a1 = (t.get("audio_url") or "").strip()
            a2 = (t.get("alt_audio_url") or "").strip()
            legacy = [u for u in (a1, a2) if u]
            frm_ver = [k for k in takes if k.get("source") == "versions"]
            if frm_ver:
                gained.setdefault(cur_id, []).append(
                    (t.get("lang"), t.get("voice"), len(takes), len(frm_ver)))
                continue                      # 有额外版本的轨不适用「帧同一」
            got = [k["url"] for k in takes]
            if got != legacy:
                bad_identity.append((cur_id, t.get("lang"), t.get("voice"), legacy, got))

    for line in raw.splitlines():
        if line.startswith("@@"):
            flush(); cur_id, buf = line[2:].strip(), []
        elif cur_id:
            buf.append(line)
    flush()

    print(f"实际查了: {checked} 个  (清单 {planned}; 差 {planned - checked} —— "
          f"{'全覆盖' if checked == planned else '有漏, 见下'})")

    print(f"\n── A. 帧同一 ──")
    if bad_identity:
        print(f"  ❌ {len(bad_identity)} 条轨的 takes 与老字段不一致:")
        for b in bad_identity[:10]:
            print(f"     {b[0][:8]} lang={b[1]} voice={b[2]}\n       老 {b[3]}\n       新 {b[4]}")
    else:
        print(f"  ✅ {checked} 个作品里, 所有【无额外版本】的轨 takes 与老字段逐条一致")

    print(f"\n── B. 多出来的版本真的冒出来了 ──")
    if not gained:
        print("  ❌ 一条都没有 —— 那 9 条 regen-v6 还是没人能播")
    else:
        titles = {}
        for wid in gained:
            open("/tmp/t.sql", "w").write(
                f"SELECT title FROM user_works WHERE id='{wid}';")
            subprocess.run("scp -q /tmp/t.sql api-vm:/tmp/t.sql", shell=True)
            titles[wid] = sh('ssh api-vm \'PGPASSWORD="Au#20016" psql -h 127.0.0.1 '
                             '-U cssstudio -d cssstudio -At -f /tmp/t.sql\'').strip()
        for wid, rows in gained.items():
            for (lang, voice, n, nv) in rows:
                print(f"  ✅ {titles.get(wid,'?')[:30]:32} lang={lang} voice={voice}"
                      f"  共 {n} 版(其中 {nv} 版来自版本表)")
        hit = {titles.get(w, "") for w in gained}
        miss = [t for t in EXPECT_EXTRA if t not in hit]
        print(f"\n  预期 {len(EXPECT_EXTRA)} 首, 命中 {len(EXPECT_EXTRA)-len(miss)} 首"
              + (f"; 没命中: {miss}" if miss else " —— 全中"))

    return 1 if bad_identity else 0


sys.exit(main())
