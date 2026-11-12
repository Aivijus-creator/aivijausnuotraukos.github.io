/*
  Nuotrauka kaip atspaudas ant seno popieriaus: šviesus kraštas, šiek tiek apdriskę
  kraštai, senėjimo atspalvis ir šešėlis. Viskas uždedama kodu – pačios nuotraukos nekeičiamos.
*/
import { rng, canvas } from './util.js';
import { CONFIG } from './config.js';

/* Apdriskusių kraštų daugiakampis (taškai px), pastovus kiekvienai nuotraukai. */
export function roughEdge(seed, W, H) {
  const R = rng(seed * 7919 + 13);
  const m = Math.min(W, H), pts = [];
  const step = m * 0.018, base = m * 0.004, amp = m * 0.007;
  let n = 0;
  const off = () => { n = n * 0.6 + (R() - 0.5) * 0.8; const tear = R() < 0.03 ? R() * m * 0.012 : 0; return base + Math.abs(n) * amp + tear; };
  for (let x = 0; x < W; x += step) pts.push([x, off()]);
  for (let y = 0; y < H; y += step) pts.push([W - off(), y]);
  for (let x = W; x > 0; x -= step) pts.push([x, H - off()]);
  for (let y = H; y > 0; y -= step) pts.push([off(), y]);
  return pts;
}

/* Popieriaus dydis pagal nuotraukos dydį: kraštas – dalis nuotraukos pločio. */
export function paperSize(imgW, imgH) {
  const m = imgW * CONFIG.print.margin;
  return { W: imgW + m * 2, H: imgH + m * 2, m };
}

/*
  Sukuria atspaudo drobę. img gali būti null – tada tuščias pergamentas (kol kraunasi).
  long – popieriaus ilgoji kraštinė pikseliais. Grąžina drobę su paraštėmis šešėliui.
*/
export function makePrint(img, aspect, seed, long) {
  const imgW = aspect >= 1 ? long : long * aspect, imgH = aspect >= 1 ? long / aspect : long;
  const scale = long / Math.max(imgW, imgH);
  const p = paperSize(imgW * scale, imgH * scale);
  const k = long / Math.max(p.W, p.H);              // popierius turi tilpti į „long“
  const W = p.W * k, H = p.H * k, m = p.m * k;
  const pad = Math.round(Math.max(W, H) * 0.07);
  const c = canvas(W + pad * 2, H + pad * 2), g = c.getContext('2d');
  const pts = roughEdge(seed, W, H);
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(pad + x, pad + y) : path.moveTo(pad + x, pad + y)));
  path.closePath();

  // šešėlis ir popierius
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = Math.max(W, H) * 0.035;
  g.shadowOffsetX = Math.max(W, H) * 0.008;
  g.shadowOffsetY = Math.max(W, H) * 0.016;
  const paper = g.createRadialGradient(pad + W * 0.45, pad + H * 0.4, 0, pad + W / 2, pad + H / 2, Math.max(W, H) * 0.75);
  paper.addColorStop(0, '#efe3c3'); paper.addColorStop(0.7, '#e3d1a6'); paper.addColorStop(1, '#c9b07a');
  g.fillStyle = paper; g.fill(path);
  g.restore();

  g.save();
  g.clip(path);
  const R = rng(seed * 31 + 7);
  // popieriaus pluoštai ir dėmelės
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(120,90,40,${0.03 + R() * 0.05})`;
    g.beginPath(); g.ellipse(pad + R() * W, pad + R() * H, 0.5 + R() * Math.max(W, H) * 0.012, 0.5 + R() * 2, R() * 6, 0, 7); g.fill();
  }
  if (img) {
    g.drawImage(img, pad + m, pad + m, W - m * 2, H - m * 2);
    // senėjimo atspalvis: šiltas tonas + lengvai blankesni šešėliai
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgba(240,220,175,${CONFIG.print.tint})`; g.fillRect(pad + m, pad + m, W - m * 2, H - m * 2);
    g.globalCompositeOperation = 'screen';
    g.fillStyle = 'rgba(60,40,20,0.08)'; g.fillRect(pad + m, pad + m, W - m * 2, H - m * 2);
    g.globalCompositeOperation = 'source-over';
  }
  // pakraščiai patamsėję nuo laiko, kelios „rūdžių“ dėmelės
  const edge = g.createRadialGradient(pad + W / 2, pad + H / 2, Math.min(W, H) * 0.35, pad + W / 2, pad + H / 2, Math.hypot(W, H) * 0.56);
  edge.addColorStop(0, 'rgba(90,55,20,0)'); edge.addColorStop(1, 'rgba(90,55,20,0.32)');
  g.fillStyle = edge; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4; i++) {
    const x = pad + R() * W, y = pad + R() * H, r = Math.max(W, H) * (0.006 + R() * 0.014);
    const sg = g.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, 'rgba(130,80,30,0.16)'); sg.addColorStop(1, 'rgba(130,80,30,0)');
    g.fillStyle = sg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
  // plonas tamsesnis kraštelis
  g.strokeStyle = 'rgba(110,80,40,0.35)'; g.lineWidth = Math.max(0.6, Math.max(W, H) * 0.0015); g.stroke(path);
  c.pad = pad; c.paperW = W; c.paperH = H;
  return c;
}

/* Tas pats apdriskęs kraštas CSS clip-path pavidalu (peržiūrai). */
export function clipPolygon(seed, W, H) {
  return 'polygon(' + roughEdge(seed, W, H).map(([x, y]) => `${(x / W * 100).toFixed(2)}% ${(y / H * 100).toFixed(2)}%`).join(',') + ')';
}
