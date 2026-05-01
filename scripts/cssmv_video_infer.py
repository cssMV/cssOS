import os
import subprocess

import cv2
import torch
import torch.nn as nn


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_PATH = os.environ.get("CSSMV_MODEL_PATH", "models/model.pt")
OUTPUT_ROOT = os.environ.get("CSSMV_OUTPUT_ROOT", "output")


class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv3d(3, 32, 3, padding=1),
            nn.ReLU(),
            nn.Conv3d(32, 32, 3, padding=1),
            nn.ReLU(),
            nn.Conv3d(32, 3, 3, padding=1),
        )

    def forward(self, x):
        return self.net(x)


def main():
    os.makedirs(os.path.join(OUTPUT_ROOT, "frames"), exist_ok=True)

    model = Model().to(DEVICE)
    state = torch.load(MODEL_PATH, map_location=DEVICE)
    model.load_state_dict(state)
    model.eval()

    x = torch.randn(1, 3, 8, 128, 128, device=DEVICE)

    with torch.no_grad():
        for _ in range(20):
            x = x - model(x) * 0.1

    frames = x[0].permute(1, 2, 3, 0).cpu().numpy()

    for index, frame in enumerate(frames):
        image = (frame * 255.0).clip(0, 255).astype("uint8")
        cv2.imwrite(os.path.join(OUTPUT_ROOT, "frames", f"{index:03d}.png"), image)

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "8",
            "-i",
            os.path.join(OUTPUT_ROOT, "frames", "%03d.png"),
            os.path.join(OUTPUT_ROOT, "out.mp4"),
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
