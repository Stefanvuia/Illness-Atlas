// ============================================
// data.js — Load datasets + shared app state
// ============================================

const AppState = {
  diseaseData: [],       // rows from Disease_Symptom_Averages.csv
  symptomList: [],       // all symptom column names
  symptomMeta: [],       // rows from symptoms_mapped_updated.csv (symptom, bodily_system, effected_area)
  metadata: [],          // rows from disease_metadata.json
  selectedSymptoms: [],  // currently checked symptoms
  selectedDisease: null, // currently clicked disease name
  onSymptomChange: [],   // callbacks
  onDiseaseSelect: [],   // callbacks
};

// Map original bodily_system names to image filenames
const SYSTEM_TO_IMAGE = {
  'nervous': 'Nervous',
  'respiratory': 'Respiratory',
  'circulatory': 'Circulatory',
  'ent': 'ENT',
  'digestive': 'Digestive',
  'integumentary': 'Integumentary',
  'urinary': 'Urinary',
  'reproductive': 'Reproductive',
  'musculoskeletal': 'Musculoskeletal',
  'endocrine': 'Endocrine',
  'immune': 'Immune',
  'lymphatic': 'Lymphatic',
};

// Map image filename back to AREA_COORDS key
const IMAGE_TO_COORDS_KEY = {
  Nervous:         'Neurological',
  Circulatory:     'Cardiovascular',
  Digestive:       'Gastrointestinal',
  Integumentary:   'Dermatologic',
  Urinary:         'Urogenital',
  Reproductive:    'Urogenital',
  Respiratory:     'Respiratory',
  ENT:             'ENT',
  Musculoskeletal: 'Musculoskeletal',
  Endocrine:       'Endocrine',
  Immune:          'Immune',
  Lymphatic:       'Immune',
};

// Generic fallback for areas not in any system-specific map
const AREA_FALLBACK = {
  airway: [0.50, 0.17], jaw: [0.50, 0.10], joints: [0.35, 0.38],
  bones: [0.45, 0.38], muscles: [0.35, 0.30], liver: [0.42, 0.33],
  kidneys: [0.50, 0.36], pancreas: [0.50, 0.36], thyroid: [0.50, 0.14],
  pituitary: [0.50, 0.04], breast: [0.42, 0.24], scalp: [0.50, 0.03],
  nails: [0.18, 0.48], rib: [0.42, 0.24], ovaries: [0.50, 0.42],
  testes: [0.50, 0.48], prostate: [0.50, 0.46], vulva: [0.50, 0.48],
  'blood vessels': [0.45, 0.35], 'lymph nodes': [0.50, 0.16],
  'lymph vessels': [0.45, 0.30], 'peripheral nerves': [0.30, 0.38],
  eyes: [0.50, 0.07], eye: [0.50, 0.07],
};

// ──────────────────────────────────────────────────────────────────────────
// Normalized (x%, y%) coordinates for affected areas on each body image.
// Calibrated from the actual PNG images in Images/.
//
// All images share a similar full-body outline with these landmarks:
//   Head top ~3%   Face ~7-8%   Neck ~14%   Shoulders ~18%
//   Chest ~22-27%  Abdomen ~33-38%  Pelvis ~42-45%  Groin ~48%
//   Knee ~65%      Ankle ~82%   Feet ~90-93%
//   Left arm x≈22%  Left hand x≈17%  Legs x≈40/60%
// ──────────────────────────────────────────────────────────────────────────
const AREA_COORDS = {
  // Circulatory.png — heart visible at ~26%, vessels throughout
  Cardiovascular: {
    Head: [0.50, 0.06], Brain: [0.50, 0.04], Eye: [0.50, 0.07],
    Face: [0.50, 0.08], Neck: [0.50, 0.14],
    Chest: [0.48, 0.24], Heart: [0.47, 0.26], Lungs: [0.48, 0.25],
    Abdomen: [0.48, 0.36], Stomach: [0.48, 0.34],
    Arm: [0.22, 0.32], Hand: [0.17, 0.48], 'Hand/Finger': [0.17, 0.48],
    Groin: [0.48, 0.47], Pelvis: [0.48, 0.44],
    Leg: [0.42, 0.62], Knee: [0.42, 0.65], Ankle: [0.42, 0.82],
    Foot: [0.40, 0.91], 'Foot/Toe': [0.40, 0.91],
    Skin: [0.30, 0.40], 'Whole Body': [0.48, 0.40],
    'Skin/Eyes': [0.50, 0.07],
  },
  // Respiratory.png — trachea at ~18%, lungs clearly at ~26%
  Respiratory: {
    Head: [0.50, 0.06], Nose: [0.50, 0.09], Sinuses: [0.50, 0.08],
    Throat: [0.50, 0.17], 'Vocal Cords': [0.50, 0.16],
    Chest: [0.50, 0.25], Lungs: [0.50, 0.27],
    Abdomen: [0.50, 0.36],
    'Whole Body': [0.50, 0.40],
  },
  // ENT.png — plain body outline, ears/nose/throat by head region
  ENT: {
    Ear: [0.58, 0.06], Nose: [0.50, 0.09], Throat: [0.50, 0.15],
    'Vocal Cords': [0.50, 0.16], Sinuses: [0.50, 0.08], Head: [0.50, 0.06],
    Face: [0.50, 0.08], Neck: [0.50, 0.14], Esophagus: [0.50, 0.17],
    Mouth: [0.50, 0.10], Tongue: [0.50, 0.10],
  },
  // Digestive.png — esophagus ~17%, liver ~32%, stomach ~34%, intestines ~42%
  Gastrointestinal: {
    Head: [0.50, 0.06], Mouth: [0.50, 0.10], Tongue: [0.50, 0.10],
    Gums: [0.50, 0.10], Teeth: [0.50, 0.10],
    Throat: [0.50, 0.15], Esophagus: [0.50, 0.19],
    Stomach: [0.52, 0.34], Abdomen: [0.50, 0.37],
    'Lower Abdomen': [0.50, 0.42], Intestines: [0.50, 0.42],
    Pelvis: [0.50, 0.45], Rectum: [0.50, 0.46], Anus: [0.50, 0.47],
  },
  // Musculoskeletal.png — split muscles/skeleton view
  Musculoskeletal: {
    Head: [0.42, 0.04], Face: [0.42, 0.06], Neck: [0.45, 0.12],
    Shoulder: [0.30, 0.17], Chest: [0.42, 0.23], Back: [0.58, 0.25],
    Arm: [0.22, 0.30], Elbow: [0.20, 0.35], Wrist: [0.17, 0.43],
    Hand: [0.15, 0.48], 'Hand/Finger': [0.15, 0.48],
    Abdomen: [0.42, 0.34], Hip: [0.55, 0.42], Pelvis: [0.48, 0.43],
    Groin: [0.48, 0.46], Leg: [0.40, 0.60], Knee: [0.40, 0.65],
    Ankle: [0.40, 0.83], Foot: [0.38, 0.92], 'Foot/Toe': [0.38, 0.92],
    'Whole Body': [0.45, 0.40],
  },
  // Nervous.png — brain at top ~4%, spinal cord center, nerves branch out
  Neurological: {
    Brain: [0.50, 0.04], Head: [0.50, 0.06], Eye: [0.50, 0.07],
    Face: [0.50, 0.08], Neck: [0.50, 0.14], Throat: [0.50, 0.15],
    Shoulder: [0.32, 0.17], Arm: [0.24, 0.30], Elbow: [0.22, 0.35],
    Wrist: [0.18, 0.43], Hand: [0.16, 0.48], 'Hand/Finger': [0.16, 0.48],
    Back: [0.50, 0.28], Abdomen: [0.50, 0.36],
    Pelvis: [0.50, 0.43], Groin: [0.50, 0.46], Hip: [0.45, 0.43],
    Leg: [0.42, 0.60], Knee: [0.42, 0.65], Ankle: [0.42, 0.82],
    Foot: [0.40, 0.91], 'Foot/Toe': [0.40, 0.91],
    'Nervous System': [0.50, 0.30], 'Whole Body': [0.50, 0.40],
    Teeth: [0.50, 0.10], Tongue: [0.50, 0.10],
  },
  // Integumentary.png — plain body outline (skin system)
  Dermatologic: {
    Head: [0.50, 0.06], Face: [0.50, 0.08], Skin: [0.50, 0.35],
    Lips: [0.50, 0.10], Abdomen: [0.50, 0.36], Anus: [0.50, 0.47],
    Hand: [0.17, 0.48], Foot: [0.40, 0.91], Tongue: [0.50, 0.10],
    Neck: [0.50, 0.14], Scalp: [0.50, 0.03],
    'Whole Body': [0.50, 0.40],
  },
  // Urinary.png — kidneys at ~36%, bladder at ~46%
  Urogenital: {
    Head: [0.50, 0.06], Chest: [0.50, 0.24],
    Abdomen: [0.50, 0.36], Kidneys: [0.50, 0.36],
    'Kidneys/Bladder': [0.50, 0.38], Bladder: [0.50, 0.46],
    'Bladder/Urethra': [0.50, 0.47], Pelvis: [0.50, 0.44],
    Vagina: [0.50, 0.48], Uterus: [0.50, 0.44], Penis: [0.50, 0.48],
    Groin: [0.50, 0.47],
    'Reproductive Organs': [0.50, 0.46],
    'Whole Body': [0.50, 0.40],
  },
  // Endocrine.png — pituitary ~7%, thyroid ~14%, adrenals/pancreas ~36%, gonads ~47%
  Endocrine: {
    Brain: [0.50, 0.05], Head: [0.50, 0.06], Pituitary: [0.50, 0.07],
    Thyroid: [0.50, 0.14], Neck: [0.50, 0.14],
    Chest: [0.50, 0.24], Abdomen: [0.50, 0.36],
    Pelvis: [0.50, 0.44], Skin: [0.50, 0.35],
    Lips: [0.50, 0.10], Mouth: [0.50, 0.10],
    'Whole Body': [0.50, 0.40],
  },
  // Immune.png — lymph-like body outline with nodes at neck, armpits, groin
  Immune: {
    Head: [0.50, 0.06], Neck: [0.50, 0.14],
    Chest: [0.50, 0.24], Abdomen: [0.50, 0.36],
    Mouth: [0.50, 0.10], Tongue: [0.50, 0.10],
    Lips: [0.50, 0.10], Nose: [0.50, 0.09],
    Skin: [0.50, 0.35], 'Whole Body': [0.50, 0.35],
  },
};

function fireSymptomChange() {
  AppState.onSymptomChange.forEach(fn => fn(AppState.selectedSymptoms));
}

function fireDiseaseSelect() {
  const scrollY = window.scrollY;
  AppState.onDiseaseSelect.forEach(fn => fn(AppState.selectedDisease));
  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  });
}

async function loadAllData() {
  const [diseaseRaw, symptomMeta, metadata] = await Promise.all([
    d3.csv('Data/Disease_Symptom_Averages.csv'),
    d3.csv('Data/symptoms_mapped_updated.csv'),
    d3.json('Data/disease_metadata.json'),
  ]);

  // Parse numeric columns
  const symptomCols = diseaseRaw.columns.filter(c => c !== 'diseases');
  AppState.diseaseData = diseaseRaw.map(row => {
    const parsed = { disease: row.diseases };
    symptomCols.forEach(s => { parsed[s] = +row[s] || 0; });
    return parsed;
  });

  // Filter out symptoms with no associated diseases in the dataset
  AppState.symptomList = symptomCols.filter(s =>
    AppState.diseaseData.some(row => row[s] > 0)
  );
  AppState.symptomMeta = symptomMeta;
  AppState.metadata = metadata;

  console.log(`Loaded ${AppState.diseaseData.length} diseases, ${AppState.symptomList.length} symptoms`);
}

// Bootstrap
loadAllData().then(() => {
  initBubbleCloud();
  initBodyExplorer();
  initInfographic();
  initRelatedDiseases();
});
