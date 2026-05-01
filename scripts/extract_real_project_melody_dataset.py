#!/usr/bin/env python3
import argparse
import json
import math
import shlex
import subprocess
import uuid
from pathlib import Path


TPQ = 480
TEMPO_BPM = 92
TEMPO_US_PER_QUARTER = int(60_000_000 / TEMPO_BPM)


def encode_varlen(value: int):
    buffer = value & 0x7F
    out = bytearray()
    while True:
        value >>= 7
        if value:
            buffer <<= 8
            buffer |= ((value & 0x7F) | 0x80)
        else:
            break
    while True:
        out.append(buffer & 0xFF)
        if buffer & 0x80:
            buffer >>= 8
        else:
            break
    return bytes(out)


def sec_to_ticks(seconds: float):
    quarter_per_second = TEMPO_BPM / 60.0
    return max(1, int(round(seconds * TPQ * quarter_per_second)))


def build_midi_bytes(notes):
    track = bytearray()
    track.extend(b"\x00\xFF\x51\x03" + TEMPO_US_PER_QUARTER.to_bytes(3, "big"))
    track.extend(b"\x00\xC0\x00")
    events = []
    for note in notes:
        start_tick = sec_to_ticks(note["start_s"])
        end_tick = start_tick + sec_to_ticks(note["duration_s"])
        events.append((start_tick, 1, bytes([0x90, note["pitch"], note["velocity"]])))
        events.append((end_tick, 0, bytes([0x80, note["pitch"], 0x40])))
    events.sort(key=lambda item: (item[0], item[1]))
    previous_tick = 0
    for tick, _, payload in events:
        track.extend(encode_varlen(max(0, tick - previous_tick)))
        track.extend(payload)
        previous_tick = tick
    track.extend(b"\x00\xFF\x2F\x00")
    header = (
        b"MThd"
        + (6).to_bytes(4, "big")
        + (0).to_bytes(2, "big")
        + (1).to_bytes(2, "big")
        + TPQ.to_bytes(2, "big")
    )
    return header + b"MTrk" + len(track).to_bytes(4, "big") + bytes(track)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def infer_mode(text: str):
    lowered = str(text or "").lower()
    minor_hints = ("night", "lonely", "rain", "storm", "dark", "midnight", "lost")
    hits = sum(1 for token in minor_hints if token in lowered)
    return "minor" if hits >= 1 else "major"


def hz_to_midi(freq: float):
    return 69 + 12 * math.log2(freq / 440.0)


def moving_average(values, window: int):
    if window <= 1 or len(values) <= 1:
        return values[:]
    out = []
    radius = window // 2
    for index in range(len(values)):
        chunk = values[max(0, index - radius): min(len(values), index + radius + 1)]
        out.append(sum(chunk) / max(1, len(chunk)))
    return out


def median_filter(values, window: int):
    if window <= 1 or len(values) <= 1:
        return values[:]
    out = []
    radius = window // 2
    for index in range(len(values)):
        chunk = sorted(values[max(0, index - radius): min(len(values), index + radius + 1)])
        out.append(chunk[len(chunk) // 2])
    return out


PITCH_TRACKER_REMOTE = r"""
import json
import math
import subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile

audio_path = Path(AUDIO_PATH)
wav_path = audio_path
temp_wav = None
if audio_path.suffix.lower() != ".wav":
    temp_wav = audio_path.with_suffix(".pitchdecode.wav")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(audio_path),
            "-ac",
            "1",
            "-ar",
            "44100",
            str(temp_wav),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wav_path = temp_wav
sr, data = wavfile.read(wav_path)
if data.ndim > 1:
    data = data.mean(axis=1)
data = data.astype(np.float32)
max_abs = float(np.max(np.abs(data)) or 1.0)
data = data / max_abs

frame_size = 2048
hop = 256
min_freq = 80.0
max_freq = 880.0
min_lag = int(sr / max_freq)
max_lag = int(sr / min_freq)

frames = []
for start in range(0, max(1, len(data) - frame_size), hop):
    frame = data[start:start+frame_size]
    if len(frame) < frame_size:
        break
    rms = float(np.sqrt(np.mean(frame * frame)))
    if rms < 0.012:
        frames.append({"t": start / sr, "freq": 0.0, "rms": rms, "voiced": False})
        continue
    frame = frame - np.mean(frame)
    corr = np.correlate(frame, frame, mode="full")[frame_size-1:]
    corr[:min_lag] = 0
    window = corr[min_lag:max_lag]
    if window.size == 0:
        frames.append({"t": start / sr, "freq": 0.0, "rms": rms, "voiced": False})
        continue
    peak_rel = int(np.argmax(window))
    peak = float(window[peak_rel])
    lag = peak_rel + min_lag
    norm = float(corr[0] or 1.0)
    clarity = peak / norm
    if clarity < 0.18:
        frames.append({"t": start / sr, "freq": 0.0, "rms": rms, "voiced": False})
        continue
    frames.append({"t": start / sr, "freq": float(sr / lag), "rms": rms, "voiced": True})

def hz_to_midi(freq):
    return 69 + 12 * math.log2(freq / 440.0)

voiced_midis = [hz_to_midi(item["freq"]) for item in frames if item["voiced"] and item["freq"] > 0]
if voiced_midis:
    smoothed = []
    cursor = 0
    for item in frames:
        if item["voiced"] and item["freq"] > 0:
            smoothed.append(voiced_midis[cursor])
            cursor += 1
        else:
            smoothed.append(None)
else:
    smoothed = [None] * len(frames)

notes = []
current = None
last_t = 0.0
for index, item in enumerate(frames):
    t = float(item["t"])
    midi = smoothed[index]
    quantized = int(round(midi)) if midi is not None else None
    if quantized is not None:
        quantized = max(36, min(92, quantized))
    if current is None:
        if quantized is not None:
            current = {"pitch": quantized, "start_s": t, "last_s": t}
    else:
        pitch_jump = quantized is None or abs(quantized - current["pitch"]) >= 2
        if pitch_jump:
            duration = max(0.08, current["last_s"] - current["start_s"] + (hop / sr))
            if duration >= 0.12:
                notes.append({
                    "pitch": current["pitch"],
                    "start_s": round(current["start_s"], 3),
                    "duration_s": round(duration, 3),
                    "velocity": 88,
                })
            current = {"pitch": quantized, "start_s": t, "last_s": t} if quantized is not None else None
        else:
            current["last_s"] = t

if current is not None:
    duration = max(0.08, current["last_s"] - current["start_s"] + (hop / sr))
    if duration >= 0.12:
        notes.append({
            "pitch": current["pitch"],
            "start_s": round(current["start_s"], 3),
            "duration_s": round(duration, 3),
            "velocity": 88,
        })

print(json.dumps({
    "sample_rate": int(sr),
    "frames": len(frames),
    "notes": notes,
}))
if temp_wav is not None and temp_wav.exists():
    temp_wav.unlink()
"""


def build_chord_progression(music_plan: dict, project_text: str):
    mode = infer_mode(project_text)
    tonic = "Am" if mode == "minor" else "C"
    out = []
    for section in music_plan.get("sections") or []:
        label = str(section.get("label") or section.get("sectionId") or "Section").strip()
        phrases = section.get("phrases") or []
        target_degrees = []
        for phrase_id in phrases:
            phrase = next((item for item in music_plan.get("phrases") or [] if item.get("phraseId") == phrase_id), None)
            if not phrase:
                continue
            target_degrees.extend((phrase.get("melody") or {}).get("targetDegrees") or [])
        if not target_degrees:
            target_degrees = [1, 3, 5, 1] if mode == "major" else [1, 3, 6, 7]
        chord_targets = []
        for degree in target_degrees[:4]:
            if mode == "minor":
                chord_targets.append({1: "Am", 3: "C", 4: "Dm", 5: "Em", 6: "F", 7: "G"}.get(int(degree), "Am"))
            else:
                chord_targets.append({1: "C", 2: "Dm", 3: "Em", 4: "F", 5: "G", 6: "Am", 7: "Bdim"}.get(int(degree), "C"))
        out.append(
            {
                "section_match": label,
                "numeral_path": [str(item) for item in target_degrees[:4]],
                "cadence": chord_targets[-1] if chord_targets else None,
                "chord_targets": chord_targets,
                "tonic": tonic,
                "mode": mode,
                "bars_per_cycle": int(section.get("bars") or 4),
                "start_s": float(section.get("startSec") or 0.0),
                "end_s": float(section.get("startSec") or 0.0) + float(section.get("durationSec") or 0.0),
                "line_count": 1,
            }
        )
    return out


def build_timing_lines(music_plan: dict, output_package: dict):
    phrase_lines = []
    for index, phrase in enumerate(music_plan.get("phrases") or []):
        start_s = float(phrase.get("startSec") or 0.0)
        duration_s = float(phrase.get("durationSec") or 0.0)
        if duration_s <= 0:
            continue
        end_s = start_s + duration_s
        melody = phrase.get("melody") or {}
        contour = str(melody.get("contour") or "contour").replace("_", " ")
        phrase_function = str(melody.get("phraseFunction") or phrase.get("role") or "phrase").replace("_", " ")
        text = f"{phrase.get('section') or 'Section'} {index + 1} {phrase_function} {contour}".strip()
        phrase_lines.append(
            {
                "section": str(phrase.get("section") or f"Section {index + 1}").strip() or f"Section {index + 1}",
                "text": text,
                "start_s": round(start_s, 3),
                "end_s": round(end_s, 3),
                "pause_after_s": 0.2,
            }
        )
    if phrase_lines:
        return phrase_lines

    preview_script = list(output_package.get("previewScript") or [])
    segment_timeline = list(output_package.get("segmentTimeline") or [])
    lines = []
    for index, segment in enumerate(segment_timeline):
        text = preview_script[index] if index < len(preview_script) else str(segment.get("subtitleText") or segment.get("label") or "").strip()
        if not text:
            continue
        start_s = float(segment.get("startSec") or 0.0)
        duration_s = float(segment.get("durationSec") or max(1.0, float(segment.get("endSec") or 0.0) - start_s))
        end_s = start_s + duration_s
        lines.append(
            {
                "section": str(segment.get("label") or f"Section {index + 1}").strip() or f"Section {index + 1}",
                "text": text,
                "start_s": round(start_s, 3),
                "end_s": round(end_s, 3),
                "pause_after_s": 0.2,
            }
        )
    return lines


def run_pitch_tracker_remote(vocal_audio: Path, remote_host: str, remote_workdir: str):
    if remote_workdir.startswith("~/"):
        remote_home = subprocess.check_output(["ssh", remote_host, "printenv", "HOME"], text=True).strip()
        remote_workdir = f"{remote_home}/{remote_workdir[2:]}"
    remote_token = uuid.uuid4().hex[:10]
    remote_base = f"{remote_workdir.rstrip('/')}/pitch_extract_{remote_token}"
    remote_audio = f"{remote_base}/input{vocal_audio.suffix.lower()}"
    remote_script = f"{remote_base}/extract_pitch.py"
    helper_code = PITCH_TRACKER_REMOTE.replace("AUDIO_PATH", json.dumps(remote_audio))

    subprocess.run(["ssh", remote_host, f"mkdir -p {shlex.quote(remote_base)}"], check=True)
    try:
        subprocess.run(["rsync", "-az", str(vocal_audio), f"{remote_host}:{remote_audio}"], check=True)
        subprocess.run(
            ["ssh", remote_host, f"cat > {shlex.quote(remote_script)}"],
            input=helper_code,
            text=True,
            check=True,
        )
        raw = subprocess.check_output(["ssh", remote_host, f"python3 {shlex.quote(remote_script)}"], text=True)
    finally:
        subprocess.run(["ssh", remote_host, f"rm -rf {shlex.quote(remote_base)}"], check=False)
    return json.loads(raw)


def find_first_existing(project_dir: Path, candidates: list[str]):
    for name in candidates:
        candidate = project_dir / name
        if candidate.exists():
            return candidate
    return None


def build_record(project_dir: Path, output_root: Path, remote_host: str | None, remote_workdir: str):
    project_context_path = project_dir / "project.context.json"
    project_context = load_json(project_context_path) if project_context_path.exists() else {}
    music_plan = load_json(project_dir / "music.plan.json")
    output_package = load_json(project_dir / "output.package.json")
    vocal_audio = find_first_existing(project_dir, ["vocal.lead.mp3", "vocal.lead.wav"])
    if not vocal_audio:
        return None

    if not remote_host:
        raise RuntimeError("remote host is required to extract real melody from vocal wav")
    pitch_payload = run_pitch_tracker_remote(vocal_audio, remote_host, remote_workdir)
    notes = pitch_payload.get("notes") or []
    if not notes:
        return None

    sample_id = f"real_{project_dir.name}"
    sample_root = output_root / sample_id
    sample_root.mkdir(parents=True, exist_ok=True)
    midi_path = sample_root / "melody_real.mid"
    midi_path.write_bytes(build_midi_bytes(notes))

    timing_lines = build_timing_lines(music_plan, output_package)
    timing_payload = {
        "schema": "css.vocal_timing.v1",
        "source": "artifact_segment_timeline_v1",
        "sample_id": sample_id,
        "duration_s": float(output_package.get("metadata", {}).get("durationSec") or output_package.get("segmentTimeline", [{}])[-1].get("endSec") or 0.0),
        "lines": timing_lines,
    }
    timing_path = sample_root / "vocal_timing.json"
    timing_path.write_text(json.dumps(timing_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    stems = []
    for item in output_package.get("stems") or []:
        path = str(item.get("path") or "").strip()
        if path:
            stems.append(path)

    title = str(project_context.get("project", {}).get("title") or project_dir.name).strip()
    prompt = str(project_context.get("project", {}).get("sourceText") or "").strip()
    preview_script = list(output_package.get("previewScript") or [])
    section_labels = [str(item.get("label") or "").strip() for item in output_package.get("segmentTimeline") or [] if str(item.get("label") or "").strip()]

    record = {
        "schema": "css.melody_training_manifest.v1",
        "sample_id": sample_id,
        "run_id": sample_id,
        "title": title,
        "language": "en",
        "work_type": "single",
        "duration_s": output_package.get("metadata", {}).get("durationSec"),
        "full_lyrics": "\n".join(preview_script),
        "section_labels": section_labels,
        "sections": [
            {
                "section": line["section"],
                "start_s": line["start_s"],
                "end_s": line["end_s"],
                "line_count": 1,
                "lines": [{"t": line["start_s"], "text": line["text"]}],
            }
            for line in timing_lines
        ],
        "melody_midi": str(midi_path),
        "melody_plan": str(project_dir / "music.plan.json"),
        "phrase_map": None,
        "chord_progression": build_chord_progression(music_plan, f"{title}\n{prompt}"),
        "stem_tracks": {
            "plan_path": None,
            "names": [Path(path).stem for path in stems],
            "files": stems,
        },
        "vocal_timing": {
            "path": str(timing_path),
            "plan_path": None,
            "lines": timing_lines,
            "duration_s": timing_payload["duration_s"],
            "source": "artifact_segment_timeline_v1",
        },
        "final_mix_references": [str(project_dir / "mix.wav")] if (project_dir / "mix.wav").exists() else [],
        "prompt": prompt,
        "source_artifacts": {
            "project_context_json": str(project_context_path) if project_context_path.exists() else None,
            "music_plan_json": str(project_dir / "music.plan.json"),
            "output_package_json": str(project_dir / "output.package.json"),
            "vocal_lead_audio": str(vocal_audio),
        },
        "melody_midi_source": "real_vocal_pitch_track_v1",
        "chord_progression_source": "music_plan_degree_projection_v1",
        "stem_tracks_source": "artifact_output_package_v1",
        "real_melody_notes": len(notes),
        "real_melody_pitch_range": {
            "min_pitch": min(note["pitch"] for note in notes),
            "max_pitch": max(note["pitch"] for note in notes),
        },
    }
    pitch_summary = {
        "notes": len(notes),
        "min_pitch": min(note["pitch"] for note in notes),
        "max_pitch": max(note["pitch"] for note in notes),
    }
    (sample_root / "pitch_track.summary.json").write_text(json.dumps(pitch_summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return record


def main():
    parser = argparse.ArgumentParser(description="Extract real melody samples from cssmv artifact projects with rendered lead vocals.")
    parser.add_argument("--artifacts-root", default="artifacts/cssmv")
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--stats-json", required=True)
    parser.add_argument("--remote-host", default="api-vm")
    parser.add_argument("--remote-workdir", default="/srv/cssos/tmp/cssos_real_extract")
    args = parser.parse_args()

    artifacts_root = Path(args.artifacts_root).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()

    records = []
    for project_dir in sorted(path for path in artifacts_root.iterdir() if path.is_dir()):
        if not find_first_existing(project_dir, ["vocal.lead.mp3", "vocal.lead.wav"]):
            continue
        if not (project_dir / "music.plan.json").exists():
            continue
        if not (project_dir / "output.package.json").exists():
            continue
        record = build_record(project_dir, output_root, args.remote_host or None, args.remote_workdir)
        if record:
            records.append(record)

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    stats = {
        "schema": "css.real_project_melody_extract.stats.v1",
        "records": len(records),
        "artifacts_root": str(artifacts_root),
        "output_jsonl": str(output_jsonl),
        "output_root": str(output_root),
        "remote_host": args.remote_host,
        "remote_workdir": args.remote_workdir,
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
