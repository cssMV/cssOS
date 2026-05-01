#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import numpy as np


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-rebuild-partial-mel] {message}", file=sys.stderr)
    return code


def main() -> int:
    if len(sys.argv) < 2:
        return fail("usage: cssmv-diffsinger-rebuild-partial-mel.py <bridge_output_dir>", 2)

    output_dir = Path(sys.argv[1]).resolve()
    chunk_dir = output_dir / "chunks"
    if not chunk_dir.exists():
        return fail(f"chunk dir not found: {chunk_dir}", 3)

    trimmed_paths = sorted(chunk_dir.glob("*.trimmed.npy"))
    if not trimmed_paths:
        return fail(f"no trimmed chunk files found in: {chunk_dir}", 4)

    chunks = [np.load(path) for path in trimmed_paths]
    partial = np.concatenate(chunks, axis=1) if chunks else np.zeros((1, 0, 128), dtype=np.float32)
    partial_path = output_dir / "mel.partial.npy"
    np.save(partial_path, partial)

    payload = {
      "chunkCount": len(trimmed_paths),
      "partialPath": str(partial_path),
      "partialShape": list(partial.shape),
      "lastChunk": trimmed_paths[-1].name
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
