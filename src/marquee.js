// 🎞️ 긴 글자 흐르기 (v1.23.1): 칸보다 긴 곡 제목은 말줄임표(…) 대신 오른쪽에서 왼쪽으로 천천히 흘러간다
// - textStrip: 3D 전광판 위에 얹는 투명한 글자 띠 (글자 줄만 따로 그려서, 큰 전광판 그림을 매 프레임 다시 올리지 않는다)
// - marquee: 화면(HTML) 칸. 넘칠 때만 흐르고, 들어가면 가만히 있다
import * as THREE from 'three';

const SPEED = 70;   // 흐르는 속도 (캔버스 px / 초)
const GAP = 140;    // 끝 글자와 다음 바퀴 첫 글자 사이
const HOLD = 1.6;   // 처음 몇 초는 멈춰 있다가 흐른다 (첫 글자를 읽을 시간)

/**
 * 전광판 글자 띠
 * @param {{ w: number, h: number, px?: number, py?: number, font: string, color?: string, align?: 'center'|'left' }} o
 *   w · h: 띠의 실제 크기(m), px · py: 캔버스 크기, font: 캔버스 글꼴, align: 넘치지 않을 때 놓는 곳
 */
export function textStrip(o) {
  const PX = o.px || 1024, PY = o.py || 96;
  const cv = document.createElement('canvas'); cv.width = PX; cv.height = PY;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  mesh.renderOrder = 2;
  const g = cv.getContext('2d');
  let text = '', color = o.color || '#fff1d8', width = 0, t = 0, acc = 0, drawn = null;
  const pad = 8;
  function draw(x) {
    g.clearRect(0, 0, PX, PY);
    g.font = o.font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'left';
    if (width <= PX - pad * 2) { // 들어간다: 가만히
      g.fillText(text, o.align === 'left' ? pad : (PX - width) / 2, PY / 2);
    } else {
      g.fillText(text, x, PY / 2);
      g.fillText(text, x + width + GAP, PY / 2);
      // 양 끝은 살짝 흐리게 (글자가 칼같이 잘려 보이지 않게)
      g.globalCompositeOperation = 'destination-out';
      for (const [x0, x1] of [[0, 28], [PX, PX - 28]]) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(Math.min(x0, x1), 0, 28, PY); }
      g.globalCompositeOperation = 'source-over';
    }
    tex.needsUpdate = true;
  }
  return {
    mesh,
    /** 글자 바꾸기 (같으면 그대로) */
    set(s, c) {
      s = String(s || ''); c = c || color;
      g.font = o.font;
      const wd = g.measureText(s).width; // 글꼴을 늦게 읽어 와도 다음에 부를 때 너비가 바뀌면 다시 그린다
      if (s === text && c === color && wd === width) return;
      if (s !== text) t = 0;
      text = s; color = c; width = wd;
      drawn = null;
      draw(pad);
    },
    /** 넘치는 글자만 흐른다 (1초에 약 30번 다시 그린다) */
    update(dt) {
      if (!mesh.visible || !text || width <= PX - pad * 2) return;
      t += dt; acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      const run = Math.max(0, t - HOLD) * SPEED, loop = width + GAP;
      const x = pad - (run % loop);
      if (x === drawn) return;
      drawn = x;
      draw(x);
    },
  };
}

/**
 * HTML 칸: el 의 글자가 칸보다 길면 흐르게 한다. 글자를 바꾼 뒤(그리고 칸이 화면에 보인 뒤) 부르면 된다
 * 칸(el)은 overflow: hidden · white-space: nowrap 이어야 한다 (.mq 가 붙으면 CSS 가 흐르기를 맡는다)
 */
export function marquee(el, text) {
  if (!el) return;
  if (text != null && el.dataset.mqText !== String(text)) {
    el.dataset.mqText = String(text);
    el.textContent = String(text);
  }
  requestAnimationFrame(() => {
    const s = el.dataset.mqText ?? el.textContent;
    el.classList.remove('mq');
    el.textContent = s;
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 1 || el.clientWidth === 0) return;
    const span = document.createElement('span');
    span.className = 'mq-in';
    const a = document.createElement('span'); a.textContent = s;
    const b = document.createElement('span'); b.textContent = s; b.setAttribute('aria-hidden', 'true');
    span.append(a, b);
    el.textContent = '';
    el.append(span);
    el.classList.add('mq');
    const loop = a.getBoundingClientRect().width + 36; // 36 = 두 바퀴 사이 (CSS 의 padding-right 와 같게)
    span.style.setProperty('--mq-x', `${-loop}px`);
    span.style.setProperty('--mq-t', `${(loop / 32).toFixed(1)}s`); // 앞 20% 는 멈춤 (CSS)
  });
}
/** 보이는 칸 안의 [data-mq] 를 모두 다시 잰다 (창을 연 뒤 · 화면 크기가 바뀐 뒤) */
export function marqueeAll(root = document) {
  for (const el of root.querySelectorAll('[data-mq]')) marquee(el);
}
