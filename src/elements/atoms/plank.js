// 원자: 판자 — 납작한 나무판 (앉는 판 · 등받이 · 데크 · 간판). 기준점은 가운데, 1 = 1m
import * as THREE from 'three';
import { paint } from './material.js';
import { shared, place } from './shared.js';

/** w 너비(x) · h 두께(y) · d 깊이(z) · 팔레트 색 · at { x, y, z, rx, ry, rz, shadow, receive } */
export function plank(w, h, d, key = 'wood.base', at) {
  return place(new THREE.Mesh(shared(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), paint(key)), at);
}
export const info = { id: 'part-plank', name: '판자', desc: '납작한 나무판. 앉는 판 · 등받이 · 데크 · 간판', api: "plank(w, h, d, 'wood.base', { x, y, z, rx, ry, rz, shadow })", sample: () => plank(1.2, 0.08, 0.4) };
