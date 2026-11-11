#!/usr/bin/env python3
"""把一份字幕里某门语言的每一行正文打出来 —— 判据反复误判时, 人眼定夺(规则不如眼睛)。"""
import json, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
url, want = sys.argv[1], sys.argv[2].lower()
req = urllib.request.Request(url, headers={"User-Agent": UA})
d = json.loads(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
print(f"文件里的语言: {[x.get('lang') for x in (d.get('languages') or [])]}")
for lg in (d.get("languages") or []):
    if str(lg.get("lang","")).strip().lower() != want: continue
    for si, sec in enumerate(lg.get("sections") or []):
        print(f"-- 第{si+1}节 {sec.get('title') or sec.get('name') or ''}")
        for ln in (sec.get("lines") or []):
            tk = ln.get("tokens") or []
            t = "".join(str(x.get("char","")) for x in tk)
            ts = [x.get("t_start") for x in tk if isinstance(x.get("t_start"), (int,float))]
            te = [x.get("t_end") for x in tk if isinstance(x.get("t_end"), (int,float))]
            rng = f"{min(ts)/1000:7.1f}→{max(te)/1000:7.1f}" if ts and te else "   ?  →   ?  "
            print(f"   {rng}  {t}")
