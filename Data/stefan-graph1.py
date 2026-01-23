import pandas as pd
import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity
import itertools
import os

# 1. Load Data (Robust Path)
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, 'Disease_Symptom_Averages.csv')
df = pd.read_csv(csv_path)

if 'diseases' in df.columns:
    df.set_index('diseases', inplace=True)

# 2. Select Subset
target_disease = 'pneumonia'

if target_disease in df.index:
    seed_vector = df.loc[target_disease].fillna(0).values.reshape(1, -1)
    all_vectors = df.fillna(0).values
    sim_scores = cosine_similarity(seed_vector, all_vectors)[0]
    top_indices = np.argsort(sim_scores)[::-1][:6]
    subset_diseases = df.index[top_indices].tolist()
else:
    subset_diseases = df.index[:6].tolist()

print(f"Visualizing: {subset_diseases}")

# 3. Build Graph
G = nx.Graph()
for d in subset_diseases:
    G.add_node(d)

edge_labels = {}

for d1, d2 in itertools.combinations(subset_diseases, 2):
    v1 = df.loc[d1].fillna(0).values
    v2 = df.loc[d2].fillna(0).values
    
    # Calculate Similarity
    sim = cosine_similarity([v1], [v2])[0][0]
    
    if sim > 0.4:
        G.add_edge(d1, d2, weight=sim)
        
        # Find Top Shared Symptom
        product = v1 * v2
        top_symptom_idx = np.argmax(product)
        top_symptom_name = df.columns[top_symptom_idx]
        
        # Create Label: Symptom Name + Similarity Score
        # "Sim" acts as the "distance/strength" indicator
        label_text = f"{top_symptom_name}\n(Sim: {sim:.2f})"
        edge_labels[(d1, d2)] = label_text

# 4. Visualize
plt.figure(figsize=(12, 10))
pos = nx.spring_layout(G, k=1.5, weight='weight', seed=42)

# Draw Nodes
nx.draw_networkx_nodes(G, pos, node_size=3000, node_color='#A0CBE2', edgecolors='black')

# Draw Edges
weights = [G[u][v]['weight'] * 5 for u, v in G.edges()]
nx.draw_networkx_edges(G, pos, width=weights, edge_color='gray', alpha=0.5)

# Draw Labels
nx.draw_networkx_labels(G, pos, font_size=10, font_weight='bold')
nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=8, font_color='red')

plt.title(f"Disease Similarity Network (Seed: {target_disease.title()})", fontsize=14)
plt.axis('off')
plt.tight_layout()
plt.show()