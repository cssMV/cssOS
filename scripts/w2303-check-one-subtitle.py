#!/usr/bin/env python3
# W2303 单份字幕终检。exit 1 = 有问题, exit 2 = 判不了(绝不当通过)。
#   用法: w2303-check.py <字幕url> <lang> <音频url> <w8> <expect.json> <标签>
# 判「还有没有说明」不用关键词, 用【这一次实际被剔掉的那些行自己的内容片段】——
# 因为字幕管线会把 `*\[Video Prompt: ` 这种前缀剥掉, 剥完之后它读起来就像歌词,
# 按关键词扫 20 行只能抓到 10 行(W2303 实测)。
import json, re, subprocess, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
sub, lang, au, w8, expf, label = sys.argv[1:7]
exp = json.load(open(expf, encoding="utf-8"))[w8]
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()
if not sub:
    print("        ‼ %s: 没有字幕地址" % label); sys.exit(1)
try: d = json.loads(get(sub))
except Exception as e:
    print("        ‼ %s: 字幕取不到(判不了): %s" % (label, str(e)[:60])); sys.exit(2)
langs = [str(L.get("lang","")) for L in (d.get("languages") or [])]
ent = next((L for L in (d.get("languages") or []) if str(L.get("lang","")) == lang), None)
if ent is None and len(d.get("languages") or []) == 1: ent = d["languages"][0]
if ent is None:
    print("        ‼ %s: 文件里没有 %s 条目(只有 %s)" % (label, lang, langs)); sys.exit(1)
body, ends, notok = [], [], 0
for s in (ent.get("sections") or []):
    for ln in (s.get("lines") or []):
        t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
        if not t or re.match(r"^\s*[\[【〔]", t): continue
        body.append(t)
        tk = [x for x in (ln.get("tokens") or []) if x.get("t_end") is not None] if isinstance(ln, dict) else []
        if not tk: notok += 1
        ends += [x["t_end"] for x in tk]
leak = [b for b in body if any(f in b for f in exp["blacklist"])]
out = subprocess.run(["ffmpeg","-nostdin","-hide_banner","-i",au,"-f","null","-"],
                     capture_output=True, text=True, timeout=900, stdin=subprocess.DEVNULL).stderr
m = re.findall(r"time=(\d+):(\d+):(\d+\.?\d*)", out)
dur = (int(m[-1][0])*3600 + int(m[-1][1])*60 + float(m[-1][2])) if m else None
mx = max(ends)/1000 if ends else -1
probs, unk = [], []
if leak: probs.append("还有 %d/%d 行说明, 首个: %s" % (len(leak), len(exp["blacklist"]), leak[0][:52]))
if len(body) != exp["expect_lines"]:
    probs.append("正文 %d 行, 应该是 %d 行(修复前是 %d)" % (len(body), exp["expect_lines"], exp["before_lines"]))
if notok: probs.append("%d/%d 行无 token" % (notok, len(body)))
if dur is None: unk.append("音频量不到")
elif mx > dur + 3: probs.append("越界 %.1f > %.1f" % (mx, dur))
print("        %-12s 条目=%s 正文 %d 行(应 %d) 说明 %d 末 %.1f/音频 %s %s"
      % (label, langs, len(body), exp["expect_lines"], len(leak), mx,
         ("%.1f" % dur) if dur else "?", "❌ " + " · ".join(probs) if probs else ("❓ " + ";".join(unk) if unk else "✅")))
if probs: sys.exit(1)
if unk: sys.exit(2)
sys.exit(0)
