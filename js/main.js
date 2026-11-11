import { Spiral } from './spiral.js';
import { Viewer } from './viewer.js';
import { CONFIG } from './config.js';
import { mountSun } from './sun.js';

const $ = (id) => document.getElementById(id);
const mod = (n, m) => ((n % m) + m) % m;
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const getJSON = async (url) => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};
const encodePath = (file) => file.split('/').map(encodeURIComponent).join('/');
const webp = (file) => file.replace(/\.[^.]+$/, '') + '.webp';
const hashIndex = (count) => {
  const m = /^#nuotrauka-(\d+)$/.exec(location.hash);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= count ? n - 1 : null;
};

function message(text) {
  const p = document.createElement('p');
  p.className = 'message';
  p.textContent = text;
  $('stage').append(p);
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
      const title = (p.title || '').trim(), description = (p.description || '').trim(), year = p.year ? String(p.year).trim() : '';
      const location = (p.location || '').trim();
      const opt = (tier) => `optimized/${tier}/${encodePath(webp(p.file))}`;
      return {
        index, file: p.file, title, location, description, year,
        alt: [title, location, year].filter(Boolean).join(', ') || description || `Nuotrauka ${index + 1}`,
        aspect: meta ? meta.w / meta.h : 1.5,
        known: !!meta,
        color: (meta && meta.color) || '#3c3c48',
        orig,
        urls: meta ? { sm: opt('sm'), md: opt('md'), lg: opt('lg') } : { sm: orig, md: orig, lg: orig },
      };
    });

  const title = (!Array.isArray(list) && list.title) || 'aiv.raw';
  document.title = title;
  $('brand').textContent = title;
  if (!items.length) { message('Galerijoje kol kas nėra nuotraukų.'); document.body.classList.add('is-ready'); return; }

  const N = items.length;
  const pad = (n) => String(n).padStart(String(N).length < 2 ? 2 : String(N).length, '0');
  const start = hashIndex(N);
  const spiral = new Spiral($('spiral'), items, { reducedMotion: reducedQuery.matches, startIndex: start ?? 0 });
  const viewer = new Viewer($('viewer'), spiral, items, { reducedMotion: reducedQuery.matches });
  reducedQuery.addEventListener('change', (e) => { spiral.reduced = viewer.reduced = e.matches; });

  // saulė fone: jos dydis derinamas su spirale, o spinduliai pasisuka kartu su ja
  const sun = mountSun($('sun'));
  const sizeSun = () => $('stage').style.setProperty('--sun-r', `${(CONFIG.sun.size * spiral.U).toFixed(1)}px`);
  sizeSun();
  new ResizeObserver(sizeSun).observe($('stage'));
  spiral.on('spin', (travel) => sun.spin(travel * CONFIG.sun.follow * CONFIG.spiral.direction));

  // vieta po centrine nuotrauka: sukant išnyksta, sustojus – parodoma
  const place = $('place'), placeText = $('place-text');
  let placeTimer = 0;
  const showPlace = (i) => {
    const item = items[i];
    placeText.textContent = item.location;
    place.classList.toggle('is-empty', !item.location);
    const box = spiral.centerBox(item.aspect);
    const below = Math.max(box.h / 2, CONFIG.sun.size * spiral.U * 1.03) + 14;
    place.style.transform = `translateY(${Math.round(Math.min(spiral.cy + below, spiral.H - 64))}px)`;
    place.classList.add('is-shown');
  };
  spiral.on('center', (i) => {
    $('counter').textContent = `${pad(i + 1)} / ${pad(N)}`;
    place.classList.remove('is-shown');
    clearTimeout(placeTimer);
    placeTimer = setTimeout(() => showPlace(i), 260);
  });
  window.addEventListener('resize', () => { clearTimeout(placeTimer); placeTimer = setTimeout(() => showPlace(spiral.centerIndex), 200); });

  // mygtukas, kuris sustabdo visą savaiminį judesį (saulę ir sukimąsi)
  const still = $('still');
  still.addEventListener('click', () => {
    const on = still.getAttribute('aria-pressed') !== 'true';
    still.setAttribute('aria-pressed', String(on));
    still.setAttribute('aria-label', on ? 'Tęsti judesį' : 'Sustabdyti judesį');
    document.body.classList.toggle('is-still', on);
    spiral.setStill(on);
  });
  spiral.on('interact', () => $('hint').classList.add('is-gone'));
  spiral.on('open', (i) => viewer.open(i));
  spiral.on('settle', (i) => {
    $('live').textContent = `Nuotrauka ${i + 1} iš ${N}: ${items[i].alt}`;
    if (spiral.interacted) history.replaceState(null, '', `#nuotrauka-${i + 1}`);   // nuoroda dalinimuisi
  });
  window.addEventListener('hashchange', () => {
    const i = hashIndex(N);
    if (i != null && i !== mod(Math.round(spiral.s), N)) spiral.goTo(i, true);
  });

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (viewer.isOpen) { viewer.onKey(e); return; }
    if (e.target instanceof HTMLElement && e.target.closest('.tune')) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); spiral.step(1); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); spiral.step(-1); break;
      case 'Home': e.preventDefault(); spiral.goTo(0, true); break;
      case 'End': e.preventDefault(); spiral.goTo(N - 1, true); break;
      case 'Enter': case ' ': e.preventDefault(); viewer.open(mod(Math.round(spiral.target ?? spiral.s), N)); break;
    }
  });

  document.body.classList.add('is-ready');
  if (/[?&](derinti|tune)\b/.test(location.search)) import('./tune.js').then((m) => m.mountTune(spiral));
  window.__gallery = { spiral, viewer, sun, config: CONFIG };   // patogu derinti naršyklės konsolėje
}

init();
