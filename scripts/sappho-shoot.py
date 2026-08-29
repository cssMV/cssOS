#!/usr/bin/env python3
"""CSSOS_WAVE_2019 — 萨福三部曲拍摄。用法: python3 sappho-shoot.py [plates|p1|p2|p3|all]

【与前三部唯一的结构性差别】约束不再靠正则猜, 直接读分镜表第四列(无/人/二)。
鲁米第三部整段拍坏(红袍女子/两个人/没有人的袍子自己站着)的根因就是那条正则 ——
它里面没有「帽」「袍」「手」「裙裾」, 于是「帽子稳定不动 —— 头是轴」被判成无人镜,
发出去的约束是"此地空无一人"。分类错了, 约束就发反了。

三条已被反复验证的写法铁律, 全部沿用:
 1. 正面表述。"no people" 会被无视, "UNINHABITED / 此地空无一人" 才有效。
 2. 逐镜说【这一镜需要什么】, 不说【允许什么】。"AT MOST ONE person" 曾被读成"放一个进去"。
 3. 要局部就写【中景裁切, 身体继续延伸出画】, 绝不写"只拍手/只拍衣" ——
    芭蕉那只悬空的手、鲁米那件自己站着的袍子, 都是从这种写法里长出来的。
"""
import concurrent.futures as cf
import json, os, re, subprocess, sys, threading

ROOT = "/srv/cssos/tmp"
SHOTS = json.load(open("/tmp/sappho-shotlist.json"))
PROG_F = f"{ROOT}/sappho-shoot-progress.json"
TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True, text=True).stdout.split("=",1)[1].strip().strip('"')

# ── 世界(每镜必发) ────────────────────────────────────────────────────────
WORLD = (
 "Island of Lesbos in the eastern Aegean, 6th century BC, archaic Greece. "
 "Buildings are LIMESTONE AND SUN-DRIED MUD BRICK with terracotta roof tiles; wooden columns are "
 "PAINTED ochre-red and deep blue — this is NOT white classical marble. Clothing is LINEN AND WOOL "
 "only: chiton and himation in undyed cream, ochre or indigo, fastened with a bronze pin. "
 "Objects are clay, bronze, wood and papyrus. Any lamp is a SHALLOW CLAY SAUCER with a floating wick "
 "and an open flame — no glass, no metal body, no chimney. Plants are Mediterranean only: olive, fig, "
 "vine, laurel, thistle, sea-grass. ")

# W2019b — Jing:「你甚至可以使用人类导演一般很难执导的无人机航拍角度。」
# 原来这里写死 "no drone move" 是我自己加的枷锁 —— 那是为了躲引擎的手持抖动,
# 结果把【我们唯一比人类剧组强的地方】一起躲掉了: 不用轨道、不用吊臂、不用直升机,
# 一镜可以从浪尖升到三百米。运镜写进每一镜的描述里, 这里只留画幅与质感。
STYLE = (" Cinematic 32:9 ultra-widescreen, anamorphic, shot on film, natural light only, "
         "no text, no subtitles, no watermark, "
         "no modern object of any kind. Physically real: a person never floats, never stands on water, "
         "hands have exactly five fingers, shadows all fall the same way. ")

SCENE = {
 "p1": WORLD + "MIDDAY. The light is at its fullest — bleaching stone, hard-edged shadows, the sea "
       "almost white. Palette: limestone white, undyed linen, sea blue. ",
 "p2": WORLD + "DUSK FALLING INTO NIGHT. The light drains away steadily. Palette: indigo deepening to "
       "near-black, one cold sliver of moon-white. ",
 "p3": WORLD + "PRE-DAWN INTO SUNRISE. The light comes back. Palette: ochre, papyrus yellow, "
       "breaking gold. ",
}

# ── 三种在场约束, 由分镜表第四列决定 ─────────────────────────────────────
WHO = {
 "无": (" This place is completely deserted: the frame holds only landscape, architecture, objects and "
        "light. NOT A SINGLE PERSON anywhere — nobody in a doorway, nobody at the far end, no figure on "
        "the horizon, no silhouette. "),
 "人": (" EXACTLY ONE person is in frame: SAPPHO, an adult woman of Lesbos, and she is a COMPLETE HUMAN "
        "BEING — head, face, neck, shoulders, both arms, both hands and both feet all present and "
        "connected to one body. No garment ever stands, moves or spins with nobody inside it. She wears "
        "an undyed linen chiton pinned at the shoulder, dark hair bound up with a plain band. She is "
        "barefoot or in simple leather sandals. There is only ONE person — never a second figure. "),
 "二": (" EXACTLY TWO people are in frame, both complete human beings with heads, faces, arms and feet: "
        "a young woman and a man, seated facing each other, talking. Both wear linen — hers undyed, his "
        "ochre. They are shown at a distance, in full figure. Never a third person. "),
}

def clean(d): return re.sub(r"\s+", " ", re.sub(r"\*\*", "", d)).strip()

def post(path, body, tries=6):
    """CSSOS_WAVE_2024b — 重试必须【退避】, 失败必须【带出原因】。

    第一版是 `for _ in range(3)` 无间隔重试, 而且失败只返回 None。
    两部并行开拍时供应商限流, 三次重试在几秒内烧完 -> 一镜记失败,
    163 镜里 150 镜就是这么"失败"的 —— 而单镜直测 85 秒就成功。
    我因此一度以为是 prompt 被内容过滤了, 差点回去改剧本。

    退避 30/60/120/240/480s; 每次把服务端真实响应打出来。
    (同一个毛病今天已经栽了两次: 封面回填 12 张失败 7 张也是它。)"""
    import time as _t
    last = ""
    for i in range(tries):
        if i: _t.sleep(min(480, 30 * (2 ** (i - 1))))
        r = subprocess.run(["curl","-s","-m","900","-X","POST",f"http://127.0.0.1:3000{path}",
            "-H",f"x-admin-token: {TOK}","-H","content-type: application/json",
            "--data-binary", json.dumps(body)], capture_output=True, text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {}
        if j.get("ok"): return j
        last = (r.stdout or r.stderr or "no output")[:150].replace(chr(10), " ")
        if i: print(f"    重试 {i}: {last}", flush=True)
    print(f"    放弃: {last}", flush=True)
    return None

PLATE_F = f"{ROOT}/sappho-plates.json"

def make_plates():
    """每部一张锚图 —— 定住那一部的光与色, 而不是定住某个人的脸。
    (1.5-pro 只在【一镜之内】守得住同一性, 跨镜守不住; 拿脸当锚只会更糟, 已验证。)"""
    want = {
      "p1": SCENE["p1"] + "A sunlit limestone colonnade above the sea at noon, empty, hard shadows on the "
            "stone floor, an olive tree at the edge of frame. UNINHABITED — not a single person." + STYLE,
      "p2": SCENE["p2"] + "A pebble shore at the moment the sun touches the water, the sea going dark, "
            "the outline of olive trees behind. UNINHABITED — not a single person." + STYLE,
      "p3": SCENE["p3"] + "A stone table by a window before dawn, an open papyrus scroll on it, a clay "
            "inkwell, a lyre against the wall. UNINHABITED — not a single person." + STYLE,
    }
    out = json.load(open(PLATE_F)) if os.path.exists(PLATE_F) else {}
    for k, p in want.items():
        if out.get(k): print(f"跳过 {k}(已有)"); continue
        j = post("/api/admin/mv-plate", {"project": "sappho", "name": f"sappho-{k}", "prompt": p})
        url = (j or {}).get("plate") or (j or {}).get("image") or (j or {}).get("url")  # 端点返回的键叫 plate
        if url: out[k] = url
        print(("✅ " if url else "❌ ") + k, url or "")
    json.dump(out, open(PLATE_F, "w")); return out

def shoot(keys, workers=3):
    """CSSOS_WAVE_2024c — 并发 3。

    串行实测 ~3 分钟/镜(供应商队列忙, 不是我们慢), 300 镜 = 15 小时, 太久。
    上一次崩不是因为"并发", 是因为【无退避重试】: 一限流就三次瞬间烧完记失败,
    然后下一镜继续轰 —— 雪崩。退避装好之后, 适度并发是安全的。
    取 3 而不是 8: 再高就是在赌供应商的限流阈值, 而赌输的代价是整批重来。
    进度文件加锁写 —— 三个线程同时 json.dump 会写出半个文件, 那比慢更贵。"""
    plates = json.load(open(PLATE_F))
    prog = json.load(open(PROG_F)) if os.path.exists(PROG_F) else {}
    todo = [r for k in keys for r in SHOTS[k] if not prog.get(f"{k}:{r[1]}", {}).get("ok")]
    print(f"待拍 {len(todo)} 镜 (并发 {workers})", flush=True)
    lock = threading.Lock()

    def one(row):
        pk, num, _t0, _t1, dur, desc, who = row
        j = post("/api/admin/mv-shot", {
            "shot": f"{SHOT_PREFIX}{pk[1]}{num}", "project": PROJECT,
            "model": "bytedance/seedance-1.5-pro", "duration_secs": int(dur),
            "image_url": plates[pk],
            "prompt": SCENE[pk] + clean(desc) + STYLE + WHO[who]})
        url = (j or {}).get("video")
        with lock:
            prog[f"{pk}:{num}"] = {"ok": bool(url), "url": url, "dur": dur, "who": who}
            json.dump(prog, open(PROG_F + ".tmp", "w"))
            os.replace(PROG_F + ".tmp", PROG_F)   # 原子替换, 断电也不会留半个文件
        print(("✅ " if url else "❌ ") + f"{pk}:{num} {dur}s [{who}]", flush=True)

    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(one, todo))

    done = sum(1 for v in prog.values() if v.get("ok"))
    total = sum(len(SHOTS[k]) for k in keys)
    print(f"--- 清单 {total} 镜, 累计成功 {done} 镜 " + ("✅ 无遗漏" if done >= total else f"⚠️ 还缺 {total-done}"))

PROJECT = "sappho"
SHOT_PREFIX = "sp"

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "plates"
    if mode == "plates": make_plates()
    elif mode == "all":  shoot(["p1","p2","p3"])
    else:                shoot([mode])
