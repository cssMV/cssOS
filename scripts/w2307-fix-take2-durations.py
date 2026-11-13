#!/usr/bin/env python3
# W2307: 把 Jerusalem 两颗 ♪2 的时长改成实测值
#        (Jing 2026-11-13:「那两个duration_secs也改对吧？」)
#
#   en/auto ♪2  aud-8444daf1…  422 → 实测 258.57s
#   vi/auto ♪2  aud-cd5cba54…  302 → 实测 219.84s
#
# 为什么必须【两处都改】而不只改我上报的那两条版本行:
#   loadWorkTakes 的 :4748 是 `Number(s.dur) > 0 ? s.dur : durByUrl.get(sk)` ——
#   【轨自己那一列优先】。只改 work_media_versions 的话, 接口下发的那颗 ♪ 仍然是
#   work_language_tracks.alt_duration_secs 里的 422 —— 改了等于没改。
#   两处装的是同一个事实(这段音频有多长), 只改一处反而造出一个本来不存在的矛盾。
#
# 为什么敢覆盖(平台默认是不覆盖的):
#   registerMediaVersion 的回填故意带 `AND duration_secs IS NULL`
#   ——「量到的数再准也不覆盖已有的值」。这一轮是 Jing 点名授权改这两个数。
#
# 只认实测: 一律 ffmpeg 整段解码取最后的 time=, 不读 ffprobe 的头
#   (W2302 的教训: 头里写 514s 的文件实际只有 383.6s)。量不到就停手, 不猜。
#
# work_language_tracks / work_media_versions 都【没有历史】→ 改前把这个作品的
# 全部轨 + 全部音频版本行落成 JSON 存档到 R2 内容哈希地址并回读 cmp, 才允许 UPDATE。
import hashlib, json, os, re, subprocess, sys, time, urllib.request

UA   = "Mozilla/5.0 (Macintosh) cssos-audit"
CDN  = "https://cdn.cssstudio.app"
ARC  = "/tmp/w2307-arc"; os.makedirs(ARC, exist_ok=True)
APPLY = "--apply" in sys.argv
WORK = "f4c5e610-d921-433b-8c32-461a52a9d6ea"          # Jerusalem

JOBS = [
    dict(name="en/auto ♪2", trk=23,   ver=5862, old=422,
         aud="aud-8444daf12e1d36a300703e10.mp3"),
    dict(name="vi/auto ♪2", trk=1551, ver=5864, old=302,
         aud="aud-cd5cba5436878d8a138872c8.mp3"),
]

TCOLS = ("id,work_id,lang,voice,status,track_order,audio_url,alt_audio_url,"
         "subtitle_url,duration_secs,alt_duration_secs")
VCOLS = "id,work_id,kind,lang,version_no,label,url,subtitle_url,duration_secs,is_current"


def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A",
                        "-v", "ON_ERROR_STOP=1", "-c", sql],
                       capture_output=True, text=True, timeout=120)
    if r.returncode:
        print("        SQL FAIL: %s" % r.stderr[:240]); return None
    return r.stdout.strip()


def agg(cols, table, where):
    j = q("SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.id)::text,'[]') FROM "
          "(SELECT %s FROM %s WHERE %s) t;" % (cols, table, where))
    return None if j is None else json.loads(j)


def snapshot():
    t = agg(TCOLS, "work_language_tracks", "work_id='%s'::uuid" % WORK)
    v = agg(VCOLS, "work_media_versions", "work_id='%s'::uuid AND kind='audio'" % WORK)
    if t is None or v is None: return None
    return {"work_id": WORK, "tracks": t, "audio_versions": v}


def measure(url):
    """整段解码量时长。量不到返回 None —— 判不了就停手, 绝不猜。"""
    try:
        r = subprocess.run(["ffmpeg", "-nostdin", "-v", "quiet", "-stats",
                            "-i", url, "-f", "null", "-"],
                           capture_output=True, text=True, timeout=900)
    except Exception as e:
        print("        ‼ 解码失败: %s" % str(e)[:60]); return None
    hits = re.findall(r"time=(\d+):(\d\d):(\d\d(?:\.\d+)?)", r.stderr.replace("\r", "\n"))
    if not hits:
        print("        ‼ 解码输出里没有 time= —— 判不了"); return None
    h, m, s = hits[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


print("清单 %d 颗 ♪ · %s\n" % (len(JOBS), "真做" if APPLY else "干跑"))

if q("SELECT count(*) FROM user_works WHERE id='%s'::uuid;" % WORK) != "1":
    print("‼ 作品在库里不是 1 行 —— 停手"); sys.exit(1)

before = snapshot()
if before is None:
    print("‼ 读不到改前快照 —— 停手"); sys.exit(1)

# ① 先把全部轨 + 全部音频版本行落档(这两张表都没有历史)
blob = json.dumps(before, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")
sha  = hashlib.sha1(blob).hexdigest()[:24]
key  = "artifacts/track-archive/trk-%s.json" % sha
p    = os.path.join(ARC, "before.json"); open(p, "wb").write(blob)
code = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "20",
                       "-A", UA, "%s/%s" % (CDN, key)],
                      capture_output=True, text=True).stdout.strip()
if code != "200":
    subprocess.run("cd /srv/cssos/current && node r2putkey.mjs %s %s application/json" % (p, key),
                   shell=True, capture_output=True, text=True, timeout=180)
    time.sleep(2)
try:
    rb = urllib.request.urlopen(urllib.request.Request("%s/%s" % (CDN, key),
         headers={"User-Agent": UA}), timeout=60).read()
except Exception as e:
    print("‼ 存档回读不到: %s —— 什么都不动" % str(e)[:60]); sys.exit(1)
if rb != blob:
    print("‼ 存档回读不一致 —— 什么都不动"); sys.exit(1)
print("改前快照已落 R2 ✅ trk-%s.json (%d 轨 / %d 版本行 / %d B, 字节级一致)\n"
      % (sha, len(before["tracks"]), len(before["audio_versions"]), len(blob)))

tmap = {t["id"]: t for t in before["tracks"]}
vmap = {v["id"]: v for v in before["audio_versions"]}
plan, bad = [], 0

for j in JOBS:
    print("[%s]" % j["name"])
    t, v = tmap.get(j["trk"]), vmap.get(j["ver"])
    if not t or not v:
        print("        ‼ 轨 %s / 版本行 %s 不在这个作品里 —— 跳过" % (j["trk"], j["ver"])); bad += 1; continue
    url = "%s/artifacts/audio/%s" % (CDN, j["aud"])
    # 身份只能按 URL 认, 不按 lang(W2270 的教训)
    if (t["alt_audio_url"] or "").rsplit("/", 1)[-1] != j["aud"]:
        print("        ‼ 轨的 alt_audio_url 不是这段音频 —— 停手"); bad += 1; continue
    if (v["url"] or "").rsplit("/", 1)[-1] != j["aud"]:
        print("        ‼ 版本行的 url 不是这段音频 —— 停手"); bad += 1; continue
    if t["alt_duration_secs"] != j["old"] or v["duration_secs"] != j["old"]:
        print("        ‼ 现值不是 %s(轨 %s / 版本行 %s)—— 可能已被别人改过, 停手"
              % (j["old"], t["alt_duration_secs"], v["duration_secs"])); bad += 1; continue

    secs = measure(url)
    if secs is None: bad += 1; continue
    new = int(round(secs))                      # 平台约定: Math.round(probeRemoteDurationSecs)
    if not (0 < new < j["old"]):
        print("        ‼ 实测 %.2fs 推不出一个比 %s 小的正整数 —— 停手" % (secs, j["old"])); bad += 1; continue
    print("        实测整段解码 %.2fs → %d   (库里: 轨 alt=%s · 版本行=%s)"
          % (secs, new, t["alt_duration_secs"], v["duration_secs"]))
    plan.append(dict(j, new=new, secs=secs))
    print()

if bad or len(plan) != len(JOBS):
    print("汇总: 清单 %d · 可做 %d · 有问题 %d —— 有一条过不了就全不做" % (len(JOBS), len(plan), bad))
    print("VERDICT: W2307 结束(做成 0 / 有问题 %d)" % bad); sys.exit(1)

if not APPLY:
    for j in plan:
        print("[干跑] %s: 轨 %d alt_duration_secs %s→%d · 版本行 %d duration_secs %s→%d"
              % (j["name"], j["trk"], j["old"], j["new"], j["ver"], j["old"], j["new"]))
    print("\nVERDICT: W2307 干跑结束(待做 %d / 有问题 0)" % len(plan)); sys.exit(0)

done = 0
for j in plan:
    print("[%s] 写入" % j["name"])
    r1 = q("WITH u AS (UPDATE work_language_tracks SET alt_duration_secs=%d "
           "WHERE id=%d AND alt_duration_secs=%d RETURNING 1) SELECT count(*) FROM u;"
           % (j["new"], j["trk"], j["old"]))
    r2 = q("WITH u AS (UPDATE work_media_versions SET duration_secs=%d "
           "WHERE id=%d AND kind='audio' AND duration_secs=%d RETURNING 1) SELECT count(*) FROM u;"
           % (j["new"], j["ver"], j["old"]))
    if r1 != "1" or r2 != "1":
        print("        ‼ 影响行数不是 1/1(轨 %s · 版本行 %s)—— 停手" % (r1, r2)); bad += 1; continue
    print("        轨 alt_duration_secs %s→%d ✅ · 版本行 duration_secs %s→%d ✅"
          % (j["old"], j["new"], j["old"], j["new"]))
    done += 1

# ② 回读核对: 只有这 4 个格子变了, 其余逐字未动
after = snapshot()
if after is None:
    print("\n‼ 读不到改后快照 —— 无法核对"); sys.exit(1)
want = {}
for j in plan:
    want[("t", j["trk"], "alt_duration_secs")] = (j["old"], j["new"])
    want[("v", j["ver"], "duration_secs")]     = (j["old"], j["new"])
probs, changed = [], 0
for tag, bl, al in (("t", before["tracks"], after["tracks"]),
                    ("v", before["audio_versions"], after["audio_versions"])):
    bm = {x["id"]: x for x in bl}
    if len(al) != len(bl): probs.append("%s 行数变了 %d→%d" % (tag, len(bl), len(al)))
    for a in al:
        b = bm.get(a["id"])
        if b is None: probs.append("%s 多出一行 id=%s" % (tag, a["id"])); continue
        for k in a:
            if a[k] == b[k]: continue
            changed += 1
            exp = want.get((tag, a["id"], k))
            if exp is None or b[k] != exp[0] or a[k] != exp[1]:
                probs.append("%s id=%s 的 %s 被改成 %s(不在计划内)" % (tag, a["id"], k, a[k]))
if changed != len(want): probs.append("变动格子数 %d, 应为 %d" % (changed, len(want)))

print()
if probs:
    print("‼ 回读核对不通过: %s" % " · ".join(probs)); bad += 1
else:
    print("回读 ✅ 全作品 %d 轨 + %d 版本行里, 只有计划内的 %d 个格子变了, 其余逐字未动"
          % (len(after["tracks"]), len(after["audio_versions"]), changed))

# ③ 接口终检: 用户真正拿到的那颗 ♪ 的时长
for j in plan:
    try:
        d = json.loads(urllib.request.urlopen(urllib.request.Request(
            "https://cssstudio.app/api/works/%s/language-tracks" % WORK,
            headers={"User-Agent": UA}), timeout=60).read().decode("utf-8"))
    except Exception as e:
        print("        ‼ 接口读不到: %s —— 判不了" % str(e)[:60]); bad += 1; continue
    got = [(tk.get("take"), tk.get("duration_secs"))
           for tr in (d.get("tracks") or []) for tk in (tr.get("takes") or [])
           if str(tk.get("url") or "").rsplit("/", 1)[-1] == j["aud"]]
    okn = [g for g in got if g[1] == j["new"]]
    print("        接口下发 %s: %s  %s" % (j["aud"][:22], got,
          "✅ 全部 = %d" % j["new"] if got and len(okn) == len(got) else "‼ 仍有不是 %d 的" % j["new"]))
    if not got or len(okn) != len(got): bad += 1

print("\n汇总: 清单 %d · 做成 %d · 有问题 %d" % (len(JOBS), done, bad))
print("改前快照: %s/%s" % (CDN, key))
print("VERDICT: W2307 结束(做成 %d / 有问题 %d)" % (done, bad))
