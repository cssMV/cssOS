#!/usr/bin/env python3
"""CSSOS_WAVE_2028b — 云使: 出歌之后到对齐之前的一整段, 无人值守。

等三首歌 → 解码实测时长 → 选 take → 挂音频+歌词 → 逐字对齐 → 落时间轴。

【为什么不用 ffprobe 量时长】它对 VBR 无头 mp3 会谎报, 实测差过一倍
(707.8s vs 真 414.7s; 萨福这批也差了 160s)。一律解码到 null 再读 time=。
时长错了, 后面重切、装配、字幕全跟着错, 而且不会有任何人报错。
"""
import json, os, re, subprocess, sys, time

TMP = "/srv/cssos/tmp"
LOG = f"{TMP}/megha-songs.log"
SLUGS = ["m1-purvamegha", "m2-marga", "m3-uttaramegha"]
WIDS = {"m1-purvamegha": "f6071829-0314-4fc5-9046-7b8c9dabc61a",
        "m2-marga":      "0718293a-1425-40d6-8157-8c9dabc72b0b",
        "m3-uttaramegha":"18293a4b-2536-41e7-9268-9dabc83c1c2d"}
LYR = "/tmp/megha-lyrics.json"

def sh(c, **k): return subprocess.run(c, shell=isinstance(c, str), capture_output=True, text=True, **k)
TOK = sh(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"]).stdout.split("=",1)[1].strip().strip('"')
DBU = sh('sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d \'"\'').stdout.strip()

def wait_songs(timeout=5400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        urls = re.findall(r"https://\S+?\.mp3", open(LOG).read()) if os.path.exists(LOG) else []
        if len(urls) >= 6:
            return urls
        time.sleep(20)
    sys.exit(f"等歌超时, 目前只有 {len(urls)} 条")

def real_len(path):
    """解码实测 —— 不信 ffprobe 的 VBR 报数。"""
    r = sh(["ffmpeg","-hide_banner","-nostdin","-stats","-i",path,"-f","null","-"])
    m = re.findall(r"time=(\d+):(\d+):([\d.]+)", r.stdout + r.stderr)
    if not m: return 0.0
    h, mm, s = m[-1]
    return int(h)*3600 + int(mm)*60 + float(s)

def main():
    urls = wait_songs()
    print(f"拿到 {len(urls)} 条 take", flush=True)
    d = f"{TMP}/megha-audio"; os.makedirs(d, exist_ok=True)
    picked, lens = {}, {}
    for slug in SLUGS:
        cands = [u for u in urls if "/" + slug + "-take" in u]
        best, best_len = None, -1
        for u in cands:
            p = os.path.join(d, os.path.basename(u))
            if not os.path.exists(p) or os.path.getsize(p) < 4096:
                sh(["curl","-s","-m","300","-o",p,u])
            L = real_len(p)
            print(f"  {os.path.basename(u)[:44]}  解码 {L:.2f}s", flush=True)
            if L > best_len: best, best_len = u, L
        if not best: sys.exit(f"{slug} 没有可用 take")
        picked[slug], lens[slug] = best, round(best_len, 2)
        print(f"  -> 选 {os.path.basename(best)[:44]}  {best_len:.2f}s", flush=True)

    key = {"m1-purvamegha":"p1","m2-marga":"p2","m3-uttaramegha":"p3"}
    json.dump({key[s]: lens[s] for s in SLUGS}, open(f"{TMP}/megha-audio-len.json","w"), indent=1)
    print("时长(解码实测):", {key[s]: lens[s] for s in SLUGS}, flush=True)

    lyr = json.load(open(LYR))
    tag = "$MGLY$"
    with open("/tmp/megha-attach.sql","w") as f:
        for s in SLUGS:
            f.write("UPDATE user_works SET preview_audio_url='%s', lyrics_preview=%s%s%s, "
                    "duration_secs=%d, updated_at=now() WHERE id='%s'::uuid;\n"
                    % (picked[s], tag, lyr[s], tag, int(round(lens[s])), WIDS[s]))
    r = sh(["psql", DBU, "-v", "ON_ERROR_STOP=1", "-f", "/tmp/megha-attach.sql"])
    print("挂音频+歌词:", r.stdout.strip() or r.stderr.strip()[:200], flush=True)

    for s in SLUGS:
        print(f"== 对齐 {s}", flush=True)
        r = sh(["curl","-s","-m","2400","-X","POST",
                f"http://127.0.0.1:3000/api/admin/resubtitle/{WIDS[s]}",
                "-H", f"x-admin-token: {TOK}"])
        try:
            j = json.loads(r.stdout); res = (j.get("results") or [{}])[0]
            last = float(res.get("lastEnd_s") or 0)
            flag = "✅ 在音频内" if last <= lens[s] + 1 else f"⚠️ 超出音频 {last-lens[s]:+.1f}s"
            print(f"   lang={res.get('lang')} 词数={res.get('words')} 末点={last:.1f}s / 音频 {lens[s]}s  {flag}", flush=True)
        except Exception:
            print("   ❌", r.stdout[:180], flush=True)
    print("--- prep 完成 ---", flush=True)

main()
