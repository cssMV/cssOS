#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile
import yaml


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-vocode-mel] {message}", file=sys.stderr)
    return code


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def unwrap_request(payload):
    if isinstance(payload, dict) and isinstance(payload.get("request"), dict):
      return payload["request"]
    return payload


def resample_f0(values: list[float], frames: int) -> np.ndarray:
    if frames <= 0:
        return np.zeros((1, 0), dtype=np.float32)
    if not values:
        return np.full((1, frames), 220.0, dtype=np.float32)
    raw = np.array(values, dtype=np.float32)
    if raw.size == frames:
        return raw[None, :]
    if raw.size == 1:
        return np.full((1, frames), float(raw[0]), dtype=np.float32)
    x_old = np.linspace(0.0, 1.0, num=raw.size, dtype=np.float32)
    x_new = np.linspace(0.0, 1.0, num=frames, dtype=np.float32)
    return np.interp(x_new, x_old, raw).astype(np.float32)[None, :]


def main() -> int:
    if len(sys.argv) < 4:
        return fail("usage: cssmv-diffsinger-vocode-mel.py <mel.npy> <submit.request.json> <output.wav>", 2)

    mel_path = Path(sys.argv[1]).resolve()
    submit_request_path = Path(sys.argv[2]).resolve()
    output_wav_path = Path(sys.argv[3]).resolve()

    if not mel_path.exists():
        return fail(f"mel.npy not found: {mel_path}", 3)
    if not submit_request_path.exists():
        return fail(f"submit request not found: {submit_request_path}", 4)

    mini_root = Path(
        os.environ.get("CSSMV_DIFFSINGER_MINI_ROOT", "/srv/cssmv-hosts/DiffSingerMiniEngine")
    ).resolve()
    config_path = Path(
        os.environ.get("CSSMV_DIFFSINGER_CONFIG", str(mini_root / "configs" / "default.yaml"))
    ).resolve()
    python_model_root = mini_root
    if not config_path.exists():
        return fail(f"MiniEngine config not found: {config_path}", 5)

    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    vocoder_cfg = config.get("vocoder") or {}
    vocoder_rel = str(vocoder_cfg.get("filename") or "").strip()
    if not vocoder_rel:
        return fail("vocoder filename missing in config", 6)
    vocoder_path = (python_model_root / vocoder_rel).resolve()
    if not vocoder_path.exists():
        return fail(f"vocoder model not found: {vocoder_path}", 7)

    mel = np.load(mel_path).astype(np.float32)
    if mel.ndim != 3:
        return fail(f"expected mel.npy rank 3, got shape {list(mel.shape)}", 8)

    request_payload = unwrap_request(load_json(submit_request_path))
    f0_values = (((request_payload or {}).get("f0") or {}).get("values") or [])
    f0 = resample_f0(f0_values, int(mel.shape[1]))

    force_on_cpu = bool(vocoder_cfg.get("force_on_cpu", True))
    providers = ["CPUExecutionProvider"] if force_on_cpu else ort.get_available_providers()
    session = ort.InferenceSession(str(vocoder_path), providers=providers)
    waveform = session.run(["waveform"], {"mel": mel, "f0": f0})[0]

    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = int(vocoder_cfg.get("sample_rate") or 44100)
    soundfile.write(str(output_wav_path), waveform[0], sample_rate)

    print(
        json.dumps(
            {
                "mel": str(mel_path),
                "submitRequest": str(submit_request_path),
                "vocoder": str(vocoder_path),
                "outputWav": str(output_wav_path),
                "melShape": list(mel.shape),
                "f0Shape": list(f0.shape),
                "sampleRate": sample_rate,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
