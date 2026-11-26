// 분자: 열기구 — 캠핑장 ↔ 불멍 아레나를 오가는 셔틀 (v1.23). 등나무 바구니 + 줄 + 버너 + 세로 줄무늬 풍선
// 요소 틀: create(opts) → { group, update, setTheme, colliders, seats }. 바닥(바구니 밑) y=0, 정면 +z
//   바구니 안 바닥 높이는 FLOOR (게임이 탄 사람을 여기에 세운다). update(t, { burn }) : burn 0~1 버너 불꽃 세기 (날 때 세게)
//   opts.stripes: 줄무늬 색 팔레트 이름 4개
import * as THREE from 'three';
import { pole, color } from '../atoms/index.js';
import { toon, glow, radialTexture } from '../../toon.js';

export const FLOOR = 0.14;       // 바구니 안 바닥
export const BASKET_R = 1.9;     // 바구니 반지름 (v1.23: 여럿이 타게 1.25 → 1.9)
const WALL = 1.1;                // 바구니 벽 높이 (탄 사람 허리께)
const MOUTH_Y = 6.0;             // 풍선 아래 입구 높이
const K = 1.42;                  // 풍선 크기 배율
export const VARIANTS = [
  { stripes: ['balloon.red', 'balloon.sun', 'balloon.sky', 'balloon.cream'], label: '노을 줄무늬' },
  { stripes: ['stage.violet', 'stage.pink', 'balloon.cream', 'stage.cyan'], label: '페스티벌' },
];

/** 풍선 몸통: 옆모습(반지름, 높이)을 돌려 만들고, 세로 줄무늬 · 가운데 띠를 면마다 칠한다 */
function envelope(stripes) {
  const prof = [[0.82, 0], [1.25, 0.5], [2.4, 1.6], [3.7, 3.2], [4.45, 4.9], [4.6, 6.0], [4.35, 7.2], [3.6, 8.3], [2.4, 9.1], [1.0, 9.5], [0, 9.6]]
    .map(([r, y]) => new THREE.Vector2(r * K, y * K));
  const SEG = 24;
  const geo = new THREE.LatheGeometry(prof, SEG).toNonIndexed();
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const cols = stripes.map((k) => new THREE.Color(color(k)));
  const band = new THREE.Color(color('balloon.cream'));
  for (let i = 0; i < pos.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(i + k); y += pos.getY(i + k); z += pos.getZ(i + k); }
    x /= 3; y /= 3; z /= 3;
    const a = (Math.atan2(x, z) / (Math.PI * 2) + 1) % 1;
    let c = cols[Math.floor(a * SEG) % cols.length];
    if (y > 4.95 * K && y < 5.75 * K) c = band; // 가운데 띠
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon('#ffffff', { vertexColors: true }));
  m.position.y = MOUTH_Y;
  m.castShadow = true;
  return m;
}

export function create(opts = {}) {
  const stripes = opts.stripes || VARIANTS[0].stripes;
  const group = new THREE.Group();
  group.userData.ds = 'hot-air-balloon';
  group.userData.args = { stripes };

  // 바구니: 등나무 통 (안이 보이게 위는 열려 있다) + 가죽 테 + 바닥
  const wicker = toon(color('balloon.wicker'), { side: THREE.DoubleSide });
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(BASKET_R, BASKET_R * 0.94, WALL, 24, 1, true), wicker);
  basket.position.y = WALL / 2; basket.castShadow = true;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(BASKET_R * 0.94, BASKET_R * 0.94, 0.1, 24), toon(color('balloon.rim'))); // 막힌 바닥 (아래에서 올려다봐도 뚫려 보이지 않게)
  floor.position.y = FLOOR - 0.07;
  const rimMat = toon(color('balloon.rim'));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BASKET_R, 0.08, 6, 32), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = WALL;
  const foot = new THREE.Mesh(new THREE.TorusGeometry(BASKET_R * 0.95, 0.07, 6, 32), rimMat);
  foot.rotation.x = Math.PI / 2; foot.position.y = 0.06;
  // 등나무 짜임: 가로 줄 몇 개
  for (const y of [0.37, 0.74]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(BASKET_R * (1 - y * 0.05) + 0.01, 0.028, 4, 32), rimMat);
    r.rotation.x = Math.PI / 2; r.position.y = y; group.add(r);
  }
  group.add(basket, floor, rim, foot);

  // 줄: 바구니 테에서 풍선 입구로 8개
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const A = new THREE.Vector3(Math.sin(a) * BASKET_R * 0.97, WALL, Math.cos(a) * BASKET_R * 0.97);
    const B = new THREE.Vector3(Math.sin(a) * 0.82 * K, MOUTH_Y + 0.05, Math.cos(a) * 0.82 * K);
    const rope = pole(0.018, 0.018, A.distanceTo(B), 'balloon.rim', {}, 4);
    rope.position.copy(A).add(B).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
    group.add(rope);
  }
  // 버너: 입구 아래 쇠 틀 + 불꽃 (빛나는 공 + 빛무리)
  group.add(pole(0.42, 0.46, 0.32, 'metal.dark', { y: MOUTH_Y - 1.1 }, 12)); // 버너 틀
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; group.add(pole(0.025, 0.025, MOUTH_Y - 1.3 - WALL, 'metal.dark', { x: Math.sin(a) * 0.4, y: (MOUTH_Y - 1.3 + WALL) / 2, z: Math.cos(a) * 0.4 }, 4)); } // 버너를 받치는 쇠막대
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), glow(color('balloon.flame'), 3.2));
  flame.position.y = MOUTH_Y - 0.7;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: color('balloon.flame'), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = MOUTH_Y; halo.scale.setScalar(4);
  group.add(flame, halo);

  // 풍선 아래 치마 + 몸통
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.84 * K, 1.0 * K, 1.1, 20, 1, true), toon(color('balloon.skirt'), { side: THREE.DoubleSide }));
  skirt.position.y = MOUTH_Y - 0.5;
  group.add(skirt, envelope(stripes));
  // 안에서 버너 불빛을 받아 은은히 빛나는 풍선 속 (밤에도 풍선이 보이게)
  const inner = new THREE.Mesh(new THREE.SphereGeometry(3.9 * K, 16, 12), new THREE.MeshBasicMaterial({ color: color('balloon.flame'), transparent: true, opacity: 0.0, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  inner.position.y = MOUTH_Y + 5.6 * K;
  group.add(inner);

  return {
    group,
    floorY: FLOOR,
    update(t, { burn = 0.2 } = {}) {
      const f = 0.75 + Math.sin(t * 17) * 0.12 + Math.sin(t * 9.3) * 0.13;
      const k = 0.25 + burn * 0.75;
      flame.scale.set(1, 0.8 + k * 1.6 * f, 1);
      halo.material.opacity = (0.25 + 0.5 * k) * f;
      inner.material.opacity = 0.04 + 0.1 * k * f;
    },
    setTheme() {},
    colliders: [{ x: 0, z: 0, r: BASKET_R + 0.25 }],
    seats: [],
  };
}
