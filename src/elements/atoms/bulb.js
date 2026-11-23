// 원자: 전구 — 빛나는 공 (가로등 · 전구 줄 · 랜턴). 조명(PointLight)은 넣지 않는다: 빛은 블룸으로, 실제 조명은 게임의 조명 풀이 켠다
import * as THREE from 'three';
import { shine } from './material.js';
import { shared, place } from './shared.js';

export function bulb(r, key = 'light.warm', at, strength = 3) {
  return place(new THREE.Mesh(shared(`bulb|${r}`, () => new THREE.SphereGeometry(r, 12, 8)), shine(key, strength)), at);
}
export const info = { id: 'part-bulb', name: '전구', desc: '빛나는 공. 가로등 · 전구 줄 · 랜턴', api: "bulb(r, 'light.warm', at, strength)", sample: () => bulb(0.1) };
