#!/usr/bin/env python3
import json
import subprocess
import sys
import time
from pathlib import Path


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-bridge-watch] {message}", file=sys.stderr)
    return code


def main() -> int:
    if len(sys.argv) < 2:
        return fail("usage: cssmv-diffsinger-bridge-watch.py <bridge_output_dir> [interval_sec]", 2)

    output_dir = Path(sys.argv[1]).resolve()
    interval_sec = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
    status_script = Path(__file__).resolve().parent / "cssmv-diffsinger-bridge-status.py"
    if not status_script.exists():
        return fail(f"status script not found: {status_script}", 3)

    try:
        while True:
            result = subprocess.run(
                [sys.executable, str(status_script), str(output_dir)],
                check=False,
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                sys.stderr.write(result.stderr)
                return result.returncode
            payload = json.loads(result.stdout)
            print(
                json.dumps(
                    {
                        "completedChunks": payload.get("completedChunks"),
                        "completedFrames": payload.get("completedFrames"),
                        "completionRatio": payload.get("completionRatio"),
                        "framesPerSec": payload.get("framesPerSec"),
                        "etaMin": payload.get("etaMin"),
                        "partialMelShape": payload.get("partialMelShape")
                    }
                ),
                flush=True
            )
            time.sleep(interval_sec)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
