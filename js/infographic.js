// ============================================
// infographic.js — Vis 3: Disease Infographic + Word Cloud
// ============================================

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
    if (!diseaseName) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

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
    const width = container.clientWidth - 40;
    const height = 350;

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
}
