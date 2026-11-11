#!/usr/bin/env node
/*
  Nuotraukų paruošimas.  Paleidimas:  npm run photos

  1. Paima visus originalus iš /photos (JPG, PNG, WebP, TIFF, AVIF).
  2. Kiekvienam sukuria tris sumažintas WebP versijas aplanke /optimized:
       sm – spiralei (maža),  md – centrinei nuotraukai,  lg – peržiūrai per visą ekraną.
  3. Įrašo optimized/manifest.json (matmenys ir vyraujanti spalva).
  4. Naujus failus, kurių dar nėra photos.json sąraše, prideda sąrašo gale.

  Jau paruoštos nuotraukos praleidžiamos, todėl kartoti galima kiek nori.
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, 'optimized');
const LIST = path.join(ROOT, 'photos.json');

const TIERS = {
  sm: { size: 480, quality: 72 },
  md: { size: 1440, quality: 78 },
  lg: { size: 2880, quality: 84 },
};
const EXT = /\.(jpe?g|png|webp|tiff?|avif)$/i;

const exists = (p) => fs.access(p).then(() => true, () => false);
const webpName = (file) => file.replace(/\.[^.]+$/, '') + '.webp';

const files = (await fs.readdir(SRC)).filter((f) => EXT.test(f)).sort((a, b) => a.localeCompare(b, 'lt', { numeric: true }));
for (const tier of Object.keys(TIERS)) await fs.mkdir(path.join(OUT, tier), { recursive: true });

let oldManifest = {};
try { oldManifest = JSON.parse(await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8')); } catch {}

const manifest = {};
let made = 0;
for (const file of files) {
  const src = path.join(SRC, file);
  const stat = await fs.stat(src);
  const stamp = `${stat.size}-${Math.round(stat.mtimeMs)}`;
  const prev = oldManifest[file];
  const outs = Object.keys(TIERS).map((t) => path.join(OUT, t, webpName(file)));
  if (prev && prev.stamp === stamp && (await Promise.all(outs.map(exists))).every(Boolean)) {
    manifest[file] = prev;
    continue;
  }
  try {
    const base = sharp(src, { failOn: 'none' }).rotate(); // rotate() pritaiko EXIF pasukimą
    const { data } = await base.clone().resize(64, 64, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    const px = data.length / 3;
    const color = '#' + [r, g, b].map((v) => Math.round(v / px).toString(16).padStart(2, '0')).join('');
    const meta = await sharp(await base.clone().toBuffer()).metadata();
    for (const [tier, { size, quality }] of Object.entries(TIERS)) {
      await base.clone()
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toFile(path.join(OUT, tier, webpName(file)));
    }
    manifest[file] = { w: meta.width, h: meta.height, color, stamp };
    made++;
    console.log('paruošta  ', file, `${meta.width}×${meta.height}`);
  } catch (err) {
    console.error('KLAIDA    ', file, '–', err.message);
  }
}

// išvalome versijas tų nuotraukų, kurių originalų nebėra
for (const tier of Object.keys(TIERS)) {
  const keep = new Set(Object.keys(manifest).map(webpName));
  for (const f of await fs.readdir(path.join(OUT, tier))) {
    if (!keep.has(f)) { await fs.rm(path.join(OUT, tier, f)); console.log('pašalinta ', `${tier}/${f}`); }
  }
}
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

// photos.json: pridedame naujus failus, perspėjame apie trūkstamus
let list = { title: 'Galerija', photos: [] };
try { list = JSON.parse(await fs.readFile(LIST, 'utf8')); } catch (err) {
  if (await exists(LIST)) { console.error('\nphotos.json yra sugadintas (', err.message, ') – pataisyk jį ir paleisk dar kartą.'); process.exit(1); }
}
if (Array.isArray(list)) list = { photos: list };
list.photos ||= [];
const listed = new Set(list.photos.map((p) => p.file));
let added = 0;
for (const file of files) {
  if (!listed.has(file)) { list.photos.push({ file, title: '', description: '', year: '' }); added++; console.log('į sąrašą  ', file); }
}
for (const p of list.photos) if (!manifest[p.file]) console.warn('DĖMESIO   ', `photos.json mini „${p.file}“, bet tokio failo aplanke /photos nėra`);
if (added) await fs.writeFile(LIST, JSON.stringify(list, null, 2) + '\n');

console.log(`\nNuotraukų: ${files.length}, naujai paruošta: ${made}, pridėta į photos.json: ${added}.`);
