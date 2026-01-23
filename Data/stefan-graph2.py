import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

# 1. Load Data
# (Same loading logic as before)
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, 'Disease_Symptom_Averages.csv')
df = pd.read_csv(csv_path)

if 'diseases' in df.columns:
    df.set_index('diseases', inplace=True)

# 2. Map Symptoms to Body Parts
body_parts_map = {
    'Head': ['head', 'eye', 'ear', 'nose', 'throat', 'mouth', 'vision', 'dizziness', 'mental', 'depression', 'anxiety'],
    'Chest': ['chest', 'breath', 'heart', 'lung', 'cough', 'rib'],
    'Abdomen': ['abdominal', 'stomach', 'vomit', 'nausea', 'bowel', 'liver', 'kidney', 'pelvic'],
    'Arm': ['arm', 'hand', 'wrist', 'elbow', 'shoulder'],
    'Leg': ['leg', 'knee', 'foot', 'toe', 'ankle', 'hip']
}

part_df = pd.DataFrame(index=df.index, columns=body_parts_map.keys()).fillna(0.0)

for part, keywords in body_parts_map.items():
    cols = [c for c in df.columns if any(k in c.lower() for k in keywords)]
    if cols:
        part_df[part] = df[cols].sum(axis=1)

# 3. Select 'Fibromyalgia'
target_disease = 'fibromyalgia'
scores = part_df.loc[target_disease]

# Normalize scores 0-1
max_val = scores.max() if scores.max() > 0 else 1
norm_scores = {k: v / max_val for k, v in scores.items()}

# 4. Draw with Labels
fig, ax = plt.subplots(figsize=(6, 10))
ax.set_xlim(0, 10)
ax.set_ylim(0, 12)
ax.axis('off')

cmap = plt.cm.YlOrRd
def get_color(part):
    return cmap(norm_scores.get(part, 0))

# Helper to draw and label
def draw_part(patch, label, x_label, y_label):
    ax.add_patch(patch)
    ax.text(x_label, y_label, label, ha='center', va='center', fontsize=10, fontweight='bold')

# Draw Parts
draw_part(patches.Circle((5, 10), 1, color=get_color('Head')), 'Head', 5, 10)
draw_part(patches.Rectangle((3.5, 6.5), 3, 2.3, color=get_color('Chest')), 'Chest', 5, 7.65)
draw_part(patches.Rectangle((3.5, 4.0), 3, 2.5, color=get_color('Abdomen')), 'Abdomen', 5, 5.25)
draw_part(patches.FancyBboxPatch((1.2, 5.5), 2.3, 0.8, boxstyle="round,pad=0.1", color=get_color('Arm')), 'Arm', 2.35, 5.9)
draw_part(patches.FancyBboxPatch((6.5, 5.5), 2.3, 0.8, boxstyle="round,pad=0.1", color=get_color('Arm')), 'Arm', 7.65, 5.9)
draw_part(patches.FancyBboxPatch((3.5, 0.5), 1.2, 3.5, boxstyle="round,pad=0.1", color=get_color('Leg')), 'Leg', 4.1, 2.25)
draw_part(patches.FancyBboxPatch((5.3, 0.5), 1.2, 3.5, boxstyle="round,pad=0.1", color=get_color('Leg')), 'Leg', 5.9, 2.25)

# Colorbar
sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(vmin=0, vmax=max_val))
sm.set_array([])
cbar = plt.colorbar(sm, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label('Symptom Severity', rotation=270, labelpad=15)

plt.title(f"Symptom Heatmap: {target_disease.title()}", fontsize=14)
plt.tight_layout()
plt.show()