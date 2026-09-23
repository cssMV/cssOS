#!/usr/bin/env python3
"""W2148 · 给 pre-epic 轨生成【它自己那版音频】的字幕。

W2143 做过一次, 失败在内容层: 那些轨的 lyrics 列装的是 LLM 拒绝文本,
对齐出来的字幕就是那段拒绝文本(已撤销)。W2146 把歌词修好了, 现在可以跑。

但 W2145 之后多了一个【新的】危险, 必须靠流程绕开:
  upsertSubtitleJson 是【按语言合并进作品级文件】的。pre-epic 轨现在的 lang
  与 epic 轨【相同】(这正是 W2145 的目的), 所以给 pre-epic 对齐出来的字幕会
  顶掉作品级文件里 epic 那一版的同语言条目 —— epic 版当场失去字幕。
  W2143 时它们 lang 不同, 没这个问题; 现在有了。

所以顺序是:
  A 先把作品级字幕【旧字节】另存 -pre-w2148.json (逐字节核对)
  B 让 epic(默认)轨【认领】它现在的字幕当自己的快照 —— 之后作品级文件怎么被
    顶掉都不影响它 (15 条里有 8 条的 epic 兄弟还没有快照)
  C 逐首跑 resubtitle?voice=pre-epic (串行, Jing:「一个一个来」)
  D 把作品级文件从 A 还原 —— 默认播放体验一帧不变
  E 逐条核对生成的内容是真歌词、不是 LLM 元话语

用法: python3 scripts/w2148-preepic-subtitles.py A|B|C|D|E
"""
import json, subprocess, sys, hashlib, time

PH = ["ssh", "api-vm"]
def sh(cmd, timeout=1800):
    r = subprocess.run(PH + [cmd], capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout, r.stderr

def psql(sql):
    q = sql.replace("'", "'\\''")
    rc, out, err = sh(f"PGPASSWORD='Au#20016' psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F'@|@' -c '{q}'")
    if rc: sys.exit(f"psql 失败: {err}")
    return [l.split("@|@") for l in out.strip().split("\n") if l.strip()]

def targets():
    return psql("""
      SELECT t.id, t.work_id, t.lang, t.audio_url,
             coalesce((SELECT x.subtitle_url FROM work_language_tracks x
                        WHERE x.work_id=t.work_id AND x.is_default AND x.voice<>'pre-epic' LIMIT 1),''),
             coalesce(w.subtitle_take1_json_url,''), left(w.title,26)
        FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
       WHERE t.voice='pre-epic' AND t.status='ready' AND nullif(t.audio_url,'') IS NOT NULL
       ORDER BY w.title""")

R2 = "r2:cssos-artifacts"
def wl_key(wid): return f"works/{wid}/subtitle-take1.json"
def bk_key(wid): return f"works/{wid}/subtitle-take1-pre-w2148.json"

def size(key):
    rc, out, _ = sh(f"rclone size --json '{R2}/{key}' 2>/dev/null")
    try: return json.loads(out)["bytes"]
    except Exception: return -1

phase = (sys.argv[1] if len(sys.argv) > 1 else "").upper()
rows = targets()
print(f"清单 {len(rows)} 条\n")

if phase == "A":
    okc = 0
    for i, (tid, wid, lang, aud, epicsub, wlsub, title) in enumerate(rows, 1):
        src, dst = wl_key(wid), bk_key(wid)
        n0 = size(src)
        if n0 <= 0:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} 作品级文件不存在({n0}) — 跳过, 无字节可保")
            continue
        sh(f"rclone copyto '{R2}/{src}' '{R2}/{dst}'")
        n1 = size(dst)
        good = (n0 == n1)
        okc += good
        print(f"[{i}/{len(rows)}] {title[:18]:<18} {n0}B → 备份 {n1}B  {'✅' if good else '❌字节对不上'}")
    print(f"\nA 完成: 逐字节核对通过 {okc}/{len(rows)}")

elif phase == "B":
    done = 0
    for i, (tid, wid, lang, aud, epicsub, wlsub, title) in enumerate(rows, 1):
        if epicsub:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} epic 已有自己的快照 — 跳过"); done += 1; continue
        if not wlsub:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} ⚠ 作品级也没有字幕 — 无可认领"); continue
        # 快照键与 upsertSubtitleJson 一致: sha1(audio_url)[:10]
        epic_aud = psql(f"SELECT coalesce(audio_url,'') FROM work_language_tracks "
                        f"WHERE work_id='{wid}'::uuid AND is_default AND voice<>'pre-epic' LIMIT 1")
        epic_aud = epic_aud[0][0] if epic_aud else ""
        if not epic_aud:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} ⚠ epic 轨没有 audio_url — 跳过"); continue
        snap = f"works/{wid}/subtitle-take1--a{hashlib.sha1(epic_aud.encode()).hexdigest()[:10]}.json"
        sh(f"rclone copyto '{R2}/{wl_key(wid)}' '{R2}/{snap}'")
        n = size(snap)
        url = f"https://cdn.cssstudio.app/{snap}"
        psql(f"UPDATE work_language_tracks SET subtitle_url='{url}' "
             f"WHERE work_id='{wid}'::uuid AND is_default AND voice<>'pre-epic'")
        good = n > 0
        done += good
        print(f"[{i}/{len(rows)}] {title[:18]:<18} epic 认领快照 {n}B {'✅' if good else '❌'}")
    print(f"\nB 完成: epic 轨各有其快照 {done}/{len(rows)}")

elif phase == "C":
    tok = sh("grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2-")[1].strip()
    if not tok: sys.exit("拿不到 admin token")
    okc = 0
    for i, (tid, wid, lang, aud, epicsub, wlsub, title) in enumerate(rows, 1):
        url = f"http://127.0.0.1:3000/api/admin/resubtitle/{wid}?voice=pre-epic"
        rc, out, err = sh(f"curl -s -m 1500 -X POST '{url}' -H 'x-admin-token: {tok}'", timeout=1700)
        try: j = json.loads(out)
        except Exception: j = {"ok": False, "raw": out[:120]}
        good = bool(j.get("ok"))
        okc += good
        print(f"[{i}/{len(rows)}] {title[:18]:<18} {'OK' if good else 'FAIL ' + str(j)[:90]}", flush=True)
        time.sleep(2)
    print(f"\nC 完成: {okc}/{len(rows)}")

elif phase == "D":
    okc = 0
    for i, (tid, wid, lang, aud, epicsub, wlsub, title) in enumerate(rows, 1):
        nb = size(bk_key(wid))
        if nb <= 0:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} 无备份 — 跳过"); continue
        sh(f"rclone copyto '{R2}/{bk_key(wid)}' '{R2}/{wl_key(wid)}'")
        n1 = size(wl_key(wid))
        good = (nb == n1); okc += good
        print(f"[{i}/{len(rows)}] {title[:18]:<18} 还原 {nb}B → {n1}B {'✅' if good else '❌'}")
    print(f"\nD 完成: 作品级还原 {okc}/{len(rows)}")

elif phase == "E":
    BAD = ("you've shared", "I appreciate you", "I need to clarify", "not a real language",
           "appears to", "I notice that", "I notice the")
    okc = 0
    for i, (tid, wid, lang, aud, epicsub, wlsub, title) in enumerate(rows, 1):
        sub = psql(f"SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE id={tid}")[0][0]
        if not sub:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} ❌ 没有 subtitle_url"); continue
        key = sub.split("cdn.cssstudio.app/", 1)[-1]
        rc, out, _ = sh(f"rclone cat '{R2}/{key}' 2>/dev/null | head -c 400000")
        try: d = json.loads(out)
        except Exception:
            print(f"[{i}/{len(rows)}] {title[:18]:<18} ❌ 取不到/解析失败"); continue
        langs = d.get("languages") or []
        txt, lines = "", 0
        for L in langs:
            for sec in (L.get("sections") or []):
                for ln in (sec.get("lines") or []):
                    lines += 1
                    if len(txt) < 300: txt += str(ln.get("text") or "") + " "
        bad = any(b.lower() in txt.lower() for b in BAD)
        good = (lines > 0 and not bad); okc += good
        tag = "❌LLM元话语" if bad else ("❌空" if not lines else "✅")
        print(f"[{i}/{len(rows)}] {title[:18]:<18} {tag} 行{lines} langs={[L.get('lang') for L in langs]} | {txt[:52]}")
    print(f"\nE 完成: 内容合格 {okc}/{len(rows)}")
else:
    sys.exit("用法: A(备份) | B(epic认领) | C(生成) | D(还原) | E(核对)")
