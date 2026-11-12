/*
  Daiktai ant stalo (žiūrint iš viršaus), nupiešti kodu: žvakė, plunksna, rašalinė, raktas,
  kompasas, vaško lazdelės, pergamento ritinys, žolelės, smėlio laikrodis, monetos,
  o taip pat „segtukai“ nuotraukoms: vaškinis antspaudas, vinutė, akmenėlis.
  Kiekvienas nupiešiamas vieną kartą į atskirą <canvas> kartu su šešėliu.
*/
import { rng, canvas } from './util.js';

const TAU = Math.PI * 2;
const INK = '#2a1a10', RED = '#7a1515', GOLD = '#b08d3c';

/* Piešia objektą be šešėlio, tada perkelia ant galutinės drobės su vienu bendru šešėliu. */
function sprite(w, h, draw, shadow = 0.05) {
  const pad = Math.round(Math.max(w, h) * 0.12);
  const tmp = canvas(w, h), t = tmp.getContext('2d');
  t.translate(w / 2, h / 2);
  draw(t, w, h);
  const out = canvas(w + pad * 2, h + pad * 2), o = out.getContext('2d');
  o.shadowColor = 'rgba(0,0,0,0.6)';
  o.shadowBlur = Math.max(w, h) * shadow;
  o.shadowOffsetX = Math.max(w, h) * 0.018;
  o.shadowOffsetY = Math.max(w, h) * 0.03;
  o.drawImage(tmp, pad, pad);
  out.pad = pad / (w + pad * 2);
  out.inner = Math.max(w, h);
  return out;
}
const radial = (g, x, y, r0, r1, stops) => {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
const blobPath = (g, x, y, r, R, n = 24, j = 0.12) => {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, rr = r * (1 - j / 2 + R() * j);
    i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
};
const brass = (g, x, y, r) => radial(g, x - r * 0.35, y - r * 0.35, r * 0.05, r * 1.1, [[0, '#f0d58e'], [0.45, GOLD], [1, '#4a3510']]);

export function makeSprites() {
  const S = {};

  // ŽVAKĖ: žalvarinė lėkštelė su vaško žvake (liepsna piešiama šviesos sluoksnyje)
  S.candle = sprite(300, 300, (g) => {
    circle(g, 0, 0, 136); g.fillStyle = brass(g, 0, 0, 136); g.fill();
    g.lineWidth = 5; g.strokeStyle = 'rgba(255,230,160,0.35)'; circle(g, 0, 0, 120); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(40,25,5,0.55)'; circle(g, 0, 0, 96); g.stroke();
    g.lineWidth = 14; g.strokeStyle = brass(g, 120, 0, 40); g.beginPath(); g.arc(128, 0, 26, -1.9, 1.9); g.stroke();
    const R = rng(4);
    for (let i = 0; i < 7; i++) { const a = R() * TAU; g.fillStyle = '#e6dbbd'; g.beginPath(); g.ellipse(Math.cos(a) * 66, Math.sin(a) * 66, 13 + R() * 9, 9, a, 0, TAU); g.fill(); }
    circle(g, 0, 0, 62); g.fillStyle = radial(g, -12, -12, 4, 70, [[0, '#fbf3dc'], [0.7, '#e9dcb8'], [1, '#c6b080']]); g.fill();
    circle(g, 0, 0, 30); g.fillStyle = 'rgba(255,248,225,0.7)'; g.fill();
    circle(g, 0, 0, 5); g.fillStyle = INK; g.fill();
  });
  S.candle.flame = true;

  // RAŠALINĖ
  S.inkwell = sprite(240, 240, (g) => {
    g.beginPath(); g.roundRect(-100, -100, 200, 200, 46);
    g.fillStyle = radial(g, -40, -40, 10, 170, [[0, '#46564f'], [0.6, '#1e2a26'], [1, '#0b100e']]); g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(160,200,180,0.18)'; g.stroke();
    circle(g, 0, 0, 52); g.fillStyle = brass(g, 0, 0, 52); g.fill();
    circle(g, 0, 0, 38); g.fillStyle = radial(g, -8, -8, 2, 40, [[0, '#1b1512'], [1, '#050302']]); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 28, 3.6, 4.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 84, 3.5, 4.4); g.stroke();
  });

  // ŽĄSIES PLUNKSNA
  S.quill = sprite(640, 150, (g) => {
    const R = rng(9);
    g.save(); g.rotate(-0.05);
    g.beginPath();
    g.moveTo(-250, 0);
    g.bezierCurveTo(-120, -70, 120, -75, 300, -18);
    g.bezierCurveTo(250, 6, 120, 30, -60, 22);
    g.bezierCurveTo(-140, 18, -210, 10, -250, 0);
    const vane = g.createLinearGradient(0, -70, 0, 30);
    vane.addColorStop(0, '#d9ccb2'); vane.addColorStop(0.35, '#f4ecdc'); vane.addColorStop(0.7, '#cbbd9f'); vane.addColorStop(1, '#6f5f48');
    g.fillStyle = vane; g.fill();
    g.save(); g.clip();
    for (let x = -240; x < 300; x += 5) {
      g.strokeStyle = `rgba(90,75,55,${0.12 + R() * 0.12})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, -80); g.moveTo(x, 0); g.lineTo(x + 26, 40); g.stroke();
    }
    g.restore();
    g.strokeStyle = '#9d8b6c'; g.lineWidth = 5; g.beginPath(); g.moveTo(-310, 4); g.quadraticCurveTo(0, -6, 305, -16); g.stroke();
    g.strokeStyle = '#f3ead8'; g.lineWidth = 2; g.beginPath(); g.moveTo(-300, 2); g.quadraticCurveTo(0, -8, 300, -17); g.stroke();
    const tip = g.createLinearGradient(180, 0, 300, 0); tip.addColorStop(0, 'rgba(70,50,30,0)'); tip.addColorStop(1, 'rgba(70,50,30,0.55)');
    g.fillStyle = tip; g.beginPath(); g.moveTo(180, -60); g.bezierCurveTo(240, -50, 280, -30, 300, -18); g.bezierCurveTo(260, 0, 220, 15, 180, 20); g.closePath(); g.fill();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(-318, 6); g.lineTo(-282, 1); g.lineTo(-282, 9); g.closePath(); g.fill();
    g.restore();
  }, 0.03);

  // RAKTAS
  S.key = sprite(440, 160, (g) => {
    const iron = (x, y, r) => radial(g, x - r * 0.4, y - r * 0.4, 1, r * 1.3, [[0, '#8a8277'], [0.5, '#4b4640'], [1, '#1d1a17']]);
    g.lineWidth = 22; g.strokeStyle = iron(-150, 0, 60); circle(g, -150, 0, 46); g.stroke();
    g.lineWidth = 6; g.strokeStyle = 'rgba(200,190,170,0.25)'; g.beginPath(); g.arc(-150, 0, 52, 3.6, 4.8); g.stroke();
    g.fillStyle = iron(40, -10, 220); g.fillRect(-104, -11, 300, 22);
    for (const x of [-96, -74]) { g.fillRect(x, -17, 9, 34); }
    g.beginPath(); g.moveTo(150, 10); g.lineTo(150, 62); g.lineTo(168, 62); g.lineTo(168, 44); g.lineTo(184, 44); g.lineTo(184, 62); g.lineTo(200, 62); g.lineTo(200, 10); g.closePath(); g.fill();
    const R = rng(3);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(120,55,20,${0.15 + R() * 0.25})`; circle(g, -180 + R() * 370, -8 + R() * 16, 1.5 + R() * 4); g.fill(); }
  });

  // KOMPASAS
  S.compass = sprite(260, 260, (g) => {
    circle(g, 0, 0, 120); g.fillStyle = brass(g, 0, 0, 120); g.fill();
    circle(g, 0, 0, 100); g.fillStyle = radial(g, -20, -20, 5, 110, [[0, '#f6ead0'], [1, '#d6c39a']]); g.fill();
    g.strokeStyle = 'rgba(42,26,16,0.6)'; g.lineWidth = 1.5;
    for (let i = 0; i < 32; i++) { const a = i * TAU / 32, r0 = i % 4 ? 90 : 84; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 98, Math.sin(a) * 98); g.stroke(); }
    const star = (r, w, rot, cols) => {
      for (let i = 0; i < 4; i++) {
        const a = rot + i * TAU / 4;
        for (let s = 0; s < 2; s++) {
          g.beginPath(); g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a + (s ? w : -w)) * r * 0.28, Math.sin(a + (s ? w : -w)) * r * 0.28);
          g.closePath(); g.fillStyle = cols[s]; g.fill();
        }
      }
    };
    star(70, 0.5, TAU / 8, ['#8b6a2a', '#cfae62']);
    star(88, 0.36, -Math.PI / 2, [RED, '#a8322b']);
    g.fillStyle = INK; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', 0, -74 + 6);
    g.save(); g.rotate(0.35);
    g.fillStyle = '#2b2b30'; g.beginPath(); g.moveTo(0, -80); g.lineTo(7, 0); g.lineTo(0, 80); g.lineTo(-7, 0); g.closePath(); g.fill();
    g.fillStyle = RED; g.beginPath(); g.moveTo(0, -80); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); g.fill();
    g.restore();
    circle(g, 0, 0, 8); g.fillStyle = brass(g, 0, 0, 8); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 80, 3.7, 4.6); g.stroke();
  });

  // VAŠKO LAZDELĖS
  S.wax = sprite(420, 120, (g) => {
    const rod = (y, a, col) => {
      g.save(); g.rotate(a); g.translate(0, y);
      const gr = g.createLinearGradient(0, -16, 0, 16);
      gr.addColorStop(0, col[0]); gr.addColorStop(0.35, col[1]); gr.addColorStop(1, col[2]);
      g.fillStyle = gr; g.beginPath(); g.roundRect(-180, -15, 360, 30, 15); g.fill();
      g.fillStyle = '#c7a24f'; g.fillRect(70, -15, 26, 30);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(70, -15, 26, 6);
      g.restore();
    };
    rod(-20, -0.04, ['#b2443b', RED, '#3f0808']);
    rod(22, 0.05, ['#6b4b2a', '#3d2a17', '#1c1209']);
  });

  // PERGAMENTO RITINYS
  S.scroll = sprite(460, 150, (g) => {
    const gr = g.createLinearGradient(0, -55, 0, 55);
    gr.addColorStop(0, '#8d7848'); gr.addColorStop(0.3, '#ecdcb2'); gr.addColorStop(0.55, '#f6ead0'); gr.addColorStop(1, '#7c6638');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-200, -52, 400, 104, 18); g.fill();
    for (const x of [-200, 200]) {
      g.fillStyle = radial(g, x, 0, 4, 54, [[0, '#6e5a31'], [0.3, '#d9c69a'], [0.6, '#b49d6b'], [1, '#6a5530']]);
      g.beginPath(); g.ellipse(x, 0, 22, 52, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 2; for (let r = 6; r < 20; r += 5) { g.beginPath(); g.ellipse(x, 0, r, r * 2.3, 0, 0, TAU); g.stroke(); }
    }
    g.fillStyle = RED; g.fillRect(-22, -54, 30, 108);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, -54, 6, 108);
    g.fillStyle = RED; g.beginPath(); g.moveTo(-10, 50); g.quadraticCurveTo(-30, 70, -60, 70); g.lineTo(-52, 60); g.lineTo(-62, 52); g.quadraticCurveTo(-30, 52, -18, 40); g.fill();
  });

  // DŽIOVINTOS ŽOLELĖS
  S.herbs = sprite(380, 200, (g) => {
    const R = rng(21);
    for (let i = 0; i < 26; i++) {
      const a = -0.45 + R() * 0.9, len = 170 + R() * 120, bend = (R() - 0.5) * 50;
      const col = R() > 0.4 ? `hsl(${50 + R() * 20},${25 + R() * 15}%,${22 + R() * 14}%)` : `hsl(${28 + R() * 10},35%,${25 + R() * 10}%)`;
      g.strokeStyle = col; g.lineWidth = 1.5 + R() * 1.5;
      const ex = -150 + Math.cos(a) * len, ey = Math.sin(a) * len;
      g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-150 + Math.cos(a) * len / 2, Math.sin(a) * len / 2 + bend, ex, ey); g.stroke();
      for (let l = 0; l < 7; l++) {
        const t = 0.35 + l * 0.09, lx = -150 + Math.cos(a) * len * t, ly = Math.sin(a) * len * t + bend * t * (1 - t) * 2;
        g.fillStyle = col; g.beginPath(); g.ellipse(lx, ly + (l % 2 ? 5 : -5), 9, 3.5, a + (l % 2 ? 0.6 : -0.6), 0, TAU); g.fill();
      }
    }
    g.fillStyle = '#a58a5c'; for (let i = 0; i < 6; i++) g.fillRect(-160 + i * 4, -12, 3, 24);
  });

  // SMĖLIO LAIKRODIS (gulintis)
  S.hourglass = sprite(300, 170, (g) => {
    const wood = (x) => { const gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, '#2c1a0d'); gr.addColorStop(0.5, '#6b4524'); gr.addColorStop(1, '#25150a'); return gr; };
    g.fillStyle = 'rgba(235,240,240,0.18)';
    g.beginPath(); g.moveTo(-110, -55); g.bezierCurveTo(-30, -60, -20, -6, 0, -6); g.bezierCurveTo(20, -6, 30, -60, 110, -55); g.lineTo(110, 55); g.bezierCurveTo(30, 60, 20, 6, 0, 6); g.bezierCurveTo(-20, 6, -30, 60, -110, 55); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#d8bf8a'; g.beginPath(); g.moveTo(-108, -30); g.bezierCurveTo(-60, -34, -40, -8, -18, -4); g.lineTo(-18, 4); g.bezierCurveTo(-40, 8, -60, 34, -108, 30); g.closePath(); g.fill();
    g.fillStyle = '#d8bf8a'; g.beginPath(); g.ellipse(70, 0, 30, 14, 0, 0, TAU); g.fill();
    for (const x of [-126, 126]) { g.fillStyle = wood(x); g.beginPath(); g.roundRect(x - 14, -72, 28, 144, 8); g.fill(); }
    g.fillStyle = '#3d2614'; for (const y of [-64, 64]) g.fillRect(-114, y - 4, 228, 8);
  });

  // MONETOS
  S.coins = sprite(220, 180, (g) => {
    const coin = (x, y, r, gold) => {
      circle(g, x, y, r);
      g.fillStyle = gold ? radial(g, x - r * 0.4, y - r * 0.4, 1, r * 1.2, [[0, '#f6dc8a'], [0.6, '#b8902f'], [1, '#5c4210']]) : radial(g, x - r * 0.4, y - r * 0.4, 1, r * 1.2, [[0, '#f0efe8'], [0.6, '#a9a79c'], [1, '#4e4c45']]);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; circle(g, x, y, r * 0.8); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.35, y); g.lineTo(x + r * 0.35, y); g.moveTo(x, y - r * 0.35); g.lineTo(x, y + r * 0.35); g.stroke();
    };
    coin(-34, 18, 46, true); coin(40, -6, 42, false); coin(10, -36, 36, true);
  });

  // ── segtukai nuotraukoms ──
  S.seal = sprite(160, 160, (g) => {
    const R = rng(77);
    blobPath(g, 0, 0, 70, R, 30, 0.2);
    g.fillStyle = radial(g, -20, -20, 5, 90, [[0, '#b13a32'], [0.6, RED], [1, '#3e0707']]); g.fill();
    circle(g, 0, 0, 46); g.fillStyle = radial(g, 10, 10, 4, 52, [[0, '#8e1d1a'], [1, '#5a0c0c']]); g.fill();
    g.strokeStyle = 'rgba(255,190,170,0.25)'; g.lineWidth = 2; circle(g, 0, 0, 46); g.stroke();
    g.font = '600 38px "EB Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(30,0,0,0.55)'; g.fillText('AR', 1.5, 3.5);
    g.fillStyle = '#c4554a'; g.fillText('AR', 0, 2);
  }, 0.06);
  S.nail = sprite(70, 70, (g) => {
    circle(g, 0, 0, 26); g.fillStyle = radial(g, -8, -8, 1, 30, [[0, '#b3aca0'], [0.5, '#5a5550'], [1, '#1c1a18']]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; circle(g, -8, -9, 6); g.fill();
  }, 0.08);
  S.stone = sprite(140, 110, (g) => {
    const R = rng(5);
    blobPath(g, 0, 0, 50, R, 20, 0.25); g.save(); g.scale(1.2, 0.85);
    g.restore();
    g.fillStyle = radial(g, -18, -16, 4, 70, [[0, '#9d978b'], [0.6, '#5f5a52'], [1, '#2c2925']]); g.fill();
  }, 0.08);

  return S;
}

/* Kurie daiktai kur: didesni – laisvuose stalo langeliuose, smulkūs – tarp nuotraukų. */
export const BIG = ['candle', 'inkwell', 'scroll', 'compass', 'hourglass', 'candle', 'quill'];
export const SMALL = ['coins', 'key', 'herbs', 'wax', 'quill', 'coins'];
export const PINS = ['seal', 'nail', 'stone', 'key'];
/* Daikto ilgoji kraštinė stalo langelio dalimis. */
export const SIZE = { candle: 0.5, inkwell: 0.36, quill: 0.7, key: 0.42, compass: 0.4, wax: 0.42, scroll: 0.62, herbs: 0.48, hourglass: 0.44, coins: 0.24, seal: 0.11, nail: 0.045, stone: 0.12 };
