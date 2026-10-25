// The live "pond" behind the page, drawn with WebGL: soft light dancing on the bottom, ripples that catch the
// light and bend it, and now and then a koi gliding under the surface with its shadow below it.
// Ripples appear on their own, trail the pointer and splash where you click or tap. A koi comes by every 20–35 s.
// The drifting colour blobs are plain CSS (index.html). With reduced motion the water is drawn once and stays still.
(() => {
  const canvas = document.getElementById('water');
  const gl = canvas && canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'
  });
  if (!gl) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 24;                     // ripples drawn at once
  const FSQ = 0.74;                 // the fish is seen at an angle, a little flattened (the water uses 0.55, see SQ)

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define N ${N}
uniform vec2 uView;        // canvas size in device px
uniform vec2 uSize;        // canvas size in CSS px
uniform float uTime;
uniform vec4 uRip[N];      // ripple centre x, y (CSS px), radius of its wave train, strength
uniform int uCount;
uniform vec4 uFish;        // fish centre x, y, heading cos, sin
uniform vec4 uFishP;       // fish length, depth (0 just under the surface, 1 deep), opacity
uniform sampler2D uFishTex;

const float SQ = 0.55;     // the pond is seen at an angle: ripples are ovals, like the water in the logo
const vec3 WATER = vec3(0.247, 0.608, 0.827);

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// distance to the nearest edge between moving cells: 0 on the edges
float cells(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = 0.5 + 0.38 * sin(t + 6.2831 * hash2(i + g));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}

// sunlight focused by the surface onto the bottom: two layers of bright, wobbly lines
float caustic(vec2 w, float t) {
  vec2 p = w / 105.0;
  p += 0.3 * vec2(sin(p.y * 1.7 + t * 0.33), sin(p.x * 1.3 - t * 0.29));
  float a = 1.0 - smoothstep(0.0, 0.2, cells(p, t * 0.55));
  float b = 1.0 - smoothstep(0.0, 0.15, cells(p * 1.7 + vec2(3.1, 7.7), t * 0.8 + 1.7));
  return a * a * 0.7 + b * b * 0.45;
}

vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

// the fish texture (premultiplied) at a CSS point; bias blurs it
vec4 fishAt(vec2 p, float bias) {
  vec2 d = p - uFish.xy;
  d.y /= ${FSQ.toFixed(2)};
  vec2 l = vec2(dot(d, uFish.zw), dot(d, vec2(-uFish.w, uFish.z))) / uFishP.x;
  vec2 uv = vec2((l.x + 0.72) / 1.32, 0.5 + l.y / 1.32);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  vec2 e = smoothstep(0.0, 0.12, uv) * smoothstep(1.0, 0.88, uv);   // blur never shows the texture's edge
  return texture2D(uFishTex, uv, bias) * e.x * e.y;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) * uSize / uView;   // CSS px, y down
  vec2 w = vec2(p.x, p.y / SQ);
  float t = uTime;

  // slope of the surface: every ripple is a short train of waves around its radius
  vec2 g = vec2(0.0);
  for (int i = 0; i < N; i++) {
    if (i >= uCount) break;
    vec4 r = uRip[i];
    vec2 dv = w - vec2(r.x, r.y / SQ);
    float dist = length(dv) + 0.001;
    float lam = 9.0 + r.z * 0.05;              // wavelength grows as the ring spreads
    float sig = lam * 0.85;
    float u = dist - r.z;
    if (abs(u) > 3.0 * sig) continue;
    float k = 6.2831 / lam;
    float s = r.w * exp(-u * u / (2.0 * sig * sig)) * (-sin(k * u) - u / (sig * sig * k) * cos(k * u));
    g += s * dv / dist;
  }
  // a faint swell so the light never stands still
  g += 0.03 * (vec2(0.8, 0.6) * cos(dot(w, vec2(0.8, 0.6)) * 0.035 + t * 0.9)
             + vec2(-0.47, 0.88) * cos(dot(w, vec2(-0.47, 0.88)) * 0.05 - t * 1.15));

  // the bottom: a hint of water colour, with light the ripples bend
  float c = caustic(w + g * 24.0, t);
  vec4 col = over(vec4(vec3(0.2 * c), 0.2 * c), vec4(WATER * 0.06, 0.06));

  if (uFishP.z > 0.0) {
    float L = uFishP.x, dep = uFishP.y;
    // shadow on the bottom: softer and further away the deeper the fish swims
    vec2 so = p - vec2(0.12, 0.36) * L * (0.35 + dep), sb = vec2(0.03, 0.02) * L * (1.0 + dep);
    float sh = 0.25 * (fishAt(so + sb, 1.6 + dep).a + fishAt(so - sb, 1.6 + dep).a
                     + fishAt(so + vec2(sb.y, -sb.x), 1.6 + dep).a + fishAt(so - vec2(sb.y, -sb.x), 1.6 + dep).a);
    sh *= 0.28 * uFishP.z;
    col = over(vec4(vec3(0.09, 0.2, 0.34) * sh, sh), col);
    // the fish, seen through the moving water: bent by the ripples, bluer and blurrier when deeper
    vec4 f = fishAt(p + g * 10.0 * (0.4 + dep), dep * 2.2 - 0.45);
    f.rgb = mix(f.rgb, WATER * 0.8 * f.a, 0.06 + dep * 0.5);
    f.rgb += c * 0.25 * f.a;
    col = over(f * uFishP.z * (1.0 - dep * 0.3), col);
  }

  // the surface: slopes turned to the light shine, slopes turned away go darker, and the steepest glint
  vec3 n = normalize(vec3(-g * 1.4, 1.0));
  vec3 ld = normalize(vec3(-0.4, -0.65, 0.65));
  float lit = dot(n, ld) - ld.z;
  float spec = pow(max(dot(n, normalize(ld + vec3(0.0, 0.0, 1.0))), 0.0), 90.0);
  float dark = clamp(-lit * 1.5, 0.0, 0.4);
  col = over(vec4(vec3(0.12, 0.34, 0.56) * dark, dark), col);
  float lite = clamp(lit * 1.3 + spec * 1.2, 0.0, 0.9);
  gl_FragColor = over(vec4(vec3(lite), lite), col);
}`;

  // ---- the koi, drawn on a small canvas every frame and handed to the shader as a texture ----
  const fishCanvas = document.createElement('canvas');
  fishCanvas.width = 256; fishCanvas.height = 256;
  const fx = fishCanvas.getContext('2d');
  const FS = 194;                   // texture px per fish length; the texture spans -0.72…0.6 lengths both ways

  // smooth closed or open path through points
  function curve(pts, close) {
    fx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      fx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    const z = pts[pts.length - 1];
    fx.lineTo(z[0], z[1]);
    if (close) fx.closePath();
  }

  function softSpot(x, y, ang, rx, ry, rgb, a) {
    fx.save(); fx.translate(x, y); fx.rotate(ang); fx.scale(rx, ry);
    const gr = fx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${rgb}, ${a})`); gr.addColorStop(0.65, `rgba(${rgb}, ${a})`); gr.addColorStop(1, `rgba(${rgb}, 0)`);
    fx.fillStyle = gr; fx.beginPath(); fx.arc(0, 0, 1, 0, Math.PI * 2); fx.fill();
    fx.restore();
  }

  // a fan-shaped fin: root at the origin, pointing along +x; flex bends it sideways towards its tip
  function fin(x, y, ang, side, len, wid, flex) {
    const pt = (u, v) => [u * len, side * (v * wid + flex * u * u * len)];
    fx.save(); fx.translate(x, y); fx.rotate(ang);
    const edge = [pt(1, -0.35), pt(1.06, 0.05), pt(0.95, 0.4), pt(0.75, 0.62)];
    fx.beginPath();
    fx.moveTo(...pt(0, -0.18));
    fx.quadraticCurveTo(...pt(0.5, -0.62), ...edge[0]);
    fx.quadraticCurveTo(...pt(1.1, -0.15), ...edge[1]);
    fx.quadraticCurveTo(...pt(1.05, 0.3), ...edge[2]);
    fx.quadraticCurveTo(...pt(0.9, 0.62), ...edge[3]);
    fx.quadraticCurveTo(...pt(0.3, 0.45), ...pt(0, 0.2));
    fx.closePath();
    const gr = fx.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, 'rgba(250, 128, 58, 0.85)'); gr.addColorStop(1, 'rgba(255, 222, 196, 0.35)');
    fx.fillStyle = gr; fx.fill();
    fx.lineWidth = 0.005; fx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; fx.stroke();
    fx.strokeStyle = 'rgba(196, 82, 28, 0.32)'; fx.lineWidth = 0.004;   // fin rays
    fx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const v = -0.3 + k * 0.15, o = pt(0.04, v * 0.4), e = pt(0.96 - Math.abs(v - 0.1) * 0.25, v);
      fx.moveTo(o[0], o[1]); fx.lineTo(e[0], e[1]);
    }
    fx.stroke();
    fx.restore();
  }

  function drawKoi(phase, turn) {
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, 256, 256);
    fx.setTransform(FS, 0, 0, FS, 0.72 * FS, 128);       // fish units: 1 = body length, nose towards +x
    fx.lineCap = 'round'; fx.lineJoin = 'round';

    // spine with a wave running from head to tail; it bends a little into turns
    const M = 22, P = [], T = [], Nn = [], W = [];
    for (let i = 0; i <= M; i++) {
      const s = i / M;
      P.push([0.46 - 0.74 * s, (0.012 + 0.085 * s * s) * Math.sin(phase - 5.2 * s) + turn * (s - 0.2) * (s - 0.2)]);
      W.push(0.125 * Math.pow(s, 0.42) * Math.pow(1 - s, 0.85) / 0.447 + 0.018 * s);   // half-width, widest behind the head
    }
    for (let i = 0; i <= M; i++) {
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, M)];
      const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy);
      T.push([dx / l, dy / l]); Nn.push([-dy / l, dx / l]);
    }
    const at = (s, off) => {                            // a point on the body: s along it, off across it (-1…1)
      const i = Math.min(Math.round(s * M), M);
      return [P[i][0] + Nn[i][0] * W[i] * off, P[i][1] + Nn[i][1] * W[i] * off];
    };
    const angAt = s => { const i = Math.min(Math.round(s * M), M); return Math.atan2(T[i][1], T[i][0]); };

    // fins under the body: pectorals paddle, pelvics stay calmer
    for (const side of [1, -1]) {
      const back = angAt(0.2) + Math.PI;
      const pect = at(0.2, side * 0.8);
      fin(pect[0], pect[1], back - side * (0.85 + 0.22 * Math.sin(phase * 0.5 + side)), side, 0.2, 0.11, 0.25 * Math.sin(phase * 0.5 + side));
      const pelv = at(0.5, side * 0.75);
      fin(pelv[0], pelv[1], angAt(0.5) + Math.PI - side * 0.6, side, 0.11, 0.065, 0.1 * Math.sin(phase - 2.6));
    }
    // tail fin: follows the end of the spine and whips a little later
    const tb = P[M], tailAng = angAt(1) + Math.PI + 0.35 * Math.sin(phase - 6.4);
    fx.save(); fx.translate(tb[0], tb[1]); fx.rotate(tailAng);
    const flex = 0.9 * Math.sin(phase - 6.9);
    const q = (u, v) => [u, v + flex * u * u];
    fx.beginPath();
    fx.moveTo(...q(-0.01, -0.02));
    fx.bezierCurveTo(...q(0.08, -0.05), ...q(0.17, -0.17), ...q(0.31, -0.16));
    fx.quadraticCurveTo(...q(0.25, -0.07), ...q(0.2, 0));
    fx.quadraticCurveTo(...q(0.25, 0.07), ...q(0.31, 0.16));
    fx.bezierCurveTo(...q(0.17, 0.17), ...q(0.08, 0.05), ...q(-0.01, 0.02));
    fx.closePath();
    const tg = fx.createLinearGradient(0, 0, 0.31, 0);
    tg.addColorStop(0, 'rgba(240, 108, 42, 0.9)'); tg.addColorStop(1, 'rgba(255, 214, 184, 0.35)');
    fx.fillStyle = tg; fx.fill();
    fx.lineWidth = 0.005; fx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; fx.stroke();
    fx.strokeStyle = 'rgba(190, 76, 24, 0.3)'; fx.lineWidth = 0.004;
    fx.beginPath();
    for (let k = -4; k <= 4; k++) {
      const v = k / 4, e = q(0.29 - 0.08 * (1 - Math.abs(v)), v * 0.155);
      fx.moveTo(...q(0.01, v * 0.015)); fx.lineTo(e[0], e[1]);
    }
    fx.stroke();
    fx.restore();

    // body outline: nose, down one side, round the tail, back up the other
    const outline = [[P[0][0] + T[0][0] * 0.012, P[0][1] + T[0][1] * 0.012]];
    for (let i = 1; i <= M; i++) outline.push(at(i / M, 1));
    for (let i = M; i >= 1; i--) outline.push(at(i / M, -1));
    outline.push(outline[0]);
    fx.beginPath(); curve(outline, true);
    const bg = fx.createLinearGradient(0.46, 0, -0.28, 0);
    bg.addColorStop(0, '#FFA466'); bg.addColorStop(0.45, '#FB7D35'); bg.addColorStop(1, '#EC6B2A');
    fx.fillStyle = bg; fx.fill();

    fx.save(); fx.clip();
    // white patches and a few black ink spots, like a kohaku/sanke koi
    const patch = (s, off, along, across, rgb, a) => {
      const c = at(s, off), i = Math.min(Math.round(s * M), M);
      softSpot(c[0], c[1], angAt(s), along, W[i] * across, rgb, a);
    };
    patch(0.07, -0.25, 0.06, 0.95, '255, 251, 245', 0.95);
    patch(0.42, 0.5, 0.1, 0.75, '255, 251, 245', 0.95);
    patch(0.7, -0.35, 0.075, 0.9, '255, 251, 245', 0.95);
    patch(0.93, 0, 0.06, 1.4, '255, 240, 228', 0.8);
    patch(0.3, -0.6, 0.022, 0.28, '38, 36, 52', 0.8);
    patch(0.57, 0.35, 0.026, 0.3, '38, 36, 52', 0.75);
    patch(0.81, 0.15, 0.016, 0.35, '38, 36, 52', 0.7);
    // scales: small arcs that catch the light
    fx.lineWidth = 0.005; fx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    fx.beginPath();
    for (let s = 0.16, row = 0; s < 0.92; s += 0.048, row++) {
      const back = angAt(s) + Math.PI;
      for (let j = -2; j <= 2; j++) {
        const c = at(s, (j + (row % 2) * 0.5 - 0.25) / 2.6);
        fx.moveTo(c[0] + Math.cos(back - 1.1) * 0.017, c[1] + Math.sin(back - 1.1) * 0.017);
        fx.arc(c[0], c[1], 0.017, back - 1.1, back + 1.1);
      }
    }
    fx.stroke();
    // roundness: darker towards the edges, a glossy ridge along the back
    fx.beginPath(); curve(outline, true);
    for (const [lw, a] of [[0.1, 0.1], [0.06, 0.12], [0.03, 0.16]]) {
      fx.lineWidth = lw; fx.strokeStyle = `rgba(140, 48, 12, ${a})`; fx.stroke();
    }
    const ridge = [];
    for (let i = 1; i <= Math.round(M * 0.62); i++) ridge.push(P[i]);
    for (const [lw, a] of [[0.06, 0.16], [0.022, 0.38]]) {
      fx.beginPath(); curve(ridge, false); fx.lineWidth = lw; fx.strokeStyle = `rgba(255, 255, 255, ${a})`; fx.stroke();
    }
    fx.restore();

    // dorsal fin seen from above: a thin ridge that sways a moment after the body
    const dorsal = [];
    for (let i = Math.round(M * 0.3); i <= Math.round(M * 0.74); i++) {
      const sway = 0.012 * Math.sin(phase - 5.2 * i / M - 1);
      dorsal.push([P[i][0] + Nn[i][0] * sway, P[i][1] + Nn[i][1] * sway]);
    }
    fx.beginPath(); curve(dorsal, false);
    fx.lineWidth = 0.016; fx.strokeStyle = 'rgba(214, 88, 30, 0.4)'; fx.stroke();
    fx.lineWidth = 0.006; fx.strokeStyle = 'rgba(255, 200, 166, 0.5)'; fx.stroke();

    // eyes on the sides of the head, and two little barbels at the mouth
    for (const side of [1, -1]) {
      const e = at(0.075, side * 0.8);
      fx.fillStyle = '#1F2233'; fx.beginPath(); fx.ellipse(e[0], e[1], 0.017, 0.013, angAt(0.075), 0, Math.PI * 2); fx.fill();
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)'; fx.beginPath(); fx.arc(e[0] + 0.005, e[1] - 0.004, 0.005, 0, Math.PI * 2); fx.fill();
      const m = at(0.02, side * 0.7), fwd = angAt(0.02);
      fx.beginPath(); fx.moveTo(m[0], m[1]);
      fx.quadraticCurveTo(m[0] + Math.cos(fwd) * 0.03, m[1] + Math.sin(fwd) * 0.03,
        m[0] + Math.cos(fwd + side * 0.9) * 0.04, m[1] + Math.sin(fwd + side * 0.9) * 0.04);
      fx.lineWidth = 0.006; fx.strokeStyle = 'rgba(214, 110, 66, 0.75)'; fx.stroke();
    }
  }

  // ---- WebGL set-up ----
  let prog, loc, fishTex, ripArr = new Float32Array(N * 4);
  function init() {
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one big triangle
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    loc = {};
    for (const u of ['uView', 'uSize', 'uTime', 'uRip', 'uCount', 'uFish', 'uFishP', 'uFishTex']) loc[u] = gl.getUniformLocation(prog, u);
    fishTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fishTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fishCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(loc.uFishTex, 0);
    gl.uniform4f(loc.uFishP, 1, 1, 0, 0);
    resize();
  }

  let w = 0, h = 0, quality = 1;
  function resize() {
    w = canvas.clientWidth || innerWidth; h = canvas.clientHeight || innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, Math.sqrt(2.2e6 / (w * h))) * quality;   // cap the pixels the shader has to fill
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(loc.uView, canvas.width, canvas.height);
    gl.uniform2f(loc.uSize, w, h);
  }

  try { init(); } catch (err) { canvas.remove(); return; }

  // ---- ripples ----
  let ripples = [], time = 0;
  // size = how far the ring spreads (px), amp = how strong it is (1 = a big splash)
  function splash(x, y, size, amp = 0.7) {
    ripples.push({ x, y, size, amp, age: 0, life: 2200 + size * 9 });
    if (ripples.length > 40) ripples.shift();
  }

  function draw() {
    let n = 0;
    for (let i = ripples.length - 1; i >= 0 && n < N; i--) {      // newest first
      const r = ripples[i], p = r.age / r.life;
      ripArr[n * 4] = r.x; ripArr[n * 4 + 1] = r.y;
      ripArr[n * 4 + 2] = r.size * (1 - Math.pow(1 - p, 2.4));
      ripArr[n * 4 + 3] = r.amp * Math.min(1, p * 10) * Math.pow(1 - p, 1.4);
      n++;
    }
    gl.uniform4fv(loc.uRip, ripArr);
    gl.uniform1i(loc.uCount, n);
    gl.uniform1f(loc.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (still) {                                         // reduced motion: one calm frame, no ripples, no fish
    time = 12; draw();
    addEventListener('resize', () => { resize(); draw(); });
    return;
  }

  // ---- the koi: never behind a card, the slogan or the logo, and not in the faded strip at the top ----
  let fish = null, nextFish = 0;
  function spawnFish() {
    const len = 30 + Math.min(w, h) / 32;               // body length in px
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
      fish = { x0, y0, x1, bend, len, age: 0, life: 3600 + Math.random() * 1000, phase: Math.random() * 6, heading: null, wake: 0 };
      return true;
    }
    return false;
  }

  function swim(f, dt) {
    f.age += dt;
    const p = f.age / f.life;
    if (p >= 1) { fish = null; gl.uniform4f(loc.uFishP, 1, 1, 0, 0); return; }
    const e = 0.5 - 0.5 * Math.cos(Math.PI * p);        // ease in and out
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + f.bend * Math.sin(Math.PI * e);
    const a = Math.atan2(f.bend * Math.PI * Math.cos(Math.PI * e) / FSQ, f.x1 - f.x0);
    const turn = f.heading === null ? 0 : Math.max(-0.08, Math.min(0.08, (a - f.heading) / dt * 400));
    f.heading = a;
    const speed = Math.sin(Math.PI * p);
    f.phase += dt / 1000 * Math.PI * 2 * (0.8 + 1.4 * speed);   // the tail beats faster while it speeds up
    const depth = 0.2 + 0.8 * Math.pow(1 - speed, 1.4);        // rises from the deep, glides near the top, sinks again
    const opacity = Math.min(1, p / 0.12, (1 - p) / 0.15);
    if (depth < 0.4 && (f.wake += dt) > 300) {           // close to the surface it leaves a soft wake
      f.wake = 0;
      splash(x - Math.cos(a) * f.len * 0.5, y - Math.sin(a) * f.len * 0.5 * FSQ, f.len * 0.9, 0.22);
    }
    drawKoi(f.phase, (f.x1 > f.x0 ? 1 : -1) * turn);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fishCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform4f(loc.uFish, x, y, Math.cos(a), Math.sin(a));
    gl.uniform4f(loc.uFishP, f.len, depth, opacity, 0);
  }

  let prev = 0, nextAmbient = 0, trail = null, lost = false, slow = 0;
  function frame(t) {
    if (lost) return;
    const dt = Math.min(t - prev, 50); prev = t;
    time += dt / 1000;
    if (t > nextAmbient) {                              // the pond is never completely still
      const big = Math.random() < 0.3;
      splash(Math.random() * w, Math.random() * h, (big ? 100 : 50) + Math.random() * 60, big ? 0.8 : 0.5);
      nextAmbient = t + 700 + Math.random() * 1300;
    }
    ripples = ripples.filter(r => (r.age += dt) < r.life);
    if (fish) swim(fish, dt);
    else if (t > nextFish) nextFish = t + (spawnFish() ? 20000 + Math.random() * 15000 : 3000);
    draw();
    // a device that can't keep up gets fewer pixels (a 30 fps battery saver is fine as it is)
    slow = dt > 40 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90 && quality > 0.5) { quality *= 0.75; slow = 0; resize(); }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', e => {               // small ripples every ~40 px of movement
    if (!trail || Math.hypot(e.clientX - trail.x, e.clientY - trail.y) > 40) {
      trail = { x: e.clientX, y: e.clientY };
      splash(e.clientX, e.clientY, 34 + Math.random() * 16, 0.4);
    }
  }, { passive: true });
  addEventListener('pointerdown', e => {
    splash(e.clientX, e.clientY, 150, 1);
    setTimeout(() => splash(e.clientX, e.clientY, 70, 0.6), 160);
  }, { passive: true });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { init(); } catch (err) { return; }
    lost = false; requestAnimationFrame(t => { prev = t; frame(t); });
  });

  for (let i = 0; i < 5; i++) splash(Math.random() * w, Math.random() * h, 60 + Math.random() * 90, 0.6);
  ripples.forEach((r, i) => r.age = i * 500);          // start mid-ripple, not all at once
  window.pondFish = () => spawnFish() ? { ...fish } : null;   // for testing: a fish right now
  requestAnimationFrame(t => { prev = t; nextAmbient = t + 600; nextFish = t + 5000 + Math.random() * 3000; frame(t); });
})();
