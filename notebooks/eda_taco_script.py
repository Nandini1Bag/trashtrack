import json, os
import numpy as np
import pandas as pd

os.makedirs("eda_out", exist_ok=True)
d = json.load(open("data/taco_annotations.json"))

# ---- Build dataframes ----
images = pd.DataFrame(d["images"])
anns   = pd.DataFrame(d["annotations"])
cats   = pd.DataFrame(d["categories"])

print("=== DATASET SHAPE ===")
print(f"images: {len(images)}  annotations: {len(anns)}  categories: {len(cats)}")
print(f"supercategories: {cats['supercategory'].nunique()}")

# ---- Map category + supercategory onto annotations ----
cat_map   = dict(zip(cats.id, cats.name))
super_map = dict(zip(cats.id, cats.supercategory))
anns["cat_name"]   = anns["category_id"].map(cat_map)
anns["supercat"]   = anns["category_id"].map(super_map)

# bbox = [x, y, w, h]
bb = np.array(anns["bbox"].tolist(), dtype=float)
anns["bw"] = bb[:,2]; anns["bh"] = bb[:,3]
anns["bbox_area"] = anns["bw"] * anns["bh"]

# image dims for relative-size (small object) analysis
img_dims = images.set_index("id")[["width","height"]]
anns = anns.join(img_dims, on="image_id")
anns["img_area"] = anns["width"] * anns["height"]
anns["rel_area"] = anns["bbox_area"] / anns["img_area"]
anns["rel_area_pct"] = anns["rel_area"] * 100

# COCO size buckets by absolute pixel area of the bbox
def coco_bucket(a):
    if a < 32**2: return "small (<32^2 px)"
    if a < 96**2: return "medium (32-96^2 px)"
    return "large (>96^2 px)"
anns["size_bucket"] = anns["bbox_area"].apply(coco_bucket)

# ---- 1. Class imbalance ----
cls_counts = anns["cat_name"].value_counts()
super_counts = anns["supercat"].value_counts()
print("\n=== TOP 10 CLASSES (of 60) ===")
print(cls_counts.head(10).to_string())
print("\n=== BOTTOM 10 CLASSES ===")
print(cls_counts.tail(10).to_string())
imbalance_ratio = cls_counts.max() / cls_counts.min()
print(f"\nImbalance ratio (most:least common class) = {imbalance_ratio:.0f} : 1")
print(f"Classes with < 20 instances: {(cls_counts < 20).sum()} of {len(cls_counts)}")
print(f"Top 5 classes hold {cls_counts.head(5).sum()/cls_counts.sum()*100:.1f}% of all annotations")

# ---- 2. Small-object analysis ----
print("\n=== OBJECT SIZE (COCO buckets, by bbox pixel area) ===")
print(anns["size_bucket"].value_counts().to_string())
print(f"\nMedian bbox as % of image area: {anns['rel_area_pct'].median():.3f}%")
print(f"Share of objects < 1% of image area: {(anns['rel_area_pct']<1).mean()*100:.1f}%")
print(f"Share of objects < 0.1% of image area: {(anns['rel_area_pct']<0.1).mean()*100:.1f}%")

# ---- 3. Annotations per image ----
per_img = anns.groupby("image_id").size()
# include images with zero annotations
all_img_ids = set(images["id"])
zero = len(all_img_ids - set(per_img.index))
print("\n=== ANNOTATIONS PER IMAGE ===")
print(f"mean: {per_img.mean():.2f}  median: {per_img.median():.0f}  max: {per_img.max()}")
print(f"images with 0 litter annotations: {zero}")

# ---- 4. Image resolution ----
print("\n=== IMAGE RESOLUTION ===")
print(f"width  min/median/max: {images.width.min()}/{images.width.median():.0f}/{images.width.max()}")
print(f"height min/median/max: {images.height.min()}/{images.height.median():.0f}/{images.height.max()}")

# ---- Save summary tables ----
cls_counts.to_csv("eda_out/class_counts.csv", header=["count"])
super_counts.to_csv("eda_out/supercategory_counts.csv", header=["count"])
anns[["cat_name","supercat","bbox_area","rel_area_pct","size_bucket"]].describe(include="all").to_csv("eda_out/summary_stats.csv")

# persist for plotting
anns.to_pickle("eda_out/annotations_enriched.pkl")
images.to_pickle("eda_out/images.pkl")
print("\nSaved tables to eda_out/")
