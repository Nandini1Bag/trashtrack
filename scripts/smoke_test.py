"""
Pre-flight smoke test — validate every dataset config before burning GPU hours.

Runs entirely on CPU with no torch/ultralytics required, in a few seconds. It
catches the failures that otherwise surface 20 minutes into a Colab run:
missing directories, unpaired image/label files, corrupt JPEGs, out-of-range
box coordinates, stray class ids, and train/val leakage.

Usage:
    python scripts/smoke_test.py                  # check every config
    python scripts/smoke_test.py --config configs/merged.yaml
    python scripts/smoke_test.py --deep           # also hash every image (slow)

Exit code is 0 only if every check passes, so it can gate a training run:
    python scripts/smoke_test.py && python scripts/train.py --run B
"""
import argparse
import hashlib
import sys
from pathlib import Path

import yaml
from PIL import Image

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}
REPO = Path(__file__).resolve().parent.parent


class Result:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def resolve_split(cfg_path, cfg, split):
    """Ultralytics resolves a relative `path:` against the yaml's own location."""
    base = (cfg_path.parent / cfg["path"]).resolve()
    return (base / cfg[split]).resolve()


def check_split(img_dir, res, label, deep=False):
    """Validate one images/<split> directory and its parallel labels/ dir."""
    if not img_dir.is_dir():
        res.error(f"{label}: image dir missing -> {img_dir}")
        return {}

    lbl_dir = Path(str(img_dir).replace("/images/", "/labels/"))
    if not lbl_dir.is_dir():
        res.error(f"{label}: label dir missing -> {lbl_dir}")
        return {}

    imgs = [f for f in img_dir.iterdir() if f.suffix.lower() in IMG_EXTS]
    if not imgs:
        res.error(f"{label}: no images found in {img_dir}")
        return {}

    hashes = {}
    n_boxes = 0
    missing_lbl = corrupt = bad_box = bad_cls = empty = 0

    for img in imgs:
        lbl = lbl_dir / (img.stem + ".txt")
        if not lbl.exists():
            missing_lbl += 1
            continue

        rows = [r for r in lbl.read_text().splitlines() if r.strip()]
        if not rows:
            empty += 1
        for r in rows:
            parts = r.split()
            if len(parts) < 5:
                bad_box += 1
                continue
            try:
                cid = int(float(parts[0]))
                cx, cy, w, h = (float(v) for v in parts[1:5])
            except ValueError:
                bad_box += 1
                continue
            if cid != 0:
                bad_cls += 1
            if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < w <= 1 and 0 < h <= 1):
                bad_box += 1
            else:
                n_boxes += 1

        if deep:
            try:
                with Image.open(img) as im:
                    im.verify()
            except Exception:
                corrupt += 1
            hashes[hashlib.md5(img.read_bytes()).hexdigest()] = img.name

    orphans = len([f for f in lbl_dir.iterdir() if f.suffix == ".txt"]) - (
        len(imgs) - missing_lbl)

    print(f"    {label:24s} {len(imgs):5d} images  {n_boxes:6d} boxes")
    if missing_lbl:
        res.error(f"{label}: {missing_lbl} images have no label file")
    if orphans > 0:
        res.warn(f"{label}: {orphans} label files have no matching image")
    if bad_box:
        res.error(f"{label}: {bad_box} malformed/out-of-range boxes")
    if bad_cls:
        res.error(f"{label}: {bad_cls} boxes with class id != 0 "
                  f"(configs declare nc: 1)")
    if corrupt:
        res.error(f"{label}: {corrupt} unreadable/corrupt images")
    if empty:
        res.warn(f"{label}: {empty} label files are empty (background negatives)")

    return hashes


def check_config(cfg_path, res, deep=False):
    print(f"\n  {cfg_path.name}")
    cfg = yaml.safe_load(cfg_path.read_text())

    for key in ("path", "train", "val", "nc", "names"):
        if key not in cfg:
            res.error(f"{cfg_path.name}: missing required key '{key}'")
            return

    if cfg["nc"] != len(cfg["names"]):
        res.error(f"{cfg_path.name}: nc={cfg['nc']} but {len(cfg['names'])} names")

    train_dir = resolve_split(cfg_path, cfg, "train")
    val_dir = resolve_split(cfg_path, cfg, "val")

    tr = check_split(train_dir, res, "train", deep)
    if val_dir == train_dir:
        print(f"    {'val':24s} (same as train — per-dataset eval used instead)")
        return
    va = check_split(val_dir, res, "val", deep)

    if deep and tr and va:
        leak = set(tr) & set(va)
        if leak:
            res.error(f"{cfg_path.name}: {len(leak)} identical images in BOTH "
                      f"train and val (e.g. {va[next(iter(leak))]})")
        else:
            print(f"    {'leakage check':24s} clean (0 shared images)")


def main():
    ap = argparse.ArgumentParser(description="Pre-flight dataset validation")
    ap.add_argument("--config", action="append",
                    help="Specific config(s) to check; default = all in configs/")
    ap.add_argument("--deep", action="store_true",
                    help="Also verify image integrity and check train/val leakage")
    args = ap.parse_args()

    configs = ([Path(c) for c in args.config] if args.config
               else sorted((REPO / "configs").glob("*.yaml")))
    if not configs:
        print("No configs found.")
        return 1

    res = Result()
    print("=" * 62)
    print("  TrashTrack pre-flight smoke test")
    print("=" * 62)

    for c in configs:
        if not c.exists():
            res.error(f"config not found: {c}")
            continue
        check_config(c, res, deep=args.deep)

    print("\n" + "=" * 62)
    for w in res.warnings:
        print(f"  WARN   {w}")
    for e in res.errors:
        print(f"  ERROR  {e}")

    if res.errors:
        print(f"\n  FAILED — {len(res.errors)} error(s). Fix before training.")
        return 1
    print(f"\n  PASSED{'' if not res.warnings else f' with {len(res.warnings)} warning(s)'}"
          f" — safe to train.")
    if not args.deep:
        print("  (run with --deep to also verify image integrity + leakage)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
