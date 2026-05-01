#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

from train_melody_phrase_model import (
    CHORD_VOCAB,
    DURATION_BINS,
    MAX_NOTES,
    PITCH_BINS,
    PhraseDataset,
    SECTION_VOCAB,
    TONIC_VOCAB,
    chord_ids,
    load_jsonl,
    parse_midi_notes,
    quantize_duration,
    quantize_pitch,
)


TEXT_HASH_DIM = 32


def hash_text_features(text: str):
    buckets = [0.0] * TEXT_HASH_DIM
    tokens = [tok for tok in text.lower().replace("，", " ").replace(",", " ").split() if tok]
    if not tokens:
        tokens = list(text[:8])
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16) % TEXT_HASH_DIM
        buckets[idx] += 1.0
    total = sum(buckets) or 1.0
    return [value / total for value in buckets]


def build_examples_v2(records):
    examples = []
    for record in records:
        timing_path = Path(record.get("vocal_timing", {}).get("path") or "")
        if "vocal_timing" in record and isinstance(record["vocal_timing"], dict) and record["vocal_timing"].get("path"):
            timing_path = Path(record["vocal_timing"]["path"])
        midi_path = Path(record.get("melody_midi") or "")
        chords = {item.get("section_match"): item for item in (record.get("chord_progression") or [])}
        if not timing_path.exists() or not midi_path.exists():
            continue
        timing_payload = json.loads(timing_path.read_text(encoding="utf-8"))
        lines = timing_payload.get("lines") or []
        section_counts = {}
        for line in lines:
            key = str(line.get("section") or "default")
            section_counts[key] = section_counts.get(key, 0) + 1
        section_seen = {}
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
            line_idx = section_seen.get(section_name, 0)
            section_seen[section_name] = line_idx + 1
            section_total = max(1, section_counts.get(section_name, 1))

            examples.append(
                {
                    "section_id": SECTION_VOCAB.get(section_name.split()[0].lower(), SECTION_VOCAB["default"]),
                    "mode_id": mode_id,
                    "tonic_id": tonic_id,
                    "chord_ids": chord_ids(section_entry),
                    "numeric": [
                        min(1.0, (end_s - start_s) / 8.0),
                        min(1.0, len(text) / 64.0),
                        min(1.0, float(line.get("pause_after_s") or 0.0) / 0.5),
                        min(1.0, len(overlapping) / MAX_NOTES),
                        line_idx / section_total,
                        (line_idx + 1) / section_total,
                    ],
                    "text_hash": hash_text_features(text),
                    "pitch_targets": pitch_targets,
                    "dur_targets": dur_targets,
                    "mask_targets": mask_targets,
                }
            )
    return examples


class PhraseDatasetV2(torch.utils.data.Dataset):
    def __init__(self, path: Path):
        self.records = load_jsonl(path)
        self.examples = build_examples_v2(self.records)

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
            "text_hash": torch.tensor(item["text_hash"], dtype=torch.float32),
            "pitch_targets": torch.tensor(item["pitch_targets"], dtype=torch.long),
            "dur_targets": torch.tensor(item["dur_targets"], dtype=torch.long),
            "mask_targets": torch.tensor(item["mask_targets"], dtype=torch.float32),
        }


class MelodyPhraseModelV2(nn.Module):
    def __init__(self):
        super().__init__()
        self.section_emb = nn.Embedding(len(SECTION_VOCAB) + 1, 16)
        self.mode_emb = nn.Embedding(3, 4)
        self.tonic_emb = nn.Embedding(len(TONIC_VOCAB) + 1, 8)
        self.chord_emb = nn.Embedding(len(CHORD_VOCAB) + 1, 8)
        self.text_proj = nn.Sequential(
            nn.Linear(TEXT_HASH_DIM, 32),
            nn.ReLU(),
            nn.Linear(32, 24),
            nn.ReLU(),
        )
        self.mlp = nn.Sequential(
            nn.Linear(16 + 4 + 8 + 4 * 8 + 6 + 24, 160),
            nn.ReLU(),
            nn.Linear(160, 160),
            nn.ReLU(),
        )
        self.pitch_head = nn.Linear(160, MAX_NOTES * PITCH_BINS)
        self.dur_head = nn.Linear(160, MAX_NOTES * DURATION_BINS)
        self.mask_head = nn.Linear(160, MAX_NOTES)

    def forward(self, batch):
        chord_feat = self.chord_emb(batch["chord_ids"]).reshape(batch["chord_ids"].shape[0], -1)
        text_feat = self.text_proj(batch["text_hash"])
        features = torch.cat(
            [
                self.section_emb(batch["section_id"]),
                self.mode_emb(batch["mode_id"]),
                self.tonic_emb(batch["tonic_id"]),
                chord_feat,
                batch["numeric"],
                text_feat,
            ],
            dim=1,
        )
        hidden = self.mlp(features)
        return (
            self.pitch_head(hidden).reshape(-1, MAX_NOTES, PITCH_BINS),
            self.dur_head(hidden).reshape(-1, MAX_NOTES, DURATION_BINS),
            self.mask_head(hidden),
        )


def compute_loss(model, batch, device):
    batch = {k: v.to(device) for k, v in batch.items()}
    pitch, dur, mask = model(batch)
    mask_targets = batch["mask_targets"]
    pitch_loss = F.cross_entropy(pitch.transpose(1, 2), batch["pitch_targets"], reduction="none")
    dur_loss = F.cross_entropy(dur.transpose(1, 2), batch["dur_targets"], reduction="none")
    mask_loss = F.binary_cross_entropy_with_logits(mask, mask_targets)
    denom = mask_targets.sum().clamp_min(1.0)
    return ((pitch_loss + dur_loss) * mask_targets).sum() / denom + mask_loss


def evaluate(model, loader, device):
    model.eval()
    total = 0.0
    batches = 0
    with torch.no_grad():
        for batch in loader:
            total += float(compute_loss(model, batch, device).item())
            batches += 1
    return total / max(1, batches)


def main():
    parser = argparse.ArgumentParser(description="Train v2 melody phrase model with stronger phrase conditioning.")
    parser.add_argument("--train-jsonl", required=True)
    parser.add_argument("--val-jsonl", required=True)
    parser.add_argument("--model-out", required=True)
    parser.add_argument("--metrics-out", required=True)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_ds = PhraseDatasetV2(Path(args.train_jsonl).expanduser().resolve())
    val_ds = PhraseDatasetV2(Path(args.val_jsonl).expanduser().resolve())
    if len(train_ds) == 0 or len(val_ds) == 0:
        raise RuntimeError("empty train or val phrase examples for v2")
    train_loader = torch.utils.data.DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = torch.utils.data.DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)
    model = MelodyPhraseModelV2().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    history = []
    best_val = None
    best_state = None
    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        batches = 0
        for batch in train_loader:
            loss = compute_loss(model, batch, device)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += float(loss.item())
            batches += 1
        train_loss = total / max(1, batches)
        val_loss = evaluate(model, val_loader, device)
        history.append({"epoch": epoch + 1, "train_loss": train_loss, "val_loss": val_loss})
        print(json.dumps(history[-1], ensure_ascii=False))
        if best_val is None or val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}

    out_path = Path(args.model_out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": best_state or model.state_dict(), "version": "v2"}, out_path)
    metrics = {
        "schema": "css.melody_phrase_model.metrics.v2",
        "device": str(device),
        "train_examples": len(train_ds),
        "val_examples": len(val_ds),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "best_val_loss": best_val,
        "history": history,
        "outputs": {"model_out": str(out_path)},
    }
    metrics_path = Path(args.metrics_out).expanduser().resolve()
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()
