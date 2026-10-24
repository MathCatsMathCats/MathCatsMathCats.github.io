// The live "pond" behind the page: oval ripples like the water in the logo.
// They appear on their own, trail the pointer and splash where you click or tap.
// Every 20–35 s a koi swims across a patch of open water.
// The drifting colour blobs are plain CSS (index.html). With reduced motion nothing moves.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('ripples');
  const ctx = canvas.getContext('2d');
  const WATER = '63, 155, 211';     // logo water blue
  const LILAC = '120, 118, 190';    // hippo lilac
  let w = 0, h = 0, ripples = [], prev = 0, nextAmbient = 0, trail = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // size = final half-width in px; a ripple is three rings that start one after another
  function splash(x, y, size, colour = WATER) {
    ripples.push({ x, y, size, colour, age: 0, life: 2200 + size * 9 });
    if (ripples.length > 36) ripples.shift();
  }

  function ring(r, p) {
    const e = 1 - Math.pow(1 - p, 3);                   // fast start, slow finish
    const rx = r.size * (0.15 + 0.85 * e), ry = rx * 0.26;
    const fade = Math.pow(1 - p, 1.6);
    ctx.lineWidth = Math.max(1, (r.size / 22) * (1 - p * 0.7));
    // front arc (nearer, stronger) and back arc (fainter), with gaps like the logo
    ctx.strokeStyle = `rgba(${r.colour}, ${0.55 * fade})`;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, ry, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    ctx.strokeStyle = `rgba(${r.colour}, ${0.28 * fade})`;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, ry, 0, 1.08 * Math.PI, 1.62 * Math.PI); ctx.stroke();
  }

  // Now and then a koi swims across open water for a few seconds: never behind a card, the slogan or the logo,
  // and not in the faded strip at the top (it may pass behind the small footer links)
  const KOI = '#FF9A4F', KOI_DARK = '#EE7430';
  let fish = null, nextFish = 0;

  function spawnFish() {
    const len = 26 + Math.min(w, h) / 40;               // body length in px
    const half = len * 0.3;                             // room needed above and below the path
    const blocked = [...document.querySelectorAll('.game, .slogan, h1 img')].map(el => el.getBoundingClientRect());
    const faded = Math.min(h * 0.14, 120) * 0.7;        // see .pond::after
    for (let i = 0; i < 300; i++) {
      const dist = len * (2.5 + Math.random() * 3.5);
      const x0 = Math.random() * w, y0 = Math.random() * h;
      const x1 = x0 + (Math.random() < 0.5 ? dist : -dist);
      const bend = (Math.random() - 0.5) * len * 0.8;   // a gentle curve up or down
      const l = Math.min(x0, x1) - len * 0.6, r = Math.max(x0, x1) + len * 0.6;
      const top = y0 - half - Math.max(0, -bend), bottom = y0 + half + Math.max(0, bend);
      if (l < 4 || r > w - 4 || top < faded || bottom > h - 4) continue;
      if (blocked.some(b => l < b.right + 6 && r > b.left - 6 && top < b.bottom + 6 && bottom > b.top - 6)) continue;
      fish = { x0, y0, x1, bend, len, age: 0, life: 2600 + Math.random() * 900, wake: 0 };
      splash(x0, y0, len * 1.1);
      return true;
    }
    return false;
  }

  function drawFish(f, dt) {
    f.age += dt;
    const p = f.age / f.life;
    if (p >= 1) { splash(f.x1, f.y0, f.len * 1.2); fish = null; return; }
    const e = 0.5 - 0.5 * Math.cos(Math.PI * p);        // ease in and out
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + f.bend * Math.sin(Math.PI * e);
    const angle = Math.atan2(f.bend * Math.PI * Math.cos(Math.PI * e) * 0.62, f.x1 - f.x0);
    const L = f.len, wag = Math.sin(f.age / 75) * 0.5;
    if ((f.wake += dt) > 170) {                         // little ripples behind the tail
      f.wake = 0;
      splash(x - Math.cos(angle) * L * 0.5, y - Math.sin(angle) * L * 0.3, L * 0.5);
    }
    ctx.save();
    ctx.globalAlpha = 0.92 * Math.min(1, p / 0.14, (1 - p) / 0.18);   // rises in, sinks out
    ctx.translate(x, y);
    ctx.scale(1, 0.62);                                 // seen at an angle, like the ripples
    ctx.rotate(Math.atan2(Math.sin(angle) / 0.62, Math.cos(angle)));
    ctx.shadowColor = 'rgba(31, 45, 74, .25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
    // tail fan
    ctx.save(); ctx.translate(-L * 0.4, 0); ctx.rotate(wag);
    ctx.fillStyle = KOI_DARK;
    ctx.beginPath(); ctx.moveTo(L * 0.04, 0); ctx.lineTo(-L * 0.34, -L * 0.22);
    ctx.quadraticCurveTo(-L * 0.22, 0, -L * 0.34, L * 0.22); ctx.closePath(); ctx.fill();
    ctx.restore();
    // side fins
    ctx.fillStyle = KOI_DARK;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(L * 0.12, s * L * 0.17, L * 0.13, L * 0.05, s * (0.7 + wag * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    // body
    ctx.fillStyle = KOI;
    ctx.beginPath(); ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.12, -L * 0.38, -L * 0.42, 0);
    ctx.quadraticCurveTo(L * 0.12, L * 0.38, L * 0.5, 0); ctx.fill();
    ctx.shadowColor = 'transparent';
    // white koi patch and eyes
    ctx.fillStyle = 'rgba(255, 255, 255, .9)';
    ctx.beginPath(); ctx.ellipse(L * 0.02, 0, L * 0.13, L * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1F2D4A';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(L * 0.33, s * L * 0.07, L * 0.035, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function frame(t) {
    const dt = Math.min(t - prev, 50); prev = t;
    if (t > nextAmbient) {                              // the pond is never completely still
      const big = Math.random() < 0.3;
      splash(Math.random() * w, Math.random() * h, (big ? 90 : 45) + Math.random() * 60,
             Math.random() < 0.35 ? LILAC : WATER);
      nextAmbient = t + 700 + Math.random() * 1300;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ripples = ripples.filter(r => (r.age += dt) < r.life);
    for (const r of ripples) {
      for (let k = 0; k < 3; k++) {
        const p = (r.age - k * r.life * 0.16) / (r.life * 0.68);
        if (p > 0 && p < 1) ring(r, p);
      }
    }
    if (fish) drawFish(fish, dt);
    else if (t > nextFish) nextFish = t + (spawnFish() ? 20000 + Math.random() * 15000 : 3000);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', e => {               // small ripples every ~40 px of movement
    if (!trail || Math.hypot(e.clientX - trail.x, e.clientY - trail.y) > 40) {
      trail = { x: e.clientX, y: e.clientY };
      splash(e.clientX, e.clientY, 34 + Math.random() * 16);
    }
  }, { passive: true });
  addEventListener('pointerdown', e => {
    splash(e.clientX, e.clientY, 150);
    splash(e.clientX, e.clientY, 80, LILAC);
  }, { passive: true });

  resize();
  for (let i = 0; i < 5; i++) splash(Math.random() * w, Math.random() * h, 50 + Math.random() * 90);
  ripples.forEach((r, i) => r.age = i * 500);          // start mid-ripple, not all at once
  window.pondFish = () => spawnFish() ? { ...fish } : null;   // for testing: a fish right now
  requestAnimationFrame(t => { prev = t; nextAmbient = t + 600; nextFish = t + 5000 + Math.random() * 3000; frame(t); });
})();
