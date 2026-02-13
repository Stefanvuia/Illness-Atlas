// ============================================
// bodyExplorer.js — Vis 2: Body System Explorer (Novel)
// ============================================

function initBodyExplorer() {
  const section = document.getElementById('body-explorer');
  const explorerName = document.getElementById('explorer-disease-name');
  const systemLabel = document.getElementById('system-label');
  const systemImage = document.getElementById('system-image');
  const explorerSvg = d3.select('#explorer-svg');
  const annotationsEl = document.getElementById('symptom-annotations');
  const dotsEl = document.getElementById('system-dots');
  const prevBtn = document.getElementById('prev-system');
  const nextBtn = document.getElementById('next-system');

  let relevantSystems = [];
  let currentIndex = 0;
  let diseaseRow = null;

  // Color scale for correlation strength
  const strengthColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

  AppState.onDiseaseSelect.push(onDiseaseSelected);

  function onDiseaseSelected(diseaseName) {
    if (!diseaseName) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    explorerName.textContent = diseaseName;

    // Find disease row
    diseaseRow = AppState.diseaseData.find(d => d.disease === diseaseName);
    if (!diseaseRow) return;

    // Get symptoms with non-zero correlation
    const activeSymptoms = AppState.symptomList.filter(s => diseaseRow[s] > 0);

    // Map symptoms to their bodily systems → image files
    const systemSet = new Set();
    activeSymptoms.forEach(symptom => {
      const meta = AppState.symptomMeta.find(m => m.symptom === symptom.replace(/_/g, ' '));
      if (meta && meta.bodily_system) {
        meta.bodily_system.split(',').forEach(sys => {
          const img = SYSTEM_TO_IMAGE[sys.trim()];
          if (img) systemSet.add(img);
        });
      }
    });

    relevantSystems = Array.from(systemSet).sort();
    if (relevantSystems.length === 0) relevantSystems = ['Neurological'];

    currentIndex = 0;
    renderDots();
    renderSystem();

    // Scroll into view
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderDots() {
    dotsEl.innerHTML = '';
    relevantSystems.forEach((sys, i) => {
      const dot = document.createElement('div');
      dot.className = 'system-dot' + (i === currentIndex ? ' active' : '');
      dot.title = sys;
      dot.addEventListener('click', () => { currentIndex = i; renderSystem(); renderDots(); });
      dotsEl.appendChild(dot);
    });
  }

  function renderSystem() {
    const system = relevantSystems[currentIndex];
    systemLabel.textContent = system;
    systemImage.src = `Images/${system}.png`;
    systemImage.alt = system;

    // Wait for image to load to get actual dimensions
    systemImage.onload = () => drawAnnotations(system);

    // If already cached
    if (systemImage.complete) drawAnnotations(system);
  }

  function drawAnnotations(system) {
    explorerSvg.selectAll('*').remove();
    annotationsEl.innerHTML = '';

    if (!diseaseRow) return;

    const coords = AREA_COORDS[system] || {};
    const imgRect = systemImage.getBoundingClientRect();
    const canvasRect = systemImage.parentElement.getBoundingClientRect();
    const imgW = systemImage.offsetWidth;
    const imgH = systemImage.offsetHeight;

    // Offset of image within canvas (centering)
    const offsetX = (canvasRect.width - imgW) / 2;
    const offsetY = (canvasRect.height - imgH) / 2;

    explorerSvg.attr('width', canvasRect.width).attr('height', canvasRect.height);

    // Find symptoms for this system
    const symptomsInSystem = [];
    AppState.symptomList.forEach(symptom => {
      const val = diseaseRow[symptom];
      if (val <= 0) return;

      const meta = AppState.symptomMeta.find(m => m.symptom === symptom.replace(/_/g, ' '));
      if (!meta) return;

      const systems = (meta.bodily_system || '').split(',').map(s => SYSTEM_TO_IMAGE[s.trim()]);
      if (!systems.includes(system)) return;

      symptomsInSystem.push({
        symptom: symptom.replace(/_/g, ' '),
        area: meta.effected_area,
        correlation: val,
      });
    });

    // Sort by correlation descending
    symptomsInSystem.sort((a, b) => b.correlation - a.correlation);

    // Limit to top 15 for readability
    const display = symptomsInSystem.slice(0, 15);

    // Draw lines and dots
    const margin = 20;
    display.forEach((item, i) => {
      const areaCoord = coords[item.area];
      if (!areaCoord) return;

      const targetX = offsetX + areaCoord[0] * imgW;
      const targetY = offsetY + areaCoord[1] * imgH;

      // Stagger label positions along the right side
      const labelSide = i % 2 === 0 ? 'right' : 'left';
      const labelX = labelSide === 'right' ? canvasRect.width - margin : margin;
      const labelY = offsetY + 30 + i * 28;

      const lineOpacity = 0.3 + item.correlation * 0.7;
      const lineWidth = 1 + item.correlation * 3;

      // Draw line
      explorerSvg.append('line')
        .attr('x1', labelX)
        .attr('y1', labelY)
        .attr('x2', targetX)
        .attr('y2', targetY)
        .attr('stroke', strengthColor(item.correlation))
        .attr('stroke-width', lineWidth)
        .attr('stroke-opacity', lineOpacity)
        .attr('stroke-dasharray', '4,2');

      // Draw dot at target
      explorerSvg.append('circle')
        .attr('cx', targetX)
        .attr('cy', targetY)
        .attr('r', 4 + item.correlation * 4)
        .attr('fill', strengthColor(item.correlation))
        .attr('fill-opacity', 0.8)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Draw label text
      explorerSvg.append('text')
        .attr('x', labelX + (labelSide === 'right' ? -8 : 8))
        .attr('y', labelY + 4)
        .attr('text-anchor', labelSide === 'right' ? 'end' : 'start')
        .attr('fill', '#e6edf3')
        .attr('font-size', '11px')
        .text(`${item.symptom} (${(item.correlation * 100).toFixed(0)}%)`);
    });

    // Annotation tags below
    display.forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'annotation-tag';
      tag.style.borderColor = strengthColor(item.correlation);
      tag.style.color = strengthColor(item.correlation);
      tag.textContent = `${item.symptom}: ${(item.correlation * 100).toFixed(0)}%`;
      annotationsEl.appendChild(tag);
    });
  }

  prevBtn.addEventListener('click', () => {
    if (relevantSystems.length === 0) return;
    currentIndex = (currentIndex - 1 + relevantSystems.length) % relevantSystems.length;
    renderDots();
    renderSystem();
  });

  nextBtn.addEventListener('click', () => {
    if (relevantSystems.length === 0) return;
    currentIndex = (currentIndex + 1) % relevantSystems.length;
    renderDots();
    renderSystem();
  });
}
