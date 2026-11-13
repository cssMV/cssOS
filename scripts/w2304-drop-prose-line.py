#!/usr/bin/env python3
# W2304: 删掉第三类那一行(Jing 2026-11-12:「那第三类，把那行删了吧」)。
#
# 删在【源头 lyrics_preview】, 不是只删字幕 —— 只改字幕的话这一行还留在源里,
# 下次任何重新生成它又回来(= 那 77 个延时雷的同一类)。
#
# lyrics_preview 是库里一列, 【没有任何历史】。所以整份原文先落 R2 内容哈希地址、
# 回读 cmp 核对, 才允许 UPDATE。改完逐行比对: 必须【只少了第 13 行】, 别的一个字不动。
import difflib, hashlib, os, subprocess, sys, time, urllib.request
UA  = "Mozilla/5.0 (Macintosh) cssos-audit"
ARC = "/tmp/w2304-arc"; os.makedirs(ARC, exist_ok=True)
APPLY = "--apply" in sys.argv
IDS = [("a45dfee6","a45dfee6-ff71-41a4-87ee-5f6b9318c427"),
       ("bb78409f","bb78409f-73b9-42f3-bffc-59b271c4e5f9")]
TARGET_PREFIX = "**A dark, mysterious blend of Celtic folk"

def q(sql, want_text=False):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A",
                        "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=120)
    if r.returncode: print("        SQL FAIL: %s" % r.stderr[:200]); return None
    return r.stdout if want_text else r.stdout.strip()

def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()

print("清单 %d 个作品 · %s\n" % (len(IDS), "真做" if APPLY else "干跑"))
ok = bad = 0
for (w8, wid) in IDS:
    print("[%s]" % w8)
    n1 = q("SELECT count(*) FROM user_works WHERE id='%s'::uuid;" % wid)
    if n1 != "1": print("        ‼ 库里不是 1 行 (%s) —— 停手" % n1); bad += 1; continue
    t = q("SELECT lyrics_preview FROM user_works WHERE id='%s'::uuid;" % wid, want_text=True)
    if t is None: bad += 1; continue
    if t.endswith("\n"): t = t[:-1]
    lines = t.split("\n")
    hits = [i for i, l in enumerate(lines) if l.strip().startswith(TARGET_PREFIX)]
    if len(hits) != 1:
        print("        ‼ 命中 %d 行, 应该正好 1 行 —— 停手" % len(hits)); bad += 1; continue
    idx = hits[0]
    print("        第 %d 行 / 共 %d 行, %d 字符" % (idx + 1, len(lines), len(lines[idx])))

    # ① 原文落 R2(整份 lyrics_preview, 它在库里没有历史)
    bb = t.encode("utf-8")
    sha = hashlib.sha1(bb).hexdigest()[:24]
    key = "artifacts/lyrics-archive/lyr-%s.txt" % sha
    p = os.path.join(ARC, w8 + ".before.txt"); open(p, "wb").write(bb)
    code = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","-m","20","-A",UA,
                           "https://cdn.cssstudio.app/" + key], capture_output=True, text=True).stdout.strip()
    if code != "200":
        subprocess.run("cd /srv/cssos/current && node r2putkey.mjs %s %s text/plain" % (p, key),
                       shell=True, capture_output=True, text=True, timeout=180)
        time.sleep(2)
    try: rb = get("https://cdn.cssstudio.app/" + key)
    except Exception as e: print("        ‼ 存档回读不到: %s —— 不动它" % str(e)[:50]); bad += 1; continue
    if rb != bb: print("        ‼ 存档回读不一致 —— 不动它"); bad += 1; continue
    print("        原文落 R2 ✅ lyr-%s.txt (%d B, 字节级一致)" % (sha, len(bb)))

    new = "\n".join(lines[:idx] + lines[idx+1:])
    # ② 逐行比对: 只准少这一行
    diff = [d for d in difflib.unified_diff(lines, new.split("\n"), lineterm="", n=0)
            if d.startswith(("+", "-")) and not d.startswith(("+++", "---"))]
    if len(diff) != 1 or not diff[0].startswith("-"):
        print("        ‼ 差异不是【只少一行】: %d 处 —— 停手" % len(diff))
        for d in diff[:4]: print("           %s" % d[:90])
        bad += 1; continue
    print("        差异核对: 只少 1 行 ✅  %s" % diff[0][:72])

    if not APPLY:
        print("        [干跑] 会 UPDATE lyrics_preview: %d → %d 行\n" % (len(lines), len(new.split("\n"))))
        ok += 1; continue

    # ③ 写回。用 dollar-quoting, 并先断言 tag 不在正文里 ——
    #    拼字符串的唯一安全前提就是这句断言, 不要省。
    TAG = "w2304q"
    if ("$%s$" % TAG) in new:
        print("        ‼ 正文里出现了 $%s$ 定界符 —— 换 tag 再来, 不拼" % TAG); bad += 1; continue
    sql = "UPDATE user_works SET lyrics_preview = $%s$%s$%s$ WHERE id='%s'::uuid;" % (TAG, new, TAG, wid)
    r2 = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql],
                        capture_output=True, text=True, timeout=120)
    if r2.returncode:
        print("        ‼ UPDATE 失败: %s" % r2.stderr[:200]); bad += 1; continue

    # ④ 回读核对
    t2 = q("SELECT lyrics_preview FROM user_works WHERE id='%s'::uuid;" % wid, want_text=True)
    if t2 is None: bad += 1; continue
    if t2.endswith("\n"): t2 = t2[:-1]
    if t2 != new:
        print("        ‼ 回读和预期不一致 (库 %d 字符 / 预期 %d) —— 人工看" % (len(t2), len(new))); bad += 1; continue
    left = [l for l in t2.split("\n") if l.strip().startswith(TARGET_PREFIX)]
    print("        回读 ✅ %d 行, 那一行还剩 %d 条, 原文可取回 https://cdn.cssstudio.app/%s"
          % (len(t2.split("\n")), len(left), key))
    if left: bad += 1
    else: ok += 1
    print()
print("汇总: 清单 %d · 做成 %d · 有问题 %d" % (len(IDS), ok, bad))
print("VERDICT: W2304-drop-line 结束(做成 %d / 有问题 %d)" % (ok, bad))
