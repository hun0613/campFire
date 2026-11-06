// 모바일 터치 컨트롤: 왼쪽 가상 조이스틱 + 오른쪽 액션 버튼

export const isTouch = (() => {
  try {
    return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  } catch { return false; }
})();

export class TouchControls {
  /**
   * @param {{ onActionDown: () => void, onActionUp: () => void }} cb
   */
  constructor(cb) {
    this.x = 0; // -1..1 (오른쪽 +)
    this.y = 0; // -1..1 (아래 +)
    this.mag = 0;
    this.active = false;

    const root = document.createElement('div');
    root.id = 'touchControls';
    root.innerHTML = `
      <div id="joyZone"><div id="joyBase"><div id="joyKnob"></div></div></div>
      <div id="touchHint" class="hidden">
        <div class="th-half th-left"><div class="th-ico">🕹️</div><b>이동</b><span>왼쪽 아무 데나<br>엄지를 대고 밀기</span></div>
        <div class="th-half th-right"><div class="th-ico">👆</div><b>시점 돌리기</b><span>오른쪽을 드래그<br>두 손가락으로 줌</span></div>
      </div>
      <button id="actionBtn" class="hidden"><span class="a-icon">✋</span><span class="a-label"></span></button>`;
    document.getElementById('hud').appendChild(root);

    const zone = root.querySelector('#joyZone');
    const base = root.querySelector('#joyBase');
    const knob = root.querySelector('#joyKnob');
    const R = 52;
    let id = null, cx = 0, cy = 0;

    const move = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, d / R);
      this.mag = m < 0.15 ? 0 : m;
      this.x = this.mag ? dx / R : 0;
      this.y = this.mag ? dy / R : 0;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      zone.setPointerCapture(id);
      // 떠다니는 조이스틱: 엄지가 닿은 곳이 중심이 된다
      const z = zone.getBoundingClientRect();
      const half = base.offsetWidth / 2;
      cx = Math.min(z.right - half, Math.max(z.left + half, e.clientX));
      cy = Math.min(z.bottom - half, Math.max(z.top + half, e.clientY));
      base.style.left = `${cx - z.left - half}px`;
      base.style.top = `${cy - z.top - half}px`;
      base.style.bottom = 'auto';
      this.active = true;
      base.classList.add('on');
      move(e);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.active = false;
      this.x = this.y = this.mag = 0;
      knob.style.transform = '';
      base.classList.remove('on');
      base.style.left = base.style.top = base.style.bottom = '';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const btn = root.querySelector('#actionBtn');
    this.btn = btn;
    this.btnIcon = btn.querySelector('.a-icon');
    this.btnLabel = btn.querySelector('.a-label');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('press');
      cb.onActionDown();
    });
    const up = () => { btn.classList.remove('press'); cb.onActionUp(); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** 화면 분할 안내를 잠깐 보여준다 (첫 터치 시 바로 사라짐) */
  showHint(ms = 5000) {
    const el = document.getElementById('touchHint');
    if (!el) return;
    el.classList.remove('hidden', 'out');
    const hide = () => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 400);
      removeEventListener('pointerdown', hide, true);
    };
    clearTimeout(this._hintT);
    this._hintT = setTimeout(hide, ms);
    setTimeout(() => addEventListener('pointerdown', hide, true), 600);
  }

  setAction(action) {
    if (!action) {
      if (!this.btn.classList.contains('hidden')) this.btn.classList.add('hidden');
      return;
    }
    this.btn.classList.remove('hidden');
    if (this._key !== action.label) {
      this._key = action.label;
      this.btnIcon.textContent = action.icon;
      this.btnLabel.textContent = action.label;
    }
  }
}
