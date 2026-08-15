#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KIE 目录同步核对 —— 把代码里写死的模型 ID 跟 KIE 官方目录对一遍。

**为什么需要它**（memory: 模型 ID 必须跟最新版）：
写死的模型 ID 会悄悄过期。供应商上了新版、下架了旧版，代码不会报错 ——
它只是继续用一个更差或已经不存在的型号，而账单照付。

2026-08-12 首次运行就抓到：代码用 `bytedance/seedance-2`，
目录里已经有 `bytedance/seedance-2-5`。

**还抓到过一次分类假设错误**：TTS 模型在 KIE 目录里归在
`interfaceType: "music"` 下（ElevenLabs V3 / Gemini TTS 都在那儿）。
靠猜模型名去试会得出「KIE 没有 TTS」的假结论 —— 必须拉真实目录。

--------------------------------------------------------------------
2026-08-12 复盘：首版报出的 15 个「已下架」**全部是假的**（W1826）
--------------------------------------------------------------------
首版按「厂商/型号」的**形状**硬扫 src/index.ts。但那是个 6.5 万行的多供应商
路由器，里面绝大多数这种串是给 Replicate / Together / HuggingFace / fal.run /
ElevenLabs 用的，KIE 从没见过它们；拿去问 createTask 自然一律被拒。
更危险的是，那份红榜会诱导人把**还能用的** Replicate 型号「修」成 KIE 的名字，
一改就把生产搞坏。

同一个毛病还让它**漏掉了真正下架的**：不含斜杠的 KIE 型号
（sora-2 / flux-kontext-max / gpt-4o-image / omnihuman-1-5 …）一个都没查。

结论：判据必须是**去向**，不是**形状** —— 只核对确实流向 KIE 的位置
（callKieJob 的字面量、KIE 专用注册表、KIE 引擎的兜底值）。见 repo_ids()。

顺带修掉的两个坑：
- `/page` 忽略 `category` 参数，四类各拉一遍 = 同样 408 条抄 4 份，
  首版那个「1632 条记录」是自己乘出来的。
- 型号可能活在**别的端点**上：veo3.1 / veo3_fast 在 `/api/v1/veo/generate`
  上好好的，只是 jobs 的 createTask 不认 —— 首版把它们也算进了下架。见 ALT_ENDPOINTS。

用法（在 api-vm 上跑，需要 KIE_API_KEY）：
    python3 kie-catalog-sync.py [--repo /path/to/src/index.ts]
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

BASE = "https://api.kie.ai/client/v1/model-pricing"
CREATE = "https://api.kie.ai/api/v1/jobs/createTask"
# (原来这里有个 CATS 分类列表, 用来给 /page 传 category —— 实测该参数被服务端忽略,
#  四类拉回来的是同一份 408 条。留着只会把记录数虚报 4 倍, 已删。)

# 【为什么不拿目录的 ID 去核对代码】2026-08-12 踩过:
# 目录的 ID 命名空间与 createTask 接受的【不是同一套】(目录写 ai/seedance-2-5,
# 调用写 bytedance/seedance-2)。拿两套 ID 互相比对会产出一整屏假的「已下架」——
# google/nano-banana 当天被用了上百次, 照样被误判成下架。
#
# 唯一可靠的判据是问 createTask 本人:
#   "The model name you specified is not supported"  → 型号不存在
#   其它任何错误(参数缺失等)                          → 型号在, 只是参数没给对
# 而参数校验发生在计费之前 —— 探测不花钱。目录只用来【发现】新东西与查价。


def probe_model(mid, k):
    """问 KIE 这个型号在不在。返回 (alive: bool, msg: str)

    默认问 jobs 的 createTask; 若属于 ALT_ENDPOINTS 里的族(如 veo), 改问它自己的端点 ——
    否则会把「在专用端点上好好活着」误判成「已下架」。
    """
    url, payload = CREATE, {"model": mid, "input": {}}
    for pat, alt_url, mk in ALT_ENDPOINTS:
        if pat.match(mid):
            url, payload = alt_url, mk(mid)
            break
    body = json.dumps(payload).encode()
    r = urllib.request.Request(url, body,
                               {"Content-Type": "application/json",
                                "Authorization": "Bearer " + k})
    try:
        raw = urllib.request.urlopen(r, timeout=30).read()
    except urllib.error.HTTPError as e:
        raw = e.read()
    except Exception as e:
        return None, str(e)[:60]
    try:
        msg = (json.loads(raw) or {}).get("msg", "") or ""
    except Exception:
        msg = raw[:80].decode("utf-8", "ignore")
    return ("model name you specified is not supported" not in msg.lower()), msg[:70]


def key():
    k = os.environ.get("KIE_API_KEY", "").strip()
    if k:
        return k
    out = subprocess.run(["sudo", "grep", "-m1", "^KIE_API_KEY=", "/etc/cssos.env"],
                         capture_output=True, text=True).stdout
    return out.split("=", 1)[1].strip().strip('"').strip("'") if "=" in out else ""


def post(path, body, k):
    r = urllib.request.Request(BASE + path, json.dumps(body).encode(),
                               {"Content-Type": "application/json",
                                "Authorization": "Bearer " + k,
                                "Accept": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=45).read())


def fetch_catalog(k):
    """返回 [(model_id, description, interfaceType, usdPrice)]

    【category 参数是摆设】2026-08-12 实测: /page 完全忽略 category, 四个分类各拉一遍
    只是把同样的 408 条抄了 4 份 → 首版报告里那个唬人的「1632 条记录」是自己乘出来的。
    现在只拉一遍并按 (slug, 描述) 去重。

    【slug 从 anchor 里取】anchor 的 ?model= 参数才是 createTask 认的那串
    (如 elevenlabs/text-to-speech-multilingual-v2), 而 modelDescription 里那个
    "Elevenlabs Text to Speech" 猜出来的 ai/elevenlabs-tts 根本调不通。
    这跟 TS 侧 deriveKieSlug() 的优先级保持一致: anchor > 描述。
    """
    rows, seen = [], set()
    for pn in range(1, 12):
        try:
            d = post("/page", {"pageNum": pn, "pageSize": 100}, k)["data"]
        except Exception as e:
            print("  ! p%d %s" % (pn, str(e)[:60]))
            break
        rs = d.get("records") or d.get("list") or d.get("rows") or []
        if not rs:
            break
        rows += rs
        if len(rs) < 100:
            break
    out = []
    for x in rows:
        desc = (x.get("modelDescription") or "").strip()
        anchor = x.get("anchor") or ""
        # ① anchor 的 ?model= 最可靠 ② 否则描述开头的 vendor/name ③ 都没有就如实记 None
        mid = None
        m = re.search(r"[?&]model=([^&]+)", anchor)
        if m:
            mid = urllib.parse.unquote(m.group(1)).lower()
        if not mid:
            m = re.match(r"^([a-z0-9][a-z0-9-]*/[a-zA-Z0-9][a-zA-Z0-9._-]*)", desc)
            if m:
                mid = m.group(1)
        key_ = (mid, desc)
        if key_ in seen:
            continue
        seen.add(key_)
        out.append((mid, desc, x.get("interfaceType"), x.get("usdPrice")))
    return out


# 走 KIE 专用端点(不是 jobs API)的模型族。拿它们去 createTask 会得到
# "model name not supported" —— 那是问错了门, 不是型号下架。
# 2026-08-12 血泪: veo3_fast / veo3.1 就是这样被首版误判成"已下架"的,
# 而它们在 /api/v1/veo/generate 上活得好好的。
ALT_ENDPOINTS = [
    (re.compile(r"^veo", re.I), "https://api.kie.ai/api/v1/veo/generate",
     lambda m: {"model": m, "prompt": ""}),
]


def repo_ids(path):
    """只挑【真正会被送进 KIE 的】model 串, 并顺带交出直连供应商的那些以供对照。

    返回 (kie_ids, direct_ids)。

    【首版为什么会误报 15 个】它按 "厂商/型号" 的形状硬扫全文, 扫到什么算什么 ——
    可 src/index.ts 是个 6.5 万行的多供应商路由器, 里面绝大多数这种串是给
    Replicate / Together / HuggingFace / fal.run / ElevenLabs 用的, KIE 压根没见过。
    拿它们去问 createTask, 当然一律被拒 → 一屏红色, 全是假的。
    (更糟的是它还会诱导人把能用的 Replicate 型号"修"成 KIE 的名字, 直接搞坏生产。)

    同时它还【漏报】: 形状不含斜杠的 KIE 型号(sora-2 / veo3.1 / flux-kontext-max /
    gpt-4o-image / omnihuman-1-5)一个都没查到 —— 而真正下架的恰恰在这批里。

    所以判据换成【去向】而不是【形状】: 只认那些确实流向 KIE 的位置。
    """
    src = open(path, encoding="utf-8").read()
    kie = set()

    # ① callKieJob("literal", ...) —— jobs API 唯一咽喉点, 字面量直接算数
    kie |= set(re.findall(r'callKieJob\(\s*"([^"]+)"', src))

    # ② KIE 专用注册表: KIE_MODELS / KIE_IMAGE_GEN_MODELS 里的 id/model 字段。
    #    这两张表的语义就是"给 callKieJob 用的 slug", 不管有没有厂商前缀。
    for tbl in ("KIE_MODELS", "KIE_IMAGE_GEN_MODELS"):
        m = re.search(re.escape(tbl) + r"[^=]*=\s*\[(.*?)\n\];", src, re.S)
        if m:
            kie |= set(re.findall(r'\b(?:id|model)\s*:\s*"([^"]+)"', m.group(1)))

    # ③ resolveEngineModel("kind", "<KIE 引擎>", req, env, "<兜底 slug>") 的兜底值。
    #    只认确实由 KIE 承接的 provider; replicate/luma/kling 那几个是直连, 排除。
    for prov, fb in re.findall(
            r'resolveEngineModel\(\s*"[^"]*"\s*,\s*"(\w+)"[^;]*?"([^"]+)"\s*\)', src):
        if prov in ("seedance", "nanobanana", "veo"):
            kie.add(fb)

    # 【已知盲区, 故意不猜】KIE_CLAUDE_MODEL(如 claude-fable-5)走的是另一条通道
    # api.kie.ai/claude/v1/messages(Anthropic wire format), 既不在 jobs 目录里,
    # 也不认 createTask。它同样会过期(W1808 就是从 opus-4-8 升上来的), 但得用
    # 一次真实 messages 请求去探 —— 那要花钱, 所以这里不做, 由人按 memory 里的
    # 「KIE Market 为准」自行核。别因为它没出现在红榜就以为它被查过了。

    # 剩下的按老规则捞一遍, 只为在报告里【对照展示】—— 它们不参与红榜。
    direct = set(re.findall(
        r'"((?:anthropic|black-forest-labs|bytedance|elevenlabs|fal-ai|google|'
        r'kling|minimax|openai|suno)/[a-zA-Z0-9][a-zA-Z0-9._-]*)"', src)) - kie
    return sorted(kie), sorted(direct)


def family(mid):
    """把 seedance-2 / seedance-2-5 / seedance-2-fast 归到同一族"""
    v, _, name = mid.partition("/")
    stem = re.sub(r"[-_.]?(v?\d+([-._]\d+)*|fast|mini|lite|pro|max|large|medium|small)$",
                  "", name)
    while True:
        s2 = re.sub(r"[-_.]?(v?\d+([-._]\d+)*|fast|mini|lite|pro|max|large|medium|small)$",
                    "", stem)
        if s2 == stem:
            break
        stem = s2
    return v + "/" + stem


def main():
    repo = "/Users/cssos/cssOS/src/index.ts"
    if "--repo" in sys.argv:
        repo = sys.argv[sys.argv.index("--repo") + 1]
    k = key()
    if not k:
        print("  没有 KIE_API_KEY"); return 1

    cat = fetch_catalog(k)
    live = {m for m, _, _, _ in cat if m}
    cover = len(live and [1 for m, _, _, _ in cat if m]) / max(1, len(cat))
    print("  KIE 目录: %d 条记录, %d 个可解析模型 ID (ID 覆盖率 %.0f%%)"
          % (len(cat), len(live), cover * 100))

    # 【自我保护】KIE 的目录接口只保证有 modelDescription, 不保证有干净的模型 ID。
    # 覆盖率低的时候, 「代码里的 X 不在目录里」根本不是证据 —— 只说明我们没解析出来。
    # 宁可不报, 也不要报一堆假的「已下架」。
    print("  （目录只用于发现新型号与查价；「在不在」一律问 createTask）")

    if not os.path.exists(repo):
        print("  (跳过代码核对: 找不到 %s)" % repo); return 0
    mine, direct = repo_ids(repo)
    print("  代码里流向 KIE 的: %d 个（另有 %d 个是直连供应商的, 不归本工具管）\n"
          % (len(mine), len(direct)))

    fam = {}
    for m in live:
        fam.setdefault(family(m), set()).add(m)

    print("  逐个问 KIE（参数校验在计费之前, 基本不花钱；\n"
          "   注意: 极个别型号会接受空 input 真的建单, 如 flux1-kontext）…")
    dead, alive = [], []
    for m in mine:
        ok_, msg = probe_model(m, k)
        if ok_ is None:
            print("     %-36s ? %s" % (m, msg))
            continue
        (alive if ok_ else dead).append(m)

    if dead:
        print("\n  🔴 型号已不存在（KIE 明确拒绝，仍写死在代码里）")
        for m in dead:
            sibs = sorted(fam.get(family(m), set()) - {m})
            print("     %-36s 目录同族: %s" % (m, ", ".join(sibs) or "（目录未列）"))
    if alive:
        print("\n  ✅ 型号在售（%d 个）：%s" % (len(alive), ", ".join(alive)))

    # 直连供应商的串单独列出来, 是为了让人【看见但不误修】。
    # 它们的死活得去各自源站问(Replicate /v1/models、fal.run、Together /v1/models …),
    # KIE 对它们一无所知 —— 首版把这些混进红榜, 才有了那 15 个假的"已下架"。
    if direct:
        print("\n  ⚪ 直连供应商的型号（%d 个，KIE 管不着，勿按 KIE 目录去"
              "「修」它们）" % len(direct))
        for m in direct:
            print("     %s" % m)

    ups = [(m, sorted(fam.get(family(m), set()) - {m})) for m in alive]
    ups = [(m, s2) for m, s2 in ups if s2]
    if ups:
        print("\n  ⚠ 目录里有同族的其它版本，确认是不是该升")
        for m, s2 in ups:
            print("     %-36s → %s" % (m, ", ".join(s2)))

    # 顺带列出语音类 —— 它们归在 music 下, 靠猜名字永远找不到
    tts = [(m, d, p) for m, d, t, p in cat
           if any(w in (d or "").lower() for w in ("text to speech", "tts", "text to dialogue"))]
    if tts:
        print("\n  🎙 目录里的语音合成（注意 interfaceType 是 music，不是 audio）")
        seen = set()
        for m, d, p in tts:
            if d in seen:
                continue
            seen.add(d)
            print("     %-30s %-46s $%s" % (m or "(描述内无 ID)", d[:46], p))
    return 0


if __name__ == "__main__":
    sys.exit(main())
