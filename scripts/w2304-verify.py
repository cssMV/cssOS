#!/usr/bin/env python3
# W2304 独立复核: 那行散文真的不在了吗? 第一句现在是什么? 旧字节还取得回吗?
# 存档地址【自己从字节重算 sha[:24]】—— 不读日志里那个截短的显示值(W2303 的教训)。
import glob, hashlib, json, os, subprocess, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
PROSE = "A dark, mysterious blend of Celtic folk"
IDS = [("a45dfee6","a45dfee6-ff71-41a4-87ee-5f6b9318c427"),
       ("bb78409f","bb78409f-73b9-42f3-bffc-59b271c4e5f9")]
def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-At", "-c", sql],
                       capture_output=True, text=True, timeout=60)
    return r.stdout.strip()
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()
for (w8, wid) in IDS:
    wl = q("SELECT COALESCE(subtitle_take1_json_url,'') FROM user_works WHERE id='%s'::uuid" % wid)
    au = q("SELECT audio_url FROM work_language_tracks WHERE work_id='%s'::uuid LIMIT 1" % wid)
    vs = q("SELECT COALESCE(subtitle_url,'') FROM work_media_versions WHERE work_id='%s'::uuid AND kind='audio' AND url='%s'" % (wid, au))
    lp = q("SELECT length(lyrics_preview)::text || '字符 / ' || "
           "array_length(string_to_array(lyrics_preview, chr(10)),1)::text || '行' "
           "FROM user_works WHERE id='%s'::uuid" % wid)
    print("\n=== %s ===" % w8)
    print("   源 lyrics_preview: %s   仍含那行散文: %s"
          % (lp, "是 ‼" if q("SELECT (lyrics_preview LIKE '%%A dark, mysterious blend%%')::text FROM user_works WHERE id='%s'::uuid" % wid) == "t" else "否 ✅"))
    print("   地址: 作品级 %s / 版本快照 %s  → %s"
          % (wl.rsplit('/',1)[-1], vs.rsplit('/',1)[-1] if vs else "(无)",
             "同一地址 ‼" if vs == wl else "不同地址 ✅"))
    for lab, u in (("作品级", wl), ("版本快照", vs)):
        if not u: continue
        b = get(u); d = json.loads(b); L = d["languages"][0]
        body = [((ln.get("text") or "").strip()) for s in L["sections"] for ln in s["lines"]]
        body = [t for t in body if t and not t.startswith("[")]
        toks = [x["t_start"] for s in L["sections"] for ln in s["lines"] for x in (ln.get("tokens") or [])]
        print("   %-8s sha=%s %d 行  含那行散文=%s  首句起 %.1fs"
              % (lab, hashlib.sha1(b).hexdigest()[:12], len(body),
                 "是 ‼" if any(PROSE in t for t in body) else "否 ✅",
                 min(toks)/1000 if toks else -1))
        if lab == "作品级":
            for i, t in enumerate(body[:4], 1): print("        %d. %s" % (i, t[:66]))
print("\n=== 旧字节存档(从字节自算 sha, 不读日志里的截短值)===")
for f in sorted(glob.glob("/tmp/w2304-arc/*.before.txt") + glob.glob("/tmp/w2303-arc/*.before.json")):
    b = open(f, "rb").read(); sha = hashlib.sha1(b).hexdigest()[:24]
    sub = "lyrics-archive/lyr-%s.txt" % sha if f.endswith(".txt") else "subtitle-archive/sub-%s.json" % sha
    try:
        rb = get("https://cdn.cssstudio.app/artifacts/" + sub)
        print("   %s %-34s %s  %d B %s" % ("✅" if rb == b else "‼", os.path.basename(f),
              sub.split('/')[-1][:30], len(rb), "字节一致" if rb == b else "不一致"))
    except Exception as e:
        print("   ‼ %-34s 取不到: %s" % (os.path.basename(f), str(e)[:34]))
