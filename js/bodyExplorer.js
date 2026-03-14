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
    systemImage.onload = () => requestAnimationFrame(() => drawAnnotations(system));

    // If already cached, defer one frame so layout is recalculated
    if (systemImage.complete) requestAnimationFrame(() => drawAnnotations(system));
  }

  function drawAnnotations(system) {
    explorerSvg.selectAll('*').remove();
    annotationsEl.innerHTML = '';

    if (!diseaseRow) return;

    const coords = AREA_COORDS[system] || {};
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

    // Draw numbered markers on the body image
    display.forEach((item, i) => {
      const areaCoord = coords[item.area];
      if (!areaCoord) return;

      const targetX = offsetX + areaCoord[0] * imgW;
      const targetY = offsetY + areaCoord[1] * imgH;

      // Draw marker at target
      explorerSvg.append('circle')
        .attr('cx', targetX)
        .attr('cy', targetY)
        .attr('r', 9 + item.correlation * 4)
        .attr('fill', strengthColor(item.correlation))
        .attr('fill-opacity', 0.95)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      // Draw marker number
      explorerSvg.append('text')
        .attr('x', targetX)
        .attr('y', targetY + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0b1220')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text(i + 1);
    });

    if (display.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'annotation-empty';
      empty.textContent = 'No symptom annotations are available for this body system.';
      annotationsEl.appendChild(empty);
      return;
    }

    // Annotation list on the right
    display.forEach((item, i) => {
      const color = strengthColor(item.correlation);
      const tag = document.createElement('div');
      tag.className = 'annotation-tag';
      tag.style.borderColor = color;

      const index = document.createElement('span');
      index.className = 'annotation-index';
      index.style.color = color;
      index.style.borderColor = color;
      index.textContent = i + 1;

      const name = document.createElement('span');
      name.className = 'annotation-name';
      name.textContent = item.symptom;

      const value = document.createElement('span');
      value.className = 'annotation-value';
      value.style.color = color;
      value.textContent = `${(item.correlation * 100).toFixed(0)}%`;

      tag.appendChild(index);
      tag.appendChild(name);
      tag.appendChild(value);
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
