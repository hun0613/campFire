// 요소: 나무 벤치 (「무엇」만. 「어디」에 몇 개 놓을지는 world.js · trail.js · residents.js 가 정한다)
// 요소 틀: create(opts) → { group, update(dt, t), setTheme(name), colliders, seats }
//   group: 바닥 y=0, 1 = 1m, 앉은 사람이 보는 쪽이 +z (등받이는 -z)
//   colliders: 요소 기준 부딪힘 원 [{ x, z, r }] — 놓는 쪽이 위치 · 회전에 맞춰 붙인다
//   seats: 요소 기준 앉는 자리 (지금은 앉는 자리를 config 의 LOUNGE_SEATS 가 정해서 비워 둠)
import * as THREE from 'three';
import { toon } from '../toon.js';
import { PALETTE } from '../palette.js';

const W = PALETTE.wood;
const geoCache = new Map(); // 같은 모양 벤치를 여러 개 놓을 때 도형을 나눠 쓴다
const geo = (w, h, d) => {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
};
const part = (g, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(geo(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };

/** 모양 4가지. 모두 「앉는 판 + 다리(받침) + 등받이(있으면)」 */
const STYLES = {
  // 광장 가장자리 벤치: 밝은 원목, 옆판 다리, 그림자를 드리우고 받는다
  plaza(g) {
    const seat = toon(W.light), leg = toon(W.dark);
    part(g, 2.0, 0.09, 0.55, seat, 0, 0.47, 0);
    part(g, 2.0, 0.42, 0.08, seat, 0, 0.78, -0.27).rotation.x = -0.12;
    for (const s of [-0.85, 0.85]) part(g, 0.1, 0.45, 0.5, leg, s, 0.22, 0);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return [{ x: 0, z: 0, r: 1.0 }];
  },
  // 숲길 벤치 (호숫가 데크): 등받이 + 네 다리
  trail(g) {
    const wood = toon(W.base), leg = toon(W.dark);
    part(g, 1.8, 0.1, 0.5, wood, 0, 0.45, 0).castShadow = true;
    part(g, 1.8, 0.45, 0.08, wood, 0, 0.78, -0.24).rotation.x = -0.12;
    for (const sx of [-0.75, 0.75]) for (const sz of [-0.18, 0.18]) part(g, 0.08, 0.45, 0.08, leg, sx, 0.22, sz);
    return [];
  },
  // 노을 언덕 벤치: 등받이 없는 긴 판 + 비스듬한 버팀대. 노을 앞 실루엣이라 어두운 나무
  long(g, { length = 2.6 }) {
    const wood = toon(W.old), dark = toon(W.oldDark);
    part(g, length, 0.09, 0.42, wood, 0, 0.5, 0).castShadow = true;
    for (const sx of [-length / 2 + 0.3, length / 2 - 0.3]) {
      for (const sz of [-0.15, 0.15]) part(g, 0.08, 0.48, 0.08, dark, sx, 0.24, sz);
      part(g, 0.06, 0.62, 0.05, dark, sx + (sx < 0 ? 0.24 : -0.24), 0.25, 0).rotation.z = sx < 0 ? -0.75 : 0.75;
    }
    return [{ x: 0, z: 0, r: 0.25 }];
  },
  // 주민이 앉는 작은 벤치 (핑크뮬리 들판의 서연)
  small(g) {
    const wood = toon(W.base), dark = toon(W.dark);
    part(g, 1.3, 0.07, 0.38, wood, 0, 0.42, -0.06);
    for (const x of [-0.55, 0.55]) part(g, 0.08, 0.42, 0.32, dark, x, 0.21, -0.06);
    part(g, 1.3, 0.28, 0.05, wood, 0, 0.68, -0.27);
    return [];
  },
};

/**
 * @param {{ style?: 'plaza'|'trail'|'long'|'small', length?: number, theme?: string, lowSpec?: boolean }} opts
 */
export function create(opts = {}) {
  const group = new THREE.Group();
  group.userData.ds = 'bench'; // 디자인 시스템 이름표
  group.userData.style = { plaza: '광장', trail: '숲길', long: '노을 언덕', small: '주민용' }[opts.style || 'trail']; // 실험실에서 모양 이름
  const colliders = STYLES[opts.style || 'trail'](group, opts);
  return {
    group,
    update() {}, // 움직임 없음
    setTheme() {}, // 비 · 눈 · 크리스마스에도 모습 그대로
    colliders,
    seats: [],
  };
}
