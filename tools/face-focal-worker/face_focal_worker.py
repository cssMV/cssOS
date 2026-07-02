#!/usr/bin/env python3
# CSSOS_WAVE_1524 — Layer 2「封面自动识别人脸焦点」检测 worker。
#
# 定位: 跑在 atelier ML 机器(和 TripoSR :7897 / Blender :7896 同机),暴露一个 HTTP 端点。
# 输入一张封面图(url 或 base64),检测【最大的人脸】,返回焦点坐标 focal_x/focal_y(0~1 比例,
# = 脸中心稍偏上,给发际线留头顶空间)。前端/原生按此设 object-position/对齐 → 永不削头。
#
# 依赖(atelier 上装一次): pip install fastapi uvicorn mediapipe opencv-python-headless requests numpy
# 起服务: uvicorn face_focal_worker:app --host 0.0.0.0 --port 7898
#
# 用法:
#   POST /detect  {"image_url": "https://cdn.cssstudio.app/works/<id>/cover.jpg"}
#   -> {"found": true, "focal_x": 0.52, "focal_y": 0.28, "faces": 1}
#   found=false → 无脸(风景/器物封面),前端用默认偏上兜底。
#
# 设计: focal_y 取脸框中心再上移 12% 框高(留头顶),clamp 到 [0.08, 0.85]。多脸取面积最大那张。

import io
import numpy as np
import requests
import cv2
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# CSSOS 20260701 — 用 OpenCV Haar 级联(opencv 自带, 无需下载模型 / 无 mediapipe 版本坑)。
# 正脸 + 侧脸两套级联都跑, 合并取面积最大的人脸当主体焦点。够用: 只需脸中心大致位置。
_cascade_dir = cv2.data.haarcascades
_fd_front = cv2.CascadeClassifier(_cascade_dir + "haarcascade_frontalface_default.xml")
_fd_profile = cv2.CascadeClassifier(_cascade_dir + "haarcascade_profileface.xml")


class DetectReq(BaseModel):
    image_url: str | None = None
    image_b64: str | None = None


def _load_image(req: DetectReq):
    if req.image_url:
        r = requests.get(req.image_url, timeout=20, headers={"User-Agent": "cssos-face-focal/1.0"})
        r.raise_for_status()
        buf = np.frombuffer(r.content, np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if req.image_b64:
        import base64
        buf = np.frombuffer(base64.b64decode(req.image_b64), np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return None


@app.get("/health")
def health():
    return {"ok": True, "service": "face-focal", "port": 7898}


def _detect_faces(gray):
    # 两套级联合并; 也跑水平翻转的 profile 抓另一侧脸。
    boxes = []
    for casc in (_fd_front, _fd_profile):
        found = casc.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        boxes.extend([tuple(int(v) for v in b) for b in found])
    flipped = cv2.flip(gray, 1)
    fw = gray.shape[1]
    for (x, y, w, h) in _fd_profile.detectMultiScale(flipped, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40)):
        boxes.append((fw - int(x) - int(w), int(y), int(w), int(h)))  # 翻回原图坐标
    return boxes


@app.post("/detect")
def detect(req: DetectReq):
    img = _load_image(req)
    if img is None:
        return {"found": False, "error": "no_image"}
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    boxes = _detect_faces(gray)
    if not boxes:
        return {"found": False, "faces": 0}
    # 取面积最大的人脸(主体)。box = (x, y, bw, bh) 像素。
    bx, by, bw, bh = max(boxes, key=lambda b: b[2] * b[3])
    cx = (bx + bw / 2.0) / w
    cy = (by + bh / 2.0) / h
    # 焦点上移 12% 框高给头顶留空,再 clamp。
    fy = cy - (bh / h) * 0.12
    fx = min(max(cx, 0.0), 1.0)
    fy = min(max(fy, 0.08), 0.85)
    return {
        "found": True,
        "faces": len(boxes),
        "focal_x": round(fx, 4),
        "focal_y": round(fy, 4),
    }
