#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-bridge-status] {message}", file=sys.stderr)
    return code


def main() -> int:
    if len(sys.argv) < 2:
        return fail("usage: cssmv-diffsinger-bridge-status.py <bridge_output_dir>", 2)

    output_dir = Path(sys.argv[1]).resolve()
    progress_path = output_dir / "legacy-bridge.progress.json"
    if not progress_path.exists():
        return fail(f"progress file not found: {progress_path}", 3)

    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    eta_sec = float(progress.get("etaSec") or 0)
    payload = {
        "outputDir": str(output_dir),
        "completedChunks": int(progress.get("completedChunks") or 0),
        "completedFrames": int(progress.get("completedFrames") or 0),
        "completionRatio": float(progress.get("completionRatio") or 0),
        "partialMelShape": progress.get("partialMelShape") or [1, 0, 128],
        "framesPerSec": float(progress.get("framesPerSec") or 0),
        "etaSec": eta_sec,
        "etaMin": (eta_sec / 60.0) if eta_sec > 0 else 0,
        "lastChunk": progress.get("lastChunk") or None
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
