#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path


def fail(message: str, code: int = 1) -> int:
    print(f"[cssmv-diffsinger-generate-condition] {message}", file=sys.stderr)
    return code


def build_mel2ph(durations, total_frames: int):
    mel2ph = []
    for idx, frame_count in enumerate(durations, start=1):
        mel2ph.extend([idx] * max(0, int(frame_count)))
    if not mel2ph:
        mel2ph = [1]
    if len(mel2ph) < total_frames:
        mel2ph.extend([mel2ph[-1]] * (total_frames - len(mel2ph)))
    elif len(mel2ph) > total_frames:
        mel2ph = mel2ph[:total_frames]
    return mel2ph


def main() -> int:
    if len(sys.argv) < 3:
        return fail("usage: cssmv-diffsinger-generate-condition.py <submit.request.json> <output_dir>", 2)

    submit_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    if not submit_path.exists():
        return fail(f"submit request not found: {submit_path}", 3)

    legacy_root = Path(os.environ.get("CSSMV_DIFFSINGER_LEGACY_ROOT", "/srv/cssmv-hosts/DiffSinger-v1.4.0")).resolve()
    if not legacy_root.exists():
        return fail(f"legacy DiffSinger root not found: {legacy_root}", 4)

    sys.path.insert(0, str(legacy_root))
    os.chdir(legacy_root)

    import torch
    from utils import load_ckpt
    from utils.hparams import hparams, set_hparams
    from utils.pitch_utils import norm_f0
    from utils.phoneme_utils import build_phoneme_list
    from utils.text_encoder import TokenTextEncoder
    from modules.naive_frontend.encoder import ParameterEncoder

    payload = json.loads(submit_path.read_text(encoding="utf-8"))
    request = payload["request"] if isinstance(payload.get("request"), dict) else payload
    model_name = str(request.get("model") or os.environ.get("CSSMV_DIFFSINGER_MODEL") or "").strip()
    if not model_name:
      return fail("model missing in submit request and CSSMV_DIFFSINGER_MODEL", 5)

    checkpoint_dir = legacy_root / "checkpoints" / model_name
    config_path = checkpoint_dir / "config.yaml"
    if not config_path.exists():
        return fail(f"checkpoint config not found: {config_path}", 6)

    sys.argv = [
        "cssmv-diffsinger-generate-condition.py",
        "--config",
        str(config_path),
        "--exp_name",
        model_name,
        "--infer",
    ]
    set_hparams(print_hparams=False)

    phoneme_list = build_phoneme_list()
    phone_encoder = TokenTextEncoder(vocab_list=phoneme_list, replace_oov=",")
    encoder = ParameterEncoder(phone_encoder)
    encoder.eval()
    load_ckpt(encoder, hparams["work_dir"], "model.fs2", strict=True)

    phonemes = [str(item.get("name") or "").strip() for item in request.get("phonemes", []) if str(item.get("name") or "").strip()]
    durations_sec = [max(0.0, float(item.get("duration") or 0.0)) for item in request.get("phonemes", []) if str(item.get("name") or "").strip()]
    if not phonemes:
        return fail("no phonemes in submit request", 7)

    frame_length = float(hparams["hop_size"]) / float(hparams["audio_sample_rate"])
    duration_frames = [max(1, int(round(value / frame_length))) for value in durations_sec]
    required_frames = max(1, sum(duration_frames))
    f0_values = [float(value) for value in request.get("f0", {}).get("values", [])]
    if not f0_values:
        f0_values = [220.0] * required_frames
    if len(f0_values) < required_frames:
        pad_value = f0_values[-1] if f0_values else 220.0
        f0_values.extend([pad_value] * (required_frames - len(f0_values)))
    else:
        f0_values = f0_values[:required_frames]

    mel2ph = build_mel2ph(duration_frames, required_frames)
    uv = [1.0 if value <= 0 else 0.0 for value in f0_values]
    safe_f0 = [max(1.0, value) for value in f0_values]

    txt_tokens = torch.LongTensor([phone_encoder.encode(" ".join(phonemes))])
    mel2ph_tensor = torch.LongTensor([mel2ph])
    f0_tensor = torch.FloatTensor([safe_f0])
    uv_tensor = torch.FloatTensor([uv])
    f0_norm = norm_f0(f0_tensor.clone(), uv_tensor.clone(), hparams)

    with torch.no_grad():
        ret = encoder(
            txt_tokens,
            mel2ph=mel2ph_tensor,
            f0=f0_norm,
            uv=uv_tensor,
            skip_decoder=True,
            infer=True,
        )
        condition = ret["decoder_inp"].detach().cpu().numpy()

    output_dir.mkdir(parents=True, exist_ok=True)
    condition_path = output_dir / "condition.npy"
    meta_path = output_dir / "condition.meta.json"

    import numpy as np

    np.save(condition_path, condition)
    meta_path.write_text(
        json.dumps(
            {
                "generatedBy": "cssmv-diffsinger-generate-condition",
                "legacyRoot": str(legacy_root),
                "checkpointDir": str(checkpoint_dir),
                "model": model_name,
                "phonemeCount": len(phonemes),
                "frameCount": required_frames,
                "conditionShape": list(condition.shape),
                "frameLengthSec": frame_length,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"condition": str(condition_path), "meta": str(meta_path), "shape": list(condition.shape)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
