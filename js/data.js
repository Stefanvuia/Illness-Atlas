// ============================================
// data.js — Load datasets + shared app state
// ============================================

const AppState = {
  diseaseData: [],       // rows from Disease_Symptom_Averages.csv
  symptomList: [],       // all symptom column names
  symptomMeta: [],       // rows from symptoms.csv (symptom, bodily_system, effected_area)
  metadata: [],          // rows from disease_metadata.json
  selectedSymptoms: [],  // currently checked symptoms
  selectedDisease: null, // currently clicked disease name
  onSymptomChange: [],   // callbacks
  onDiseaseSelect: [],   // callbacks
};

// Map original bodily_system names to image filenames
const SYSTEM_TO_IMAGE = {
  Cardiovascular: 'Cardiovascular', Hematologic: 'Cardiovascular',
  Respiratory: 'Respiratory',
  ENT: 'ENT',
  Gastrointestinal: 'Gastrointestinal', Digestive: 'Gastrointestinal', Dental: 'Gastrointestinal',
  Musculoskeletal: 'Musculoskeletal',
  Dermatologic: 'Dermatologic',
  Neurological: 'Neurological', Psychological: 'Neurological', Behavioral: 'Neurological', Ophthalmic: 'Neurological',
  Urinary: 'Urogenital', Renal: 'Urogenital', Reproductive: 'Urogenital', Genitourinary: 'Urogenital',
  Endocrine: 'Endocrine', Metabolic: 'Endocrine',
  Immune: 'Immune', Lymphatic: 'Immune', Thermoregulatory: 'Immune',
  General: 'Pediatric', Systemic: 'Pediatric', Pediatric: 'Pediatric',
};

// Normalized pixel coordinates for affected areas on each image (x%, y%)
const AREA_COORDS = {
  Cardiovascular: {
    Head: [0.50, 0.08], Brain: [0.50, 0.06], Eye: [0.50, 0.07],
    Chest: [0.48, 0.25], Heart: [0.48, 0.28], Lungs: [0.48, 0.24],
    Abdomen: [0.48, 0.38], Stomach: [0.48, 0.36],
    Arm: [0.22, 0.35], Hand: [0.18, 0.48], 'Hand/Finger': [0.18, 0.48],
    Groin: [0.48, 0.46], Pelvis: [0.48, 0.44],
    Leg: [0.42, 0.65], Knee: [0.42, 0.58], Foot: [0.42, 0.88], 'Foot/Toe': [0.42, 0.88],
    Skin: [0.30, 0.50], 'Whole Body': [0.48, 0.45],
    'Skin/Eyes': [0.50, 0.08],
  },
  Respiratory: {
    Head: [0.45, 0.12], Nose: [0.38, 0.18], Throat: [0.45, 0.28],
    'Vocal Cords': [0.45, 0.30], Chest: [0.50, 0.55], Lungs: [0.50, 0.50],
    'Whole Body': [0.50, 0.50], Sinuses: [0.38, 0.15],
  },
  ENT: {
    Ear: [0.85, 0.45], Nose: [0.30, 0.50], Throat: [0.70, 0.80],
    'Vocal Cords': [0.70, 0.75], Sinuses: [0.25, 0.35], Head: [0.35, 0.25],
    Face: [0.30, 0.45], Neck: [0.70, 0.65], Esophagus: [0.70, 0.85],
  },
  Gastrointestinal: {
    Throat: [0.48, 0.15], Esophagus: [0.43, 0.22], Stomach: [0.48, 0.38],
    Abdomen: [0.48, 0.42], 'Lower Abdomen': [0.48, 0.48], Intestines: [0.48, 0.50],
    Pelvis: [0.48, 0.52], Rectum: [0.48, 0.55], Anus: [0.48, 0.57],
    Mouth: [0.48, 0.12], Tongue: [0.48, 0.13], Gums: [0.48, 0.11],
    Teeth: [0.48, 0.11], Head: [0.48, 0.08],
  },
  Musculoskeletal: {
    Head: [0.38, 0.06], Face: [0.38, 0.07], Neck: [0.42, 0.10],
    Shoulder: [0.28, 0.15], Chest: [0.40, 0.20], Back: [0.55, 0.25],
    Arm: [0.22, 0.28], Elbow: [0.22, 0.33], Wrist: [0.20, 0.42],
    Hand: [0.18, 0.47], 'Hand/Finger': [0.18, 0.47],
    Abdomen: [0.40, 0.35], Hip: [0.55, 0.40], Pelvis: [0.45, 0.42],
    Groin: [0.45, 0.44], Leg: [0.35, 0.60], Knee: [0.35, 0.55],
    Ankle: [0.35, 0.80], Foot: [0.32, 0.90], 'Foot/Toe': [0.32, 0.90],
    'Whole Body': [0.40, 0.45],
  },
  Neurological: {
    Brain: [0.50, 0.06], Head: [0.50, 0.08], Eye: [0.50, 0.09],
    Face: [0.50, 0.10], Neck: [0.50, 0.14], Throat: [0.50, 0.15],
    Shoulder: [0.32, 0.18], Arm: [0.25, 0.30], Elbow: [0.25, 0.33],
    Wrist: [0.22, 0.40], Hand: [0.20, 0.45], 'Hand/Finger': [0.20, 0.45],
    Back: [0.50, 0.28], Pelvis: [0.50, 0.42],
    Groin: [0.50, 0.44], Hip: [0.42, 0.42],
    Leg: [0.42, 0.62], Knee: [0.42, 0.55], Ankle: [0.42, 0.78],
    Foot: [0.42, 0.88], 'Foot/Toe': [0.42, 0.88],
    'Nervous System': [0.50, 0.35], 'Whole Body': [0.50, 0.40],
    Teeth: [0.50, 0.10], Tongue: [0.50, 0.11],
    Abdomen: [0.50, 0.36],
  },
  Dermatologic: {
    Head: [0.50, 0.10], Face: [0.50, 0.12], Skin: [0.50, 0.45],
    Lips: [0.50, 0.14], Abdomen: [0.50, 0.42], Anus: [0.50, 0.52],
    Hand: [0.32, 0.50], Foot: [0.42, 0.88], Tongue: [0.50, 0.15],
    'Whole Body': [0.50, 0.45],
  },
  Urogenital: {
    'Kidneys/Bladder': [0.50, 0.38], Bladder: [0.50, 0.50],
    'Bladder/Urethra': [0.50, 0.52], Pelvis: [0.50, 0.48],
    Abdomen: [0.50, 0.40], Vagina: [0.50, 0.55],
    Uterus: [0.50, 0.48], Penis: [0.50, 0.55],
    Groin: [0.50, 0.55], Chest: [0.50, 0.25],
    'Reproductive Organs': [0.50, 0.52], Head: [0.50, 0.08],
    'Whole Body': [0.50, 0.45],
  },
  Endocrine: {
    Brain: [0.40, 0.12], Head: [0.40, 0.12],
    Chest: [0.50, 0.55], Abdomen: [0.50, 0.65],
    Pelvis: [0.35, 0.80], Skin: [0.50, 0.50],
    Lips: [0.40, 0.15], Mouth: [0.40, 0.15],
    'Whole Body': [0.50, 0.50],
  },
  Immune: {
    Head: [0.50, 0.10], Neck: [0.50, 0.18],
    Chest: [0.50, 0.30], Abdomen: [0.50, 0.45],
    Mouth: [0.50, 0.12], Tongue: [0.50, 0.13],
    Lips: [0.50, 0.12], Nose: [0.50, 0.10],
    Skin: [0.50, 0.40], 'Whole Body': [0.50, 0.40],
  },
  Pediatric: {
    Abdomen: [0.50, 0.50], 'Whole Body': [0.50, 0.50],
    Brain: [0.50, 0.15], Head: [0.50, 0.15],
    Chest: [0.50, 0.35],
  },
};

function fireSymptomChange() {
  AppState.onSymptomChange.forEach(fn => fn(AppState.selectedSymptoms));
}

function fireDiseaseSelect() {
  AppState.onDiseaseSelect.forEach(fn => fn(AppState.selectedDisease));
}

async function loadAllData() {
  const [diseaseRaw, symptomMeta, metadata] = await Promise.all([
    d3.csv('Data/Disease_Symptom_Averages.csv'),
    d3.csv('Data/symptoms.csv'),
    d3.json('Data/disease_metadata.json'),
  ]);

  // Parse numeric columns
  const symptomCols = diseaseRaw.columns.filter(c => c !== 'diseases');
  AppState.diseaseData = diseaseRaw.map(row => {
    const parsed = { disease: row.diseases };
    symptomCols.forEach(s => { parsed[s] = +row[s] || 0; });
    return parsed;
  });

  AppState.symptomList = symptomCols;
  AppState.symptomMeta = symptomMeta;
  AppState.metadata = metadata;

  console.log(`Loaded ${AppState.diseaseData.length} diseases, ${AppState.symptomList.length} symptoms`);
}

// Bootstrap
loadAllData().then(() => {
  initBubbleCloud();
  initBodyExplorer();
  initInfographic();
});
