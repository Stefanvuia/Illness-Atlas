"""
Augment disease_metadata.json with AI-generated fields using Gemini.

Adds per disease:
  - prevalence_tier      : int 1–5
  - prevalence_label     : str ("Extremely Rare" … "Very Common")
  - risk_factors         : [{label, type}]  (type from closed set)
  - treatment_types      : [str]            (from closed set)
  - treatment_summary    : str              (1–2 sentences)

Usage:
    export GEMINI_API_KEY="your-key-here"
    pip install google-genai
    python augment_metadata.py

Safe to interrupt and re-run — already-augmented entries are skipped.

Cost estimate (Gemini 2.0 Flash, paid tier):
  773 diseases / 10 per batch = ~78 API calls
  Input  ≈ 64k tokens  →  $0.006
  Output ≈ 160k tokens →  $0.064
  Total  ≈ $0.07  (within free-tier limits: 1,500 req/day, 15 RPM)
"""

import json
import os
import re
import time
from pathlib import Path

from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────
DATA_DIR   = Path(__file__).parent
META_PATH  = DATA_DIR / "disease_metadata.json"
BATCH_SIZE   = 10      # diseases per API call
RPM_LIMIT    = 14      # requests per minute (free tier = 15, Vertex AI = effectively unlimited)
MODEL        = "gemini-2.0-flash"
GCP_PROJECT  = "project-ac0a01a6-4e96-46e3-ad8"  # My First Project (billing enabled)
GCP_LOCATION = "us-central1"

VALID_RISK_TYPES = {"genetic", "biological", "lifestyle", "environmental", "demographic"}
VALID_TREATMENTS = {
    "medication_oral", "medication_topical", "surgery",
    "therapy_physical", "therapy_behavioral",
    "lifestyle_change", "monitoring", "supportive_care", "palliative",
}
PREVALENCE_LABELS = {
    1: "Extremely Rare",   # < 1 in 100,000
    2: "Rare",             # 1 in 10,000 – 100,000
    3: "Uncommon",         # 1 in 1,000 – 10,000
    4: "Common",           # 1 in 100 – 1,000
    5: "Very Common",      # > 1 in 100
}

SYSTEM_PROMPT = """You are a medical knowledge assistant. For each disease provided, return ONLY
a JSON array (no markdown, no prose) where each element has exactly these fields:

{
  "disease": "<exact name as given>",
  "prevalence_tier": <integer 1–5>,
  "risk_factors": [
    {"label": "<concise factor>", "type": "<one of: genetic|biological|lifestyle|environmental|demographic>"}
  ],
  "treatment_types": ["<from allowed list>"],
  "treatment_summary": "<1–2 sentences>"
}

Prevalence tiers:
  1 = Extremely Rare  (< 1 in 100,000 people)
  2 = Rare            (1 in 10,000 – 100,000)
  3 = Uncommon        (1 in 1,000 – 10,000)
  4 = Common          (1 in 100 – 1,000)
  5 = Very Common     (> 1 in 100)

Allowed treatment_types (use only these exact strings):
  medication_oral, medication_topical, surgery, therapy_physical,
  therapy_behavioral, lifestyle_change, monitoring, supportive_care, palliative

Constraints:
- risk_factors: 2–5 items, type must be from the allowed set
- treatment_types: 1–4 items, values must be from the allowed set
- treatment_summary: max 2 sentences, plain English, no jargon
- Return exactly one JSON array element per disease given, in the same order
"""


def is_augmented(entry: dict) -> bool:
    return "prevalence_tier" in entry


def build_user_prompt(batch: list[dict]) -> str:
    lines = []
    for i, entry in enumerate(batch, 1):
        desc = entry.get("description", "")[:300]
        lines.append(f"{i}. {entry['disease']}: {desc}")
    return "Augment these diseases:\n\n" + "\n\n".join(lines)


def extract_json(text: str) -> list:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)
    return json.loads(text.strip())


def validate_and_clean(raw: dict) -> dict:
    tier = max(1, min(5, int(raw.get("prevalence_tier", 2))))

    rf_clean = []
    for rf in raw.get("risk_factors", []):
        t = rf.get("type", "")
        if t not in VALID_RISK_TYPES:
            t = "biological"
        rf_clean.append({"label": str(rf.get("label", ""))[:60], "type": t})
    rf_clean = rf_clean[:5]

    tt_clean = [t for t in raw.get("treatment_types", []) if t in VALID_TREATMENTS]
    if not tt_clean:
        tt_clean = ["supportive_care"]
    tt_clean = tt_clean[:4]

    return {
        "prevalence_tier":   tier,
        "prevalence_label":  PREVALENCE_LABELS[tier],
        "risk_factors":      rf_clean,
        "treatment_types":   tt_clean,
        "treatment_summary": str(raw.get("treatment_summary", ""))[:400],
    }


def augment_batch(client, batch: list[dict]) -> list[dict]:
    max_retries = 4
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=build_user_prompt(batch),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                ),
            )
            raw_list = extract_json(response.text)
            if len(raw_list) != len(batch):
                raise ValueError(f"Expected {len(batch)} results, got {len(raw_list)}")
            return [validate_and_clean(r) for r in raw_list]
        except Exception as exc:
            msg = str(exc)
            if "404" in msg or "NOT_FOUND" in msg:
                raise RuntimeError(f"Model '{MODEL}' not found. Check the model ID.") from exc
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                import re as _re
                m = _re.search(r"retryDelay.*?(\d+)s", msg)
                wait = int(m.group(1)) + 2 if m else (15 * 2 ** attempt)
                print(f"  Rate limited — waiting {wait}s before retry {attempt + 1}/{max_retries} …")
                time.sleep(wait)
            elif "403" in msg and "SERVICE_DISABLED" in msg:
                wait = 15 * (attempt + 1)
                print(f"  API still propagating — waiting {wait}s before retry {attempt + 1}/{max_retries} …")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed after {max_retries} retries due to rate limiting")


def main():
    if GCP_PROJECT:
        # Vertex AI mode — uses your GCP billing + us-central1 unlimited quota
        # Auth: run `gcloud auth application-default login` once before using this
        client = genai.Client(vertexai=True, project=GCP_PROJECT, location=GCP_LOCATION)
        print(f"Mode: Vertex AI  (project={GCP_PROJECT}, location={GCP_LOCATION})")
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "Either set GCP_PROJECT in the script for Vertex AI,\n"
                "or set GEMINI_API_KEY for the AI Studio API:\n"
                "  export GEMINI_API_KEY='your-key-here'"
            )
        client = genai.Client(api_key=api_key)
        print("Mode: AI Studio API")

    with open(META_PATH) as f:
        metadata = json.load(f)

    to_augment    = [e for e in metadata if not is_augmented(e)]
    already_done  = len(metadata) - len(to_augment)
    total_batches = (len(to_augment) + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"Diseases total:       {len(metadata)}")
    print(f"Already augmented:    {already_done}")
    print(f"To augment:           {len(to_augment)}")
    print(f"Batches ({BATCH_SIZE}/call):  {total_batches}")
    print(f"Model:                {MODEL}\n")

    if not to_augment:
        print("Nothing to do — all entries already augmented.")
        return

    meta_index = {e["disease"]: i for i, e in enumerate(metadata)}

    for batch_num in range(total_batches):
        batch = to_augment[batch_num * BATCH_SIZE : (batch_num + 1) * BATCH_SIZE]
        first, last = batch[0]["disease"], batch[-1]["disease"]
        print(f"Batch {batch_num + 1}/{total_batches}: {first} … {last}")

        try:
            augmentations = augment_batch(client, batch)
        except Exception as exc:
            print(f"  ERROR: {exc} — skipping, will retry on next run")
            continue

        for entry, aug in zip(batch, augmentations):
            metadata[meta_index[entry["disease"]]].update(aug)

        with open(META_PATH, "w") as f:
            json.dump(metadata, f, indent=2)
        print(f"  ✓ saved")

        if batch_num < total_batches - 1:
            time.sleep(60 / RPM_LIMIT)

    final_done = sum(1 for e in metadata if is_augmented(e))
    print(f"\nDone — {final_done}/{len(metadata)} diseases augmented.")
    print(f"Saved → {META_PATH}")


if __name__ == "__main__":
    main()
