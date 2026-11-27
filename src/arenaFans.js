// 🙌 아레나 관객 무리 (v1.23): 무대 앞 스탠딩 구역은 빽빽하게, 객석 모닥불 사이 곳곳에도 — 약 100명
// - 캐릭터 한 명 한 명이 아니라 머리 · 머리카락 · 몸 · 다리 · 팔 · 응원봉을 인스턴스로 묶어 그린다 (그리기 6번)
// - 곡이 나오면 팔을 흔들고 깡충깡충 · 응원봉을 흔든다 (박자는 느긋하게)
// - 곡이 없을 때(v1.23.4): 사람마다 몇 초씩 다른 일을 한다 — 대기 음악에 리듬 타기 · 옆 사람과 수다 · 두리번 · 휴대폰으로 사진 · 손 흔들기 · 가벼운 박수 · 깡충 · 기지개 · 주먹 환호 (바뀔 땐 부드럽게)
import * as THREE from 'three';
import { toon, glow, mulberry32 } from './toon.js';
import { ARENA, ARENA_PITS } from '../shared/config.js';

const IDLE = ['groove', 'groove', 'groove', 'chat', 'chat', 'look', 'phone', 'wave', 'clap', 'hop', 'stretch', 'cheer']; // 곡이 없을 때 할 일 (리듬 타기 · 수다가 가장 흔하다)
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
        // ── 곡이 나올 때 자세 (예전 그대로)
        const wave = Math.sin(b * 0.5) * 0.35;
        let sLx = 0, sLz = -0.15, sRx = 0, sRz = 0.15;
        if (p.mode === 'both') { sLz = -0.15 - (2.5 + wave); sRz = 0.15 + (2.5 - wave); }
        else if (p.mode === 'one') { sRz = 0.15 + (2.7 + wave); }
        else { sLx = sRx = -1.2; sLz = -0.15 + (0.55 + 0.3 * Math.abs(Math.sin(b * 2))); sRz = -sLz; } // 박수
        const sJump = Math.max(0, Math.sin(b * p.hop)) * 0.16;
        // ── 곡이 없을 때: 몇 초마다 할 일을 바꾼다
        p.actT = (p.actT ?? Math.random() * 4) - dt;
        if (p.actT <= 0) { p.act = IDLE[(Math.random() * IDLE.length) | 0]; p.actT = 2.5 + Math.random() * 4.5; p.side = Math.random() < 0.5 ? -1 : 1; }
        const a = p.act || 'groove', tt = t + p.ph, gb = t * Math.PI * 2 * 1.6 + p.ph; // 대기 음악 박자 (느긋하게)
        let iLx = 0, iLz = -0.15, iRx = 0, iRz = 0.15, iRy = 0, iY = 0, iNod = 0, iSway = Math.sin(tt * 0.9) * 0.04;
        if (a === 'groove') { iY = Math.max(0, Math.sin(gb)) * 0.035; iNod = 0.12 * Math.max(0, Math.sin(gb)); iSway = Math.sin(gb * 0.5) * 0.07; iLz = -0.3; iRz = 0.3; }
        else if (a === 'chat') { iRy = p.side * 0.9; iRx = -0.7 - 0.25 * Math.sin(tt * 3.1); iRz = 0.35 + 0.15 * Math.sin(tt * 2.3); iNod = 0.08 * Math.sin(tt * 4); }
        else if (a === 'look') { iRy = Math.sin(tt * 0.8) * 0.8; iNod = -0.12; }
        else if (a === 'phone') { iRx = -2.2; iRz = 0.25; iLx = -1.9; iLz = -0.35; iNod = -0.15; } // 두 손으로 휴대폰을 들고 무대를 찍는다
        else if (a === 'wave') { iRz = 2.6 + Math.sin(tt * 5) * 0.4; iY = 0.01; }
        else if (a === 'clap') { iLx = iRx = -1.1; iLz = -0.15 + 0.5 + 0.25 * Math.abs(Math.sin(tt * 4)); iRz = -iLz; }
        else if (a === 'hop') { iY = Math.max(0, Math.sin(tt * 6)) * 0.13; iLz = -0.6; iRz = 0.6; }
        else if (a === 'stretch') { const k2 = 0.5 + 0.5 * Math.sin(tt * 0.9); iLz = -0.3 - 2.4 * k2; iRz = 0.3 + 2.4 * k2; iNod = -0.2 * k2; }
        else if (a === 'cheer') { iRz = 2.3 + Math.max(0, Math.sin(tt * 4.2)) * 0.5; iRx = -0.3; iY = Math.max(0, Math.sin(tt * 4.2)) * 0.05; }
        // ── 둘을 곡이 나오는 정도(k)로 섞고, 사람마다 천천히 따라간다 (갑자기 휙 바뀌지 않게)
        const mix = (x, y) => x * (1 - k) + y * k;
        const C = (p.cur = p.cur || { lx: 0, lz: -0.15, rx: 0, rz: 0.15, ry: 0, y: 0, nod: 0 }), f = Math.min(1, dt * 5);
        C.lx += (mix(iLx, sLx) - C.lx) * f; C.lz += (mix(iLz, sLz) - C.lz) * f;
        C.rx += (mix(iRx, sRx) - C.rx) * f; C.rz += (mix(iRz, sRz) - C.rz) * f;
        C.ry += (mix(iRy, 0) - C.ry) * Math.min(1, dt * 2.5); C.nod += (mix(iNod, 0.05 * Math.sin(b)) - C.nod) * f;
        const jump = mix(iY, sJump);
        const sway = mix(iSway, Math.sin(t * 0.9 + p.ph) * 0.12);
        base.compose(v.set(p.x, jump, p.z), q.setFromEuler(e.set(0, p.ry + C.ry, sway)), sc.setScalar(p.s));
        place(legs, i, 0, 0.16, 0);
        place(body, i, 0, 0.57, 0);
        place(head, i, 0, 1.12, 0, C.nod);
        place(hair, i, 0, 1.15, -0.02);
        // 팔 (z 회전 = 옆으로 벌림, x 회전 = 앞으로 듦)
        place(arms, i * 2, -0.25, 0.78, 0, C.lx, C.lz);
        place(arms, i * 2 + 1, 0.25, 0.78, 0, C.rx, C.rz);
        if (p.stick && k > 0.05) place(sticks, i, 0.25, 0.78, 0, C.rx, C.rz); else sticks.setMatrixAt(i, zero);
        // 테마 소품 (우산은 머리 위에 받쳐 든다 — 우산 든 사람은 팔을 덜 든다)
        if (outfit === 'raincoat' && p.umb) { place(umb, i, 0.1, 1.95, 0.05, 0.08, -0.05); place(umbPole, i, 0.12, 1.45, 0.05); } else { umb.setMatrixAt(i, zero); umbPole.setMatrixAt(i, zero); }
        if (outfit === 'puffer') place(hat, i, 0, 1.2, -0.01); else hat.setMatrixAt(i, zero);
        if (outfit === 'santa') { place(santa, i, 0, 1.55, -0.04, -0.25); place(brim, i, 0, 1.33, -0.01, Math.PI / 2); } else { santa.setMatrixAt(i, zero); brim.setMatrixAt(i, zero); }
      });
      for (const m of [head, hair, body, legs, arms, sticks, umb, umbPole, hat, santa, brim]) m.instanceMatrix.needsUpdate = true;
    },
  };
}
