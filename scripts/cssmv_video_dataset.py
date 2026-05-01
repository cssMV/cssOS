import os

import torch
from PIL import Image


class VideoDataset(torch.utils.data.Dataset):
    def __init__(self, root: str, frames_per_clip: int = 8, size: int = 128):
        self.root = root
        self.frames_per_clip = frames_per_clip
        self.size = size
        self.samples = []

        if not os.path.isdir(root):
            return

        for folder in sorted(os.listdir(root)):
            path = os.path.join(root, folder)
            if not os.path.isdir(path):
                continue

            frames = [
                os.path.join(path, name)
                for name in sorted(os.listdir(path))
                if name.lower().endswith(".png")
            ][:frames_per_clip]

            if len(frames) < frames_per_clip:
                continue

            self.samples.append(frames)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        frames = self.samples[idx]
        imgs = []

        for frame_path in frames:
            image = Image.open(frame_path).convert("RGB").resize((self.size, self.size))
            tensor = torch.tensor(list(image.getdata()), dtype=torch.float32)
            tensor = tensor.view(self.size, self.size, 3).permute(2, 0, 1) / 255.0
            imgs.append(tensor)

        return torch.stack(imgs, dim=1)
