/*
  Fone – saulė ekrano centre. Spinduliai ir paviršius nupiešiami vieną kartą į nedidelius
  <canvas>, o juda vien CSS animacijomis (sukimas, „kvėpavimas“), todėl judesį atlieka
  vaizdo plokštė ir jis netrukdo spiralės sklandumui.
*/
function rng(seed) {                 // pastovus „atsitiktinumas“ – saulė kaskart ta pati
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawRays(canvas, { seed, count, width, length, alpha, color }) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width, c = S / 2, rand = rng(seed);
  ctx.clearRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const a = ((i + rand() * 0.9) / count) * Math.PI * 2;
    const half = (width[0] + rand() * (width[1] - width[0])) * Math.PI / 180;
    const len = (length[0] + rand() * (length[1] - length[0])) * c;
    const al = alpha[0] + rand() * (alpha[1] - alpha[0]);
    const g = ctx.createRadialGradient(c, c, 0, c, c, len);
    g.addColorStop(0, `rgba(${color},${al})`);
    g.addColorStop(0.35, `rgba(${color},${al * 0.46})`);
    g.addColorStop(0.7, `rgba(${color},${al * 0.12})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, len, a - half, a + half);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSurface(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width, c = S / 2, rand = rng(seed);
  ctx.clearRect(0, 0, S, S);
  const blob = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = 0; i < 230; i++) {    // granuliacija: šviesesnės ir tamsesnės dėmės
    const ang = rand() * Math.PI * 2, rad = Math.sqrt(rand()) * c * 0.98;
    const light = rand() > 0.46;
    blob(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad, S * (0.02 + rand() * 0.075), light ? '255,244,200' : '150,40,0', light ? 0.07 + rand() * 0.13 : 0.08 + rand() * 0.16);
  }
  for (let i = 0; i < 5; i++) {      // kelios saulės dėmės
    const ang = rand() * Math.PI * 2, rad = (0.2 + rand() * 0.55) * c;
    blob(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad, S * (0.012 + rand() * 0.02), '70,16,0', 0.5);
  }
}

export function mountSun(root) {
  const [raysA, raysB] = root.querySelectorAll('.sun__rays');
  const [surfA, surfB] = root.querySelectorAll('.sun__surface');
  // ilgis – spindulio dalis nuo centro iki piešinio krašto (kraštas yra už ekrano ribų)
  drawRays(raysA, { seed: 7, count: 46, width: [0.45, 1.9], length: [0.2, 0.7], alpha: [0.12, 0.42], color: '255,190,104' });
  drawRays(raysB, { seed: 23, count: 12, width: [3.5, 9], length: [0.26, 0.58], alpha: [0.04, 0.1], color: '255,132,54' });
  drawSurface(surfA, 3);
  drawSurface(surfB, 11);
  const turn = root.querySelector('.sun__turn');
  return {
    spin(deg) { turn.style.transform = `rotate(${deg.toFixed(2)}deg)`; },   // saulė pasisuka kartu su spirale
  };
}
