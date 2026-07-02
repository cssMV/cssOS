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
import mediapipe as mp
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
_mp_fd = mp.solutions.face_detection


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


@app.post("/detect")
def detect(req: DetectReq):
    img = _load_image(req)
    if img is None:
        return {"found": False, "error": "no_image"}
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # model_selection=1 = 全图范围(封面可能远景); min conf 0.5。
    with _mp_fd.FaceDetection(model_selection=1, min_detection_confidence=0.5) as fd:
        res = fd.process(rgb)
    if not res.detections:
        return {"found": False, "faces": 0}
    # 取面积最大的人脸(主体)。
    best = None
    best_area = -1.0
    for d in res.detections:
        bb = d.location_data.relative_bounding_box
        area = max(0.0, bb.width) * max(0.0, bb.height)
        if area > best_area:
            best_area = area
            best = bb
    cx = best.xmin + best.width / 2.0
    cy = best.ymin + best.height / 2.0
    # 焦点上移 12% 框高给头顶留空,再 clamp。
    fy = cy - best.height * 0.12
    fx = min(max(cx, 0.0), 1.0)
    fy = min(max(fy, 0.08), 0.85)
    return {
        "found": True,
        "faces": len(res.detections),
        "focal_x": round(fx, 4),
        "focal_y": round(fy, 4),
    }
