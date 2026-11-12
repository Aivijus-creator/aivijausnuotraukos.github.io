/*
  Įžanga: juodas ekranas → užsidega žvakė → šviesa atskleidžia stalą → plunksna užrašo
  „aivijaus.raw“ ekrano centre → pavadinimas nusileidžia į savo vietą viršuje.
  Praleidžiama paspaudus bet kur arba bet kurį klavišą.
*/
import { CONFIG } from './config.js';
import { clamp, easeOut, easeInOut } from './util.js';

export function playIntro({ overlay, brand, light, skip = false }) {
  return new Promise((resolve) => {
    const flame = overlay.querySelector('.intro__flame');
    const text = brand.querySelector('.brand__title');
    const quill = brand.querySelector('.brand__quill');
    let done = false, raf = 0;
    const finish = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      removeEventListener('pointerdown', finish, true); removeEventListener('keydown', finish, true);
      light.level = 1;
      text.style.clipPath = '';
      quill.style.opacity = '0';
      brand.style.transition = 'transform 700ms cubic-bezier(0.65,0,0.35,1)';
      brand.style.transform = '';
      overlay.classList.add('is-gone');
      setTimeout(() => { overlay.hidden = true; brand.style.transition = ''; document.body.classList.add('is-ready'); resolve(); }, 720);
    };
    if (skip) { overlay.hidden = true; brand.style.transform = ''; document.body.classList.add('is-ready'); resolve(); return; }

    // pavadinimas pradžioje – ekrano centre, didesnis
    const r = brand.getBoundingClientRect();
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
    const big = Math.min(1.6, (innerWidth * 0.86) / r.width);
    brand.style.transition = 'none';
    brand.style.transform = `translate(${dx}px, ${dy}px) scale(${big})`;
    text.style.clipPath = 'inset(0 100% 0 0)';
    light.level = 0;
    addEventListener('pointerdown', finish, true); addEventListener('keydown', finish, true);

    const D = CONFIG.intro.duration * 1000, t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / D;
      // 0–0.15 žvakė užsidega, 0.12–0.5 šviesa atskleidžia stalą
      const fl = clamp(t / 0.15);
      flame.style.opacity = String(easeOut(fl) * (1 - clamp((t - 0.45) / 0.15)));
      flame.style.transform = `translate(-50%, -50%) scale(${0.3 + 0.7 * easeOut(fl)})`;
      const rv = easeInOut(clamp((t - 0.12) / 0.4));
      overlay.style.setProperty('--r', `${(rv * 130).toFixed(1)}vmax`);
      light.level = rv;
      // 0.35–0.75 plunksna rašo
      const w = clamp((t - 0.35) / 0.4);
      text.style.clipPath = `inset(-20% ${((1 - w) * 100).toFixed(1)}% -20% -5%)`;
      quill.style.opacity = w > 0 && w < 1 ? '1' : '0';
      quill.style.left = `${(w * 100).toFixed(1)}%`;
      quill.style.transform = `translate(-10%, -92%) rotate(${Math.sin(w * 40) * 6}deg)`;
      if (t >= 0.78) { finish(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
}
