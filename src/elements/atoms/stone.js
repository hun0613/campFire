// 원자: 돌 — 각진 돌 (화로 돌 · 연못 바위). 기준점은 가운데
import * as THREE from 'three';
import { paint } from './material.js';
import { shared, place } from './shared.js';

export function stone(r, key = 'stone.base', at) {
  return place(new THREE.Mesh(shared(`stone|${r}`, () => new THREE.DodecahedronGeometry(r, 0)), paint(key)), at);
}
export const info = { id: 'part-stone', name: '돌', desc: '각진 돌. 화로 돌 · 연못 바위', api: "stone(r, 'stone.base', at)", sample: () => stone(0.22) };
