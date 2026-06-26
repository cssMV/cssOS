from PIL import Image, ImageDraw, ImageFont, ImageFilter
D="/private/tmp/claude-501/-Users-jing-cssOS--claude-worktrees-modest-elbakyan-9774a9/3844656a-5fe3-466d-9289-2ca3775439fd/scratchpad"
BEZEL="/Users/jing/Downloads/cssWatch.png"
OUT="/Users/jing/cssOS/watchos/CSSWatch/appstore-screenshots"
SX,SY,SW,SH = 189,401,632,748          # screen rect in bezel (1024x1536)
RAD=72
SF="/System/Library/Fonts/SFNS.ttf"
SFR="/System/Library/Fonts/SFNSRounded.ttf"
def font(sz,rounded=True):
    try: return ImageFont.truetype(SFR if rounded else SF, sz)
    except: return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", sz)

def rounded_mask(w,h,r):
    m=Image.new("L",(w,h),0); d=ImageDraw.Draw(m)
    d.rounded_rectangle([0,0,w-1,h-1],radius=r,fill=255); return m

def make(shot, headline, sub, outname):
    bez=Image.open(BEZEL).convert("RGB")
    s=Image.open(f"{D}/{shot}").convert("RGB").resize((SW,SH),Image.LANCZOS)
    bez.paste(s,(SX,SY),rounded_mask(SW,SH,RAD))
    d=ImageDraw.Draw(bez)
    # top wordmark
    wm=font(46); t="cssWatch"
    w=d.textlength(t,font=wm); d.text(((1024-w)/2,150),t,font=wm,fill=(245,245,247))
    tl=font(30); st="Emotion-subtitle music"
    w=d.textlength(st,font=tl); d.text(((1024-w)/2,212),st,font=tl,fill=(165,165,172))
    # bottom headline (centered, may wrap to 2 lines)
    hf=font(60)
    words=headline.split(); lines=[]; cur=""
    for wd in words:
        test=(cur+" "+wd).strip()
        if d.textlength(test,font=hf)>900: lines.append(cur); cur=wd
        else: cur=test
    lines.append(cur)
    y=1330
    for ln in lines:
        w=d.textlength(ln,font=hf); d.text(((1024-w)/2,y),ln,font=hf,fill=(250,250,252)); y+=70
    if sub:
        sf2=font(30); w=d.textlength(sub,font=sf2); d.text(((1024-w)/2,y+6),sub,font=sf2,fill=(175,175,184))
    bez.save(f"{OUT}/{outname}")
    print("wrote",outname,bez.size)

make("m8.png","Lyrics burst, word by word","then the whole line fades together","mkt-01-emotion-subtitle.png")
make("shot4.png","Your wrist, your cinema","A tiny music video, always with you","mkt-02-cover.png")
make("m20.png","Music blooms to the rim","Emoji drift in with the melody","mkt-03-instrumental.png")
