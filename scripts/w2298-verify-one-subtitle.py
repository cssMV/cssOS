#!/usr/bin/env python3
"""判一份刚写好的字幕。四条判据, 两边来源互相独立(W2275/W2297):
  A 语言位 —— 写进去的 lang 必须就是轨的 lang(「写对了时间」和「写对了地方」是两件事)
  B 落在音频之内 —— 跟【整段解码】出来的时长比, 不读 mp3 头
  C 正文 —— 必须是那份干净歌词, 且不含被摘掉的说明行
  D 覆盖 —— 字幕末句要落在歌词最后两行之内(光看秒数看不出「只唱了前半首」)
用法: w2298-verify.py <suburl> <lang> <audio_decoded_secs> <clean_lyrics_file>
退出码 0=好, 1=有问题, 2=判不了(判不了绝不算通过)
"""
import json, re, sys, urllib.request
UA = "Mozilla/5.0 (Macintosh) cssos-audit"
suburl, want, aud_s, lyrf = sys.argv[1], sys.argv[2].lower(), float(sys.argv[3]), sys.argv[4]

def flat(s):
    """只留字母与数字。
    ⚠ 原来是 [^\\w\\u0080-\\uffff] —— 那个区间把【破折号 U+2014 / 弯引号】也当成要保留的字符
    (本意只想保住 CJK)。于是歌词 'Beathach no duine — laoch…' 带破折号, 字幕 token 里没有,
    一份好字幕被判成对不上(校准时 Cú Chulainn 正是这样被误杀)。Python3 的 \\w 对 str
    本就是 Unicode 感知的, CJK/àèì 都算 \\w, 不需要那个区间。"""
    return re.sub(r"[\W_]+", "", str(s or ""), flags=re.UNICODE).lower()

try:
    d = json.loads(urllib.request.urlopen(
        urllib.request.Request(suburl, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8","replace"))
except Exception as e:
    print(f"判不了: 字幕取不到 ({str(e)[:50]})"); sys.exit(2)

present = [str(x.get("lang","")).strip().lower() for x in (d.get("languages") or [])]
lines, ends = [], []
for lg in (d.get("languages") or []):
    if str(lg.get("lang","")).strip().lower() != want: continue
    for sec in (lg.get("sections") or []):
        for ln in (sec.get("lines") or []):
            tk = ln.get("tokens") or []
            t = "".join(str(x.get("char","")) for x in tk).strip()
            if t: lines.append(t)
            ends += [float(x["t_end"]) for x in tk if isinstance(x.get("t_end"), (int,float))]

lyr = [l.strip() for l in open(lyrf, encoding="utf-8").read().split("\n")
       if l.strip() and not l.strip().startswith("[")]
probs = []
if want not in present: probs.append(f"A: 写成了 {present} —— 没有 {want}, 播放端读不到")
if not ends: probs.append("B: 没有时间轴")
elif max(ends)/1000 > aud_s + 3: probs.append(f"B: 越界 {max(ends)/1000:.1f}s > 音频 {aud_s:.1f}s")
if not lines: probs.append("C: 没有正文")
else:
    body = [l for l in lines if not re.fullmatch(r"\[.*\]", l)]
    # 不按【行】比 —— 字幕的分行跟歌词的分行本来就不一样(buildSubtitleSections 会合行/拆行),
    # 按行比会把一份好字幕判成坏的(校准时 Cú Chulainn 正是这样被误杀)。
    # 压扁成一条无分隔的字符串之后: 合行 = 连续几行的拼接 = 仍是子串; 拆行 = 子串。
    # 而 LLM 那段说明无论怎么比都不在里面 —— 这一条照样抓得住它。
    hay = flat("".join(lyr))
    alien = [l for l in body if flat(l) and flat(l) not in hay]
    if alien: probs.append(f"C: {len(alien)} 行不在干净歌词里, 首个: {alien[0][:60]}")
    # D 末句在歌词里的【位置】(不是行号 —— 分行不可比, 字符位置可比)
    tail = flat(body[-1]) if body else ""
    at = hay.rfind(tail) if tail else -1
    if at < 0:
        probs.append(f"D: 末句在歌词里对不上: {body[-1][:50] if body else ''}")
    elif hay and (at + len(tail)) < len(hay) * 0.85:
        probs.append(f"D: 末句落在歌词 {(at+len(tail))/len(hay)*100:.0f}% 处 = 后面的词没唱到/没对上 = 截断")

cov = (max(ends)/1000/aud_s*100) if ends and aud_s else 0
if probs:
    print("有问题: " + "; ".join(probs)); sys.exit(1)
print(f"好: {want} 独占{'' if len(present)==1 else '(同文件另有 '+','.join(p for p in present if p!=want)+', 是多语言胶囊)'}, "
      f"{len(lines)} 行, 末 {max(ends)/1000:.1f}s / 音频 {aud_s:.1f}s ({cov:.0f}%), 正文全部出自干净歌词")
