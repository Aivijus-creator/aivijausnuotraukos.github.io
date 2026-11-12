/*
  Garsai (neprivalomi, išjungti pagal nutylėjimą): židinio traškėjimas fone,
  popieriaus šnaresys atidarant nuotrauką ir tylus padėjimas ant medžio ją uždarant.
  Viskas sugeneruojama naršyklėje (Web Audio), jokių garso failų.
*/
export class Sound {
  constructor() { this.on = false; this.ctx = null; }
  noise(sec) {
    const b = this.ctx.createBuffer(1, Math.round(this.ctx.sampleRate * sec), this.ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  white(sec) {
    const b = this.ctx.createBuffer(1, Math.round(this.ctx.sampleRate * sec), this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  toggle() {
    this.on = !this.on;
    if (this.on) {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.on = false; return false; } this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
      this.ctx.resume();
      this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
      if (!this.bed) {
        const src = this.ctx.createBufferSource(); src.buffer = this.noise(4); src.loop = true;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
        const gn = this.ctx.createGain(); gn.gain.value = 0.05;
        src.connect(lp).connect(gn).connect(this.master); src.start();
        this.bed = src; this.crackleBuf = this.white(0.05);
      }
      const crackle = () => {
        if (!this.on) return;
        const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.crackleBuf;
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 2500;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.02 + Math.random() * 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
        s.connect(hp).connect(g).connect(this.master); s.start(t);
        this.timer = setTimeout(crackle, 60 + Math.random() * (Math.random() < 0.2 ? 900 : 260));
      };
      crackle();
    } else if (this.ctx) {
      clearTimeout(this.timer);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    return this.on;
  }
  paper() {
    if (!this.on) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.white(0.45);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(1800, t); bp.frequency.linearRampToValueAtTime(3800, t + 0.35);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    s.connect(bp).connect(g).connect(this.master); s.start(t);
  }
  thud() {
    if (!this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }
}
