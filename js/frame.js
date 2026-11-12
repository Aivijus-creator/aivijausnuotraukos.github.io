/*
  Plonas baltas rėmelis su graikišku meandro raštu nuotraukos kraštuose.
  Grąžina SVG kelio eilutę (koordinatės nuo nuotraukos centro), kurią naudoja ir
  spiralė (<canvas> per Path2D), ir peržiūra (inline <svg>).
*/
import { CONFIG } from './config.js';

const cache = new Map();
const f = (n) => Math.round(n * 10) / 10;

export function frameBand(w, h) {
  const c = CONFIG.frame;
  return Math.max(c.minBand, Math.min(c.maxBand, Math.min(w, h) * c.band));
}

export function meanderPath(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (cache.has(key)) return cache.get(key);
  const b = frameBand(w, h);
  const m = b * CONFIG.frame.inset;               // atstumas nuo nuotraukos krašto
  const hw = w / 2, hh = h / 2;
  let d = '';
  const rect = (i) => { d += `M${f(-hw + i)} ${f(-hh + i)}H${f(hw - i)}V${f(hh - i)}H${f(-hw + i)}Z`; };
  rect(m); rect(m + b);                           // išorinė ir vidinė linija
  // kraštinės: pradžios taškas, kryptis išilgai, kryptis į vidų, ilgis
  const edges = [
    [-hw + m + b, -hh + m, 1, 0, 0, 1, w - 2 * (m + b)],
    [hw - m, -hh + m + b, 0, 1, -1, 0, h - 2 * (m + b)],
    [hw - m - b, hh - m, -1, 0, 0, -1, w - 2 * (m + b)],
    [-hw + m, hh - m - b, 0, -1, 1, 0, h - 2 * (m + b)],
  ];
  // vienas „kablys“ periodo viduje: (išilgai 0..4, skersai 0..4; 4 = vidinė linija)
  const hook = [[0.6, 4], [0.6, 1], [3.4, 1], [3.4, 3], [2, 3], [2, 2]];
  for (const [ox, oy, ax, ay, cx, cy, len] of edges) {
    if (len <= b) continue;
    const n = Math.max(1, Math.round(len / b));
    const p = len / n, s = b / 4;
    for (let k = 0; k < n; k++) {
      hook.forEach(([u, v], i) => {
        const t = k * p + (u / 4) * p, q = v * s;
        d += `${i ? 'L' : 'M'}${f(ox + ax * t + cx * q)} ${f(oy + ay * t + cy * q)}`;
      });
    }
  }
  if (cache.size > 400) cache.clear();
  cache.set(key, d);
  return d;
}
