#!/usr/bin/env python3
"""2D map of the face-embedding space: t-SNE projection coloured by cluster,
the biggest islands labelled at their centroids. Reads vectors.json +
analysis.json written by scripts/analyze-corpus.ts. Output: a PNG to view.

Usage: DATA_DIR=scotland/volumes python python/plot_map.py
"""
import json
import os
import collections
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

DATA = os.environ.get("DATA_DIR", "scotland/volumes")
vec = json.load(open(os.path.join(DATA, "vectors.json")))
ana = json.load(open(os.path.join(DATA, "analysis.json")))

ids = vec["ids"]
X = np.array(vec["vecs"], dtype=np.float32)
cluster_of = ana["clusterOf"]
labels = {int(k): v for k, v in ana["clusterLabels"].items()}
c = np.array([cluster_of[i] for i in ids])

print(f"t-SNE on {X.shape[0]} points…")
xy = TSNE(n_components=2, perplexity=30, init="pca", metric="cosine",
          random_state=42).fit_transform(X)

# Dark theme.
plt.rcParams.update({"figure.facecolor": "#0b0b0d", "axes.facecolor": "#0b0b0d",
                     "savefig.facecolor": "#0b0b0d"})
fig, ax = plt.subplots(figsize=(15, 11))
ax.scatter(xy[:, 0], xy[:, 1], c=c, cmap="tab20", s=14, alpha=0.85, linewidths=0)
ax.set_xticks([]); ax.set_yticks([])
for sp in ax.spines.values():
    sp.set_visible(False)

# Label the larger islands at their 2D centroid (shorten the probe text).
sizes = collections.Counter(c.tolist())
for j, n in sizes.items():
    if n < 45:
        continue
    cx, cy = xy[c == j].mean(axis=0)
    txt = labels.get(j, "").replace("an 1840s ", "").replace("a ", "")
    ax.text(cx, cy, f"{txt}\n({n})", color="#f2efe9", fontsize=11,
            ha="center", va="center", weight="bold",
            bbox=dict(boxstyle="round,pad=0.3", fc="#000000aa", ec="#d8c3a5", lw=0.8))

ax.set_title("Feeling Scotland — embedding-space map of 1,705 faces  ·  islands by medium / role / pose",
             color="#bdb7ac", fontsize=14, pad=16)
out = os.path.join(DATA, "..", "analysis-map.png")
plt.tight_layout()
plt.savefig(out, dpi=110, bbox_inches="tight")
print("wrote", os.path.abspath(out))
