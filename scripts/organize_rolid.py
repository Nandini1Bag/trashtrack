"""
Organize RoLID-11K into our standard train/val structure.

RoLID-11K is already in YOLO format (one .txt per image, class 0).
This script just copies into our directory layout and applies a train/val split
if the dataset doesn't already have one.

Usage:
    python scripts/organize_rolid.py \
        --images-dir data/rolid11k/images \
        --labels-dir data/rolid11k/labels \
        --output datasets/rolid11k \
        --val-split 0.2

Download RoLID-11K from: https://github.com/xq141839/RoLID-11K
"""
import argparse
import os
import random
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Organize RoLID-11K into train/val")
    parser.add_argument("--images-dir", required=True, help="Dir with RoLID images")
    parser.add_argument("--labels-dir", required=True, help="Dir with RoLID YOLO .txt labels")
    parser.add_argument("--output", default="datasets/rolid11k")
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    # If RoLID already has train/val/test dirs, use this flag
    parser.add_argument("--already-split", action="store_true",
                        help="Set if RoLID already has train/val subdirs")
    args = parser.parse_args()

    random.seed(args.seed)
    out = Path(args.output)

    if args.already_split:
        # Just copy the existing split structure
        for split in ["train", "val", "test"]:
            src_imgs = Path(args.images_dir) / split
            src_lbls = Path(args.labels_dir) / split
            if not src_imgs.exists():
                continue
            dst_split = "val" if split == "test" else split  # merge test → val
            (out / "images" / dst_split).mkdir(parents=True, exist_ok=True)
            (out / "labels" / dst_split).mkdir(parents=True, exist_ok=True)

            count = 0
            for img in src_imgs.iterdir():
                if img.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                    continue
                lbl = src_lbls / (img.stem + ".txt")
                if not lbl.exists():
                    continue
                shutil.copy2(img, out / "images" / dst_split / img.name)
                shutil.copy2(lbl, out / "labels" / dst_split / (img.stem + ".txt"))
                count += 1
            print(f"  {split} → {dst_split}: {count} images")
        print(f"\nDone! Output: {out}")
        return

    # Flat directory — apply our own split
    images_dir = Path(args.images_dir)
    labels_dir = Path(args.labels_dir)

    pairs = []
    for img in sorted(images_dir.iterdir()):
        if img.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        lbl = labels_dir / (img.stem + ".txt")
        if lbl.exists():
            pairs.append((img, lbl))

    print(f"Found {len(pairs)} image-label pairs")
    if not pairs:
        print("ERROR: No matching image-label pairs found.")
        return

    random.shuffle(pairs)
    n_val = int(len(pairs) * args.val_split)
    splits = {"val": pairs[:n_val], "train": pairs[n_val:]}

    for split in ["train", "val"]:
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)

    for split, split_pairs in splits.items():
        for img, lbl in split_pairs:
            shutil.copy2(img, out / "images" / split / img.name)
            shutil.copy2(lbl, out / "labels" / split / lbl.name)
        print(f"  {split}: {len(split_pairs)} images")

    print(f"\nDone! Output: {out}")


if __name__ == "__main__":
    main()
