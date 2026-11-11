/* Derinimo skydelis: atidaryk svetainę su ?derinti ir keisk spiralės nustatymus gyvai. */
import { CONFIG } from './config.js';

const FIELDS = [
  ['spiral', 'spacing', 'Tankumas (tarpai tarp nuotraukų)', 0.9, 3, 0.01],
  ['spiral', 'turns', 'Apsisukimų skaičius', 0.5, 4, 0.05],
  ['spiral', 'direction', 'Sukimosi kryptis', -1, 1, 2],
  ['spiral', 'startAngle', 'Pradžios kampas', -180, 180, 1],
  ['spiral', 'visible', 'Daugiausia nuotraukų vijoje', 10, 80, 1],
  ['spiral', 'innerRadius', 'Vidinis spindulys', 0.1, 0.7, 0.01],
  ['spiral', 'outerRadius', 'Išorinis spindulys', 0.4, 1.4, 0.01],
  ['spiral', 'radiusCurve', 'Vijų kreivė', 0.4, 2, 0.01],
  ['spiral', 'stretch', 'Ištempimas pagal ekraną', 0, 1, 0.01],
  ['spiral', 'centerSize', 'Centrinės nuotraukos dydis', 0.3, 0.85, 0.01],
  ['spiral', 'nearSize', 'Artimų nuotraukų dydis', 0.04, 0.4, 0.005],
  ['spiral', 'farSize', 'Tolimų nuotraukų dydis', 0.01, 0.12, 0.002],
  ['spiral', 'sizeCurve', 'Dydžių kreivė', 0.3, 2, 0.01],
  ['spiral', 'farOpacity', 'Tolimų permatomumas', 0, 1, 0.01],
  ['spiral', 'farBlur', 'Tolimų išliejimas', 0, 1, 0.01],
  ['spiral', 'rotationFollow', 'Pasukimas pagal spiralę', 0, 1.5, 0.01],
  ['sun', 'size', 'Saulės dydis', 0.1, 0.6, 0.005],
  ['sun', 'follow', 'Saulės sukimasis su spirale', 0, 20, 0.5],
  ['motion', 'inertia', 'Inercija (s)', 0.1, 1.2, 0.01],
  ['motion', 'idleSpeed', 'Savaiminio sukimosi greitis', 0, 0.6, 0.01],
];

export function mountTune(spiral) {
  const panel = document.createElement('aside');
  panel.className = 'tune';
  panel.innerHTML = '<h2>Derinimas</h2>';
  for (const [group, key, label, min, max, step] of FIELDS) {
    const row = document.createElement('label');
    const out = document.createElement('output');
    const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: CONFIG[group][key] });
    out.textContent = CONFIG[group][key];
    input.addEventListener('input', () => {
      CONFIG[group][key] = Number(input.value);
      out.textContent = input.value;
      spiral.invalidate();
      document.getElementById('stage').style.setProperty('--sun-r', `${(CONFIG.sun.size * spiral.U).toFixed(1)}px`);
    });
    row.append(label, out, input);
    panel.append(row);
  }
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Kopijuoti nustatymus';
  copy.addEventListener('click', async () => {
    const text = JSON.stringify(CONFIG, null, 2);
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Nukopijuota'; }
    catch { window.prompt('Nukopijuok nustatymus:', text); }
    setTimeout(() => { copy.textContent = 'Kopijuoti nustatymus'; }, 1500);
  });
  panel.append(copy);
  document.body.append(panel);
}
