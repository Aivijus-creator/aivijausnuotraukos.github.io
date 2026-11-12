import { CONFIG } from './config.js';
import { Table } from './table.js';
import { Light } from './light.js';
import { Viewer } from './viewer.js';
import { Sound } from './sound.js';
import { playIntro } from './intro.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const getJSON = async (url) => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};
const encodePath = (file) => file.split('/').map(encodeURIComponent).join('/');
const webp = (file) => file.replace(/\.[^.]+$/, '') + '.webp';
const hashIndex = (count) => {
  const m = /^#nuotrauka-(\d+)$/.exec(location.hash);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= count ? n - 1 : null;
};
function message(text) {
  const p = document.createElement('p'); p.className = 'message'; p.textContent = text; $('stage').append(p);
}

async function init() {
  let list;
  try { list = await getJSON('photos.json'); }
  catch (err) { console.error(err); message('Nepavyko įkelti nuotraukų sąrašo (photos.json).'); return; }
  // optimized/manifest.json sukuria „npm run photos“. Jei jo nėra – rodomi originalai.
  const manifest = await getJSON('optimized/manifest.json').catch(() => null);
  const raw = Array.isArray(list) ? list : list.photos || [];
  const items = raw
    .map((p) => (typeof p === 'string' ? { file: p } : p))
    .filter((p) => p && p.file)
    .map((p, index) => {
      const meta = manifest && manifest[p.file];
      const orig = 'photos/' + encodePath(p.file);
      const opt = (tier) => `optimized/${tier}/${encodePath(webp(p.file))}`;
      const title = (p.title || '').trim(), location = (p.location || '').trim(), year = p.year ? String(p.year).trim() : '';
      return {
        index, file: p.file, title, location, year,
        alt: [title, location, year].filter(Boolean).join(', ') || `Nuotrauka ${index + 1}`,
        aspect: meta ? meta.w / meta.h : 1.5,
        orig,
        urls: meta ? { sm: opt('sm'), md: opt('md'), lg: opt('lg') } : { sm: orig, md: orig, lg: orig },
      };
    });

  // šriftai reikalingi pavadinimui ir antspaudui ant stalo
  await Promise.race([
    Promise.all([document.fonts.load('40px "UnifrakturMaguntia"'), document.fonts.load('600 38px "EB Garamond"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  const N = items.length;
  const table = new Table($('table'), items, { reducedMotion: reduced });
  const light = new Light($('shade'), $('glow'), table, { reducedMotion: reduced });
  const sound = new Sound();
  const viewer = new Viewer($('viewer'), table, items, { reducedMotion: reduced, sound });
  const live = $('live');
  if (!N) { message('Ant stalo kol kas nėra nuotraukų.'); }

  // nuoroda į nuotrauką: …/#nuotrauka-12
  const base = location.pathname + location.search;
  viewer.on('open', (i) => { history.replaceState(null, '', `#nuotrauka-${i + 1}`); live.textContent = `Atidaryta: ${items[i].alt}`; });
  viewer.on('close', () => { history.replaceState(null, '', base); });
  table.on('open', (cell) => viewer.open(cell));

  const start = hashIndex(N);
  if (start != null) { const c = table.homeCell(start); table.cam.x = c.x; table.cam.y = c.y; }
  document.body.classList.remove('is-loading');
  await playIntro({ overlay: $('intro'), brand: $('brand'), light, skip: reduced || start != null });
  if (start != null) requestAnimationFrame(() => viewer.open(table.homeCell(start)));

  addEventListener('hashchange', () => {
    const i = hashIndex(N);
    if (i == null || (viewer.isOpen && viewer.index === i)) return;
    if (viewer.isOpen) viewer.close();
    const c = table.nearestInstance(i); table.panTo(c);
    setTimeout(() => viewer.open(c), 650);
  });

  $('home').addEventListener('click', () => table.home());
  $('sound').addEventListener('click', (e) => {
    const on = sound.toggle();
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.setAttribute('aria-label', on ? 'Išjungti garsą' : 'Įjungti garsą');
  });

  // klaviatūra
  let focusIdx = -1;
  const focusPhoto = (i) => {
    focusIdx = i;
    if (i < 0) { table.setFocus(null); return; }
    const c = table.nearestInstance(i);
    table.panTo(c, 7); table.setFocus(c.key);
    live.textContent = `${i + 1} iš ${N}: ${items[i].alt}`;
  };
  addEventListener('keydown', (e) => {
    if (e.altKey || e.metaKey) return;
    if (viewer.isOpen) { viewer.onKey(e); return; }
    const onTable = document.activeElement === table.canvas || document.activeElement === document.body;
    if (e.key === 'Tab' && onTable && N) {
      const next = focusIdx + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= N) { focusPhoto(-1); return; }   // leidžiame Tab pereiti prie mygtukų
      e.preventDefault(); table.canvas.focus({ preventScroll: true }); focusPhoto(next);
      return;
    }
    if (e.ctrlKey && !['+', '=', '-'].includes(e.key)) return;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) { e.preventDefault(); table.nudge(mv[0], mv[1]); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); table.zoomBy(1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); table.zoomBy(0.8); }
    else if (e.key === '0' || e.key === 'Home') { e.preventDefault(); table.home(); }
    else if ((e.key === 'Enter' || e.key === ' ') && onTable && N) {
      e.preventDefault();
      const c = table.focusKey ? table.drawn.find((d) => d.key === table.focusKey) : table.hit(innerWidth / 2, innerHeight / 2) || table.nearestInstance(0);
      viewer.open(c || table.nearestInstance(Math.max(0, focusIdx)));
    } else if (e.key === 'Escape') focusPhoto(-1);
  });
  table.canvas.addEventListener('pointerdown', () => { if (focusIdx >= 0) focusPhoto(-1); });

  window.__gallery = { table, viewer, light, sound, config: CONFIG };
}

init();
