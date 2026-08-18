#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《时间帝国》v2 确定性道具生成器 —— 13 件, 一次生成, 逐像素可复现。

【为什么是生成器而不是 13 个手写 HTML】
这些道具里有大量共享成分: 纸张底色、颗粒、暗角、以及【同一个人的签名必须
在两三份文件上一模一样】(Norris 在派工簿与餐巾纸上; Clara 在派工簿与值班簿上)。
手写 13 个文件, 这些共享成分迟早会漂 —— 而这部片讲的恰好就是副本会漂。
共享成分只存在一处, 是唯一能保证它们真的相同的办法。

【签名为什么用 SVG path 而不是字体】
字体依赖渲染机器。SVG path 不依赖任何东西, 在任何机器上逐像素相同。

渲染:
    python3 timeempire-props.py            # 写出 HTML 到 docs/timeempire-plates/props/
    bash   timeempire-props-render.sh       # Chrome headless 渲染成 PNG
"""
import pathlib, sys

OUT = pathlib.Path(__file__).resolve().parent.parent / "docs/timeempire-plates/props"

# ── 共享成分 ────────────────────────────────────────────────────────
GRAIN = ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' "
         "width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' "
         "baseFrequency='.9' numOctaves='4'/></filter><rect width='180' height='180' "
         "filter='url(%23n)' opacity='.5'/></svg>\")")

def base(w, h, desk="#0a0806", font='"Courier New",Courier,monospace'):
    return f"""<style>
  html,body {{ margin:0; width:{w}px; height:{h}px; overflow:hidden;
              background:{desk}; font-family:{font} }}
  .desk {{ position:absolute; inset:0;
    background: repeating-linear-gradient(90deg, rgba(0,0,0,.30) 0 2px,
                  rgba(255,255,255,.014) 2px 8px, rgba(0,0,0,.12) 8px 15px),
                linear-gradient(177deg,#332417 0%,#241910 52%,#140d08 100%) }}
  .vig {{ position:absolute; inset:0; pointer-events:none;
    background: radial-gradient(76% 72% at 48% 46%, rgba(0,0,0,0) 36%, rgba(0,0,0,.88) 100%) }}
  .grain {{ position:absolute; inset:0; pointer-events:none; opacity:.15;
    background-image:{GRAIN} }}
  .paper {{ position:absolute; box-sizing:border-box; color:#1e1810;
    background:linear-gradient(180deg,#b9ab90 0%,#efe7d4 5%,#f2ebda 46%,#ece4d1 88%,#b5a78c 100%);
    box-shadow:0 34px 64px rgba(0,0,0,.80) }}
</style>
<div class="desk"></div>"""

TAIL = '<div class="grain"></div><div class="vig"></div>'

# 【签名 —— 全片只在这里定义一次】
# 同一个人在不同文件上出现时, 引用同一个常量。这是这份生成器存在的首要理由。
SIG = {
 # 【两个人的签名必须一眼看得出不是同一只手】—— earth §4 整场戏就是签名比对。
 # Norris: 小、紧、字母间断开、末笔向右上挑。一个把每件事都写下来的人。
 "norris": ("M10,50 C12,30 18,26 22,34 C25,41 21,50 19,54 "
            "M30,52 C32,34 38,30 42,38 C45,45 41,52 39,56 "
            "M50,54 C52,38 56,32 61,38 C65,43 61,52 59,56 "
            "M70,54 C74,40 80,34 85,40 C89,45 85,53 83,56 "
            "M94,52 L126,26",
            "R. NORRIS"),
 # Clara: 大、连笔、平推, 收尾一条压过去的长横。签了十九年的手。
 "clara":  ("M6,54 C8,18 24,10 36,18 C46,25 36,48 28,56 "
            "C42,32 56,16 70,24 C80,30 68,52 62,58 "
            "C78,36 94,20 110,28 C122,34 110,54 104,58 "
            "C120,44 134,32 152,38 M14,62 L184,54",
            "C. SINCLAIR"),
}
def sig(who, w=190, h=70, color="#1a2a52", sw=2.6, rot=-1.2):
    d, _ = SIG[who]
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 190 70" '
            f'style="transform:rotate({rot}deg)"><path d="{d}" fill="none" '
            f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/></svg>')

FILES = {}
def emit(name, html): FILES[name] = html

# ═══ 1 · prop-the-book ══════════════════════════════════════════════
# 序章 §2 / 第一部 §8 / 第三部 —— 三次同一本, 同一书脊。
# 不许给书名特写, 不许说作者名 —— 所以书脊上【只有磨损, 没有可读的字】。
emit("prop-the-book", base(1800,1200) + """
<style>
  .shelf { position:absolute; left:0; right:0; top:300px; height:600px;
           background:linear-gradient(180deg,#3a2a1c,#241810); }
  .lip   { position:absolute; left:0; right:0; top:895px; height:26px;
           background:linear-gradient(180deg,#5a4028,#2a1c10); box-shadow:0 8px 18px rgba(0,0,0,.7) }
  .row   { position:absolute; left:50%; transform:translateX(-50%); bottom:305px; height:560px;
           display:flex; align-items:flex-end; gap:3px }
  .bk    { width:44px; border-radius:2px 2px 0 0;
           box-shadow:inset -6px 0 10px rgba(0,0,0,.45), 0 -2px 6px rgba(0,0,0,.4) }
  /* 那一本 —— 布面书脊, 磨到发白, 比邻居矮一点、旧一点。没有一个字。 */
  .the   { width:52px; height:470px; background:linear-gradient(90deg,#4e5b4a,#66735e 30%,#3f4a3c);
           box-shadow:inset -7px 0 12px rgba(0,0,0,.5), 0 -2px 8px rgba(0,0,0,.5);
           position:relative }
  .the:after { content:""; position:absolute; left:6px; right:6px; top:70px; height:2px;
               background:rgba(230,225,205,.30) }
  .the:before{ content:""; position:absolute; left:0; right:0; top:0; height:26px;
               background:linear-gradient(180deg,rgba(240,236,220,.22),rgba(0,0,0,0)) }
  .lamp  { position:absolute; inset:0; pointer-events:none; mix-blend-mode:screen;
           background:radial-gradient(46% 42% at 34% 44%, rgba(226,206,150,.30), rgba(0,0,0,0) 70%) }
</style>
<div class="shelf"></div><div class="row" id="r"></div><div class="lip"></div>
<div class="lamp"></div>
<script>
  // 邻居们随机而【固定】—— 用定死的序列, 不用 Math.random(), 否则不可复现
  const H=[520,478,540,505,462,530,496,470,548,512,484,536,458,522,500,474,544,490];
  const C=['#5a2f28','#2f3b52','#4a3f2a','#3a2a34','#54462c','#26343a','#4a2f3c','#3d4a35'];
  const r=document.getElementById('r'); let html='';
  for(let i=0;i<9;i++) html+=`<div class="bk" style="height:${H[i]}px;background:${C[i%8]}"></div>`;
  html+='<div class="the"></div>';
  for(let i=9;i<18;i++) html+=`<div class="bk" style="height:${H[i]}px;background:${C[i%8]}"></div>`;
  r.innerHTML=html;
</script>""" + TAIL)

# ═══ 2 · prop-1977-group-photo —— 【已移出本生成器】═════════════════
# 2026-08-12 分类更正: 这一件【不能用 CSS 做】。
#
# 我先按确定性道具做了一版, 渲出来是四个白色胶囊 —— 跟当初那根渲成鸡蛋的
# CSS「手指」是同一种失败: 【CSS 画得了文件, 画不了人的照片】。
#
# 铁律 7.6 管的是【文字/数字/图表/界面承担叙事】的镜头。这一件承担叙事的
# 不是文字, 是【四张脸】—— 那正是生成擅长而确定性工具做不到的东西。
#
# 它真正属于的类别是【不变量】(INVARIANT-*): 生成一次, 冻结, 记 sha256,
# 此后任何地方引用都必须是同一份文件。与 INVARIANT-artifact-voyager.png
# 同级。等预算解冻后, 用 scene-cleanroom-1977.png 出一张四人合影, 落为
# INVARIANT-1977-group-photo.png。
#
# 【硬约束不变】: 前后两次出现逐像素相同。变的是 Helen, 不是照片。

# ═══ 3 · prop-day-of-observance-notice ═════════════════════════════
# 三次: 第一部 §3 / earth §8 (同一份) / 结局二 §2 (停办)
def notice(body, sub):
    return base(1500,1000,"#1b1a17") + f"""
<style>
  .paper {{ left:210px; top:150px; width:1080px; height:700px; padding:74px 70px;
            transform:rotate(0.5deg);
            background:linear-gradient(180deg,#f6f3e8,#eae5d4);
            font-family:Georgia,"Times New Roman",serif }}
  .crest {{ width:66px; height:66px; margin:0 auto 30px; border:2px solid #2a2418;
            border-radius:50% }}
  h1 {{ margin:0; text-align:center; font-size:31px; letter-spacing:.09em;
        line-height:1.45; font-weight:normal }}
  .rule {{ border-bottom:1.5px solid #2a2418; margin:34px 90px }}
  .sub {{ text-align:center; font-size:19px; letter-spacing:.13em; color:#4c4436;
          line-height:1.7 }}
  .pin {{ position:absolute; left:50%; top:132px; transform:translateX(-50%);
          width:16px; height:16px; border-radius:50%;
          background:radial-gradient(circle at 34% 30%,#c9c4b6,#5c574a);
          box-shadow:0 4px 8px rgba(0,0,0,.6); z-index:4 }}
</style>
<div class="paper"><div class="crest"></div><h1>{body}</h1>
<div class="rule"></div><div class="sub">{sub}</div></div>
<div class="pin"></div>""" + TAIL
emit("prop-day-of-observance-notice", notice(
    "UNIVERSITY CLOSED<br>TUESDAY 14th<br>DAY OF OBSERVANCE",
    "ALL DEPARTMENTS · ALL CAMPUSES<br>NORMAL SERVICE RESUMES WEDNESDAY"))
emit("prop-day-of-observance-DISCONTINUED", notice(
    "THE DAY OF OBSERVANCE (14th)<br>IS DISCONTINUED FROM THIS YEAR",
    "THERE BEING NOTHING FURTHER TO OBSERVE"))

# ═══ 4 · prop-1931-contact-sheet ═══════════════════════════════════
# 第一部 §4 —— 【要能数出 84 个形状】。这就是这张道具存在的唯一理由。
emit("prop-1931-contact-sheet", base(1900,1300) + """
<style>
  .paper { left:170px; top:110px; width:1560px; height:1080px; padding:56px 60px;
           transform:rotate(-0.35deg) }
  .hdr { font:19px "Courier New",monospace; letter-spacing:.22em; color:#3b3226;
         border-bottom:1.5px solid #6f6350; padding-bottom:14px; margin-bottom:26px;
         display:flex; justify-content:space-between }
  .field { position:relative; width:100%; height:820px;
           background:linear-gradient(180deg,#8e8878 0%,#6f6a5d 58%,#565248 100%);
           box-shadow:inset 0 0 90px rgba(0,0,0,.55) }
  .row { position:absolute; left:0; right:0; display:flex; gap:0px }
  .sh  { width:80px; height:26px; border-radius:13px;
         background:linear-gradient(180deg,#d6d0c0,#a8a294);
         box-shadow:0 2px 4px rgba(0,0,0,.55) }
  .cap { margin-top:18px; font:17px "Courier New",monospace; letter-spacing:.14em;
         color:#443b2d; display:flex; justify-content:space-between }
</style>
<div class="paper">
  <div class="hdr"><span>KELLERMAN COLLIERY</span><span>14 MARCH 1931</span><span>PLATE 3 OF 3</span></div>
  <div class="field" id="f"></div>
  <div class="cap"><span>PITHEAD — RECOVERED</span><span id="n"></span></div>
</div>
<script>
  // 84 个。七行, 每行十二个。观众数得出来 —— 那是这张图的全部工作。
  const N=84, PER=12, f=document.getElementById('f');
  let h='';
  for(let r=0;r<N/PER;r++){
    h+=`<div class="row" style="top:${70+r*104}px; left:${58+(r%2?16:0)}px">`;
    for(let c=0;c<PER;c++) h+=`<div class="sh" style="margin-right:${c===PER-1?0:20}px"></div>`;
    h+='</div>';
  }
  f.innerHTML=h;
  document.getElementById('n').textContent = N + ' RECOVERED';
</script>""" + TAIL)

# ═══ 5 · prop-birth-ledger-1961 ════════════════════════════════════
# 序章 §4 / 第一部 —— 南方那行伪造的出生。一支笔, 十五秒, 不解释。
emit("prop-birth-ledger-1961", base(2000,1300) + """
<style>
  .paper { left:100px; top:90px; width:1800px; height:1120px; padding:0;
           transform:rotate(0.3deg);
           background:linear-gradient(180deg,#c9bda0 0%,#efe8d6 4%,#f1ead8 50%,#e6dfcc 92%,#bfb298) }
  .head { padding:44px 70px 0; font:20px "Courier New",monospace; letter-spacing:.20em;
          color:#3d3427; display:flex; justify-content:space-between }
  table { width:calc(100% - 140px); margin:30px 70px 0; border-collapse:collapse;
          font:20px "Courier New",monospace }
  th { font-weight:normal; text-align:left; font-size:15px; letter-spacing:.16em;
       color:#5a4f3e; border-bottom:2px solid #3d3427; padding:0 0 10px }
  td { padding:15px 0; border-bottom:1px solid #b3a68d; color:#241d13 }
  .ink { color:#1a2a52; font-family:Georgia,serif; font-style:italic; font-size:23px }
  .hi  { background:linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.045) 12%,
                    rgba(0,0,0,.045) 88%, rgba(0,0,0,0)) }
  .fan { position:absolute; inset:0; pointer-events:none; mix-blend-mode:multiply;
         background:conic-gradient(from 20deg at 62% -30%,
           rgba(0,0,0,.14) 0 6%, rgba(0,0,0,0) 6% 25%, rgba(0,0,0,.14) 25% 31%,
           rgba(0,0,0,0) 31% 50%, rgba(0,0,0,.14) 50% 56%, rgba(0,0,0,0) 56% 100%) }
</style>
<div class="paper">
  <div class="head"><span>REGISTER OF BIRTHS</span><span>VOL. XI</span><span>PAGE 214</span></div>
  <table>
    <tr><th style="width:9%">No.</th><th style="width:20%">DATE</th>
        <th style="width:34%">NAME</th><th style="width:14%">WEIGHT</th>
        <th style="width:23%">INFORMANT</th></tr>
    <tr><td>0411</td><td>3 JUNE 1961</td><td class="ink">Mary Ellen Cobb</td><td>7 lb 2 oz</td><td>Mother</td></tr>
    <tr><td>0412</td><td>3 JUNE 1961</td><td class="ink">Walter J. Ridley</td><td>6 lb 11 oz</td><td>Father</td></tr>
    <tr class="hi"><td>0413</td><td>4 JUNE 1961</td><td class="ink">x&Egrave;th</td><td>7 lb 0 oz</td><td class="ink">Self</td></tr>
    <tr><td>0414</td><td>4 JUNE 1961</td><td class="ink">Anne-Marie Fowles</td><td>5 lb 14 oz</td><td>Mother</td></tr>
    <tr><td>0415</td><td>6 JUNE 1961</td><td class="ink">Thomas R. Baird</td><td>8 lb 3 oz</td><td>Father</td></tr>
  </table>
</div>
<div class="fan"></div>""" + TAIL)

# ═══ 6 · prop-docket-book ══════════════════════════════════════════
# earth §1/§4 —— Norris 的签名。与餐巾纸上那个【同一条 SVG path】。
emit("prop-docket-book", base(1800,980) + """
<style>
  .paper { left:150px; top:110px; width:1500px; height:760px; padding:52px 64px;
           transform:rotate(-0.5deg) }
  .hdr { font:18px "Courier New",monospace; letter-spacing:.22em; color:#463c2d;
         border-bottom:2px solid #3a3125; padding-bottom:16px }
  table { width:100%; border-collapse:collapse; margin-top:26px;
          font:19px "Courier New",monospace }
  th { font-weight:normal; font-size:14px; letter-spacing:.16em; color:#5a4f3e;
       text-align:left; padding-bottom:12px; border-bottom:1px solid #8d7f6a }
  td { padding:20px 0 16px; border-bottom:1px dotted #a89a83; vertical-align:middle }
  .sigcell { height:76px }
  .stub { position:absolute; left:0; top:0; bottom:0; width:56px;
          background:linear-gradient(90deg,#a2957c,#cabda0 60%,#ded2b6);
          box-shadow:inset -8px 0 12px rgba(0,0,0,.22) }
  .holes{ position:absolute; left:20px; top:110px; bottom:110px; width:16px;
          display:flex; flex-direction:column; justify-content:space-between }
  .holes i { display:block; width:16px; height:16px; border-radius:50%;
             background:#0d0a06; box-shadow:inset 0 2px 3px rgba(255,255,255,.18) }
</style>
<div class="paper">
  <div class="stub"></div>
  <div class="holes"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div style="margin-left:76px">
    <div class="hdr">MOVEMENT DOCKET &nbsp;&middot;&nbsp; SUB-LEVEL 4 &nbsp;&middot;&nbsp; ANALOGUE PRESERVATION</div>
    <table>
      <tr><th style="width:14%">DATE</th><th style="width:12%">TIME</th>
          <th style="width:26%">ITEM</th><th style="width:20%">AUTH.</th>
          <th style="width:28%">SIGNATURE</th></tr>
      <tr><td>02 / 14</td><td>10.40</td><td>reels 118&ndash;122</td><td>written</td>
          <td class="sigcell">""" + sig("clara") + """</td></tr>
      <tr><td>02 / 21</td><td>09.05</td><td>glass 44</td><td>written</td>
          <td class="sigcell">""" + sig("clara", rot=-0.6) + """</td></tr>
      <tr><td>03 / 06</td><td>14.15</td><td><b>can 4471</b></td><td><b>verbal</b></td>
          <td class="sigcell">""" + sig("norris") + """</td></tr>
    </table>
  </div>
</div>""" + TAIL)

# ═══ 7 · prop-norris-diary ═════════════════════════════════════════
# earth §4 —— 他自己的笔迹, 证明一件他没经历过的事。【它不说去了哪儿。】
emit("prop-norris-diary", base(1700,1200) + """
<style>
  .paper { left:180px; top:120px; width:1340px; height:960px; padding:46px 54px;
           transform:rotate(0.4deg);
           background:linear-gradient(180deg,#f7f4ea,#ece7d8) }
  .wk { font:17px "Courier New",monospace; letter-spacing:.20em; color:#4c4234;
        border-bottom:1.5px solid #6f6350; padding-bottom:12px }
  .day { display:flex; gap:22px; padding:19px 0; border-bottom:1px solid #cdc3ac }
  .dn { width:170px; font:15px "Courier New",monospace; letter-spacing:.14em; color:#6a5f4c }
  .en { flex:1; font-family:Georgia,serif; font-style:italic; font-size:23px;
        color:#1a2a52; line-height:1.5 }
  .thu { background:rgba(0,0,0,.035) }
  .spine { position:absolute; left:0; top:0; bottom:0; width:34px;
           background:linear-gradient(90deg,#2a1c10,#4d3620 70%,#6a4d2e) }
</style>
<div class="paper">
  <div class="spine"></div>
  <div style="margin-left:52px">
    <div class="wk">WEEK 10 &nbsp;&middot;&nbsp; MARCH</div>
    <div class="day"><div class="dn">MONDAY 03</div><div class="en">dentist 8.20 &mdash; ring Ruth about Saturday</div></div>
    <div class="day"><div class="dn">TUESDAY 04</div><div class="en">acquisitions mtg. 11.00 (bring the '62 list)</div></div>
    <div class="day"><div class="dn">WEDNESDAY 05</div><div class="en">&mdash;</div></div>
    <div class="day thu"><div class="dn">THURSDAY 06</div>
      <div class="en">2.15 &mdash; S/L 4 &mdash; collect (1) can, 4471 &mdash; auth. verbal</div></div>
    <div class="day"><div class="dn">FRIDAY 07</div><div class="en">half day. car in at 4.</div></div>
  </div>
</div>""" + TAIL)

# ═══ 8 · prop-phone-photo（两版）═══════════════════════════════════
# earth §3 —— 同一张照片, 两个版本。第二版多了一行脚注。
# 【数字是他的】: 这是全片唯一一件【故意会变】的确定性道具, 而正因为它会变,
# 两个版本才必须逐像素可比对 —— 观众要能看出【只有那一行不同】。
def phone(footnote):
    return base(1200,1600,"#08070a") + """
<style>
  .body { position:absolute; left:150px; top:110px; width:900px; height:1380px;
          border-radius:62px; background:#15161a; box-shadow:0 30px 70px rgba(0,0,0,.9);
          padding:22px; box-sizing:border-box }
  .scr  { width:100%; height:100%; border-radius:44px; overflow:hidden;
          background:#0c0c0e; position:relative }
  .bar  { height:74px; display:flex; align-items:center; justify-content:space-between;
          padding:0 34px; font:19px -apple-system,"Helvetica Neue",Arial; color:#cfcfd4 }
  .shot { position:absolute; left:0; right:0; top:74px; bottom:96px;
          display:flex; align-items:center; justify-content:center; background:#000 }
  .doc  { width:78%; background:#efe9d8; color:#241d13; padding:40px 38px;
          box-sizing:border-box; transform:rotate(-1.1deg);
          font:17px "Courier New",monospace; box-shadow:0 12px 30px rgba(0,0,0,.7) }
  .t    { text-align:center; letter-spacing:.16em; font-size:15px; line-height:1.7 }
  .r    { border-bottom:1.5px solid #3a3125; margin:20px 0 16px }
  .sg   { display:flex; justify-content:space-between; padding:13px 0;
          border-bottom:1px dotted #a89a83; font-size:16px }
  .fn   { margin-top:26px; font-size:13px; font-style:italic; color:#4c4234;
          line-height:1.6; min-height:20px }
  .foot { position:absolute; left:0; right:0; bottom:0; height:96px;
          display:flex; align-items:center; justify-content:center; gap:64px;
          font:15px -apple-system,Arial; color:#8a8a92 }
</style>
<div class="body"><div class="scr">
  <div class="bar"><span>9:41</span><span>&#9679;&#9679;&#9679;&#9679;</span></div>
  <div class="shot"><div class="doc">
    <div class="t">MINUTES &mdash; SOUNDS OF EARTH COMMITTEE<br>JULY 1977<br>ATTENDANCE</div>
    <div class="r"></div>
    <div class="sg"><span>REESE, H.</span><span>present</span></div>
    <div class="sg"><span>BELL, M.</span><span>present</span></div>
    <div class="sg"><span>ACKERMAN, B.</span><span>present</span></div>
    <div class="fn">""" + footnote + """</div>
  </div></div>
  <div class="foot"><span>Share</span><span>Edit</span><span>Delete</span></div>
</div></div>""" + TAIL
emit("prop-phone-photo-A", phone(""))
emit("prop-phone-photo-B", phone("&hellip;and the names of those present were entered in summary."))

# ═══ 9 · prop-shorthand-notebook ═══════════════════════════════════
# earth §6 —— 【前后完全不变】。她能一字不差读出来, 而它对她不再意味着任何东西。
# §2.3 保住的是形状, 不是意义。
emit("prop-shorthand-notebook", base(1800,1250) + """
<style>
  .paper { left:190px; top:110px; width:1420px; height:1030px; padding:44px 56px;
           transform:rotate(-0.4deg);
           background:linear-gradient(180deg,#fdfbf4,#f0ecdf) }
  .rule { position:absolute; left:56px; right:56px; height:1px; background:#c9d6e0 }
  .marg { position:absolute; left:50%; top:0; bottom:0; width:1.5px; background:#d8a9a0 }
  .dt   { position:absolute; left:56px; top:26px; font:16px "Courier New",monospace;
          letter-spacing:.16em; color:#5a6b7a }
  .sh   { position:absolute; height:22px }
  .ring { position:absolute; left:0; top:0; bottom:0; width:44px;
          display:flex; flex-direction:column; justify-content:space-around; align-items:center }
  .ring i{ width:30px; height:14px; border:3px solid #8d8f94; border-radius:50%;
           border-left-color:transparent; background:transparent }
</style>
<div class="paper">
  <div class="ring"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="dt">SUN &nbsp;&middot;&nbsp; VANCE / SINCLAIR &nbsp;&middot;&nbsp; 50 min</div>
  <div class="marg"></div>
  <svg id="s" style="position:absolute;left:56px;top:78px;width:1300px;height:900px"></svg>
</div>
<script>
  // 速记 —— 定死的笔画序列, 不用随机数, 否则不可复现。
  // 它必须【看起来能读】: 有节奏、有重复、有分段, 而不是一团涂鸦。
  const S=document.getElementById('s'), W=[38,54,26,66,44,32,58,22,48,70,36,60,28,50];
  let y=0, out='', k=0;
  for(let line=0; line<26; line++){
    y = 30 + line*33;
    out += `<line x1="0" y1="${y+16}" x2="1300" y2="${y+16}" stroke="#c9d6e0" stroke-width="1"/>`;
    let x = (line%5===0) ? 0 : 30;
    while(x < (line%7===3 ? 700 : 1240)){
      const w=W[k++%W.length], h=(k%3===0)?18:(k%3===1)?11:22, up=(k%2===0)?1:-1;
      out += `<path d="M${x},${y+14} q${w/2},${up*h} ${w},0" fill="none" stroke="#20304a" stroke-width="2.2" stroke-linecap="round"/>`;
      if(k%4===0) out += `<circle cx="${x+w}" cy="${y+14}" r="2.4" fill="#20304a"/>`;
      x += w + 12;
    }
  }
  S.innerHTML = out;
</script>""" + TAIL)

# ═══ 10 · prop-daniel-vance-record ═════════════════════════════════
# earth §9 —— 完整、无聊、而且是错的。代价落到 Ethan 自己身上的那一格。
emit("prop-daniel-vance-record", base(1900,1200,"#06080a") + """
<style>
  .term { position:absolute; left:130px; top:100px; width:1640px; height:1000px;
          background:#0a1410; border:2px solid #16281f; box-sizing:border-box;
          padding:56px 64px; font:22px "Courier New",monospace; color:#8fd8a8;
          box-shadow:0 0 90px rgba(40,200,120,.10) inset }
  .sc { position:absolute; inset:0; pointer-events:none;
        background:repeating-linear-gradient(180deg, rgba(0,0,0,.30) 0 2px, rgba(0,0,0,0) 2px 4px) }
  .q  { color:#4f8f68; letter-spacing:.10em }
  .k  { color:#5f9f78; display:inline-block; width:290px }
  .v  { color:#c6f0d4 }
  .hr { border-bottom:1px solid #1e3a2b; margin:26px 0 22px }
  .cur{ display:inline-block; width:14px; height:24px; background:#8fd8a8;
        vertical-align:-4px; margin-left:8px }
</style>
<div class="term">
  <div class="q">&gt; SEARCH  NAME="VANCE, DANIEL R"  SCOPE=PUBLIC</div>
  <div class="hr"></div>
  <div><span class="k">FULL NAME</span><span class="v">VANCE, DANIEL ROBERT</span></div>
  <div><span class="k">BORN</span><span class="v">1938 &middot; KINGSLEY COUNTY</span></div>
  <div><span class="k">OCCUPATION</span><span class="v">INSURANCE ADJUSTER</span></div>
  <div><span class="k">EMPLOYER</span><span class="v">MERIDIAN MUTUAL, 1961&ndash;1991</span></div>
  <div><span class="k">DIED</span><span class="v">1994 &middot; KINGSLEY COUNTY</span></div>
  <div><span class="k">SURVIVED BY</span><span class="v">ONE SON</span></div>
  <div class="hr"></div>
  <div class="q">1 RECORD. NO AMENDMENTS ON FILE.<span class="cur"></span></div>
</div>
<div class="sc"></div>""" + TAIL)

# ═══ 11 · prop-order-of-ceremony ═══════════════════════════════════
# mars §13 (三次) / 第三部 §1 / §13 —— 【一份, 五次出现, 逐像素相同】。
# June 三次试图更正的那个页眉。第五次出现时它是对的了。
emit("prop-order-of-ceremony", base(1500,1900,"#161513") + """
<style>
  .paper { left:230px; top:130px; width:1040px; height:1640px; padding:96px 84px;
           transform:rotate(-0.3deg);
           background:linear-gradient(180deg,#fbf8ef,#efe9d8);
           font-family:Georgia,"Times New Roman",serif; text-align:center }
  .crest { width:74px; height:74px; margin:0 auto 40px; border:2.5px solid #2a2418;
           border-radius:50%; position:relative }
  .crest:after { content:""; position:absolute; inset:14px; border:1.5px solid #2a2418;
                 border-radius:50% }
  h1 { margin:0 0 8px; font-size:26px; letter-spacing:.30em; font-weight:normal }
  .hdr { font-size:22px; letter-spacing:.24em; margin:30px 0 6px }
  .rule { border-bottom:1.5px solid #2a2418; margin:38px 70px }
  ol { text-align:left; margin:0 40px; padding-left:34px; font-size:21px; line-height:2.5;
       color:#241d13 }
  ol li::marker { color:#6a5f4c }
  .four { font-weight:bold }
  .foot { position:absolute; left:84px; right:84px; bottom:96px; font-size:15px;
          letter-spacing:.16em; color:#5a4f3e; border-top:1px solid #a2947c; padding-top:18px }
</style>
<div class="paper">
  <div class="crest"></div>
  <h1>ORDER OF CEREMONY</h1>
  <div class="hdr">1 JANUARY &nbsp;&middot;&nbsp; YEAR ONE</div>
  <div class="rule"></div>
  <ol>
    <li>Assembly of the Chamber</li>
    <li>Report of the Committee on the Instrument</li>
    <li>Reading of the Seals</li>
    <li class="four">Resolution &mdash; Consolidation of the Office and the Style</li>
    <li>Response</li>
    <li>Dispersal</li>
  </ol>
  <div class="rule"></div>
  <div class="foot">FOUR HUNDRED AND NINE PLACES &nbsp;&middot;&nbsp; NO PRESS &nbsp;&middot;&nbsp; DOORS 09.20</div>
</div>""" + TAIL)

# ═══ 12 · prop-the-list（两版）═════════════════════════════════════
# 第三部 §2/§6/§11 —— 十九处同一份印刷名单, 只换磨损。
# 结局三里它有第二版: 【一个词不同】(Four -> Three), 而那一个词决定了地球
# 成为登记表上的第 40,922 行。两版必须逐像素可比对。
def thelist(last):
    return base(1500,1400,"#12110f") + """
<style>
  .paper { left:200px; top:110px; width:1100px; height:1180px; padding:70px 76px;
           transform:rotate(0.35deg);
           background:linear-gradient(180deg,#fdfbf3,#f1ece0);
           font:20px "Courier New",monospace; color:#241d13 }
  .t { text-align:center; letter-spacing:.22em; font-size:19px; line-height:1.9 }
  .s { text-align:center; font-size:15px; letter-spacing:.12em; color:#5a4f3e;
       margin-top:14px; line-height:1.8 }
  .rule { border-bottom:2px solid #3a3125; margin:30px 0 26px }
  li { padding:12px 0; border-bottom:1px dotted #b3a68d; line-height:1.55;
       list-style:none }
  ul { margin:0; padding:0 }
  .n { color:#6a5f4c; display:inline-block; width:44px }
  .foot { margin-top:34px; border-top:1px solid #a2947c; padding-top:18px;
          font-size:15px; color:#5a4f3e; line-height:1.8 }
  .fold { position:absolute; left:0; right:0; top:52%; height:3px;
          background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.16),rgba(0,0,0,0)) }
</style>
<div class="paper">
  <div class="t">FOR TRANSMISSION<br>THURSDAY &nbsp;09.40 &mdash; 11.10</div>
  <div class="s">READ IT PLAINLY. DO NOT ADD ANYTHING.<br>IF YOU LOSE YOUR PLACE, START THE LINE AGAIN.</div>
  <div class="rule"></div>
  <ul>
    <li><span class="n">1.</span>Kellerman colliery, 1931. Eighty-four men. The record says sixty-one.</li>
    <li><span class="n">2.</span>The valley at Ardenne. There was a town in it.</li>
    <li><span class="n">3.</span>Priya Shah wrote eleven hundred words on a Sunday.</li>
    <li><span class="n">4.</span>R. Norris. Thursday afternoon, the sixth of March.</li>
    <li><span class="n">5.</span>The fourteenth of every year.</li>
    <li><span class="n">6.</span>Eleven minutes, from a front door, on the eighth of March.</li>
    <li><span class="n">7.</span>Charlotte. Born in April.</li>
    <li><span class="n">8.</span>Daniel Vance. 1977. <b>""" + last + """ in the room.</b></li>
  </ul>
  <div class="foot">
    THEN READ THE COUNT FROM THE COUPON, DIGIT BY DIGIT.<br>
    SAY: &ldquo;MEASURED NOW.&rdquo; &nbsp;THEN STOP.
  </div>
  <div class="fold"></div>
</div>""" + TAIL
emit("prop-the-list", thelist("Four"))
emit("prop-the-list-CORRECTED", thelist("Three"))

# ═══ 13 · prop-duty-log ════════════════════════════════════════════
# 第三部 §7 / 结局四 §1 —— Clara 端端正正写下自己的名字, 让更正从她这里过。
# 签名与派工簿上那两个是【同一条 SVG path】。
emit("prop-duty-log", base(1800,900) + """
<style>
  .paper { left:150px; top:100px; width:1500px; height:700px; padding:48px 60px;
           transform:rotate(0.45deg);
           background:linear-gradient(180deg,#f4f1e6,#e7e1d0) }
  .hdr { font:18px "Courier New",monospace; letter-spacing:.22em; color:#463c2d;
         border-bottom:2px solid #3a3125; padding-bottom:16px;
         display:flex; justify-content:space-between }
  table { width:100%; border-collapse:collapse; margin-top:24px;
          font:19px "Courier New",monospace }
  th { font-weight:normal; font-size:14px; letter-spacing:.16em; color:#5a4f3e;
       text-align:left; padding-bottom:12px; border-bottom:1px solid #8d7f6a }
  td { padding:22px 0 18px; border-bottom:1px dotted #a89a83; vertical-align:middle }
  .last td { background:rgba(0,0,0,.030) }
  .role { font-size:15px; color:#4c4234; letter-spacing:.10em }
  .clip { position:absolute; left:50%; top:74px; transform:translateX(-50%);
          width:230px; height:34px; border-radius:6px;
          background:linear-gradient(180deg,#b9bcc2,#6e727a);
          box-shadow:0 6px 14px rgba(0,0,0,.6); z-index:5 }
</style>
<div class="paper">
  <div class="hdr"><span>SITE ATTENDANCE &mdash; TRANSMITTER BUILDING</span><span>SHEET 12</span></div>
  <table>
    <tr><th style="width:14%">DATE</th><th style="width:12%">IN</th>
        <th style="width:12%">OUT</th><th style="width:30%">NAME &amp; ROLE</th>
        <th style="width:32%">SIGNATURE</th></tr>
    <tr><td>THU</td><td>05.40</td><td>&mdash;</td>
        <td>J. MERRITT<div class="role">DUTY OFFICER</div></td><td>&nbsp;</td></tr>
    <tr class="last"><td>THU</td><td>09.15</td><td>&mdash;</td>
        <td>SINCLAIR, CLARA<div class="role">CUSTODIAN, ANALOGUE PRESERVATION</div></td>
        <td>""" + sig("clara", w=230, h=76, rot=-0.9) + """</td></tr>
  </table>
</div>
<div class="clip"></div>""" + TAIL)

for n,h in FILES.items():
    (OUT/(n+".html")).write_text(h, encoding="utf-8")
print("  写出 %d 件: %s" % (len(FILES), ", ".join(sorted(FILES))))
