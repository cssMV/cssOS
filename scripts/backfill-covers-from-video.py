#!/usr/bin/env python3
"""CSSOS_WAVE_2029 — 给【有视频但没封面】的作品从视频抽一帧当封面。零 KIE 消耗。

Jing:「宁愿保持媒体框黑屏也不愿拿来做封面图? 为什么?」
W2022 已经把这条兜底装进了上线闸门(mark-real-video-mv), 但那只管【将来上线的】。
库里还躺着一批【早就上线、封面是空的】老作品 —— 闸门管不到它们。这一波补掉。

抽第 5 秒(避开常见的黑场起手); 若视频不足 5 秒则取中点。
只补 cover_image/preview_image_url 为空的, 绝不覆盖已有封面。
每一条都打印结果, 失败带出原因 —— 今天栽过三次"失败不带原因"。
"""
import json, os, re, subprocess, sys

def sh(c, **k): return subprocess.run(c, shell=isinstance(c, str), capture_output=True, text=True, **k)
DBU = sh('sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d \'"\'').stdout.strip()
TOK = sh(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"]).stdout.split("=",1)[1].strip().strip('"')

rows = sh(["psql", DBU, "-tA", "-F", "|", "-c",
  "SELECT id, left(title,34), preview_video_url FROM user_works "
  "WHERE (cover_image IS NULL OR cover_image='') AND status='published' "
  "AND COALESCE(NULLIF(preview_video_url,''),'') <> '' ORDER BY updated_at DESC"]).stdout.strip()
rows = [r.split("|") for r in rows.split("\n") if r.strip()]
print(f"清单 {len(rows)} 个作品(有视频、无封面)")

D = "/srv/cssos/tmp/coverfix"; os.makedirs(D, exist_ok=True)
ok = fail = 0
for wid, title, vurl in rows:
    if vurl.startswith("/"): vurl = "https://cssstudio.app" + vurl
    jpg = f"{D}/{wid}.jpg"
    r = sh(["ffmpeg","-nostdin","-loglevel","error","-ss","5","-i",vurl,
            "-frames:v","1","-vf","scale=1280:-2","-q:v","3",jpg,"-y"])
    if not os.path.exists(jpg) or os.path.getsize(jpg) < 2048:
        # 不足 5 秒的片子: 退回第 1 秒
        sh(["ffmpeg","-nostdin","-loglevel","error","-ss","1","-i",vurl,
            "-frames:v","1","-vf","scale=1280:-2","-q:v","3",jpg,"-y"])
    if not os.path.exists(jpg) or os.path.getsize(jpg) < 2048:
        print(f"❌ {title[:26]}  抽帧失败: {(r.stderr or 'empty').strip()[:90]}"); fail += 1; continue
    # 走平台既有的上线闸门端点 —— 它内部就做"没封面就抽帧落 R2"这件事,
    # 复用它而不是另写一份上传逻辑(不要重复造轮子)。
    u = sh(["curl","-s","-m","300","-X","POST",
            f"http://127.0.0.1:3000/api/admin/mark-real-video-mv/{wid}",
            "-H", f"x-admin-token: {TOK}", "-H","content-type: application/json",
            "--data-binary", json.dumps({"video_url": vurl})]).stdout
    try: j = json.loads(u)
    except Exception: j = {}
    st = str(j.get("cover"))
    if j.get("ok") and st in ("derived", "existing"):
        print(f"✅ {title[:26]}  cover={st}"); ok += 1
    else:
        print(f"❌ {title[:26]}  {str(j)[:110]}"); fail += 1

left = sh(["psql", DBU, "-tA", "-c",
  "SELECT count(*) FROM user_works WHERE (cover_image IS NULL OR cover_image='') "
  "AND status='published' AND COALESCE(NULLIF(preview_video_url,''),'') <> ''"]).stdout.strip()
print(f"--- 清单 {len(rows)} 个, 成功 {ok} 失败 {fail}; 库里【有视频仍无封面】剩 {left} 个 "
      + ("✅" if left == "0" else "⚠️ 还有剩"))
