"""
Convert UAVVaste (COCO JSON) → YOLO format.

UAVVaste is already single-class ('rubbish'), so this just converts the bbox
format and organizes into train/val splits.

Usage:
    python scripts/convert_uavvaste.py \
        --annotations data/uavvaste/annotations.json \
        --images-dir data/uavvaste/images \
        --output datasets/uavvaste \
        --val-split 0.2

Download UAVVaste from: https://github.com/UAVVaste/UAVVaste
"""
import argparse
import json
import os
import random
import shutil
from pathlib import Path


def coco_to_yolo_bbox(bbox, img_w, img_h):
    """Convert COCO [x, y, w, h] (absolute) → YOLO [cx, cy, w, h] (normalized)."""
    x, y, w, h = bbox
    cx = max(0.0, min(1.0, (x + w / 2) / img_w))
    cy = max(0.0, min(1.0, (y + h / 2) / img_h))
    nw = max(0.0, min(1.0, w / img_w))
    nh = max(0.0, min(1.0, h / img_h))
    return cx, cy, nw, nh


def main():
    parser = argparse.ArgumentParser(description="Convert UAVVaste → YOLO single-class")
    parser.add_argument("--annotations", required=True)
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--output", default="datasets/uavvaste")
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    with open(args.annotations) as f:
        coco = json.load(f)

    images = {img["id"]: img for img in coco["images"]}
    ann_by_img = {}
    for ann in coco["annotations"]:
        ann_by_img.setdefault(ann["image_id"], []).append(ann)

    images_dir = Path(args.images_dir)
    valid_ids = []
    for img_id, img_info in images.items():
        img_path = images_dir / img_info["file_name"]
        if not img_path.exists():
            img_path = images_dir / Path(img_info["file_name"]).name
        if img_path.exists() and img_id in ann_by_img:
            valid_ids.append((img_id, img_path))

    print(f"Found {len(valid_ids)} images with annotations")

    if not valid_ids:
        print("ERROR: No images found. Check --images-dir path.")
        return

    random.shuffle(valid_ids)
    n_val = int(len(valid_ids) * args.val_split)
    val_ids = valid_ids[:n_val]
    train_ids = valid_ids[n_val:]

    out = Path(args.output)
    for split in ["train", "val"]:
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)

    stats = {"train": 0, "val": 0, "annotations": 0}

    for split, id_list in [("train", train_ids), ("val", val_ids)]:
        for img_id, img_path in id_list:
            img_info = images[img_id]
            w, h = img_info["width"], img_info["height"]

            dest_img = out / "images" / split / img_path.name
            if not dest_img.exists():
                shutil.copy2(img_path, dest_img)

            label_path = out / "labels" / split / (img_path.stem + ".txt")
            lines = []
            for ann in ann_by_img.get(img_id, []):
                bbox = ann.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                cx, cy, nw, nh = coco_to_yolo_bbox(bbox, w, h)
                lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
                stats["annotations"] += 1

            with open(label_path, "w") as f:
                f.write("\n".join(lines))
            stats[split] += 1

    print(f"\nDone! Output: {out}")
    print(f"  Train: {stats['train']} | Val: {stats['val']} | Annotations: {stats['annotations']}")


if __name__ == "__main__":
    main()
