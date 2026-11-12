/*
  Žvakių šviesa: du ploni sluoksniai virš stalo.
  „shade“ – tamsūs ekrano kraštai (vinjetė), „glow“ (CSS mix-blend-mode: screen) – šilta šviesa,
  žvakių liepsnos ir dulkės. Abu piešiami mažesne raiška ~30 k/s – stalo perpiešti nereikia.
*/
import { CONFIG } from './config.js';
import { flicker, rng } from './util.js';

export class Light {
  constructor(shade, glow, table, { reducedMotion = false } = {}) {
    this.shade = shade; this.glow = glow; this.table = table;
    this.sg = shade.getContext('2d'); this.gg = glow.getContext('2d');
    this.reduced = reducedMotion;
    this.level = 1;                                  // įžangos metu šviesa pamažu atsiranda
    const R = rng(99);
    this.dust = Array.from({ length: CONFIG.light.dust }, () => ({ x: R(), y: R(), vx: (R() - 0.5) * 0.006, vy: -0.002 - R() * 0.006, r: 0.6 + R() * 1.4, a: 0.15 + R() * 0.35, ph: R() * 6 }));
    this.resize();
    new ResizeObserver(() => this.resize()).observe(shade);
    this.last = 0;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }
  resize() {
    const W = this.shade.clientWidth || innerWidth, H = this.shade.clientHeight || innerHeight;
    this.W = W; this.H = H;
    this.shade.width = Math.round(W / 2); this.shade.height = Math.round(H / 2);
    this.glow.width = Math.round(W); this.glow.height = Math.round(H);
  }
  frame(now) {
    requestAnimationFrame(this.frame);
    if (now - this.last < 33) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, L = CONFIG.light, still = this.reduced;
    const f = still ? 0 : flicker(t * 0.9) * L.flicker;
    const { W, H } = this;
    // vinjetė
    const s = this.sg; s.setTransform(0.5, 0, 0, 0.5, 0, 0);
    s.clearRect(0, 0, W, H);
    const diag = Math.hypot(W, H);
    const cx = W / 2 + (still ? 0 : flicker(t * 0.6, 3) * 6), cy = H * 0.47 + (still ? 0 : flicker(t * 0.5, 5) * 5);
    const v = s.createRadialGradient(cx, cy, diag * 0.1, cx, cy, diag * 0.6);
    v.addColorStop(0, `rgba(4,2,1,${Math.max(0, 0.04 - f)})`);
    v.addColorStop(0.5, `rgba(4,2,1,${0.5 * L.vignette})`);
    v.addColorStop(1, `rgba(3,2,1,${Math.min(0.97, (0.88 + f * 2) * L.vignette)})`);
    s.fillStyle = v; s.fillRect(0, 0, W, H);
    if (this.level < 1) { s.fillStyle = `rgba(0,0,0,${1 - this.level})`; s.fillRect(0, 0, W, H); }
    // šilta šviesa, liepsnos, dulkės
    const g = this.gg; g.clearRect(0, 0, W, H);
    g.globalAlpha = this.level;
    const w = g.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.55);
    w.addColorStop(0, `rgba(243,181,98,${0.17 + f})`); w.addColorStop(0.5, `rgba(243,160,80,${0.06 + f / 2})`); w.addColorStop(1, 'rgba(243,181,98,0)');
    g.fillStyle = w; g.fillRect(0, 0, W, H);
    for (const c of this.table.candles) {
      const fl = still ? 0 : flicker(t * 3.1, c.seed) * 0.5 + flicker(t * 7.3, c.seed + 2) * 0.25;
      const R = c.r * 2.6 * (1 + fl * 0.06);
      const gl = g.createRadialGradient(c.sx, c.sy, 0, c.sx, c.sy, R);
      gl.addColorStop(0, `rgba(243,181,98,${0.3 + fl * 0.05})`); gl.addColorStop(0.4, 'rgba(243,150,70,0.1)'); gl.addColorStop(1, 'rgba(243,150,70,0)');
      g.fillStyle = gl; g.fillRect(c.sx - R, c.sy - R, R * 2, R * 2);
      const fr = c.r * 0.14, ox = still ? 0 : fl * fr * 0.25;
      const fg = g.createRadialGradient(c.sx + ox, c.sy - fr * 0.3, 0, c.sx + ox, c.sy - fr * 0.3, fr * 1.6);
      fg.addColorStop(0, 'rgba(255,250,225,1)'); fg.addColorStop(0.3, 'rgba(255,210,120,0.9)'); fg.addColorStop(0.7, 'rgba(240,120,40,0.35)'); fg.addColorStop(1, 'rgba(240,120,40,0)');
      g.fillStyle = fg; g.beginPath(); g.ellipse(c.sx + ox, c.sy - fr * 0.3, fr * 1.1, fr * 1.6, 0, 0, Math.PI * 2); g.fill();
    }
    if (!still) {
      for (const d of this.dust) {
        d.x = (d.x + d.vx * dt + 1) % 1; d.y = (d.y + d.vy * dt + 1) % 1;
        const a = d.a * (0.6 + 0.4 * Math.sin(t * 0.8 + d.ph));
        g.fillStyle = `rgba(255,228,180,${a})`;
        g.beginPath(); g.arc(d.x * W + Math.sin(t * 0.3 + d.ph) * 8, d.y * H, d.r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}
