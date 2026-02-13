// ============================================
// bubbleCloud.js — Vis 1: Disease Bubble Cloud
// ============================================

function initBubbleCloud() {
  const svg = d3.select('#bubble-svg');
  const container = document.getElementById('bubble-container');
  const tooltip = d3.select('#bubble-tooltip');
  const width = container.clientWidth;
  const height = 600;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const { diseaseData, symptomList } = AppState;

  // --- Symptom selector ---
  const searchInput = document.getElementById('symptom-search');
  const listEl = document.getElementById('symptom-list');
  const selectedEl = document.getElementById('selected-symptoms');

  // Build checkbox list
  symptomList.forEach(symptom => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = symptom;
    cb.addEventListener('change', () => toggleSymptom(symptom, cb.checked));
    label.appendChild(cb);
    label.appendChild(document.createTextNode(symptom.replace(/_/g, ' ')));
    label.dataset.symptom = symptom;
    listEl.appendChild(label);
  });

  // Search filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    listEl.querySelectorAll('label').forEach(label => {
      const match = label.dataset.symptom.toLowerCase().includes(query);
      label.style.display = match ? '' : 'none';
    });
  });

  function toggleSymptom(symptom, checked) {
    if (checked && !AppState.selectedSymptoms.includes(symptom)) {
      AppState.selectedSymptoms.push(symptom);
    } else if (!checked) {
      AppState.selectedSymptoms = AppState.selectedSymptoms.filter(s => s !== symptom);
    }
    renderSelectedTags();
    updateBubbles();
    fireSymptomChange();
  }

  function renderSelectedTags() {
    selectedEl.innerHTML = '';
    AppState.selectedSymptoms.forEach(s => {
      const tag = document.createElement('span');
      tag.className = 'symptom-tag';
      tag.textContent = s.replace(/_/g, ' ');
      tag.title = 'Click to remove';
      tag.addEventListener('click', () => {
        const cb = listEl.querySelector(`input[value="${s}"]`);
        if (cb) cb.checked = false;
        toggleSymptom(s, false);
      });
      selectedEl.appendChild(tag);
    });
  }

  // --- Bubble cloud ---
  const MIN_RADIUS = 3;
  const MAX_RADIUS = 40;
  const DEFAULT_RADIUS = 4;

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  // Create nodes
  let nodes = diseaseData.map((d, i) => ({
    disease: d.disease,
    index: i,
    r: DEFAULT_RADIUS,
    score: 0,
    x: width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: height / 2 + (Math.random() - 0.5) * height * 0.6,
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(0.5))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.r + 1).strength(0.7))
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03))
    .alphaDecay(0.02)
    .on('tick', ticked);

  const bubbles = svg.selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.r)
    .attr('fill', (d, i) => colorScale(i % 10))
    .attr('fill-opacity', 0.7)
    .attr('stroke', 'none')
    .attr('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(`<strong>${d.disease}</strong>${d.score > 0 ? `<br>Score: ${d.score.toFixed(3)}` : ''}`);
      d3.select(event.target).attr('stroke', '#fff').attr('stroke-width', 2);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.offsetX + 15) + 'px')
        .style('top', (event.offsetY - 10) + 'px');
    })
    .on('mouseout', (event) => {
      tooltip.style('opacity', 0);
      d3.select(event.target).attr('stroke', 'none');
    })
    .on('click', (event, d) => {
      AppState.selectedDisease = d.disease;
      fireDiseaseSelect();
      // Highlight selected bubble
      bubbles.attr('stroke', 'none').attr('stroke-width', 0);
      d3.select(event.target).attr('stroke', '#f0883e').attr('stroke-width', 3);
    });

  function ticked() {
    bubbles.attr('cx', d => d.x).attr('cy', d => d.y);
  }

  function updateBubbles() {
    const selected = AppState.selectedSymptoms;
    const hasSelection = selected.length > 0;

    const radiusScale = d3.scaleSqrt()
      .domain([0, selected.length])
      .range([MIN_RADIUS, MAX_RADIUS]);

    nodes.forEach((node, i) => {
      if (!hasSelection) {
        node.score = 0;
        node.r = DEFAULT_RADIUS;
      } else {
        const row = diseaseData[i];
        let score = 0;
        selected.forEach(s => { score += row[s] || 0; });
        node.score = score;
        node.r = score > 0 ? Math.max(MIN_RADIUS, radiusScale(score)) : 1.5;
      }
    });

    bubbles.transition().duration(400)
      .attr('r', d => d.r)
      .attr('fill-opacity', d => {
        if (!hasSelection) return 0.7;
        return d.score > 0 ? 0.8 : 0.08;
      });

    simulation.force('collision', d3.forceCollide().radius(d => d.r + 1).strength(0.7));
    simulation.alpha(0.5).restart();
  }
}
