#!/usr/bin/env python3
"""CSSOS_WAVE_2251 — 扫出 cssTV 里【该翻而没翻】的用户可见文案。

第一版判据只认「紧跟在 Text( 后面的字面量」, 于是三元(`Label(a ? "Create ✨" : "Play")`)、
计算属性(`typeBadge`)、状态变量(`status = "…"`)全漏了 —— 实测漏了将近一半, 而它照样报绿。
所以这版反过来: 把【所有含字母的字符串】都当嫌疑, 再逐条结构化排除, 排不掉的必须显式登记。
宁可多问一句, 不要假绿灯。
"""
import re, sys, pathlib

# 显式登记的【非 UI】字符串: 发给后端 LLM 的提示词片段、技术标签。
# 加进来之前先问一句: 它会不会出现在电视屏幕上? 会 → 就该包 tr(), 不该登记在这。
NON_UI = {
    # CreateView / DigitalActorsView: 拼给后端的创作提示词, 不上屏
    "Surprise me — direct an original, shootable work from scratch.",
    " — make it a 3-part triptych", " — make it a multi-act opera",
    " — make it a short drama", " — make it an episodic series",
    " — make it a feature film",
    " Co-starring ", ", plus auto-generated background extras. Weave every cast member into the story.",
    # 分辨率档位: 技术标签, 各语言通用
    "8K", "4K", "1440P", "1080P", "720P", "480P",
    # 品牌名
    "cssOS", "cssstudio.app/tv",
    # SwiftUI 坐标空间名 / 资源名 —— 代码内部标识, 不上屏
    "cssScroll", "MirrorFull", "MirrorRing",
    # 文明胶囊的【键】那一列(label 那一列是 tr("Renaissance"))
    "Renaissance Europe",
    # 时长格式串
    "♪ %d:%02d",
    # App Group / 包名 / JSON 键 / 品牌兜底名
    "group.CSSStudio.cssTV", "cssTV", "uiLocale",
    # 旗舰样本的【作品标题】—— 内容不是 UI, 翻了就是把用户的作品名改掉
    "混沌の海 · The Sea of Chaos",
}
# 前缀型提示词(带插值, 无法整串匹配)
NON_UI_PREFIX = ("Style: ", "Starring ", " Civilization: ", "Create an MV starring the digital actor",
                 ", plus auto-generated background extras")

SKIP_FILES = {"I18n.swift"}

def load_manifest(root):
    """I18n.swift 的 uiStrings。登记在册 = 这条已经有人负责翻(多半在渲染处 tr(变量))。"""
    f = root / "I18n.swift"
    if not f.exists(): return set()
    m = re.search(r'static let uiStrings: \[String\] = \[(.*?)\n    \]', f.read_text(), re.S)
    return set(re.findall(r'^\s*"((?:[^"\\]|\\.)*)",\s*$', m.group(1), re.M)) if m else set()
LIT = re.compile(r'"((?:[^"\\]|\\.)*)"')

def is_structural_non_ui(code, m, lit):
    """能判定不是 UI 的结构, 返回理由; 否则 None。"""
    pre = code[:m.start()]
    post = code[m.end():]
    if pre.rstrip().endswith("tr("):                       return "已包 tr()"
    if re.search(r'(print|fatalError|assert|NSLog)\s*\($', pre.rstrip()[:-0] or " "): pass
    if re.search(r'(print|fatalError|assertionFailure|NSLog)\s*\(', pre):  return "日志/断言"
    # SF Symbol / 资源名 / 键名 / URL
    if re.search(r'(systemImage|image|symbol|forKey|Key|key|named|withExtension|font):\s*$', pre): return "符号/键名"
    # 技术属性赋值: 二维码纠错级别这类, 是参数不是文案。
    # (判据抓到 f.correctionLevel = "M" 时我没把它当误报塞进白名单 ——
    #  "M" 太通用, 全局放行会漏掉真文案; 按【属性名】排除才精确。)
    if re.search(r'\.(correctionLevel|videoGravity|contentMode|scaleMode|httpMethod|mediaType)\s*=\s*$', pre):
        return "技术属性"
    if lit.startswith(("http", "csstv://", "com.", "CSSStudio", "[")):     return "URL/包名/日志前缀"
    if re.search(r'\\\(CSSBackend\.baseURL\)', lit):                        return "URL"
    # 比较 / 分支 / 集合查表 —— 这些位置上的字符串是【键】不是文案
    if re.search(r'(==|!=)\s*$', pre):                                      return "比较"
    if re.search(r'\bcase\s*$', pre) or re.search(r'^\s*case\b', pre):      return "switch 分支键"
    if re.search(r'\.(contains|hasPrefix|hasSuffix|starts|dropFirst|replacingOccurrences|components|split)\w*\([^)]*$', pre): return "字符串运算"
    if re.search(r'^\s*$', post[:1]) and re.search(r':\s*$', pre):          return "字典键"
    if re.search(r'"\s*:', post[:3]):                                        return "字典键"
    # 全小写单词 / 带连字符 = 后端键或 SF Symbol(平台约定: 键小写, 文案首字母大写)
    if re.fullmatch(r'[a-z][a-z0-9_.\-]*', lit):                            return "小写键"
    if re.fullmatch(r'[\s\\nrt]*', lit):                                     return "空白"
    if re.fullmatch(r'__\w+__', lit):                                        return "哨兵 id"
    if re.fullmatch(r'[^A-Za-z]*%[-0-9.]*[a-zA-Z][^A-Za-z]*', lit):           return "格式串"
    if re.match(r'^(take|voice|visual|lang|cat|ts)-', lit):                   return "轨道键"
    if lit in {"POST","GET","PUT","DELETE","application/json","Content-Type",
               "Accept","text/event-stream","Authorization","Library/Caches"}:  return "HTTP/路径"
    if "\\(baseURL)" in lit or "/" in lit:                                      return "URL/路径"
    if re.fullmatch(r'[0-9a-f]{8}-[0-9a-f-]+', lit):                          return "uuid"
    if re.fullmatch(r'\\\([^)]*\)[A-Za-z]?', lit):                            return "纯插值"
    if "#" in lit and "\\(" in lit:                                           return "拼 id"
    if re.fullmatch(r'\\\([^)]*\) \([a-z]+\)', lit):                            return "提示词片段"
    if lit.startswith("\\(") and lit.endswith("-"):                            return "拼 id"
    if re.fullmatch(r'\\\([^)]*\)-\\\([^)]*\)', lit):                          return "拼 id"
    # 字面量里嵌了带引号的插值(如 "\(a)-\(b ?? \"\")"), 正则会在内层引号处提前收尾 →
    # \( 与 ) 不配平。这是【抽取被截断】, 不是一条文案, 不能按文案报。
    if lit.count("\\(") > lit.count(")"):                                     return "插值被截断"
    return None

def scan(root):
    manifest = load_manifest(root)
    flagged = []
    for f in sorted(root.glob("*.swift")):
        if f.name in SKIP_FILES: continue
        src = f.read_text()
        in_block = False
        for i, line in enumerate(src.split("\n"), 1):
            st = line.strip()
            if in_block:
                if "*/" in st: in_block = False
                continue
            if st.startswith("/*"):
                if "*/" not in st: in_block = True
                continue
            if st.startswith(("//", "*")): continue
            code = line.split("//")[0]
            for m in LIT.finditer(code):
                lit = m.group(1)
                bare = re.sub(r'\\\([^)]*\)', '', lit)
                bare = re.sub(r'\\u\{[0-9A-Fa-f]+\}', '', bare)
                if not re.search(r'[A-Za-z]', bare): continue
                if lit in NON_UI or lit.startswith(NON_UI_PREFIX): continue
                if lit in manifest: continue          # 已登记 → 渲染处包了 tr()
                if is_structural_non_ui(code, m, lit): continue
                flagged.append((f.name, i, lit))
    return flagged

if __name__ == "__main__":
    d = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "tvos/cssTV")
    if not d.is_dir(): print(f"目录不存在: {d}"); sys.exit(2)
    hits = scan(d)
    for fn, ln, lit in hits: print(f"{fn}:{ln}  {lit!r}")
    print(f"\n未包 tr() 的疑似文案: {len(hits)} 条")
    sys.exit(1 if hits else 0)
