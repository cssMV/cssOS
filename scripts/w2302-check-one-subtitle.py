#!/usr/bin/env python3
# 单条字幕落盘后的终检。exit 1 = 有问题。
import json, re, subprocess, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
sub, lang, au = sys.argv[1], sys.argv[2], sys.argv[3]
LEAKS = ["The stage opens", "Lighting moves", "Hybrid of traditional", "Lead: Heike biwa",
         "Ambient: Faint wind", "Support: Sh", "Percussion:", "Tempo:", "Video Prompt",
         "Instrumentation:", "Style of Music", "blend of Celtic"]
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()
if not sub:
    print("        ‼ 版本行上没有字幕 —— 没写成"); sys.exit(1)
try:
    d = json.loads(get(sub))
except Exception as e:
    print("        ‼ 字幕取不到(判不了): %s" % str(e)[:60]); sys.exit(1)
present = [str(L.get("lang","")) for L in (d.get("languages") or [])]
ent = next((L for L in (d.get("languages") or []) if str(L.get("lang","")) == lang), None)
if ent is None and len(d.get("languages") or []) == 1: ent = d["languages"][0]
if ent is None:
    print("        ‼ 文件里没有 %s 条目(只有 %s)" % (lang, present)); sys.exit(1)
body, ends = [], []
for s in (ent.get("sections") or []):
    for ln in (s.get("lines") or []):
        t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
        if not t or re.match(r"^\s*\[", t): continue
        body.append(t)
        tk = ln.get("tokens") or [] if isinstance(ln, dict) else []
        ends += [x["t_end"] for x in tk if x.get("t_end") is not None]
leak = [b for b in body if any(k in b for k in LEAKS)]
out = subprocess.run(["ffmpeg","-nostdin","-hide_banner","-i",au,"-f","null","-"],
                     capture_output=True, text=True, timeout=900, stdin=subprocess.DEVNULL).stderr
m = re.findall(r"time=(\d+):(\d+):(\d+\.?\d*)", out)
dur = (int(m[-1][0])*3600 + int(m[-1][1])*60 + float(m[-1][2])) if m else None
mx = max(ends)/1000 if ends else -1
probs = []
if leak: probs.append("还有 %d 行说明, 首个: %s" % (len(leak), leak[0][:60]))
if not body: probs.append("正文空")
if dur and mx > dur + 3: probs.append("越界 %.1fs > %.1fs" % (mx, dur))
if dur is None: probs.append("音频量不到 —— 判不了")
cov = (100*mx/dur) if dur else 0
if probs:
    print("        ⚠ 有问题: %s" % "; ".join(probs)); sys.exit(1)
print("        ✅ 好: %s 条目=%s, %d 行, 末 %.1fs / 音频 %.1fs (%.0f%%), 说明行 0" % (
    lang, present, len(body), mx, dur, cov))
sys.exit(0)
