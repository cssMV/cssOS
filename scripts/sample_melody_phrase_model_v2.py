#!/usr/bin/env python3
import argparse
import json
import math
import random
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from autofill_melody_midi import build_midi_bytes  # noqa: E402
from train_melody_phrase_model import (  # noqa: E402
    CHORD_VOCAB,
    DURATION_BINS,
    MAX_NOTES,
    PITCH_BINS,
    PITCH_MIN,
    quantize_pitch,
)
from train_melody_phrase_model_v2 import (  # noqa: E402
    MelodyPhraseModelV2,
    SECTION_VOCAB,
    TONIC_VOCAB,
    hash_text_features,
)


INV_CHORD_VOCAB = {value: key for key, value in CHORD_VOCAB.items()}


def load_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            rows.append(json.loads(stripped))
    return rows


def load_record(path: Path, sample_id: str):
    for row in load_jsonl(path):
        if str(row.get("sample_id") or "") == sample_id:
            return row
    raise RuntimeError(f"sample_id not found: {sample_id}")


def section_slug(label: str):
    lowered = str(label or "").strip().lower()
    if lowered.startswith("pre-chorus") or lowered.startswith("pre chorus"):
        return "pre-chorus"
    if lowered.startswith("post-chorus") or lowered.startswith("post chorus"):
        return "post-chorus"
    for key in ("intro", "verse", "chorus", "bridge", "outro"):
        if lowered.startswith(key):
            return key
    return "default"


def section_id(label: str):
    return SECTION_VOCAB.get(section_slug(label), SECTION_VOCAB["default"])


def load_timing_lines(record):
    timing_path = Path(record.get("vocal_timing", {}).get("path") or "")
    return json.loads(timing_path.read_text(encoding="utf-8")).get("lines") or []


def normalize_line_text(text: str):
    value = str(text or "").replace("\u00a0", " ").strip()
    if any(token in value for token in ("Ã", "Â", "â", "ã", "å", "è", "é")):
        try:
            repaired = value.encode("latin1").decode("utf-8")
            if repaired:
                value = repaired
        except Exception:
            pass
    value = value.replace("###", "").replace("##", "").replace("#", "").strip()
    if value in {"---", "--", "-"}:
        return ""
    return " ".join(value.split())


def looks_like_noise_text(text: str):
    value = str(text or "").strip()
    if not value:
        return True
    suspicious = 0
    cjk = 0
    for ch in value:
        codepoint = ord(ch)
        if "\u4e00" <= ch <= "\u9fff":
            cjk += 1
        if ch in {"Ã", "Â", "â", "ã", "å", "è", "é", "ï", "¤", "¦", "©", "ª", "«", "¬", "®", "¯", "°", "±", "²", "³", "´", "µ", "¶", "·", "¸", "¹", "º", "»", "¼", "½", "¾", "¿", ""}:
            suspicious += 1
        elif 0x80 <= codepoint <= 0x9F:
            suspicious += 1
    if len(value) <= 2 and suspicious:
        return True
    if suspicious >= 2 and suspicious >= cjk:
        return True
    return False


def should_skip_line(line):
    text = normalize_line_text(line.get("text") or "")
    if not text:
        return True
    if looks_like_noise_text(text):
        return True
    if text.startswith("《") and text.endswith("》"):
        return True
    if text.startswith("——") or text.startswith("--"):
        return True
    if (text.startswith("（") and text.endswith("）")) or (text.startswith("(") and text.endswith(")")):
        return True
    lowered = text.lower()
    compact = lowered.replace(" ", "")
    if compact in {"mv", "cssmv", "scene", "act", "prelude", "interlude"}:
        return True
    if lowered.startswith("scene ") or lowered.startswith("act ") or lowered.startswith("part "):
        return True
    if lowered.startswith("prelude ") or lowered.startswith("interlude "):
        return True
    if lowered.startswith("verse ") or lowered.startswith("chorus ") or lowered.startswith("bridge "):
        return True
    return False


def normalize_line_section(section: str, text: str):
    base = str(section or "").strip()
    slug = section_slug(base)
    if slug != "default":
        return slug.title() if slug != "pre-chorus" and slug != "post-chorus" else slug.replace("-", " ").title()
    normalized_text = normalize_line_text(text)
    lowered = normalized_text.lower()
    if lowered.startswith("verse"):
        return "Verse"
    if lowered.startswith("chorus"):
        return "Chorus"
    if lowered.startswith("bridge"):
        return "Bridge"
    if lowered.startswith("intro") or lowered.startswith("prelude"):
        return "Intro"
    if lowered.startswith("outro") or lowered.startswith("ending"):
        return "Outro"
    return "Verse"


def load_chords(record):
    out = {}
    for item in record.get("chord_progression") or []:
        key = str(item.get("section_match") or "").strip()
        if key:
            out[key] = item
    return out


def chord_ids_for(section_entry):
    ids = []
    for chord in (section_entry or {}).get("chord_targets") or []:
        ids.append(CHORD_VOCAB.get(chord, 0))
    while len(ids) < 4:
        ids.append(0)
    return ids[:4]


def chord_meta(record):
    chord_rows = record.get("chord_progression") or []
    tonic = chord_rows[0].get("tonic") if chord_rows else ""
    tonic_id = TONIC_VOCAB.get(tonic, 0)
    mode_id = 1 if any((item.get("mode") == "minor") for item in chord_rows) else 0
    return tonic, tonic_id, mode_id


def build_examples(record):
    raw_lines = load_timing_lines(record)
    lines = []
    for raw in raw_lines:
        if should_skip_line(raw):
            continue
        text = normalize_line_text(raw.get("text") or "")
        section = normalize_line_section(raw.get("section") or "default", text)
        cloned = dict(raw)
        cloned["text"] = text
        cloned["section"] = section
        lines.append(cloned)
    chords = load_chords(record)
    counts = {}
    for line in lines:
        section = str(line.get("section") or "default")
        counts[section] = counts.get(section, 0) + 1
    seen = {}
    tonic, tonic_id, mode_id = chord_meta(record)
    examples = []
    for line in lines:
        text = str(line.get("text") or "")
        section = str(line.get("section") or "default")
        idx = seen.get(section, 0)
        seen[section] = idx + 1
        total = max(1, counts.get(section, 1))
        start_s = float(line.get("start_s") or 0.0)
        end_s = float(line.get("end_s") or start_s + 1.0)
        examples.append(
            {
                "line": line,
                "features": {
                    "section_id": section_id(section),
                    "mode_id": mode_id,
                    "tonic_id": tonic_id,
                    "chord_ids": chord_ids_for(chords.get(section) or {}),
                    "numeric": [
                        min(1.0, (end_s - start_s) / 8.0),
                        min(1.0, len(text) / 64.0),
                        min(1.0, float(line.get("pause_after_s") or 0.0) / 0.5),
                        0.0,
                        idx / total,
                        (idx + 1) / total,
                    ],
                    "text_hash": hash_text_features(text),
                },
                "tonic": tonic,
            }
        )
    return examples


def pitch_from_bin(bin_idx: int):
    if bin_idx <= 0:
        return PITCH_MIN
    return PITCH_MIN + bin_idx - 1


def duration_from_bin(bin_idx: int):
    return 0.12 + (bin_idx / max(1, DURATION_BINS - 1)) * (2.4 - 0.12)


def sample_section_slug(label: str):
    return section_slug(label)


def section_density_cap(section: str):
    slug = sample_section_slug(section)
    if slug == "intro":
      return 0.34
    if slug == "verse":
      return 0.48
    if slug == "pre-chorus":
      return 0.56
    if slug == "chorus":
      return 0.68
    if slug == "bridge":
      return 0.52
    if slug == "outro":
      return 0.4
    return 0.46


def sample_from_logits(logits, temperature: float, top_k: int):
    if temperature <= 1e-5:
        return int(torch.argmax(logits).item())
    scaled = logits / max(temperature, 1e-5)
    if top_k > 0 and top_k < scaled.shape[-1]:
        values, indices = torch.topk(scaled, top_k)
        probs = torch.softmax(values, dim=-1)
        picked = torch.multinomial(probs, 1)
        return int(indices[picked].item())
    probs = torch.softmax(scaled, dim=-1)
    return int(torch.multinomial(probs, 1).item())


def adjusted_mask_threshold(line, section: str, base_threshold: float):
    text = str(line.get("text") or "")
    pause_after = float(line.get("pause_after_s") or 0.0)
    threshold = base_threshold
    if len(text) <= 14:
        threshold -= 0.04
    if pause_after >= 0.25:
        threshold += 0.03
    slug = sample_section_slug(section)
    if slug == "chorus":
        threshold -= 0.05
    elif slug in {"intro", "outro"}:
        threshold += 0.04
    return max(0.3, min(0.9, threshold))


def contour_direction(recent_pitches):
    if len(recent_pitches) < 2:
        return 0
    delta = recent_pitches[-1] - recent_pitches[-2]
    if delta > 0:
        return 1
    if delta < 0:
        return -1
    return 0


def section_pitch_window(section: str):
    slug = sample_section_slug(section)
    if slug == "intro":
        return 58, 74
    if slug == "verse":
        return 56, 77
    if slug == "pre-chorus":
        return 58, 79
    if slug == "chorus":
        return 60, 82
    if slug == "bridge":
        return 57, 80
    if slug == "outro":
        return 55, 75
    return 56, 78


def is_long_form_record(record, examples):
    title = str(record.get("title") or "").strip().lower()
    sample_id = str(record.get("sample_id") or "").strip().lower()
    return len(examples) >= 60 or "mv i" in title or "mv i" in sample_id


def long_form_temperature(base_temperature: float, is_long_form: bool):
    if not is_long_form:
        return base_temperature
    return min(1.08, max(0.82, base_temperature + 0.08))


def long_form_top_k(base_top_k: int, is_long_form: bool):
    if not is_long_form:
        return base_top_k
    return max(base_top_k, 7)


def sample_record(model, record, device, mask_threshold: float, temperature: float, top_k: int, repetition_penalty: float, seed: int):
    rng = random.Random(seed)
    torch.manual_seed(seed)
    examples = build_examples(record)
    long_form = is_long_form_record(record, examples)
    effective_temperature = long_form_temperature(temperature, long_form)
    effective_top_k = long_form_top_k(top_k, long_form)
    output_lines = []
    midi_notes = []
    recent_pitches = []
    pitch_counts = {}
    for item in examples:
        line = item["line"]
        features = item["features"]
        section = str(line.get("section") or "default")
        pitch_floor, pitch_ceiling = section_pitch_window(section)
        batch = {
            "section_id": torch.tensor([features["section_id"]], dtype=torch.long, device=device),
            "mode_id": torch.tensor([features["mode_id"]], dtype=torch.long, device=device),
            "tonic_id": torch.tensor([features["tonic_id"]], dtype=torch.long, device=device),
            "chord_ids": torch.tensor([features["chord_ids"]], dtype=torch.long, device=device),
            "numeric": torch.tensor([features["numeric"]], dtype=torch.float32, device=device),
            "text_hash": torch.tensor([features["text_hash"]], dtype=torch.float32, device=device),
        }
        with torch.no_grad():
            pitch_logits, dur_logits, mask_logits = model(batch)
        mask_probs = torch.sigmoid(mask_logits)[0].tolist()
        active = []
        start_s = float(line.get("start_s") or 0.0)
        end_s = float(line.get("end_s") or start_s + 1.0)
        span = max(0.3, end_s - start_s)
        slot = span / MAX_NOTES
        local_threshold = adjusted_mask_threshold(line, section, mask_threshold)
        max_notes_for_line = max(1, int(math.ceil(MAX_NOTES * section_density_cap(section))))
        for idx in range(MAX_NOTES):
            prob = float(mask_probs[idx])
            if prob < local_threshold:
                continue
            if len(active) >= max_notes_for_line:
                break
            pitch_step_logits = pitch_logits[0, idx].clone()
            if repetition_penalty > 0 and recent_pitches:
                for repeated_pitch in recent_pitches[-4:]:
                    repeated_idx = max(0, min(PITCH_BINS - 1, quantize_pitch(repeated_pitch)))
                    pitch_step_logits[repeated_idx] -= repetition_penalty
            if long_form and recent_pitches:
                for repeated_pitch in recent_pitches[-8:]:
                    repeated_idx = max(0, min(PITCH_BINS - 1, quantize_pitch(repeated_pitch)))
                    pitch_step_logits[repeated_idx] -= repetition_penalty * 0.5
                for repeated_pitch, count in pitch_counts.items():
                    if count >= 10:
                        repeated_idx = max(0, min(PITCH_BINS - 1, quantize_pitch(repeated_pitch)))
                        pitch_step_logits[repeated_idx] -= 0.1 + min(0.24, (count - 9) * 0.015)
            direction = contour_direction(recent_pitches)
            if direction and recent_pitches:
                anchor = recent_pitches[-1]
                for raw_pitch in range(pitch_floor, pitch_ceiling + 1):
                    pitch_idx = max(0, min(PITCH_BINS - 1, quantize_pitch(raw_pitch)))
                    if direction > 0 and raw_pitch < anchor - 2:
                        pitch_step_logits[pitch_idx] -= 0.18
                    elif direction < 0 and raw_pitch > anchor + 2:
                        pitch_step_logits[pitch_idx] -= 0.18
            dur_step_logits = dur_logits[0, idx]
            pitch_bin = sample_from_logits(pitch_step_logits, effective_temperature, effective_top_k)
            dur_bin = sample_from_logits(dur_step_logits, max(0.65, effective_temperature * 0.92), effective_top_k)
            pitch = int(pitch_from_bin(pitch_bin))
            pitch = max(pitch_floor, min(pitch_ceiling, pitch))
            if recent_pitches and abs(pitch - recent_pitches[-1]) > 12:
                pitch = recent_pitches[-1] + 12 if pitch > recent_pitches[-1] else recent_pitches[-1] - 12
            if active and pitch == active[-1]["pitch"] and rng.random() < 0.7:
                pitch += 2 if pitch <= 72 else -2
            if len(active) >= 2:
                tail = [note["pitch"] for note in active[-2:]]
                if pitch == tail[-1] == tail[-2]:
                    pitch += 2 if pitch < pitch_ceiling - 1 else -2
            if long_form and len(recent_pitches) >= 3:
                tail = recent_pitches[-3:]
                if max(tail) - min(tail) <= 1 and abs(pitch - tail[-1]) <= 1:
                    pitch += 3 if pitch <= 74 else -3
            if long_form and recent_pitches:
                anchor = recent_pitches[-1]
                if abs(pitch - anchor) < 2 and rng.random() < 0.45:
                    pitch += 4 if pitch <= anchor else -4
            dur = min(duration_from_bin(dur_bin), slot * 0.92)
            note_start = start_s + slot * idx
            note = {
                "pitch": pitch,
                "duration_s": round(max(0.16, dur), 3),
                "start_s": round(note_start, 3),
                "velocity": 92 if "chorus" in sample_section_slug(section) else 80,
                "mask_prob": round(prob, 4),
            }
            active.append(note)
            midi_notes.append(note)
            recent_pitches.append(pitch)
            pitch_counts[pitch] = pitch_counts.get(pitch, 0) + 1
        output_lines.append(
            {
                "section": line.get("section"),
                "text": line.get("text"),
                "start_s": line.get("start_s"),
                "end_s": line.get("end_s"),
                "mask_threshold": round(local_threshold, 3),
                "predicted_notes": active,
            }
        )
    return output_lines, midi_notes


def main():
    parser = argparse.ArgumentParser(description="Sample phrase predictions from the trained melody phrase v2 model.")
    parser.add_argument("--input-jsonl", required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-midi", required=True)
    parser.add_argument("--mask-threshold", type=float, default=0.55)
    parser.add_argument("--temperature", type=float, default=0.9)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--repetition-penalty", type=float, default=0.45)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    record = load_record(Path(args.input_jsonl).expanduser().resolve(), args.sample_id)
    ckpt = torch.load(Path(args.model_path).expanduser().resolve(), map_location=device)
    model = MelodyPhraseModelV2().to(device)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    predicted_lines, midi_notes = sample_record(
        model,
        record,
        device,
        args.mask_threshold,
        args.temperature,
        args.top_k,
        args.repetition_penalty,
        args.seed,
    )
    out = {
        "schema": "css.melody_phrase_sample.v2",
        "sample_id": record.get("sample_id"),
        "title": record.get("title"),
        "model_path": str(Path(args.model_path).expanduser().resolve()),
        "mask_threshold": args.mask_threshold,
        "temperature": args.temperature,
        "top_k": args.top_k,
        "repetition_penalty": args.repetition_penalty,
        "seed": args.seed,
        "predicted_lines": predicted_lines,
        "predicted_note_count": len(midi_notes),
    }
    out_json = Path(args.output_json).expanduser().resolve()
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    out_midi = Path(args.output_midi).expanduser().resolve()
    out_midi.parent.mkdir(parents=True, exist_ok=True)
    out_midi.write_bytes(build_midi_bytes(midi_notes))
    print(json.dumps({"ok": True, "output_json": str(out_json), "output_midi": str(out_midi), "predicted_note_count": len(midi_notes)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
