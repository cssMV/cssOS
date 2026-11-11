#!/usr/bin/env python3
# 更准的 C 判据: 字幕行压扁后, 必须是【歌词某一行】压扁后的【子序列】。
#
# 为什么换这把尺子, 而不是放宽原来那把(放宽 = 让数字变好看, 正是要避免的):
#   原判据「是整份歌词压扁后的子串」会把【对齐引擎掉了一个虚词】判成污染 ——
#   歌手没唱 þú / á, whisperX 就不给它时间, 字幕忠实于唱出来的内容, 这是对的。
#   子序列判据同时仍然挡得住真污染: LLM 的英文说明段落不可能是任何一行歌词的子序列。
#   两头都验: 下面对【Cocijo 改前那行英文说明】也跑一次, 它必须仍然判失败。
import json, re, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"


def get(u):
    return urllib.request.urlopen(
        urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()


def flat(s):
    return re.sub(r"[\W_]+", "", str(s or ""), flags=re.UNICODE).lower()


def is_subseq(small, big):
    it = iter(big)
    return all(c in it for c in small)


def best_match(sub, lyr_lines):
    """返回 (是否子序列, 最像的那一行, 掉了哪些字)"""
    f = flat(sub)
    best, best_miss = None, None
    for L in lyr_lines:
        g = flat(L)
        if is_subseq(f, g):
            # 算掉了哪些字
            it, missing, gi = 0, [], 0
            fi = 0
            for ch in g:
                if fi < len(f) and ch == f[fi]:
                    fi += 1
                else:
                    missing.append(ch)
            return True, L, "".join(missing)
        # 记一个最接近的, 便于人眼看
        common = sum(1 for c in set(f) if c in g)
        if best is None or common > best_miss:
            best, best_miss = L, common
    return False, best, None


LYR = "https://cdn.cssstudio.app/artifacts/lyrics/lyr-521e83cd355591e22007ae21.txt"
lyr_lines = [l.strip() for l in get(LYR).decode("utf-8").split("\n")
             if l.strip() and not l.strip().startswith("[")]

SUBS = [("♪1", "https://cdn.cssstudio.app/works/8e751d8e-279f-498b-8c18-03e8707ef070/subtitle-take1--a5f41b19e6d.json"),
        ("♪2", "https://cdn.cssstudio.app/works/8e751d8e-279f-498b-8c18-03e8707ef070/subtitle-take1--afbb069b4ab.json")]

allok = True
for tag, u in SUBS:
    d = json.loads(get(u))
    ent = next((L for L in d["languages"] if L.get("lang") == "non"), None)
    body = []
    for s in (ent.get("sections") or []):
        for ln in (s.get("lines") or []):
            t = ((ln.get("text") if isinstance(ln, dict) else str(ln)) or "").strip()
            if t and not re.match(r"^\s*\[", t):
                body.append(t)
    print("=" * 92)
    print("%s  正文 %d 行 (干净歌词 %d 行)" % (tag, len(body), len(lyr_lines)))
    bad = []
    for t in body:
        ok, which, missing = best_match(t, lyr_lines)
        if not ok:
            bad.append((t, which))
        elif missing:
            print("  ✓ 掉词但仍是那一行: 「%s」" % t[:60])
            print("      歌词原文: 「%s」   少了: %s" % (which[:60], missing))
    if bad:
        allok = False
        print("  ‼ %d 行不是任何一行歌词的子序列:" % len(bad))
        for t, which in bad:
            print("      %s" % t[:90])
            print("        最接近的歌词行: %s" % (which or "(无)")[:90])
    else:
        print("  ✅ 每一行都对得上歌词(含掉虚词的)")
    print()

# 反向校准: 真污染必须仍然判失败
print("=" * 92)
print("反向校准 —— 拿【Cocijo 改前那行英文说明】喂这把新尺子, 它必须仍然失败:")
dirty = ("This new composition maintains the same reverent tone toward Cocijo "
         "(rain deity), flowers (guie'), and the sacred cycle")
ok, which, _ = best_match(dirty, lyr_lines)
print("  %s 判定: %s" % ("❌ 它通过了 —— 这把尺子不能用!" if ok else "✅ 仍然失败",
                         "是子序列" if ok else "不是任何一行的子序列"))
if ok:
    allok = False

print()
print("结论:", "Valhǫll 两颗 ♪ 是做成功的(原判据过严)" if allok else "还有真问题, 不要放过")
sys.exit(0 if allok else 1)
