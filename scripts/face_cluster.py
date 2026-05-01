import json
import os
import sys

import cv2
import face_recognition
from sklearn.cluster import DBSCAN


FRAMES_DIR = "data/frames"
OUT_FILE = "data/meta/character_clusters.json"


def main():
    encodings = []
    paths = []

    print("extracting face embeddings...")

    for root, _, files in os.walk(FRAMES_DIR):
        for name in files:
            if not name.endswith(".png"):
                continue

            path = os.path.join(root, name)
            image = cv2.imread(path)
            if image is None:
                continue

            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            faces = face_recognition.face_locations(rgb)
            if len(faces) != 1:
                continue

            encoding = face_recognition.face_encodings(rgb, faces)[0]
            encodings.append(encoding)
            paths.append(path)

    print(f"faces collected: {len(encodings)}")

    if not encodings:
        print("no faces found")
        sys.exit(1)

    clusterer = DBSCAN(metric="euclidean", eps=0.5, min_samples=10)
    labels = clusterer.fit_predict(encodings)

    clusters = {}
    for label, path in zip(labels, paths):
        if label == -1:
            continue

        key = f"char{label:03d}"
        clusters.setdefault(key, []).append(path)

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as handle:
        json.dump(clusters, handle, indent=2, ensure_ascii=False)

    print(f"saved: {OUT_FILE}")
    for key, values in sorted(clusters.items()):
        print(key, len(values))


if __name__ == "__main__":
    main()
