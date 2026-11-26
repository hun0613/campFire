// 🎈 열기구 하늘길 볼거리 (v1.23): 캠핑장 숲 너머 ~ 아레나 숲 사이 (z 100 ~ 270)
// - 땅: 조각보 들판 · 굽이치는 강과 작은 다리 · 창문에 불 켜진 작은 마을
// - 하늘: 천천히 떠오르는 풍등 · 지나가는 구름 · 열기구 옆을 나란히 나는 새 떼 · 멀리 떠 있는 작은 열기구들
// - 열기구를 탔을 때만 보인다 (평소엔 숨겨 그리기를 아낀다). 대부분 인스턴스라 그리기 횟수가 적다
import * as THREE from 'three';
import { toon, glow, radialTexture, mulberry32 } from './toon.js';
import { create as createBalloon, VARIANTS as BALLOON_LOOKS } from './elements/molecules/hot-air-balloon.js';
import { tag } from './ds/tag.js';

const Z0 = 100, Z1 = 272;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
function inst(geo, mat, items) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    m.setMatrixAt(i, m4.compose(v.set(it.x, it.y || 0, it.z), q.setFromEuler(e), sc.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1)));
    if (it.c) m.setColorAt(i, new THREE.Color(it.c));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}
/** 강 가운데 선: z 에 따라 x 가 굽이친다 */
const riverX = (z) => -48 + (z - Z0) * 0.62 + Math.sin(z * 0.045) * 14;

export function buildSkyRoute(scene) {
  const group = new THREE.Group();
  group.userData.ds = 'sky-route';
  group.visible = false;
  scene.add(group);
  const rnd = mulberry32(2026);
  let fieldsMesh = null, fieldCols = [], riverMat = null;

  // ── 조각보 들판 (강을 비켜서): 밀 · 라벤더 · 초록 · 해바라기
  {
    const cols = ['#c9a85a', '#8d7cc4', '#5f9653', '#d9b844', '#7aa865', '#b48ab0'];
    const fields = [];
    for (let z = Z0 + 6; z < Z1 - 6; z += 15) for (let x = -84; x < 84; x += 16) {
      const cx = x + (rnd() - 0.5) * 3, cz = z + (rnd() - 0.5) * 3;
      if (Math.abs(cx - riverX(cz)) < 11) continue;
      fields.push({ x: cx, y: 0.03, z: cz, rx: -Math.PI / 2, rz: (rnd() - 0.5) * 0.25, sx: 13 + rnd() * 2, sy: 12 + rnd() * 2, sz: 1, c: cols[Math.floor(rnd() * cols.length)] });
    }
    const f = inst(new THREE.PlaneGeometry(1, 1), toon('#ffffff'), fields);
    f.receiveShadow = true;
    fieldsMesh = f; fieldCols = fields.map((it) => new THREE.Color(it.c));
    tag(f, 'sky-route-fields');
    // 들판 사이 나무 줄
    const trees = [];
    for (let i = 0; i < 70; i++) { const z = Z0 + rnd() * (Z1 - Z0), x = (rnd() - 0.5) * 170; if (Math.abs(x - riverX(z)) < 6) continue; trees.push({ x, y: 2.2, z, s: 0.8 + rnd() * 0.6 }); }
    const t = inst(new THREE.ConeGeometry(1.6, 4.6, 6), toon('#2f5a37'), trees);
    tag(t, 'sky-route-fields');
    group.add(f, t);
  }

  // ── 강: 굽이치는 띠 (달빛에 은은하게) + 작은 나무다리 둘
  {
    const pts = [];
    for (let z = Z0 - 10; z <= Z1 + 10; z += 4) pts.push([riverX(z), z]);
    const pos = [], idx = [];
    pts.forEach(([x, z], i) => {
      const [x2, z2] = pts[Math.min(pts.length - 1, i + 1)], [x0, z0] = pts[Math.max(0, i - 1)];
      let tx = x2 - x0, tz = z2 - z0; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = 4.2 + Math.sin(i * 0.7) * 0.8;
      pos.push(x - tz * w, 0.06, z + tx * w, x + tz * w, 0.06, z - tx * w);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const river = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: '#3f6fa8', emissive: new THREE.Color('#1c3d6b'), emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    riverMat = river.material;
    tag(river, 'sky-route-river');
    group.add(river);
    for (const z of [150, 225]) {
      const x = riverX(z);
      const br = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 2.2), toon('#8b5a35'));
      br.position.set(x, 0.5, z); br.rotation.y = Math.atan2(1, 0.62) - Math.PI / 2;
      tag(br, 'sky-route-river');
      group.add(br);
    }
  }

  // ── 작은 마을: 집 14채 (창문에 노란 불빛)
  {
    const houses = [], roofs = [], wins = [];
    const VX = 26, VZ = 178;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, r = 6 + rnd() * 9;
      const x = VX + Math.cos(a) * r, z = VZ + Math.sin(a) * r, ry = -a + Math.PI / 2, s = 0.9 + rnd() * 0.5;
      houses.push({ x, y: 1.3 * s, z, ry, sx: 3 * s, sy: 2.6 * s, sz: 2.6 * s, c: ['#e9dcc4', '#d9c3a0', '#c9b6a6'][i % 3] });
      roofs.push({ x, y: 2.6 * s + 1.0 * s, z, ry: ry + Math.PI / 4, sx: 2.4 * s, sy: 2 * s, sz: 2.4 * s, c: ['#b4523d', '#8f4436', '#5c6b8a'][i % 3] });
      for (const o of [-0.6, 0.6]) wins.push({ x: x + Math.sin(ry) * 1.32 * s + Math.cos(ry) * o * s, y: 1.4 * s, z: z + Math.cos(ry) * 1.32 * s - Math.sin(ry) * o * s, ry, s: 0.55 * s });
    }
    const h = inst(new THREE.BoxGeometry(1, 1, 1), toon('#ffffff'), houses);
    const rf = inst(new THREE.ConeGeometry(1, 1, 4), toon('#ffffff'), roofs);
    const w = inst(new THREE.PlaneGeometry(0.8, 0.9), glow('#ffcf85', 2.2), wins);
    for (const m of [h, rf, w]) tag(m, 'sky-route-village');
    group.add(h, rf, w);
  }

  // ── 풍등: 들판 위에서 천천히 떠올라 하늘로 (돌고 돈다)
  const LN = 60;
  const lanterns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.22, 0.6, 8), glow('#ffb066', 2.0), LN);
  tag(lanterns, 'sky-route-lanterns');
  const lan = Array.from({ length: LN }, () => ({ x: (rnd() - 0.5) * 120, z: Z0 + 10 + rnd() * (Z1 - Z0 - 20), y: rnd() * 60, sp: 0.5 + rnd() * 0.6, ph: rnd() * 6 }));
  group.add(lanterns);

  // ── 구름: 나는 높이 둘레의 부드러운 구름 (지나갈 때 사이로 빠져나간다)
  const cloudMat = new THREE.SpriteMaterial({ map: radialTexture(), color: '#c9c3df', transparent: true, opacity: 0.32, depthWrite: false, fog: false });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(cloudMat); s.scale.set(16 + rnd() * 10, 7 + rnd() * 4, 1); s.position.set((k - 1.5) * 6 + rnd() * 3, rnd() * 2, rnd() * 4); c.add(s); }
    c.position.set((rnd() - 0.5) * 110, 34 + rnd() * 22, Z0 + rnd() * (Z1 - Z0));
    c.userData.drift = 0.6 + rnd() * 0.8;
    tag(c, 'sky-route-clouds');
    clouds.push(c); group.add(c);
  }

  // ── 멀리 떠 있는 작은 열기구들
  const far = [[-75, 38, 150], [70, 30, 205], [-58, 52, 245]].map(([x, y, z], i) => {
    const b = createBalloon({ stripes: BALLOON_LOOKS[(i + 1) % BALLOON_LOOKS.length].stripes });
    b.group.scale.setScalar(0.55); b.group.position.set(x, y, z);
    b.group.userData.ds = 'sky-route-balloons';
    group.add(b.group);
    return { b, x, y, z, ph: i * 2 };
  });

  // ── 새 떼: 탄 열기구 옆을 V 자로 나란히 난다 (날개 두 장이 퍼덕)
  const BN = 7;
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0, -0.1, 0, 0, -0.25, 0, 0, 0.25, 0.9, 0, -0.1, 0, 0, -0.25], 3));
  birdGeo.computeVertexNormals();
  const birds = new THREE.Group();
  tag(birds, 'sky-route-birds');
  const birdMat = new THREE.MeshBasicMaterial({ color: '#2a2440', side: THREE.DoubleSide });
  const flock = Array.from({ length: BN }, (_, i) => {
    const m = new THREE.Mesh(birdGeo.clone(), birdMat);
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    m.userData.off = new THREE.Vector3(side * row * 1.6, Math.sin(i) * 0.4, -row * 1.8);
    m.userData.ph = i * 0.7;
    birds.add(m);
    return m;
  });
  group.add(birds);

  const lanPos = new THREE.Vector3();
  const tc = new THREE.Color(), snowC = new THREE.Color('#e4e9f2');
  return {
    group,
    /** 🌦️ 테마: 눈이면 들판이 하얗게 · 강이 얼고, 비면 들판이 짙게 젖는다 */
    setTheme(th) {
      const g = th.ground || 'grass';
      fieldCols.forEach((c, i) => fieldsMesh.setColorAt(i, g === 'snow' ? tc.copy(snowC).lerp(c, 0.12) : g === 'wet' ? tc.copy(c).multiplyScalar(0.7) : c));
      fieldsMesh.instanceColor.needsUpdate = true;
      riverMat.color.set(g === 'snow' ? '#bcd3ea' : '#3f6fa8');
      riverMat.emissive.set(g === 'snow' ? '#33465f' : '#1c3d6b');
    },
    /** 매 프레임 (보일 때만): ride 탄 열기구 자리 · 나는 방향 */
    update(dt, t, ride) {
      if (!group.visible) return;
      lan.forEach((L, i) => {
        L.y += L.sp * dt; if (L.y > 70) L.y = 0;
        lanPos.set(L.x + Math.sin(t * 0.3 + L.ph) * 1.2, L.y + 1, L.z + Math.cos(t * 0.25 + L.ph) * 1.2);
        lanterns.setMatrixAt(i, m4.compose(lanPos, q.identity(), sc.setScalar(1)));
      });
      lanterns.instanceMatrix.needsUpdate = true;
      for (const c of clouds) { c.position.x += c.userData.drift * dt; if (c.position.x > 70) c.position.x = -70; }
      for (const f of far) { f.b.group.position.y = f.y + Math.sin(t * 0.3 + f.ph) * 1.5; f.b.group.rotation.y += dt * 0.05; f.b.update(t, { burn: 0.3 }); }
      // 새 떼: 탄 열기구 옆 10m · 조금 아래에서 같은 방향으로
      if (ride) {
        birds.visible = true;
        birds.position.lerp(v.set(ride.x + Math.cos(ride.heading) * 11, ride.y - 2 + Math.sin(t * 0.5) * 1.5, ride.z - Math.sin(ride.heading) * 11), Math.min(1, dt * 1.2));
        birds.rotation.y = ride.heading;
        for (const b of flock) {
          b.position.copy(b.userData.off);
          const flap = Math.sin(t * 7 + b.userData.ph) * 0.5;
          const p = b.geometry.attributes.position;
          p.setY(1, flap); p.setY(4, flap); p.needsUpdate = true;
        }
      } else birds.visible = false;
    },
  };
}
