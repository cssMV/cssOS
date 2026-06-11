# CSSOS_WAVE_650 20260605 — FastAPI server for whisperX forced-alignment service.
# Internal only (localhost:7892); Node backend calls POST /align via WHISPERX_ALIGN_URL.
# Contract matches src/index.ts alignViaWhisperXService:
#   POST /align  {audio_url, language?, ref_text?}  →  {words:[{word,start,end}], mode, language}

import logging
import os
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from align import align_audio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cssos.whisperx.main")

app = FastAPI(title="CSSOS whisperX align", version="1.0")


class AlignReq(BaseModel):
    audio_url: str
    language: Optional[str] = None
    ref_text: Optional[str] = None  # 已知歌词 → 强制对齐(推荐, 歌声更稳)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "whisperx-align"}


@app.post("/align")
def align(req: AlignReq) -> dict[str, Any]:
    if not req.audio_url:
        return {"words": [], "error": "missing_audio_url"}
    res = align_audio(req.audio_url, language=req.language, ref_text=req.ref_text)
    n = len(res.get("words") or [])
    logger.info("align done: %s words mode=%s lang=%s", n, res.get("mode"), res.get("language"))
    return res


if __name__ == "__main__":
    port = int(os.environ.get("WHISPERX_PORT", "7892"))
    uvicorn.run(app, host="127.0.0.1", port=port)
