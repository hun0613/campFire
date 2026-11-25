// 분자: 캠핑 의자 — 텐트 앞 화로 둘레 접이식 의자. 원자 판자(천 · 팔걸이) · 기둥(다리)으로 조립
// 요소 틀: create(opts) → { group, update, setTheme, colliders, seats }. 바닥 y=0, 정면(앉는 사람이 보는 쪽) +z
//   opts.fabric: 천 색 팔레트 이름 (기본 fabric.red). 게임은 자리마다 FABRICS 를 차례로 쓴다
import * as THREE from 'three';
import { plank, pole } from '../atoms/index.js';

export const FABRICS = ['fabric.red', 'fabric.blue', 'fabric.yellow', 'fabric.green', 'fabric.purple'];
export const VARIANTS = FABRICS.map((f, i) => ({ fabric: f, label: ['빨강', '파랑', '노랑', '초록', '보라'][i] }));

export function create(opts = {}) {
  const fabric = opts.fabric || FABRICS[0];
  const group = new THREE.Group();
  group.userData.ds = 'camp-chair'; // 디자인 시스템 이름표
  group.userData.args = { fabric };
  const sh = { shadow: true };
  group.add(plank(0.55, 0.06, 0.48, fabric, { y: 0.4, ...sh })); // 앉는 천
  group.add(plank(0.55, 0.55, 0.05, fabric, { y: 0.66, z: -0.26, rx: -0.2, ...sh })); // 등받이 천
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) group.add(pole(0.02, 0.02, 0.45, 'metal.dark', { x: sx * 0.25, y: 0.2, z: sz * 0.2, rx: sz * 0.25, ...sh }, 5)); // 비스듬한 다리
    group.add(plank(0.05, 0.04, 0.45, 'metal.dark', { x: sx * 0.29, y: 0.6, z: -0.02, ...sh })); // 팔걸이
  }
  return { group, update() {}, setTheme() {}, colliders: [], seats: [] };
}
