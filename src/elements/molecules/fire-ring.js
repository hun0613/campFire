// 분자: 화로 돌 — 바깥 모닥불 둘레 돌 11개 + 바닥 재. 원자 돌로 조립
// 돌 기울기 · 크기는 opts.seed 로 정해지는 고정 무작위 (화로마다 다르지만, 다른 요소를 바꿔도 돌 모양이 흔들리지 않게)
import * as THREE from 'three';
import { stone, paint } from '../atoms/index.js';
import { mulberry32 } from '../../toon.js';

const STONES = ['stone.base', 'stone.light', 'stone.dark'];
let ashGeo = null;

export function create(opts = {}) {
  const n = opts.count ?? 11, r = opts.radius ?? 0.74, seed = opts.seed ?? 1;
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.userData.ds = 'fire-ring';
  group.userData.args = { count: n, radius: r, seed };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = stone(0.17, STONES[i % 3], { x: Math.cos(a) * r, y: 0.1, z: Math.sin(a) * r, rx: rand() * 3, ry: rand() * 3, shadow: true });
    s.scale.set(1.1 + rand() * 0.3, 0.8 + rand() * 0.3, 1.0 + rand() * 0.3);
    group.add(s);
  }
  const ash = new THREE.Mesh(ashGeo ||= new THREE.CircleGeometry(0.62, 20), paint('ground.ash')); // 바닥 재
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.025;
  group.add(ash);
  return { group, update() {}, setTheme() {}, colliders: [], seats: [] };
}
