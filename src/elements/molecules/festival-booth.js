// 분자: 페스티벌 부스 — 줄무늬 차양을 얹은 나무 매대 + 위 간판 + 전구 줄 (v1.23)
// 요소 틀: create(opts) → { group, update, setTheme, colliders, seats }. 바닥 y=0, 정면(손님이 서는 쪽) +z
//   opts.variant: 'apply' (아레나 🎤 무대 신청 부스) | 'powder' (아레나 ✦ 페스티벌 가루 부스)
import * as THREE from 'three';
import { plank, pole, bulb, color } from '../atoms/index.js';
import { textTexture } from '../../toon.js';

export const VARIANTS = [
  { variant: 'apply', label: '무대 신청', sign: '🎤 무대 신청', stripes: ['booth.navy', 'balloon.cream'], ink: '#2f4a7a' },
  { variant: 'powder', label: '페스티벌 가루', sign: '✦ 페스티벌 가루', stripes: ['booth.berry', 'balloon.cream'], ink: '#a8427a' },
];

export function create(opts = {}) {
  const v = VARIANTS.find((x) => x.variant === opts.variant) || VARIANTS[0];
  const group = new THREE.Group();
  group.userData.ds = 'festival-booth';
  group.userData.args = { variant: v.variant };
  const sh = { shadow: true };
  const W = 2.8, D = 1.3;

  // 매대: 앞판 · 위판 · 옆판
  group.add(plank(W, 1.0, 0.08, 'wood.light', { y: 0.5, z: D / 2, ...sh }));
  group.add(plank(W + 0.2, 0.08, 0.6, 'wood.base', { y: 1.04, z: D / 2 - 0.15, ...sh }));
  for (const sx of [-1, 1]) group.add(plank(0.08, 1.0, D, 'wood.base', { x: sx * W / 2, y: 0.5, ...sh }));
  group.add(plank(W, 1.0, 0.08, 'wood.dark', { y: 0.5, z: -D / 2 })); // 뒤판
  // 매대 앞에 줄무늬 띠
  for (let i = 0; i < 7; i++) group.add(plank(W / 7, 0.22, 0.02, v.stripes[i % 2], { x: -W / 2 + W / 14 + (i * W) / 7, y: 0.86, z: D / 2 + 0.05 }));
  // 기둥 4개
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(pole(0.05, 0.05, 2.5, 'wood.dark', { x: sx * (W / 2 - 0.05), y: 1.25, z: sz * (D / 2 - 0.05), ...sh }, 6));
  // 줄무늬 차양 (앞으로 기울어진 지붕) + 앞 물결 끝단
  const N = 8;
  for (let i = 0; i < N; i++) {
    const x = -W / 2 - 0.15 + ((i + 0.5) * (W + 0.3)) / N;
    group.add(plank((W + 0.3) / N + 0.005, 0.05, D + 0.7, v.stripes[i % 2], { x, y: 2.58, z: 0.2, rx: 0.22, ...sh }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry((W + 0.3) / N / 2, 0.24, 3), group.children.at(-1).material);
    tip.rotation.x = Math.PI; tip.position.set(x, 2.38, D / 2 + 0.58);
    group.add(tip);
  }
  // 간판 (차양 위)
  const tex = textTexture(v.sign, { w: 512, h: 128, size: 58, bg: color('balloon.cream'), fg: v.ink, border: v.ink });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshToonMaterial({ map: tex }));
  sign.position.set(0, 3.05, 0.0);
  group.add(sign, plank(2.5, 0.68, 0.06, 'wood.dark', { y: 3.05, z: -0.04 }));
  // 차양 아래 전구 줄
  for (let i = 0; i < 6; i++) group.add(bulb(0.055, 'light.warm', { x: -1.15 + i * 0.46, y: 2.25 + Math.abs(Math.sin(i * 1.3)) * 0.05, z: D / 2 + 0.38 }, 2.6));
  // 매대 위 소품: 'apply' 는 신청서 · 펜, 'powder' 는 빛나는 가루병
  if (v.variant === 'powder') {
    ['stage.pink', 'stage.violet', 'stage.cyan', 'stage.amber'].forEach((k, i) => group.add(bulb(0.09, k, { x: -0.9 + i * 0.6, y: 1.17, z: D / 2 - 0.15 }, 2.2)));
  } else {
    group.add(plank(0.5, 0.01, 0.36, 'balloon.cream', { x: -0.5, y: 1.09, z: D / 2 - 0.15, ry: 0.2 }));
    group.add(plank(0.5, 0.01, 0.36, 'balloon.cream', { x: 0.2, y: 1.09, z: D / 2 - 0.12, ry: -0.1 }));
    group.add(pole(0.012, 0.012, 0.3, 'metal.dark', { x: 0.75, y: 1.1, z: D / 2 - 0.1, rz: 1.4 }, 4));
  }
  return { group, update() {}, setTheme() {}, colliders: [{ x: -0.75, z: 0, r: 0.95 }, { x: 0.75, z: 0, r: 0.95 }], seats: [] };
}
