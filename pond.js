// The live "pond" behind the page: oval ripples like the water in the logo.
// They appear on their own, trail the pointer and splash where you click or tap.
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
  requestAnimationFrame(t => { prev = t; nextAmbient = t + 600; frame(t); });
})();
