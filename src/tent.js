import * as THREE from 'three';
import { toon, glow, radialTexture } from './toon.js';
import { CFG, TENTS, TENT_WH, TENT_RH, STOVE_SEAT_DEG } from '../shared/config.js';

// ---------------------------------------------------------------- 글램핑 텐트 안
// 텐트 안은 내가 들어간 텐트 하나만 보이면 된다 (벽 · 지붕은 그대로 덮여 있고, 창문으로만 밖이 보인다).
// 그래서 실내 소품은 한 벌만 만들어 두고, 들어간 텐트로 옮겨 놓는다.
// 가운데 둥근 화로 + 후드 · 연통은 fire.js (kind 'stove') — 텐트마다 따로 있다 (연통 연기가 밖에서도 보여야 해서).
// 여기는 「뒤뜰 불멍 라운지」 느낌의 소품: 판석 바닥 · 조약돌 테두리 · 화로를 감싼 C자 소파와 쿠션 ·
// 나무 두 그루 사이 해먹 · 원목 TV장(노래) · 장작 바구니 · 줄전구 · 문 안쪽 출구 표시
const FLOOR = 0.15; // 데크 높이
const R = CFG.TENT_R;
const WH = TENT_WH, RH = TENT_RH;
const D2R = Math.PI / 180;
const at = (deg, r) => ({ x: Math.sin(deg * D2R) * r, z: Math.cos(deg * D2R) * r }); // 문(+z)에서 잰 각도 → 텐트 안 좌표
/** 텐트 안 지붕 높이 (가운데에서 r 만큼 떨어진 곳, 바닥 기준이 아니라 월드 y) */
export const roofY = (r) => (r >= R ? FLOOR + WH : FLOOR + WH + RH * (1 - r / (R + 0.4)));

const SOFA = { ri: 1.98, ro: 3.22, d0: 78, d1: 282 }; // C자 소파 (문 쪽은 비어 있다)
const TV = { ...at(40, R - 1.5), deg: 40 };              // 원목 TV장: 문 오른쪽, 소파를 바라본다
const WOOD = { ...at(-40, R - 1.25) };                     // 장작 바구니: 문 왼쪽
const TREES = [at(152, R - 1.05), at(208, R - 1.05)];         // 뒤쪽 나무 두 그루 (사이에 해먹)
/** 텐트 안에서 부딪히는 것 (텐트 안 좌표, 반지름) */
export const TENT_PROPS = [
  { x: 0, z: 0, r: 1.05 }, // 화로
  { x: TV.x, z: TV.z, r: 0.75 },
  { x: WOOD.x, z: WOOD.z, r: 0.5 },
  ...TREES.map((p) => ({ ...p, r: 0.42 })),
];
for (let d = SOFA.d0 + 2; d <= SOFA.d1 - 2; d += 12) TENT_PROPS.push({ ...at(d, 2.6), r: 0.6 });
// 문 안쪽 (텐트 안 좌표): 들어오면 여기 선다
export const TENT_ENTRY = { x: 0, z: R - 3.0 };
const SCREEN = { w: 1.24, h: 0.7 };
const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false, fog: false });
const TV_OFF = new THREE.Color('#14131c');
const RING = new THREE.Color('#ffb36a');

/** 바닥 위에 눕힌 C자(부채꼴 고리) 덩어리. 높이 y0 ~ y0+h, 둥근 모서리 */
function sector(ri, ro, d0, d1, y0, h, mat, bevel = 0.05) {
  const t0 = (d0 - 90) * D2R, t1 = (d1 - 90) * D2R;
  const sh = new THREE.Shape();
  sh.moveTo(Math.cos(t0) * ro, Math.sin(t0) * ro);
  sh.absarc(0, 0, ro, t0, t1, false);
  sh.lineTo(Math.cos(t1) * ri, Math.sin(t1) * ri);
  sh.absarc(0, 0, ri, t1, t0, true);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 56 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y0 + bevel;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** 판석 바닥 무늬 */
function flagstoneTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#5d5a57'; c.fillRect(0, 0, 256, 256); // 줄눈
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cells = [];
  for (let i = 0; i < 26; i++) cells.push([rnd() * 256, rnd() * 256]);
  const img = c.getImageData(0, 0, 256, 256);
  const tones = cells.map(() => 150 + rnd() * 45);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0;
      for (let i = 0; i < cells.length; i++) {
        let dx = Math.abs(x - cells[i][0]), dy = Math.abs(y - cells[i][1]);
        dx = Math.min(dx, 256 - dx); dy = Math.min(dy, 256 - dy);
        const d = dx * dx + dy * dy;
        if (d < b1) { b2 = b1; b1 = d; bi = i; } else if (d < b2) b2 = d;
      }
      const edge = Math.sqrt(b2) - Math.sqrt(b1);
      const k = (y * 256 + x) * 4;
      if (edge > 1.8) {
        const v = tones[bi] + (rnd() - 0.5) * 10;
        img.data[k] = v * 0.98; img.data[k + 1] = v * 0.96; img.data[k + 2] = v * 0.92;
      }
    }
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class TentInterior {
  constructor(scene, worldTents) {
    this.worldTents = worldTents;
    this.cur = null;
    this.g = new THREE.Group();
    this.g.visible = false;
    scene.add(this.g);
    const g = this.g;
    this.bulbs = []; // 카메라가 바짝 붙으면 숨길 빛나는 것들 (줄전구 · 무드등)
    const wood = toon('#9a6a40'), woodDark = toon('#6b4528');

    // ---- 바닥: 판석 + 벽을 따라 조약돌 테두리 · 풀 포기
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 64), new THREE.MeshToonMaterial({ map: flagstoneTexture(), color: '#d8d2c8' }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR + 0.01; floor.receiveShadow = true;
    g.add(floor);
    {
      const geo = new THREE.DodecahedronGeometry(0.11, 0);
      const N = 260;
      const pebbles = new THREE.InstancedMesh(geo, toon('#cfcac2'), N);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      const col = new THREE.Color();
      let n = 0;
      for (let i = 0; n < N && i < N * 3; i++) {
        const d = Math.random() * 360;
        if (d < 16 || d > 344) continue; // 문 앞은 비운다
        const r = R - 0.2 - Math.random() * 0.55;
        const a = at(d, r);
        p.set(a.x, FLOOR + 0.04, a.z);
        q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, 0));
        const s = 0.7 + Math.random() * 0.9;
        sc.set(s * 1.3, s * 0.6, s);
        pebbles.setMatrixAt(n, m4.compose(p, q, sc));
        pebbles.setColorAt(n, col.set(['#d9d4cc', '#bfb8ae', '#e8e3da', '#a8a199'][n % 4]));
        n++;
      }
      pebbles.count = n;
      pebbles.receiveShadow = true;
      g.add(pebbles);
      // 풀 포기 (참고: 앞쪽 테두리의 억새)
      const bladeGeo = new THREE.ConeGeometry(0.035, 0.6, 3);
      const grassMat = toon('#7d8a52'), grassDry = toon('#b59a62');
      for (const d of [28, 60, 96, 128, 172, 196, 236, 262, 300, 334]) {
        const a = at(d, R - 0.45);
        const tuft = new THREE.Group();
        tuft.position.set(a.x, FLOOR, a.z);
        for (let k = 0; k < 9; k++) {
          const b = new THREE.Mesh(bladeGeo, k % 3 ? grassMat : grassDry);
          const h = 0.7 + Math.random() * 0.5;
          b.scale.set(1, h, 1);
          b.position.set((Math.random() - 0.5) * 0.25, 0.3 * h, (Math.random() - 0.5) * 0.25);
          b.rotation.set((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.7);
          tuft.add(b);
        }
        g.add(tuft);
      }
    }

    // ---- C자 소파: 원목 받침 + 크림색 방석 + 등받이 + 팔걸이, 갈색 쿠션
    {
      const cream = toon('#ece4d4'), creamShade = toon('#ddd3c0');
      g.add(sector(SOFA.ri, SOFA.ro, SOFA.d0, SOFA.d1, FLOOR, 0.17, toon('#8a5a36'), 0.02));
      g.add(sector(SOFA.ri + 0.02, SOFA.ro - 0.3, SOFA.d0 + 1, SOFA.d1 - 1, FLOOR + 0.16, 0.27, cream, 0.06));
      g.add(sector(SOFA.ro - 0.32, SOFA.ro, SOFA.d0, SOFA.d1, FLOOR + 0.16, 0.88, creamShade, 0.06));
      for (const [d0, d1] of [[SOFA.d0, SOFA.d0 + 5], [SOFA.d1 - 5, SOFA.d1]]) g.add(sector(SOFA.ri, SOFA.ro - 0.2, d0, d1, FLOOR + 0.16, 0.58, creamShade, 0.06));
      // 방석 사이 줄눈 (자리 5개가 보이게)
      const seam = toon('#cfc4ae');
      for (let i = 0; i < STOVE_SEAT_DEG.length - 1; i++) {
        const d = (STOVE_SEAT_DEG[i] + STOVE_SEAT_DEG[i + 1]) / 2;
        const s = sector(SOFA.ri + 0.04, SOFA.ro - 0.34, d - 0.35, d + 0.35, FLOOR + 0.42, 0.02, seam, 0);
        g.add(s);
      }
      const pillowGeo = new THREE.BoxGeometry(0.5, 0.42, 0.15);
      [[84, '#a07a4a'], [162, '#8a6a46'], [234, '#a07a4a'], [276, '#c9a774'], [126, '#c9a774']].forEach(([d, c]) => {
        const p = new THREE.Mesh(pillowGeo, toon(c));
        const a = at(d, SOFA.ro - 0.45);
        p.position.set(a.x, FLOOR + 0.66, a.z);
        p.rotation.set(0, d * D2R, 0);
        p.rotateX(-0.28);
        p.castShadow = true;
        g.add(p);
      });
      // 담요 하나
      const throwB = sector(SOFA.ri + 0.1, SOFA.ro - 0.4, 200, 211, FLOOR + 0.43, 0.03, toon('#7f8f9c'), 0);
      g.add(throwB);
    }

    // ---- 뒤쪽: 나무 두 그루 (아래에서 비추는 조명) + 사이에 해먹
    {
      const bark = toon('#efe2c8', { emissive: new THREE.Color('#ff9a4a'), emissiveIntensity: 0.28 });
      const leaf = [toon('#3f5f3a'), toon('#4d6e3f'), toon('#35512f')];
      const planter = toon('#8d8880');
      const up = new THREE.Vector3(0, 1, 0);
      const limb = (from, to, r0, r1) => {
        const dir = to.clone().sub(from);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, dir.length(), 7), bark);
        m.position.copy(from).add(to).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(up, dir.normalize());
        m.castShadow = true;
        return m;
      };
      TREES.forEach((p, k) => {
        const tg = new THREE.Group();
        tg.position.set(p.x, FLOOR, p.z);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.42, 14), planter);
        pot.position.y = 0.21; pot.castShadow = true;
        const soil = new THREE.Mesh(new THREE.CircleGeometry(0.38, 14), toon('#3a2a20'));
        soil.rotation.x = -Math.PI / 2; soil.position.y = 0.42;
        tg.add(pot, soil);
        const s = k ? -1 : 1; // 서로 바깥으로 살짝 기운다
        const base = new THREE.Vector3(0, 0.4, 0), mid = new THREE.Vector3(0.12 * s, 1.7, 0.05), top = new THREE.Vector3(0.05 * s, 2.7, -0.05);
        tg.add(limb(base, mid, 0.12, 0.09), limb(mid, top, 0.09, 0.05));
        const ends = [];
        for (const [dx, dy, dz] of [[0.75, 2.75, 0.2], [-0.6, 2.85, 0.15], [0.3, 3.0, -0.35], [-0.3, 2.55, 0.5]]) {
          const e = new THREE.Vector3(dx * s, dy, dz);
          tg.add(limb(mid.clone().lerp(top, 0.4), e, 0.05, 0.025));
          ends.push(e);
        }
        ends.push(top);
        ends.forEach((e, i) => {
          for (let j = 0; j < 3; j++) {
            const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.14, 0), leaf[(i + j) % 3]);
            b.position.set(e.x + (Math.random() - 0.5) * 0.45, Math.min(e.y + (Math.random() - 0.2) * 0.3, 3.05), e.z + (Math.random() - 0.5) * 0.45);
            b.scale.y = 0.75;
            b.castShadow = true;
            tg.add(b);
          }
        });
        // 바닥 업라이트 (나무 밑동을 비추는 빛)
        const spot = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffae5c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
        spot.rotation.x = -Math.PI / 2; spot.position.y = 0.44;
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow('#ffd59a', 3));
        lamp.position.set(0.22 * s, 0.45, 0.25);
        tg.add(spot, lamp);
        g.add(tg);
      });
      // 해먹: 두 나무 사이에 늘어진 크림색 그물 천 + 끈 + 술
      const A = new THREE.Vector3(TREES[0].x, FLOOR + 1.55, TREES[0].z), B = new THREE.Vector3(TREES[1].x, FLOOR + 1.55, TREES[1].z);
      const L = 3.3, W = 0.85, NU = 22, NV = 6;
      const geo = new THREE.PlaneGeometry(L, W, NU, NV);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const u = x / L + 0.5, v = y / W; // u: 0..1 (길이), v: -0.5..0.5 (폭)
        const sag = Math.max(0, Math.sin(u * Math.PI));
        const pinch = 0.35 + 0.65 * Math.pow(sag, 0.6); // 양 끝은 오므라든다
        pos.setXYZ(i, x, -sag * 0.62 + (v * v) * 0.5 * sag, v * W * pinch);
      }
      geo.computeVertexNormals();
      const ham = new THREE.Mesh(geo, toon('#efe6d2', { side: THREE.DoubleSide }));
      ham.castShadow = true;
      const mid = A.clone().add(B).multiplyScalar(0.5);
      ham.position.copy(mid).setY(FLOOR + 1.42);
      ham.rotation.y = Math.atan2(-(B.z - A.z), B.x - A.x);
      g.add(ham);
      // 술 (아래로 늘어진 장식)
      const fringeMat = toon('#e2d6bc');
      for (let i = 1; i < 16; i++) {
        const u = i / 16, x = (u - 0.5) * L;
        const sag = Math.sin(u * Math.PI);
        for (const side of [-1, 1]) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.01), fringeMat);
          const pinch = 0.35 + 0.65 * Math.pow(sag, 0.6);
          f.position.set(x, -sag * 0.62 + 0.125 * sag - 0.08, side * 0.5 * W * pinch);
          ham.add(f);
        }
      }
      // 끈: 해먹 끝 → 나무
      const rope = new THREE.LineBasicMaterial({ color: '#d8ccb0' });
      for (const [P, sx] of [[A, -1], [B, 1]]) {
        const endL = new THREE.Vector3(sx * L / 2, 0, 0).applyEuler(ham.rotation).add(ham.position);
        for (const dz of [-0.12, 0, 0.12]) {
          const e2 = endL.clone().add(new THREE.Vector3(0, 0, dz).applyEuler(ham.rotation));
          g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([e2, P.clone().setY(FLOOR + 1.85)]), rope));
        }
      }
    }

    // ---- 원목 TV장 + TV(노래 영상) + 블루투스 스피커 + 작은 도자기
    {
      const cab = new THREE.Group();
      cab.position.set(TV.x, FLOOR, TV.z);
      cab.rotation.y = Math.atan2(-TV.x, -TV.z); // 앞(+z)이 화로 · 소파 쪽
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.5), wood); box.position.y = 0.3; box.castShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.04, 0.52), woodDark); top.position.y = 0.595;
      cab.add(box, top);
      for (const x of [-0.42, 0.42]) { // 서랍 (가로 홈)
        for (const y of [0.2, 0.32, 0.44]) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.025, 0.01), woodDark);
          slat.position.set(x, y, 0.255);
          cab.add(slat);
        }
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w + 0.06, SCREEN.h + 0.06, 0.05), toon('#1c1b22'));
      frame.position.set(-0.1, 0.62 + 0.08 + SCREEN.h / 2 + 0.03, -0.02);
      this.tvMat = new THREE.MeshBasicMaterial({ color: TV_OFF.clone() });
      this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), this.tvMat);
      this.screen.position.z = 0.026;
      frame.add(this.screen);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.2), toon('#2b2a30'));
      stand.position.set(-0.1, 0.63, -0.02);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.04), toon('#2b2a30'));
      neck.position.set(-0.1, 0.68, -0.02);
      cab.add(frame, stand, neck);
      // 스피커 (TV 오른쪽)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.26, 20), toon('#2c2a33'));
      body.position.set(0.67, 0.6 + 0.13, 0.05); body.castShadow = true;
      this.ringMat = new THREE.MeshBasicMaterial({ color: RING.clone() });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 8, 24), this.ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(0.67, 0.6 + 0.265, 0.05);
      const grill = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.08, 20, 1, true), this.ringMat);
      grill.position.set(0.67, 0.6 + 0.1, 0.05);
      cab.add(body, ring, grill);
      this.speaker = body;
      // 도자기 (TV 왼쪽)
      const vase = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), toon('#5f6f7a'));
      vase.scale.y = 1.15; vase.position.set(-0.78, 0.6 + 0.13, 0.05);
      cab.add(vase);
      // 누르면 곡 고르기 (투명 판정)
      this.hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
      this.hit.position.y = 0.8;
      cab.add(this.hit);
      g.add(cab);
    }
    this.screenW = SCREEN.w;
    this.playing = 0;
    this.time = 0;

    // ---- 문 왼쪽: 장작 바구니
    {
      const bg = new THREE.Group();
      bg.position.set(WOOD.x, FLOOR, WOOD.z);
      bg.rotation.y = Math.atan2(-WOOD.x, -WOOD.z);
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.36, 16, 1, true), toon('#7a5a3a', { side: THREE.DoubleSide }));
      basket.position.y = 0.18;
      bg.add(basket);
      for (let i = 0; i < 7; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 7), toon(i % 2 ? '#8b5a33' : '#a06a3d'));
        l.rotation.z = Math.PI / 2;
        l.position.set(0, 0.22 + Math.floor(i / 3) * 0.12, ((i % 3) - 1) * 0.15);
        l.castShadow = true;
        bg.add(l);
      }
      g.add(bg);
    }

    // ---- 줄전구: 연통 둘레에서 벽 꼭대기로 부채처럼 늘어진다
    {
      const bulbGeo = new THREE.SphereGeometry(0.05, 6, 5);
      const bulbMat = glow('#ffd59a', 2.4);
      const wire = new THREE.LineBasicMaterial({ color: '#3a2f28' });
      const N = 12;
      for (let s = 0; s < N; s++) {
        const d = (s / N) * 360 + 15;
        const a0 = at(d, 0.35), a1 = at(d, R - 0.15);
        const y0 = roofY(0.35) - 0.35, y1 = FLOOR + WH - 0.05;
        const pts = [];
        for (let i = 0; i <= 14; i++) {
          const u = i / 14;
          pts.push(new THREE.Vector3(a0.x + (a1.x - a0.x) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 0.45, a0.z + (a1.z - a0.z) * u));
        }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
        for (let i = 2; i <= 13; i += 2) {
          const b = new THREE.Mesh(bulbGeo, bulbMat);
          b.position.copy(pts[i]).y -= 0.07;
          g.add(b);
          this.bulbs.push(b);
        }
      }
    }

    // ---- 문 안쪽: 은은하게 빛나는 문틀 + 발판
    {
      const pent = (w, h1, h2) => { const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, h1); sh.lineTo(0, h2); sh.lineTo(-w, h1); sh.closePath(); return sh; };
      const exitShape = pent(0.9, 1.25, 2.0);
      exitShape.holes.push(new THREE.Path(pent(0.78, 1.2, 1.86).getPoints()));
      this.exitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.4), side: THREE.DoubleSide });
      const exitFrame = new THREE.Mesh(new THREE.ShapeGeometry(exitShape), this.exitMat);
      exitFrame.position.set(0, FLOOR, R - 0.06);
      const exitIn = new THREE.Mesh(new THREE.ShapeGeometry(pent(0.78, 1.2, 1.86)), new THREE.MeshBasicMaterial({ color: '#16233a', side: THREE.DoubleSide }));
      exitIn.position.set(0, FLOOR, R - 0.04);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), toon('#6b5a45'));
      mat.rotation.x = -Math.PI / 2; mat.position.set(0, FLOOR + 0.02, R - 0.6);
      g.add(exitFrame, exitIn, mat);
    }

    // ---- 무드등: 천 갓을 씌운 스탠드 둘 (TV장 옆 · 해먹 쪽). 화로가 꺼져 있어도 방이 보이게
    this.moodMat = glow('#ffcf8a', 1.6);
    this.moodLights = [];
    for (const [d, r] of [[88, R - 0.95], [226, R - 1.0]]) {
      const p = at(d, r);
      const lg = new THREE.Group();
      lg.position.set(p.x, FLOOR, p.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 14), toon('#3a2f28'));
      base.position.y = 0.025;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6), toon('#3a2f28'));
      pole.position.y = 0.7;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.34, 18, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(1.1), side: THREE.DoubleSide }));
      shade.position.y = 1.45;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.moodMat);
      bulb.position.y = 1.42;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffb066', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03;
      const L = new THREE.PointLight('#ffc27a', 0, 7.5, 1.5);
      L.position.y = 1.3;
      lg.add(base, pole, shade, bulb, pool, L);
      this.bulbs.push(shade, bulb); // 카메라가 바짝 붙으면 숨긴다
      this.moodLights.push(L);
      g.add(lg);
      TENT_PROPS.push({ x: p.x, z: p.z, r: 0.3 });
    }

    // ---- 은은한 실내등 (화로가 꺼져 있어도 어둡지 않게)
    this.light = new THREE.PointLight('#ffb36a', 0, 11, 1.6);
    this.light.position.set(0, FLOOR + 2.9, 1.2);
    g.add(this.light);

    // 들어간 텐트의 벽 · 지붕 안쪽: 바깥 조명에 빛나는 천 대신 어두운 실내 천 (불멍 감성)
    this.darkWall = [...worldTents.values()][0].wall.material.clone();
    Object.assign(this.darkWall, { emissiveIntensity: 0.06 });
    this.darkWall.color.set('#b8a990');
    this.darkRoof = [...worldTents.values()][0].roof.material.clone();
    Object.assign(this.darkRoof, { emissiveIntensity: 0.05 });
    this.darkRoof.color.set('#a89a80');
    this.clearGlass = new THREE.MeshBasicMaterial({ color: '#9fb7d6', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    this.fadeWall = [...worldTents.values()][0].wall.material.clone();
    Object.assign(this.fadeWall, { transparent: true, opacity: 0.22, depthWrite: false });
    this.fadeRoof = [...worldTents.values()][0].roof.material.clone();
    Object.assign(this.fadeRoof, { transparent: true, opacity: 0.25, depthWrite: false });
    this.faded = new Set(); // 카메라와 나 사이를 가려서 반투명하게 만든 (내가 들어가 있지 않은) 텐트
  }

  /** 들어간 텐트 (t: TENTS 항목 또는 null). 벽 · 지붕은 그대로 두고 그 텐트 창문만 맑은 유리로 */
  set(t) {
    if (this.cur === t) return;
    if (this.cur) { const m = this.worldTents.get(this.cur.id); for (const gl of m.glass) gl.material = m.glassMat; m.wall.material = m.wallMat; m.roof.material = m.roofMat; }
    if (t && this.faded.has(t.id)) this.#unfade(t.id);
    this.cur = t;
    if (!t) { this.g.visible = false; this.light.intensity = 0; return; }
    const m = this.worldTents.get(t.id);
    for (const gl of m.glass) gl.material = this.clearGlass;
    if (!m.wallMat) m.wallMat = m.wall.material;
    if (!m.roofMat) m.roofMat = m.roof.material;
    m.wall.material = this.darkWall; m.roof.material = this.darkRoof;
    this.g.position.set(t.x, 0, t.z);
    this.g.rotation.y = t.facing;
    this.g.visible = true;
  }

  /** 텐트마다 창문 불빛: 안에 사람이 있으면 더 따뜻하게 */
  setOccupancy(id, n) {
    const m = this.worldTents.get(id);
    if (!m || m.occ === n) return;
    m.occ = n;
    m.glassMat.opacity = n ? 0.85 : 0.4;
    m.glassMat.color.set(n ? '#ffc070' : '#d9a066');
  }

  #unfade(id) {
    const m = this.worldTents.get(id);
    m.wall.material = m.wallMat; m.roof.material = m.roofMat;
    this.faded.delete(id);
  }

  /** 카메라와 나 사이를 가리는 (내가 들어가 있지 않은) 텐트는 반투명하게 — 텐트 앞에서 카메라가 지붕에 가리지 않게 */
  fadeNear(cp, me) {
    for (const t of TENTS) {
      if (t === this.cur) continue;
      let hide = false;
      const dc = Math.hypot(cp.x - t.x, cp.z - t.z);
      if (me && dc < R + 1.5 && cp.y < 13) hide = true; // 카메라가 텐트 바로 위 · 옆이면 (나를 내려다보는 앞을 가린다)
      else if (me && dc < 22) {
        for (let i = 0; i <= 24 && !hide; i++) { // 카메라 → 나 선분 위 점이 텐트(벽 + 원뿔 지붕) 안에 있나
          const k = i / 24;
          const x = cp.x + (me.x - cp.x) * k, y = cp.y + (1.1 - cp.y) * k, z = cp.z + (me.z - cp.z) * k;
          const d = Math.hypot(x - t.x, z - t.z);
          if (d < R + 0.4 && y < roofY(Math.max(d, 0)) + 0.2) hide = true;
        }
      }
      if (hide === this.faded.has(t.id)) continue;
      const m = this.worldTents.get(t.id);
      if (!m.wallMat) m.wallMat = m.wall.material;
      if (!m.roofMat) m.roofMat = m.roof.material;
      if (hide) {
        m.wall.material = this.fadeWall; m.roof.material = this.fadeRoof;
        this.faded.add(t.id);
      } else this.#unfade(t.id);
    }
  }

  /** 스피커의 월드 좌표 (♪ · 안내 표시 자리) */
  speakerWorld(out) { return this.speaker.getWorldPosition(out); }
  /** TV 화면을 영상 구멍으로 (음악 재생 중) */
  setHole(on) { this.screen.material = on ? HOLE : this.tvMat; }
  screenPose(outPos, outQuat) {
    this.screen.updateWorldMatrix(true, false);
    this.screen.getWorldPosition(outPos);
    this.screen.getWorldQuaternion(outQuat);
  }

  update(dt, playing = false, camPos = null) {
    if (!this.cur) return;
    // 카메라 바로 앞 전구는 숨긴다 (화면 가득 하얗게 번지지 않게)
    if (camPos) {
      const wp = this._wp || (this._wp = new THREE.Vector3());
      for (const b of this.bulbs) b.visible = b.getWorldPosition(wp).distanceToSquared(camPos) > 1.6 * 1.6;
    }
    this.time += dt;
    const t = this.time;
    this.playing += ((playing ? 1 : 0) - this.playing) * Math.min(1, dt * 3);
    // 스피커 고리: 평소엔 은은하게, 노래가 나오면 박자처럼 통통
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)), 6);
    this.ringMat.color.copy(RING).multiplyScalar(0.5 + this.playing * (0.9 + beat * 1.2));
    this.tvMat.color.copy(TV_OFF).lerp(RING, this.playing * 0.12);
    this.exitMat.color.set('#ffd27a').multiplyScalar(1.1 + 0.25 * Math.sin(t * 2));
    this.light.intensity += (1.0 - this.light.intensity) * Math.min(1, dt * 3); // 은은하게: 실내는 화로 · 무드등 · 줄전구 불빛으로
    for (const L of this.moodLights) L.intensity += (2.6 - L.intensity) * Math.min(1, dt * 3);
  }
}

// ---------------------------------------------------------------- 텐트 벽 충돌
// 텐트는 걸어서 드나들지 않는다: 문 앞 「들어가기」 · 안의 「나가기」 버튼으로만 (밖에서는 둥근 벽, 안에서는 벽 안쪽에 막힌다)
const IN_MAX = R - 0.45;  // 안에서 벽까지 (캐릭터 몸 두께 포함)
const OUT_MIN = R + 0.6;  // 밖에서 벽까지 (둥근 충돌 R + 0.25 + 몸 두께)
export function collideTents(p) {
  for (const t of TENTS) {
    const dx = p.x - t.x, dz = p.z - t.z;
    const r = Math.hypot(dx, dz);
    if (r > OUT_MIN || r < 1e-6) continue;
    if (r < R) {
      if (r > IN_MAX) { p.x = t.x + (dx / r) * IN_MAX; p.z = t.z + (dz / r) * IN_MAX; }
    } else { p.x = t.x + (dx / r) * OUT_MIN; p.z = t.z + (dz / r) * OUT_MIN; }
  }
}
