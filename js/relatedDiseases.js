// ============================================
// relatedDiseases.js — Vis 4: Related Disease Germ Chart
// ============================================
//
// Spike length   ∝  Jaccard similarity         (per-set normalized)
// Spike width    ∝  % of selected disease's symptoms shared (per-set normalized)
// Tip dots       =  # shared symptoms           (each dot = 1 symptom, max 16)
//
// Clicking a tip: germ shifts left, spine plot appears on the right.
// Back button: germ animates back to center, spine plot fades out.

function initRelatedDiseases() {
  const section = document.getElementById('related-diseases');
  const card = document.getElementById('related-diseases-card');
  const descNameEl = document.getElementById('related-disease-name');
  if (!card) return;

  const SPIKE_COLOR = '#4cc9f0';
  const CENTER_R    = 52;
  const TIP_R       = 18;
  const MAX_DOTS    = 16;
  const DOT_R       = 2.2;
  const DOT_ORBIT   = TIP_R + DOT_R + 3;

  let germG      = null;   // main germ SVG group
  let radarG     = null;   // radar SVG group (null when hidden)
  let currentDisease = null;
  let svgW = 0, svgH = 0;

  // ── Symptom-count cache ───────────────────────────────────────────────────
  let symCountMap = null;
  function getSymCount(name) {
    if (!symCountMap) {
      symCountMap = {};
      AppState.diseaseData.forEach(row => {
        symCountMap[row.disease] = AppState.symptomList.filter(s => row[s] > 0).length;
      });
    }
    return symCountMap[name] || 0;
  }

  // ── Slider ────────────────────────────────────────────────────────────────
  let nToShow = 5;
  const slider      = document.getElementById('related-n-slider');
  const sliderLabel = document.getElementById('related-n-label');
  const backBtn     = document.getElementById('related-back-btn-el');

  if (slider) {
    slider.addEventListener('input', () => {
      nToShow = +slider.value;
      sliderLabel.textContent = nToShow;
      if (currentDisease) {
        hideComparison(/* skipGermRender= */ false);
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => hideComparison(false));
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const tooltip = (() => {
    let el = document.getElementById('ribbon-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ribbon-tooltip';
      Object.assign(el.style, {
        position: 'fixed', display: 'none',
        background: '#161b22', border: '1px solid #30363d',
        color: '#e6edf3', padding: '8px 12px', borderRadius: '6px',
        fontSize: '12px', pointerEvents: 'none', zIndex: '1000',
        maxWidth: '220px', lineHeight: '1.7',
      });
      document.body.appendChild(el);
    }
    return el;
  })();

  function showTip(event, item) {
    const { relName, shared, jaccard } = item;
    tooltip.innerHTML = [
      `<strong>${relName}</strong>`,
      `${shared} shared symptoms`,
      `${(jaccard * 100).toFixed(1)}% Jaccard similarity`,
      `<em style="color:#8b949e">Click to compare</em>`,
    ].join('<br>');
    tooltip.style.display = 'block';
    tooltip.style.left = (event.clientX + 14) + 'px';
    tooltip.style.top  = (event.clientY - 32) + 'px';
  }
  function moveTip(e) {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top  = (e.clientY - 32) + 'px';
  }
  function hideTip() { tooltip.style.display = 'none'; }

  // ── Disease selection callback ────────────────────────────────────────────
  AppState.onDiseaseSelect.push(name => {
    currentDisease = name;

    if (!name) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    if (descNameEl) descNameEl.textContent = name;

    if (radarG) { radarG.interrupt(); radarG.remove(); radarG = null; }
    if (germG)  { germG.interrupt();  germG.remove();  germG  = null; }
    if (backBtn) backBtn.style.display = 'none';
    renderGerm(name);
  });

  // ── Comparison helpers ────────────────────────────────────────────────────
  function showComparison(item) {
    hideTip();

    if (backBtn) backBtn.style.display = '';

    const cx = svgW / 2, cy = svgH / 2;

    // Animate germ to left half, scaled down
    germG.transition().duration(600).ease(d3.easeCubicInOut)
      .attr('transform', `translate(${cx * 0.52},${cy}) scale(0.58)`);

    // Remove old radar if switching to a different related disease
    if (radarG) {
      radarG.transition().duration(200).attr('opacity', 0)
        .on('end', () => { radarG.remove(); radarG = null; renderSpinePlot(item); });
    } else {
      renderSpinePlot(item);
    }
  }

  function hideComparison(skipRender) {

    hideTip();
    if (backBtn) backBtn.style.display = 'none';

    if (radarG) {
      radarG.transition().duration(300).attr('opacity', 0)
        .on('end', () => { radarG.remove(); radarG = null; });
    }

    if (germG) {
      const cx = svgW / 2, cy = svgH / 2;
      germG.transition().duration(550).ease(d3.easeCubicInOut)
        .attr('transform', `translate(${cx},${cy}) scale(1)`);
    }

    if (!skipRender && currentDisease) {
      // Re-render germ fresh (new n slider value etc.) after animation
      setTimeout(() => renderGerm(currentDisease), 560);
    }
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderGerm(diseaseName) {
    const svg = d3.select('#related-ribbon-svg');
    svg.selectAll('*').interrupt().remove();
    germG = null; radarG = null;

    if (!diseaseName) return;

    const meta    = AppState.metadata.find(m => m.disease === diseaseName);
    const related = meta?.related_diseases;

    if (!related || related.length === 0) {
      svg.append('text')
        .attr('x', '50%').attr('y', '50%')
        .attr('dominant-baseline', 'middle').attr('text-anchor', 'middle')
        .attr('fill', '#8b949e').attr('font-size', '13px')
        .text('No related disease data available.');
      return;
    }

    const hasRich     = typeof related[0] === 'object';
    const sourceTotal = getSymCount(diseaseName);
    const n           = Math.min(nToShow, related.length);

    const container = document.getElementById('related-ribbon-container');
    svgW = container.clientWidth || 500;
    svgH = Math.max(360, Math.min(500, svgW * 0.72));
    const cx = svgW / 2, cy = svgH / 2;

    svg.attr('width', svgW).attr('height', svgH);

    const maxRadius = Math.min(cx, cy) - 10;
    const labelPad  = 52;
    const spikeMax  = maxRadius - CENTER_R - DOT_ORBIT - labelPad;
    const spikeMin  = spikeMax * 0.32;

    const items = related.slice(0, n).map((rel, i) => {
      const relName     = hasRich ? rel.disease : rel;
      const shared      = hasRich ? (rel.shared_symptoms || 0) : 0;
      const targetTotal = getSymCount(relName);
      const union       = sourceTotal + targetTotal - shared;
      const jaccard     = union > 0 ? shared / union : 0;
      const pctSource   = sourceTotal > 0 ? shared / sourceTotal : 0;
      const angle       = -Math.PI / 2 + (2 * Math.PI * i / n);
      return { relName, shared, sourceTotal, targetTotal, jaccard, pctSource, angle };
    });

    // Per-set Jaccard normalization (length)
    const jVals   = items.map(d => d.jaccard);
    const jMin    = d3.min(jVals), jMax = d3.max(jVals);
    const jSpread = jMax - jMin;
    const jDomLo  = jSpread < 0.01 ? jMax * 0.75 : jMin - jSpread * 0.08;
    const jDomHi  = jSpread < 0.01 ? jMax * 1.05  : jMax + jSpread * 0.08;
    const lengthScale = d3.scaleLinear().domain([jDomLo, jDomHi]).range([spikeMin, spikeMax]).clamp(true);

    // Per-set pctSource normalization (base width)
    const pVals   = items.map(d => d.pctSource);
    const pMin    = d3.min(pVals), pMax = d3.max(pVals);
    const pSpread = pMax - pMin;
    const pDomLo  = pSpread < 0.02 ? pMax * 0.6 : pMin - pSpread * 0.05;
    const pDomHi  = pSpread < 0.02 ? pMax * 1.2  : pMax + pSpread * 0.05;
    const widthScale = d3.scaleLinear().domain([pDomLo, pDomHi]).range([3, 20]).clamp(true);

    // ── SVG defs ─────────────────────────────────────────────────────────────
    const defs = svg.append('defs');

    defs.append('filter').attr('id', 'germ-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
      .call(f => {
        f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
        const merge = f.append('feMerge');
        merge.append('feMergeNode').attr('in', 'blur');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');
      });

    const grad = defs.append('radialGradient').attr('id', 'germ-center-grad')
      .attr('cx', '38%').attr('cy', '32%').attr('r', '65%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#1a4a7a');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#060e18');

    // ── Germ group (all coords relative to 0,0 = center) ─────────────────────
    germG = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    items.forEach((item, i) => {
      const { relName, jaccard, pctSource, shared, angle } = item;
      const L   = lengthScale(jaccard);
      const bw  = widthScale(pctSource);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const tipX = (CENTER_R + L) * cos;
      const tipY = (CENTER_R + L) * sin;

      // Spike body
      germG.append('path')
        .attr('d', spikePath(angle, L, bw))
        .attr('fill', SPIKE_COLOR)
        .attr('opacity', 0)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this).attr('opacity', 1);
          showTip(event, item);
        })
        .on('mousemove', moveTip)
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 0.80);
          hideTip();
        })
        .on('click', () => showComparison(item))
        .transition().duration(500).delay(40 + i * 55)
        .attr('opacity', 0.80);

      // Tip circle
      germG.append('circle')
        .attr('cx', tipX).attr('cy', tipY)
        .attr('r', TIP_R)
        .attr('fill', SPIKE_COLOR)
        .attr('stroke', '#a5f3fc').attr('stroke-width', 1.2)
        .attr('filter', 'url(#germ-glow)')
        .attr('opacity', 0)
        .style('cursor', 'pointer')
        .on('mouseover', event => showTip(event, item))
        .on('mousemove', moveTip)
        .on('mouseout', hideTip)
        .on('click', () => showComparison(item))
        .transition().duration(500).delay(40 + i * 55)
        .attr('opacity', 1);

      // Perimeter dots = # shared symptoms
      const nDots = Math.min(shared, MAX_DOTS);
      for (let d = 0; d < nDots; d++) {
        const da = (2 * Math.PI * d) / nDots;
        germG.append('circle')
          .attr('cx', tipX + DOT_ORBIT * Math.cos(da))
          .attr('cy', tipY + DOT_ORBIT * Math.sin(da))
          .attr('r', DOT_R)
          .attr('fill', '#a5f3fc')
          .attr('pointer-events', 'none')
          .attr('opacity', 0)
          .transition().duration(500).delay(40 + i * 55)
          .attr('opacity', 0.85);
      }

      // Label
      const labelLines = wrapLabel(relName, 14);
      // For upward-pointing spikes, extra wrapped lines go toward center — push label further out
      const extraPad = sin < -0.35 ? (labelLines.length - 1) * 13 : 0;
      const lDist = CENTER_R + L + DOT_ORBIT + DOT_R + 5 + extraPad;
      const lx = lDist * cos;
      const ly = lDist * sin;
      const anchor   = Math.abs(cos) < 0.28 ? 'middle' : cos > 0 ? 'start' : 'end';
      const baseline = Math.abs(sin) < 0.28 ? 'middle' : sin > 0 ? 'hanging' : 'auto';

      const labelEl = germG.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', baseline)
        .attr('class', 'ribbon-label')
        .style('cursor', 'pointer')
        .on('mouseover', event => showTip(event, item))
        .on('mousemove', moveTip)
        .on('mouseout', hideTip)
        .on('click', () => showComparison(item));

      labelLines.forEach((line, li) => {
        labelEl.append('tspan').attr('x', lx).attr('dy', li === 0 ? 0 : '12px').text(line);
      });
    });

    // Center circle
    germG.append('circle')
      .attr('r', CENTER_R)
      .attr('fill', 'url(#germ-center-grad)')
      .attr('stroke', '#58a6ff').attr('stroke-width', 2.5)
      .attr('filter', 'url(#germ-glow)');

    const nameLines = wrapCenter(diseaseName, CENTER_R);
    const lineH = 13;
    nameLines.forEach((line, li) => {
      germG.append('text')
        .attr('x', 0)
        .attr('y', -(nameLines.length - 1) * lineH / 2 + li * lineH)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('class', 'ribbon-center-label')
        .text(line);
    });

    // ── Legend (inside germG — moves with germ animation) ────────────────────
    // Position: bottom-LEFT of SVG in germG-relative coords.
    // legX = -cx*0.74 keeps the box on-screen even after the 0.58-scale animation.
    const LEG_W = 190, LEG_H = 178;
    const LH = 48, iconX = 10, textX = 44;
    const legG = svg.append('g').attr('transform', `translate(12,12)`);

    legG.append('rect')
      .attr('width', LEG_W).attr('height', LEG_H)
      .attr('fill', '#0d1117').attr('fill-opacity', 0.92)
      .attr('rx', 7).attr('stroke', '#3d4450').attr('stroke-width', 1.2);

    // Title
    legG.append('text').attr('x', LEG_W / 2).attr('y', 14)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('class', 'ribbon-label').attr('font-size', '9px')
      .attr('fill', '#8b949e').attr('letter-spacing', '0.08em')
      .text('LEGEND');
    legG.append('line')
      .attr('x1', 10).attr('x2', LEG_W - 10).attr('y1', 22).attr('y2', 22)
      .attr('stroke', '#30363d').attr('stroke-width', 0.8);

    // Each row: label + description line; icon showing the visual encoding
    const rows = [
      {
        icon: (iy) => {
          // Short line (less similar) above, longer line (more similar) below
          legG.append('line')
            .attr('x1', iconX).attr('x2', iconX + 12).attr('y1', iy - 5).attr('y2', iy - 5)
            .attr('stroke', SPIKE_COLOR).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('opacity', 0.5);
          legG.append('line')
            .attr('x1', iconX).attr('x2', iconX + 23).attr('y1', iy + 4).attr('y2', iy + 4)
            .attr('stroke', SPIKE_COLOR).attr('stroke-width', 2.5).attr('stroke-linecap', 'round');
        },
        label: 'Spike Length',
        lines: ['longer → more similar'],
      },
      {
        icon: (iy) => {
          // Narrow rect above, wide rect below
          legG.append('rect').attr('x', iconX).attr('y', iy - 7).attr('width', 22).attr('height', 4).attr('fill', SPIKE_COLOR).attr('rx', 1).attr('opacity', 0.5);
          legG.append('rect').attr('x', iconX).attr('y', iy + 2).attr('width', 22).attr('height', 9).attr('fill', SPIKE_COLOR).attr('rx', 1);
        },
        label: 'Spike Width',
        lines: ['wider →', 'more % symptoms shared'],
      },
      {
        icon: (iy) => {
          const mR = 6, mDR = 2, mOrb = 11, mCx = iconX + mR + 2;
          legG.append('circle').attr('cx', mCx).attr('cy', iy).attr('r', mR)
            .attr('fill', SPIKE_COLOR).attr('fill-opacity', 0.55).attr('stroke', '#a5f3fc').attr('stroke-width', 1);
          [0, 1, 2, 3].forEach(d => {
            const da = (Math.PI / 2) * d;
            legG.append('circle').attr('cx', mCx + mOrb * Math.cos(da)).attr('cy', iy + mOrb * Math.sin(da)).attr('r', mDR).attr('fill', '#a5f3fc');
          });
        },
        label: 'Tip Dots',
        lines: ['more dots →', '# shared symptoms'],
      },
    ];

    rows.forEach(({ icon, label, lines }, ri) => {
      const ry = 28 + ri * LH;
      icon(ry + 12);
      legG.append('text').attr('x', textX).attr('y', ry)
        .attr('dominant-baseline', 'hanging').attr('class', 'ribbon-label')
        .attr('font-size', '10px').attr('fill', '#c9d1d9').attr('font-weight', '600').text(label);
      lines.forEach((line, li) => {
        legG.append('text').attr('x', textX).attr('y', ry + 15 + li * 11)
          .attr('dominant-baseline', 'hanging').attr('class', 'ribbon-label')
          .attr('font-size', '9px').attr('fill', '#6e7681').text(line);
      });
    });
  }

  // ── Spine plot (horizontal butterfly) ────────────────────────────────────
  // Each row = one symptom. Bars extend LEFT for disease A, RIGHT for disease B.
  // Rows sorted into three groups: only-A (top) | shared (middle) | only-B (bottom).
  // Row height ∝ max(a,b).
  function renderSpinePlot(item) {
    const rowA = AppState.diseaseData.find(d => d.disease === currentDisease);
    const rowB = AppState.diseaseData.find(d => d.disease === item.relName);
    if (!rowA || !rowB) return;

    const all = AppState.symptomList
      .filter(s => rowA[s] > 0 || rowB[s] > 0)
      .map(s => ({ name: s.replace(/_/g, ' '), a: rowA[s] || 0, b: rowB[s] || 0 }));

    const onlyA  = all.filter(d => d.a > 0 && d.b === 0).sort((x,y) => y.a - x.a).slice(0, 5);
    const shared = all.filter(d => d.a > 0 && d.b > 0).sort((x,y) => (y.a+y.b)-(x.a+x.b)).slice(0, 5);
    const onlyB  = all.filter(d => d.a === 0 && d.b > 0).sort((x,y) => y.b - x.b).slice(0, 5);
    const symptoms = [...onlyA, ...shared, ...onlyB];
    if (symptoms.length === 0) return;

    const svg   = d3.select('#related-ribbon-svg');
    const cx    = svgW / 2, cy = svgH / 2;
    const halfW = Math.min(cx * 0.36, 125);

    const labelA = currentDisease.length > 20 ? currentDisease.slice(0, 18) + '…' : currentDisease;
    const labelB = item.relName.length   > 20 ? item.relName.slice(0, 18)   + '…' : item.relName;

    radarG = svg.append('g')
      .attr('transform', `translate(${cx * 1.52},${cy})`)
      .attr('opacity', 0);

    // ── Row heights ───────────────────────────────────────────────────────────
    const GAP    = 2;
    const totalH = Math.min(cy * 1.4, svgH * 0.66);
    const maxC   = symptoms.map(d => Math.max(d.a, d.b));
    const sumMax = d3.sum(maxC);
    const avail  = totalH - GAP * (symptoms.length - 1);
    const scaledH = maxC.map(m => Math.max((m / sumMax) * avail, 7));
    // Re-normalise so they sum exactly to avail
    const sumH   = d3.sum(scaledH);
    for (let i = 0; i < scaledH.length; i++) scaledH[i] = scaledH[i] * avail / sumH;
    const chartH = d3.sum(scaledH) + GAP * (symptoms.length - 1);

    // ── Vertical guide lines (behind bars) ───────────────────────────────────
    const tickFracs = [0.25, 0.5, 0.75, 1.0];
    const tickY = chartH / 2 + 5;
    tickFracs.forEach(frac => {
      [-1, 1].forEach(dir => {
        radarG.append('line')
          .attr('x1', dir * frac * halfW).attr('x2', dir * frac * halfW)
          .attr('y1', -chartH / 2 - 4).attr('y2', tickY)
          .attr('stroke', frac === 1.0 ? '#3a3f47' : '#252b33')
          .attr('stroke-width', frac === 1.0 ? 0.8 : 0.5)
          .attr('stroke-dasharray', frac === 1.0 ? '' : '2,4');
        // Tick label (only on positive side to avoid duplicate 0%)
        const pct = Math.round(frac * 100);
        radarG.append('text')
          .attr('x', dir * frac * halfW).attr('y', tickY + 9)
          .attr('text-anchor', 'middle').attr('class', 'ribbon-label')
          .attr('font-size', '7px').attr('fill', '#6e7681')
          .text(pct + '%');
      });
    });
    // 0% label at center
    radarG.append('text')
      .attr('x', 0).attr('y', tickY + 9)
      .attr('text-anchor', 'middle').attr('class', 'ribbon-label')
      .attr('font-size', '7px').attr('fill', '#6e7681')
      .text('0%');
    // X-axis title
    radarG.append('text')
      .attr('x', 0).attr('y', tickY + 20)
      .attr('text-anchor', 'middle').attr('class', 'ribbon-label')
      .attr('font-size', '7.5px').attr('fill', '#8b949e').attr('font-style', 'italic')
      .text('symptom correlation (% of diagnoses)');

    // ── Centre divider ────────────────────────────────────────────────────────
    radarG.append('line')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', -chartH / 2 - 4).attr('y2', chartH / 2 + 4)
      .attr('stroke', '#666').attr('stroke-width', 1.2);

    // ── Section boundaries + labels (computed with clean index ranges) ────────
    const sections = [
      { items: onlyA,  label: 'only ' + labelA, color: '#58a6ff' },
      { items: shared, label: 'shared',          color: '#8b949e' },
      { items: onlyB,  label: 'only ' + labelB,  color: '#b39ddb' },
    ];
    let idxOffset = 0;
    let yOffset   = -chartH / 2;
    sections.forEach(({ items, label, color }, si) => {
      if (items.length === 0) return;
      const secH = d3.sum(scaledH.slice(idxOffset, idxOffset + items.length))
                 + GAP * (items.length - 1);

      // Section label at right margin
      radarG.append('text')
        .attr('x', halfW + 6).attr('y', yOffset + secH / 2)
        .attr('dominant-baseline', 'middle').attr('class', 'ribbon-label')
        .attr('fill', color).attr('font-size', '8px').attr('font-style', 'italic')
        .text(label);

      // Dashed divider after each section except the last
      if (si < sections.filter(s => s.items.length > 0).length - 1) {
        const divY = yOffset + secH + GAP / 2;
        radarG.append('line')
          .attr('x1', -halfW).attr('x2', halfW)
          .attr('y1', divY).attr('y2', divY)
          .attr('stroke', '#444').attr('stroke-width', 0.8).attr('stroke-dasharray', '4,3');
      }

      idxOffset += items.length;
      yOffset   += secH + GAP;
    });

    // ── Rows ──────────────────────────────────────────────────────────────────
    let yPos = -chartH / 2;
    symptoms.forEach((d, i) => {
      const sh = scaledH[i];

      if (d.a > 0) {
        radarG.append('rect')
          .attr('x', -d.a * halfW).attr('y', yPos)
          .attr('width', d.a * halfW).attr('height', sh)
          .attr('fill', '#58a6ff').attr('fill-opacity', 0.75).attr('rx', 1);
      }
      if (d.b > 0) {
        radarG.append('rect')
          .attr('x', 0).attr('y', yPos)
          .attr('width', d.b * halfW).attr('height', sh)
          .attr('fill', '#7e57c2').attr('fill-opacity', 0.75).attr('rx', 1);
      }

      // Symptom label: right-aligned outside all bars (left edge of chart)
      const lbl = d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name;
      radarG.append('text')
        .attr('x', -halfW - 6).attr('y', yPos + sh / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('class', 'ribbon-label').attr('font-size', '9px').attr('fill', '#c9d1d9')
        .text(lbl);

      yPos += sh + GAP;
    });

    // ── Direction labels above chart ──────────────────────────────────────────
    const topY = -chartH / 2 - 14;
    radarG.append('text').attr('x', -halfW * 0.5).attr('y', topY)
      .attr('text-anchor', 'middle').attr('class', 'ribbon-label')
      .attr('fill', '#58a6ff').attr('font-size', '9px').text('◀ ' + labelA);
    radarG.append('text').attr('x', halfW * 0.5).attr('y', topY)
      .attr('text-anchor', 'middle').attr('class', 'ribbon-label')
      .attr('fill', '#b39ddb').attr('font-size', '9px').text(labelB + ' ▶');

    // ── Explore button (bottom-left, below axis title) ────────────────────────
    const btnY = tickY + 56;
    const navG = radarG.append('g')
      .attr('transform', `translate(${-halfW},${btnY})`).style('cursor', 'pointer')
      .on('click', () => {
        AppState.selectedDisease = item.relName;
        AppState.onDiseaseSelect.forEach(fn => fn(item.relName));
      });
    // Truncate to ~11 chars so "Explore [name] →" always fits at 11px
    const btnLabel = item.relName.length > 11 ? item.relName.slice(0, 10) + '…' : item.relName;
    const btnW = Math.min(halfW * 1.6, 160);
    navG.append('rect')
      .attr('x', 0).attr('y', -13).attr('width', btnW).attr('height', 26)
      .attr('rx', 5)
      .attr('fill', 'rgba(126,87,194,0.22)')
      .attr('stroke', '#9d6fe8').attr('stroke-width', 1.5);
    navG.append('text')
      .attr('x', btnW / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('class', 'ribbon-label').attr('fill', '#d4b8f0').attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(`Explore ${btnLabel} →`);

    radarG.transition().duration(550).delay(200).attr('opacity', 1);
  }

  // ── Spike path (relative to 0,0 center in group) ──────────────────────────
  function spikePath(angle, length, baseWidth) {
    const cos  = Math.cos(angle), sin = Math.sin(angle);
    const perp = [-sin, cos];
    const bh   = baseWidth / 2;
    const th   = 1.8;
    const bx   = CENTER_R * cos,             by  = CENTER_R * sin;
    const tx   = (CENTER_R + length) * cos,  ty  = (CENTER_R + length) * sin;
    const k    = length * 0.42;

    return [
      `M ${bx + bh * perp[0]} ${by + bh * perp[1]}`,
      `C ${bx + bh * perp[0] + k * cos} ${by + bh * perp[1] + k * sin}`,
      `  ${tx + th * perp[0] - k * 0.2 * cos} ${ty + th * perp[1] - k * 0.2 * sin}`,
      `  ${tx + th * perp[0]} ${ty + th * perp[1]}`,
      `L ${tx - th * perp[0]} ${ty - th * perp[1]}`,
      `C ${tx - th * perp[0] - k * 0.2 * cos} ${ty - th * perp[1] - k * 0.2 * sin}`,
      `  ${bx - bh * perp[0] + k * cos} ${by - bh * perp[1] + k * sin}`,
      `  ${bx - bh * perp[0]} ${by - bh * perp[1]}`,
      'Z',
    ].join(' ');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function wrapLabel(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (trial.length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = trial;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }

  function wrapCenter(text, r) {
    return wrapLabel(text, Math.max(Math.floor(r * 0.26), 8));
  }
}
