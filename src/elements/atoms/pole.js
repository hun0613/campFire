// 원자: 기둥 — 둥근 기둥 (가로등 · 말뚝 · 텐트 기둥). 기준점은 가운데
import * as THREE from 'three';
import { paint } from './material.js';
import { shared, place } from './shared.js';

/** rTop 위 반지름 · rBottom 아래 반지름 · h 높이 · seg 둘레 면 수 */
export function pole(rTop, rBottom, h, key = 'metal.dark', at, seg = 8) {
  return place(new THREE.Mesh(shared(`cyl|${rTop}|${rBottom}|${h}|${seg}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg)), paint(key)), at);
}
export const info = { id: 'part-pole', name: '기둥', desc: '둥근 기둥. 가로등 · 말뚝 · 텐트 기둥', api: "pole(rTop, rBottom, h, 'metal.dark', at, seg)", sample: () => pole(0.06, 0.09, 1.2) };
