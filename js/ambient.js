/*
  Fonas: neryškios, lėtai plaukiojančios spalvų dėmės, paimtos iš tos nuotraukos,
  kuri šiuo metu yra centre. Piešiama į labai mažą <canvas> (96×60 taškų), kurį naršyklė
  ištempia per visą ekraną – todėl vaizdas savaime išsilieja ir beveik nieko nekainuoja.
*/
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
/* Nuotraukos spalva paverčiama fono spalva: kiek sodresnė ir visada pakankamai tamsi. */
function tone(rgb, lightness) {
  const [h, s, l] = toHsl(rgb);
  return fromHsl([h, s < 0.07 ? s : clamp(s * 1.35 + 0.08, 0, 0.86), clamp(l, lightness[0], lightness[1])]);
}

/* Iš sumažintos nuotraukos išrenkamos kelios skirtingos, kuo spalvingesnės spalvos. */
export function extractPalette(canvas, count = 6) {
  const w = canvas.width, h = canvas.height;
  let data;
  try { data = canvas.getContext('2d').getImageData(0, 0, w, h).data; } catch { return null; }
  const cols = 6, rows = 4, cells = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor(cx * w / cols), x1 = Math.floor((cx + 1) * w / cols), y0 = Math.floor(cy * h / rows), y1 = Math.floor((cy + 1) * h / rows);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    if (!n) continue;
    const rgb = [r / n, g / n, b / n], [, s, l] = toHsl(rgb);
    cells.push({ rgb, score: 0.25 + s * (1 - Math.abs(l - 0.5) * 1.1) });
  }
  if (!cells.length) return null;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const picked = [cells.reduce((a, b) => (b.score > a.score ? b : a))];
  while (picked.length < Math.min(count, cells.length)) {
    let best = null, bestV = -1;
    for (const c of cells) {
      if (picked.includes(c)) continue;
      const v = Math.min(...picked.map((p) => dist(p.rgb, c.rgb))) * c.score;
      if (v > bestV) { bestV = v; best = c; }
    }
    picked.push(best);
  }
  return picked.map((c) => c.rgb);
}

export function mountAmbient(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const W = (canvas.width = 96), H = (canvas.height = 60);
  const N = 9;
  const blobs = Array.from({ length: N }, (_, i) => {
    const a = i * 2.39996;
    return {
      cur: [10, 10, 12], to: [10, 10, 12],
      ax: 0.26 + 0.24 * Math.abs(Math.sin(i * 1.7 + 0.4)), ay: 0.24 + 0.24 * Math.abs(Math.cos(i * 2.3)),
      fx: 0.13 + 0.1 * Math.abs(Math.sin(i * 3.1)), fy: 0.11 + 0.11 * Math.abs(Math.cos(i * 1.3 + 1)),
      px: a, py: a * 1.7,
      size: 0.27 + 0.15 * Math.abs(Math.sin(i * 2.9 + 1)),
      pulse: 0.5 + 0.4 * Math.abs(Math.sin(i * 4.2)),
    };
  });
  const base = { cur: [5, 5, 6], to: [5, 5, 6] };
  let t = 0, last = 0, lastDraw = 0, spin = 0, paused = false, reduced = reducedMotion, dirty = true;

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${base.cur.map(Math.round).join(',')})`;
    ctx.fillRect(0, 0, W, H);
    for (const b of blobs) {
      const x = W * (0.5 + b.ax * Math.sin(t * b.fx + b.px + spin));
      const y = H * (0.5 + b.ay * Math.cos(t * b.fy + b.py + spin * 0.7));
      const r = W * b.size * (1 + 0.14 * Math.sin(t * b.pulse * 0.6 + b.py));
      const c = b.cur.map(Math.round).join(',');
      const alpha = 0.66 + 0.3 * Math.sin(t * b.pulse + b.px);       // lėtas mirguliavimas
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${alpha})`);
      g.addColorStop(0.55, `rgba(${c},${alpha * 0.42})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastDraw < 40) return;                 // ~25 kadrai per sekundę fonui pakanka
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now; lastDraw = now;
    const still = paused || reduced;
    if (!still) t += dt;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 1.6);   // spalvos persilieja per ~1,5 s
    let moving = !still;
    const ease = (o) => { for (let i = 0; i < 3; i++) { const d = o.to[i] - o.cur[i]; if (Math.abs(d) > 0.4) { o.cur[i] += d * k; moving = true; } else o.cur[i] = o.to[i]; } };
    blobs.forEach(ease); ease(base);
    if (moving || dirty) { dirty = false; draw(); }
  }
  requestAnimationFrame(frame);

  return {
    /* colors – [[r,g,b], …] iš nuotraukos */
    setPalette(colors) {
      if (!colors || !colors.length) return;
      blobs.forEach((b, i) => { b.to = tone(colors[i % colors.length], i % 3 === 0 ? [0.34, 0.56] : i % 3 === 1 ? [0.26, 0.46] : [0.18, 0.36]); });
      const avg = [0, 1, 2].map((i) => colors.reduce((s, c) => s + c[i], 0) / colors.length);
      base.to = tone(avg, [0.08, 0.13]);
      dirty = true;
    },
    spin(v) { if (!paused && !reduced) { spin = v; } },
    setPaused(v) { paused = v; },
    setReduced(v) { reduced = v; dirty = true; },
  };
}
