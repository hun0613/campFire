import * as THREE from 'three';
import { toon, glow, radialTexture, textTexture, mulberry32 } from './toon.js';
import { createSky } from './sky.js';
import { TENTS, PITS, STUMPS, NPC, WOODYARD, BOUNDS } from '../shared/config.js';

const W = { minX: -60, maxX: 60, minZ: -42, maxZ: 42 };
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpE = new THREE.Euler();

// ---------------------------------------------------------------- 길 판정 (지면 텍스처와 동일한 모양)
export function isPath(x, z) {
  if (Math.abs(z) < 2.4 && x > -50 && x < 50) return true;
  if (x * x + z * z < 11.5 * 11.5) return true;
  for (const t of TENTS) if (Math.abs(x - t.x) < 1.3 && Math.abs(z) < 23 && Math.sign(z) === Math.sign(t.z)) return true;
  for (const p of PITS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < 3.7 * 3.7) return true;
  if (((x - WOODYARD.x) / 8.5) ** 2 + ((z - WOODYARD.z) / 7.5) ** 2 < 1) return true;
  if ((x - (NPC.x + 1)) ** 2 + (z - NPC.z) ** 2 < 6.2 * 6.2) return true;
  return false;
}

function groundTexture() {
  const PX = 20; // px per meter
  const w = (W.maxX - W.minX) * PX;
  const h = (W.maxZ - W.minZ) * PX;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const X = (x) => (x - W.minX) * PX;
  const Z = (z) => (z - W.minZ) * PX;
  const rand = mulberry32(7);

  g.fillStyle = '#4e8a40';
  g.fillRect(0, 0, w, h);
  // 잔디 얼룩
  for (let i = 0; i < 900; i++) {
    const x = rand() * w, y = rand() * h, r = 20 + rand() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rand() > 0.5 ? '110,170,80' : '70,130,60';
    grd.addColorStop(0, `rgba(${c},0.35)`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 40000; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(150,200,110,0.35)' : 'rgba(50,100,45,0.35)';
    g.fillRect(rand() * w, rand() * h, 2, 3 + rand() * 3);
  }

  // 흙길
  const path = '#a98a5e';
  g.fillStyle = path;
  g.strokeStyle = path;
  g.shadowColor = path;
  g.shadowBlur = 18;
  g.lineCap = 'round';
  g.lineWidth = 4.8 * PX;
  g.beginPath(); g.moveTo(X(-50), Z(0)); g.lineTo(X(50), Z(0)); g.stroke();
  g.lineWidth = 2.6 * PX;
  for (const t of TENTS) {
    g.beginPath(); g.moveTo(X(t.x), Z(0)); g.lineTo(X(t.x), Z(Math.sign(t.z) * 23)); g.stroke();
  }
  const circle = (x, z, r) => { g.beginPath(); g.arc(X(x), Z(z), r * PX, 0, Math.PI * 2); g.fill(); };
  const ellipse = (x, z, rx, rz) => { g.beginPath(); g.ellipse(X(x), Z(z), rx * PX, rz * PX, 0, 0, Math.PI * 2); g.fill(); };
  circle(0, 0, 11.5);
  for (const p of PITS) circle(p.x, p.z, 3.7);
  ellipse(WOODYARD.x, WOODYARD.z, 8.5, 7.5);
  circle(NPC.x + 1, NPC.z, 6.2);
  g.shadowBlur = 0;
  for (let i = 0; i < 26000; i++) {
    const x = rand() * w, y = rand() * h;
    const wx = x / PX + W.minX, wz = y / PX + W.minZ;
    if (!isPath(wx, wz)) continue;
    g.fillStyle = rand() > 0.5 ? 'rgba(235,205,150,0.5)' : 'rgba(150,110,70,0.35)';
    g.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 3);
  }
  // 화로 주변 그을음
  for (const p of PITS) {
    const grd = g.createRadialGradient(X(p.x), Z(p.z), 0, X(p.x), Z(p.z), 1.4 * PX);
    grd.addColorStop(0, 'rgba(60,40,30,0.55)');
    grd.addColorStop(1, 'rgba(60,40,30,0)');
    g.fillStyle = grd;
    g.fillRect(X(p.x) - 40, Z(p.z) - 40, 80, 80);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function instanced(geo, mat, list, { cast = true, receive = false } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => {
    tmpP.set(it.x, it.y ?? 0, it.z);
    tmpE.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    tmpQ.setFromEuler(tmpE);
    if (typeof it.s === 'number') tmpS.setScalar(it.s); else tmpS.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
    if (it.color) mesh.setColorAt(i, new THREE.Color(it.color));
  });
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// ---------------------------------------------------------------- 메인
export function buildWorld(scene, { lowSpec = false } = {}) {
  const colliders = [];
  const decks = [];
  const updaters = [];
  const bulbs = []; // {x,y,z,color}
  // 가로등·루미 공방 조명 자리. 실제 조명은 main.js 의 LightPool 이 가까운 곳에만 몇 개 켠다 (조명 수가 많으면 폰이 뜨거워짐)
  const lightSpots = [];
  // 카메라와 보는 곳 사이에 서면 반투명해지는 기둥들 (main.js 에서 처리)
  const occluders = [];
  const addCol = (x, z, r) => colliders.push({ x, z, r });
  const rand = mulberry32(42);

  // ---------- 하늘 (sky.js). 예전 별 배치가 쓰던 난수를 그대로 소비해서 나머지 배치(나무 등)가 바뀌지 않게 한다
  for (let i = 0; i < 2200; i++) { rand(); rand(); rand(); if (!(rand() < 0.08)) rand(); }
  const sky = createSky(scene, { lowSpec });

  // ---------- 조명
  const hemi = new THREE.HemisphereLight('#6f7fd8', '#1a2418', 0.45);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#3a3f7a', 0.18);
  scene.add(ambient);
  const moonLight = new THREE.DirectionalLight('#9fb2ff', 0.55);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.setScalar(lowSpec ? 1024 : 2048);
  const sc = moonLight.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 140;
  moonLight.shadow.bias = -0.0005;
  moonLight.shadow.normalBias = 0.03;
  scene.add(moonLight, moonLight.target);
  const moonOffset = new THREE.Vector3(-0.45, 0.8, -0.78).normalize().multiplyScalar(60);

  // ---------- 지면
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.maxX - W.minX, W.maxZ - W.minZ),
    toon('#ffffff', { map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), toon('#3f7a3a'));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  // ---------- 울타리
  {
    const posts = [];
    const rails = [];
    const fx = BOUNDS.maxX + 1, fz = BOUNDS.maxZ + 1;
    const addLine = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.round(len / 2.5);
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= n; i++) {
        const x = x1 + ((x2 - x1) * i) / n, z = z1 + ((z2 - z1) * i) / n;
        posts.push({ x, y: 0.5, z, color: i % 2 ? '#8a5e3a' : '#7d5434' });
        if (i < n) {
          const mx = x + (x2 - x1) / n / 2, mz = z + (z2 - z1) / n / 2;
          rails.push({ x: mx, y: 0.75, z: mz, ry: -ang, sx: len / n });
          rails.push({ x: mx, y: 0.4, z: mz, ry: -ang, sx: len / n });
        }
      }
    };
    addLine(-fx, -fz, fx, -fz); addLine(fx, -fz, fx, fz); addLine(fx, fz, -fx, fz); addLine(-fx, fz, -fx, -fz);
    scene.add(instanced(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 6), toon('#ffffff'), posts));
    scene.add(instanced(new THREE.BoxGeometry(1, 0.08, 0.06), toon('#9a6a42'), rails));
  }

  // ---------- 가로등
  const lampHeadMat = glow('#ffcf85', 4);
  function lamp(x, z, withLight, color = '#ffb565', intensity = 9) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.8, 8), toon('#3b3229'));
    pole.position.y = 1.4;
    pole.castShadow = true;
    occluders.push({ mesh: pole, x, z, r: 0.09 });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 8), toon('#3b3229'));
    cap.position.y = 3.2;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.34, 8, 1, true), toon('#4a3e32', { side: THREE.DoubleSide, wireframe: false, transparent: true, opacity: 0.35 }));
    cage.position.y = 2.98;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampHeadMat);
    bulb.position.y = 2.96;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb766', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.6);
    halo.position.y = 2.96;
    g.add(pole, cap, cage, bulb, halo);
    scene.add(g);
    addCol(x, z, 0.25);
    if (withLight) lightSpots.push({ pos: new THREE.Vector3(x, 2.8, z), color: new THREE.Color(color), intensity, distance: 15 });
    // 바닥에 은은한 빛 웅덩이
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffae5c', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, z);
    scene.add(pool);
  }
  [[-40, 3.4], [-28, -3.4], [-18, 3.4], [18, -3.4], [28, 3.4], [38, -3.4]].forEach(([x, z], i) => lamp(x, z, i % 2 === 0 || true));
  // 텐트 진입로 작은 가로등 (빛 없이 발광만)
  for (const t of TENTS) lamp(t.x + 1.9, Math.sign(t.z) * 9.5, false);

  // ---------- 공터 전구 줄 (가운데 기둥에서 방사형)
  {
    const center = new THREE.Vector3(0, 5.2, 0);
    const cpole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 8), toon('#6b4a2b'));
    cpole.position.set(0, 2.7, 0);
    cpole.castShadow = true;
    scene.add(cpole);
    occluders.push({ mesh: cpole, x: 0, z: 0, r: 0.13 });
    addCol(0, 0, 0.3);
    const wireMat = new THREE.LineBasicMaterial({ color: '#2a2320' });
    const colors = ['#ffcf7a', '#ff9b6a', '#ffe9a8', '#9fe3ff', '#ffa8d6', '#b8ff9a'];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.25;
      const px = Math.cos(a) * 12.6, pz = Math.sin(a) * 12.6;
      if (isPath(px, pz) && Math.abs(pz) < 2.6) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8), toon('#6b4a2b'));
      pole.position.set(px, 1.8, pz);
      pole.castShadow = true;
      scene.add(pole);
      occluders.push({ mesh: pole, x: px, z: pz, r: 0.09 });
      addCol(px, pz, 0.25);
      const end = new THREE.Vector3(px, 3.55, pz);
      const pts = [];
      const segs = 30;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const p = new THREE.Vector3().lerpVectors(center, end, u);
        p.y -= Math.sin(u * Math.PI) * 1.1;
        pts.push(p);
        if (s % 2 === 1) bulbs.push({ x: p.x, y: p.y - 0.12, z: p.z, color: colors[(s + i) % colors.length] });
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }

  // ---------- 글램핑 텐트
  const canvasMat = toon('#f2e6cf', { emissive: new THREE.Color('#6a4520'), emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const roofMat = toon('#eadbbd', { emissive: new THREE.Color('#5a3a18'), emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const deckMat = toon('#9b6a43');
  const doorMat = glow('#ffb35c', 2.2);
  const flapMat = toon('#e2d1ae', { side: THREE.DoubleSide, emissive: new THREE.Color('#7a5020'), emissiveIntensity: 0.6 });
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.8, 0); doorShape.lineTo(0.8, 0); doorShape.lineTo(0, 2.0); doorShape.closePath();
  const doorGeo = new THREE.ShapeGeometry(doorShape);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(0, 0); flapShape.lineTo(0.55, 0); flapShape.lineTo(0, 2.0); flapShape.closePath();
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  const wallGeo = new THREE.CylinderGeometry(3, 3, 1.5, 28, 1, true);
  const roofGeo = new THREE.ConeGeometry(3.35, 2.6, 28, 1, true);
  const deckGeo = new THREE.BoxGeometry(8, 0.15, 8.5);
  const bunting = ['#ff7a6b', '#ffd36b', '#7fd3a8', '#7fb6ff', '#d59bff'];

  for (const t of TENTS) {
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.facing;
    scene.add(g);

    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 0.075, 0.7);
    deck.receiveShadow = true;
    deck.castShadow = true;
    g.add(deck);
    const dz = t.z + Math.cos(t.facing) * 0.7;
    decks.push({ minX: t.x - 4, maxX: t.x + 4, minZ: dz - 4.25, maxZ: dz + 4.25, h: 0.15 });

    const wall = new THREE.Mesh(wallGeo, canvasMat);
    wall.position.y = 0.15 + 0.75;
    wall.castShadow = true;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.15 + 1.5 + 1.3;
    roof.castShadow = true;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), toon('#6b4a2b'));
    tip.position.y = 4.4;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), toon(bunting[TENTS.indexOf(t) % bunting.length], { side: THREE.DoubleSide }));
    flag.position.set(0.24, 4.55, 0);
    g.add(wall, roof, tip, flag);
    updaters.push((time) => { flag.rotation.y = Math.sin(time * 2 + t.x) * 0.3; });

    // 열린 문 (안쪽 불빛)
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.16, 2.97);
    g.add(door);
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(flapGeo, flapMat);
      flap.position.set(side * 0.82, 0.16, 3.05);
      flap.scale.x = -side;
      flap.rotation.y = side * -0.5;
      g.add(flap);
    }
    // 문 앞 빛
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ff9f4a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.17, 3.6);
    g.add(spill);

    // 지붕 둘레 전구
    const local = new THREE.Vector3();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      local.set(Math.cos(a) * 3.12, 1.72 - (i % 2) * 0.06, Math.sin(a) * 3.12);
      local.applyEuler(new THREE.Euler(0, t.facing, 0));
      bulbs.push({ x: t.x + local.x, y: local.y, z: t.z + local.z, color: i % 3 === 0 ? '#ffe6a6' : '#ffc17a' });
    }

    // 문 옆 랜턴 + 화분
    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), toon('#3b3229'));
    lanternPost.position.set(1.7, 0.7, 3.4);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glow('#ffcf85', 3.5));
    lantern.position.set(1.7, 1.3, 3.4);
    g.add(lanternPost, lantern);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.32, 10), toon('#c46a42'));
    pot.position.set(-1.8, 0.31, 3.3);
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), toon('#4d9a54'));
    plant.position.set(-1.8, 0.7, 3.3);
    plant.castShadow = true;
    g.add(pot, plant);

    // 쿨러 박스
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), toon(bunting[(TENTS.indexOf(t) + 2) % bunting.length]));
    cooler.position.set(2.8, 0.35, 2.3);
    cooler.rotation.y = 0.4;
    cooler.castShadow = true;
    g.add(cooler);

    addCol(t.x, t.z, 3.25);
  }

  // ---------- 장작 패는 곳
  const stumpMeshes = [];
  {
    const barkMat = toon('#6e4529');
    const ringMat = toon('#e2b77d');
    const logMat = toon('#8a5a36');
    const stumpGeo = new THREE.CylinderGeometry(0.5, 0.58, 0.36, 14);
    for (const s of STUMPS) {
      const stump = new THREE.Mesh(stumpGeo, [barkMat, ringMat, ringMat]);
      stump.position.set(s.x, 0.18, s.z);
      stump.castShadow = true;
      stump.receiveShadow = true;
      scene.add(stump);
      const log = new THREE.Group();
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), [logMat, ringMat, ringMat]);
      lg.castShadow = true;
      log.add(lg);
      log.position.set(s.x, 0.51, s.z);
      scene.add(log);
      stumpMeshes.push({ stump, log });
      addCol(s.x, s.z, 0.6);
    }
    // 통나무 더미
    const pileGeo = new THREE.CylinderGeometry(0.32, 0.32, 5, 12);
    const pile = [];
    const px = 51.5, pz = 1;
    let y = 0.32;
    for (let row = 0; row < 4; row++) {
      const n = 4 - row;
      for (let i = 0; i < n; i++) {
        pile.push({ x: px - (n - 1) * 0.33 + i * 0.66, y, z: pz, rx: Math.PI / 2, color: ['#7a4c2c', '#8a5a36', '#6b4226'][(i + row) % 3] });
      }
      y += 0.56;
    }
    scene.add(instanced(pileGeo, toon('#ffffff'), pile));
    const ends = pile.flatMap((p) => [{ ...p, z: p.z + 2.51 }, { ...p, z: p.z - 2.51 }]);
    scene.add(instanced(new THREE.CircleGeometry(0.31, 12), toon('#e2b77d', { side: THREE.DoubleSide }), ends.map((e) => ({ ...e, rx: 0 })), { cast: false }));
    for (const dz of [-1.5, 0, 1.5, 3]) addCol(px, pz + dz, 1.4);
    // 쪼갠 장작 더미
    const split = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
      split.push({ x: 40 + i * 0.32 + row * 0.16, y: 0.12 + row * 0.22, z: 6.5, rx: Math.PI / 2, ry: 0, sx: 1, sy: 1, sz: 1, color: '#b98455' });
    }
    scene.add(instanced(new THREE.BoxGeometry(0.22, 0.9, 0.2), toon('#ffffff'), split));
    addCol(40.9, 6.5, 1.1);
    // 꽂혀 있는 도끼 장식
    lamp(43.5, -6.2, true, '#ffb565', 10);
  }

  // ---------- 표지판
  function sign(x, z, text, { ry = 0, w = 2.2, h = 0.7, color } = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), toon('#6b4a2b'));
    post.position.y = 0.75;
    post.castShadow = true;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [
      toon('#a8794a'), toon('#a8794a'), toon('#a8794a'), toon('#a8794a'),
      toon('#ffffff', { map: textTexture(text, { w: 512, h: Math.round(512 * h / w), size: 54, ...(color ? { bg: color } : {}) }), emissive: new THREE.Color('#3a2a1a'), emissiveIntensity: 0.15 }),
      toon('#a8794a'),
    ]);
    board.position.y = 1.55;
    board.castShadow = true;
    g.add(post, board);
    scene.add(g);
    addCol(x, z, 0.3);
  }
  sign(38.5, -5.5, '🪓 장작 패는 곳');
  sign(-41, -4.8, '✨ 루미의 마법 가루');
  sign(-8.5, 9.5, '🔥 공터 모닥불', { w: 2.0 });

  // ---------- NPC 가루 공방 (서쪽)
  {
    const g = new THREE.Group();
    g.position.set(NPC.x, 0, NPC.z);
    scene.add(g);
    const wood = toon('#9b6a43');
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 3.4), wood);
    counter.position.set(1.25, 0.5, 0);
    counter.castShadow = true;
    counter.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 3.6), toon('#c58f5c'));
    top.position.set(1.25, 1.04, 0);
    g.add(counter, top);
    // 기둥 & 차양
    for (const [x, z] of [[1.6, -1.75], [1.6, 1.75], [-1.2, -1.75], [-1.2, 1.75]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 8), wood);
      p.position.set(x, 1.4, z);
      p.castShadow = true;
      g.add(p);
    }
    const stripe = document.createElement('canvas');
    stripe.width = 256; stripe.height = 32;
    const sg = stripe.getContext('2d');
    for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#fff1dc' : '#9a72e0'; sg.fillRect(i * 32, 0, 32, 32); }
    const stex = new THREE.CanvasTexture(stripe);
    stex.colorSpace = THREE.SRGBColorSpace;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 4.0), toon('#ffffff', { map: stex }));
    awning.position.set(0.3, 2.95, 0);
    awning.rotation.z = -0.22;
    awning.castShadow = true;
    g.add(awning);
    // 스캘럽 장식
    for (let i = 0; i < 8; i++) {
      const sc = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(i % 2 ? '#fff1dc' : '#9a72e0', { side: THREE.DoubleSide }));
      sc.position.set(1.95, 2.6, -1.75 + i * 0.5);
      g.add(sc);
    }
    // 뒷 선반
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.2), wood);
    shelf.position.set(-1.3, 0.9, 0);
    shelf.castShadow = true;
    g.add(shelf);
    const jarColors = ['#b26bff', '#55c8ff', '#5dff8f', '#ff6fb8', '#ffd447', '#38ffd6', '#ff4058'];
    const jarGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.26, 10);
    for (let i = 0; i < 7; i++) {
      const jar = new THREE.Mesh(jarGeo, glow(jarColors[i], 1.4));
      jar.position.set(1.25, 1.21, -1.35 + i * 0.45);
      g.add(jar);
      for (let r = 0; r < 2; r++) {
        const j2 = new THREE.Mesh(jarGeo, glow(jarColors[(i + r * 3) % 7], 1.1));
        j2.position.set(-1.0, 0.75 + r * 0.6, -1.3 + i * 0.43);
        g.add(j2);
      }
    }
    // 반짝이는 수정구
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glow('#c9a2ff', 1.6));
    orb.position.set(1.25, 1.35, 1.5);
    g.add(orb);
    updaters.push((t) => { orb.position.y = 1.35 + Math.sin(t * 2) * 0.05; });
    lightSpots.push({ pos: new THREE.Vector3(NPC.x + 3.2, 1.8, NPC.z), color: new THREE.Color('#d7b0ff'), intensity: 6, distance: 11 });
    addCol(NPC.x + 1.25, NPC.z - 1.1, 0.75);
    addCol(NPC.x + 1.25, NPC.z, 0.75);
    addCol(NPC.x + 1.25, NPC.z + 1.1, 0.75);
    addCol(NPC.x - 1.2, NPC.z, 1.4);
    addCol(NPC.x - 1.2, NPC.z - 1.6, 0.8);
    addCol(NPC.x - 1.2, NPC.z + 1.6, 0.8);
  }

  // ---------- 나무
  {
    const pines = [];
    const rounds = [];
    const tooClose = (x, z, list, d) => list.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);
    const blocked = (x, z) => {
      if (isPath(x, z)) return true;
      for (const t of TENTS) if ((x - t.x) ** 2 + (z - t.z) ** 2 < 5.5 ** 2) return true;
      for (const p of PITS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < 5 ** 2) return true;
      if ((x - 51.5) ** 2 + (z - 1) ** 2 < 5 ** 2) return true;
      if ((x - NPC.x) ** 2 + (z - NPC.z) ** 2 < 6 ** 2) return true;
      return false;
    };
    const all = [];
    let tries = 0;
    while (all.length < 330 && tries++ < 20000) {
      const x = (rand() * 2 - 1) * 95;
      const z = (rand() * 2 - 1) * 75;
      const inside = Math.abs(x) < BOUNDS.maxX + 1.5 && Math.abs(z) < BOUNDS.maxZ + 1.5;
      const ring = !inside;
      // 안쪽은 듬성듬성
      if (inside && rand() > 0.12) continue;
      if (Math.abs(x) < BOUNDS.maxX + 3 && Math.abs(z) < BOUNDS.maxZ + 3 && !inside) continue; // 울타리 바로 옆 비우기
      if (blocked(x, z)) continue;
      if (tooClose(x, z, all, inside ? 4 : 2.6)) continue;
      if (inside && Math.abs(z) > 20 && Math.abs(z) < 33 && TENTS.some((t) => Math.abs(t.x - x) < 5)) continue;
      const s = 0.8 + rand() * 0.7;
      const tree = { x, z, s, ry: rand() * 6.28, ring };
      all.push(tree);
      (rand() < 0.62 ? pines : rounds).push(tree);
      if (inside) addCol(x, z, 0.55 * s);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.3, 7);
    const trunkList = all.map((t) => ({ x: t.x, y: 0.65 * t.s, z: t.z, s: t.s, color: '#6b4428' }));
    scene.add(instanced(trunkGeo, toon('#ffffff'), trunkList));
    const greens = ['#2f6e48', '#3a7f50', '#2b6142', '#448a55'];
    const coneLayers = [[1.7, 2.0, 1.95], [1.3, 1.7, 2.95], [0.85, 1.4, 3.85]];
    for (const [r, h, y] of coneLayers) {
      const list = pines.map((t, i) => ({ x: t.x, y: y * t.s, z: t.z, ry: t.ry, s: t.s, color: greens[(i + Math.round(y)) % greens.length] }));
      scene.add(instanced(new THREE.ConeGeometry(r, h, 8), toon('#ffffff'), list));
    }
    const blobs = [];
    const rg = ['#4f9a58', '#5aa660', '#3f8a4c', '#6ab06a'];
    rounds.forEach((t, i) => {
      blobs.push({ x: t.x, y: 2.3 * t.s, z: t.z, s: 1.35 * t.s, color: rg[i % 4] });
      blobs.push({ x: t.x + 0.55 * t.s, y: 1.85 * t.s, z: t.z + 0.2 * t.s, s: 0.95 * t.s, color: rg[(i + 1) % 4] });
      blobs.push({ x: t.x - 0.5 * t.s, y: 1.95 * t.s, z: t.z - 0.3 * t.s, s: 1.0 * t.s, color: rg[(i + 2) % 4] });
    });
    scene.add(instanced(new THREE.IcosahedronGeometry(1, 2), toon('#ffffff'), blobs));
  }

  // ---------- 덤불, 풀, 꽃, 바위
  {
    const bushes = [];
    const tufts = [];
    const flowers = [];
    const rocks = [];
    let tries = 0;
    while (tufts.length < (lowSpec ? 1400 : 2600) && tries++ < 30000) {
      const x = (rand() * 2 - 1) * 58, z = (rand() * 2 - 1) * 40;
      if (isPath(x, z)) continue;
      if (TENTS.some((t) => Math.abs(x - t.x) < 4.2 && Math.abs(z - t.z) < 4.6)) continue;
      tufts.push({ x, y: 0.12, z, ry: rand() * 6, s: 0.7 + rand() * 0.8, color: rand() > 0.5 ? '#6fb35a' : '#5a9e4c' });
    }
    tries = 0;
    while (flowers.length < 420 && tries++ < 20000) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z)) continue;
      if (TENTS.some((t) => Math.abs(x - t.x) < 4.2 && Math.abs(z - t.z) < 4.6)) continue;
      flowers.push({ x, y: 0.18, z, s: 0.7 + rand() * 0.6, color: ['#ffe9f2', '#ffd1e6', '#fff3a8', '#c9d8ff', '#ffffff'][Math.floor(rand() * 5)] });
    }
    for (const t of TENTS) {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + (i / 3 - 0.5) * 2.2 + t.facing;
        bushes.push({ x: t.x + Math.sin(a) * 3.9, y: 0.35, z: t.z + Math.cos(a) * 4.1, s: 0.55 + rand() * 0.35, color: ['#3f8a4c', '#4f9a58'][i % 2] });
      }
    }
    tries = 0;
    while (bushes.length < 160 && tries++ < 5000) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z) || TENTS.some((t) => Math.abs(x - t.x) < 5 && Math.abs(z - t.z) < 5)) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 30 && rand() > 0.25) continue;
      bushes.push({ x, y: 0.3, z, s: 0.5 + rand() * 0.5, color: ['#3f8a4c', '#4f9a58', '#356f40'][Math.floor(rand() * 3)] });
    }
    for (let i = 0; i < 40; i++) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z)) continue;
      rocks.push({ x, y: 0.1, z, s: 0.25 + rand() * 0.4, rx: rand(), ry: rand() * 6, color: ['#8d8a94', '#a19ea8', '#77747f'][i % 3] });
    }
    scene.add(instanced(new THREE.IcosahedronGeometry(1, 1), toon('#ffffff'), bushes));
    scene.add(instanced(new THREE.ConeGeometry(0.07, 0.34, 3), toon('#ffffff'), tufts, { cast: false }));
    scene.add(instanced(new THREE.IcosahedronGeometry(0.07, 0), toon('#ffffff', { emissive: new THREE.Color('#3a3a55'), emissiveIntensity: 0.6 }), flowers, { cast: false }));
    scene.add(instanced(new THREE.DodecahedronGeometry(1, 0), toon('#ffffff'), rocks));
  }

  // ---------- 전구 (인스턴스)
  {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length);
    const c = new THREE.Color();
    bulbs.forEach((b, i) => {
      tmpM.makeTranslation(b.x, b.y, b.z);
      mesh.setMatrixAt(i, tmpM);
      mesh.setColorAt(i, c.set(b.color).multiplyScalar(3.2));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    // 반짝반짝
    const base = bulbs.map((b) => new THREE.Color(b.color).multiplyScalar(3.2));
    updaters.push((t) => {
      for (let k = 0; k < 6; k++) {
        const i = Math.floor(Math.random() * bulbs.length);
        mesh.setColorAt(i, c.copy(base[i]).multiplyScalar(0.75 + Math.random() * 0.4));
      }
      mesh.instanceColor.needsUpdate = true;
    });
  }

  // ---------- 반딧불이 (GPU 애니메이션)
  {
    const n = 220;
    const anchor = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    let i = 0;
    while (i < n) {
      const x = (rand() * 2 - 1) * 70, z = (rand() * 2 - 1) * 50;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      anchor.set([x, 0.6 + rand() * 2.2, z], i * 3);
      ph[i] = rand() * 100;
      i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(anchor, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aPhase) * 1.6 + sin(uTime * 0.71 + aPhase * 2.0) * 0.6;
          p.z += cos(uTime * 0.27 + aPhase * 1.3) * 1.6;
          p.y += sin(uTime * 0.9 + aPhase * 3.0) * 0.35;
          vA = pow(max(0.0, sin(uTime * 1.3 + aPhase * 5.0)), 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 0.16 * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * 2.5, smoothstep(0.5, 0.0, d) * vA); }`,
    });
    const ff = new THREE.Points(geo, mat);
    scene.add(ff);
    updaters.push((t, dt, shared) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = shared.uScale.value; });
  }

  function heightAt(x, z) {
    for (const d of decks) if (x > d.minX && x < d.maxX && z > d.minZ && z < d.maxZ) return d.h;
    return 0;
  }

  return {
    colliders,
    lightSpots,
    occluders,
    stumpMeshes,
    heightAt,
    moonLight,
    sky,
    update(t, dt, camera, focus, shared) {
      moonLight.position.copy(focus).add(moonOffset);
      moonLight.target.position.copy(focus);
      for (const u of updaters) u(t, dt, shared);
    },
  };
}
