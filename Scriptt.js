/* =========================================================
   AURORA — Luxury Night Sky Stopwatch
   Vanilla JS — accurate timing, ring animation, parallax,
   magnetic buttons, lap timeline, stats
   ========================================================= */

(() => {
  'use strict';

  /* ---------- DOM references ---------- */
  const body = document.body;

  const hhEl = document.getElementById('hh');
  const mmEl = document.getElementById('mm');
  const ssEl = document.getElementById('ss');
  const msEl = document.getElementById('ms');

  const startPauseBtn = document.getElementById('startPauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const lapBtn = document.getElementById('lapBtn');
  const btnLabel = startPauseBtn.querySelector('.btn-label');

  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');

  const statTotal = document.getElementById('statTotal');
  const statLaps = document.getElementById('statLaps');
  const statFastest = document.getElementById('statFastest');
  const statSlowest = document.getElementById('statSlowest');
  const statAverage = document.getElementById('statAverage');

  const timeline = document.getElementById('timeline');
  const timelineEmpty = document.getElementById('timelineEmpty');
  const lapsCount = document.getElementById('lapsCount');

  const ringProgress = document.getElementById('ringProgress');
  const ringMarkerOrbit = document.getElementById('ringMarkerOrbit');
  const glassFace = document.getElementById('glassFace');
  const watchWrap = document.getElementById('watchWrap');
  const sparklesWrap = document.getElementById('sparkles');
  const particlesWrap = document.getElementById('particles');
  const sky = document.getElementById('sky');

  const CIRCUMFERENCE = 2 * Math.PI * 132; // matches r=132 in SVG
  const ringMarkerEl = ringMarkerOrbit.querySelector('.ring-marker');

  /* Keep the orbiting marker's radius in sync with the watch's actual
     rendered size, since the SVG's 300x300 viewBox scales fluidly. */
  function updateMarkerRadius() {
    const size = watchWrap.clientWidth; // width === height (aspect-ratio 1/1)
    const radius = (size / 2) * (132 / 150); // 132 is the SVG ring radius, 150 is the SVG half-viewBox
    ringMarkerEl.style.setProperty('--marker-radius', `${radius}px`);
  }

  /* ---------- State ---------- */
  let isRunning = false;
  let startTimestamp = 0;
  let elapsedBeforePause = 0;
  let rafId = null;
  let laps = [];
  let lastLapTotal = 0;

  /* ---------- Time formatting ---------- */
  function formatParts(totalMs) {
    const ms = Math.floor((totalMs % 1000) / 10);
    const totalSeconds = Math.floor(totalMs / 1000);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    return {
      hh: String(h).padStart(2, '0'),
      mm: String(m).padStart(2, '0'),
      ss: String(s).padStart(2, '0'),
      ms: String(ms).padStart(2, '0'),
    };
  }

  function formatFull(totalMs) {
    const p = formatParts(totalMs);
    return `${p.hh}:${p.mm}:${p.ss}.${p.ms}`;
  }

  function formatCompact(totalMs) {
    const p = formatParts(totalMs);
    return `${p.hh}:${p.mm}:${p.ss}:${p.ms}`;
  }

  function formatClock(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /* ---------- Core timing ---------- */
  function currentElapsed() {
    if (isRunning) {
      return elapsedBeforePause + (performance.now() - startTimestamp);
    }
    return elapsedBeforePause;
  }

  function updateDigit(el, value) {
    if (el.textContent !== value) el.textContent = value;
  }

  function render() {
    const elapsed = currentElapsed();
    const p = formatParts(elapsed);

    updateDigit(hhEl, p.hh);
    updateDigit(mmEl, p.mm);
    updateDigit(ssEl, p.ss);
    updateDigit(msEl, p.ms);

    statTotal.textContent = formatFull(elapsed);

    // Ring + marker: one full revolution per minute
    const withinMinute = elapsed % 60000;
    const progress = withinMinute / 60000;
    const offset = CIRCUMFERENCE * (1 - progress);
    ringProgress.style.strokeDashoffset = String(offset);
    ringMarkerOrbit.style.transform = `rotate(${-90 + progress * 360}deg)`;
  }

  /* ---------- Animation loop (rAF, single instance guaranteed) ---------- */
  function loop() {
    render();
    if (isRunning) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function startLoop() {
    // Guarantee no duplicate loops are ever running simultaneously
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /* ---------- Controls ---------- */
  function start() {
    if (isRunning) return;
    isRunning = true;
    startTimestamp = performance.now();
    startLoop();

    body.classList.add('is-running');
    startPauseBtn.classList.add('is-running');
    startPauseBtn.setAttribute('aria-label', 'Pause');
    btnLabel.textContent = 'Pause';
    lapBtn.disabled = false;

    statusDot.classList.remove('paused');
    statusDot.classList.add('running');
    statusLabel.textContent = 'Running';
  }

  function pause() {
    if (!isRunning) return;
    isRunning = false;
    elapsedBeforePause += performance.now() - startTimestamp;
    stopLoop();
    render();

    body.classList.remove('is-running');
    startPauseBtn.classList.remove('is-running');
    startPauseBtn.setAttribute('aria-label', 'Start');
    btnLabel.textContent = 'Resume';
    lapBtn.disabled = true;

    statusDot.classList.remove('running');
    statusDot.classList.add('paused');
    statusLabel.textContent = 'Paused';
  }

  function triggerResetRipple() {
    const ripple = document.createElement('div');
    ripple.className = 'reset-ripple';
    glassFace.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function reset() {
    isRunning = false;
    stopLoop();
    triggerResetRipple();

    elapsedBeforePause = 0;
    startTimestamp = 0;
    lastLapTotal = 0;
    laps = [];

    render();
    ringProgress.style.strokeDashoffset = String(CIRCUMFERENCE);
    ringMarkerOrbit.style.transform = 'rotate(-90deg)';
    renderTimeline();
    renderStats();

    body.classList.remove('is-running');
    startPauseBtn.classList.remove('is-running');
    startPauseBtn.setAttribute('aria-label', 'Start');
    btnLabel.textContent = 'Start';
    lapBtn.disabled = true;

    statusDot.classList.remove('running', 'paused');
    statusLabel.textContent = 'Ready';
  }

  function addLap() {
    if (!isRunning) return;
    const total = currentElapsed();
    const split = total - lastLapTotal;
    lastLapTotal = total;

    laps.push({
      number: laps.length + 1,
      totalMs: total,
      splitMs: split,
      clock: new Date(),
    });

    renderTimeline();
    renderStats();
  }

  /* ---------- Timeline rendering ---------- */
  function renderTimeline() {
    timeline.innerHTML = '';

    if (laps.length === 0) {
      timeline.appendChild(timelineEmpty);
      lapsCount.textContent = '0 laps';
      return;
    }

    lapsCount.textContent = `${laps.length} lap${laps.length === 1 ? '' : 's'}`;

    let fastestIdx = 0, slowestIdx = 0;
    laps.forEach((lap, i) => {
      if (lap.splitMs < laps[fastestIdx].splitMs) fastestIdx = i;
      if (lap.splitMs > laps[slowestIdx].splitMs) slowestIdx = i;
    });
    const showBadges = laps.length > 1;

    [...laps].reverse().forEach((lap) => {
      const idx = lap.number - 1;
      const item = document.createElement('div');
      item.className = 'lap-item';

      const main = document.createElement('div');
      main.className = 'lap-main';

      const numEl = document.createElement('span');
      numEl.className = 'lap-number';
      numEl.textContent = `LAP ${lap.number}`;

      const timeEl = document.createElement('span');
      timeEl.className = 'lap-time';
      timeEl.textContent = formatCompact(lap.splitMs);

      const stampEl = document.createElement('span');
      stampEl.className = 'lap-timestamp';
      stampEl.textContent = formatClock(lap.clock);

      main.appendChild(numEl);
      main.appendChild(timeEl);
      main.appendChild(stampEl);
      item.appendChild(main);

      if (showBadges && idx === fastestIdx) {
        const badge = document.createElement('span');
        badge.className = 'lap-badge fast';
        badge.textContent = '🏆 Fastest';
        item.appendChild(badge);
      } else if (showBadges && idx === slowestIdx) {
        const badge = document.createElement('span');
        badge.className = 'lap-badge slow';
        badge.textContent = '🐢 Slowest';
        item.appendChild(badge);
      }

      timeline.appendChild(item);
    });
  }

  function renderStats() {
    statLaps.textContent = String(laps.length);

    if (laps.length === 0) {
      statFastest.textContent = '—';
      statSlowest.textContent = '—';
      statAverage.textContent = '—';
      return;
    }

    let fastest = laps[0], slowest = laps[0], sum = 0;
    laps.forEach((lap) => {
      if (lap.splitMs < fastest.splitMs) fastest = lap;
      if (lap.splitMs > slowest.splitMs) slowest = lap;
      sum += lap.splitMs;
    });

    statFastest.textContent = formatCompact(fastest.splitMs);
    statSlowest.textContent = formatCompact(slowest.splitMs);
    statAverage.textContent = formatCompact(sum / laps.length);
  }

  /* ---------- Ripple click effect (capsules) ---------- */
  function attachRipple(button) {
    button.addEventListener('click', (e) => {
      if (button.disabled) return;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
      ripple.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }
  [startPauseBtn, resetBtn, lapBtn].forEach(attachRipple);

  /* ---------- Magnetic hover interaction ---------- */
  function attachMagnetic(button, strength = 12) {
    button.addEventListener('mousemove', (e) => {
      if (button.disabled) return;
      const rect = button.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      button.style.transform = `translate(${relX * strength}px, ${relY * strength - 3}px)`;
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = '';
    });
  }
  [startPauseBtn, resetBtn, lapBtn].forEach((b) => attachMagnetic(b, 10));

  /* ---------- Event listeners ---------- */
  startPauseBtn.addEventListener('click', () => (isRunning ? pause() : start()));
  resetBtn.addEventListener('click', reset);
  lapBtn.addEventListener('click', addLap);

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      startPauseBtn.click();
    } else if (e.key.toLowerCase() === 'l') {
      if (!lapBtn.disabled) lapBtn.click();
    } else if (e.key.toLowerCase() === 'r') {
      resetBtn.click();
    }
  });

  /* ---------- Mouse parallax on aurora sky ---------- */
  let parallaxTarget = { x: 0, y: 0 };
  let parallaxCurrent = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth) - 0.5;
    const ny = (e.clientY / window.innerHeight) - 0.5;
    parallaxTarget = { x: nx, y: ny };
  });

  function animateParallax() {
    parallaxCurrent.x += (parallaxTarget.x - parallaxCurrent.x) * 0.04;
    parallaxCurrent.y += (parallaxTarget.y - parallaxCurrent.y) * 0.04;

    const layers = sky.querySelectorAll('.aurora-layer');
    const blobs = sky.querySelectorAll('.glow-blob');

    layers.forEach((layer, i) => {
      const depth = (i + 1) * 6;
      layer.style.marginLeft = `${parallaxCurrent.x * depth}px`;
      layer.style.marginTop = `${parallaxCurrent.y * depth * 0.6}px`;
    });

    blobs.forEach((blob, i) => {
      const depth = (i + 1) * 10;
      blob.style.marginLeft = `${parallaxCurrent.x * depth}px`;
      blob.style.marginTop = `${parallaxCurrent.y * depth * 0.6}px`;
    });

    // subtle parallax tilt on the watch itself
    watchWrap.style.transform = `translate(${parallaxCurrent.x * 8}px, ${parallaxCurrent.y * 8}px)`;

    requestAnimationFrame(animateParallax);
  }

  /* ---------- Floating background particles ---------- */
  function spawnParticles(count = 26) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const size = (Math.random() * 2.5 + 1.5).toFixed(1);
      const left = (Math.random() * 100).toFixed(2);
      const dur = (Math.random() * 12 + 12).toFixed(1);
      const delay = (Math.random() * 20).toFixed(1);
      const drift = (Math.random() * 60 - 30).toFixed(0);
      p.style.setProperty('--size', `${size}px`);
      p.style.setProperty('--dur', `${dur}s`);
      p.style.setProperty('--delay', `${delay}s`);
      p.style.setProperty('--drift', `${drift}px`);
      p.style.left = `${left}%`;
      p.style.bottom = '-10px';
      frag.appendChild(p);
    }
    particlesWrap.appendChild(frag);
  }

  /* ---------- Sparkles around the watch ---------- */
  function spawnSparkles(count = 10) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      const angle = (i / count) * 360 + Math.random() * 20;
      const radius = 48 + Math.random() * 6; // percent-based radial placement
      const rad = (angle * Math.PI) / 180;
      const x = 50 + radius * Math.cos(rad);
      const y = 50 + radius * Math.sin(rad);
      s.style.left = `${x}%`;
      s.style.top = `${y}%`;
      s.style.animationDelay = `${(Math.random() * 2.4).toFixed(2)}s`;
      frag.appendChild(s);
    }
    sparklesWrap.appendChild(frag);
  }

  /* ---------- Init ---------- */
  function init() {
    render();
    ringProgress.style.strokeDashoffset = String(CIRCUMFERENCE);
    renderTimeline();
    renderStats();
    lapBtn.disabled = true;

    updateMarkerRadius();
    window.addEventListener('resize', updateMarkerRadius);

    spawnParticles();
    spawnSparkles();
    requestAnimationFrame(animateParallax);
  }

  init();
})();