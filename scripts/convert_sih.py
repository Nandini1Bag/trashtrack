"""
Convert SIH garbage_best (Roboflow YOLOv8) → YOLO single-class, deduplicated.

Source: https://universe.roboflow.com/smart-india-hackathon-2023/garbage_best/dataset/1
License: CC BY 4.0

The raw export ships 2,480 files but only 1,548 unique images — the same photo
was uploaded several times, and byte-identical copies straddle Roboflow's own
train/valid/test splits (14 train∩valid, 2 train∩test, 78 valid∩test). Using
those splits as-is leaks training images into validation.

This script therefore ignores the provided splits entirely: it pools all three,
keeps one copy per MD5, and re-splits the unique set. Because dedup happens
before splitting, an image cannot appear on both sides.

All 6 source classes ('0', 'c', 'garbage', 'garbage_bag', 'sampah-detection',
'trash') collapse to class 0 = litter, matching TACO and UAVVaste.

Usage:
    python scripts/convert_sih.py \
        --raw-dir data/smart-india-hackathon_raw \
        --output datasets/sih \
        --val-split 0.2
"""
import argparse
import hashlib
import random
import shutil
from pathlib import Path


IMG_EXTS = {".jpg", ".jpeg", ".png"}
SPLITS_IN = ["train", "valid", "test"]


def md5(path):
    return hashlib.md5(path.read_bytes()).hexdigest()


def read_boxes(label_path):
    """Parse a YOLO label file, collapsing every class to 0 and dropping
    malformed or out-of-range rows."""
    boxes, bad = [], 0
    if not label_path.exists():
        return boxes, bad
    for line in label_path.read_text().splitlines():
        parts = line.split()
        if len(parts) < 5:
            if line.strip():
                bad += 1
            continue
        try:
            cx, cy, w, h = (float(v) for v in parts[1:5])
        except ValueError:
            bad += 1
            continue
        if not (0 < w <= 1 and 0 < h <= 1) or not (0 <= cx <= 1 and 0 <= cy <= 1):
            bad += 1
            continue
        boxes.append(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    return boxes, bad


def main():
    parser = argparse.ArgumentParser(description="Convert SIH garbage_best → YOLO single-class")
    parser.add_argument("--raw-dir", default="data/smart-india-hackathon_raw")
    parser.add_argument("--output", default="datasets/sih")
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--keep-empty", action="store_true",
                        help="Keep images with no boxes as background negatives")
    args = parser.parse_args()

    raw = Path(args.raw_dir)
    out = Path(args.output)

    # ---- Pool every split and deduplicate by image content --------------
    seen = {}          # md5 -> (image_path, label_path)
    n_files = 0
    dup_files = 0

    for split in SPLITS_IN:
        img_dir = raw / split / "images"
        lbl_dir = raw / split / "labels"
        if not img_dir.exists():
            continue
        # sorted() keeps the choice of surviving copy deterministic
        for img in sorted(img_dir.iterdir()):
            if img.suffix.lower() not in IMG_EXTS:
                continue
            n_files += 1
            digest = md5(img)
            if digest in seen:
                dup_files += 1
                continue
            seen[digest] = (img, lbl_dir / (img.stem + ".txt"))

    print(f"Scanned {n_files} files across {SPLITS_IN}")
    print(f"  duplicate copies discarded: {dup_files}")
    print(f"  unique images kept:         {len(seen)}")

    # ---- Load labels, drop empties unless asked otherwise ---------------
    records, empty, malformed = [], 0, 0
    for digest, (img, lbl) in seen.items():
        boxes, bad = read_boxes(lbl)
        malformed += bad
        if not boxes and not args.keep_empty:
            empty += 1
            continue
        records.append((digest, img, boxes))

    print(f"  images with no boxes:       {empty} ({'kept' if args.keep_empty else 'skipped'})")
    if malformed:
        print(f"  malformed boxes dropped:    {malformed}")

    # ---- Split the unique set ------------------------------------------
    # Sort by digest first so the shuffle is reproducible regardless of
    # filesystem iteration order.
    records.sort(key=lambda r: r[0])
    random.seed(args.seed)
    random.shuffle(records)

    n_val = int(len(records) * args.val_split)
    splits = {"val": records[:n_val], "train": records[n_val:]}

    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)

    used_names = set()
    total_boxes = 0

    for split, rows in splits.items():
        for digest, img, boxes in rows:
            # Distinct images can still share a base name; disambiguate with
            # a digest prefix so nothing overwrites anything.
            stem = img.stem
            if stem in used_names:
                stem = f"{stem}_{digest[:8]}"
            used_names.add(stem)

            shutil.copy2(img, out / "images" / split / (stem + img.suffix.lower()))
            (out / "labels" / split / (stem + ".txt")).write_text("\n".join(boxes) + "\n")
            total_boxes += len(boxes)

        print(f"  {split}: {len(rows)} images")

    print(f"\nTotal boxes written: {total_boxes}")
    print(f"Done! Converted dataset at: {out}")


if __name__ == "__main__":
    main()
