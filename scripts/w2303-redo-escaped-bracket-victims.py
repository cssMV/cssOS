#!/usr/bin/env python3
# W2303: 重做 Dragon Reborn ×2 / Narnia ×2 的字幕(Jing 2026-11-12 明确同意)。
#
# 和 W2302 那轮【方向相反】的一点, 必须看清楚:
#   W2302 坏的是【版本快照】, 作品级是好的 → 走 ?snap=1, 作品级指纹【必须不变】。
#   W2303 坏的就是【作品级】本身(62/45 行里 20/10 行是分镜 Prompt 与配器清单)
#     → 不能带 snap, 作品级指纹【必须改变】。照抄 W2302 的"指纹未变 ✅"会把真修当成事故。
#
# 一个一个来(Jing:「不要几路并发」)。每个作品: 旧字节先各自落自己的地址 → 做 → 验 → 比指纹。
import hashlib, json, os, re, subprocess, sys, time, urllib.request
UA  = "Mozilla/5.0 (Macintosh) cssos-audit"
API = "http://127.0.0.1:3000"
ARC = "/tmp/w2303-arc"; os.makedirs(ARC, exist_ok=True)
EXP = "/tmp/w2303-expect.json"
APPLY = "--apply" in sys.argv
TOK = os.environ.get("CSSOS_ADMIN_TOKEN", "")
if not TOK: print("FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"); sys.exit(2)

WORKS = [
 ("a45dfee6", "a45dfee6-ff71-41a4-87ee-5f6b9318c427", "Whispers of the Dragon Reborn"),
 ("bb78409f", "bb78409f-73b9-42f3-bffc-59b271c4e5f9", "Whispers of the Dragon Reborn"),
 ("355b2093", "355b2093-93ee-4eb4-b2c5-019d2bb7145d", "The Chronicles of Narnia"),
 ("4b0363e0", "4b0363e0-6b94-4a6c-9926-d33c5019697d", "The Chronicles of Narnia"),
]

def q(sql):
    for i in (1, 2, 3):
        r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A",
                            "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=60)
        if r.returncode == 0: return r.stdout.strip()
        time.sleep(i * 3)
    print("        ‼ 查库失败: %s" % r.stderr[:160]); return None

def fetch(u, path):
    try:
        b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()
    except Exception as e:
        return None, str(e)[:60]
    open(path, "wb").write(b); return b, None

def archive(url, tag):
    """旧字节落到它自己的内容哈希地址, 回读 cmp 核对。R2 没版本管理, 同 key 写入就是永久删除。"""
    p = os.path.join(ARC, tag + ".before.json")
    b, err = fetch(url, p)
    if b is None: return False, "取不到旧字节: %s" % err
    sha = hashlib.sha1(b).hexdigest()[:24]
    key = "artifacts/subtitle-archive/sub-%s.json" % sha
    code = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","-m","20","-A",UA,
                           "https://cdn.cssstudio.app/" + key], capture_output=True, text=True).stdout.strip()
    if code == "200": return True, "旧字节已在 R2(幂等) sub-%s" % sha[:10]
    subprocess.run("cd /srv/cssos/current && node r2putkey.mjs %s %s application/json" % (p, key),
                   shell=True, capture_output=True, text=True, timeout=180)
    time.sleep(2)
    rb, err2 = fetch("https://cdn.cssstudio.app/" + key, os.path.join(ARC, "rb.json"))
    if rb is None: return False, "存档回读不到: %s" % err2
    if rb != b: return False, "存档回读不一致 —— 不动它"
    return True, "旧字节落 R2 ✅ sub-%s (%d B)" % (sha[:10], len(b))

def check(sub, lang, au, w8, label):
    r = subprocess.run(["python3","-I","/tmp/w2303-check.py", sub or "", lang, au, w8, EXP, label],
                       capture_output=True, text=True, timeout=1200)
    sys.stdout.write(r.stdout)
    return r.returncode

print("清单 %d 个作品 · %s\n" % (len(WORKS), "真做" if APPLY else "干跑"))
ok = bad = unk = n = 0
for (w8, wid, title) in WORKS:
    n += 1
    print("[%d/%d] %s  %s" % (n, len(WORKS), w8, title))
    wl = q("SELECT COALESCE(subtitle_take1_json_url,'') FROM user_works WHERE id='%s'::uuid;" % wid)
    au = q("SELECT COALESCE(audio_url,'') FROM work_language_tracks WHERE work_id='%s'::uuid LIMIT 1;" % wid)
    lang = q("SELECT COALESCE(lang,'') FROM work_language_tracks WHERE work_id='%s'::uuid LIMIT 1;" % wid)
    vs = q("SELECT COALESCE(subtitle_url,'') FROM work_media_versions WHERE work_id='%s'::uuid "
           "AND kind='audio' AND url='%s';" % (wid, au or ""))
    if wl is None or au is None or lang is None or vs is None: unk += 1; print(); continue
    exists = q("SELECT count(*) FROM user_works WHERE id='%s'::uuid;" % wid)
    if exists != "1":
        print("        ‼ 这个 work_id 在库里【一行都没有】—— uuid 是编的, 不是查的"); unk += 1; print(); continue
    if not au: print("        ‼ 有这个作品但没有音频 —— 跳过"); unk += 1; print(); continue
    print("        音频 %s" % os.path.basename(au))
    print("        作品级字幕 %s" % (os.path.basename(wl) if wl else "(库里为空)"))
    print("        版本快照   %s" % (os.path.basename(vs) if vs else "(无, 回退作品级)"))

    # 旧字节: 作品级 + 版本快照 各自落自己的地址
    for (u, tag) in [(wl, w8 + "-worklevel"), (vs, w8 + "-versnap")]:
        if not u: continue
        good, msg = archive(u, tag)
        print("        %s" % msg)
        if not good: unk += 1; break
    else:
        bfp = None
        if wl:
            b, _ = fetch(wl, os.path.join(ARC, w8 + "-wl.before.json"))
            bfp = hashlib.sha1(b).hexdigest()[:16] if b else None
        print("        作品级指纹(动作前): %s" % (bfp or "(取不到)"))
        if not APPLY:
            print("        [干跑] 会 POST ?lang=%s&voice=auto&take=1 (【不带 snap】—— 作品级就是要重写的那一份)" % lang)
            ok += 1; print(); continue

        r = subprocess.run(["curl","-s","-m","1800","-X","POST","-H","x-admin-token: " + TOK,
             "%s/api/admin/resubtitle/%s?lang=%s&voice=auto&take=1" % (API, wid, lang)],
             capture_output=True, text=True, timeout=1900).stdout
        if '"ok":true' not in r:
            print("        FAIL 接口没回 ok:true: %s" % r[:170]); bad += 1; print(); continue
        wlang = (re.search(r'"lang":"([^"]*)"', r) or [None, lang])[1]
        print("        响应: 写进去的语言=%s  %s  %s" % (wlang,
              (re.search(r'"words":\d+', r) or [""])[0], (re.search(r'"clamp":\{[^}]*\}', r) or [""])[0][:88]))

        rc = 0
        nwl = q("SELECT COALESCE(subtitle_take1_json_url,'') FROM user_works WHERE id='%s'::uuid;" % wid)
        nvs = q("SELECT COALESCE(subtitle_url,'') FROM work_media_versions WHERE work_id='%s'::uuid "
                "AND kind='audio' AND url='%s';" % (wid, au))
        rc |= check(nwl, wlang or lang, au, w8, "作品级")
        if nvs: rc |= check(nvs, wlang or lang, au, w8, "版本快照")
        # 指纹【必须改变】—— 这一轮坏的就是作品级本身
        b2, _ = fetch(nwl or wl, os.path.join(ARC, w8 + "-wl.after.json"))
        afp = hashlib.sha1(b2).hexdigest()[:16] if b2 else None
        if bfp and afp and bfp == afp:
            print("        ‼ 作品级字幕【没变】%s —— 这一轮它就是要被重写的那一份, 没变就是没修上" % bfp)
            rc |= 1
        else:
            print("        作品级指纹: %s → %s ✅ 已重写" % (bfp or "?", afp or "?"))
        if rc & 1: bad += 1
        elif rc & 2: unk += 1
        else: ok += 1
        print()
print("汇总: 清单 %d · 实际过 %d %s · 做成 %d · 有问题 %d · 判不了 %d"
      % (len(WORKS), n, "✅无遗漏" if n == len(WORKS) else "⚠有漏", ok, bad, unk))
print("VERDICT: W2303-redo 结束(做成 %d / 有问题 %d / 判不了 %d)" % (ok, bad, unk))
