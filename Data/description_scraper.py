import json
import os
import re
import wikipediaapi
import pandas as pd
import requests
import time

MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds between retries
OUTPUT_PATH = "Data/disease_metadata.json"

wiki = wikipediaapi.Wikipedia(
    language='en',
    user_agent='IllnessAtlas (student project)'
)


def first_sentence(text):
    """Extract the first sentence from a block of text."""
    if not text:
        return text
    match = re.match(r'(.+?\.)\s', text)
    return match.group(1) if match else text


def retry(fn, *args, retries=MAX_RETRIES):
    """Call fn(*args), retrying on network errors with exponential backoff."""
    for attempt in range(1, retries + 1):
        try:
            return fn(*args)
        except (requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.ChunkedEncodingError,
                ConnectionResetError) as e:
            if attempt == retries:
                raise
            wait = RETRY_DELAY * attempt
            print(f"  !! Network error ({e.__class__.__name__}), "
                  f"retrying in {wait}s (attempt {attempt}/{retries})...")
            time.sleep(wait)


def fetch_wiki_page(disease):
    """Fetch a Wikipedia page, returning (page, exists) tuple."""
    page = wiki.page(disease.title())
    exists = page.exists()
    return page if exists else None


def wiki_search(disease):
    """Search Wikipedia for the closest matching article."""
    resp = requests.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "list": "search",
            "srsearch": disease,
            "srlimit": 1,
            "format": "json",
        },
        headers={"User-Agent": "IllnessAtlas (student project)"},
        timeout=10,
    )
    data = resp.json().get("query", {}).get("search", [])
    if not data:
        return None
    title = data[0]["title"]
    page = wiki.page(title)
    if page.exists():
        return page
    return None


def duckduckgo_summary(disease):
    """Get an instant answer abstract from DuckDuckGo."""
    resp = requests.get(
        "https://api.duckduckgo.com/",
        params={"q": disease, "format": "json", "no_redirect": 1},
        headers={"User-Agent": "IllnessAtlas (student project)"},
        timeout=10,
    )
    data = resp.json()
    abstract = data.get("AbstractText", "")
    url = data.get("AbstractURL", "")
    if abstract:
        return first_sentence(abstract), url
    return None, None


def save_progress(results):
    """Save current results to disk so progress is never lost."""
    pd.DataFrame(results).to_json(OUTPUT_PATH, orient="records", indent=2)


def load_existing_results():
    """Load previously saved results so we can resume."""
    if not os.path.exists(OUTPUT_PATH):
        return []
    with open(OUTPUT_PATH) as f:
        return json.load(f)


df = pd.read_csv("Data/Disease_Symptom_Averages.csv")

# Resume support: skip diseases we already have results for
results = load_existing_results()
already_done = {r["disease"] for r in results}
if already_done:
    print(f"Resuming — {len(already_done)} diseases already processed, "
          f"{len(df) - len(already_done)} remaining.\n")

stats = {"wikipedia": 0, "wikipedia_search": 0, "duckduckgo": 0, "none": 0}
for r in results:
    stats[r.get("source", "wikipedia")] += 1

for disease in df["diseases"]:
    if disease in already_done:
        continue

    print(f"Fetching data for: {disease}")

    try:
        page = retry(fetch_wiki_page, disease)
    except Exception as e:
        print(f"  !! Failed after {MAX_RETRIES} retries ({e.__class__.__name__}), "
              f"skipping for now.")
        continue

    if page:
        results.append({
            "disease": disease,
            "description": first_sentence(page.summary),
            "url": page.fullurl,
            "source": "wikipedia",
        })
        stats["wikipedia"] += 1
    else:
        # Fallback 1: Wikipedia search API
        print(f"  -> No direct page, trying Wikipedia search...")
        try:
            search_page = retry(wiki_search, disease)
        except Exception as e:
            print(f"  !! Search failed after retries ({e.__class__.__name__}), "
                  f"skipping to DuckDuckGo...")
            search_page = None

        if search_page:
            print(f"  -> Found via search: {search_page.title}")
            results.append({
                "disease": disease,
                "description": first_sentence(search_page.summary),
                "url": search_page.fullurl,
                "source": "wikipedia_search",
            })
            stats["wikipedia_search"] += 1
        else:
            # Fallback 2: DuckDuckGo instant answer
            print(f"  -> Wikipedia search failed, trying DuckDuckGo...")
            try:
                ddg_desc, ddg_url = retry(duckduckgo_summary, disease)
            except Exception as e:
                print(f"  !! DuckDuckGo failed after retries "
                      f"({e.__class__.__name__})")
                ddg_desc, ddg_url = None, None

            if ddg_desc:
                print(f"  -> Found via DuckDuckGo")
                results.append({
                    "disease": disease,
                    "description": ddg_desc,
                    "url": ddg_url,
                    "source": "duckduckgo",
                })
                stats["duckduckgo"] += 1
            else:
                print(f"  WARNING: No description found for '{disease}'")
                results.append({
                    "disease": disease,
                    "description": None,
                    "url": None,
                    "source": "none",
                })
                stats["none"] += 1

    save_progress(results)
    time.sleep(0.5)  # be polite

total = len(results)
print(f"\nDone! {total} diseases processed.")
print(f"  Wikipedia (direct): {stats['wikipedia']}")
print(f"  Wikipedia (search): {stats['wikipedia_search']}")
print(f"  DuckDuckGo:         {stats['duckduckgo']}")
print(f"  Not found:          {stats['none']}")
