// 분자: 장작더미 — 화로에 쌓은 장작 (세운 장작 5개 티피 + 바닥 장작 2개). 원자 기둥 · 통나무로 조립
// 불이 붙으면 타는 색 · 줄어드는 움직임은 게임(fire.js)이 한다: opts.material 로 불 쪽 재질을 받아 쓴다
//   (실험실 · 미리보기에서는 재질 없이 기본 나무색)
import * as THREE from 'three';
import { pole, log } from '../atoms/index.js';

const up = new THREE.Vector3(0, 1, 0);

export function create(opts = {}) {
  const mat = opts.material || 'wood.base';
  const group = new THREE.Group();
  group.userData.ds = 'log-pile';
  group.userData.args = {};
  for (let i = 0; i < 5; i++) { // 세운 장작: 바깥 아래(B)에서 가운데 위(T)로 기댄다
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const B = new THREE.Vector3(Math.cos(a) * 0.4, 0.05, Math.sin(a) * 0.4);
    const T = new THREE.Vector3(Math.cos(a) * 0.04, 0.82, Math.sin(a) * 0.04);
    const m = pole(0.075, 0.09, 1.05, mat, { shadow: true }, 7);
    m.position.copy(B).add(T).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, T.clone().sub(B).normalize());
    group.add(m);
  }
  for (let i = 0; i < 2; i++) group.add(log(0.09, 1.0, mat, { y: 0.1, ry: i * 1.4 + 0.2 }, 7)); // 바닥 장작 (엇갈려 눕힘)
  return { group, update() {}, setTheme() {}, colliders: [], seats: [] };
}
