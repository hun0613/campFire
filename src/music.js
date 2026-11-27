// 모닥불 음악: 유튜브 영상을 '내가 앉아 있는 모닥불'의 TV 화면에서 재생한다.
// - 그 모닥불에 앉은 사람만 들을 수 있다 (일어나면 바로 꺼짐)
// - 모두 같은 부분을 듣도록 서버의 시작 시각에 맞춰 재생 위치를 맞춘다
// - 영상은 CSS3D로 TV 화면 위에 그대로 붙인다 (유튜브 규칙: 영상 창이 보이는 상태로 재생)
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { SCREEN } from './monitor.js';

const IFRAME_W = SCREEN.px;
// 📱 아이폰 · 아이패드 사파리 (아이패드는 맥처럼 보이기도 한다): 소리 있는 영상은 사용자가 누르기 전엔 자동재생이 막힌다
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IFRAME_H = Math.round(SCREEN.px * (SCREEN.h / SCREEN.w)); // 200

let apiPromise = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiPromise = null; reject(new Error('youtube api')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export class Music {
  /**
   * @param {{ scene: THREE.Scene, layerParent: HTMLElement, before: HTMLElement, hint: HTMLElement,
   *           onEnded, onError, onDuration }} cb
   */
  constructor(cb) {
    this.cb = cb;
    this.hint = cb.hint;
    this.css = new CSS3DRenderer();
    this.css.domElement.className = 'tv-layer';
    cb.layerParent.insertBefore(this.css.domElement, cb.before);
    this.css.setSize(innerWidth, innerHeight);
    this.scene3 = new THREE.Scene();

    this.box = document.createElement('div');
    this.box.className = 'tv-video';
    this.box.style.width = `${IFRAME_W}px`;
    this.box.style.height = `${IFRAME_H}px`;
    const slot = document.createElement('div');
    this.box.appendChild(slot);
    this.slot = slot;
    // 멈춰 있는 유튜브 화면의 위(제목 · 채널)와 아래(「YouTube에서 보기」 · 공유)는 모두 youtube.com 링크라서,
    // 폰(특히 아이폰)에서 거기를 누르면 유튜브 앱으로 넘어가 버린다. 그 띠를 투명한 막으로 덮어 가운데(▶)만 눌리게 한다
    for (const side of ['top', 'bottom']) {
      const sh = document.createElement('div');
      sh.className = `tv-shield ${side}`;
      sh.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.#nudge(); });
      sh.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
      this.box.appendChild(sh);
    }
    this.obj = new CSS3DObject(this.box);
    this.obj.scale.setScalar(SCREEN.w / IFRAME_W);
    this.obj.visible = false;
    this.scene3.add(this.obj);

    this.player = null;
    this.ready = false;
    this.cur = null; // { pitId, vid, startedAt }
    this.muted = false;
    this.loadT = 0;
    this.driftT = 0;
    this.reported = new Set();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    // 📱 iOS (v1.23.6): 소리 없이 먼저 자동재생 → 화면 어디든 한 번 누르는 순간 소리를 켠다 (iOS 는 「누른 순간」에만 소리를 켜게 해 준다)
    //   두 번 실패하면 예전처럼 「TV 가운데 ▶ 누르기」로
    this.autoMuted = false;   // 지금 iOS 때문에 소리 없이 틀고 있다
    this.unmuteFails = 0;
    this.forceTap = false;    // 소리 켜기가 막혀 TV 를 직접 눌러야 한다
    if (IOS) for (const t of ['touchend', 'click', 'keydown']) addEventListener(t, () => this.#onGesture(), { capture: true, passive: true });
  }

  /** 📱 iOS: 입장하자마자 플레이어를 미리 만들어 둔다 (누르기 「전」에 만든 플레이어여야 누른 효과가 플레이어 안까지 전해진다) */
  warm() { if (IOS) this.#ensure(); }

  /**
   * 📱 iOS: 「앉기」를 누를 때 그 모닥불에 곡이 나오고 있으면 미리 준비해 두고, 손가락을 떼는 순간(같은 터치) 소리와 함께 바로 튼다
   * (iOS 는 손가락을 뗄 때 · 클릭만 「사용자가 누른 순간」으로 쳐 준다. 행동 버튼은 닿는 순간 반응해서 한 박자 미룬다)
   */
  armKick(pitId, m) { if (IOS && m?.vid) this.pendingKick = { pitId, m, at: performance.now() }; }
  /** 📱 iOS: 지금 이 터치 안에서 곡을 소리와 함께 시작 (곡 고르기 「틀기」 클릭 같은 곳에서 바로 부른다) */
  kick(pitId, m) {
    if (!IOS || !this.ready || !m?.vid || this.muted) return false;
    this.cur = { pitId, vid: m.vid, startedAt: m.startedAt };
    this.loadT = 0; this.failed = false; this.autoMuted = false;
    const at = Math.max(0, (Date.now() + (this.clockOffset || 0) - m.startedAt) / 1000);
    try { this.player.unMute(); this._isMuted = false; this._vol = null; this.player.loadVideoById({ videoId: m.vid, startSeconds: at }); } catch { return false; }
    this.unmuteAt = performance.now(); // 1.2초 뒤 정말 나오는지 확인 (막혔으면 소리 없이로)
    return true;
  }
  /**
   * 🎤📱 iOS 아레나: 공연은 정해진 시각에 저절로 시작해서 그 순간엔 아무도 누르지 않는다.
   * → 아레나에 가는 동안 · 있는 동안 다음 무대 곡을 플레이어에 미리 올려 두고(cue), 사용자의 아무 터치 순간에
   *   소리 없이 아주 잠깐 틀었다 바로 멈춰 둔다(iOS 는 터치 순간 한 번 재생된 플레이어를 「허락된 플레이어」로 기억).
   *   그러면 공연 시각에 소리와 함께 저절로 시작한다
   */
  prepare(vid) {
    if (!IOS || this.primed || !vid) return;
    this.#ensure();
    if (!this.ready || this.cur || this.cuedVid === vid) return;
    try { this.player.cueVideoById({ videoId: vid, startSeconds: 0 }); this.cuedVid = vid; } catch { /* 플레이어가 아직 */ }
  }
  #prime() {
    if (this.priming && performance.now() - this.priming > 3000) this.priming = 0; // 막혀서 응답이 없으면 다음 터치에 다시
    if (this.primed || this.priming || !this.cuedVid || this.cur || !this.ready) return false;
    this.priming = performance.now();
    this.box.style.display = ''; // (화면에 안 보이는 TV 레이어 안이라 사용자는 보지 못한다)
    try { this.player.mute(); this._isMuted = true; this.player.playVideo(); } catch { this.priming = 0; return false; }
    return true;
  }
  #onGesture() {
    if (this.#prime()) return;
    const k = this.pendingKick;
    if (k) { this.pendingKick = null; if (performance.now() - k.at < 2500 && this.kick(k.pitId, k.m)) return; }
    this.#unmuteByGesture();
  }

  /** 📱 iOS: 사용자가 화면을 누른 그 순간 (같은 처리 안에서) 소리를 켜고 재생 */
  #unmuteByGesture() {
    if (!this.autoMuted || !this.ready || !this.cur || this.muted) return;
    this.autoMuted = false;
    this._isMuted = false;
    try { this.player.unMute(); this.player.setVolume(this._vol ?? 100); this.player.playVideo(); } catch { /* 플레이어가 아직 */ }
    this.unmuteAt = performance.now();
  }

  setSize(w, h) { this.css.setSize(w, h); }

  async #ensure() {
    if (this.player || this._creating) return;
    this._creating = true;
    const YT = await loadYT().catch(() => null);
    if (!YT) { this._creating = false; return; }
    // 유튜브 플레이어는 문서에 붙은 자리에서만 만들어진다. TV 상자는 곡이 처음 나올 때에야 CSS3D 가 붙이므로,
    // 미리 만들 땐(📱 iOS) 보이지 않게 먼저 붙여 둔다 (TV 레이어는 캔버스 뒤라 사용자는 보지 못한다)
    if (!this.box.isConnected) { (this.css.domElement.firstElementChild || this.css.domElement).appendChild(this.box); if (!this.cur) this.box.style.display = 'none'; }
    this.player = new YT.Player(this.slot, {
      width: IFRAME_W, height: IFRAME_H,
      // 음악만: 컨트롤·키보드·주석 끔. 화면은 재생이 시작되면 눌러도 반응하지 않게 잠근다
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, fs: 0, iv_load_policy: 3, controls: 0, disablekb: 1, cc_load_policy: 0 },
      events: {
        onReady: () => { this.ready = true; if (this.cur) this.#load(); },
        onStateChange: (e) => this.#onState(e.data),
        onError: (e) => this.#onError(e.data),
      },
    });
  }

  /**
   * @param {object|null} pit  내가 앉아 있는 모닥불 (없으면 null)
   */
  update(dt, pit, monitor, now, camera) {
    this._camera = camera;
    const m = pit && pit.state === 'lit' ? pit.music : null;
    if (!m || !monitor) {
      if (this.cur) this.stop();
      return;
    }
    // (터치 순간 먼저 틀어 둔 곡이면 서버 시작 시각이 조금 달라도 다시 불러오지 않는다 — 위치는 아래에서 맞춘다)
    if (this.cur && this.cur.pitId === pit.id && this.cur.vid === m.vid && this.cur.startedAt !== m.startedAt && Math.abs(this.cur.startedAt - m.startedAt) < 4000) this.cur.startedAt = m.startedAt;
    if (!this.cur || this.cur.pitId !== pit.id || this.cur.vid !== m.vid || this.cur.startedAt !== m.startedAt) {
      this.cur = { pitId: pit.id, vid: m.vid, startedAt: m.startedAt };
      this.loadT = 0;
      this.failed = false;
      this.#ensure();
      if (this.ready) this.#load();
    }
    // TV 화면에 영상 붙이기 (영상은 캔버스 뒤에 있고, 이 TV 화면만 구멍을 뚫어 보이게)
    if (this.mon !== monitor) { this.mon?.setHole(false); this.mon = monitor; }
    monitor.setHole(!this.tapMode);
    monitor.screenPose(this._p, this._q);
    this.obj.scale.setScalar((monitor.screenW || SCREEN.w) / IFRAME_W); // 텐트 TV는 모닥불 TV와 크기가 다르다
    this.obj.position.copy(this._p);
    this.obj.quaternion.copy(this._q);
    this.obj.visible = true;
    this.css.render(this.scene3, camera);
    if (!this.ready) return;

    // 🎤 아레나 무대: 곡이 시작하면 3초 동안 서서히 커지고, 끝나기 5초 전부터 서서히 작아진다 (대기 음악과 엇갈려 넘어가게)
    let vol = 100;
    if (pit.id === 'arena') {
      const k1 = Math.min(1, Math.max(0, (now - m.startedAt) / 3000));
      const end = m.endsAt ? m.endsAt - 2000 : 0;
      const k2 = end ? Math.min(1, Math.max(0, (end - now) / 5000)) : 1;
      vol = Math.round(100 * Math.min(k1, k2) / 5) * 5; // 5 단위로만 바꾼다 (자주 부르지 않게)
    }
    const wantMute = this.muted || this.autoMuted; // 게임 소리 끔 · iOS 소리 없이 자동재생 중
    if (wantMute) { if (this._isMuted !== true) { this.player.mute(); this._isMuted = true; } }
    else {
      if (this._isMuted !== false) { this.player.unMute(); this._isMuted = false; this._vol = null; }
      if (vol !== this._vol) { this._vol = vol; this.player.setVolume(vol); }
    }

    // 폰은 자동재생이 막혀서 화면을 한 번 눌러야 한다
    const st = this.player.getPlayerState?.();
    this.loadT += dt;
    const playing = st === 1 || st === 3;
    // 📱 iOS: 소리를 켠 뒤 1.2초 안에 멈춰 버렸으면(누른 효과가 플레이어까지 안 갔다) 다시 소리 없이 틀고, 두 번째면 TV 를 직접 누르게
    if (this.unmuteAt && performance.now() - this.unmuteAt > 1200) {
      this.unmuteAt = 0;
      if (!playing) {
        this.unmuteFails++;
        if (this.unmuteFails < 2) { this.autoMuted = true; this.player.mute(); this._isMuted = true; this.player.playVideo(); }
        else { this.forceTap = true; this.player.pauseVideo(); } // 멈춘 채로 소리를 켜 두고(멈춰 있을 땐 막히지 않는다) ▶ 를 직접 누르게
      }
    }
    if (this.unmuteAt === 0 && playing && !this.autoMuted && IOS) this.everUnmuted = true; // 소리 켜기에 성공 → 다음 곡부터는 소리와 함께 바로 틀어 본다
    // 📱 iOS: 소리와 함께 틀었는데 2.5초 동안 안 나오면(자동재생이 막힘) 소리 없이 다시 튼다
    if (IOS && !playing && !this.autoMuted && !this.forceTap && !this.muted && this.loadT > 2.5 && !this.failed && st !== 0) {
      this.autoMuted = true; this.player.mute(); this._isMuted = true; this.player.playVideo(); this.loadT = 0;
    }
    const muteMode = this.autoMuted && playing && !this.muted; // 소리 없이 나오는 중 → 「화면을 누르면 소리」 안내
    const needTap = !playing && this.loadT > 2.5 && !this.failed && st !== 0;
    if (muteMode !== (this.hint.dataset.mode === 'mute')) { // 같은 안내 칸을 잠깐 「소리 켜기」 안내로 쓴다
      if (muteMode) { this.hint.dataset.orig = this.hint.textContent; this.hint.textContent = '🔈 화면을 한 번 누르면 소리가 나와요'; this.hint.dataset.mode = 'mute'; }
      else { if (this.hint.dataset.orig) this.hint.textContent = this.hint.dataset.orig; delete this.hint.dataset.mode; }
    }
    this.hint.classList.toggle('hidden', !needTap && !muteMode);
    // 폰에서 처음 한 번 눌러야 할 때만 영상을 캔버스 위로 올려 누를 수 있게 한다
    if (this.tapMode !== needTap) { this.tapMode = needTap; this.css.domElement.classList.toggle('tap', needTap); }
    // 재생 중엔 화면을 잠가서 다른 영상으로 넘어가지 않게 (처음 재생을 위해 멈춰 있을 때만 누를 수 있음)
    const locked = playing || st === 0;
    if (this._locked !== locked) {
      this._locked = locked;
      this.box.classList.toggle('locked', locked);
      this.box.style.pointerEvents = locked ? 'none' : 'auto'; // CSS3DObject가 inline으로 auto를 넣어서 직접 덮어쓴다
    }

    // 다른 사람과 재생 위치 맞추기
    this.driftT += dt;
    if (st === 1 && this.driftT > 4) {
      this.driftT = 0;
      const at = (now - this.cur.startedAt) / 1000;
      const dur = this.player.getDuration?.() || 0;
      if (at > 0 && (!dur || at < dur - 1) && Math.abs(this.player.getCurrentTime() - at) > 2.5) this.player.seekTo(at, true);
    }
  }

  /** 가운데가 아닌 곳을 눌렀을 때: 안내를 살짝 흔들어 가운데를 누르라고 알려 준다 */
  #nudge() {
    const h = this.hint;
    h.classList.remove('nudge'); void h.offsetWidth; h.classList.add('nudge');
  }

  #load() {
    const c = this.cur;
    const at = Math.max(0, (Date.now() + (this.clockOffset || 0) - c.startedAt) / 1000);
    // 📱 iOS: 아직 소리를 켜 본 적이 없으면 소리 없이 먼저 틀어 둔다 (자동재생이 막히지 않게)
    if (IOS && !this.forceTap && !this.muted && !this.everUnmuted && !this.primed) { this.autoMuted = true; this.player.mute(); }
    this.player.loadVideoById({ videoId: c.vid, startSeconds: at });
    this._isMuted = this.autoMuted || this.muted ? true : null; this._vol = null;
  }

  #onState(s) {
    if (this.priming && (s === 1 || s === 3)) { // 🎤📱 잠금 풀기 성공: 바로 멈추고 처음으로 (실제 공연 때 소리와 함께)
      this.priming = 0; this.primed = true;
      try { this.player.pauseVideo(); this.player.seekTo(0, true); this.player.unMute(); this._isMuted = false; } catch { /* 무시 */ }
      if (!this.cur) this.box.style.display = 'none';
      return;
    }
    const c = this.cur;
    if (!c) return;
    if (s === 1) {
      this.hint.classList.add('hidden');
      const key = `${c.pitId}|${c.vid}|${c.startedAt}`;
      const dur = this.player.getDuration?.();
      if (dur > 0 && !this.reported.has(key)) { this.reported.add(key); this.cb.onDuration(c.pitId, c.vid, dur); }
    }
    if (s === 0) this.cb.onEnded(c.pitId, c.vid);
  }

  #onError(code) {
    const c = this.cur;
    if (!c) return;
    this.failed = true;
    this.hint.classList.add('hidden');
    this.cb.onError(c.pitId, c.vid, code);
  }

  stop() {
    this.cur = null;
    this.autoMuted = false; this.unmuteAt = 0;
    if (this.hint.dataset.mode === 'mute') { if (this.hint.dataset.orig) this.hint.textContent = this.hint.dataset.orig; delete this.hint.dataset.mode; }
    this.mon?.setHole(false);
    this.mon = null;
    this.tapMode = false;
    this.css.domElement.classList.remove('tap');
    this.obj.visible = false;
    this.hint.classList.add('hidden');
    try { this.player?.stopVideo(); } catch { /* 무시 */ }
    if (this._camera) this.css.render(this.scene3, this._camera);
  }
}
