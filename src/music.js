// 모닥불 음악: 유튜브 영상을 '내가 앉아 있는 모닥불'의 TV 화면에서 재생한다.
// - 그 모닥불에 앉은 사람만 들을 수 있다 (일어나면 바로 꺼짐)
// - 모두 같은 부분을 듣도록 서버의 시작 시각에 맞춰 재생 위치를 맞춘다
// - 영상은 CSS3D로 TV 화면 위에 그대로 붙인다 (유튜브 규칙: 영상 창이 보이는 상태로 재생)
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { SCREEN } from './monitor.js';

const IFRAME_W = SCREEN.px;
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
  }

  setSize(w, h) { this.css.setSize(w, h); }

  async #ensure() {
    if (this.player || this._creating) return;
    this._creating = true;
    const YT = await loadYT().catch(() => null);
    if (!YT) { this._creating = false; return; }
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

    if (this.muted) this.player.mute(); else if (this._wasMuted !== false) { this.player.unMute(); this.player.setVolume(100); }
    this._wasMuted = this.muted;

    // 폰은 자동재생이 막혀서 화면을 한 번 눌러야 한다
    const st = this.player.getPlayerState?.();
    this.loadT += dt;
    const playing = st === 1 || st === 3;
    const needTap = !playing && this.loadT > 2.5 && !this.failed && st !== 0;
    this.hint.classList.toggle('hidden', !needTap);
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

  #load() {
    const c = this.cur;
    const at = Math.max(0, (Date.now() + (this.clockOffset || 0) - c.startedAt) / 1000);
    this.player.loadVideoById({ videoId: c.vid, startSeconds: at });
    this._wasMuted = null;
  }

  #onState(s) {
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
