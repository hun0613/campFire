// 분자: 나무 벤치 — 원자 부품 판자 · 다리로 조립 (「무엇」만. 「어디」에 몇 개 놓을지는 world.js · trail.js · residents.js 가 정한다)
// 요소 틀: create(opts) → { group, update(dt, t), setTheme(name), colliders, seats }
//   group: 바닥 y=0, 1 = 1m, 앉은 사람이 보는 쪽이 +z (등받이는 -z)
//   colliders: 요소 기준 부딪힘 원 [{ x, z, r }] — 놓는 쪽이 위치 · 회전에 맞춰 붙인다
//   seats: 요소 기준 앉는 자리 (지금은 앉는 자리를 config 의 LOUNGE_SEATS 가 정해서 비워 둠)
import * as THREE from 'three';
import { plank, leg } from '../atoms/index.js';

// 원자 부품(판자 · 다리)으로 조립한다. 색은 팔레트 이름
const add = (g, m) => { g.add(m); return m; };

/** 모양 4가지. 모두 「앉는 판 + 다리(받침) + 등받이(있으면)」 */
const STYLES = {
  // 광장 가장자리 벤치: 밝은 원목, 옆판 다리, 그림자를 드리우고 받는다
  plaza(g) {
    const sh = { shadow: true, receive: true };
    add(g, plank(2.0, 0.09, 0.55, 'wood.light', { y: 0.47, ...sh }));
    add(g, plank(2.0, 0.42, 0.08, 'wood.light', { y: 0.78, z: -0.27, rx: -0.12, ...sh }));
    for (const s of [-0.85, 0.85]) add(g, leg(0.1, 0.45, 0.5, 'wood.dark', { x: s, y: 0.22, ...sh }));
    return [{ x: 0, z: 0, r: 1.0 }];
  },
  // 숲길 벤치 (호숫가 데크): 등받이 + 네 다리
  trail(g) {
    add(g, plank(1.8, 0.1, 0.5, 'wood.base', { y: 0.45, shadow: true }));
    add(g, plank(1.8, 0.45, 0.08, 'wood.base', { y: 0.78, z: -0.24, rx: -0.12 }));
    for (const sx of [-0.75, 0.75]) for (const sz of [-0.18, 0.18]) add(g, leg(0.08, 0.45, 0.08, 'wood.dark', { x: sx, y: 0.22, z: sz }));
    return [];
  },
  // 노을 언덕 벤치: 등받이 없는 긴 판 + 비스듬한 버팀대. 노을 앞 실루엣이라 어두운 나무
  long(g, { length = 2.6 }) {
    add(g, plank(length, 0.09, 0.42, 'wood.old', { y: 0.5, shadow: true }));
    for (const sx of [-length / 2 + 0.3, length / 2 - 0.3]) {
      for (const sz of [-0.15, 0.15]) add(g, leg(0.08, 0.48, 0.08, 'wood.oldDark', { x: sx, y: 0.24, z: sz }));
      add(g, leg(0.06, 0.62, 0.05, 'wood.oldDark', { x: sx + (sx < 0 ? 0.24 : -0.24), y: 0.25, rz: sx < 0 ? -0.75 : 0.75 })); // 비스듬한 버팀대
    }
    return [{ x: 0, z: 0, r: 0.25 }];
  },
  // 주민이 앉는 작은 벤치 (핑크뮬리 들판의 서연)
  small(g) {
    add(g, plank(1.3, 0.07, 0.38, 'wood.base', { y: 0.42, z: -0.06 }));
    for (const x of [-0.55, 0.55]) add(g, leg(0.08, 0.42, 0.32, 'wood.dark', { x, y: 0.21, z: -0.06 }));
    add(g, plank(1.3, 0.28, 0.05, 'wood.base', { y: 0.68, z: -0.27 }));
    return [];
  },
};

/**
 * @param {{ style?: 'plaza'|'trail'|'long'|'small', length?: number, theme?: string, lowSpec?: boolean }} opts
 */
export function create(opts = {}) {
  const group = new THREE.Group();
  group.userData.ds = 'bench'; // 디자인 시스템 이름표
  group.userData.args = { style: opts.style, length: opts.length }; // 실험실이 바꿔 끼울 때 같은 설정으로 다시 만든다
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
