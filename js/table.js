/*
  Begalinis viduramžiškas stalas su išmėtytomis nuotraukomis.
  Pasaulis padalytas į langelius (1 langelis = 1 pasaulio vienetas). Kiekviename langelyje –
  viena nuotrauka arba didesnis daiktas; tarpuose – smulkūs daiktai. Išdėstymas apskaičiuojamas
  iš langelio koordinačių pastoviu „atsitiktinumu“, todėl kiekvieną kartą toks pat.
  Piešiama viename <canvas>; piešiama tik tai, kas arti matomos srities.
*/
import { CONFIG } from './config.js';
import { clamp, hash2, rng, DEG } from './util.js';
import { makeWood } from './texture.js';
import { makeSprites, BIG, SMALL, PINS, SIZE } from './sprites.js';
import { makePrint } from './print.js';

const TAU = Math.PI * 2;
const TEX_WORLD = 3.4;                    // kiek langelių užima viena stalo tekstūros plytelė
const FIXED = { '-2,1': 'candle', '2,-2': 'candle', '3,1': 'inkwell' };   // keli daiktai visada prie centro

export class Table {
  constructor(canvas, items, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = items;
    this.N = items.length;
    this.cfg = CONFIG.table;
    this.reduced = reducedMotion;
    this.cam = { x: 0, y: 0, z: 1 };
    this.vel = { x: 0, y: 0 };
    this.goal = null;
    this.ptrs = new Map();
    this.drag = null;
    this.paused = false;
    this.hidden = null;
    this.hoverKey = null;
    this.hoverAnim = new Map();
    this.focusKey = null;
    this.cells = new Map();
    this.corners = new Map();
    this.prints = new Map();
    this.blanks = new Map();
    this.inflight = 0;
    this.dirty = true;
    this.fadeUntil = 0;
    this.candles = [];
    this.handlers = {};
    for (const it of items) { it.sm = {}; it.md = {}; }

    this.wood = makeWood(1024);
    this.pattern = this.ctx.createPattern(this.wood, 'repeat');
    this.sprites = makeSprites();
    this.buildRanks();
    this.resize();
    this.bind();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  on(n, f) { (this.handlers[n] ||= []).push(f); return this; }
  emit(n, ...a) { for (const f of this.handlers[n] || []) f(...a); }

  /* ── išdėstymas ── */
  isStill(gx, gy) {
    if (FIXED[gx + ',' + gy]) return true;
    const s = this.cfg.stillLife;
    return s > 0 && Math.abs(gx) + Math.abs(gy) > 1 && hash2(gx, gy, this.cfg.seed + 1) % s === 0;
  }
  /* Pirmosios sąrašo nuotraukos – arčiausiai centro (pagal atstumą nuo jo). */
  buildRanks() {
    this.rank = new Map(); this.homes = [];
    if (!this.N) return;
    let r = 2, cells = [];
    for (;;) {
      cells = [];
      for (let gy = -r; gy <= r; gy++) for (let gx = -r; gx <= r; gx++) if (!this.isStill(gx, gy)) cells.push([gx, gy, Math.hypot(gx, gy * 1.15) + (Math.atan2(gy, gx) + Math.PI) * 1e-4]);
      cells = cells.filter((c) => c[2] <= r);
      if (cells.length >= this.N) break;
      r++;
    }
    cells.sort((a, b) => a[2] - b[2]);
    for (let i = 0; i < this.N; i++) { const [gx, gy] = cells[i]; this.rank.set(gx + ',' + gy, i); this.homes[i] = [gx, gy]; }
  }
  pick(gx, gy) {
    const N = this.N, base = (x, y) => hash2(x, y, this.cfg.seed + 2) % N;
    let i = base(gx, gy);
    const l = this.rank.get((gx - 1) + ',' + gy) ?? base(gx - 1, gy), u = this.rank.get(gx + ',' + (gy - 1)) ?? base(gx, gy - 1);
    for (let t = 0; t < 3 && N > 2 && (i === l || i === u); t++) i = (i + 1) % N;
    return i;
  }
  cell(gx, gy) {
    const key = gx + ',' + gy;
    let c = this.cells.get(key);
    if (c) return c;
    if (this.cells.size > 6000) this.cells.clear();
    const cf = this.cfg, R = rng(hash2(gx, gy, cf.seed));
    if (this.isStill(gx, gy)) {
      c = { key, gx, gy, still: true, deco: FIXED[key] || BIG[Math.floor(R() * BIG.length)], x: gx + (R() - 0.5) * 0.3, y: gy + (R() - 0.5) * 0.3, rot: R() * TAU, s: 0.9 + R() * 0.25 };
    } else {
      const index = this.rank.get(key) ?? this.pick(gx, gy);
      const item = this.items[index], a = item.aspect, m = CONFIG.print.margin;
      const iw = a >= 1 ? 1 : a, ih = a >= 1 ? 1 / a : 1;
      const W = iw * (1 + 2 * m), H = ih + 2 * m * iw;
      const L = cf.photoSize * (1 + (R() * 2 - 1) * cf.sizeJitter), f = L / Math.max(W, H);
      c = {
        key, gx, gy, index,
        w: W * f, h: H * f,
        rot: (R() * 2 - 1) * cf.maxRotation * DEG,
        x: gx + (R() - 0.5) * 2 * cf.jitter, y: gy + (R() - 0.5) * 2 * cf.jitter,
        z: R(),
        pin: R() < cf.pins ? { type: PINS[Math.floor(R() * PINS.length)], corner: Math.floor(R() * 4), rot: R() * TAU } : null,
      };
    }
    this.cells.set(key, c);
    return c;
  }
  corner(gx, gy) {
    const key = gx + ',' + gy;
    let c = this.corners.get(key);
    if (c !== undefined) return c;
    if (this.corners.size > 6000) this.corners.clear();
    const R = rng(hash2(gx, gy, this.cfg.seed + 3));
    c = R() < this.cfg.smallItems ? { deco: SMALL[Math.floor(R() * SMALL.length)], x: gx + 0.5 + (R() - 0.5) * 0.16, y: gy + 0.5 + (R() - 0.5) * 0.16, rot: R() * TAU, s: 0.85 + R() * 0.3 } : null;
    this.corners.set(key, c);
    return c;
  }
  homeCell(index) { const h = this.homes[index] || [0, 0]; return this.cell(h[0], h[1]); }

  /* ── kamera ── */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight;
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    const target = W < 700 ? this.cfg.perScreenPhone : this.cfg.perScreen;
    this.unit = clamp(Math.sqrt((W * H) / target), 150, 440);
    this.dirty = true;
  }
  get scale() { return this.unit * this.cam.z; }
  toScreen(x, y) { const s = this.scale; return [(x - this.cam.x) * s + this.W / 2, (y - this.cam.y) * s + this.H / 2]; }
  toWorld(sx, sy) { const s = this.scale; return [this.cam.x + (sx - this.W / 2) / s, this.cam.y + (sy - this.H / 2) / s]; }
  instanceRect(c) {
    const [cx, cy] = this.toScreen(c.x, c.y), s = this.scale;
    return { cx, cy, w: c.w * s, h: c.h * s, rot: c.rot };
  }
  stop() { this.vel.x = this.vel.y = 0; this.goal = null; }
  panTo(c, rate = 5) { this.vel.x = this.vel.y = 0; this.goal = { x: c.x, y: c.y, z: this.cam.z, rate }; }
  home() { this.vel.x = this.vel.y = 0; this.goal = { x: 0, y: 0, z: 1, rate: 4.5 }; this.emit('interact'); }
  nudge(dx, dy) {
    const g = this.goal || { x: this.cam.x, y: this.cam.y, z: this.cam.z };
    const step = 0.55 / this.cam.z;
    this.vel.x = this.vel.y = 0;
    this.goal = { x: g.x + dx * step, y: g.y + dy * step, z: g.z, rate: 9 };
    this.emit('interact');
  }
  zoomAt(sx, sy, z) {
    z = clamp(z, this.cfg.minZoom, this.cfg.maxZoom);
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z = z;
    const s = this.scale;
    this.cam.x = wx - (sx - this.W / 2) / s; this.cam.y = wy - (sy - this.H / 2) / s;
    this.dirty = true;
  }
  zoomBy(f) {
    const g = this.goal || { x: this.cam.x, y: this.cam.y, z: this.cam.z };
    this.goal = { x: g.x, y: g.y, z: clamp(g.z * f, this.cfg.minZoom, this.cfg.maxZoom), rate: 8 };
    this.emit('interact');
  }
  /* Artimiausia matoma tos nuotraukos vieta ant stalo (arba jos „namai“ prie centro). */
  nearestInstance(index) {
    let best = null, bd = Infinity;
    const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    for (let r = 0; r <= 7; r++) {
      for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
        if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== r) continue;
        const c = this.cell(gx, gy);
        if (c.still || c.index !== index) continue;
        const d = Math.hypot(c.x - this.cam.x, c.y - this.cam.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && r >= 2) break;
    }
    return best || this.homeCell(index);
  }

  /* ── nuotraukų krovimas ir atspaudai ── */
  ensure(item, tier) {
    const slot = item[tier];
    if (slot.state || this.inflight >= 6) return;
    slot.state = 'loading'; this.inflight++;
    const img = new Image(); img.decoding = 'async';
    let finished = false;
    const done = (ok) => {
      if (finished) return; finished = true; this.inflight--;
      if (ok && img.naturalWidth) { slot.img = img; slot.state = 'ready'; }
      else if (!slot.fallback && item.urls[tier] !== item.orig) { slot.fallback = true; slot.state = null; item.urls = { sm: item.orig, md: item.orig, lg: item.orig }; }
      else slot.state = 'error';
      this.dirty = true;
    };
    img.onload = () => (img.decode ? img.decode().then(() => done(true), () => done(true)) : done(true));
    img.onerror = () => done(false);
    img.src = item.urls[tier];
  }
  bestSrc(index) { const it = this.items[index]; return (it.md.img || it.sm.img)?.src || it.urls.sm; }
  blank(item) {
    let b = this.blanks.get(item.index);
    if (!b) { b = makePrint(null, item.aspect, item.index + 1, 200); this.blanks.set(item.index, b); }
    return b;
  }
  print(item, tier) {
    const key = item.index + tier;
    let p = this.prints.get(key);
    if (p) { this.prints.delete(key); this.prints.set(key, p); return p; }
    const slot = item[tier];
    if (!slot.img || this.budget <= 0) return null;
    this.budget -= tier === 'md' ? 2 : 1;
    p = makePrint(slot.img, item.aspect, item.index + 1, tier === 'md' ? 1300 : 500);
    p.at = performance.now();
    this.fadeUntil = p.at + 700;
    this.prints.set(key, p);
    let md = 0;
    for (const k of this.prints.keys()) if (k.endsWith('md')) md++;
    for (const k of this.prints.keys()) {
      if (this.prints.size <= 110 && md <= 10) break;
      if (k.endsWith('md') && md > 10) { this.prints.delete(k); md--; }
      else if (this.prints.size > 110 && !k.endsWith('md')) this.prints.delete(k);
    }
    return p;
  }

  /* ── valdymas ── */
  bind() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('pointercancel', (e) => this.onUp(e, true));
    cv.addEventListener('pointerleave', () => { if (!this.ptrs.size) this.setHover(null); });
    cv.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(cv);
  }
  setPaused(p) { this.paused = p; if (p) { this.ptrs.clear(); this.drag = null; this.setHover(null); this.canvas.classList.remove('is-dragging'); } }
  setHover(key) {
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.canvas.classList.toggle('is-over', !!key);
    this.dirty = true;
  }
  baseline() {
    const pts = [...this.ptrs.values()];
    if (pts.length >= 2) {
      const [a, b] = pts, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.drag = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.cam.z, w0: this.toWorld(mx, my), moved: true, samples: [] };
    } else if (pts.length === 1) {
      const p = pts[0];
      this.drag = { pinch: false, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: this.drag?.moved || false, type: p.type, samples: [], t0: performance.now() };
    } else this.drag = null;
  }
  onDown(e) {
    if (this.paused || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    this.stop();
    if (this.ptrs.size === 1) this.drag = null;
    this.baseline();
  }
  onMove(e) {
    if (this.paused) return;
    const p = this.ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') { const c = this.hit(e.clientX, e.clientY); this.setHover(c ? c.key : null); } return; }
    p.x = e.clientX; p.y = e.clientY;
    const d = this.drag;
    if (!d) return;
    if (d.pinch) {
      const [a, b] = [...this.ptrs.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.cam.z = clamp(d.z0 * Math.hypot(a.x - b.x, a.y - b.y) / d.d0, this.cfg.minZoom, this.cfg.maxZoom);
      const s = this.scale;
      this.cam.x = d.w0[0] - (mx - this.W / 2) / s; this.cam.y = d.w0[1] - (my - this.H / 2) / s;
      this.dirty = true; this.emit('interact');
      return;
    }
    if (!d.moved) {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < (d.type === 'mouse' ? 5 : 10)) return;
      d.moved = true; d.x = p.x; d.y = p.y;
      this.canvas.classList.add('is-dragging'); this.setHover(null); this.emit('interact');
      return;
    }
    const s = this.scale;
    this.cam.x -= (p.x - d.x) / s; this.cam.y -= (p.y - d.y) / s;
    d.x = p.x; d.y = p.y;
    d.samples.push({ t: e.timeStamp, x: this.cam.x, y: this.cam.y });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 100) d.samples.shift();
    this.dirty = true;
  }
  onUp(e, cancelled = false) {
    if (!this.ptrs.has(e.pointerId)) return;
    const d = this.drag;
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size) { this.baseline(); if (this.drag) this.drag.moved = true; return; }
    this.drag = null;
    this.canvas.classList.remove('is-dragging');
    if (!d || cancelled) return;
    if (!d.moved && !d.pinch) {                    // paspaudimas, ne tempimas
      const c = this.hit(e.clientX, e.clientY);
      if (c) this.emit('open', c);
      return;
    }
    const sm = d.samples;
    if (!this.reduced && sm.length >= 2 && e.timeStamp - sm[sm.length - 1].t < 80) {
      const a = sm[0], b = sm[sm.length - 1], dt = (b.t - a.t) / 1000;
      if (dt > 0) {
        this.vel.x = clamp((b.x - a.x) / dt, -12, 12); this.vel.y = clamp((b.y - a.y) / dt, -12, 12);
      }
    }
    if (e.pointerType === 'mouse') { const c = this.hit(e.clientX, e.clientY); this.setHover(c ? c.key : null); }
  }
  onWheel(e) {
    e.preventDefault();
    if (this.paused) return;
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 33; dy *= 33; } else if (e.deltaMode === 2) { dx *= this.H; dy *= this.H; }
    this.emit('interact');
    if (e.ctrlKey) { this.stop(); this.zoomAt(e.clientX, e.clientY, this.cam.z * Math.exp(-dy * 0.01)); return; }
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const s = this.scale;
    this.vel.x = this.vel.y = 0;
    if (Math.abs(dx) + Math.abs(dy) >= 50) {        // pelės ratukas – sklandžiai
      const g = this.goal || { x: this.cam.x, y: this.cam.y, z: this.cam.z };
      this.goal = { x: g.x + dx / s, y: g.y + dy / s, z: g.z, rate: 14 };
    } else { this.goal = null; this.cam.x += dx / s; this.cam.y += dy / s; this.dirty = true; }
  }
  hit(px, py) {
    const list = this.drawn || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      if (c.key === this.hidden) continue;
      const r = this.instanceRect(c), dx = px - r.cx, dy = py - r.cy;
      const cs = Math.cos(-r.rot), sn = Math.sin(-r.rot);
      if (Math.abs(dx * cs - dy * sn) <= r.w / 2 && Math.abs(dx * sn + dy * cs) <= r.h / 2) return c;
    }
    return null;
  }
  setHidden(key) { this.hidden = key; this.dirty = true; }
  setFocus(key) { this.focusKey = key; this.dirty = true; }
  render() { this.draw(performance.now()); }

  /* ── kadras ── */
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    const dragging = this.drag && this.ptrs.size;
    if (!dragging && this.goal) {
      const g = this.goal, k = this.reduced ? 1 : 1 - Math.exp(-g.rate * dt);
      this.cam.x += (g.x - this.cam.x) * k; this.cam.y += (g.y - this.cam.y) * k; this.cam.z += (g.z - this.cam.z) * k;
      if (Math.abs(g.x - this.cam.x) + Math.abs(g.y - this.cam.y) < 1e-4 && Math.abs(g.z - this.cam.z) < 1e-4) { this.cam.x = g.x; this.cam.y = g.y; this.cam.z = g.z; this.goal = null; }
      this.dirty = true;
    } else if (!dragging && (this.vel.x || this.vel.y)) {     // inercija
      this.cam.x += this.vel.x * dt; this.cam.y += this.vel.y * dt;
      const f = Math.exp(-dt / this.cfg.inertia);
      this.vel.x *= f; this.vel.y *= f;
      if (Math.hypot(this.vel.x, this.vel.y) < 0.02) this.vel.x = this.vel.y = 0;
      this.dirty = true;
    }
    for (const [k, v] of this.hoverAnim) {           // užvedus pelę nuotrauka pakyla
      const t = k === this.hoverKey ? 1 : 0, nv = v + (t - v) * (1 - Math.exp(-dt * 14));
      if (Math.abs(nv - t) < 0.01 && t === 0) this.hoverAnim.delete(k); else this.hoverAnim.set(k, Math.abs(nv - t) < 0.002 ? t : nv);
      this.dirty = true;
    }
    if (this.hoverKey && !this.hoverAnim.has(this.hoverKey)) { this.hoverAnim.set(this.hoverKey, 0.001); this.dirty = true; }
    if (this.dirty || now < this.fadeUntil) { this.dirty = false; this.draw(now); }
  }

  drawSprite(name, x, y, rot, s) {
    const spr = this.sprites[name], g = this.ctx;
    const k = (SIZE[name] * s) / spr.inner;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.drawImage(spr, -spr.width / 2 * k, -spr.height / 2 * k, spr.width * k, spr.height * k);
    g.restore();
  }

  draw(now) {
    const g = this.ctx, { W, H, dpr, cam } = this, s = this.scale;
    this.budget = 3;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // stalas
    const tk = (s * TEX_WORLD) / this.wood.width;
    this.pattern.setTransform(new DOMMatrix([tk, 0, 0, tk, W / 2 - cam.x * s, H / 2 - cam.y * s]));
    g.fillStyle = this.pattern; g.fillRect(0, 0, W, H);
    if (!this.N) return;

    g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-cam.x, -cam.y);
    const hw = W / 2 / s + 0.8, hh = H / 2 / s + 0.8;
    const x0 = Math.floor(cam.x - hw), x1 = Math.ceil(cam.x + hw), y0 = Math.floor(cam.y - hh), y1 = Math.ceil(cam.y + hh);
    const photos = [], candles = [];
    // daiktai po nuotraukomis
    for (let gy = y0 - 1; gy <= y1; gy++) for (let gx = x0 - 1; gx <= x1; gx++) {
      const k = this.corner(gx, gy);
      if (k) this.drawSprite(k.deco, k.x, k.y, k.rot, k.s);
    }
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const c = this.cell(gx, gy);
      if (c.still) { this.drawSprite(c.deco, c.x, c.y, c.rot, c.s); if (c.deco === 'candle') candles.push(c); }
      else photos.push(c);
    }
    photos.sort((a, b) => (this.hoverAnim.get(a.key) || 0) - (this.hoverAnim.get(b.key) || 0) || a.z - b.z);
    this.drawn = photos;
    const seen = new Set();
    for (const c of photos) {
      const item = this.items[c.index];
      if (!seen.has(c.index)) { seen.add(c.index); this.ensure(item, 'sm'); }
      if (c.key !== this.hidden) this.drawPhoto(c, item, now);
    }
    this.candles = candles.map((c) => { const [sx, sy] = this.toScreen(c.x, c.y); return { sx, sy, r: SIZE.candle * c.s * s, seed: c.gx * 7 + c.gy }; });
  }

  drawPhoto(c, item, now) {
    const g = this.ctx, s = this.scale;
    const hv = this.hoverAnim.get(c.key) || 0;
    const dev = Math.max(c.w, c.h) * s * this.dpr * (1 + hv * 0.03);
    if (dev > 620) this.ensure(item, 'md');
    let p = (dev > 620 && this.print(item, 'md')) || this.print(item, 'sm') || (item.md.img && this.print(item, 'md'));
    const blank = this.blank(item);
    const fade = p ? Math.min(1, (now - p.at) / 600) : 0;
    g.save();
    g.translate(c.x, c.y);
    g.rotate(c.rot * (1 - 0.5 * hv));
    if (hv) g.scale(1 + 0.03 * hv, 1 + 0.03 * hv);
    if (hv > 0.01) { g.shadowColor = `rgba(0,0,0,${0.45 * hv})`; g.shadowBlur = 26 * hv * this.dpr; g.shadowOffsetY = 12 * hv * this.dpr; }
    const put = (pc, a) => {
      const k = c.w / pc.paperW;
      g.globalAlpha = a;
      g.drawImage(pc, -pc.width / 2 * k, -pc.height / 2 * k, pc.width * k, pc.height * k);
    };
    if (fade < 1) put(blank, 1);
    if (p) put(p, fade);
    g.globalAlpha = 1; g.shadowColor = 'transparent';
    if (c.pin && fade > 0.5) {
      const { type, corner, rot } = c.pin, sx = corner % 2 ? 1 : -1, sy = corner < 2 ? -1 : 1;
      const inset = type === 'nail' ? 0.035 : type === 'seal' ? 0.02 : -0.01;
      const px = type === 'seal' && corner < 2 ? 0 : sx * (c.w / 2 - inset), py = sy * (c.h / 2 - inset);
      g.globalAlpha = Math.min(1, (fade - 0.5) * 2);
      this.drawSprite(type, px, py, rot, 1);
      g.globalAlpha = 1;
    }
    if (c.key === this.focusKey) {                  // klaviatūros fokusas
      g.strokeStyle = '#d9b45a'; g.lineWidth = 3 / s; g.setLineDash([10 / s, 6 / s]);
      g.strokeRect(-c.w / 2 - 6 / s, -c.h / 2 - 6 / s, c.w + 12 / s, c.h + 12 / s);
      g.setLineDash([]);
    }
    g.restore();
  }
}
