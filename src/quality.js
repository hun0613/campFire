// 🖥️ 화질 (v1.22.8): 높음 · 보통 · 가벼움 + 자동
// - 높음 = 예전 PC 설정, 보통 = 휴대폰 설정, 가벼움 = 그보다 더 가볍게 (그림자 · 멀티샘플 끔, 픽셀 · 조명 줄임)
// - 자동: 들어온 뒤 실제로 그려지는 프레임을 재서 느리면 한 단계씩 내린다 (올리지는 않는다 — 오르내림 반복 방지)
//   내린 단계는 기기에 기억해 두고, 다음에 들어올 땐 처음부터 그 단계로 (풀 · 꽃 밀도처럼 처음 만들 때 정하는 것까지)
// - 그래픽 가속이 꺼진 브라우저(소프트웨어 렌더러)는 처음부터 가벼움 + 안내
export const LEVELS = ['high', 'mid', 'low'];
export const LABEL = { auto: '자동', high: '높음', mid: '보통', low: '가벼움' };
/** 단계별 설정: 픽셀 예산 · 최대 배율 · 멀티샘플 · 그림자(0 = 끔) · 빛 번짐 해상도 나눗수 · 실제 조명 수 · 비/눈 양(만들어 둔 개수 중) · 가루 · 연출 파티클 한도 · 만드는 양 */
export const PRESET = {
  high: { pixels: 3.2e6, maxPR: 1.5, samples: 4, shadow: 2048, bloomDiv: 2, lamps: 3, fires: 4, precip: 1, fx: 5000, fxDensity: 1 },
  mid: { pixels: 2.2e6, maxPR: 1.5, samples: 2, shadow: 1024, bloomDiv: 2, lamps: 2, fires: 3, precip: 1, fx: 3200, fxDensity: 0.8 },
  low: { pixels: 1.3e6, maxPR: 1.0, samples: 0, shadow: 0, bloomDiv: 4, lamps: 1, fires: 2, precip: 0.5, fx: 1800, fxDensity: 0.55 },
};
const KEY = 'gfx';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 못 해도 이번엔 동작 */ } };

/** 그래픽 가속이 꺼져 CPU 로 그리는 브라우저인지 (SwiftShader · llvmpipe · Microsoft Basic Render) */
export function softwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(r);
  } catch { return false; }
}

/**
 * @param {{ isTouch: boolean }} o
 * @returns {{ mode: 'auto'|'high'|'mid'|'low', level: 'high'|'mid'|'low', soft: boolean, top: string }}
 */
export function initQuality({ isTouch }) {
  const s = read();
  const top = isTouch ? 'mid' : 'high'; // 휴대폰 · 태블릿은 보통이 가장 높은 단계
  const clamp = (l) => (LEVELS.indexOf(l) < LEVELS.indexOf(top) ? top : l);
  const soft = softwareGL();
  const q = new URLSearchParams(location.search).get('gfx'); // 점검용: ?gfx=high|mid|low
  const mode = LEVELS.includes(q) ? q : ['auto', ...LEVELS].includes(s.mode) ? s.mode : 'auto';
  let level = mode !== 'auto' ? mode : LEVELS.includes(s.auto) ? s.auto : top;
  if (mode === 'auto' && soft) level = 'low';
  level = clamp(level);
  return { mode, level, soft, top };
}
export function saveMode(mode) { write({ ...read(), mode }); }
export function saveAuto(level) { write({ ...read(), auto: level }); }
export const lower = (l) => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(l) + 1)];

/**
 * 자동 화질: 그려진 프레임 수를 목표 프레임과 비교해 느리면 onDrop(새 단계)
 * 들어오고 4초 뒤부터 4초씩 잰다 (셰이더 준비 · 첫 로딩은 빼고). 탭이 숨겨졌거나 창 밖에 있으면 건너뛴다
 */
export class AutoQuality {
  constructor({ enabled, level, onDrop }) {
    this.on = enabled;
    this.level = level;
    this.onDrop = onDrop;
    this.reset(4000); // 처음 4초는 재지 않는다 (셰이더 준비 · 첫 로딩)
    this.slow = 0;
  }
  reset(wait) { this.start = null; this.waitUntil = performance.now() + wait; this.frames = 0; this.want = 0; this.prev = null; }
  /** 실제로 한 장 그릴 때마다: now (performance.now), target 이번 목표 fps */
  frame(now, target) {
    if (!this.on || this.level === 'low') return;
    if (document.hidden || now < this.waitUntil) { this.prev = null; return; }
    if (this.prev != null) {
      const gap = now - this.prev;
      if (gap > 1000) { this.reset(0); return; } // 탭을 다녀왔거나 멈춘 적이 있으면 다시
      this.frames++; this.want += (gap / 1000) * target;
    }
    this.prev = now;
    this.start ??= now;
    if (now - this.start < 4000) return;
    const ratio = this.frames / Math.max(1, this.want); // 목표 대비 실제로 그린 비율
    // 목표의 75% 를 못 그리면 느린 구간. 두 번 연속이면 한 단계 내린다 (잠깐 튄 건 넘긴다)
    this.slow = ratio < 0.75 ? this.slow + 1 : 0;
    this.reset(0);
    if (this.slow >= 2) {
      this.slow = 0;
      const from = this.level;
      this.level = lower(this.level);
      this.reset(3000); // 바꾼 뒤 셰이더를 다시 만드는 동안은 쉬었다가 다시 잰다
      this.onDrop(this.level, from, ratio);
    }
  }
}
