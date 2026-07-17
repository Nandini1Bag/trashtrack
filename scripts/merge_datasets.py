"""
Merge converted datasets into a single training set with per-dataset validation.

Usage:
    python scripts/merge_datasets.py --output datasets/merged

Expects the three converted datasets at:
    datasets/taco/
    datasets/uavvaste/
    datasets/rolid11k/

Creates:
    datasets/merged/
    ├── images/
    │   └── train/          ← all three train sets combined
    └── labels/
        └── train/

Validation stays per-dataset (not merged) — you evaluate on each separately
for the ST-04 generalization benchmark.

Also generates the YOLO .yaml configs for training.
"""
import argparse
import os
import shutil
from pathlib import Path


DATASETS = ["taco", "uavvaste", "rolid11k"]


def main():
    parser = argparse.ArgumentParser(description="Merge datasets for training")
    parser.add_argument("--datasets-dir", default="datasets",
                        help="Parent dir containing taco/, uavvaste/, rolid11k/")
    parser.add_argument("--output", default="datasets/merged")
    parser.add_argument("--symlink", action="store_true",
                        help="Use symlinks instead of copying (saves disk space)")
    args = parser.parse_args()

    base = Path(args.datasets_dir)
    out = Path(args.output)
    (out / "images" / "train").mkdir(parents=True, exist_ok=True)
    (out / "labels" / "train").mkdir(parents=True, exist_ok=True)

    total = 0
    per_dataset = {}

    for ds in DATASETS:
        ds_path = base / ds
        if not ds_path.exists():
            print(f"  SKIP {ds} — not found at {ds_path}")
            continue

        train_imgs = ds_path / "images" / "train"
        train_lbls = ds_path / "labels" / "train"

        if not train_imgs.exists():
            print(f"  SKIP {ds} — no train split found")
            continue

        count = 0
        for img in sorted(train_imgs.iterdir()):
            if img.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp"}:
                continue
            lbl = train_lbls / (img.stem + ".txt")
            if not lbl.exists():
                continue

            # Prefix filename with dataset name to avoid collisions
            new_name = f"{ds}_{img.name}"
            new_lbl_name = f"{ds}_{img.stem}.txt"

            dst_img = out / "images" / "train" / new_name
            dst_lbl = out / "labels" / "train" / new_lbl_name

            if args.symlink:
                if not dst_img.exists():
                    dst_img.symlink_to(img.resolve())
                if not dst_lbl.exists():
                    dst_lbl.symlink_to(lbl.resolve())
            else:
                if not dst_img.exists():
                    shutil.copy2(img, dst_img)
                if not dst_lbl.exists():
                    shutil.copy2(lbl, dst_lbl)

            count += 1

        per_dataset[ds] = count
        total += count
        print(f"  {ds}: {count} training images merged")

    print(f"\nTotal merged training images: {total}")
    print(f"\nValidation sets remain per-dataset for ST-04 evaluation:")
    for ds in DATASETS:
        val_path = base / ds / "images" / "val"
        if val_path.exists():
            n = len([f for f in val_path.iterdir()
                     if f.suffix.lower() in {".jpg", ".jpeg", ".png"}])
            print(f"  {ds} val: {n} images → {val_path}")
        else:
            print(f"  {ds} val: not found")

    print(f"\nDone! Merged dataset at: {out}")


if __name__ == "__main__":
    main()
