import os

import torch
import torch.nn as nn

from cssmv_video_dataset import VideoDataset


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DATA_ROOT = os.environ.get("CSSMV_DATA_FRAMES", "data/frames")
MODEL_PATH = os.environ.get("CSSMV_MODEL_PATH", "models/model.pt")
BATCH_SIZE = int(os.environ.get("CSSMV_BATCH_SIZE", "2"))
EPOCHS = int(os.environ.get("CSSMV_EPOCHS", "10"))
LEARNING_RATE = float(os.environ.get("CSSMV_LR", "1e-4"))


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
    os.makedirs("models", exist_ok=True)

    dataset = VideoDataset(DATA_ROOT)
    if len(dataset) == 0:
        raise RuntimeError(f"no frame clips found under {DATA_ROOT}")

    loader = torch.utils.data.DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        drop_last=True,
    )

    model = Model().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), LEARNING_RATE)

    for epoch in range(EPOCHS):
        last_loss = None
        for batch in loader:
            batch = batch.to(DEVICE)
            noise = torch.randn_like(batch)
            noisy = batch + noise * 0.1
            pred = model(noisy)
            loss = ((pred - noise) ** 2).mean()

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            last_loss = loss.item()

        print("epoch", epoch, "loss", last_loss)

    torch.save(model.state_dict(), MODEL_PATH)


if __name__ == "__main__":
    main()
