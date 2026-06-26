#!/usr/bin/env python3
"""Face detection step (the one piece that's materially easier in Python).

Globs the source image folder, runs InsightFace (RetinaFace detector), and
writes one flat JSON file of raw detections. The Node pipeline takes it from
there: thresholds, crops, embeddings, index. Keep this dumb — it only finds
boxes and confidences, it makes no decisions about what to keep.

Output: $DATA_DIR/detections.json
  { "detector": "insightface-buffalo_l",
    "images": [ { "filename", "width", "height",
                  "faces": [ { "x","y","width","height","confidence" } ] } ] }
"""
import json
import os
import sys

import cv2
from insightface.app import FaceAnalysis

SOURCE_DIR = os.environ.get("SOURCE_DIR", "photos")
DATA_DIR = os.environ.get("DATA_DIR", "volumes")
EXTS = (".jpg", ".jpeg", ".png", ".webp")
# Detector ships its own score; keep everything and let Node apply the
# real threshold so it can be tuned without re-running detection.
MIN_KEEP = float(os.environ.get("DETECT_MIN_KEEP", "0.3"))


def main() -> int:
    src = os.path.abspath(SOURCE_DIR)
    out_path = os.path.join(os.path.abspath(DATA_DIR), "detections.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    files = sorted(f for f in os.listdir(src) if f.lower().endswith(EXTS))
    if not files:
        print(f"No images found in {src}", file=sys.stderr)
        return 1
    print(f"Detecting faces in {len(files)} images from {src}")

    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=-1, det_size=(1024, 1024))

    images = []
    total = 0
    for i, fname in enumerate(files, 1):
        path = os.path.join(src, fname)
        img = cv2.imread(path)
        if img is None:
            print(f"  ! could not read {fname}", file=sys.stderr)
            continue
        h, w = img.shape[:2]
        faces = []
        for f in app.get(img):
            score = float(f.det_score)
            if score < MIN_KEEP:
                continue
            x1, y1, x2, y2 = f.bbox
            faces.append(
                {
                    "x": float(x1),
                    "y": float(y1),
                    "width": float(x2 - x1),
                    "height": float(y2 - y1),
                    "confidence": round(score, 4),
                }
            )
        total += len(faces)
        images.append(
            {"filename": fname, "width": w, "height": h, "faces": faces}
        )
        if i % 25 == 0 or i == len(files):
            print(f"  {i}/{len(files)} images, {total} faces so far")

    with open(out_path, "w") as fh:
        json.dump(
            {"detector": "insightface-buffalo_l", "images": images}, fh, indent=2
        )
    print(f"Wrote {total} detections across {len(images)} images -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
