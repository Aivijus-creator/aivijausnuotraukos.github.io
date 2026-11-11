import { CONFIG } from './config.js';
import { extractPalette } from './ambient.js';

const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const mod = (n, m) => ((n % m) + m) % m;
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const BG = [20, 20, 27];
function mixColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return c.map((v, i) => Math.round(lerp(BG[i], v, amount)));
}

/* Spiralė piešiama viename <canvas>: taip 30–40 judančių nuotraukų išlaiko 60 k/s ir telefone. */
export class Spiral {
  constructor(canvas, items, { reducedMotion = false, startIndex = 0 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = items;
    this.N = items.length;
    this.cfg = CONFIG.spiral;
    this.motion = CONFIG.motion;
    this.reduced = reducedMotion;

    this.s = startIndex;          // dabartinė padėtis nuotraukų vienetais (gali būti trupmena)
    this.v = 0;                   // greitis, nuotraukų per sekundę
    this.target = null;           // kur link traukia spyruoklė
    this.omega = 7;
    this.auto = false;
    this.autoV = 0;
    this.still = false;           // lankytojas sustabdė savaiminį judesį
    this.wrapOffset = 0;          // kad fono sukimasis nešoktelėtų, kai s grįžta į ratą
    this.paused = false;
    this.hidden = -1;
    this.ptr = null;
    this.free = null;
    this.wheelTimer = 0;
    this.lastInput = performance.now();
    this.interacted = false;
    this.intro = reducedMotion ? 1 : 0;
    this.introStart = null;
    this.drawn = [];
    this.centerIndex = -1;
    this.handlers = {};
    this.inflight = 0;
    this.fadeUntil = 0;
    this.dirty = true;
    this.frame = 0;
    this.stars = Array.from({ length: 190 }, (_, i) => {
      const r = Math.sqrt((i + 0.5) / 190);
      return { a: i * 2.39996 + Math.sin(i * 12.9898) * 0.6, r, size: 0.6 + (Math.abs(Math.sin(i * 78.233)) ** 3) * 1.5, alpha: 0.05 + Math.abs(Math.sin(i * 39.425)) * 0.22 };
    });

    for (const item of items) {
      const [r, g, b] = mixColor(item.color, 0.2);
      item.placeholder = `rgb(${r},${g},${b})`;
      item.sm = {}; item.md = {};
    }

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  /* ── įvykiai ── */
  on(name, fn) { (this.handlers[name] ||= []).push(fn); return this; }
  once(name, fn) { const wrap = (...a) => { this.off(name, wrap); fn(...a); }; return this.on(name, wrap); }
  off(name, fn) { this.handlers[name] = (this.handlers[name] || []).filter((f) => f !== fn); }
  emit(name, ...args) { for (const fn of [...(this.handlers[name] || [])]) fn(...args); }

  /* ── geometrija ── */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.W = W; this.H = H; this.U = Math.min(W, H); this.dpr = dpr;
    this.cx = W / 2; this.cy = H / 2;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.buildPath();
    this.dirty = true;
  }

  get V() { return Math.max(1, Math.min(this.slots.length, this.N - 1)); }

  posOf(i) {
    let p = mod(i - this.s, this.N);
    if (p > this.N - 1) p -= this.N;
    return p;
  }

  centerBox(aspect) {
    const c = this.cfg;
    let h = this.H * c.centerSize, w = h * aspect;
    const maxW = this.W * c.centerMaxWidth;
    if (w > maxW) { w = maxW; h = w / aspect; }
    return { w, h };
  }

  /*
    Spiralės kelias. Kreivė r(φ) eina nuo vidinio iki išorinio spindulio per „turns“ apsisukimų,
    o nuotraukų vietos išdėliojamos išilgai jos pagal kelio ilgį: tarpas visada proporcingas
    nuotraukos dydžiui, todėl jos neužgožia viena kitos nei prie centro, nei pakraščiuose.
  */
  buildPath() {
    const c = this.cfg, U = this.U;
    const ex = Math.pow(this.W / U, c.stretch), ey = Math.pow(this.H / U, c.stretch);
    const nearL = c.nearSize * U, farL = Math.max(8, c.farSize * this.H);
    const rIn = c.innerRadius * U, rOut = c.outerRadius * U;
    const start = c.startAngle * DEG;
    const want = Math.max(1, Math.min(Math.round(c.visible), this.N - 1));

    const build = (PHI) => {
      const at = (phi) => {
        const r = rIn + (rOut - rIn) * Math.pow(Math.max(0, phi) / PHI, c.radiusCurve);
        const th = start + c.direction * phi;
        return [Math.cos(th) * r * ex, Math.sin(th) * r * ey];
      };
      const sizeAt = (phi) => nearL * Math.pow(farL / nearL, Math.pow(clamp(phi / PHI), c.sizeCurve));
      const slots = [];
      let phi = 0, prev = at(0), tanPrev = null, rot = 0;
      const push = () => slots.push({ x: prev[0], y: prev[1], L: sizeAt(phi), rot, t: clamp(phi / PHI), phi });
      push();
      while (slots.length < want) {
        const need = Math.max(2, c.spacing * 1.12 * sizeAt(phi));
        let acc = 0;
        while (acc < need) {
          phi += 0.005;
          const pt = at(phi);
          acc += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
          const tan = Math.atan2(pt[1] - prev[1], pt[0] - prev[0]);
          if (tanPrev != null) rot += wrapPi(tan - tanPrev);
          tanPrev = tan; prev = pt;
        }
        if (phi > PHI) break;
        push();
      }
      return slots;
    };

    // Jei nuotraukų mažiau, nei telpa į visą viją, vija sutrumpinama taip,
    // kad jos galas vis tiek nutoltų iki pakraščio ir sumažėtų iki taškelių.
    let hi = Math.max(0.2, c.turns) * 2 * Math.PI;
    let slots = build(hi);
    if (slots.length >= want && want > 1) {
      let lo = 0.3;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (build(mid).length >= want) hi = mid; else lo = mid;
      }
      slots = build(hi);
    }
    this.slots = slots;
    this.avgStep = slots.length > 1 ? Math.max(0.05, slots[slots.length - 1].phi / (slots.length - 1)) : 0.5;
  }

  /* Kur ir kokio dydžio yra nuotrauka, esanti spiralės pozicijoje p (0 = centras). */
  layout(item, p) {
    const c = this.cfg, V = this.V, slots = this.slots;
    const aspect = item.aspect;
    const root = Math.sqrt(aspect);
    const box = this.centerBox(aspect);
    const centerL = Math.sqrt(box.w * box.h);
    const first = slots[0];

    let L, x, y, rot, t, alpha, blur;
    if (p >= 1) {
      const f = Math.min(p, slots.length) - 1;
      const i = Math.min(Math.floor(f), slots.length - 1), u = f - i;
      const a = slots[i], b = slots[Math.min(i + 1, slots.length - 1)];
      L = lerp(a.L, b.L, u); x = lerp(a.x, b.x, u); y = lerp(a.y, b.y, u);
      rot = lerp(a.rot, b.rot, u) * c.rotationFollow; t = lerp(a.t, b.t, u);
      alpha = lerp(c.nearOpacity, c.farOpacity, Math.pow(t, c.opacityCurve));
      blur = c.farBlur * Math.pow(t, 0.8);
    } else if (p >= 0) {
      const e = smooth(p), k = Math.pow(p, 1.3);
      L = lerp(centerL, first.L, e); x = first.x * k; y = first.y * k;
      rot = 0; t = 0; alpha = lerp(1, c.nearOpacity, e); blur = 0;
    } else {                       // ką tik praėjusi centrą: išauga ir ištirpsta
      const q = -p, k = -0.5 * Math.pow(q, 1.3);
      L = centerL * (1 + 0.5 * q); x = first.x * k; y = first.y * k;
      rot = 0; t = 0; alpha = 1 - smooth(q * 1.3); blur = 0;
    }
    alpha *= clamp((V - p) / 2);   // vijos galas švelniai išnyksta

    if (this.intro < 1) {          // įžanga: nuotraukos išsivynioja iš centro
      const k = easeOut((this.intro - t * 0.42) / 0.58);
      const tw = -c.direction * (1 - k) * 2.2, cs = Math.cos(tw), sn = Math.sin(tw);
      const ex = this.W / this.U, ey = this.H / this.U;
      const ux = x / ex * k, uy = y / ey * k;
      x = (ux * cs - uy * sn) * ex; y = (ux * sn + uy * cs) * ey;
      L *= lerp(0.25, 1, k); alpha *= k; rot = rot * k + tw * (p >= 1 ? 1 : 0);
    }

    return { item, p, L, alpha, blur, rot, x: this.cx + x, y: this.cy + y, w: L * root, h: L / root };
  }

  /* Nuotraukos stačiakampis ekrane – naudoja peržiūra, kad išsiplėstų tiksliai iš savo vietos. */
  rectOf(index) {
    const d = this.layout(this.items[index], this.posOf(index));
    return { cx: d.x, cy: d.y, w: d.w, h: d.h, rot: d.rot };
  }

  bestSrc(index) {
    const item = this.items[index];
    return (item.md.img || item.sm.img)?.src || item.urls.md;
  }

  /* ── nuotraukų krovimas (tik tų, kurios arti matomos srities) ── */
  ensure(item, tier) {
    const slot = item[tier];
    if (slot.state || this.inflight >= 8) return;
    slot.state = 'loading';
    this.inflight++;
    const img = new Image();
    img.decoding = 'async';
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      this.inflight--;
      if (!ok || !img.naturalWidth) {
        if (!slot.fallback && item.urls[tier] !== item.orig) { slot.fallback = true; slot.state = null; item.urls = { sm: item.orig, md: item.orig, lg: item.orig }; }
        else slot.state = 'error';
      } else {
        slot.img = img; slot.state = 'ready'; slot.at = performance.now();
        if (!item.known) { item.aspect = img.naturalWidth / img.naturalHeight; item.known = true; }
        if (tier === 'sm' || !item.mini) this.makeSmall(item, img);
        this.fadeUntil = slot.at + 600;
      }
      this.dirty = true;
    };
    img.onload = () => (img.decode ? img.decode().then(() => done(true), () => done(true)) : done(true));
    img.onerror = () => done(false);
    img.src = item.urls[tier];
  }

  /* Mažos kopijos: „mini“ tolimiems taškeliams (pigiau ir be mirgėjimo), „soft“ – išliejimui. */
  makeSmall(item, img) {
    const a = img.naturalWidth / img.naturalHeight;
    const make = (long) => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(a >= 1 ? long : long * a));
      cv.height = Math.max(2, Math.round(a >= 1 ? long / a : long));
      return cv;
    };
    const mini = make(128);
    const m = mini.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(img, 0, 0, mini.width, mini.height);
    const mid = make(40); mid.getContext('2d').drawImage(mini, 0, 0, mid.width, mid.height);
    const soft = make(12); soft.getContext('2d').drawImage(mid, 0, 0, soft.width, soft.height);
    item.mini = mini; item.soft = soft;
    if (!item.palette) { item.palette = extractPalette(mini); if (item.palette) this.emit('palette', item); }
  }

  /* ── valdymas ── */
  bind() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('pointercancel', (e) => this.onUp(e, true));
    cv.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('dragstart', (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(cv);
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); this.lastInput = this.last; });
  }

  touch() {                        // bet koks lankytojo veiksmas perima valdymą
    this.lastInput = performance.now();
    if (this.auto) { this.auto = false; this.v = this.autoV; this.autoV = 0; }
  }
  markInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    this.emit('interact');
  }

  setTarget(t, omega) {
    this.touch();
    this.target = t; this.omega = omega;
  }
  step(dir) {
    const base = this.target != null && this.free == null ? this.target : this.s;
    this.cancelWheel();
    this.setTarget(Math.round(base) + dir, this.reduced ? 16 : 10);
    this.markInteracted();
  }
  goTo(index, shortest = false) {
    let d = this.posOf(index);
    if (shortest && d > this.N / 2) d -= this.N;
    const dist = Math.abs(d);
    this.cancelWheel();
    this.setTarget(Math.round(this.s + d), this.reduced ? 16 : clamp(8 / Math.pow(Math.max(dist, 1), 0.32), 2.6, 8));
    if (dist > 0.5) this.markInteracted();
  }
  jumpTo(index) { this.cancelWheel(); this.s = index; this.v = 0; this.target = null; this.dirty = true; }
  get travel() { return this.s + this.wrapOffset; }
  setStill(still) { this.still = still; if (still && this.auto) { this.auto = false; this.autoV = 0; this.snap(); } this.lastInput = performance.now(); }
  snap() { this.setTarget(Math.round(this.s), this.reduced ? 16 : 7); }
  cancelWheel() { clearTimeout(this.wheelTimer); this.free = null; }

  release(v, touch = false, from = this.s) {   // inercija: prasisuka toliau ir „prilimpa“ prie artimiausios nuotraukos
    if (this.reduced) v = 0;
    v = clamp(v, -45, 45);
    // pirštu braukiant inercija trumpesnė ir ribota, kad vienas brūkštelėjimas nepralėktų pro daug nuotraukų
    const tau = touch ? this.motion.touchInertia : this.motion.inertia;
    const reach = touch ? this.motion.touchFlick : this.motion.flick;
    let t = Math.round(this.s + clamp(v * tau, -reach, reach));
    if (touch) {
      // tik aiškus brūkštelėjimas (pakankamai greitas ir bent kiek nubrauktas) perverčia į kitą nuotrauką;
      // lengvas prisilietimas ar piršto krustelėjimas grąžina spiralę atgal į vietą
      const moved = this.s - from;
      if (Math.abs(v) > this.motion.touchFlickSpeed && Math.abs(moved) > 0.16 && moved * v > 0) {
        const origin = Math.round(from);
        t = v > 0 ? Math.max(t, origin + 1) : Math.min(t, origin - 1);
      }
    } else if (Math.abs(v) > 1) t = v > 0 ? Math.max(t, Math.ceil(this.s)) : Math.min(t, Math.floor(this.s));
    const dist = t - this.s;
    this.v = v;
    const omega = dist * v > 0 ? clamp(Math.abs(v / dist), 0.75 / tau, 9) : 7;
    this.setTarget(t, this.reduced ? 16 : omega);
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.ptr || this.paused) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this.touch();
    this.cancelWheel();
    this.target = null; this.v = 0;
    this.ptr = { id: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, model: 'linear', axis: 'y', heading: null, turn: 0, seg: { x: e.clientX, y: e.clientY }, samples: [], s0: this.s, t0: e.timeStamp };
  }

  onMove(e) {
    const ptr = this.ptr;
    if (!ptr || ptr.id !== e.pointerId) {
      if (e.pointerType === 'mouse' && !ptr) this.canvas.classList.toggle('is-over', !!this.hit(e.clientX, e.clientY));
      return;
    }
    const x = e.clientX, y = e.clientY;
    const { cx, cy, U } = this;
    if (!ptr.moved) {
      const mx = x - ptr.sx, my = y - ptr.sy;
      if (Math.hypot(mx, my) < (ptr.type === 'mouse' ? 4 : this.motion.touchSlop)) return;   // pirštas visada šiek tiek krusteli
      ptr.moved = true;
      ptr.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      // pele toliau nuo centro spiralė „sugriebiama“ ir sukama kaip diskas; pirštu – braukiama
      if (ptr.type === 'mouse' && Math.hypot(ptr.sx - cx, ptr.sy - cy) > U * 0.17) ptr.model = 'angular';
      ptr.x = x; ptr.y = y; ptr.seg = { x, y };
      this.canvas.classList.add('is-dragging');
      this.canvas.classList.remove('is-over');
      this.markInteracted();
      return;
    }
    const dx = x - ptr.x, dy = y - ptr.y;
    let ds;
    const mouse = ptr.type === 'mouse';
    const stepPx = mouse ? clamp(U * this.motion.dragStep, 78, 150) : clamp(U * this.motion.touchStep, 160, 320);
    if (ptr.model === 'angular' && mouse) {
      const da = wrapPi(Math.atan2(y - cy, x - cx) - Math.atan2(ptr.y - cy, ptr.x - cx));
      const dist = Math.hypot(x - cx, y - cy);
      ds = (-this.cfg.direction * da / this.avgStep) * smooth(dist / (U * 0.1));
    } else if (ptr.model === 'angular') {
      // pirštu sukant ratu skaičiuojamas nueitas kelias aplink centrą – jautrumas toks pat kaip braukiant tiesiai
      const rx = ptr.x - cx, ry = ptr.y - cy, rl = Math.hypot(rx, ry) || 1;
      ds = (-this.cfg.direction * ((rx * dy - ry * dx) / rl) / stepPx) * smooth(rl / (U * 0.16));
    } else {
      ds = -(ptr.axis === 'x' ? dx : dy) / stepPx;
      // jei pirštas ima brėžti ratą – pereiname į sukimą ratu
      if (Math.hypot(x - ptr.seg.x, y - ptr.seg.y) > 16) {
        const h = Math.atan2(y - ptr.seg.y, x - ptr.seg.x);
        if (ptr.heading != null) {
          const turn = wrapPi(h - ptr.heading);
          if (Math.abs(turn) < 1.5) ptr.turn += turn; else ptr.turn = 0;
        }
        ptr.heading = h; ptr.seg = { x, y };
        // į sukimą ratu pereinama tik nubrėžus aiškų lanką (pelė – ~60°, pirštas – ~140°, nes nykštys visada brėžia lanką)
        if (Math.abs(ptr.turn) > (mouse ? 1.05 : 2.45) && Math.hypot(x - cx, y - cy) > U * (mouse ? 0.12 : 0.22)) ptr.model = 'angular';
      }
    }
    this.s += ds;
    ptr.x = x; ptr.y = y;
    const now = e.timeStamp;       // įvykio laikas tikslesnis už „dabar“, kai naršyklė užsiėmusi
    ptr.samples.push({ t: now, s: this.s });
    while (ptr.samples.length > 2 && now - ptr.samples[0].t > 110) ptr.samples.shift();
    this.lastInput = performance.now();
    this.dirty = true;
  }

  onUp(e, cancelled = false) {
    const ptr = this.ptr;
    if (!ptr || ptr.id !== e.pointerId) return;
    this.ptr = null;
    this.canvas.classList.remove('is-dragging');
    this.lastInput = performance.now();
    if (!ptr.moved) {
      if (cancelled) { this.snap(); return; }
      const touch = ptr.type !== 'mouse';
      // pirštu: ilgas prilaikymas – ne paspaudimas, o į taškelio dydžio nuotraukas nepataikoma netyčia
      const d = touch && e.timeStamp - ptr.t0 > 500 ? null : this.hit(e.clientX, e.clientY, touch ? this.motion.touchTapSize : 0);
      if (!d) { this.snap(); return; }
      if (Math.abs(d.p) < 0.5) {
        if (Math.abs(this.s - Math.round(this.s)) > 0.02) this.snap();
        this.emit('open', d.item.index);
      } else this.goTo(d.item.index);
      return;
    }
    const sm = ptr.samples, now = e.timeStamp;
    let v = 0;
    if (sm.length >= 2 && now - sm[sm.length - 1].t < 90) {
      const a = sm[0], b = sm[sm.length - 1];
      if (b.t > a.t) v = (b.s - a.s) / ((b.t - a.t) / 1000);
    }
    this.release(v, ptr.type !== 'mouse', ptr.s0);
  }

  onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || this.paused || this.ptr) return;
    let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) d *= 33; else if (e.deltaMode === 2) d *= this.H;
    if (!d) return;
    d = clamp(d, -260, 260);
    if (e.deltaMode === 0 && Math.abs(d) < 50) d *= this.motion.trackpad;   // touchpad siunčia daug smulkių žingsnelių
    this.touch();
    if (this.free == null) this.free = this.target != null ? this.target : this.s;
    this.free += d / this.motion.wheelStep;
    this.target = this.free;
    this.omega = this.reduced ? 20 : 12;
    this.markInteracted();
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      if (this.free == null) return;
      this.target = Math.round(this.free);
      this.omega = this.reduced ? 16 : 6.5;
      this.free = null;
    }, 150);
  }

  hit(px, py, minSize = 0) {
    for (let k = this.drawn.length - 1; k >= 0; k--) {
      const d = this.drawn[k];
      if (d.alpha < 0.04 || d.p < -0.5 || d.item.index === this.hidden || d.L < minSize) continue;
      const dx = px - d.x, dy = py - d.y;
      const c = Math.cos(-d.rot), s = Math.sin(-d.rot);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      const min = minSize ? 44 : 30;
      if (Math.abs(lx) <= Math.max(d.w, min) / 2 && Math.abs(ly) <= Math.max(d.h, min) / 2) return d;
    }
    return null;
  }

  setHidden(index) { this.hidden = index; this.dirty = true; }
  setPaused(paused) { this.paused = paused; this.lastInput = performance.now(); if (paused) this.touch(); }
  invalidate() { this.buildPath(); this.dirty = true; }

  /* ── kadras ── */
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    let moving = false;

    if (this.intro < 1) {
      if (this.introStart == null) this.introStart = now;
      this.intro = clamp((now - this.introStart) / (this.motion.introDuration * 1000));
      moving = true;
    }

    if (this.ptr && this.ptr.moved) {
      moving = true;
    } else if (this.target != null) {
      // kritiškai slopinama spyruoklė: sklandu, be šuolių ir be persisukimo
      const w = this.omega, x0 = this.s - this.target;
      const c = this.v + w * x0, e = Math.exp(-w * dt);
      this.s = this.target + (x0 + c * dt) * e;
      this.v = (this.v - w * c * dt) * e;
      moving = true;
      if (this.free == null && Math.abs(this.s - this.target) < 0.002 && Math.abs(this.v) < 0.03) {
        const wrapped = mod(this.target, this.N);
        this.wrapOffset += this.target - wrapped;
        this.s = wrapped;
        this.v = 0; this.target = null;
        this.lastInput = now;
        this.emit('settle', mod(Math.round(this.s), this.N));
      }
    } else if (this.auto) {
      this.autoV = lerp(this.autoV, this.motion.idleSpeed, 1 - Math.exp(-dt * 0.7));
      this.s += this.autoV * dt;
      moving = true;
    } else if (!this.reduced && !this.still && !this.paused && !this.ptr && this.intro >= 1 && this.N > 1 && now - this.lastInput > this.motion.idleDelay * 1000) {
      this.auto = true; this.autoV = 0;
    }

    if (moving || this.dirty || now < this.fadeUntil) {
      this.dirty = false;
      this.draw(now);
    }
  }

  render() { this.draw(performance.now()); }

  draw(now) {
    const { ctx, W, H, dpr, N } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    this.drawStars();

    const V = this.V, list = [];
    for (let i = 0; i < N; i++) {
      const p = this.posOf(i);
      if (p > V) continue;
      const d = this.layout(this.items[i], p);
      if (d.alpha > 0.004) list.push(d);
    }
    list.sort((a, b) => (a.p >= 0 ? -a.p : 1 - a.p) - (b.p >= 0 ? -b.p : 1 - b.p));

    for (const d of list) if (d.item.index !== this.hidden) this.drawItem(d, now);
    this.drawn = list;

    const ci = mod(Math.round(this.s), N);
    if (ci !== this.centerIndex) { this.centerIndex = ci; this.emit('center', ci); }
    if (this.travel !== this.lastTravel) { this.lastTravel = this.travel; this.emit('spin', this.travel); }

    // kraunamos tik matomos ir greitai pasirodysiančios nuotraukos, artimiausios centrui – pirmos
    const order = list.slice().sort((a, b) => Math.abs(a.p) - Math.abs(b.p));
    const fast = Math.abs(this.v) > 14;          // greitai sukant pro šalį lekiančių nekrauname
    for (const d of order) {
      if (Math.abs(d.p) < 1.6 && !fast) this.ensure(d.item, 'md');
      if (!fast || d.item.mini) this.ensure(d.item, 'sm');
    }
    for (const k of [-1, 1, 2]) { const it = this.items[mod(ci + k, N)]; this.ensure(it, 'sm'); if (k !== 2) this.ensure(it, 'md'); }
    if (++this.frame % 90 === 0) this.evict(ci);
  }

  evict(ci) {                      // atlaisvinama atmintis, kai nuotraukų labai daug
    const N = this.N;
    for (const item of this.items) {
      const dist = Math.min(mod(item.index - ci, N), mod(ci - item.index, N));
      if (dist > 4 && item.md.state === 'ready') item.md = {};
      if (N > 90 && dist > this.V + 20 && item.sm.state === 'ready') { item.sm = {}; }
    }
  }

  drawStars() {
    const { ctx, cx, cy, W, H } = this;
    const R = Math.hypot(W, H) / 2;
    const spin = this.travel * 0.035 * this.cfg.direction;
    const k = this.intro < 1 ? easeOut(this.intro) : 1;
    ctx.fillStyle = '#fff';
    for (const st of this.stars) {
      const a = st.a - spin * (0.4 + st.r), r = st.r * R * (0.6 + 0.4 * k);
      ctx.globalAlpha = st.alpha * k;
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, st.size, st.size);
    }
    ctx.globalAlpha = 1;
  }

  roundRect(w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r);
    else {
      const x = -w / 2, y = -h / 2;
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  }

  drawItem(d, now) {
    const { ctx, dpr } = this;
    const { item, w, h, alpha } = d;
    const px = d.L * dpr;
    let src = null, at = 0;
    if (item.md.img && px > 520) { src = item.md.img; at = item.sm.img ? 0 : item.md.at; }
    else if (item.sm.img) { src = px < 110 && item.mini ? item.mini : item.sm.img; at = item.sm.at; }
    else if (item.md.img) { src = item.md.img; at = item.md.at; }
    const fade = src ? (at ? clamp((now - at) / 480) : 1) : 0;
    const radius = clamp(Math.min(w, h) * 0.05, 1.5, 8);
    const big = d.L > 90;

    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.rot) ctx.rotate(d.rot);
    ctx.globalAlpha = alpha;
    if (fade < 1 || big) {         // tamsus blokelis, kol nuotrauka kraunasi (+ šešėlis didesnėms)
      if (big) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = clamp(d.L * 0.11, 8, 70) * dpr;
        ctx.shadowOffsetY = d.L * 0.03 * dpr;
      }
      ctx.fillStyle = item.placeholder;
      this.roundRect(w, h, radius);
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    if (src && fade > 0) {
      if (d.L >= 26) { this.roundRect(w, h, radius); ctx.clip(); }
      ctx.globalAlpha = alpha * fade;
      ctx.drawImage(src, -w / 2, -h / 2, w, h);
      if (d.blur > 0.03 && item.soft) {
        ctx.globalAlpha = alpha * fade * d.blur;
        ctx.drawImage(item.soft, -w / 2, -h / 2, w, h);
      }
    }
    ctx.restore();
  }
}
