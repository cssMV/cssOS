#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import torch
import torch.nn.functional as F

from train_melody_phrase_model_v2 import MelodyPhraseModelV2, PhraseDatasetV2


def evaluate(model, loader, device):
    model.eval()
    total_loss = 0.0
    total_batches = 0
    pitch_correct = 0.0
    pitch_total = 0.0
    dur_correct = 0.0
    dur_total = 0.0
    mask_tp = 0.0
    mask_fp = 0.0
    mask_fn = 0.0

    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            pitch_logits, dur_logits, mask_logits = model(batch)
            mask_targets = batch["mask_targets"]
            pitch_loss = F.cross_entropy(
                pitch_logits.transpose(1, 2), batch["pitch_targets"], reduction="none"
            )
            dur_loss = F.cross_entropy(
                dur_logits.transpose(1, 2), batch["dur_targets"], reduction="none"
            )
            mask_loss = F.binary_cross_entropy_with_logits(mask_logits, mask_targets)
            denom = mask_targets.sum().clamp_min(1.0)
            loss = ((pitch_loss + dur_loss) * mask_targets).sum() / denom + mask_loss
            total_loss += float(loss.item())
            total_batches += 1

            pitch_pred = pitch_logits.argmax(dim=-1)
            dur_pred = dur_logits.argmax(dim=-1)
            mask_pred = (torch.sigmoid(mask_logits) >= 0.5).float()

            pitch_correct += float(
                ((pitch_pred == batch["pitch_targets"]).float() * mask_targets).sum().item()
            )
            pitch_total += float(mask_targets.sum().item())
            dur_correct += float(
                ((dur_pred == batch["dur_targets"]).float() * mask_targets).sum().item()
            )
            dur_total += float(mask_targets.sum().item())
            mask_tp += float(((mask_pred == 1.0) & (mask_targets == 1.0)).sum().item())
            mask_fp += float(((mask_pred == 1.0) & (mask_targets == 0.0)).sum().item())
            mask_fn += float(((mask_pred == 0.0) & (mask_targets == 1.0)).sum().item())

    precision = mask_tp / max(1.0, mask_tp + mask_fp)
    recall = mask_tp / max(1.0, mask_tp + mask_fn)
    f1 = 0.0 if (precision + recall) == 0 else (2 * precision * recall) / (precision + recall)
    return {
        "loss": total_loss / max(1, total_batches),
        "pitch_accuracy": pitch_correct / max(1.0, pitch_total),
        "duration_accuracy": dur_correct / max(1.0, dur_total),
        "note_mask_precision": precision,
        "note_mask_recall": recall,
        "note_mask_f1": f1,
        "examples": len(loader.dataset),
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate a trained melody phrase v2 model.")
    parser.add_argument("--test-jsonl", required=True)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--metrics-out", required=True)
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dataset = PhraseDatasetV2(Path(args.test_jsonl).expanduser().resolve())
    if len(dataset) == 0:
        raise RuntimeError("no test phrase examples found for v2")
    loader = torch.utils.data.DataLoader(dataset, batch_size=args.batch_size, shuffle=False)

    checkpoint = torch.load(Path(args.model_path).expanduser().resolve(), map_location=device)
    model = MelodyPhraseModelV2().to(device)
    model.load_state_dict(checkpoint["state_dict"])
    metrics = evaluate(model, loader, device)
    metrics["schema"] = "css.melody_phrase_model.test_metrics.v2"
    metrics["device"] = str(device)
    metrics["inputs"] = {
        "test_jsonl": str(Path(args.test_jsonl).expanduser().resolve()),
        "model_path": str(Path(args.model_path).expanduser().resolve()),
    }
    out = Path(args.metrics_out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()
