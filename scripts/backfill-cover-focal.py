#!/usr/bin/env python3
"""CSSOS_WAVE_1916 20260824 — 人脸焦点回填(Jing 指示 ②)

病因: 客户端一直在【实时猜脸】。Safari/iOS 没有 FaceDetector API, 于是退回
  "亮度网格: 最亮的连通块就是脸" —— 桃花是粉白色, 比阴影里的人脸亮, 所以每次都裁桃花。
  而 user_works 里【早就有 cover_focal_x / cover_focal_y 两列】, 一直是空的。

修法: 生成时(以及这次回填)在服务端做一次真检测, 把归一化焦点存进库。
  所有平台读同一个值 —— 网页/App/TV/Vision 不再各自猜, 也不再依赖某个浏览器有没有 API。

检测顺序(先官方, 后本地兜底):
  ① 平台已有的 face-focal 服务(10.128.0.5:7898/detect)—— 数字演员一直用它,
     实测能同时认出 2-3 张脸, 模型比本地 Haar 强。【不另起一套】: 哨兵语义
     (-1,-1 = 检测过但没脸)也是它定的, 造第二套只会让下一个人分不清哪个是真的。
  ② 官方 found:false 时, 本地 OpenCV Haar 正脸+侧脸补一次 —— 实测它能救回
     官方漏掉的侧脸(国画人物常是侧身)。两者互有胜负, 所以是补充不是替代。
  都检不到就写【-1,-1 哨兵】, 与 digital_actors 同一约定: 区分"没检测过(NULL)"
  和"检测过但没脸(-1)"。前端见 -1 按居中处理 —— 宁可不标, 绝不错标(同 W1880)。

焦点取【面积最大的那张脸】的中心: 多人画面里主角通常占最大面积。
"""
import sys, os, urllib.request, numpy as np, cv2, psycopg2

DB = os.environ.get("DATABASE_URL")
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 100000

def load(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cssos-focal/1.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)

FOCAL_URL = os.environ.get("FACE_FOCAL_URL", "http://10.128.0.5:7898")

def detect_official(url):
    """问平台已有的 face-focal 服务。返回 (fx, fy) 或 None。"""
    import json
    try:
        req = urllib.request.Request(
            FOCAL_URL + "/detect",
            data=json.dumps({"image_url": url}).encode(),
            headers={"content-type": "application/json"})
        j = json.loads(urllib.request.urlopen(req, timeout=45).read())
        if j.get("found"):
            return float(j["focal_x"]), float(j["focal_y"])
    except Exception:
        pass
    return None

def detect(img):
    faces = []
    try:
        import face_recognition
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        for (t, r, b, l) in face_recognition.face_locations(rgb, model="hog"):
            faces.append((l, t, r - l, b - t))
    except Exception:
        pass
    if not faces:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        for f in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"):
            try:
                c = cv2.CascadeClassifier(cv2.data.haarcascades + f)
                for (x, y, w, h) in c.detectMultiScale(g, 1.1, 5, minSize=(40, 40)):
                    faces.append((int(x), int(y), int(w), int(h)))
            except Exception:
                pass
    return faces

conn = psycopg2.connect(DB); conn.autocommit = True
cur = conn.cursor()
cur.execute("""SELECT id::text, cover_image FROM user_works
                WHERE status <> 'deleted' AND cover_image LIKE 'http%%'
                  AND (cover_focal_x IS NULL OR cover_focal_y IS NULL)
                ORDER BY status='published' DESC, created_at DESC LIMIT %s""", (LIMIT,))
rows = cur.fetchall()
print(f"待检测 {len(rows)} 首", flush=True)
ok = none = err = 0
for i, (wid, url) in enumerate(rows, 1):
    try:
        # ① 先问官方服务(更强, 且与数字演员同源)
        hit = detect_official(url)
        # ② 官方没找到 → 本地 Haar 侧脸兜底
        if hit is None:
            img = load(url)
            if img is None: err += 1; continue
            H, W = img.shape[:2]
            faces = detect(img)
            if faces:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                hit = (min(1.0, max(0.0, (x + w / 2) / W)),
                       min(1.0, max(0.0, (y + h / 2) / H)))
        if hit:
            cur.execute("UPDATE user_works SET cover_focal_x=%s, cover_focal_y=%s WHERE id=%s::uuid",
                        (round(hit[0], 4), round(hit[1], 4), wid))
            ok += 1
        else:
            # 写 -1 哨兵: 与 digital_actors 同一约定 —— "检测过, 没有脸"
            cur.execute("UPDATE user_works SET cover_focal_x=-1, cover_focal_y=-1 WHERE id=%s::uuid", (wid,))
            none += 1
    except Exception:
        err += 1
    if i % 100 == 0:
        print(f"  进度 {i}/{len(rows)} · 有脸 {ok} · 无脸 {none} · 出错 {err}", flush=True)
print(f"═══ 完成 · 写入焦点 {ok} · 无脸留空 {none} · 出错 {err}", flush=True)
