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

用法（在 api-vm 上跑，需要 KIE_API_KEY）：
    python3 kie-catalog-sync.py [--repo /path/to/src/index.ts]
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

BASE = "https://api.kie.ai/client/v1/model-pricing"
CREATE = "https://api.kie.ai/api/v1/jobs/createTask"
CATS = ("image", "video", "music", "chat")

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
    """问 createTask 这个型号在不在。返回 (alive: bool, msg: str)"""
    body = json.dumps({"model": mid, "input": {}}).encode()
    r = urllib.request.Request(CREATE, body,
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
    """返回 [(model_id, description, interfaceType, usdPrice)]"""
    rows = []
    for cat in CATS:
        for pn in range(1, 12):
            try:
                d = post("/page", {"pageNum": pn, "pageSize": 100, "category": cat}, k)["data"]
            except Exception as e:
                print("  ! %s p%d %s" % (cat, pn, str(e)[:60]))
                break
            rs = d.get("records") or d.get("list") or d.get("rows") or []
            if not rs:
                break
            rows += rs
    out = []
    for x in rows:
        desc = (x.get("modelDescription") or "").strip()
        blob = json.dumps(x, ensure_ascii=False)
        # ID 可能在描述开头, 也可能只在 anchor 里, 也可能哪儿都没有。
        # 三处都找; 找不到就如实记 None —— 不要猜。
        mid = None
        m = re.match(r"^([a-z0-9][a-z0-9-]*/[a-zA-Z0-9][a-zA-Z0-9._-]*)", desc)
        if m:
            mid = m.group(1)
        if not mid:
            m = re.search(r"[a-z0-9][a-z0-9-]*/[a-zA-Z0-9][a-zA-Z0-9._-]*", blob)
            if m and "://" not in m.group(0):
                mid = m.group(0)
        out.append((mid, desc, x.get("interfaceType"), x.get("usdPrice")))
    return out


def repo_ids(path):
    src = open(path, encoding="utf-8").read()
    ids = set(re.findall(
        r'"((?:anthropic|black-forest-labs|bytedance|elevenlabs|fal-ai|google|'
        r'kling|minimax|openai|suno)/[a-zA-Z0-9][a-zA-Z0-9._-]*)"', src))
    return sorted(ids)


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
    mine = repo_ids(repo)
    print("  代码写死: %d 个\n" % len(mine))

    fam = {}
    for m in live:
        fam.setdefault(family(m), set()).add(m)

    print("  逐个问 createTask（不计费）…")
    dead, alive = [], []
    for m in mine:
        ok_, msg = probe_model(m, k)
        if ok_ is None:
            print("     %-36s ? %s" % (m, msg))
            continue
        (alive if ok_ else dead).append(m)

    if dead:
        print("\n  🔴 型号已不存在（createTask 明确拒绝，仍写死在代码里）")
        for m in dead:
            sibs = sorted(fam.get(family(m), set()) - {m})
            print("     %-36s 目录同族: %s" % (m, ", ".join(sibs) or "（目录未列）"))
    if alive:
        print("\n  ✅ 型号在售（%d 个）：%s" % (len(alive), ", ".join(alive)))

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
