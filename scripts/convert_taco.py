"""
Convert TACO (COCO JSON) → YOLO format, collapsing all 60 classes to class 0 ('litter').

Usage:
    python scripts/convert_taco.py \
        --annotations data/taco_annotations.json \
        --images-dir data/taco_images \
        --output datasets/taco \
        --val-split 0.2

Expects TACO images downloaded via:
    git clone https://github.com/pedropro/TACO.git
    # images are at TACO/data/*.jpg  (use --images-dir TACO/data)

Output structure:
    datasets/taco/
    ├── images/
    │   ├── train/
    │   └── val/
    └── labels/
        ├── train/
        └── val/
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
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    # clamp to [0, 1]
    cx = max(0.0, min(1.0, cx))
    cy = max(0.0, min(1.0, cy))
    nw = max(0.0, min(1.0, nw))
    nh = max(0.0, min(1.0, nh))
    return cx, cy, nw, nh


def main():
    parser = argparse.ArgumentParser(description="Convert TACO → YOLO single-class")
    parser.add_argument("--annotations", required=True, help="Path to TACO annotations.json")
    parser.add_argument("--images-dir", required=True, help="Directory containing TACO images")
    parser.add_argument("--output", default="datasets/taco", help="Output dataset directory")
    parser.add_argument("--val-split", type=float, default=0.2, help="Validation split ratio")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for split")
    args = parser.parse_args()

    random.seed(args.seed)

    with open(args.annotations) as f:
        coco = json.load(f)

    # Build image lookup: id → {file_name, width, height}
    images = {img["id"]: img for img in coco["images"]}

    # Group annotations by image_id
    ann_by_img = {}
    for ann in coco["annotations"]:
        img_id = ann["image_id"]
        ann_by_img.setdefault(img_id, []).append(ann)

    # Only process images that have annotations AND exist on disk
    images_dir = Path(args.images_dir)
    valid_ids = []
    for img_id, img_info in images.items():
        img_path = images_dir / img_info["file_name"]
        if not img_path.exists():
            # TACO stores images in subdirectories sometimes
            # try flat lookup by basename
            img_path = images_dir / Path(img_info["file_name"]).name
        if img_path.exists() and img_id in ann_by_img:
            valid_ids.append((img_id, img_path))

    print(f"Found {len(valid_ids)} images with annotations on disk "
          f"(of {len(images)} total, {len(coco['annotations'])} annotations)")

    if not valid_ids:
        print("ERROR: No images found. Check --images-dir path.")
        print(f"  Looking in: {images_dir}")
        print(f"  Sample file_name from JSON: {coco['images'][0]['file_name']}")
        return

    # Train/val split
    random.shuffle(valid_ids)
    n_val = int(len(valid_ids) * args.val_split)
    val_ids = valid_ids[:n_val]
    train_ids = valid_ids[n_val:]

    # Create output directories
    out = Path(args.output)
    for split in ["train", "val"]:
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)

    stats = {"train": 0, "val": 0, "annotations": 0, "skipped_tiny": 0}

    for split, id_list in [("train", train_ids), ("val", val_ids)]:
        for img_id, img_path in id_list:
            img_info = images[img_id]
            w, h = img_info["width"], img_info["height"]

            # Copy image
            dest_img = out / "images" / split / img_path.name
            if not dest_img.exists():
                shutil.copy2(img_path, dest_img)

            # Write YOLO label file (all classes → 0)
            label_path = out / "labels" / split / (img_path.stem + ".txt")
            lines = []
            for ann in ann_by_img.get(img_id, []):
                bbox = ann.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                # Skip tiny annotations (< 4px in either dimension)
                if bbox[2] < 4 or bbox[3] < 4:
                    stats["skipped_tiny"] += 1
                    continue
                cx, cy, nw, nh = coco_to_yolo_bbox(bbox, w, h)
                # class 0 = litter (all 60 TACO classes collapsed)
                lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
                stats["annotations"] += 1

            with open(label_path, "w") as f:
                f.write("\n".join(lines))

            stats[split] += 1

    print(f"\nDone! Output: {out}")
    print(f"  Train: {stats['train']} images")
    print(f"  Val:   {stats['val']} images")
    print(f"  Annotations converted: {stats['annotations']}")
    print(f"  Skipped (< 4px): {stats['skipped_tiny']}")


if __name__ == "__main__":
    main()
