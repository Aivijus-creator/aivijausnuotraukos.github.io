/*
  Seno ąžuolo stalo tekstūra, nupiešta kodu (todėl laisvai naudojama ir lengva).
  Viskas kartojasi be siūlių: grūdai piešiami periodinėmis funkcijomis, o dėmės,
  įbrėžimai ir vaško lašai – su „apvyniojimu“ per kraštus.
*/
import { rng, canvas } from './util.js';

export function makeWood(size = 1024) {
  const c = canvas(size, size), g = c.getContext('2d'), R = rng(1307);
  const planks = 4, ph = size / planks, TAU = Math.PI * 2;
  const wrap = (draw) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { g.save(); g.translate(dx, dy); draw(); g.restore(); } };

  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    g.save();
    g.beginPath(); g.rect(0, y0, size, ph); g.clip();
    const l = 9 + R() * 4, hue = 20 + R() * 8;
    const base = g.createLinearGradient(0, y0, 0, y0 + ph);
    base.addColorStop(0, `hsl(${hue},38%,${l + 1.5}%)`);
    base.addColorStop(0.5, `hsl(${hue},40%,${l + 3}%)`);
    base.addColorStop(1, `hsl(${hue},38%,${l}%)`);
    g.fillStyle = base; g.fillRect(0, y0, size, ph);
    // medienos grūdai: banguojančios linijos, kurių periodas lygus tekstūros pločiui
    for (let k = 0; k < 70; k++) {
      const yy = y0 - 10 + R() * (ph + 20), a1 = 2 + R() * 9, f1 = 1 + Math.floor(R() * 3), p1 = R() * TAU, a2 = R() * 3, f2 = 3 + Math.floor(R() * 5), p2 = R() * TAU;
      const light = R() > 0.55;
      g.strokeStyle = light ? `rgba(200,150,100,${0.03 + R() * 0.06})` : `rgba(0,0,0,${0.08 + R() * 0.14})`;
      g.lineWidth = 0.4 + R() * (light ? 1.2 : 2.4);
      g.beginPath();
      for (let x = 0; x <= size; x += 8) {
        const y = yy + a1 * Math.sin(TAU * f1 * x / size + p1) + a2 * Math.sin(TAU * f2 * x / size + p2);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    // šakos (gumbai)
    const knots = Math.floor(R() * 2.2);
    for (let k = 0; k < knots; k++) {
      const kx = R() * size, ky = y0 + ph * (0.25 + R() * 0.5), rx = 10 + R() * 22, ry = rx * (0.35 + R() * 0.2);
      for (const dx of [-size, 0, size]) {
        for (let r = 0; r < 7; r++) {
          g.strokeStyle = `rgba(0,0,0,${0.2 - r * 0.022})`; g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(kx + dx, ky, rx * (1 + r * 0.45), ry * (1 + r * 0.6), 0, 0, TAU); g.stroke();
        }
        const kg = g.createRadialGradient(kx + dx, ky, 0, kx + dx, ky, rx);
        kg.addColorStop(0, 'rgba(8,4,2,0.75)'); kg.addColorStop(1, 'rgba(8,4,2,0)');
        g.fillStyle = kg; g.beginPath(); g.ellipse(kx + dx, ky, rx, ry, 0, 0, TAU); g.fill();
      }
    }
    // lentos galo sandūra
    const sx = R() * size;
    for (const dx of [-size, 0, size]) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(sx + dx, y0, 2.5, ph);
      g.fillStyle = 'rgba(220,170,120,0.05)'; g.fillRect(sx + dx + 2.5, y0, 1, ph);
    }
    g.restore();
    // siūlė tarp lentų
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, y0 - 1.5, size, 3.5);
    g.fillStyle = 'rgba(230,180,130,0.06)'; g.fillRect(0, y0 + 2, size, 1);
  }

  // įbrėžimai
  for (let k = 0; k < 90; k++) {
    const x = R() * size, y = R() * size, a = (R() - 0.5) * 0.9 + (R() > 0.7 ? Math.PI / 2 : 0), len = 15 + R() * 90, w = 0.4 + R() * 0.8, al = 0.04 + R() * 0.1;
    wrap(() => {
      g.strokeStyle = `rgba(225,180,135,${al})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len / 2 + (R() - 0.5) * 6, y + Math.sin(a) * len / 2, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    });
  }
  // rašalo dėmės
  const blob = (x, y, r, color, R2) => {
    g.fillStyle = color; g.beginPath();
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, rr = r * (0.75 + R2() * 0.45);
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  };
  for (let k = 0; k < 3; k++) {
    const x = R() * size, y = R() * size, r = 14 + R() * 26, seed = Math.floor(R() * 1e6);
    wrap(() => {
      const R2 = rng(seed);
      blob(x, y, r, 'rgba(6,4,3,0.55)', R2);
      blob(x, y, r * 0.7, 'rgba(4,3,3,0.35)', R2);
      for (let s = 0; s < 9; s++) { const a = R2() * TAU, d = r * (1.2 + R2() * 1.6); blob(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + R2() * 3.5, 'rgba(6,4,3,0.5)', R2); }
    });
  }
  // žvakių vaško lašai
  for (let k = 0; k < 12; k++) {
    const x = R() * size, y = R() * size, r = 2.5 + R() * 7, red = R() < 0.3;
    wrap(() => {
      const wg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      if (red) { wg.addColorStop(0, '#a3302a'); wg.addColorStop(1, '#5e1010'); }
      else { wg.addColorStop(0, '#ece0bf'); wg.addColorStop(1, '#b9a479'); }
      g.fillStyle = wg; g.beginPath(); g.ellipse(x, y, r, r * 0.88, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * 0.88, 0, 0, TAU); g.globalCompositeOperation = 'destination-over'; g.fill(); g.globalCompositeOperation = 'source-over';
    });
  }
  // smulki tekstūra
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * 14;
    d[i] = Math.max(0, d[i] + n); d[i + 1] = Math.max(0, d[i + 1] + n * 0.85); d[i + 2] = Math.max(0, d[i + 2] + n * 0.7);
  }
  g.putImageData(img, 0, 0);
  return c;
}
