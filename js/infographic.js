// ============================================
// infographic.js — Vis 3: Disease Infographic + Word Cloud + Info Cards
// ============================================

// ── Lookup tables ─────────────────────────────────────────────────────────────
const PREVALENCE_TIERS = [
  { tier: 1, label: 'Extremely Rare', context: '< 1 in 100,000',  color: '#7e57c2' },
  { tier: 2, label: 'Rare',           context: '1 in 10k–100k',   color: '#42a5f5' },
  { tier: 3, label: 'Uncommon',       context: '1 in 1,000–10,000', color: '#26c6da' },
  { tier: 4, label: 'Common',         context: '1 in 100–1,000',  color: '#ffa726' },
  { tier: 5, label: 'Very Common',    context: '> 1 in 100',      color: '#ef5350' },
];

const RISK_COLORS = {
  genetic:       { bg: 'rgba(126,87,194,0.18)',  text: '#b39ddb', border: 'rgba(126,87,194,0.45)' },
  biological:    { bg: 'rgba(239,83,80,0.15)',   text: '#ef9a9a', border: 'rgba(239,83,80,0.4)'  },
  lifestyle:     { bg: 'rgba(255,167,38,0.15)',  text: '#ffcc80', border: 'rgba(255,167,38,0.4)' },
  environmental: { bg: 'rgba(102,187,106,0.15)', text: '#a5d6a7', border: 'rgba(102,187,106,0.4)'},
  demographic:   { bg: 'rgba(66,165,245,0.15)',  text: '#90caf9', border: 'rgba(66,165,245,0.4)' },
};

const TX_LABELS = {
  medication_oral:     'Oral Medication',
  medication_topical:  'Topical Medication',
  surgery:             'Surgery',
  therapy_physical:    'Physical Therapy',
  therapy_behavioral:  'Behavioral Therapy',
  lifestyle_change:    'Lifestyle Change',
  monitoring:          'Monitoring',
  supportive_care:     'Supportive Care',
  palliative:          'Palliative Care',
};

function initInfographic() {
  const section = document.getElementById('infographic');
  const nameEl = document.getElementById('info-disease-name');
  const descEl = document.getElementById('info-description');
  const linkEl = document.getElementById('info-link');
  const wcSvg = d3.select('#wordcloud-svg');

  // System-to-color mapping for word cloud coloring
  const systemColors = {
    Cardiovascular: '#ef5350', Hematologic: '#ef5350',
    Respiratory: '#42a5f5', ENT: '#ab47bc',
    Gastrointestinal: '#66bb6a', Digestive: '#66bb6a', Dental: '#66bb6a',
    Musculoskeletal: '#ffa726',
    Dermatologic: '#ec407a',
    Neurological: '#7e57c2', Psychological: '#7e57c2', Behavioral: '#7e57c2', Ophthalmic: '#7e57c2',
    Urinary: '#26c6da', Renal: '#26c6da', Reproductive: '#26c6da', Genitourinary: '#26c6da',
    Endocrine: '#ffee58',
    Immune: '#8d6e63', Lymphatic: '#8d6e63', Thermoregulatory: '#8d6e63',
    General: '#78909c', Systemic: '#78909c', Pediatric: '#78909c',
    Metabolic: '#ffee58',
  };

  AppState.onDiseaseSelect.push(onDiseaseSelected);

  function onDiseaseSelected(diseaseName) {
    const relatedSection = document.getElementById('related-section');

    if (!diseaseName) {
      section.classList.add('hidden');
      if (relatedSection) relatedSection.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    if (relatedSection) relatedSection.classList.remove('hidden');

    // Disease description
    const meta = AppState.metadata.find(m => m.disease === diseaseName);
    nameEl.textContent = diseaseName;
    if (meta && meta.description) {
      descEl.textContent = meta.description;
      linkEl.href = meta.url || '#';
      linkEl.style.display = meta.url ? '' : 'none';
    } else {
      descEl.textContent = 'No description available for this disease.';
      linkEl.style.display = 'none';
    }

    // Extra info cards
    renderRiskFactors(meta);
    renderPrevalence(meta);
    renderTreatment(meta);

    // Word cloud of symptoms
    const diseaseRow = AppState.diseaseData.find(d => d.disease === diseaseName);
    if (!diseaseRow) return;

    const symptoms = AppState.symptomList
      .filter(s => diseaseRow[s] > 0)
      .map(s => ({
        text: s.replace(/_/g, ' '),
        value: diseaseRow[s],
        symptomKey: s,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 60); // top 60 for readability

    renderWordCloud(symptoms);
  }

  function renderWordCloud(words) {
    wcSvg.selectAll('*').remove();

    const container = document.getElementById('wordcloud-container');
    const width = (container.clientWidth || 500) - 40;
    const height = 420;

    const fontScale = d3.scaleLinear()
      .domain([0, d3.max(words, d => d.value) || 1])
      .range([10, 36]);

    const layout = d3.layout.cloud()
      .size([width, height])
      .words(words.map(d => ({ ...d, size: fontScale(d.value) })))
      .padding(3)
      .rotate(() => (Math.random() > 0.7 ? 90 : 0))
      .font('sans-serif')
      .fontSize(d => d.size)
      .on('end', draw);

    layout.start();

    function draw(layoutWords) {
      wcSvg.attr('viewBox', `0 0 ${width} ${height}`);

      const g = wcSvg.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

      g.selectAll('text')
        .data(layoutWords)
        .join('text')
        .style('font-size', d => d.size + 'px')
        .style('font-family', 'sans-serif')
        .style('fill', d => getSymptomColor(d.symptomKey))
        .style('cursor', 'default')
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
        .text(d => d.text)
        .append('title')
        .text(d => `${d.text}: ${(d.value * 100).toFixed(1)}% correlation`);
    }
  }

  function getSymptomColor(symptomKey) {
    const meta = AppState.symptomMeta.find(m => m.symptom === symptomKey.replace(/_/g, ' '));
    if (!meta || !meta.bodily_system) return '#8b949e';
    const primarySystem = meta.bodily_system.split(',')[0].trim();
    return systemColors[primarySystem] || '#8b949e';
  }

  // ── Risk Factors card ──────────────────────────────────────────────────────
  function renderRiskFactors(meta) {
    const el = document.getElementById('risk-factors-content');
    if (!el) return;
    if (!meta?.risk_factors?.length) {
      el.innerHTML = '<p class="placeholder-text">No data available.</p>';
      return;
    }

    // Group by type so related factors cluster together
    const byType = {};
    meta.risk_factors.forEach(rf => {
      (byType[rf.type] = byType[rf.type] || []).push(rf.label);
    });

    const tags = meta.risk_factors.map(rf => {
      const c = RISK_COLORS[rf.type] || RISK_COLORS.biological;
      return `<span class="rf-tag" style="background:${c.bg};color:${c.text};border-color:${c.border}" title="${rf.type}">${rf.label}</span>`;
    }).join('');

    const legend = Object.entries(RISK_COLORS)
      .filter(([type]) => byType[type])
      .map(([type, c]) => `<span class="rf-legend-dot" style="background:${c.text}"></span><span style="color:${c.text}">${type}</span>`)
      .join('');

    el.innerHTML = `<div class="rf-tags">${tags}</div><div class="rf-legend">${legend}</div>`;
  }

  // ── Prevalence card ────────────────────────────────────────────────────────
  function renderPrevalence(meta) {
    const el = document.getElementById('prevalence-content');
    if (!el) return;
    if (!meta?.prevalence_tier) {
      el.innerHTML = '<p class="placeholder-text">No data available.</p>';
      return;
    }

    const tier = meta.prevalence_tier;
    const info = PREVALENCE_TIERS[tier - 1];

    const steps = PREVALENCE_TIERS.map(t => {
      const active = t.tier <= tier;
      const style  = active ? `background:${info.color};opacity:${0.4 + 0.6 * (t.tier / tier)}` : '';
      return `<div class="prev-step${active ? ' active' : ''}" style="${style}"></div>`;
    }).join('');

    el.innerHTML = `
      <div class="prevalence-gauge">${steps}</div>
      <div class="prevalence-label" style="color:${info.color}">${info.label}</div>
      <div class="prevalence-context">${info.context} people affected</div>`;
  }

  // ── Treatment card ─────────────────────────────────────────────────────────
  function renderTreatment(meta) {
    const el = document.getElementById('treatment-content');
    if (!el) return;
    if (!meta?.treatment_types?.length) {
      el.innerHTML = '<p class="placeholder-text">No data available.</p>';
      return;
    }

    const pills = meta.treatment_types
      .map(t => `<span class="tx-tag">${TX_LABELS[t] || t}</span>`)
      .join('');

    const summary = meta.treatment_summary
      ? `<p class="tx-summary">${meta.treatment_summary}</p>`
      : '';

    el.innerHTML = `<div class="tx-tags">${pills}</div>${summary}`;
  }
}
