"""
TrashTrack training pipeline — three experimental runs for ST-04.

Run A: Train on TACO only        → evaluate on TACO val
Run B: Train on merged (all 3)   → evaluate on each val separately
Run C: Train on merged + SAHI    → evaluate on each val separately

Usage (on Colab/Kaggle with GPU):
    python scripts/train.py --run A
    python scripts/train.py --run B
    python scripts/train.py --run all

Results are saved to runs/ and compared in the final evaluation.
"""
import argparse
import subprocess
import sys
from pathlib import Path


CONFIGS = {
    "A": {
        "name": "run_a_taco_only",
        "data": "configs/taco.yaml",
        "desc": "Run A: TACO-only baseline",
    },
    "B": {
        "name": "run_b_merged",
        "data": "configs/merged.yaml",
        "desc": "Run B: Merged (TACO + UAVVaste + RoLID-11K)",
    },
}

EVAL_DATASETS = [
    ("TACO", "configs/taco.yaml"),
    ("UAVVaste", "configs/uavvaste.yaml"),
    ("RoLID-11K", "configs/rolid11k.yaml"),
]

# Match the thresholds from tests/test_privacy_and_thresholds.py
THRESHOLDS = {
    "TACO": 0.45,
    "UAVVaste": 0.35,
    "RoLID-11K": 0.30,
}


def train(run_id: str, model: str = "yolov8s.pt", epochs: int = 100,
          imgsz: int = 640, batch: int = 16):
    cfg = CONFIGS[run_id]
    print(f"\n{'='*60}")
    print(f"  {cfg['desc']}")
    print(f"  Model: {model} | Epochs: {epochs} | ImgSz: {imgsz} | Batch: {batch}")
    print(f"{'='*60}\n")

    cmd = [
        sys.executable, "-m", "ultralytics",
        "detect", "train",
        f"data={cfg['data']}",
        f"model={model}",
        f"epochs={epochs}",
        f"imgsz={imgsz}",
        f"batch={batch}",
        f"name={cfg['name']}",
        "patience=20",          # early stopping
        "save=True",
        "plots=True",
        "verbose=True",
    ]

    # Use yolo CLI directly (more reliable than Python API in scripts)
    cmd = [
        "yolo", "detect", "train",
        f"data={cfg['data']}", f"model={model}",
        f"epochs={epochs}", f"imgsz={imgsz}", f"batch={batch}",
        f"name={cfg['name']}", "patience=20", "save=True", "plots=True",
    ]

    print(f"$ {' '.join(cmd)}\n")
    subprocess.run(cmd, check=True)
    return f"runs/detect/{cfg['name']}/weights/best.pt"


def evaluate(weights: str, run_name: str):
    """Evaluate trained weights on each dataset separately (ST-04)."""
    print(f"\n{'='*60}")
    print(f"  Cross-dataset evaluation: {run_name}")
    print(f"{'='*60}\n")

    for ds_name, ds_config in EVAL_DATASETS:
        if not Path(ds_config).exists():
            print(f"  SKIP {ds_name} — config not found at {ds_config}")
            continue

        print(f"\n--- {ds_name} (target mAP@0.5 ≥ {THRESHOLDS[ds_name]}) ---")

        cmd = [
            "yolo", "detect", "val",
            f"data={ds_config}", f"model={weights}",
            f"name={run_name}_eval_{ds_name.lower().replace('-', '')}",
            "plots=True",
        ]

        print(f"$ {' '.join(cmd)}")
        subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", choices=["A", "B", "all"], default="all")
    parser.add_argument("--model", default="yolov8s.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--eval-only", help="Skip training, just evaluate this weights file")
    args = parser.parse_args()

    runs = [args.run] if args.run != "all" else ["A", "B"]

    for run_id in runs:
        if args.eval_only:
            weights = args.eval_only
        else:
            weights = train(run_id, args.model, args.epochs, args.imgsz, args.batch)

        evaluate(weights, CONFIGS[run_id]["name"])

    print("\n" + "="*60)
    print("  All runs complete! Compare results in runs/detect/")
    print("="*60)
    print("\nSuccess thresholds (from professor feedback):")
    for ds, t in THRESHOLDS.items():
        print(f"  {ds:12s}  mAP@0.5 ≥ {t}")


if __name__ == "__main__":
    main()
