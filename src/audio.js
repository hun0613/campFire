// WebAudio 로 합성한 효과음 (외부 파일 없음)
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.fireLevel = 0;
    this.ambience = 'crickets'; // 테마 소리: 'crickets' | 'rain' | 'snow'
    this.sheltered = false;     // 천막 · 텐트 지붕 아래 (빗방울이 지붕을 두드리는 소리)
  }

  /** @param {BaseAudioContext} [ctxIn] 미리 듣기 파일을 만들 때 OfflineAudioContext 를 넘긴다 */
  init(ctxIn) {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !ctxIn) return;
    const ctx = (this.ctx = ctxIn || new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // ---- 모닥불 (ASMR 영상처럼 푸근하게: 낮은 불길 소리 + 나무가 톡톡 터지는 소리 + 살짝 퍼지는 울림)
    // 갈색 잡음(낮은 소리가 많은 잡음): 불길이 넘실거리는 웅웅 소리
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    { const b = this.brown.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; } }
    // 분홍 잡음: 불꽃이 숨 쉬듯 '쉬익' 하는 소리
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    { const p = this.pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } }
    // 모닥불 소리 전체를 모으는 곳 → 날카로운 고음을 깎고 → 은은한 울림을 섞는다
    this.fireBus = ctx.createGain();
    this.fireBus.gain.value = 0;
    const tame = ctx.createBiquadFilter();
    tame.type = 'lowpass'; tame.frequency.value = 5200; tame.Q.value = 0.5;
    const dry = ctx.createGain(); dry.gain.value = 0.85;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    const verb = ctx.createConvolver();
    verb.buffer = this.#impulse(1.1);
    this.fireBus.connect(tame);
    tame.connect(dry).connect(this.master);
    tame.connect(verb).connect(wet).connect(this.master);

    // 낮은 불길 소리
    const roar = ctx.createBufferSource();
    roar.buffer = this.brown; roar.loop = true;
    const roarLp = ctx.createBiquadFilter(); roarLp.type = 'lowpass'; roarLp.frequency.value = 520;
    const roarShelf = ctx.createBiquadFilter(); roarShelf.type = 'peaking'; roarShelf.frequency.value = 140; roarShelf.gain.value = 5; roarShelf.Q.value = 0.7;
    this.roarGain = ctx.createGain(); this.roarGain.gain.value = 0.2;
    roar.connect(roarLp).connect(roarShelf).connect(this.roarGain).connect(this.fireBus);
    roar.start();
    // 불꽃이 숨 쉬는 소리
    const breath = ctx.createBufferSource();
    breath.buffer = this.pink; breath.loop = true; breath.playbackRate.value = 0.8;
    const breathBp = ctx.createBiquadFilter(); breathBp.type = 'bandpass'; breathBp.frequency.value = 900; breathBp.Q.value = 0.6;
    this.breathGain = ctx.createGain(); this.breathGain.gain.value = 0.05;
    breath.connect(breathBp).connect(this.breathGain).connect(this.fireBus);
    breath.start();
    // 실제로 녹음한 모닥불 소리 (CC0). 불러오기 전이나 실패하면 위의 합성 소리를 쓴다
    this.fireSample = false;
    this.sampleGain = ctx.createGain();
    this.sampleGain.gain.value = 0;
    this.sampleGain.connect(this.master);
    this.#loadFireSample();
    this.fireT = 0;       // 넘실거림 계산용 시간
    this.fireMood = 0.5;  // 타닥거림이 잦아졌다 많아졌다 하는 흐름 (0~1)

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
    this.windGain = wg; this.windBp = wbp;

    // ---- 빗소리 (우중캠핑장): 쏴아 하는 분홍 잡음 두 겹 + 이따금 굵은 빗방울
    this.rainBus = ctx.createGain(); this.rainBus.gain.value = 0;
    this.rainLp = ctx.createBiquadFilter(); this.rainLp.type = 'lowpass'; this.rainLp.frequency.value = 9000; this.rainLp.Q.value = 0.4;
    this.rainBus.connect(this.rainLp).connect(this.master); // 지붕 아래면 먹먹하게 (lowpass 를 내린다)
    // 천막 · 텐트 천 위 빗소리: 아주 짧은 빗방울 「틱」 수백 개를 촘촘히 겹친 6초짜리 소리를 만들어 돌린다
    // (낮은 울림 없이 사르륵 · 타닥타닥. 큰 방울은 드물게, 작은 방울이 대부분)
    this.patter = this.#makePatter(6);
    const pt = ctx.createBufferSource(); pt.buffer = this.patter; pt.loop = true;
    const pHp = ctx.createBiquadFilter(); pHp.type = 'highpass'; pHp.frequency.value = 900; pHp.Q.value = 0.5;
    const pLp = ctx.createBiquadFilter(); pLp.type = 'lowpass'; pLp.frequency.value = 7800; pLp.Q.value = 0.4;
    const pPeak = ctx.createBiquadFilter(); pPeak.type = 'peaking'; pPeak.frequency.value = 3200; pPeak.Q.value = 0.8; pPeak.gain.value = 0;
    this.patterGain = ctx.createGain(); this.patterGain.gain.value = 0;
    pt.connect(pHp).connect(pLp).connect(pPeak).connect(this.patterGain).connect(this.master);
    pt.start();
    // 바깥: 주변 땅 · 풀잎에 떨어지는 빗방울 결 (같은 빗방울 소리를 더 밝고 작게, 지붕 아래가 아닐 때만)
    const op = ctx.createBufferSource(); op.buffer = this.patter; op.loop = true; op.playbackRate.value = 1.12;
    const oBp = ctx.createBiquadFilter(); oBp.type = 'bandpass'; oBp.frequency.value = 3600; oBp.Q.value = 0.55;
    this.outPatterGain = ctx.createGain(); this.outPatterGain.gain.value = 0;
    op.connect(oBp).connect(this.outPatterGain).connect(this.master);
    op.start(0, 2.3);
    this.gustT = 0;
    // 실제로 녹음한 천 위 빗소리 (CC0, public/sounds/rain_canvas.m4a). 불러오면 위의 합성 소리 대신 쓴다
    this.canvasGain = ctx.createGain(); this.canvasGain.gain.value = 0;
    this.canvasGain.connect(this.master);
    this.canvasSample = false;
    this.#loadCanvasSample();
    // 좌우로 넓게: 같은 결을 왼쪽 · 오른쪽에 조금 다르게 깔아 가운데서만 들리지 않게
    for (const [rate, f, q, gain] of [[1.0, 2600, 0.35, 0.16], [0.6, 700, 0.5, 0.1]]) {
      for (const pan of [-0.7, 0.7]) {
        const src = ctx.createBufferSource(); src.buffer = this.pink; src.loop = true; src.playbackRate.value = rate * (pan < 0 ? 1 : 1.07);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (pan < 0 ? 0.94 : 1.06); bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gain * 0.75;
        let out = src.connect(bp).connect(g);
        if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out = out.connect(p); }
        out.connect(this.rainBus);
        src.start(0, Math.random() * 1.8);
      }
    }
    this.rainLevel = 0;

    // 귀뚜라미
    const cricket = () => {
      if (!this.muted && this.ambience === 'crickets') this.#cricket();
      setTimeout(cricket, 700 + Math.random() * 2200);
    };
    setTimeout(cricket, 1500);
  }

  /** 테마 소리 바꾸기 */
  setAmbience(kind) { this.ambience = kind || 'crickets'; }

  /** 발소리 한 걸음: 'crunch'(눈 밟는 뽀득) | 'splash'(젖은 땅 찰박) */
  step(kind, vol = 1) {
    if (!this.ctx || this.muted || !kind) return;
    if (kind === 'crunch') {
      // 뽀득: 짧은 중고음 잡음 몇 겹 + 잘게 부서지는 알갱이
      this.#burst({ dur: 0.09, freq: 1900 + Math.random() * 500, q: 0.9, gain: 0.16 * vol });
      this.#burst({ dur: 0.06, freq: 850 + Math.random() * 250, q: 1.2, gain: 0.1 * vol, when: 0.012 });
      for (let i = 0; i < 4; i++) this.#burst({ dur: 0.014, freq: 3200 + Math.random() * 1800, q: 4, gain: 0.05 * vol, when: 0.01 + i * 0.018 });
    } else if (kind === 'splash') {
      this.#burst({ dur: 0.12, freq: 1300 + Math.random() * 400, q: 0.7, gain: 0.07 * vol });
      this.#burst({ dur: 0.05, freq: 3000, q: 2, gain: 0.03 * vol, when: 0.03 });
    }
  }

  /** 천 위 빗소리 버퍼: 작은 빗방울 틱(2~6ms)을 1초에 약 160개, 가끔 조금 큰 방울. 끝과 처음을 겹쳐 이음매 없이 돈다 */
  #makePatter(sec) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * sec);
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let t = 0;
      while (t < n) {
        t += Math.floor(sr * (-Math.log(1 - Math.random()) / 160)); // 고르지 않은 간격 (포아송)
        const big = Math.random() < 0.07;
        const amp = big ? 0.5 + Math.random() * 0.4 : 0.06 + Math.random() ** 2 * 0.3;
        const len = Math.floor(sr * (big ? 0.008 + Math.random() * 0.006 : 0.002 + Math.random() * 0.004));
        let lp = 0;
        const smooth = big ? 0.45 : 0.15; // 큰 방울은 조금 둥글게
        for (let i = 0; i < len; i++) {
          const k = (t + i) % n;
          lp += (Math.random() * 2 - 1 - lp) * (1 - smooth);
          d[k] += lp * amp * Math.exp((-5 * i) / len);
        }
      }
    }
    return buf;
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  // 미리 듣기 파일을 만들 때(OfflineAudioContext)는 currentTime 이 흐르지 않아서 시간을 직접 더한다
  #now() { return this.ctx.currentTime + (this.simT || 0); }

  #burst({ dur = 0.1, type = 'bandpass', freq = 1000, q = 1, gain = 0.3, when = 0, rate = 1 }) {
    const ctx = this.ctx;
    const t = this.#now() + when;
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
    const t = this.#now() + when;
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
    f.frequency.exponentialRampToValueAtTime(1800, this.#now() + 0.6);
  }

  powder(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const f = this.#burst({ dur: 0.8, type: 'bandpass', freq: 500, q: 1.2, gain: 0.3 * vol });
    f.frequency.exponentialRampToValueAtTime(4000, this.#now() + 0.7);
    const notes = [880, 1108.7, 1318.5, 1760];
    notes.forEach((n, i) => this.#tone(n, { dur: 0.6, gain: 0.07 * vol, when: 0.15 + i * 0.08, type: 'sine' }));
  }

  gift() {
    if (!this.ctx) return;
    [523.3, 659.3, 784, 1046.5].forEach((n, i) => this.#tone(n, { dur: 0.35, gain: 0.08, when: i * 0.09, type: 'triangle' }));
  }

  // 녹음 파일: 앞뒤에 0.12초씩 이어지는 소리를 붙여 둬서 그 사이(27.76초)를 끊김 없이 반복한다
  async #loadCanvasSample() {
    try {
      const res = await fetch('/sounds/rain_canvas.m4a');
      if (!res.ok) throw new Error(res.status);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      // AAC 앞뒤의 빈 틈을 피해 반복 구간을 정한다 (24초짜리 이음매 없는 반복으로 만들어 둔 녹음)
      const PAD = 0.05;
      src.loopStart = PAD; src.loopEnd = Math.min(buf.duration, PAD + 24);
      src.connect(this.canvasGain);
      src.start(0, PAD);
      this.canvasSample = true;
    } catch { this.canvasSample = false; } // 못 불러오면 합성 소리로
  }

  async #loadFireSample() {
    try {
      const res = await fetch('/sounds/fire.m4a');
      if (!res.ok) throw new Error(res.status);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      const PAD = 0.12, LOOP = 27.764;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = PAD;
      src.loopEnd = Math.min(buf.duration - 0.01, PAD + LOOP);
      src.connect(this.sampleGain);
      src.start(0, PAD + Math.random() * LOOP * 0.9); // 매번 다른 곳부터
      this.fireSample = true;
    } catch (e) {
      console.warn('[sound] 모닥불 녹음을 불러오지 못해 합성 소리를 써요', e);
    }
  }

  // 짧은 울림(밤 캠핑장 공기처럼 살짝 퍼지는 소리)
  #impulse(sec) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return buf;
  }

  // 나무가 '톡' 하고 터지는 소리 하나: 나무 울림(대역 통과)이 있는 아주 짧은 잡음 + 좌우 위치
  #tick(when, { freq, q, gain, dur, pan, bus }) {
    const ctx = this.ctx;
    const t = this.#now() + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = src.connect(f).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out = out.connect(p); }
    out.connect(bus || this.fireBus);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  // 작은 타닥: 2~5번이 빠르게 이어지는 묶음 (진짜 장작은 한 번에 여러 번 톡톡톡 터진다)
  #crackle() {
    const n = 1 + Math.floor(Math.random() * 4.5);
    const pan = (Math.random() * 2 - 1) * 0.45;
    const base = 700 + Math.random() * 1500;
    let w = 0;
    for (let i = 0; i < n; i++) {
      this.#tick(w, {
        freq: base * (0.8 + Math.random() * 0.5),
        q: 2.5 + Math.random() * 3,
        gain: (0.45 + Math.random() * 0.8) * (i === 0 ? 1 : 0.7),
        dur: 0.012 + Math.random() * 0.035,
        pan: pan + (Math.random() - 0.5) * 0.15,
      });
      w += 0.012 + Math.random() * 0.06;
    }
  }

  // 가끔 크게 '탁!': 낮고 둥근 소리에 짧은 꼬리
  #pop() {
    const pan = (Math.random() * 2 - 1) * 0.35;
    this.#tick(0, { freq: 320 + Math.random() * 380, q: 3 + Math.random() * 3, gain: 1.3 + Math.random() * 0.6, dur: 0.07 + Math.random() * 0.08, pan });
    this.#tick(0.004, { freq: 1600 + Math.random() * 900, q: 1.5, gain: 0.35, dur: 0.025, pan });
    // 터진 뒤 불씨가 자글자글
    for (let i = 0; i < 3; i++) this.#tick(0.05 + i * (0.03 + Math.random() * 0.05), { freq: 1100 + Math.random() * 1400, q: 3, gain: 0.12 + Math.random() * 0.12, dur: 0.015, pan: pan + (Math.random() - 0.5) * 0.3 });
  }

  /** 매 프레임: 가까운 모닥불 세기(0~1)에 따라 불 소리 */
  update(dt, level) {
    if (!this.ctx) return;
    // 빗소리: 지붕 아래면 쏴아 소리는 줄고, 지붕을 두드리는 톡톡 소리가 커진다
    const rainT = this.ambience === 'rain' ? 1 : 0;
    this.rainLevel += (rainT - this.rainLevel) * Math.min(1, dt * 0.5);
    // 바람결처럼 빗소리 크기가 천천히 오르내린다 (밋밋하지 않게)
    this.gustT += dt;
    const gust = 0.82 + 0.12 * Math.sin(this.gustT * 0.13) + 0.07 * Math.sin(this.gustT * 0.41 + 1.7) + 0.04 * Math.sin(this.gustT * 1.3);
    this.rainBus.gain.value = this.rainLevel * gust * (1 - 0.72 * (this.shelterK || 0)); // 지붕 아래면 바깥 쏴아 소리는 작고 먹먹하게
    if (this.outPatterGain) this.outPatterGain.gain.value = 0.32 * this.rainLevel * (1 - (this.shelterK || 0)) * (0.8 + 0.3 * (gust - 0.82) / 0.23);
    this.shelterK = (this.shelterK || 0) + ((this.sheltered ? 1 : 0) - (this.shelterK || 0)) * Math.min(1, dt * 3);
    this.rainLp.frequency.value = 9000 - 8100 * this.shelterK;
    // 천막 · 텐트 천에 떨어지는 빗소리 (지붕 아래에서만, 비가 그치면 함께 잦아든다)
    const roof = this.shelterK * this.rainLevel;
    this.patterGain.gain.value = this.canvasSample ? 0 : 0.75 * roof;
    this.canvasGain.gain.value = this.canvasSample ? 0.7 * roof : 0;
    if (this.rainLevel > 0.05 && !this.muted) {
      if (this.shelterK < 0.3 && Math.random() < dt * 6 * this.rainLevel) this.#tick(0, { freq: 2400 + Math.random() * 2600, q: 3, gain: 0.02 + Math.random() * 0.025, dur: 0.012, pan: (Math.random() - 0.5) * 1.8, bus: this.master });
    }
    // 바람: 눈 오는 밤은 조금 더 서늘하게
    const wantWind = this.ambience === 'snow' ? 0.05 : this.ambience === 'rain' ? (this.sheltered ? 0.004 : 0.012) : 0.025;
    this.windGain.gain.value += (wantWind - this.windGain.gain.value) * Math.min(1, dt * 0.5);
    this.fireLevel += (level - this.fireLevel) * Math.min(1, dt * 2);
    const L = this.fireLevel;
    this.fireT += dt;
    // 불길이 넘실거리는 느낌: 느린 물결 몇 개를 겹쳐 크기를 흔든다
    const sway = 0.82 + 0.1 * Math.sin(this.fireT * 0.7) + 0.06 * Math.sin(this.fireT * 1.9 + 1.3) + 0.04 * Math.sin(this.fireT * 4.3 + 0.4);
    if (this.fireSample) {
      // 녹음이 있으면 녹음만 쓴다 (합성 소리는 끈다)
      this.sampleGain.gain.value = L * 0.9;
      this.fireBus.gain.value = 0;
      return;
    }
    this.fireBus.gain.value = L * 0.5;
    this.roarGain.gain.value = 0.2 * sway; // 너무 크면 바람 소리처럼 들려서 낮게
    this.breathGain.gain.value = 0.022 * (0.6 + 0.8 * Math.max(0, Math.sin(this.fireT * 0.37 + Math.sin(this.fireT * 0.11) * 3)));
    // 타닥거림이 잦아졌다 많아졌다 하는 흐름
    this.fireMood = Math.min(1, Math.max(0.15, this.fireMood + (Math.random() - 0.5) * dt * 0.6));
    if (L < 0.02) return;
    if (Math.random() < dt * (1.8 + 4.2 * this.fireMood)) this.#crackle();
    if (Math.random() < dt * 0.2) this.#pop();
  }
}
