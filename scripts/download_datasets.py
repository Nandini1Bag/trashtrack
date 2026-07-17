"""
Download and prepare all three datasets.

This script prints exact commands for each dataset since they each
require different download methods (git clone, Kaggle, GitHub releases).

Usage:
    python scripts/download_datasets.py
"""


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           TrashTrack — Dataset Download Guide               ║
╚══════════════════════════════════════════════════════════════╝

Run these commands from the project root (where README.md is).
Create a data/ directory first:

    mkdir -p data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. TACO (street-level, 1,500 images, COCO format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    cd data
    git clone https://github.com/pedropro/TACO.git taco_raw
    cd ..

    # Annotations: data/taco_raw/data/annotations.json
    # Images:      data/taco_raw/data/*.jpg
    # Download images (TACO stores them via LFS / download script):
    cd data/taco_raw
    python download.py
    cd ../..

    # Convert:
    python scripts/convert_taco.py \\
        --annotations data/taco_raw/data/annotations.json \\
        --images-dir data/taco_raw/data \\
        --output datasets/taco

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. UAVVaste (drone/aerial, 772 images, COCO format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    cd data
    git clone https://github.com/UAVVaste/UAVVaste.git uavvaste_raw
    cd ..

    # Convert:
    python scripts/convert_uavvaste.py \\
        --annotations data/uavvaste_raw/annotations.json \\
        --images-dir data/uavvaste_raw/images \\
        --output datasets/uavvaste

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. RoLID-11K (dashcam, 11,000+ images, already YOLO format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    cd data
    git clone https://github.com/xq141839/RoLID-11K.git rolid11k_raw
    cd ..

    # Check the repo structure — may have train/val/test splits already.
    # If already split:
    python scripts/organize_rolid.py \\
        --images-dir data/rolid11k_raw/images \\
        --labels-dir data/rolid11k_raw/labels \\
        --output datasets/rolid11k \\
        --already-split

    # If flat (no subdirs):
    python scripts/organize_rolid.py \\
        --images-dir data/rolid11k_raw/images \\
        --labels-dir data/rolid11k_raw/labels \\
        --output datasets/rolid11k

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. Merge all three for training
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    python scripts/merge_datasets.py --output datasets/merged --symlink

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. Verify everything
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all conversions, you should have:

    datasets/
    ├── taco/         (images/train, images/val, labels/train, labels/val)
    ├── uavvaste/     (same structure)
    ├── rolid11k/     (same structure)
    └── merged/       (images/train, labels/train — all combined)

Quick sanity check:
    find datasets -name "*.txt" -path "*/labels/*" | wc -l   # total label files
    find datasets -name "*.jpg" -path "*/images/*" | wc -l   # total images

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. Train
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # Run A: TACO-only baseline
    python scripts/train.py --run A --epochs 100

    # Run B: Merged training + per-dataset eval
    python scripts/train.py --run B --epochs 100

    # Or both:
    python scripts/train.py --run all
""")


if __name__ == "__main__":
    main()
