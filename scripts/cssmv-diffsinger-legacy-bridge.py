#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-legacy-bridge] {message}", file=sys.stderr)
    return code


def run_checked(command, env):
    subprocess.run(command, check=True, env=env)


def expand_template(template: str, mapping: dict[str, str]) -> str:
    expanded = str(template or "")
    for key, value in mapping.items():
        expanded = expanded.replace(f"{{{{{key}}}}}", str(value))
    return expanded


def get_chunk_size() -> int:
    raw = str(os.environ.get("CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES", "")).strip()
    if not raw:
        return 0
    try:
        value = int(raw)
    except ValueError:
        return 0
    return max(0, value)


def chunk_overlap_size() -> int:
    raw = str(os.environ.get("CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP", "")).strip()
    if not raw:
        return 0
    try:
        value = int(raw)
    except ValueError:
        return 0
    return max(0, value)


def main() -> int:
    if len(sys.argv) < 3:
        return fail("usage: cssmv-diffsinger-legacy-bridge.py <submit.request.json> <output_dir>", 2)

    submit_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    if not submit_path.exists():
      return fail(f"submit request not found: {submit_path}", 3)

    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    condition_script = script_dir / "cssmv-diffsinger-generate-condition.py"
    if not condition_script.exists():
        return fail(f"condition generator missing: {condition_script}", 4)

    bridge_python = os.environ.get("CSSMV_DIFFSINGER_BRIDGE_PYTHON") or sys.executable
    bridge_onnx = os.environ.get("CSSMV_DIFFSINGER_LEGACY_ONNX", "").strip()
    if not bridge_onnx:
        return fail("CSSMV_DIFFSINGER_LEGACY_ONNX is required", 5)

    env = os.environ.copy()
    output_dir.mkdir(parents=True, exist_ok=True)

    run_checked([bridge_python, str(condition_script), str(submit_path), str(output_dir)], env)

    condition_path = output_dir / "condition.npy"
    if not condition_path.exists():
        return fail(f"condition output missing: {condition_path}", 6)

    inference_code = """
import json
from pathlib import Path
import numpy as np
import onnxruntime as ort

output_dir = Path(__import__("os").environ["CSSMV_DIFFSINGER_BRIDGE_OUTPUT_DIR"]).resolve()
condition_path = output_dir / "condition.npy"
onnx_path = Path(__import__("os").environ["CSSMV_DIFFSINGER_LEGACY_ONNX"]).resolve()
speedup = np.array(int(__import__("os").environ.get("CSSMV_DIFFSINGER_SPEEDUP", "10")), dtype=np.int64)
chunk_frames = int(__import__("os").environ.get("CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES", "0") or "0")
chunk_overlap = int(__import__("os").environ.get("CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP", "0") or "0")
condition = np.load(condition_path).astype(np.float32)
session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
chunks = []
chunk_summaries = []
chunk_dir = output_dir / "chunks"
chunk_dir.mkdir(parents=True, exist_ok=True)
progress_path = output_dir / "legacy-bridge.progress.json"
partial_mel_path = output_dir / "mel.partial.npy"
total_frames = int(condition.shape[1]) if condition.ndim >= 2 else 0
started_at = __import__("time").time()

def write_progress():
    partial_shape = list(np.concatenate(chunks, axis=1).shape) if chunks else [1, 0, 128]
    completed_frames = int(partial_shape[1]) if len(partial_shape) > 1 else 0
    elapsed_sec = max(0.0, __import__("time").time() - started_at)
    remaining_frames = max(0, total_frames - completed_frames)
    frames_per_sec = (completed_frames / elapsed_sec) if elapsed_sec > 0 and completed_frames > 0 else 0
    eta_sec = (remaining_frames / frames_per_sec) if frames_per_sec > 0 and remaining_frames > 0 else 0
    payload = {
        "submitRequest": str(Path(__import__("os").environ["CSSMV_DIFFSINGER_SUBMIT_REQUEST"]).resolve()),
        "condition": str(condition_path),
        "onnx": str(onnx_path),
        "chunkFrames": chunk_frames,
        "chunkOverlap": chunk_overlap,
        "completedChunks": len(chunk_summaries),
        "completedFrames": completed_frames,
        "completionRatio": (completed_frames / total_frames) if total_frames > 0 else 0,
        "elapsedSec": elapsed_sec,
        "framesPerSec": frames_per_sec,
        "remainingFrames": remaining_frames,
        "etaSec": eta_sec,
        "lastChunk": chunk_summaries[-1] if chunk_summaries else None,
        "chunkDir": str(chunk_dir),
        "partialMel": str(partial_mel_path),
        "partialMelShape": partial_shape,
        "totalFrames": total_frames
    }
    progress_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

if chunk_frames > 0 and total_frames > chunk_frames:
    step = max(1, chunk_frames - chunk_overlap)
    chunk_index = 0
    for start in range(0, total_frames, step):
        end = min(total_frames, start + chunk_frames)
        mel_chunk = session.run(["mel"], {"condition": condition[:, start:end, :], "speedup": speedup})[0]
        trim_left = 0 if start == 0 else min(chunk_overlap // 2, mel_chunk.shape[1])
        trim_right = 0 if end >= total_frames else min(chunk_overlap - trim_left, mel_chunk.shape[1] - trim_left)
        trimmed_end = mel_chunk.shape[1] - trim_right if trim_right > 0 else mel_chunk.shape[1]
        trimmed_chunk = mel_chunk[:, trim_left:trimmed_end, :]
        chunk_path = chunk_dir / f"mel.chunk.{chunk_index:04d}.{start:06d}-{end:06d}.npy"
        trimmed_path = chunk_dir / f"mel.chunk.{chunk_index:04d}.{start:06d}-{end:06d}.trimmed.npy"
        np.save(chunk_path, mel_chunk)
        np.save(trimmed_path, trimmed_chunk)
        chunks.append(trimmed_chunk)
        np.save(partial_mel_path, np.concatenate(chunks, axis=1))
        chunk_summaries.append({
            "chunkIndex": chunk_index,
            "startFrame": start,
            "endFrame": end,
            "inputFrames": int(end - start),
            "outputShape": list(mel_chunk.shape),
            "trimLeft": int(trim_left),
            "trimRight": int(trim_right),
            "trimmedShape": list(trimmed_chunk.shape),
            "chunkPath": str(chunk_path),
            "trimmedPath": str(trimmed_path)
        })
        write_progress()
        chunk_index += 1
        if end >= total_frames:
            break
    mel = np.concatenate(chunks, axis=1) if chunks else np.zeros((1, 0, 128), dtype=np.float32)
else:
    mel = session.run(["mel"], {"condition": condition, "speedup": speedup})[0]
    chunk_path = chunk_dir / "mel.chunk.0000.full.npy"
    np.save(chunk_path, mel)
    chunk_summaries.append({
        "chunkIndex": 0,
        "startFrame": 0,
        "endFrame": total_frames,
        "inputFrames": total_frames,
        "outputShape": list(mel.shape),
        "trimLeft": 0,
        "trimRight": 0,
        "trimmedShape": list(mel.shape),
        "chunkPath": str(chunk_path),
        "trimmedPath": str(chunk_path)
    })
    np.save(partial_mel_path, mel)
    write_progress()
mel_path = output_dir / "mel.npy"
np.save(mel_path, mel)
summary_path = output_dir / "legacy-bridge.summary.json"
summary_path.write_text(json.dumps({
    "submitRequest": str(Path(__import__("os").environ["CSSMV_DIFFSINGER_SUBMIT_REQUEST"]).resolve()),
    "condition": str(condition_path),
    "onnx": str(onnx_path),
    "mel": str(mel_path),
    "conditionShape": list(condition.shape),
    "melShape": list(mel.shape),
    "chunkFrames": chunk_frames,
    "chunkOverlap": chunk_overlap,
    "chunkCount": len(chunk_summaries) if chunk_summaries else 1,
    "chunkSummaries": chunk_summaries,
    "chunkDir": str(chunk_dir),
    "partialMel": str(partial_mel_path),
    "melMin": float(mel.min()),
    "melMax": float(mel.max())
}, indent=2), encoding="utf-8")
print(summary_path.read_text(encoding="utf-8"))
"""

    env["CSSMV_DIFFSINGER_BRIDGE_OUTPUT_DIR"] = str(output_dir)
    env["CSSMV_DIFFSINGER_SUBMIT_REQUEST"] = str(submit_path)
    env["CSSMV_DIFFSINGER_LEGACY_CHUNK_FRAMES"] = str(get_chunk_size())
    env["CSSMV_DIFFSINGER_LEGACY_CHUNK_OVERLAP"] = str(chunk_overlap_size())
    run_checked([bridge_python, "-c", inference_code], env)

    mel_path = output_dir / "mel.npy"
    summary_path = output_dir / "legacy-bridge.summary.json"
    if not mel_path.exists():
        return fail(f"mel output missing: {mel_path}", 7)
    if not summary_path.exists():
        return fail(f"legacy bridge summary missing: {summary_path}", 8)

    wav_relative = str(os.environ.get("CSSMV_DIFFSINGER_LEGACY_WAV_PATH", "vocal.lead.wav") or "vocal.lead.wav").strip()
    wav_path = (output_dir / wav_relative).resolve() if not os.path.isabs(wav_relative) else Path(wav_relative).resolve()
    wav_path.parent.mkdir(parents=True, exist_ok=True)

    vocoder_template = str(os.environ.get("CSSMV_DIFFSINGER_LEGACY_VOCODER_CMD", "")).strip()
    vocoder_command = ""
    vocoder_status = "not_configured"
    if vocoder_template:
        vocoder_mapping = {
            "MEL_NPY": str(mel_path),
            "OUTPUT_WAV": str(wav_path),
            "SUMMARY_JSON": str(summary_path),
            "SUBMIT_REQUEST": str(submit_path),
            "OUTPUT_DIR": str(output_dir),
        }
        vocoder_command = expand_template(vocoder_template, vocoder_mapping)
        completed = subprocess.run(vocoder_command, env=env, shell=True, text=True, capture_output=True)
        if completed.returncode != 0:
            return fail(
                "legacy vocoder command failed:\n"
                f"command={vocoder_command}\n"
                f"stdout={completed.stdout}\n"
                f"stderr={completed.stderr}",
                9
            )
        if not wav_path.exists():
            return fail(f"legacy vocoder command succeeded but wav missing: {wav_path}", 10)
        vocoder_status = "rendered"

        summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
        summary_payload["wav"] = str(wav_path)
        summary_payload["vocoder"] = {
            "status": vocoder_status,
            "command": vocoder_command,
        }
        summary_path.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "submitRequest": str(submit_path),
                "outputDir": str(output_dir),
                "summary": str(output_dir / "legacy-bridge.summary.json"),
                "wav": str(wav_path) if wav_path.exists() else None,
                "vocoderStatus": vocoder_status,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
