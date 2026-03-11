// ============================================
// relatedDiseases.js — Vis 4: Related Disease Germ Chart
// ============================================
//
// Styled like a virus: central "cell" = selected disease,
// radiating spikes = related diseases.
//
// Spike length       ∝  Jaccard similarity         (longer = more similar)
// Spike base width   ∝  shared / source_total      (% of selected disease's symptoms)
// Tip circle radius  ∝  shared / target_total      (% of related disease's symptoms)
//
// Single spike color — no color encoding (spike length carries the similarity signal).
// Clicking a tip navigates to that disease.

function initRelatedDiseases() {
  const card = document.getElementById('related-diseases-card');
  if (!card) return;

  const SPIKE_COLOR = '#4cc9f0';  // bioluminescent cyan-blue
  const CENTER_R    = 52;

  const baseWidthScale = d3.scaleLinear().domain([0, 1]).range([3, 16]);
  const tipRadiusScale = d3.scaleLinear().domain([0, 1]).range([5, 15]);

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
  let currentDisease = null;

  const slider = document.getElementById('related-n-slider');
  const sliderLabel = document.getElementById('related-n-label');
  if (slider) {
    slider.addEventListener('input', () => {
      nToShow = +slider.value;
      sliderLabel.textContent = nToShow;
      if (currentDisease) renderGerm(currentDisease);
    });
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
        maxWidth: '240px', lineHeight: '1.7',
      });
      document.body.appendChild(el);
    }
    return el;
  })();

  function showTip(event, item) {
    const { relName, shared, sourceTotal, targetTotal, jaccard, pctSource, pctTarget } = item;
    tooltip.innerHTML = [
      `<strong>${relName}</strong>`,
      `${shared}/${sourceTotal} of selected &nbsp;·&nbsp; ${shared}/${targetTotal} of this`,
      `${(pctSource * 100).toFixed(0)}% ↔ ${(pctTarget * 100).toFixed(0)}%`,
      `Jaccard: ${jaccard.toFixed(3)}`,
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
    renderGerm(name);
  });

  // ── Main render ───────────────────────────────────────────────────────────
  function renderGerm(diseaseName) {
    const svg = d3.select('#related-ribbon-svg');
    svg.selectAll('*').remove();

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
    const width     = container.clientWidth  || 500;
    const height    = Math.max(340, Math.min(460, width * 0.75));

    svg.attr('width', width).attr('height', height);

    const cx = width / 2, cy = height / 2;

    // Dynamic length bounds
    const maxRadius = Math.min(cx, cy) - 8;
    const labelPad  = 46;
    const maxTipR   = 15;
    const spikeMax  = maxRadius - CENTER_R - maxTipR - labelPad;
    const spikeMin  = spikeMax * 0.32;

    // Compute per-spike metrics (need jaccard values before building scale)
    const items = related.slice(0, n).map((rel, i) => {
      const relName     = hasRich ? rel.disease : rel;
      const shared      = hasRich ? (rel.shared_symptoms || 0) : 0;
      const targetTotal = getSymCount(relName);
      const union       = sourceTotal + targetTotal - shared;
      const jaccard     = union > 0 ? shared / union : 0;
      const pctSource   = sourceTotal > 0 ? shared / sourceTotal : 0;
      const pctTarget   = targetTotal > 0 ? shared / targetTotal : 0;
      const angle       = -Math.PI / 2 + (2 * Math.PI * i / n);
      return { relName, shared, sourceTotal, targetTotal, jaccard, pctSource, pctTarget, angle };
    });

    // Normalize length scale to this disease's actual Jaccard range so
    // differences always use the full [spikeMin, spikeMax] span
    const jVals   = items.map(d => d.jaccard);
    const jMin    = d3.min(jVals), jMax = d3.max(jVals);
    const jSpread = jMax - jMin;
    const domLo   = jSpread < 0.01 ? jMax * 0.75 : jMin - jSpread * 0.08;
    const domHi   = jSpread < 0.01 ? jMax * 1.05  : jMax + jSpread * 0.08;
    const lengthScale = d3.scaleLinear().domain([domLo, domHi]).range([spikeMin, spikeMax]).clamp(true);

    const g = svg.append('g');

    // ── SVG defs ─────────────────────────────────────────────────────────────
    const defs = svg.append('defs');

    // Glow filter for center circle and tip nodes
    defs.append('filter').attr('id', 'germ-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
      .call(f => {
        f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
        const merge = f.append('feMerge');
        merge.append('feMergeNode').attr('in', 'blur');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');
      });

    // Radial gradient for center circle
    const grad = defs.append('radialGradient').attr('id', 'germ-center-grad')
      .attr('cx', '38%').attr('cy', '32%').attr('r', '65%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#1a4a7a');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#060e18');

    // ── Spikes ────────────────────────────────────────────────────────────────
    items.forEach((item, i) => {
      const { relName, jaccard, pctSource, pctTarget, angle } = item;
      const L    = lengthScale(jaccard);
      const bw   = baseWidthScale(pctSource);
      const tr   = tipRadiusScale(pctTarget);
      const cos  = Math.cos(angle), sin = Math.sin(angle);
      const tipX = cx + (CENTER_R + L) * cos;
      const tipY = cy + (CENTER_R + L) * sin;

      // Spike body
      g.append('path')
        .attr('d', spikePath(cx, cy, angle, L, bw))
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
        .on('click', () => selectDisease(relName))
        .transition().duration(500).delay(40 + i * 55)
        .attr('opacity', 0.80);

      // Tip circle
      g.append('circle')
        .attr('cx', tipX).attr('cy', tipY)
        .attr('r', tr)
        .attr('fill', SPIKE_COLOR)
        .attr('stroke', '#a5f3fc').attr('stroke-width', 1.2)
        .attr('filter', 'url(#germ-glow)')
        .attr('opacity', 0)
        .style('cursor', 'pointer')
        .on('mouseover', event => showTip(event, item))
        .on('mousemove', moveTip)
        .on('mouseout', hideTip)
        .on('click', () => selectDisease(relName))
        .transition().duration(500).delay(40 + i * 55)
        .attr('opacity', 1);

      // Label just beyond the tip circle
      const lDist = CENTER_R + L + tr + 7;
      const lx = cx + lDist * cos;
      const ly = cy + lDist * sin;
      const anchor   = Math.abs(cos) < 0.28 ? 'middle' : cos > 0 ? 'start' : 'end';
      const baseline = Math.abs(sin) < 0.28 ? 'middle' : sin > 0 ? 'hanging' : 'auto';

      const lines = wrapLabel(relName, 14);
      const labelEl = g.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', baseline)
        .attr('class', 'ribbon-label')
        .style('cursor', 'pointer')
        .on('click', () => selectDisease(relName));

      lines.forEach((line, li) => {
        labelEl.append('tspan').attr('x', lx).attr('dy', li === 0 ? 0 : '12px').text(line);
      });
    });

    // ── Center circle ────────────────────────────────────────────────────────
    g.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', CENTER_R)
      .attr('fill', 'url(#germ-center-grad)')
      .attr('stroke', '#58a6ff').attr('stroke-width', 2.5)
      .attr('filter', 'url(#germ-glow)');

    const nameLines = wrapCenter(diseaseName, CENTER_R);
    const lineH = 13;
    nameLines.forEach((line, li) => {
      g.append('text')
        .attr('x', cx)
        .attr('y', cy - (nameLines.length - 1) * lineH / 2 + li * lineH)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('class', 'ribbon-center-label')
        .text(line);
    });

  }

  // ── Spike path ────────────────────────────────────────────────────────────
  function spikePath(cx, cy, angle, length, baseWidth) {
    const cos  = Math.cos(angle), sin = Math.sin(angle);
    const perp = [-sin, cos];
    const bh   = baseWidth / 2;
    const th   = 1.8;
    const bx = cx + CENTER_R * cos,      by = cy + CENTER_R * sin;
    const tx = cx + (CENTER_R + length) * cos, ty = cy + (CENTER_R + length) * sin;
    const k  = length * 0.42;

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
  function selectDisease(name) {
    AppState.selectedDisease = name;
    AppState.onDiseaseSelect.forEach(fn => fn(name));
  }

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
    return wrapLabel(text, Math.max(Math.floor(r * 0.38), 8));
  }

}
