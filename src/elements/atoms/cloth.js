// 원자: 천 — 얇은 천 한 장 (차양 · 텐트 천 · 깃발). 앞뒤 모두 보인다
import * as THREE from 'three';
import { paint } from './material.js';
import { shared, place } from './shared.js';

export function cloth(w, h, key = 'cloth.cream', at) {
  return place(new THREE.Mesh(shared(`cloth|${w}|${h}`, () => new THREE.PlaneGeometry(w, h)), paint(key, { side: THREE.DoubleSide })), at);
}
export const info = { id: 'part-cloth', name: '천', desc: '얇은 천. 차양 · 텐트 천 · 깃발', api: "cloth(w, h, 'cloth.cream', at)", sample: () => cloth(0.9, 0.6) };
