// ============================================
// bubbleCloud.js — Vis 1: Disease Bubble Cloud
// ============================================

function initBubbleCloud() {
  let diagnosticReady = false;

  document.querySelectorAll('.vis-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.vis-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.vis-panel').forEach(p =>
        p.classList.toggle('active', p.id === 'panel-' + target)
      );
      if (target === 'diagnostic' && !diagnosticReady) {
        diagnosticReady = true;
        initBubbleCloudPanel(document.getElementById('panel-diagnostic'), 'diagnostic');
      }
    });
  });

  initBubbleCloudPanel(document.getElementById('panel-exploratory'), 'exploratory');
}

function initBubbleCloudPanel(panel, mode) {
  const svgEl = panel.querySelector('.bubble-svg');
  const svg = d3.select(svgEl);
  const container = panel.querySelector('.bubble-container');
  const tooltip = d3.select(panel.querySelector('.bubble-tooltip'));
  const searchInput = panel.querySelector('.symptom-search');
  const listEl = panel.querySelector('.symptom-list');
  const selectedEl = panel.querySelector('.selected-symptoms');
  const resetBtn = panel.querySelector('.diagnostic-reset-btn');

  const width = container.clientWidth;
  const height = 600;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const { diseaseData, symptomList } = AppState;

  const diseaseSymptomCount = {};
  diseaseData.forEach(row => {
    diseaseSymptomCount[row.disease] = Math.max(
      1,
      symptomList.filter(s => (row[s] || 0) > 0).length
    );
  });

  let selectedSymptoms = [];

  // --- Symptom list ---
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

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    listEl.querySelectorAll('label').forEach(label => {
      if (label.classList.contains('symptom-unavailable')) return;
      label.style.display = label.dataset.symptom.toLowerCase().includes(query) ? '' : 'none';
    });
  });

  let pulseTimer = null;

  function toggleSymptom(symptom, checked) {
    if (checked && !selectedSymptoms.includes(symptom)) {
      selectedSymptoms.push(symptom);
      // Schedule pulse after simulation settles — only on addition
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(pulseFullCoverageBubbles, 1200);
    } else if (!checked) {
      selectedSymptoms = selectedSymptoms.filter(s => s !== symptom);
      if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
    }
    renderSelectedTags();
    updateBubbles();
    AppState.selectedSymptoms = [...selectedSymptoms];
    fireSymptomChange();
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      selectedSymptoms = [];
      listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      renderSelectedTags();
      updateBubbles();
      AppState.selectedSymptoms = [];
      fireSymptomChange();
    });
  }

  function renderSelectedTags() {
    selectedEl.innerHTML = '';
    if (resetBtn) resetBtn.style.display = selectedSymptoms.length > 0 ? '' : 'none';
    selectedSymptoms.forEach(s => {
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

  // --- SVG structure ---
  const contentG = svg.append('g').attr('class', 'content-g');
  const poleGroup  = mode === 'exploratory'
    ? contentG.append('g').attr('class', 'pole-group')
    : null;
  const bubbleGroup = contentG.append('g').attr('class', 'bubble-group');
  const labelGroup  = contentG.append('g').attr('class', 'label-group');

  // Zoom/pan (exploratory only) — hoisted so autoFitView can reference it
  let zoom = null;
  if (mode === 'exploratory') {
    zoom = d3.zoom()
      .scaleExtent([0.1, 6])
      .on('zoom', event => contentG.attr('transform', event.transform));
    svg.call(zoom);
    // Start slightly zoomed out so the full default cloud is visible
    const initScale = 0.72;
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initScale)
      .translate(-width / 2, -height / 2));
    d3.select(container).append('button')
      .attr('class', 'zoom-reset-btn')
      .text('Reset view')
      .on('click', () => {
        if (poles.length > 0) {
          // Re-fit to the current cluster layout
          autoFitView(Math.max(20, Math.min(MAX_RADIUS, 500 / Math.sqrt(nodes.filter(n => !n.filtered).length))));
        } else {
          // No selection — zoom out slightly so the full cloud is visible
          const defaultScale = 0.72;
          const t = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(defaultScale)
            .translate(-width / 2, -height / 2);
          svg.transition().duration(400).call(zoom.transform, t);
        }
      });
  }

  // After poles are placed, animate the zoom to frame all clusters comfortably.
  // Uses the pole bounding box + a padding budget based on the current max radius.
  function autoFitView(dynamicMax) {
    if (!zoom || poles.length === 0) return;
    const pad = dynamicMax * 2.5 + 70;
    const xs = poles.map(p => p.x);
    const ys = poles.map(p => p.y);
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const scale = Math.min(1, width / (x1 - x0), height / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const t = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-cx, -cy);
    svg.transition().duration(600).call(zoom.transform, t);
  }

  // --- Bubble cloud ---
  const MIN_RADIUS = 6;
  const MAX_RADIUS = 62;
  const DEFAULT_RADIUS = 8;

  const scoreGradient = d3.scaleSequential(d3.interpolate('#3a5a8a', '#e07830')).domain([0, 1]);
  const COLOR_DEFAULT = '#3a5a8a';
  const COLOR_TOP = '#ffd700';
  const COLOR_HIGH = '#f0883e';

  let poles = [];

  let nodes = diseaseData.map((d, i) => ({
    disease: d.disease,
    index: i,
    r: DEFAULT_RADIUS,
    score: 0,
    rank: -1,
    filtered: false,
    targetX: width / 2,
    targetY: height / 2,
    x: width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: height / 2 + (Math.random() - 0.5) * height * 0.5,
  }));

  // Compute the score-weighted centroid of each node's matching poles and
  // store it as targetX/Y. Called after pole positions are updated.
  // Computed for ALL nodes (even filtered) so restoring nodes snap to the
  // right place immediately.
  function computeTargetPositions() {
    if (poles.length === 0) return;
    const poleMap = new Map(poles.map(p => [p.symptom, p]));
    nodes.forEach(node => {
      const row = diseaseData[node.index];
      let wx = 0, wy = 0, totalW = 0;
      selectedSymptoms.forEach(s => {
        const v = row[s] || 0;
        if (v === 0) return;
        const pole = poleMap.get(s);
        if (!pole) return;
        wx += v * pole.x;
        wy += v * pole.y;
        totalW += v;
      });
      // Diseases matching no poles sit at the canvas centre (they'll be filtered anyway)
      node.targetX = totalW > 0 ? wx / totalW : width / 2;
      node.targetY = totalW > 0 ? wy / totalW : height / 2;
    });
  }

  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(0.5))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : d.r + 2).strength(0.85))
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03))
    .alphaDecay(0.03)
    .on('tick', ticked);

  const bubbles = bubbleGroup.selectAll('circle.bubble')
    .data(nodes)
    .join(enter => enter.append('circle').attr('class', 'bubble'))
    .attr('r', d => d.r)
    .attr('fill', COLOR_DEFAULT)
    .attr('fill-opacity', 0.75)
    .attr('stroke', 'none')
    .attr('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      if (d.filtered) return;
      tooltip.style('opacity', 1)
        .html(`<strong>${d.disease}</strong>${d.score > 0 ? `<br>Score: ${(d.score * 100).toFixed(1)}%` : ''}`);
      d3.select(event.target).attr('stroke', '#fff').attr('stroke-width', 2);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.offsetX + 15) + 'px')
        .style('top', (event.offsetY - 10) + 'px');
    })
    .on('mouseout', (event, d) => {
      tooltip.style('opacity', 0);
      if (AppState.selectedDisease !== d.disease) {
        d3.select(event.target).attr('stroke', 'none');
      }
    })
    .on('click', (event, d) => {
      if (d.filtered) return;
      AppState.selectedDisease = d.disease;
      fireDiseaseSelect();
      bubbles.attr('stroke', 'none').attr('stroke-width', 0);
      d3.select(event.target).attr('stroke', '#f0883e').attr('stroke-width', 3);
      playRipple(d.x, d.y, d.r, '#f0883e');
    });

  let labels = labelGroup.selectAll('text').data([]).join('text');

  function ticked() {
    bubbles.attr('cx', d => d.x).attr('cy', d => d.y);
    labels.attr('x', d => d.x).attr('y', d => d.y + 1);
  }

  function playRipple(cx, cy, r, color) {
    const ripple = bubbleGroup.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', r)
      .attr('fill', 'none').attr('stroke', color)
      .attr('stroke-width', 3).attr('opacity', 1)
      .attr('pointer-events', 'none');
    ripple.transition().duration(750)
      .attr('r', r + 40).attr('opacity', 0)
      .on('end', () => ripple.remove());
  }

  // Order symptoms so that co-occurring ones sit angularly adjacent on the ring,
  // creating natural cluster groupings. Uses greedy nearest-neighbour on the
  // Jaccard-like co-occurrence similarity between symptoms.
  function orderedByCooccurrence(symptoms, activeNodes) {
    if (symptoms.length <= 2) return [...symptoms];
    // Co-occurrence: fraction of each symptom's diseases that also have the other
    const freq = {};
    symptoms.forEach(s => {
      freq[s] = activeNodes.filter(n => (diseaseData[n.index][s] || 0) > 0).length;
    });
    const cooc = {};
    symptoms.forEach(a => {
      cooc[a] = {};
      symptoms.forEach(b => {
        if (a === b) { cooc[a][b] = 1; return; }
        const both = activeNodes.filter(n => {
          const row = diseaseData[n.index];
          return (row[a] || 0) > 0 && (row[b] || 0) > 0;
        }).length;
        cooc[a][b] = both / Math.max(1, Math.min(freq[a], freq[b]));
      });
    });
    // Greedy nearest-neighbour starting from the most connected symptom
    const totalCooc = s => symptoms.reduce((sum, t) => sum + (cooc[s][t] || 0), 0);
    const remaining = [...symptoms].sort((a, b) => totalCooc(b) - totalCooc(a));
    const ordered = [remaining.shift()];
    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0, bestScore = -1;
      remaining.forEach((s, i) => {
        if ((cooc[last][s] || 0) > bestScore) { bestScore = cooc[last][s]; bestIdx = i; }
      });
      ordered.push(remaining.splice(bestIdx, 1)[0]);
    }
    return ordered;
  }

  // Place pole markers on a ring whose radius varies per pole.
  // - Base ring radius scales with sqrt(activeCount) for breathing room.
  // - Common symptoms (appear in many active diseases) sit closer to center,
  //   like a galactic core; rare symptoms are pushed to the periphery.
  // - Angular order groups co-occurring symptoms next to each other.
  function updatePoles(activeCount, activeNodes) {
    const N = selectedSymptoms.length;
    poleGroup.selectAll('.pole-marker').remove();
    if (N === 0) { poles = []; return; }

    const baseRadius = N === 1
      ? 150
      : Math.max(300, Math.sqrt(activeCount) * 48);

    // Compute frequency of each symptom among active nodes
    const freq = {};
    selectedSymptoms.forEach(s => {
      freq[s] = (activeNodes || []).filter(n => (diseaseData[n.index][s] || 0) > 0).length;
    });
    const maxFreq = Math.max(1, ...Object.values(freq));

    // Angular ordering by co-occurrence
    const ordered = orderedByCooccurrence(selectedSymptoms, activeNodes || []);

    poles = ordered.map((s, i) => {
      // Common symptoms (normalizedFreq → 1) get 55% of baseRadius (closer to center).
      // Rare symptoms (normalizedFreq → 0) get 100% of baseRadius (at the periphery).
      const normalizedFreq = freq[s] / maxFreq;
      const r = baseRadius * (1 - 0.45 * normalizedFreq);
      return {
        symptom: s,
        freq: freq[s],
        x: width  / 2 + r * Math.cos(2 * Math.PI * i / N - Math.PI / 2),
        y: height / 2 + r * Math.sin(2 * Math.PI * i / N - Math.PI / 2),
      };
    });

    // Pole circle size encodes how many active diseases share this symptom
    const freqScale = d3.scaleSqrt()
      .domain([0, maxFreq])
      .range([8, 26]);

    poles.forEach(pole => {
      const g = poleGroup.append('g').attr('class', 'pole-marker')
        .attr('transform', `translate(${pole.x},${pole.y})`);
      const targetR = freqScale(pole.freq);
      g.append('circle')
        .attr('r', 0)
        .attr('fill', 'rgba(88,166,255,0.08)')
        .attr('stroke', '#58a6ff')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3')
        .attr('pointer-events', 'none')
        .transition().duration(500).attr('r', targetR);
      const above = pole.y <= height / 2;
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', above ? -(targetR + 8) : (targetR + 18))
        .attr('fill', '#58a6ff')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .attr('opacity', 0)
        .text(`${pole.symptom.replace(/_/g, ' ')} (${pole.freq})`)
        .transition().duration(500).attr('opacity', 1);
    });
  }

  function updateBubbles() {
    const hasSelection = selectedSymptoms.length > 0;

    if (!hasSelection) {
      nodes.forEach(node => {
        node.score = 0; node.coverage = 0; node.matchedCount = 0; node.r = DEFAULT_RADIUS;
        node.rank = -1; node.filtered = false;
        node.targetX = width / 2; node.targetY = height / 2;
        delete node.fx; delete node.fy;
      });
      bubbles.transition().duration(500)
        .attr('r', DEFAULT_RADIUS).attr('fill', COLOR_DEFAULT)
        .attr('fill-opacity', 0.75).attr('opacity', 1);
      labels = labelGroup.selectAll('text').data([]).join('text');
      svg.selectAll('.terminal-msg').remove();
      refreshSymptomList(null);
      if (mode === 'exploratory') {
        updatePoles(0, []);
        // Restore standard centering forces for the default cloud layout
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.force('charge', d3.forceManyBody().strength(0.5));
        simulation.force('x', d3.forceX(width / 2).strength(0.03));
        simulation.force('y', d3.forceY(height / 2).strength(0.03));
      }
      simulation.force('collision', d3.forceCollide().radius(d => d.r + 2).strength(0.85));
      simulation.alpha(0.5).restart();
      return;
    }

    nodes.forEach((node, i) => {
      const row = diseaseData[i];
      const denom = diseaseSymptomCount[node.disease];
      let sum = 0, matched = 0;
      selectedSymptoms.forEach(s => {
        const v = row[s] || 0;
        sum += v;
        if (v > 0) matched++;
      });
      node.score = sum / denom;
      node.matchedCount = matched;
      // coverage: fraction of selected symptoms this disease actually has
      node.coverage = matched / selectedSymptoms.length;
    });

    const isActive = (node) => {
      if (mode === 'diagnostic') {
        const row = diseaseData[node.index];
        return selectedSymptoms.every(s => (row[s] || 0) > 0);
      }
      return node.score > 0;
    };

    const toFilter  = nodes.filter(n => !n.filtered && !isActive(n));
    const toRestore = nodes.filter(n =>  n.filtered &&  isActive(n));
    const survivors = nodes.filter(n => !n.filtered &&  isActive(n));
    const activeCount = survivors.length + toRestore.length;

    // --- Exploratory: compute pole positions + targets BEFORE placing nodes ---
    if (mode === 'exploratory') {
      const allCandidates = survivors.concat(toRestore);
      updatePoles(activeCount, allCandidates);
      computeTargetPositions();
    }

    // Filter out non-matching nodes
    toFilter.forEach(node => { node.filtered = true; });
    if (toFilter.length > 0) {
      const filterSet = new Set(toFilter);
      bubbles.filter(d => filterSet.has(d))
        .transition().duration(600).ease(d3.easeCubicIn)
        .attr('r', 0).attr('opacity', 0);
    }

    // Restore previously filtered nodes — place them directly at their computed
    // target so they materialise in the right cluster, not fly in from center.
    toRestore.forEach(node => {
      node.filtered = false;
      delete node.fx; delete node.fy;
      node.x = node.targetX + (Math.random() - 0.5) * 20;
      node.y = node.targetY + (Math.random() - 0.5) * 20;
      node.vx = 0; node.vy = 0;
    });

    const allActive = survivors.concat(toRestore);
    const maxScore = d3.max(allActive, n => n.score) || 1;
    // Max bubble radius shrinks gently as count grows — 500/√N gives ~62px at
    // ~65 bubbles, ~35px at 200, ~20px at 600+. Floor raised to 20 so labels
    // remain readable; auto-zoom handles any crowding instead.
    const dynamicMax = Math.max(20, Math.min(MAX_RADIUS, 500 / Math.sqrt(allActive.length)));
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxScore])
      .range(allActive.length > 1 ? [MIN_RADIUS, dynamicMax] : [dynamicMax * 0.7, dynamicMax]);

    const sorted = [...allActive].sort((a, b) => b.score - a.score);
    sorted.forEach((n, i) => { n.rank = i; n.r = radiusScale(n.score); });

    bubbles.filter(d => !d.filtered && d.score > 0)
      .transition().duration(500)
      .attr('r', d => d.r)
      .attr('fill', d => {
        if (d.rank === 0) return COLOR_TOP;
        if (d.rank <= 2) return COLOR_HIGH;
        return scoreGradient(d.score / maxScore);
      })
      // fill-opacity encodes how many selected symptoms the disease has matched
      // (not the ratio), so adding a new unmatched symptom never dims a bubble.
      // Formula 1−0.5^n: 0 matches→0.18, 1→0.59, 2→0.79, 3→0.89, 4+→≈1.0
      .attr('fill-opacity', d => 0.18 + 0.82 * (1 - Math.pow(0.5, d.matchedCount)))
      .attr('opacity', 1);

    if (mode === 'exploratory') autoFitView(dynamicMax);

    const labelNodes = sorted.slice(0, 7).filter(n => n.r >= 14);
    labels = labelGroup.selectAll('text')
      .data(labelNodes, d => d.disease)
      .join(
        enter => enter.append('text')
          .attr('text-anchor', 'middle').attr('fill', '#fff')
          .attr('font-weight', '600').attr('pointer-events', 'none')
          .attr('opacity', 0)
          .call(s => s.transition().duration(400).attr('opacity', 1)),
        update => update,
        exit => exit.transition().duration(200).attr('opacity', 0).remove()
      )
      .attr('font-size', d => Math.min(12, d.r * 0.33) + 'px')
      .text(d => d.disease.length > 14 ? d.disease.slice(0, 13) + '\u2026' : d.disease);

    refreshSymptomList(allActive.map(n => n.disease));

    if (mode === 'exploratory') {
      // Remove centering force — poles define all positioning.
      // forceX/Y pull each node toward its computed cluster target; a mild
      // repulsion spreads overlapping nodes within each cluster so the star
      // shape is visible. Collision handles tight packing. Simulation settles
      // quickly with alphaDecay 0.03 (~1.5s) so bubbles feel static.
      simulation.force('center', null);
      simulation.force('charge', d3.forceManyBody().strength(-8).distanceMax(120));
      simulation.force('x', d3.forceX(d => d.filtered ? d.x : d.targetX).strength(d => d.filtered ? 0 : 0.3));
      simulation.force('y', d3.forceY(d => d.filtered ? d.y : d.targetY).strength(d => d.filtered ? 0 : 0.3));
    }

    simulation.force('collision', d3.forceCollide().radius(d => d.filtered ? 0 : d.r + 2).strength(0.85));
    simulation.alpha(0.5).restart();

    if (mode === 'diagnostic') checkTerminal(allActive);
  }

  function refreshSymptomList(remainingDiseases) {
    const exhaustedMsg = panel.querySelector('.symptom-exhausted-msg');
    if (!remainingDiseases || mode === 'exploratory') {
      listEl.querySelectorAll('label').forEach(label => {
        label.classList.remove('symptom-unavailable');
        const q = searchInput.value.toLowerCase();
        label.style.display = label.dataset.symptom.toLowerCase().includes(q) ? '' : 'none';
      });
      if (exhaustedMsg) exhaustedMsg.style.display = 'none';
      return;
    }
    const remaining = new Set(remainingDiseases);
    const available = new Set();
    diseaseData.forEach(row => {
      if (!remaining.has(row.disease)) return;
      symptomList.forEach(s => { if ((row[s] || 0) > 0) available.add(s); });
    });

    // Check if all selectable symptoms are already selected (diseases indistinguishable)
    const unselectedAvailable = [...available].filter(s => !selectedSymptoms.includes(s));
    const exhausted = selectedSymptoms.length > 0 && unselectedAvailable.length === 0 && remainingDiseases.length > 1;
    if (exhaustedMsg) exhaustedMsg.style.display = exhausted ? '' : 'none';
    if (exhausted) pulseRemainingBubbles();

    const q = searchInput.value.toLowerCase();
    listEl.querySelectorAll('label').forEach(label => {
      const s = label.dataset.symptom;
      const isSelected = selectedSymptoms.includes(s);
      if (!available.has(s) && !isSelected) {
        label.classList.add('symptom-unavailable');
        label.style.display = 'none';
      } else {
        label.classList.remove('symptom-unavailable');
        label.style.display = s.toLowerCase().includes(q) ? '' : 'none';
      }
    });
  }

  // Grow large → bounce back → small overshoot → settle — reads as a celebratory shake
  function pulseBubble(el, r) {
    el.interrupt()
      .transition().duration(180).attr('r', r * 1.45)
      .transition().duration(120).attr('r', r * 1.1)
      .transition().duration(100).attr('r', r * 1.3)
      .transition().duration(100).attr('r', r * 0.95)
      .transition().duration(130).attr('r', r);
  }

  function pulseRemainingBubbles() {
    bubbleGroup.selectAll('circle.bubble')
      .filter(d => !d.filtered)
      .each(function(d) { pulseBubble(d3.select(this), d.r); });
  }

  // Pulse bubbles where ALL of the disease's own symptoms are now selected
  // (no remaining symptoms left to further narrow this disease)
  function pulseFullCoverageBubbles() {
    if (selectedSymptoms.length === 0) return;
    bubbleGroup.selectAll('circle.bubble')
      .filter(d => !d.filtered && d.matchedCount === diseaseSymptomCount[d.disease])
      .each(function(d) { pulseBubble(d3.select(this), d.r); });
  }

  function checkTerminal(survivors) {
    svg.selectAll('.terminal-msg').remove();
    if (survivors.length === 1) {
      const node = survivors[0];
      svg.append('text').attr('class', 'terminal-msg')
        .attr('x', width / 2).attr('y', 26)
        .attr('text-anchor', 'middle').attr('fill', COLOR_TOP)
        .attr('font-size', '14px').attr('font-weight', '600')
        .attr('pointer-events', 'none').attr('opacity', 0)
        .text(`Best match: ${node.disease}`)
        .transition().duration(400).attr('opacity', 1);
      setTimeout(() => {
        playRipple(node.x, node.y, node.r, COLOR_TOP);
        setTimeout(() => playRipple(node.x, node.y, node.r + 15, COLOR_HIGH), 200);
      }, 900);
    } else if (survivors.length === 0) {
      svg.append('text').attr('class', 'terminal-msg')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#e57373')
        .attr('font-size', '14px').attr('pointer-events', 'none').attr('opacity', 0)
        .text('No matching diseases \u2014 try removing a symptom')
        .transition().duration(400).attr('opacity', 1);
    }
  }
}
