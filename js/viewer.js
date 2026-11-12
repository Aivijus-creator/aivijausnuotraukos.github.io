import { CONFIG } from './config.js';
import { clipPolygon } from './print.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (n, m) => ((n % m) + m) % m;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';       // stiprus ease-out
const T = (x, y, s = 1, rot = 0) => `translate3d(${x}px, ${y}px, 0) rotate(${rot}rad) scale(${s})`;

/* Peržiūra: nuotrauka pakyla nuo stalo, atskrenda į centrą išsitiesindama, o uždarius nusileidžia atgal tuo pačiu kampu. */
export class Viewer {
  constructor(root, table, items, { reducedMotion = false, sound = null } = {}) {
    this.root = root;
    this.table = table;
    this.sound = sound;
    this.handlers = {};
    this.items = items;
    this.reduced = reducedMotion;
    this.stage = root.querySelector('.viewer__stage');
    this.backdrop = root.querySelector('.viewer__backdrop');
    this.caption = root.querySelector('.viewer__caption');
    this.titleEl = root.querySelector('.viewer__title');
    this.metaEl = root.querySelector('.viewer__meta');
    this.cell = null;
    this.isOpen = false;
    this.busy = false;
    this.index = -1;
    this.img = null;
    this.box = null;
    this.z = { s: 1, x: 0, y: 0 };
    this.pointers = new Map();
    this.g = null;
    this.lastTap = null;
    this.lastWheelNav = 0;

    root.querySelector('.viewer__close').addEventListener('click', () => this.close());
    root.querySelector('.viewer__nav--prev').addEventListener('click', () => this.go(-1));
    root.querySelector('.viewer__nav--next').addEventListener('click', () => this.go(1));
    const st = this.stage;
    st.addEventListener('pointerdown', (e) => this.onDown(e));
    st.addEventListener('pointermove', (e) => this.onMove(e));
    st.addEventListener('pointerup', (e) => this.onUp(e));
    st.addEventListener('pointercancel', (e) => this.onUp(e, true));
    st.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    st.addEventListener('dragstart', (e) => e.preventDefault());
    st.addEventListener('contextmenu', (e) => { if (e.pointerType === 'touch') e.preventDefault(); });
    window.addEventListener('resize', () => this.onResize());
  }

  on(n, f) { (this.handlers[n] ||= []).push(f); return this; }
  emit(n, ...a) { for (const f of this.handlers[n] || []) f(...a); }

  /* Popieriaus (nuotrauka + šviesus kraštas) proporcijos. */
  paperAspect(item) {
    const a = item.aspect, m = CONFIG.print.margin;
    const iw = a >= 1 ? 1 : a, ih = a >= 1 ? 1 / a : 1;
    return (iw * (1 + 2 * m)) / (ih + 2 * m * iw);
  }

  /* Didžiausias stačiakampis, kuriame nuotrauka telpa visa, neapkarpyta. */
  fit(item) {
    const aspect = this.paperAspect(item);
    const vw = window.innerWidth, vh = window.innerHeight;
    const small = vw <= 640;
    const hasCaption = !this.caption.hidden;
    const padX = small ? 10 : 76;
    const padTop = small ? 62 : 34;
    const padBottom = hasCaption ? Math.max(small ? 62 : 34, this.caption.offsetHeight + (small ? 34 : 46)) : (small ? 62 : 34);
    const bw = vw - padX * 2, bh = vh - padTop - padBottom;
    let w = bw, h = w / aspect;
    if (h > bh) { h = bh; w = h * aspect; }
    return { w, h, cx: vw / 2, cy: padTop + bh / 2 };
  }

  setCaption(item) {
    const meta = [item.location, item.year].filter(Boolean).join(' · ');   // vieta ir metai
    this.titleEl.textContent = item.title;
    this.metaEl.textContent = meta;
    this.caption.hidden = !(item.title || meta);     // jei nieko neįrašyta – pergamento skiautė nerodoma
    this.caption.classList.remove('is-shown');
    requestAnimationFrame(() => this.caption.classList.add('is-shown'));
  }

  makeImg(item, box) {
    const el = document.createElement('div');      // atspaudas: popierius su apdriskusiais kraštais + nuotrauka
    el.className = 'viewer__img';
    const sheet = document.createElement('div');
    sheet.className = 'viewer__sheet';
    const img = document.createElement('img');
    img.className = 'viewer__pic';
    img.alt = item.alt;
    img.draggable = false;
    img.decoding = 'async';
    sheet.append(img);
    el.append(sheet);
    el.pic = img;
    el.sheet = sheet;
    el.item = item;
    this.place(el, box);
    img.src = this.table.bestSrc(item.index);
    const full = new Image();                        // pilna kokybė kraunama tik čia
    full.decoding = 'async';
    full.src = item.urls.lg;
    const swap = () => { if (img.isConnected && full.naturalWidth) img.src = full.src; };
    full.onload = () => (full.decode ? full.decode().then(swap, swap) : swap());
    return el;
  }

  place(el, box) {
    Object.assign(el.style, { left: `${box.cx - box.w / 2}px`, top: `${box.cy - box.h / 2}px`, width: `${box.w}px`, height: `${box.h}px` });
    const imgW = box.w / (1 + 2 * CONFIG.print.margin);
    el.sheet.style.padding = `${imgW * CONFIG.print.margin}px`;
    el.sheet.style.clipPath = clipPolygon(el.item.index + 1, box.w, box.h);
  }

  open(cell) {
    if (this.isOpen || this.busy || !cell) return;
    const tb = this.table;
    this.busy = true;
    this.isOpen = true;
    this.cell = cell;
    this.index = cell.index;
    tb.setPaused(true);
    const item = this.items[cell.index];
    this.root.hidden = false;
    this.setCaption(item);
    const box = this.box = this.fit(item);
    const img = this.img = this.makeImg(item, box);
    const from = tb.instanceRect(cell);
    this.resetZoom();
    this.lastFocus = document.activeElement;
    this.sound?.paper();
    this.emit('open', cell.index);

    const start = () => {
      if (this.reduced) img.style.opacity = '0';
      else img.style.transform = T(from.cx - box.cx, from.cy - box.cy, from.w / box.w, from.rot);
      this.stage.append(img);
      tb.setHidden(cell.key);
      tb.render();
      void img.offsetWidth;
      this.root.classList.add('is-open');
      img.style.transition = this.reduced ? 'opacity 200ms ease' : `transform 520ms ${EASE}`;
      img.style.transform = T(0, 0);
      img.style.opacity = '1';
      this.root.focus({ preventScroll: true });
      setTimeout(() => { this.busy = false; }, this.reduced ? 200 : 320);
    };
    if (img.pic.decode) img.pic.decode().then(start, start); else start();
  }

  close() {
    if (!this.isOpen || this.busy) return;
    this.busy = true;
    const tb = this.table, img = this.img, box = this.box;
    const to = tb.instanceRect(this.cell);
    const ms = this.reduced ? 160 : 380;            // uždarymas greitesnis už atidarymą
    this.root.classList.remove('is-open', 'is-dragging');
    this.backdrop.style.opacity = '';
    this.backdrop.style.transition = '';
    if (this.reduced) { img.style.transition = `opacity ${ms}ms ease`; img.style.opacity = '0'; }
    else {
      img.style.transition = `transform ${ms}ms ${EASE}`;
      img.style.transform = T(to.cx - box.cx, to.cy - box.cy, to.w / box.w, to.rot);
    }
    setTimeout(() => {
      tb.setHidden(null);
      tb.render();
      this.sound?.thud();
      requestAnimationFrame(() => {
        this.stage.replaceChildren();
        this.root.hidden = true;
        this.isOpen = false; this.busy = false; this.img = null;
        tb.setPaused(false);
        this.emit('close', this.index);
        (this.lastFocus && this.lastFocus.focus ? this.lastFocus : tb.canvas).focus({ preventScroll: true });
      });
    }, ms + 20);
  }

  go(dir, fromX = 0) {
    if (!this.isOpen || this.busy || this.items.length < 2) return;
    const tb = this.table, old = this.img;
    const next = mod(this.index + dir, this.items.length);
    this.index = next;
    const cell = this.cell = tb.nearestInstance(next);  // stalas už nugaros nuslenka prie tos nuotraukos
    tb.panTo(cell);
    tb.setHidden(cell.key);
    this.sound?.paper();
    this.emit('open', next);
    const item = this.items[next];
    this.setCaption(item);
    const box = this.box = this.fit(item);
    const img = this.img = this.makeImg(item, box);
    this.z = { s: 1, x: 0, y: 0 };
    const shift = this.reduced ? 0 : Math.min(window.innerWidth * 0.16, 180) * dir;
    img.style.opacity = '0';
    img.style.transform = T(shift, 0, 0.97);
    this.stage.append(img);
    old.style.transition = `transform 220ms ${EASE}, opacity 160ms ease-out`;
    old.style.transform = T(fromX - shift, 0, 0.97);
    old.style.opacity = '0';
    void img.offsetWidth;
    img.style.transition = `transform 320ms ${EASE}, opacity 200ms ease-out`;
    img.style.transform = T(0, 0);
    img.style.opacity = '1';
    setTimeout(() => old.remove(), 240);
  }

  onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(-1); }
    else if (e.key === 'Tab') {                      // fokusas lieka peržiūros viduje
      const btns = [...this.root.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      e.preventDefault();
      btns[mod(i + (e.shiftKey ? -1 : 1), btns.length)].focus();
    }
  }

  onResize() {
    if (!this.isOpen || !this.img) return;
    this.box = this.fit(this.items[this.index]);
    this.place(this.img, this.box);
    this.resetZoom();
  }

  /* ── priartinimas ir gestai ── */
  apply(animate = false) {
    const img = this.img;
    if (!img) return;
    img.style.transition = animate ? `transform 280ms ${EASE}` : 'none';
    img.style.transform = T(this.z.x, this.z.y, this.z.s);
  }
  resetZoom(animate = false) { this.z = { s: 1, x: 0, y: 0 }; if (this.img) this.apply(animate); }
  clampPan() {
    const { box, z } = this;
    const mx = Math.max(0, (box.w * z.s - window.innerWidth) / 2 + 24);
    const my = Math.max(0, (box.h * z.s - window.innerHeight) / 2 + 24);
    z.x = clamp(z.x, -mx, mx); z.y = clamp(z.y, -my, my);
  }
  zoomAt(px, py, s) {
    const { box, z } = this;
    s = clamp(s, 1, 6);
    const ux = (px - box.cx - z.x) / z.s, uy = (py - box.cy - z.y) / z.s;
    z.x = px - box.cx - ux * s; z.y = py - box.cy - uy * s; z.s = s;
    if (s <= 1.001) { z.x = 0; z.y = 0; }
    this.clampPan();
  }

  onDown(e) {
    if (!this.isOpen || this.busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { this.stage.setPointerCapture(e.pointerId); } catch {}
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.g = { mode: null, x0: e.clientX, y0: e.clientY, zx: this.z.x, zy: this.z.y, onImg: !!this.img && this.img.contains(e.target), lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0, dx: 0, dy: 0 };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s0: this.z.s, x0z: this.z.x, y0z: this.z.y };
      this.root.classList.add('is-dragging');
      this.backdrop.style.opacity = '';
    }
  }

  onMove(e) {
    const pt = this.pointers.get(e.pointerId);
    const g = this.g;
    if (!pt || !g || !this.img) return;
    pt.x = e.clientX; pt.y = e.clientY;

    if (g.mode === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const s = clamp(g.s0 * d / g.d0, 0.75, 6);
      const ux = (g.mx - this.box.cx - g.x0z) / g.s0, uy = (g.my - this.box.cy - g.y0z) / g.s0;
      this.z = { s, x: mx - this.box.cx - ux * s, y: my - this.box.cy - uy * s };
      this.apply();
      return;
    }
    if (g.mode === 'ignore') return;

    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    const now = performance.now(), dt = Math.max(1, now - g.lt);
    g.vx = (e.clientX - g.lx) / dt * 0.6 + g.vx * 0.4; g.vy = (e.clientY - g.ly) / dt * 0.6 + g.vy * 0.4;
    g.lx = e.clientX; g.ly = e.clientY; g.lt = now; g.dx = dx; g.dy = dy;

    if (!g.mode) {
      if (Math.hypot(dx, dy) < 8) return;
      if (this.z.s > 1.02) g.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) g.mode = 'swipe';
      else g.mode = dy > 0 ? 'dismiss' : 'resist';
      this.root.classList.add('is-dragging');
    }
    if (g.mode === 'pan') {
      this.z.x = g.zx + dx; this.z.y = g.zy + dy;
      this.apply();
    } else if (g.mode === 'swipe') {
      this.img.style.transition = 'none';
      this.img.style.transform = T(dx, 0);
    } else if (g.mode === 'resist') {                // aukštyn – tik su pasipriešinimu, ne į sieną
      this.img.style.transition = 'none';
      this.img.style.transform = T(0, -Math.pow(Math.max(0, -dy), 0.72));
    } else if (g.mode === 'dismiss') {               // braukiant žemyn nuotrauka seka pirštą ir tolsta
      const k = clamp(dy / (window.innerHeight * 0.7), 0, 1);
      this.img.style.transition = 'none';
      this.img.style.transform = T(dx * 0.5, Math.max(0, dy), 1 - k * 0.35);
      this.backdrop.style.transition = 'none';
      this.backdrop.style.opacity = String(1 - k * 0.8);
    }
  }

  onUp(e, cancelled = false) {
    if (!this.pointers.delete(e.pointerId)) return;
    const g = this.g;
    if (!g) return;
    if (g.mode === 'pinch') {
      if (this.pointers.size === 0) this.g = null; else this.g = { mode: 'ignore' };
      if (this.z.s < 1.03) this.resetZoom(true); else { this.z.s = Math.min(this.z.s, 5); this.clampPan(); this.apply(true); }
      this.root.classList.remove('is-dragging');
      return;
    }
    if (this.pointers.size > 0) return;
    this.g = null;
    this.root.classList.remove('is-dragging');
    const stale = performance.now() - g.lt > 90;
    const vx = stale ? 0 : g.vx, vy = stale ? 0 : g.vy;

    if (g.mode === 'swipe') {
      const far = Math.min(130, window.innerWidth * 0.22);
      if (!cancelled && (Math.abs(g.dx) > far || Math.abs(vx) > 0.3) && g.dx * (vx || g.dx) > 0) this.go(g.dx < 0 ? 1 : -1, g.dx);
      else this.apply(true);
    } else if (g.mode === 'dismiss') {
      if (!cancelled && (g.dy > 120 || vy > 0.35)) this.close();     // užtenka greito brūkštelėjimo
      else {
        this.backdrop.style.transition = ''; this.backdrop.style.opacity = '';
        this.apply(true);
      }
    } else if (g.mode === 'pan') {
      this.clampPan(); this.apply(true);
    } else if (g.mode === 'resist') {
      this.apply(true);
    } else if (!g.mode && !cancelled) {
      if (!g.onImg) { this.close(); return; }       // paspaudus šalia nuotraukos – uždaroma
      const now = performance.now();
      const lt = this.lastTap;
      if (lt && now - lt.t < 320 && Math.hypot(lt.x - e.clientX, lt.y - e.clientY) < 36) {
        this.lastTap = null;                          // dvigubas bakstelėjimas – priartinti / atitolinti
        if (this.z.s > 1.05) this.resetZoom(true); else { this.zoomAt(e.clientX, e.clientY, 2.5); this.apply(true); }
      } else this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  onWheel(e) {
    e.preventDefault();
    if (!this.isOpen || this.busy) return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;
    this.zoomAt(e.clientX, e.clientY, this.z.s * Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0025)));   // ratukas – priartinti / atitolinti
    this.apply();
  }
}
