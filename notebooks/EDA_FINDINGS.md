# TrashTrack EDA — Findings (TACO)

Run on the real TACO annotation set: **1,500 images · 4,784 annotations · 60 classes · 28 supercategories.**

## 1. Severe class imbalance
- Most common class **Cigarette (667)**; rarest **Carded blister pack (1)** → **imbalance ratio ≈ 667:1**.
- **25 of 59** labelled classes have **< 20 instances** — too few to learn reliably as separate classes.
- The **top 5 classes hold 45.8%** of all annotations.

**Implication:** don't try to learn 60 fine-grained classes first. Start by collapsing to a single `litter` class (or a handful of supercategories) for the first fine-tune, then use focal loss / class-balanced sampling if you reintroduce granularity. This directly addresses the "class imbalance → lower accuracy" risk in §11.

## 2. Objects are small — this is the defining challenge
- **Median bounding box is 0.35% of the image area.**
- **67.2%** of objects occupy **< 1%** of the image; **33.8%** are **< 0.1%**.
- COCO buckets by pixel area: 383 small / 1,306 medium / 3,095 large — but "large" is inflated by a few close-up shots; the *relative* size tells the real story.

**Implication:** train at high input resolution and/or **tile** large images before detection; use small anchors. This is the "small objects → lower accuracy" risk in §11, and it's why the pretrained-YOLO baseline found nothing (§12).

## 3. Density & resolution
- **Mean 3.19 objects/image** (median 2, max 90) — multi-object scenes are normal.
- **Median source image ≈ 2448 × 3264 px** (up to 6000 × 5312). Feeding these to a 640px model destroys small objects → **tiling is not optional for TACO.**

## 4. What to do next (before P2 fine-tuning)
1. Convert TACO to a single-class YOLO dataset; verify the collapse with this notebook.
2. Run the **same notebook on UAVVaste** (aerial — expect even smaller objects) and **RoLID-11K** (dashcam — expect motion blur, wide aspect ratios). Compare the three size distributions; that comparison is the backbone of your ST-04 generalization story.
3. Decide tile size from the size distribution (e.g. 640px tiles with overlap) rather than guessing.

Charts: `fig1_class_imbalance.png`, `fig2_supercategory.png`, `fig3_object_size.png`, `fig4_sizes_and_density.png`.
