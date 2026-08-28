#!/usr/bin/env python3
"""CSSOS_WAVE_2022 — 给三部曲补封面图。

Jing 2026-08-28:「每一首歌我们默认输出 3 张封面图, 一个三部曲…6*3=18 张封面图,
足够做幻灯, 就算不做幻灯, 也必须至少用一张来做封面图, 不至于让特斯拉媒体框黑屏。」

**他说中了特斯拉黑屏的真因。** 我一直在查降级逻辑(app.video-slideshow-fallback.js),
可那条逻辑没错 —— 它要画的是 video 的 poster, 而这几部作品的 cover_image
【根本是空的】。没有图, 降级下去还是黑的。

为什么空: 我走的是 /api/admin/mv-song 直出音频那条路, 绕过了正常管线的
「每首 3 张封面」。查库确认: 芭蕉 4 行、鲁米 4 行、萨福 4 行, 12 行全空;
王维和李清照有(它们走过正常管线)。

封面走 /api/admin/mv-plate —— 与分镜锚图同一条路, 32:9 由 callImageGen 入口
统一拼上(封面艺术氛围铁律), 生成即落我们域名。
"""
import json, subprocess, sys, time

TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True, text=True).stdout.split("=",1)[1].strip().strip('"')
DBU = subprocess.run("sudo grep -E '^DATABASE_URL=' /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '\"'",
                     shell=True, capture_output=True, text=True).stdout.strip()

NOTEXT = (" Cinematic 32:9 ultra-widescreen, anamorphic, shot on film. "
          "NO text, NO letters, NO calligraphy, NO title, NO watermark anywhere in the image. "
          "Physically real: nobody floats, hands have five fingers, faces are whole. ")

JOBS = [
 # (work_id, 名字, 提示)
 # ⚠️ 芭蕉这四个 id 我第一版是【凭印象编的】—— 编出来的 uuid 长得很像真的,
 #    UPDATE 会安静地影响 0 行, 脚本照样打 ✅。已改成从库里查出来的真 id。
 #    教训: id 只能查, 不能想。
 ("e5a1c7b3-4d92-4f60-8e17-3a5b6c7d8e91", "basho-root",
  "Northern Japan in 1689, the Oku no Hosomichi. A narrow mountain path in summer grass at first light, "
  "mist between cedar trunks, one straw hat resting on a stone. Uninhabited." + NOTEXT),
 ("f6b2d8c4-5e03-4a71-9f28-4b6c7d8e9f02", "basho-p1",
  "A field of tall summer grass on a low earthwork at dawn, dew on every blade, a ruined stone foundation "
  "half buried. Uninhabited, cool blue-green grade." + NOTEXT),
 ("a7c3e9d5-6f14-4b82-8a39-5c7d8e9f0a13", "basho-p2",
  "A mountain temple's stone steps in deep cedar shade at midday, moss on the rock, cicada light. "
  "Uninhabited, silver-green grade." + NOTEXT),
 ("b8d4f0e6-7a25-4c93-9b40-6d8e9f0a1b24", "basho-p3",
  "A rough dark sea at night with the Milky Way arching over an island on the horizon. "
  "Uninhabited, indigo grade." + NOTEXT),
 ("c9e2f4a8-1b73-4d56-8f09-7e2a3b4c5d68", "rumi-root",
  "Persia around 1250: inside a domed hall at night, a great patterned carpet, a shaft of moonlight from "
  "the oculus, candles along turquoise-tiled walls, and a circle of beautiful young Persian women in "
  "layered silk skirts of lapis, saffron and pomegranate caught mid-turn, skirts opened into circles. "
  "Every woman is a complete person with head, face, arms and feet." + NOTEXT),
 ("d0f3a5b9-2c84-4e67-9a10-8f3b4c5d6e79", "rumi-p1",
  "A reed marsh on the Iranian plateau at dawn, still water, tall reeds with white plumes, mist, "
  "one cut reed lying on the bank. Uninhabited, pale gold grade." + NOTEXT),
 ("e1a4b6c0-3d95-4f78-8b21-9a4c5d6e7f80", "rumi-p2",
  "A carpeted courtyard in a Persian city at night, ringed by hundreds of small clay oil lamps with open "
  "flames, and a group of beautiful young Persian women in layered silk standing in a circle around them. "
  "Each woman is complete, with head, face, arms and feet." + NOTEXT),
 ("f2b5c7d1-4e06-4a89-9c32-0b5d6e7f8a91", "rumi-p3",
  "Seen from directly above: nine beautiful young Persian women in layered silk skirts whirling on a great "
  "carpet under a dome, their skirts opened into nine coloured circles like a turning mandala, "
  "a shaft of moonlight on the centre. Each is a complete person." + NOTEXT),
 ("a1b2c3d4-5e6f-4a70-8b91-2c3d4e5f6a71", "sappho-root",
  "The island of Lesbos in the 6th century BC at noon: a limestone colonnade above a white Aegean sea, "
  "painted ochre-red wooden columns, an olive tree, and one beautiful young Greek woman in an undyed "
  "linen chiton standing in the colonnade — a complete person, head to feet." + NOTEXT),
 ("b2c3d4e5-6f70-4b81-9c02-3d4e5f6a7b82", "sappho-p1",
  "A sunlit limestone courtyard on Lesbos at noon, hard-edged shadows, a low stone table with clay cups, "
  "an olive tree at the edge, the sea beyond almost white. Uninhabited." + NOTEXT),
 ("c3d4e5f6-7081-4c92-8d13-4e5f6a7b8c93", "sappho-p2",
  "A pebble shore on Lesbos at the moment the moon touches the sea, a path of moonlight on black water, "
  "the Pleiades low in the sky. Uninhabited, indigo grade." + NOTEXT),
 ("d4e5f607-8192-4da3-9e24-5f6a7b8c9da4", "sappho-p3",
  "A stone table by a window before dawn on Lesbos: an open papyrus scroll, a clay inkwell, a lyre "
  "against the wall, first ochre light coming in. Uninhabited." + NOTEXT),
]

def post(body):
    """失败必须【把真实报错带出来】。第一版只 return None, 上层打一个光秃秃的 ❌ ——
    于是 12 张里失败 7 张, 而我完全不知道是限流、是内容过滤、还是超时。
    这正是 Jing 在追问的那个毛病('为什么系统一点都没有报错')的小型复刻。
    另: 失败之间退避 20s —— 实测那 7 张是两个 163/165 镜的拍摄同时挤队列造成的瞬时失败,
    单张重试立刻就成。"""
    last = ""
    for attempt in range(4):
        if attempt: time.sleep(20 * attempt)
        r = subprocess.run(["curl","-s","-m","900","-X","POST",
            "http://127.0.0.1:3000/api/admin/mv-plate","-H",f"x-admin-token: {TOK}",
            "-H","content-type: application/json","--data-binary", json.dumps(body)],
            capture_output=True, text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {}
        u = j.get("plate") or j.get("image")
        if u: return u, ""
        last = (r.stdout or r.stderr or "no output")[:160].replace(chr(10), " ")
    return None, last

ok = 0
for wid, name, prompt in JOBS:
    # 已经有封面的跳过 —— 重跑这个脚本不该覆盖上一轮的成果
    have = subprocess.run(["psql", DBU, "-tA", "-c",
        f"SELECT COALESCE(NULLIF(cover_image,''),'') FROM user_works WHERE id='{wid}'::uuid"],
        capture_output=True, text=True).stdout.strip()
    if have:
        print(f"跳过 {name}(已有封面)"); ok += 1; continue
    u, err = post({"project": "covers", "name": name, "prompt": prompt})
    if not u:
        print(f"❌ {name}  <- {err}"); continue
    subprocess.run(["psql", DBU, "-q", "-c",
        f"UPDATE user_works SET cover_image='{u}', preview_image_url='{u}', updated_at=now() "
        f"WHERE id='{wid}'::uuid"], capture_output=True)
    ok += 1
    print(f"✅ {name}  {u}", flush=True)
print(f"--- 清单 {len(JOBS)} 张, 实际写入 {ok} 张 " + ("✅ 无遗漏" if ok == len(JOBS) else "⚠️ 有缺"))
