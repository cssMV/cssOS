# CSSOS_WAVE_441 20260525 — FastAPI server for audio analysis service
# Runs on localhost:7891 (internal only, never exposed to public internet).
# Node.js backend calls POST /analyze to enrich subtitle tokens with
# beat / rhythm / volume / pitch data (Phase 2 of emotion subtitle pipeline).

import logging
import os
from typing import Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from analyze import analyze_audio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cssos.main")

app = FastAPI(
    title="cssOS Audio Analysis Service",
    description="Beat / volume / pitch extraction for emotion subtitle generation (WAVE_441)",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    audio_url: str
    timeline: list[dict[str, Any]]   # [{word, start, end}, ...]


class AnalyzeResponse(BaseModel):
    ok: bool
    tempo_bpm: float = 0.0
    tokens: list[dict[str, Any]] = []
    error: str = ""


@app.get("/health")
def health():
    return {"ok": True, "service": "cssos-audio-analysis", "wave": 441}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    if not req.audio_url.startswith("http"):
        raise HTTPException(status_code=400, detail="audio_url must be an http/https URL")
    if len(req.timeline) > 5000:
        raise HTTPException(status_code=400, detail="timeline too long (max 5000 tokens)")

    logger.info("Analyzing %s | %d tokens", req.audio_url[:80], len(req.timeline))
    result = analyze_audio(req.audio_url, req.timeline)

    if not result.get("ok"):
        return AnalyzeResponse(ok=False, error=result.get("error", "unknown"))

    return AnalyzeResponse(
        ok=True,
        tempo_bpm=result.get("tempo_bpm", 0.0),
        tokens=result.get("tokens", []),
    )


if __name__ == "__main__":
    port = int(os.environ.get("AUDIO_ANALYSIS_PORT", "7891"))
    logger.info("Starting cssOS audio analysis service on 127.0.0.1:%d", port)
    uvicorn.run(
        "main:app",
        host="127.0.0.1",     # localhost only — never expose to internet
        port=port,
        workers=2,            # 2 workers: one can analyze while another downloads
        log_level="info",
    )
