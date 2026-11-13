#!/usr/bin/env python3
# W2305: 把 056c5a62 / 907f2e2e 那两条轨的身份从 lang='orig',voice='auto'
# 改成 lang='ja',voice='orig'(Jing 2026-11-12:「056c5a62/907f2e2e 的轨身份，请改」)。
#
# 为什么 lang 和 voice 必须一起改: 唯一索引是 (work_id, lang, voice), 这两个作品
# 都已经有一条 ja/auto 轨 —— 只把 lang 改成 'ja' 会直接撞上去。
# voice='orig' 不是我造的值: 全库 16 条先例, 前端 app.lang-flag-pills.js 里
# 早有标签 orig → 「旧版」/「Earlier version」。
#
# 为什么要改: 引擎按【轨的 lang】严格精确匹配字幕条目(app.emotion-subtitle-engine.js)。
# lang='orig' 就只会去读字幕文件里那条旧的脏 'orig' 条目, W2302 做好的干净 'ja' 条目
# 永远读不到; 而清掉旧条目反而更糟(占位符兜底要求"只剩一条且那条是占位符")。
# 改轨身份是唯一的真修法 —— 同 W2145「版本身份归 voice 不归 lang」。
#
# work_language_tracks 是库里的行, 【没有任何历史】→ 改前把两个作品的全部轨
# 落成 JSON 存档到 R2 内容哈希地址并回读 cmp, 才允许 UPDATE。
import hashlib, json, os, subprocess, sys, time, urllib.request
UA  = "Mozilla/5.0 (Macintosh) cssos-audit"
ARC = "/tmp/w2305-arc"; os.makedirs(ARC, exist_ok=True)
APPLY = "--apply" in sys.argv
W = [("056c5a62", "056c5a62-517c-452a-a34c-3566d942ad6e"),
     ("907f2e2e", "907f2e2e-4d2f-4efe-9995-7e2b14b38c1a")]
COLS = "id,work_id,lang,voice,status,track_order,audio_url,alt_audio_url,subtitle_url,duration_secs,alt_duration_secs"

def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A",
                        "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=90)
    if r.returncode: print("        SQL FAIL: %s" % r.stderr[:220]); return None
    return r.stdout.strip()

def rows(wid):
    j = q("SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.lang, t.voice)::text,'[]') FROM "
          "(SELECT %s FROM work_language_tracks WHERE work_id='%s'::uuid) t;" % (COLS, wid))
    return None if j is None else json.loads(j)

print("清单 %d 条轨 · %s\n" % (len(W), "真做" if APPLY else "干跑"))
ok = bad = 0
for (w8, wid) in W:
    print("[%s]" % w8)
    if q("SELECT count(*) FROM user_works WHERE id='%s'::uuid;" % wid) != "1":
        print("        ‼ 作品在库里不是 1 行 —— 停手"); bad += 1; continue
    before = rows(wid)
    if before is None: bad += 1; continue
    for t in before:
        print("        轨 lang=%-6s voice=%-9s 音频=%s" % (t["lang"], t["voice"],
              (t["audio_url"] or "").rsplit("/", 1)[-1][:34]))
    tgt = [t for t in before if t["lang"] == "orig" and t["voice"] == "auto"]
    if len(tgt) != 1:
        print("        ‼ lang=orig,voice=auto 的轨有 %d 条, 应该正好 1 条 —— 停手" % len(tgt)); bad += 1; continue
    clash = [t for t in before if t["lang"] == "ja" and t["voice"] == "orig"]
    if clash:
        print("        ‼ 已经存在 ja/orig 轨 —— 会撞唯一索引, 停手"); bad += 1; continue
    tid = tgt[0]["id"]

    # ① 全部轨落存档(库里这张表没有历史)
    blob = json.dumps(before, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")
    sha = hashlib.sha1(blob).hexdigest()[:24]
    key = "artifacts/track-archive/trk-%s.json" % sha
    p = os.path.join(ARC, w8 + ".before.json"); open(p, "wb").write(blob)
    code = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","-m","20","-A",UA,
                           "https://cdn.cssstudio.app/" + key], capture_output=True, text=True).stdout.strip()
    if code != "200":
        subprocess.run("cd /srv/cssos/current && node r2putkey.mjs %s %s application/json" % (p, key),
                       shell=True, capture_output=True, text=True, timeout=180)
        time.sleep(2)
    try:
        rb = urllib.request.urlopen(urllib.request.Request("https://cdn.cssstudio.app/" + key,
             headers={"User-Agent": UA}), timeout=60).read()
    except Exception as e:
        print("        ‼ 存档回读不到: %s —— 不动它" % str(e)[:50]); bad += 1; continue
    if rb != blob: print("        ‼ 存档回读不一致 —— 不动它"); bad += 1; continue
    print("        改前全部轨落 R2 ✅ trk-%s.json (%d B, 字节级一致)" % (sha, len(blob)))

    if not APPLY:
        print("        [干跑] 会 UPDATE 轨 id=%s: lang orig→ja, voice auto→orig\n" % tid); ok += 1; continue

    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c",
          "UPDATE work_language_tracks SET lang='ja', voice='orig' WHERE id=%s "
          "AND lang='orig' AND voice='auto';" % int(tid)], capture_output=True, text=True, timeout=60)
    if r.returncode:
        print("        ‼ UPDATE 失败: %s" % r.stderr[:220]); bad += 1; continue

    # ② 回读核对: 目标行变了, 其余行一个字没动
    after = rows(wid)
    if after is None: bad += 1; continue
    bmap = {t["id"]: t for t in before}; probs = []
    for t in after:
        b = bmap.get(t["id"])
        if b is None: probs.append("多出一条轨 id=%s" % t["id"]); continue
        if t["id"] == tid:
            if not (t["lang"] == "ja" and t["voice"] == "orig"): probs.append("目标轨没改成 ja/orig")
            rest_b = {k: v for k, v in b.items() if k not in ("lang", "voice")}
            rest_a = {k: v for k, v in t.items() if k not in ("lang", "voice")}
            if rest_b != rest_a: probs.append("目标轨除 lang/voice 之外还被改了")
        elif b != t:
            probs.append("无关轨 id=%s 被改动了" % t["id"])
    if len(after) != len(before): probs.append("轨数变了 %d → %d" % (len(before), len(after)))
    for t in after:
        print("        改后 lang=%-6s voice=%-9s 音频=%s" % (t["lang"], t["voice"],
              (t["audio_url"] or "").rsplit("/", 1)[-1][:34]))
    if probs:
        print("        ‼ %s" % " · ".join(probs)); bad += 1
    else:
        print("        回读 ✅ 只有目标轨的 lang/voice 变了, 其余 %d 条轨逐字未动" % (len(after) - 1))
        print("        改前快照: https://cdn.cssstudio.app/%s" % key)
        ok += 1
    print()
print("汇总: 清单 %d · 做成 %d · 有问题 %d" % (len(W), ok, bad))
print("VERDICT: W2305-track-identity 结束(做成 %d / 有问题 %d)" % (ok, bad))
