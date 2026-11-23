// 원자: 통나무 — 눕힌 둥근 나무 (장작 · 통나무 의자). 길이 방향이 x, 기준점은 가운데
import * as THREE from 'three';
import { paint } from './material.js';
import { shared, place } from './shared.js';

export function log(r, len, key = 'wood.base', at, seg = 8) {
  return place(new THREE.Mesh(shared(`log|${r}|${len}|${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2)), paint(key)), at);
}
export const info = { id: 'part-log', name: '통나무', desc: '눕힌 둥근 나무. 장작 · 통나무 의자', api: "log(r, len, 'wood.base', at, seg)", sample: () => log(0.12, 0.8) };
