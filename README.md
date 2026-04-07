# Illness Atlas

An interactive data visualization platform that helps users explore relationships between diseases and symptoms, with a focus on overlap, uncertainty, and global impact.

Built as part of CSC316, this project aims to make complex medical data more intuitive and accessible for a general audience.

---

## Links

- **Project Website:** [TODO: add URL]
- **Screencast / Demo Video:** [TODO: add URL]

---

## Project Overview

Medical information is often difficult to interpret due to overlapping symptoms across diseases.
This project addresses that by providing an interactive visual storytelling experience that helps users:
- Explore how diseases are connected through shared symptoms
- Understand why symptoms alone are often unreliable indicators
- Learn how adding symptoms reduces diagnostic uncertainty
- View how diseases relate to different body systems

---

## Features

1. **Bubble Cloud Visualization**
   - Displays diseases as interactive bubbles
   - Size = relevance based on selected symptoms
   - Exploratory Mode → discover patterns across all diseases
   - Diagnostic Mode → systematically narrow down diseases by selecting symptoms

2. **Disease Profile**
   - Description, prevalence gauge, risk factors, and treatment options
   - Symptom word cloud sized and colored by body system

3. **Related Diseases View**
   - Germ-style chart showing diseases connected by symptom overlap (Jaccard similarity)
   - Click a related disease to see a side-by-side symptom comparison

4. **Body Systems Explorer**
   - Anatomical diagrams with highlighted regions for the selected disease
   - Hover over symptoms to see exactly where they manifest in the body

---

## What We Built vs. What Are Libraries

### Our Code (`js/`, `css/`, `Data/`)

All application logic, visualizations, and data pipelines were written by the team:

| File | Description |
|---|---|
| `js/bubbleCloud.js` | Bubble cloud layout, symptom pole clustering, exploratory & diagnostic modes |
| `js/infographic.js` | Disease profile panel: word cloud, risk factors, prevalence gauge, treatments, systems bar chart |
| `js/relatedDiseases.js` | Germ chart and symptom-overlap comparison view |
| `js/bodyExplorer.js` | Anatomical body system explorer with SVG overlays and symptom annotations |
| `js/scrollSnap.js` | Scroll-snapping navigation and section transitions |
| `js/backToExplore.js` | Floating "Back to Symptom Explorer" button behaviour |
| `js/data.js` | Data loading and preprocessing for the browser |
| `css/styles.css` | All layout and visual styling |
| `Data/data_cleaning_1.py` | Raw CSV cleaning and normalization |
| `Data/compute_related_diseases.py` | Jaccard similarity computation between diseases |
| `Data/description_scraper.py` | Wikipedia scraping for disease descriptions |
| `Data/augment_metadata.py` | AI-assisted metadata augmentation (risk, prevalence, treatments) |
| `Data/validate_symptom.py` | Symptom validation and mapping utilities |

### Third-Party Libraries

| Library | Version | Purpose |
|---|---|---|
| [D3.js](https://d3js.org/) | v7 | All SVG-based visualizations (bubble cloud, word cloud, germ chart, bar charts, overlays) |
| [d3-cloud](https://github.com/jasondavies/d3-cloud) | v1.2.7 | Word cloud layout algorithm |

### Data Sources

| Source | Description |
|---|---|
| [Kaggle Disease-Symptom Dataset](https://www.kaggle.com/) | Raw disease–symptom association data (`Diseases_and_Symptoms.csv`, `Disease_Symptom_Averages.csv`) |
| Wikipedia (via `wikipedia-api`) | Disease descriptions, scraped programmatically |
| Google Gemini API | Metadata augmentation for risk factors, prevalence, and treatments |

---

## Tech Stack

**Frontend:** HTML5, CSS3, Vanilla JavaScript (no framework)

**Visualization:** D3.js v7, d3-cloud v1.2.7

**Data Processing (offline):** Python 3, pandas, NumPy, wikipedia-api, requests, google-genai

---

## Team

- Stefan Vuia
- Kimlan Huynh
- Hamza Rana
- Harshith Latchupatula
- Chihana Kashiwabara

---

## Warning

This tool is for educational exploration only and is not a medical diagnostic instrument. Its purpose is to illustrate how difficult it is to narrow down diseases from symptoms alone — do not use it for self-diagnosis.
