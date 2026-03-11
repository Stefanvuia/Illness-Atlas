"""
Compute top-N related diseases per disease using Jaccard similarity
on binary symptom presence (no API calls needed — pure data computation).

Usage:
    python compute_related_diseases.py

Output:
    Adds a `related_diseases` field to disease_metadata.json (in-place).
    Each entry: {"disease": str, "shared_symptoms": int, "correlation_similarity": float}
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

DATA_DIR   = Path(__file__).parent
CSV_PATH   = DATA_DIR / "Disease_Symptom_Averages.csv"
META_PATH  = DATA_DIR / "disease_metadata.json"
TOP_N      = 10  # related diseases to store per entry


def compute_jaccard_matrix(binary: np.ndarray) -> np.ndarray:
    """
    Vectorised Jaccard similarity for all disease pairs.
    Treats any symptom value > 0 as 'present'.
    Returns an (n, n) float32 matrix with diagonal = 0.
    """
    intersection = binary @ binary.T              # shared symptom counts
    row_sums = binary.sum(axis=1)
    union = row_sums[:, None] + row_sums[None, :] - intersection
    jaccard = np.divide(intersection, union, where=union > 0, out=np.zeros_like(intersection))
    np.fill_diagonal(jaccard, 0.0)               # exclude self-match
    return jaccard


def main():
    print("Loading symptom data …")
    df = pd.read_csv(CSV_PATH, index_col=0)
    diseases = df.index.tolist()
    n = len(diseases)
    vals = df.values.astype(np.float32)
    binary = (vals > 0).astype(np.float32)
    print(f"  {n} diseases × {df.shape[1]} symptoms")

    print("Computing Jaccard similarities (vectorised) …")
    jaccard = compute_jaccard_matrix(binary)

    print("Computing shared symptom counts (vectorised) …")
    shared_counts = (binary @ binary.T).astype(np.int32)  # (n, n)

    print(f"Selecting top-{TOP_N} related diseases + computing correlation similarity …")
    top_indices = np.argsort(jaccard, axis=1)[:, ::-1][:, :TOP_N]

    related_map = {}
    for i in range(n):
        entries = []
        for j in top_indices[i]:
            shared_mask = (binary[i] > 0) & (binary[j] > 0)
            corr_sim = 0.0
            if shared_mask.any():
                vi = vals[i, shared_mask]
                vj = vals[j, shared_mask]
                norm_i = np.linalg.norm(vi)
                norm_j = np.linalg.norm(vj)
                if norm_i > 0 and norm_j > 0:
                    corr_sim = float(np.dot(vi, vj) / (norm_i * norm_j))
            entries.append({
                "disease": diseases[j],
                "shared_symptoms": int(shared_counts[i, j]),
                "correlation_similarity": round(corr_sim, 4),
            })
        related_map[diseases[i]] = entries

    print("Updating disease_metadata.json …")
    with open(META_PATH) as f:
        metadata = json.load(f)

    updated = 0
    for entry in metadata:
        name = entry["disease"]
        if name in related_map:
            entry["related_diseases"] = related_map[name]
            updated += 1
        else:
            entry.setdefault("related_diseases", [])

    with open(META_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Done — updated {updated}/{len(metadata)} entries.")
    print(f"Saved → {META_PATH}")


if __name__ == "__main__":
    main()
