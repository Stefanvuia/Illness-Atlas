import wikipediaapi
import pandas as pd
import time

wiki = wikipediaapi.Wikipedia(
    language='en',
    user_agent='IllnessAtlas (student project)'
)

df = pd.read_csv("Disease_Symptom_Averages.csv")

results = []

for disease in df["diseases"]:
    print(f"Fetching data for: {disease}")
    page = wiki.page(disease.title())

    if page.exists():
        results.append({
            "disease": disease,
            "description": page.summary[:800],
            "url": page.fullurl
        })
    else:
        results.append({
            "disease": disease,
            "description": None,
            "url": None
        })

    time.sleep(0.2)  # be polite

pd.DataFrame(results).to_json(
    "disease_metadata.json",
    orient="records",
    indent=2
)
