// ============================================
// bodyExplorer.js — Vis 2: Body System Explorer
// PNG body image + SVG organ overlay highlighting
// ============================================

function initBodyExplorer() {
  const section = document.getElementById('body-explorer');
  const explorerName = document.getElementById('explorer-disease-name');
  const systemLabel = document.getElementById('system-label');
  const systemImage = document.getElementById('system-image');
  const explorerSvg = d3.select('#explorer-svg'); // kept only so old markup doesn't break
  const annotationsEl = document.getElementById('symptom-annotations');
  const dotsEl = document.getElementById('system-dots');
  const prevBtn = document.getElementById('prev-system');
  const nextBtn = document.getElementById('next-system');

  let relevantSystems = [];
  let currentIndex = 0;
  let diseaseRow = null;
  let currentOverlayRoot = null;

  const strengthColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

  AppState.onDiseaseSelect.push(onDiseaseSelected);

  ensureOverlayContainer();

  function ensureOverlayContainer() {
    const imageWrap = systemImage.parentElement;
    if (!imageWrap) return;

    imageWrap.style.position = 'relative';

    let overlayHost = imageWrap.querySelector('#system-overlay-host');
    if (!overlayHost) {
      overlayHost = document.createElement('div');
      overlayHost.id = 'system-overlay-host';
      overlayHost.style.position = 'absolute';
      overlayHost.style.inset = '0';
      overlayHost.style.pointerEvents = 'none';
      overlayHost.style.display = 'flex';
      overlayHost.style.alignItems = 'center';
      overlayHost.style.justifyContent = 'center';
      overlayHost.style.zIndex = '2';
      imageWrap.appendChild(overlayHost);
    }
  }

  function getOverlayHost() {
    return systemImage.parentElement.querySelector('#system-overlay-host');
  }

  function onDiseaseSelected(diseaseName) {
    if (!diseaseName) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    explorerName.textContent = diseaseName;

    diseaseRow = AppState.diseaseData.find(d => d.disease === diseaseName);
    if (!diseaseRow) return;

    const activeSymptoms = AppState.symptomList.filter(s => diseaseRow[s] > 0);

    const systemSet = new Set();
    activeSymptoms.forEach(symptom => {
      const meta = AppState.symptomMeta.find(
        m => m.symptom === symptom.replace(/_/g, ' ')
      );
      if (meta && meta.bodily_system) {
        meta.bodily_system.split(',').forEach(sys => {
          const img = SYSTEM_TO_IMAGE[sys.trim()];
          if (img) systemSet.add(img);
        });
      }
    });

    relevantSystems = Array.from(systemSet).sort();
    if (relevantSystems.length === 0) relevantSystems = ['nervous'];

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
      dot.addEventListener('click', () => {
        currentIndex = i;
        renderSystem();
        renderDots();
      });
      dotsEl.appendChild(dot);
    });
  }

  function renderSystem() {
    const system = relevantSystems[currentIndex];
    systemLabel.textContent = system;
    systemImage.src = `Images/${system}.png`;
    systemImage.alt = system;

    clearOverlay();

    systemImage.onload = () => {
      requestAnimationFrame(async () => {
        await loadOverlay(system);
        renderAnnotations(system);
      });
    };

    if (systemImage.complete) {
      requestAnimationFrame(async () => {
        await loadOverlay(system);
        renderAnnotations(system);
      });
    }
  }

  function clearOverlay() {
    const overlayHost = getOverlayHost();
    if (overlayHost) overlayHost.innerHTML = '';
    currentOverlayRoot = null;
    explorerSvg.selectAll('*').remove();
  }

  async function loadOverlay(system) {
    const overlayHost = getOverlayHost();
    if (!overlayHost) return;

    overlayHost.innerHTML = '';
    currentOverlayRoot = null;

    const svgPath = `Images/Overlays/${system}.svg`;

    try {
      const res = await fetch(svgPath);
      if (!res.ok) throw new Error(`Could not load ${svgPath}`);

      const svgText = await res.text();
      overlayHost.innerHTML = svgText;

      const svgEl = overlayHost.querySelector('svg');
      if (!svgEl) return;

      currentOverlayRoot = svgEl;

      // Make overlay scale with image
      svgEl.style.width = `${systemImage.offsetWidth}px`;
      svgEl.style.height = `${systemImage.offsetHeight}px`;
      svgEl.style.maxWidth = '100%';
      svgEl.style.maxHeight = '100%';
      svgEl.style.display = 'block';
      svgEl.style.pointerEvents = 'none';
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Base organ styling
      svgEl.querySelectorAll('.organ-region').forEach(el => {
        el.style.transition = 'fill-opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease';
        el.style.fill = '#ff3b30';
        el.style.fillOpacity = '0.01';
        el.style.stroke = '#ffffff';
        el.style.strokeOpacity = '0';
        el.style.strokeWidth = '1.5';
        el.style.pointerEvents = 'none';
      });
    } catch (err) {
      console.warn(`Overlay not found for system "${system}"`, err);
    }
  }

  function getSymptomsForSystem(system) {
    const symptomsInSystem = [];

    AppState.symptomList.forEach(symptom => {
      const val = diseaseRow[symptom];
      if (val <= 0) return;

      const meta = AppState.symptomMeta.find(
        m => m.symptom === symptom.replace(/_/g, ' ')
      );
      if (!meta) return;

      const systems = (meta.bodily_system || '')
        .split(',')
        .map(s => SYSTEM_TO_IMAGE[s.trim()])
        .filter(Boolean);

      if (!systems.includes(system)) return;

      symptomsInSystem.push({
        symptom: symptom.replace(/_/g, ' '),
        area: (meta.effected_area || '').trim(),
        correlation: val,
      });
    });

    symptomsInSystem.sort((a, b) => b.correlation - a.correlation);
    return symptomsInSystem.slice(0, 15);
  }

  function normalizeAreaIds(areaText) {
    if (!areaText) return [];

    return areaText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s =>
        s
          .toLowerCase()
          .replace(/[()]/g, '')
          .replace(/[\/\s]+/g, '_')
          .replace(/[^a-z0-9_-]/g, '')
      );
  }

  function clearHighlights() {
    if (!currentOverlayRoot) return;

    currentOverlayRoot.querySelectorAll('.organ-region').forEach(el => {
      const elementsToReset = [
        el,
        ...el.querySelectorAll('path, ellipse, circle, rect, polygon, polyline')
      ];

      elementsToReset.forEach(node => {
        node.style.fillOpacity = '0.01';
        node.style.strokeOpacity = '0';
      });

      el.classList.remove('active-organ');
    });
  }

  function highlightAreas(areaText, color) {
    if (!currentOverlayRoot) return;

    clearHighlights();

    const ids = normalizeAreaIds(areaText);

    ids.forEach(id => {
      const target = currentOverlayRoot.querySelector(`#${CSS.escape(id)}`);
      if (!target) {
        console.warn(`No SVG region found for effected_area id: ${id}`);
        return;
      }

      const elementsToStyle = [
        target,
        ...target.querySelectorAll('path, ellipse, circle, rect, polygon, polyline')
      ];

      elementsToStyle.forEach(el => {
        el.style.fill = color;
        el.style.fillOpacity = '0.55';
        el.style.stroke = color;
        el.style.strokeOpacity = '1';
        el.style.strokeWidth = '2.5';
      });

      target.classList.add('active-organ');
    });
  }

  function renderAnnotations(system) {
    annotationsEl.innerHTML = '';
    explorerSvg.selectAll('*').remove();

    if (!diseaseRow) return;

    const display = getSymptomsForSystem(system);

    if (display.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'annotation-empty';
      empty.textContent = 'No symptom annotations are available for this body system.';
      annotationsEl.appendChild(empty);
      return;
    }

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

      tag.addEventListener('mouseenter', () => highlightAreas(item.area, color));
      tag.addEventListener('focusin', () => highlightAreas(item.area, color));
      tag.addEventListener('mouseleave', clearHighlights);
      tag.addEventListener('focusout', clearHighlights);

      tag.addEventListener('click', () => {
        highlightAreas(item.area, color);
      });

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

  window.addEventListener('resize', () => {
    if (relevantSystems.length === 0) return;
    const system = relevantSystems[currentIndex];
    loadOverlay(system);
  });
}