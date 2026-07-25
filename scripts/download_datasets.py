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
3. SIH garbage_best (street-level piles & bags, YOLOv8 format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Download the YOLOv8 export (CC BY 4.0) from Roboflow Universe:
      https://universe.roboflow.com/smart-india-hackathon-2023/garbage_best/dataset/1

    Unzip it to data/smart-india-hackathon_raw/ so it looks like:
      data/smart-india-hackathon_raw/{train,valid,test}/{images,labels}/

    # Convert. The raw export ships 2,480 files but only 1,548 unique images,
    # and byte-identical copies straddle its train/valid/test splits — so the
    # converter deduplicates by MD5 and re-splits rather than trusting them.
    python scripts/convert_sih.py \\
        --raw-dir data/smart-india-hackathon_raw \\
        --output datasets/sih

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
    ├── sih/          (same structure)
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
