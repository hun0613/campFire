// 📻 아레나 대기 음악 (v1.23.4): 무대에 공연이 없을 때 stanby1 → 2 → 3 → 1 … 을 이어서 튼다
// - 곡이 길어(각 3분 남짓 · 3MB) 통째로 풀어 두지 않고 <audio> 로 흘려 틀고, 소리 크기는 Web Audio 이득(gain)으로 맞춘다
//   (아이폰 사파리는 <audio>.volume 을 무시한다 → createMediaElementSource 로 게임 소리 장치에 연결. 소리 끄기도 그대로 따른다)
// - 소리 크기 = 무대와의 거리(가까워지면 서서히 커지고 멀어지면 작아진다) × 공연 상태(시작 전 서서히 작아지고, 끝나면 서서히 커진다)
// - 거의 안 들리면 멈춰 둔다 (배터리 · 데이터). 다시 커지면 그 자리부터
// - 🏟️ 야외 페스티벌장 공간감 (v1.23.4): 넓은 야외 울림(직접 만든 잔향) · 무대 스피커가 둘레에 맞고 돌아오는 짧은 메아리 ·
//   멀수록 고음이 깎여 먹먹해지고 울림이 많아지는 거리감 · 무대가 화면 어느 쪽에 있는지 따라 왼쪽/오른쪽 (카메라를 돌리면 소리 방향도)
const TRACKS = ['/sounds/stanby1.m4a', '/sounds/stanby2.m4a', '/sounds/stanby3.m4a'];
const LEVEL = 0.42;   // 최대 크기 (모닥불 · 효과음과 어울리게)
const FADE = 1.6;     // 따라가는 빠르기 (초: 클수록 천천히 — 약 5초면 거의 다 바뀐다)

export class ArenaRadio {
  /** @param {import('./audio.js').Sound} sound */
  constructor(sound) {
    this.sound = sound;
    this.el = null;
    this.gain = null;
    this.idx = 0;
    this.level = 0;   // 지금 크기 (0~1)
    this.want = 0;
    this.primed = false;
  }

  #ensure() {
    if (this.el || !this.sound.ctx || !this.sound.master) return !!this.el;
    const ctx = this.sound.ctx;
    const el = new Audio();
    el.preload = 'none';
    el.crossOrigin = 'anonymous';
    el.setAttribute('playsinline', '');
    el.src = TRACKS[this.idx];
    el.addEventListener('ended', () => this.#next());
    el.addEventListener('error', () => this.#next()); // 한 곡이 안 열리면 다음 곡으로
    try {
      const src = ctx.createMediaElementSource(el);
      // 곡 → 거리 필터(멀면 먹먹) → ┬ 바로(dry) → 좌우(pan) ─┐
      //                              ├ 메아리(delay) ──────────┤→ 크기(gain) → 게임 소리
      //                              └ 야외 울림(convolver) ────┘
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 16000; this.lp.Q.value = 0.5;
      this.lowBoost = ctx.createBiquadFilter(); this.lowBoost.type = 'lowshelf'; this.lowBoost.frequency.value = 160; this.lowBoost.gain.value = 0; // 멀리선 저음이 더 남는다
      this.dry = ctx.createGain();
      this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.13;
      const fb = ctx.createGain(); fb.gain.value = 0.22;
      const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2600;
      this.echoWet = ctx.createGain();
      this.verb = ctx.createConvolver(); this.verb.buffer = festivalImpulse(ctx);
      this.verbWet = ctx.createGain();
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      src.connect(this.lp); this.lp.connect(this.lowBoost);
      this.lowBoost.connect(this.dry);
      if (this.pan) { this.dry.connect(this.pan); this.pan.connect(this.gain); } else this.dry.connect(this.gain);
      this.lowBoost.connect(this.echo); this.echo.connect(echoLp); echoLp.connect(fb); fb.connect(this.echo); echoLp.connect(this.echoWet); this.echoWet.connect(this.gain);
      this.lowBoost.connect(this.verb); this.verb.connect(this.verbWet); this.verbWet.connect(this.gain);
      this.gain.connect(this.sound.master);
      this.#space(60, 0, true);
    } catch { el.volume = 0; } // Web Audio 연결이 안 되는 브라우저: <audio>.volume 으로
    this.el = el;
    return true;
  }

  #next() {
    if (!this.el) return;
    this.idx = (this.idx + 1) % TRACKS.length;
    this.el.src = TRACKS[this.idx];
    if (this.level > 0.005) this.el.play().catch(() => {});
  }

  /**
   * 사용자가 화면을 누를 때 한 번: 휴대폰은 손으로 누른 순간에만 소리를 틀 수 있어서,
   * 그때 한 번 틀었다 멈춰 두면(잠금 풀기) 나중에 열기구가 다가갈 때 저절로 틀 수 있다
   */
  prime() {
    if (this.primed || !this.#ensure()) return;
    this.primed = true;
    const el = this.el;
    const p = el.play();
    if (p && p.then) p.then(() => { if (this.level <= 0.005) el.pause(); }).catch(() => { this.primed = false; });
  }

  /**
   * 매 프레임
   * @param {number} dt
   * @param {number} want 0~1 (거리 × 공연 상태)
   */
  /** 거리(m) · 좌우(-1~1) → 필터 · 울림 · 메아리 · 좌우 (갑자기 바뀌지 않게 부드럽게) */
  #space(d, pan, now = false) {
    if (!this.lp) return;
    const ctx = this.sound.ctx, t0 = ctx.currentTime, tc = now ? 0.01 : 0.6;
    const k = Math.min(1, Math.max(0, (d - 30) / 200)); // 0 = 무대 앞, 1 = 거의 안 들리는 거리
    this.lp.frequency.setTargetAtTime(16000 * Math.pow(1400 / 16000, k), t0, tc);
    this.lowBoost.gain.setTargetAtTime(4 * k, t0, tc);
    this.dry.gain.setTargetAtTime(1 - 0.4 * k, t0, tc);
    this.verbWet.gain.setTargetAtTime(0.2 + 0.32 * k, t0, tc);
    this.echoWet.gain.setTargetAtTime(0.07 + 0.1 * k, t0, tc);
    if (this.pan) this.pan.pan.setTargetAtTime(pan, t0, tc);
  }

  update(dt, want, space = null) {
    this.want = want;
    if (!this.#ensure()) return;
    if (space && this.level > 0.005) { this.spaceT = (this.spaceT || 0) - dt; if (this.spaceT <= 0) { this.spaceT = 0.15; this.#space(space.dist, space.pan); } }
    this.level += (want - this.level) * Math.min(1, dt / FADE);
    if (Math.abs(want - this.level) < 0.002) this.level = want;
    const v = this.level * LEVEL;
    if (this.gain) this.gain.gain.value = v; else this.el.volume = Math.min(1, v);
    const el = this.el;
    if (this.level > 0.005) { if (el.paused && this.primed) el.play().catch(() => {}); } else if (!el.paused) el.pause();
  }
}

/** 무대와의 거리 → 0~1 (90m 안이면 다 들리고, 230m 밖이면 안 들린다. 그 사이는 부드럽게) */
export function distanceLevel(d, near = 90, far = 230) {
  const t = Math.min(1, Math.max(0, (far - d) / (far - near)));
  return t * t * (3 - 2 * t);
}

/**
 * 공연 상태 → 0~1: 공연 중 0, 다음 공연 시작 8초 전부터 서서히 0으로 (끝나면 update 의 따라가기로 서서히 다시 커진다)
 * @param {{ startedAt: number, endsAt?: number } | null} show 지금 무대 (시작 전이면 null 취급)
 * @param {{ at: number } | null} next 다음 무대
 */
export function showLevel(now, show, next, lead = 8000) {
  if (show && now >= show.startedAt && (!show.endsAt || now < show.endsAt)) return 0;
  if (next) { const left = next.at - now; if (left <= lead) return Math.max(0, left / lead); }
  return 1;
}

/**
 * 야외 페스티벌장 잔향 (직접 만든다): 25ms 뒤 시작, 처음엔 띄엄띄엄 굵은 반사(무대 지붕 · 스피커 탑 · 둘레 나무),
 * 그 뒤 2.6초 동안 서서히 사라지는 넓은 울림. 왼쪽 · 오른쪽을 다르게 흩어 넓게 퍼지는 느낌
 */
function festivalImpulse(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 2.8), pre = Math.floor(sr * 0.025);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.35 * Math.min(1, t / 2)); // 뒤로 갈수록 고음이 먼저 사라진다
      d[i] = lp * Math.exp(-t * 2.3) * 0.6;
    }
    for (const [ms, g] of [[38, 0.5], [61, 0.35], [97, 0.3], [140, 0.22], [210, 0.16]]) { // 굵은 초기 반사 (좌우 조금 엇갈려)
      const i = pre + Math.floor(sr * (ms + (ch ? 7 : 0)) / 1000);
      if (i < len) d[i] += g * (ch ? 0.9 : 1);
    }
  }
  return buf;
}
