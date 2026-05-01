#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

def write_dummy(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".json":
      path.write_text(json.dumps({"generated_by": "mock_success"}, indent=2), encoding="utf-8")
    else:
      path.write_bytes(b"RIFF0000WAVE")

def main():
    if len(sys.argv) < 3:
        raise SystemExit(2)
    output_manifest = Path(sys.argv[1])
    artifact_dir = Path(sys.argv[2])
    payload = json.loads(output_manifest.read_text(encoding="utf-8"))
    for artifact in payload.get("outputArtifacts", []):
        write_dummy(artifact_dir / artifact)

if __name__ == "__main__":
    main()
