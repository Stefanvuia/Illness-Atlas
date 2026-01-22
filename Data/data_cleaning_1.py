import pandas as pd

def compress_disease_symptoms(
    input_csv="Diseases_and_Symptoms.csv",
    output_csv="Disease_Symptom_Averages.csv"
):
    # Load dataset
    df = pd.read_csv(input_csv)

    # Check required column
    if "diseases" not in df.columns:
        raise ValueError("Expected a 'diseases' column in the dataset")

    # Identify symptom columns (everything except disease name)
    symptom_columns = [col for col in df.columns if col != "diseases"]

    # Convert symptom columns to numeric (safety)
    df[symptom_columns] = df[symptom_columns].apply(pd.to_numeric, errors="coerce")

    # Group by disease and average symptoms
    disease_avg = (
        df
        .groupby("diseases")[symptom_columns]
        .mean()
        .reset_index()
    )

    # Save result
    disease_avg.to_csv(output_csv, index=False)

    print("✅ Dataset successfully compressed")
    print(f"Unique diseases: {disease_avg.shape[0]}")
    print(f"Symptoms per disease: {len(symptom_columns)}")
    print(f"Saved to: {output_csv}")


if __name__ == "__main__":
    compress_disease_symptoms()
