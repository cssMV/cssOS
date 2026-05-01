#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F


TEMPO_BPM = 92
MAX_NOTES = 8
PITCH_MIN = 48
PITCH_MAX = 84
PITCH_BINS = PITCH_MAX - PITCH_MIN + 2
DURATION_BINS = 16
SECTION_VOCAB = {
    "unknown": 0,
    "intro": 1,
    "verse": 2,
    "pre-chorus": 3,
    "chorus": 4,
    "post-chorus": 5,
    "bridge": 6,
    "outro": 7,
    "default": 8,
}
TONIC_VOCAB = {
    "C": 0, "G": 1, "D": 2, "F": 3, "A": 4, "E": 5,
    "Am": 6, "Em": 7, "Dm": 8, "Bm": 9, "Gm": 10, "Cm": 11,
}
CHORD_VOCAB = {
    "PAD": 0, "C": 1, "Dm": 2, "Em": 3, "F": 4, "G": 5, "Am": 6, "Bdim": 7,
    "Bb": 8, "Bm": 9, "C#m": 10, "D": 11, "D#dim": 12, "Eb": 13, "Edim": 14,
    "E": 15, "F#": 16, "F#dim": 17, "F#m": 18, "G#dim": 19, "G#m": 20, "Gm": 21,
    "Ab": 22, "A": 23, "Adim": 24, "B": 25, "Cm": 26, "Ddim": 27, "Fm": 28,
}


def load_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            rows.append(json.loads(stripped))
    return rows


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


def encode_varlen_from(data: bytes, offset: int):
    value = 0
    while True:
        byte = data[offset]
        value = (value << 7) | (byte & 0x7F)
        offset += 1
        if not (byte & 0x80):
            break
    return value, offset


def parse_midi_notes(path: Path):
    data = path.read_bytes()
    if data[:4] != b"MThd":
        return []
    division = int.from_bytes(data[12:14], "big")
    offset = 14
    tempo = 500000
    notes = []
    while offset < len(data):
        chunk_id = data[offset:offset + 4]
        chunk_len = int.from_bytes(data[offset + 4:offset + 8], "big")
        chunk = data[offset + 8:offset + 8 + chunk_len]
        offset += 8 + chunk_len
        if chunk_id != b"MTrk":
            continue
        idx = 0
        tick = 0
        running = None
        active = {}
        while idx < len(chunk):
            delta, idx = encode_varlen_from(chunk, idx)
            tick += delta
            status = chunk[idx]
            if status < 0x80:
                status = running
            else:
                idx += 1
                running = status
            if status == 0xFF:
                meta_type = chunk[idx]
                idx += 1
                size, idx = encode_varlen_from(chunk, idx)
                payload = chunk[idx:idx + size]
                idx += size
                if meta_type == 0x51 and size == 3:
                    tempo = int.from_bytes(payload, "big")
                continue
            if status in (0xF0, 0xF7):
                size, idx = encode_varlen_from(chunk, idx)
                idx += size
                continue
            event = status & 0xF0
            channel = status & 0x0F
            if event in (0x80, 0x90):
                note = chunk[idx]
                velocity = chunk[idx + 1]
                idx += 2
                key = (channel, note)
                if event == 0x90 and velocity > 0:
                    active[key] = tick
                else:
                    start = active.pop(key, None)
                    if start is not None and tick > start:
                        start_s = start * tempo / 1_000_000 / division
                        end_s = tick * tempo / 1_000_000 / division
                        notes.append({"pitch": note, "start_s": start_s, "end_s": end_s})
            else:
                idx += 1 if event in (0xC0, 0xD0) else 2
    return notes


def quantize_pitch(pitch: int):
    if pitch < PITCH_MIN:
        return 0
    if pitch > PITCH_MAX:
        return PITCH_BINS - 1
    return pitch - PITCH_MIN + 1


def quantize_duration(duration_s: float):
    clipped = max(0.12, min(2.4, duration_s))
    return min(DURATION_BINS - 1, int(((clipped - 0.12) / (2.4 - 0.12)) * (DURATION_BINS - 1)))


def chord_ids(section_entry):
    out = []
    for chord in (section_entry or {}).get("chord_targets") or []:
        out.append(CHORD_VOCAB.get(chord, 0))
    while len(out) < 4:
        out.append(0)
    return out[:4]


def build_examples(records):
    examples = []
    for record in records:
        timing_path = Path(record.get("vocal_timing", {}).get("path") or record.get("provenance", {}).get("audio_path", ""))
        if "vocal_timing" in record and isinstance(record["vocal_timing"], dict) and record["vocal_timing"].get("path"):
            timing_path = Path(record["vocal_timing"]["path"])
        midi_path = Path(record.get("melody_midi") or "")
        chords = {item.get("section_match"): item for item in (record.get("chord_progression") or [])}
        if not timing_path.exists() or not midi_path.exists():
            continue
        timing_payload = json.loads(timing_path.read_text(encoding="utf-8"))
        lines = timing_payload.get("lines") or []
        midi_notes = parse_midi_notes(midi_path)
        tonic_id = TONIC_VOCAB.get((record.get("chord_progression") or [{}])[0].get("tonic") if record.get("chord_progression") else "", 0)
        mode_id = 1 if any((item.get("mode") == "minor") for item in (record.get("chord_progression") or [])) else 0

        for line in lines:
            start_s = float(line.get("start_s") or 0.0)
            end_s = float(line.get("end_s") or start_s)
            if end_s <= start_s:
                continue
            overlapping = [
                note for note in midi_notes
                if note["end_s"] > start_s and note["start_s"] < end_s
            ]
            if not overlapping:
                continue
            overlapping.sort(key=lambda item: item["start_s"])
            pitch_targets = [0] * MAX_NOTES
            dur_targets = [0] * MAX_NOTES
            mask_targets = [0.0] * MAX_NOTES
            for idx, note in enumerate(overlapping[:MAX_NOTES]):
                pitch_targets[idx] = quantize_pitch(int(note["pitch"]))
                dur_targets[idx] = quantize_duration(float(note["end_s"] - note["start_s"]))
                mask_targets[idx] = 1.0
            text = str(line.get("text") or "")
            section_name = str(line.get("section") or "default")
            section_entry = chords.get(section_name) or {}
            examples.append(
                {
                    "section_id": SECTION_VOCAB.get(section_slug(section_name), SECTION_VOCAB["default"]),
                    "mode_id": mode_id,
                    "tonic_id": tonic_id,
                    "chord_ids": chord_ids(section_entry),
                    "numeric": [
                        min(1.0, (end_s - start_s) / 8.0),
                        min(1.0, len(text) / 64.0),
                        min(1.0, float(line.get("pause_after_s") or 0.0) / 0.5),
                        min(1.0, len(overlapping) / MAX_NOTES),
                    ],
                    "pitch_targets": pitch_targets,
                    "dur_targets": dur_targets,
                    "mask_targets": mask_targets,
                }
            )
    return examples


class PhraseDataset(torch.utils.data.Dataset):
    def __init__(self, path: Path):
        self.records = load_jsonl(path)
        self.examples = build_examples(self.records)

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        item = self.examples[idx]
        return {
            "section_id": torch.tensor(item["section_id"], dtype=torch.long),
            "mode_id": torch.tensor(item["mode_id"], dtype=torch.long),
            "tonic_id": torch.tensor(item["tonic_id"], dtype=torch.long),
            "chord_ids": torch.tensor(item["chord_ids"], dtype=torch.long),
            "numeric": torch.tensor(item["numeric"], dtype=torch.float32),
            "pitch_targets": torch.tensor(item["pitch_targets"], dtype=torch.long),
            "dur_targets": torch.tensor(item["dur_targets"], dtype=torch.long),
            "mask_targets": torch.tensor(item["mask_targets"], dtype=torch.float32),
        }


class MelodyPhraseModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.section_emb = nn.Embedding(len(SECTION_VOCAB) + 1, 16)
        self.mode_emb = nn.Embedding(3, 4)
        self.tonic_emb = nn.Embedding(len(TONIC_VOCAB) + 1, 8)
        self.chord_emb = nn.Embedding(len(CHORD_VOCAB) + 1, 8)
        self.mlp = nn.Sequential(
            nn.Linear(16 + 4 + 8 + 4 * 8 + 4, 128),
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
        )
        self.pitch_head = nn.Linear(128, MAX_NOTES * PITCH_BINS)
        self.dur_head = nn.Linear(128, MAX_NOTES * DURATION_BINS)
        self.mask_head = nn.Linear(128, MAX_NOTES)

    def forward(self, batch):
        chord_feat = self.chord_emb(batch["chord_ids"]).reshape(batch["chord_ids"].shape[0], -1)
        features = torch.cat(
            [
                self.section_emb(batch["section_id"]),
                self.mode_emb(batch["mode_id"]),
                self.tonic_emb(batch["tonic_id"]),
                chord_feat,
                batch["numeric"],
            ],
            dim=1,
        )
        hidden = self.mlp(features)
        pitch = self.pitch_head(hidden).reshape(-1, MAX_NOTES, PITCH_BINS)
        dur = self.dur_head(hidden).reshape(-1, MAX_NOTES, DURATION_BINS)
        mask = self.mask_head(hidden)
        return pitch, dur, mask


def evaluate(model, loader, device):
    model.eval()
    total_loss = 0.0
    total_batches = 0
    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            pitch, dur, mask = model(batch)
            mask_targets = batch["mask_targets"]
            pitch_loss = F.cross_entropy(pitch.transpose(1, 2), batch["pitch_targets"], reduction="none")
            dur_loss = F.cross_entropy(dur.transpose(1, 2), batch["dur_targets"], reduction="none")
            mask_loss = F.binary_cross_entropy_with_logits(mask, mask_targets)
            denom = mask_targets.sum().clamp_min(1.0)
            loss = ((pitch_loss + dur_loss) * mask_targets).sum() / denom + mask_loss
            total_loss += float(loss.item())
            total_batches += 1
    return total_loss / max(1, total_batches)


def main():
    parser = argparse.ArgumentParser(description="Train a first-pass melody phrase model from training-ready melody dataset splits.")
    parser.add_argument("--train-jsonl", required=True)
    parser.add_argument("--val-jsonl", required=True)
    parser.add_argument("--model-out", required=True)
    parser.add_argument("--metrics-out", required=True)
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_ds = PhraseDataset(Path(args.train_jsonl).expanduser().resolve())
    val_ds = PhraseDataset(Path(args.val_jsonl).expanduser().resolve())
    if len(train_ds) == 0:
        raise RuntimeError("no train phrase examples found")
    if len(val_ds) == 0:
        raise RuntimeError("no val phrase examples found")

    train_loader = torch.utils.data.DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = torch.utils.data.DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)
    model = MelodyPhraseModel().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    history = []
    best_val = None
    best_state = None
    for epoch in range(args.epochs):
        model.train()
        total_loss = 0.0
        total_batches = 0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            pitch, dur, mask = model(batch)
            mask_targets = batch["mask_targets"]
            pitch_loss = F.cross_entropy(pitch.transpose(1, 2), batch["pitch_targets"], reduction="none")
            dur_loss = F.cross_entropy(dur.transpose(1, 2), batch["dur_targets"], reduction="none")
            mask_loss = F.binary_cross_entropy_with_logits(mask, mask_targets)
            denom = mask_targets.sum().clamp_min(1.0)
            loss = ((pitch_loss + dur_loss) * mask_targets).sum() / denom + mask_loss
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item())
            total_batches += 1

        train_loss = total_loss / max(1, total_batches)
        val_loss = evaluate(model, val_loader, device)
        history.append({"epoch": epoch + 1, "train_loss": train_loss, "val_loss": val_loss})
        print(json.dumps(history[-1], ensure_ascii=False))
        if best_val is None or val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}

    model_out = Path(args.model_out).expanduser().resolve()
    model_out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": best_state or model.state_dict(),
            "config": {
                "max_notes": MAX_NOTES,
                "pitch_bins": PITCH_BINS,
                "duration_bins": DURATION_BINS,
                "tempo_bpm": TEMPO_BPM,
            },
        },
        model_out,
    )

    metrics = {
        "schema": "css.melody_phrase_model.metrics.v1",
        "device": str(device),
        "train_examples": len(train_ds),
        "val_examples": len(val_ds),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "best_val_loss": best_val,
        "history": history,
        "outputs": {"model_out": str(model_out)},
    }
    metrics_out = Path(args.metrics_out).expanduser().resolve()
    metrics_out.parent.mkdir(parents=True, exist_ok=True)
    metrics_out.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()
