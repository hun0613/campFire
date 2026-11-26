// 🙌 아레나 관객 무리 (v1.23): 무대 앞 스탠딩 구역은 빽빽하게, 객석 모닥불 사이 곳곳에도 — 약 100명
// - 캐릭터 한 명 한 명이 아니라 머리 · 머리카락 · 몸 · 다리 · 팔 · 응원봉을 인스턴스로 묶어 그린다 (그리기 6번)
// - 곡이 나오면 팔을 흔들고 깡충깡충 · 응원봉을 흔들고, 없으면 살짝 몸만 흔든다 (박자는 느긋하게)
import * as THREE from 'three';
import { toon, glow, mulberry32 } from './toon.js';
import { ARENA, ARENA_PITS } from '../shared/config.js';

const SKIN = ['#ffe0c7', '#f6c9a0', '#dba377', '#a8714a'];
const HAIR = ['#5a3825', '#2b2220', '#c9772f', '#e8c35c', '#e0605a', '#8a63d8', '#4a86d8', '#f2a6c6'];
const SHIRT = ['#e65a45', '#f2a93b', '#5aa36b', '#3f8fd1', '#8b5cc7', '#f07fa8', '#f4efe1', '#3a3f4b', '#e0b43a'];
const PANTS = ['#3d4a6b', '#6b5a45', '#2f3b2f', '#e8e0cc', '#2a2a33'];

export function createArenaFans(parent, avoid = []) {
  const rnd = mulberry32(330);
  const stage = { x: ARENA.stage.x, z: ARENA.stage.z };
  const people = [];
  const ok = (x, z) => ARENA_PITS.every((p) => Math.hypot(x - p.x, z - p.z) > 3.9) // 모닥불 · 의자 자리는 비운다
    && avoid.every((a) => Math.hypot(x - a.x, z - a.z) > (a.r ?? 1.4)) // 부스 · 창고지기 · 승강장 · 이름 있는 사람 자리
    && !(Math.abs(x) < 2.6 && z > 327) // 승강장 가는 흙길
    && people.every((q) => Math.hypot(x - q.x, z - q.z) > 0.85)
    && x > ARENA.bounds.minX + 1 && x < ARENA.bounds.maxX - 1 && z < ARENA.bounds.maxZ - 12;
  // 무대 앞 스탠딩: 빽빽하게
  for (let tries = 0; people.length < 64 && tries < 4000; tries++) {
    const x = (rnd() - 0.5) * 30, z = ARENA.bounds.minZ + 0.6 + rnd() * 6.4;
    if (ok(x, z)) people.push({ x, z });
  }
  // 객석 곳곳: 모닥불 사이 · 옆 무리
  for (let tries = 0; people.length < 100 && tries < 6000; tries++) {
    const x = (rnd() - 0.5) * 70, z = 311 + rnd() * 32;
    if (ok(x, z)) people.push({ x, z });
  }
  const N = people.length;
  people.forEach((p) => {
    p.ry = Math.atan2(stage.x - p.x, stage.z + 4 - p.z) + (rnd() - 0.5) * 0.3; // 무대를 본다
    p.s = 0.88 + rnd() * 0.22;
    p.mode = rnd() < 0.45 ? 'both' : rnd() < 0.6 ? 'one' : 'clap';  // 두 팔 흔들기 · 한 팔 · 박수
    p.stick = rnd() < 0.35;                                           // 응원봉
    p.ph = rnd() * Math.PI * 2;
    p.hop = 0.6 + rnd() * 0.6;
  });

  const mk = (geo, mat, n = N) => { const m = new THREE.InstancedMesh(geo, mat, n); m.userData.ds = 'arena-fans'; m.frustumCulled = false; parent.add(m); return m; };
  const white = toon('#ffffff');
  const head = mk(new THREE.SphereGeometry(0.3, 12, 9), white);
  const hair = mk(new THREE.SphereGeometry(0.315, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), white);
  const body = mk(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 10), white);
  const legs = mk(new THREE.CylinderGeometry(0.2, 0.19, 0.32, 10), white);
  const armGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.42, 6); armGeo.translate(0, -0.21, 0); // 어깨가 기준점
  const arms = mk(armGeo, white, N * 2);
  const sticks = mk(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6).translate(0, -0.55, 0), glow('#ffcf8a', 2.4), N);
  // 🌦️ 테마 소품: 비 → 우산 (둘 중 하나꼴), 눈 → 털모자, 크리스마스 → 산타 모자
  const umb = mk(new THREE.ConeGeometry(0.62, 0.3, 8, 1, true), toon('#ffffff', { side: THREE.DoubleSide }));
  const umbPole = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), toon('#3b3229'));
  const hat = mk(new THREE.SphereGeometry(0.33, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), toon('#ffffff'));
  const santa = mk(new THREE.ConeGeometry(0.26, 0.5, 10), toon('#d8283b'));
  const brim = mk(new THREE.TorusGeometry(0.29, 0.06, 6, 14), toon('#f7f3ec'));
  const UMB = ['#2f6fd8', '#f2c230', '#e65a45', '#5aa36b', '#8b5cc7', '#f4efe1'], HAT = ['#e65a45', '#3f8fd1', '#f2a93b', '#5aa36b', '#f4efe1', '#8b5cc7'];
  people.forEach((p, i) => { umb.setColorAt(i, new THREE.Color(UMB[i % UMB.length])); hat.setColorAt(i, new THREE.Color(HAT[(i * 7) % HAT.length])); p.umb = i % 2 === 0; });
  umb.instanceColor.needsUpdate = true; hat.instanceColor.needsUpdate = true;
  let outfit = null;
  const col = new THREE.Color();
  people.forEach((p, i) => {
    head.setColorAt(i, col.set(SKIN[i % SKIN.length]));
    hair.setColorAt(i, col.set(HAIR[Math.floor(rnd() * HAIR.length)]));
    const sh = SHIRT[Math.floor(rnd() * SHIRT.length)];
    body.setColorAt(i, col.set(sh));
    legs.setColorAt(i, col.set(PANTS[Math.floor(rnd() * PANTS.length)]));
    arms.setColorAt(i * 2, col.set(sh)); arms.setColorAt(i * 2 + 1, col.set(sh));
  });
  for (const m of [head, hair, body, legs, arms]) m.instanceColor.needsUpdate = true;
  const colliders = people.map((p) => ({ x: p.x, z: p.z, r: 0.38 }));

  const M = new THREE.Matrix4(), base = new THREE.Matrix4(), local = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let k = 0; // 곡이 나오는 정도 (천천히 따라간다)
  function place(mesh, i, x, y, z, rx = 0, rz = 0) { // 사람 기준(base) 안의 자리
    local.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, 0, rz)), one);
    mesh.setMatrixAt(i, M.multiplyMatrices(base, local));
  }
  return {
    colliders, count: N,
    /** 🌦️ 테마 옷 (캠핑장 캐릭터와 같은 기준): 'raincoat' 우산 · 'puffer' 털모자 · 'santa' 산타 모자 */
    setTheme(th) { outfit = th.outfit || null; },
    update(dt, t, playing) {
      if (!parent.visible) return;
      k += ((playing ? 1 : 0) - k) * Math.min(1, dt * 0.8);
      const beat = t * Math.PI * 2 * 0.95; // 1초에 한 번 남짓 (느긋하게)
      people.forEach((p, i) => {
        const b = beat + p.ph;
        const jump = k * Math.max(0, Math.sin(b * p.hop)) * 0.16 + (1 - k) * 0.0;
        const sway = Math.sin(t * 0.9 + p.ph) * (0.04 + 0.08 * k);
        base.compose(v.set(p.x, jump, p.z), q.setFromEuler(e.set(0, p.ry, sway)), sc.setScalar(p.s));
        place(legs, i, 0, 0.16, 0);
        place(body, i, 0, 0.57, 0);
        place(head, i, 0, 1.12, 0, 0.05 * Math.sin(b));
        place(hair, i, 0, 1.15, -0.02);
        // 팔: 곡이 나오면 들어 흔든다 (z 회전 = 옆으로 벌림, x 회전 = 앞으로 듦)
        const wave = Math.sin(b * 0.5) * 0.35;
        let lx = 0, lz = -0.15, rxx = 0, rz = 0.15;
        if (p.mode === 'both') { lz = -0.15 - k * (2.5 + wave); rz = 0.15 + k * (2.5 - wave); }
        else if (p.mode === 'one') { rz = 0.15 + k * (2.7 + wave); }
        else { lx = rxx = -k * 1.2; lz = -0.15 + k * (0.55 + 0.3 * Math.abs(Math.sin(b * 2))); rz = -lz; } // 박수
        place(arms, i * 2, -0.25, 0.78, 0, lx, lz);
        place(arms, i * 2 + 1, 0.25, 0.78, 0, rxx, rz);
        if (p.stick && k > 0.05) place(sticks, i, 0.25, 0.78, 0, rxx, rz); else sticks.setMatrixAt(i, zero);
        // 테마 소품 (우산은 머리 위에 받쳐 든다 — 우산 든 사람은 팔을 덜 든다)
        if (outfit === 'raincoat' && p.umb) { place(umb, i, 0.1, 1.95, 0.05, 0.08, -0.05); place(umbPole, i, 0.12, 1.45, 0.05); } else { umb.setMatrixAt(i, zero); umbPole.setMatrixAt(i, zero); }
        if (outfit === 'puffer') place(hat, i, 0, 1.2, -0.01); else hat.setMatrixAt(i, zero);
        if (outfit === 'santa') { place(santa, i, 0, 1.55, -0.04, -0.25); place(brim, i, 0, 1.33, -0.01, Math.PI / 2); } else { santa.setMatrixAt(i, zero); brim.setMatrixAt(i, zero); }
      });
      for (const m of [head, hair, body, legs, arms, sticks, umb, umbPole, hat, santa, brim]) m.instanceMatrix.needsUpdate = true;
    },
  };
}
