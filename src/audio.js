// WebAudio 로 합성한 효과음 (외부 파일 없음)
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.fireLevel = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // 모닥불 웅웅거림
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    src.connect(lp).connect(this.fireGain).connect(this.master);
    src.start();

    // 밤바람
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = this.noise;
    wsrc.loop = true;
    wsrc.playbackRate.value = 0.5;
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 300;
    wbp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.025;
    wsrc.connect(wbp).connect(wg).connect(this.master);
    wsrc.start();

    // 귀뚜라미
    const cricket = () => {
      if (!this.muted) this.#cricket();
      setTimeout(cricket, 700 + Math.random() * 2200);
    };
    setTimeout(cricket, 1500);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  #burst({ dur = 0.1, type = 'bandpass', freq = 1000, q = 1, gain = 0.3, when = 0, rate = 1 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
    return f;
  }

  #tone(freq, { dur = 0.2, type = 'sine', gain = 0.15, when = 0, slide = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  #cricket() {
    const base = 4200 + Math.random() * 600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.#tone(base, { dur: 0.045, gain: 0.012, when: i * 0.07, type: 'triangle' });
  }

  chop(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    this.#burst({ dur: 0.12, freq: 900, q: 1.5, gain: 0.5 * vol });
    this.#burst({ dur: 0.05, type: 'highpass', freq: 3000, gain: 0.25 * vol });
    this.#tone(140, { dur: 0.15, gain: 0.35 * vol, slide: 0.5 });
  }

  wood() {
    if (!this.ctx) return;
    this.#tone(660, { dur: 0.12, gain: 0.1, type: 'triangle' });
    this.#tone(990, { dur: 0.18, gain: 0.08, type: 'triangle', when: 0.08 });
  }

  pop() {
    if (!this.ctx) return;
    this.#tone(520, { dur: 0.09, gain: 0.08, slide: 1.6 });
  }

  ignite(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const f = this.#burst({ dur: 0.9, type: 'bandpass', freq: 300, q: 0.8, gain: 0.35 * vol });
    f.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.6);
  }

  powder(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const f = this.#burst({ dur: 0.8, type: 'bandpass', freq: 500, q: 1.2, gain: 0.3 * vol });
    f.frequency.exponentialRampToValueAtTime(4000, this.ctx.currentTime + 0.7);
    const notes = [880, 1108.7, 1318.5, 1760];
    notes.forEach((n, i) => this.#tone(n, { dur: 0.6, gain: 0.07 * vol, when: 0.15 + i * 0.08, type: 'sine' }));
  }

  gift() {
    if (!this.ctx) return;
    [523.3, 659.3, 784, 1046.5].forEach((n, i) => this.#tone(n, { dur: 0.35, gain: 0.08, when: i * 0.09, type: 'triangle' }));
  }

  /** 매 프레임: 가까운 모닥불 세기(0~1)에 따라 타닥 소리 */
  update(dt, level) {
    if (!this.ctx) return;
    this.fireLevel += (level - this.fireLevel) * Math.min(1, dt * 2);
    this.fireGain.gain.value = this.fireLevel * 0.12;
    if (Math.random() < this.fireLevel * dt * 9) {
      this.#burst({ dur: 0.012 + Math.random() * 0.03, type: 'highpass', freq: 1500 + Math.random() * 2500, gain: (0.05 + Math.random() * 0.2) * this.fireLevel });
    }
  }
}
