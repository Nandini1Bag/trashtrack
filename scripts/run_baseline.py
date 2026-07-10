"""
Reproduce the §12 baseline: run an UNMODIFIED pretrained YOLOv8n over a folder
of TACO images and count litter detections. On general-purpose weights this is
expected to be ~0 useful litter detections -- the gap fine-tuning (P2) closes.

    python scripts/run_baseline.py --images sample_data/ --weights yolov8n.pt
"""
import argparse, glob, os
from trashtrack.detection import YoloDetector
from trashtrack.ingestion import load_image_file

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--weights", default="yolov8n.pt")
    ap.add_argument("--conf", type=float, default=0.25)
    args = ap.parse_args()

    det = YoloDetector(weights=args.weights, confidence=args.conf)
    paths = sorted(glob.glob(os.path.join(args.images, "*.jpg")) +
                   glob.glob(os.path.join(args.images, "*.png")))
    total, litter = 0, 0
    for p in paths:
        image, arr = load_image_file(p)
        dets = det.detect(image, arr)
        total += len(dets)
        litter += sum(1 for d in dets if d.class_label.lower() == "litter")
        print(f"{os.path.basename(p):40s} detections={len(dets):3d} "
              f"classes={sorted({d.class_label for d in dets})}")
    print(f"\n{len(paths)} images | {total} total boxes | {litter} labelled 'litter'")

if __name__ == "__main__":
    main()
