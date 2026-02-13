import pandas as pd

# -----------------------------
# CONFIG
# -----------------------------
SYMPTOMS_FILE = "Data/symptoms.csv"
DISEASE_FILE = "Data/Disease_Symptom_Averages.csv"

OUTPUT_COVERAGE = "Data/bodily_system_coverage.csv"
OUTPUT_MISSING = "Data/missing_symptoms.csv"
OUTPUT_MATCHED = "Data/matched_symptoms.csv"

# -----------------------------
# HELPERS
# -----------------------------
def normalize(text):
    """
    Normalize text so column comparisons are consistent.
    """
    return (
        str(text)
        .lower()
        .strip()
        .replace(" ", "_")
        .replace("-", "_")
    )

# -----------------------------
# LOAD DATA
# -----------------------------
print("Loading CSV files...")
symptoms_df = pd.read_csv(SYMPTOMS_FILE)
disease_df = pd.read_csv(DISEASE_FILE)

print(f"Loaded {len(symptoms_df)} symptoms")
print(f"Disease dataset columns: {len(disease_df.columns)}")

# -----------------------------
# NORMALIZE NAMES
# -----------------------------
print("Normalizing names...")

symptoms_df["symptom_norm"] = symptoms_df["symptom"].apply(normalize)

# Map normalized column -> original column name
disease_columns_norm = {
    normalize(col): col for col in disease_df.columns
}

# -----------------------------
# EXISTENCE CHECK
# -----------------------------
print("Checking symptom existence in disease dataset...")

symptoms_df["exists_in_disease_csv"] = symptoms_df["symptom_norm"].isin(
    disease_columns_norm
)

# Split matched / missing
matched_df = symptoms_df[symptoms_df["exists_in_disease_csv"]].copy()
missing_df = symptoms_df[~symptoms_df["exists_in_disease_csv"]].copy()

print(f"Matched symptoms: {len(matched_df)}")
print(f"Missing symptoms: {len(missing_df)}")

# -----------------------------
# GROUP BY BODILY SYSTEM
# -----------------------------
print("Grouping by bodily system...")

system_counts = (
    symptoms_df
    .groupby("bodily_system")
    .size()
    .reset_index(name="total_symptoms")
    .sort_values("total_symptoms", ascending=False)
)

print("\nTotal Symptoms per Bodily System:")
print(system_counts)

# -----------------------------
# COVERAGE STATS
# -----------------------------
system_coverage = (
    symptoms_df
    .groupby("bodily_system")
    .agg(
        total_symptoms=("symptom", "count"),
        present_in_disease_csv=("exists_in_disease_csv", "sum")
    )
)

system_coverage["coverage_ratio"] = (
    system_coverage["present_in_disease_csv"]
    / system_coverage["total_symptoms"]
)

system_coverage = system_coverage.sort_values(
    "coverage_ratio", ascending=False
)

print("\nCoverage by Bodily System:")
print(system_coverage)

# -----------------------------
# MISSING BY SYSTEM
# -----------------------------
missing_by_system = (
    missing_df
    .groupby("bodily_system")["symptom"]
    .apply(list)
)

print("\nMissing Symptoms by System:")
print(missing_by_system)

# -----------------------------
# SAVE OUTPUTS
# -----------------------------
print("\nSaving output files...")

system_coverage.to_csv(OUTPUT_COVERAGE)
missing_df.to_csv(OUTPUT_MISSING, index=False)
matched_df.to_csv(OUTPUT_MATCHED, index=False)

print("Done!")
print(f"- Coverage report: {OUTPUT_COVERAGE}")
print(f"- Missing symptoms: {OUTPUT_MISSING}")
print(f"- Matched symptoms: {OUTPUT_MATCHED}")

# -----------------------------
# UNIQUE BODILY SYSTEMS
# -----------------------------
all_systems = sorted(set(
    system.strip()
    for entry in symptoms_df["bodily_system"].dropna()
    for system in entry.split(",")
))

print(f"\nAll {len(all_systems)} unique bodily systems:")
for s in all_systems:
    print(f"  - {s}")
