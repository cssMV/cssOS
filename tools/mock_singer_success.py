#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        raise SystemExit(2)
    output_manifest = Path(sys.argv[1])
    artifact_dir = Path(sys.argv[2])
    payload = json.loads(output_manifest.read_text(encoding="utf-8"))
    for artifact in payload.get("outputArtifacts", []):
        target = artifact_dir / artifact
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"RIFF0000WAVE")

if __name__ == "__main__":
    main()
