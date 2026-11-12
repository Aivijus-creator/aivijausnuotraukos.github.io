/*
  Rėmelis: ištisinė plona balta linija aplink visą nuotrauką ir šalia jos – juosta su
  antikiniu raštu. Kiekviena nuotrauka gauna kitą raštą (iš eilės pagal numerį, arba
  photos.json nurodytą lauke "frame").
  Grąžinamos SVG kelio eilutės (koordinatės nuo nuotraukos centro); jas naudoja ir
  spiralė (<canvas> per Path2D), ir peržiūra (inline <svg>).
*/
import { CONFIG } from './config.js';

/* Raštai vienam periodui: išilgai 0..4, skersai 0..4 (0 – prie rėmelio, 4 – vidinė linija). */
export const PATTERNS = {
  meandras: [['M', 0.6, 4], ['L', 0.6, 1], ['L', 3.4, 1], ['L', 3.4, 3], ['L', 2, 3], ['L', 2, 2]],
  bangos: [['M', 0, 3], ['C', 1, 3, 1, 0.9, 2, 0.9], ['C', 3, 0.9, 3, 3, 4, 3]],
  spiralės: [['M', 0, 3.5], ['C', 0.2, 0.7, 3.5, 0.6, 3.3, 2.2], ['C', 3.2, 3.2, 1.8, 3.2, 1.9, 2.2]],
  dantukai: [['M', 1, 4], ['L', 1, 1], ['L', 3, 1], ['L', 3, 4]],
  zigzagas: [['M', 0, 3.3], ['L', 2, 0.7], ['L', 4, 3.3]],
  rombai: [['M', 0, 2], ['L', 2, 0.6], ['L', 4, 2], ['L', 2, 3.4], ['Z']],
  karoliai: [['M', 0, 1.2], ['L', 0, 2.8], ['M', 2.9, 2], ['C', 2.9, 2.5, 2.5, 2.9, 2, 2.9], ['C', 1.5, 2.9, 1.1, 2.5, 1.1, 2], ['C', 1.1, 1.5, 1.5, 1.1, 2, 1.1], ['C', 2.5, 1.1, 2.9, 1.5, 2.9, 2], ['Z']],
  arkos: [['M', 0.5, 4], ['L', 0.5, 2.2], ['C', 0.5, 0.5, 3.5, 0.5, 3.5, 2.2], ['L', 3.5, 4], ['M', 0, 4], ['L', 0, 1.6]],
  kryžiukai: [['M', 0.9, 0.9], ['L', 3.1, 3.1], ['M', 3.1, 0.9], ['L', 0.9, 3.1]],
  žvynai: [['M', 0, 3.2], ['C', 0, 0.7, 4, 0.7, 4, 3.2]],
};
const NAMES = Object.keys(PATTERNS);

export function patternFor(item) {
  if (item.frame && PATTERNS[item.frame]) return item.frame;
  return NAMES[item.index % NAMES.length];
}

const cache = new Map();
const f = (n) => Math.round(n * 10) / 10;

export function frameSizes(w, h) {
  const c = CONFIG.frame;
  const b = Math.max(c.minBand, Math.min(c.maxBand, Math.min(w, h) * c.band));
  return { band: b, border: Math.max(1, b * c.border), line: Math.max(0.6, b * c.line) };
}

/* Ištisinė linija aplink nuotrauką (su suapvalintais kampais kaip pati nuotrauka). */
export function borderPath(w, h, r) {
  const { border } = frameSizes(w, h);
  const i = border / 2, x = w / 2 - i, y = h / 2 - i, k = Math.max(0, Math.min(r - i, x, y));
  return `M${f(-x + k)} ${f(-y)}H${f(x - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x)} ${f(-y + k)}V${f(y - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x - k)} ${f(y)}H${f(-x + k)}A${f(k)} ${f(k)} 0 0 1 ${f(-x)} ${f(y - k)}V${f(-y + k)}A${f(k)} ${f(k)} 0 0 1 ${f(-x + k)} ${f(-y)}Z`;
}

/* Rašto juosta prie rėmelio vidinės pusės + plona vidinė linija. */
export function patternPath(w, h, name) {
  const key = `${name}|${Math.round(w)}x${Math.round(h)}`;
  if (cache.has(key)) return cache.get(key);
  const { band: b, border } = frameSizes(w, h);
  const m = border * 1.6;                          // juosta prasideda iškart už rėmelio
  const hw = w / 2, hh = h / 2;
  let d = `M${f(-hw + m + b)} ${f(-hh + m + b)}H${f(hw - m - b)}V${f(hh - m - b)}H${f(-hw + m + b)}Z`;
  const edges = [
    [-hw + m + b, -hh + m, 1, 0, 0, 1, w - 2 * (m + b)],
    [hw - m, -hh + m + b, 0, 1, -1, 0, h - 2 * (m + b)],
    [hw - m - b, hh - m, -1, 0, 0, -1, w - 2 * (m + b)],
    [-hw + m, hh - m - b, 0, -1, 1, 0, h - 2 * (m + b)],
  ];
  const pat = PATTERNS[name] || PATTERNS.meandras;
  for (const [ox, oy, ax, ay, cx, cy, len] of edges) {
    if (len <= b) continue;
    const n = Math.max(1, Math.round(len / b));
    const p = len / n, s = b / 4;
    for (let k = 0; k < n; k++) {
      const pt = (u, v) => `${f(ox + ax * (k * p + (u / 4) * p) + cx * v * s)} ${f(oy + ay * (k * p + (u / 4) * p) + cy * v * s)}`;
      for (const [cmd, ...a] of pat) {
        if (cmd === 'Z') { d += 'Z'; continue; }
        let seg = cmd;
        for (let i = 0; i < a.length; i += 2) seg += (i ? ' ' : '') + pt(a[i], a[i + 1]);
        d += seg;
      }
    }
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, d);
  return d;
}
