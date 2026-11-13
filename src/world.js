import * as THREE from 'three';
import { toon, glow, radialTexture, textTexture, mulberry32 } from './toon.js';
import { createSky } from './sky.js';
import { CFG, TENTS, PITS, STUMPS, NPC, KEEPER, WOODYARD, BOUNDS, TENT_WH, TENT_RH, EGG } from '../shared/config.js';

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
  if ((x - (NPC.x + NPC.front.x)) ** 2 + (z - (NPC.z + NPC.front.z)) ** 2 < 6.2 * 6.2) return true;
  if ((x - KEEPER.x) ** 2 + (z - (KEEPER.z + 1.2)) ** 2 < 4.2 * 4.2) return true; // 창고 앞마당
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
  circle(NPC.x + NPC.front.x, NPC.z + NPC.front.z, 6.2);
  circle(KEEPER.x, KEEPER.z + 1.2, 4.2);
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
  tex.userData.canvas = cv;
  return tex;
}
/** 테마용 땅: 기본 잔디 그림 위에 덧칠한다 ('wet' 비에 젖은 땅 · 'snow' 눈 덮인 땅) */
function themedGround(baseCanvas, kind) {
  const cv = document.createElement('canvas');
  cv.width = baseCanvas.width; cv.height = baseCanvas.height;
  const g = cv.getContext('2d');
  g.drawImage(baseCanvas, 0, 0);
  const PX = 20, w = cv.width, h = cv.height;
  const X = (x) => (x - W.minX) * PX, Z = (z) => (z - W.minZ) * PX;
  const rand = mulberry32(kind === 'snow' ? 11 : 13);
  if (kind === 'wet') {
    g.fillStyle = 'rgba(10, 18, 32, 0.16)'; g.fillRect(0, 0, w, h); // 살짝만 젖은 빛 (너무 어둡지 않게)
    // 길 위 물웅덩이
    for (let i = 0; i < 2600 && i < 9999; i++) {
      const x = rand() * w, y = rand() * h;
      if (!isPath(x / PX + W.minX, y / PX + W.minZ) || rand() > 0.06) continue;
      const rx = (0.4 + rand() * 1.1) * PX, ry = rx * (0.45 + rand() * 0.3);
      g.fillStyle = 'rgba(40, 55, 80, 0.55)';
      g.beginPath(); g.ellipse(x, y, rx, ry, rand() * 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(170, 190, 220, 0.25)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x - rx * 0.15, y - ry * 0.2, rx * 0.6, ry * 0.5, rand() * 3, 3.6, 5.2); g.stroke();
    }
  } else if (kind === 'snow') {
    g.fillStyle = 'rgba(236, 241, 250, 0.88)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) { // 눈결
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(190,205,230,0.35)';
      g.fillRect(rand() * w, rand() * h, 2, 2);
    }
    // 사람들이 다닌 길은 살짝 밟혀 회색빛
    for (let i = 0; i < 26000; i++) {
      const x = rand() * w, y = rand() * h;
      if (!isPath(x / PX + W.minX, y / PX + W.minZ)) continue;
      g.fillStyle = rand() > 0.5 ? 'rgba(170,175,190,0.35)' : 'rgba(150,140,130,0.25)';
      g.fillRect(x, y, 3 + rand() * 4, 3 + rand() * 4);
    }
    // 화로 둘레는 불 기운에 눈이 녹았다
    for (const p of PITS) {
      const grd = g.createRadialGradient(X(p.x), Z(p.z), 0, X(p.x), Z(p.z), 2.6 * PX);
      grd.addColorStop(0, 'rgba(95,75,60,0.85)');
      grd.addColorStop(0.6, 'rgba(120,110,105,0.45)');
      grd.addColorStop(1, 'rgba(120,110,105,0)');
      g.fillStyle = grd;
      g.fillRect(X(p.x) - 2.6 * PX, Z(p.z) - 2.6 * PX, 5.2 * PX, 5.2 * PX);
    }
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
  const moonLight = new THREE.DirectionalLight('#9fb2ff', 0.45); // 달빛 (눈부시다는 의견에 0.55 → 0.45)
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.setScalar(lowSpec ? 1024 : 2048);
  const sc = moonLight.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 140;
  moonLight.shadow.bias = -0.0005;
  moonLight.shadow.normalBias = 0.03;
  scene.add(moonLight, moonLight.target);
  const moonOffset = new THREE.Vector3(-0.45, 0.8, -0.78).normalize().multiplyScalar(60);

  // ---------- 지면
  const groundTex = { grass: groundTexture() };
  const groundMat = toon('#ffffff', { map: groundTex.grass });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX, W.maxZ - W.minZ), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outerMat = toon('#3f7a3a', {});
  // 테마에 따라 켜고 끄는 것들 (setTheme)
  const themeParts = { snow: [], grass: [], tarps: [], fireflies: null, xmas: [], xmasTwinkle: [] };
  const XMAS = ['#ff3b3b', '#ffd23b', '#3bff6e', '#3bb8ff', '#ff7ad9', '#ffa53b', '#ffffff'];
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), outerMat);
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
  [[-40, 3.4], [-28, -3.4], [-18, 3.4], [18, -3.4], [28, 3.4]].forEach(([x, z], i) => lamp(x, z, i % 2 === 0 || true));
  // 텐트 진입로 작은 가로등 (빛 없이 발광만)
  // 광장 한가운데 줄(x=0) 텐트는 가로등 없음: 광장 전구 줄이 밝혀 주고, 있으면 방명록 · 게시판이나 입구 화면을 가린다
  for (const t of TENTS) if (Math.abs(t.x) > 1) lamp(t.x + 1.9, Math.sign(t.z) * 9.5, false);

  // ---------- 광장 전구 줄 (가운데 기둥에서 방사형)
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
  const deckMat = toon('#9b6a43', {}); // 따로 만든 재질 (테마에서 색을 바꿔도 다른 나무 소품에 번지지 않게)
  const doorMat = glow('#ffb35c', 0.95); // 문 안쪽 불빛: 눈부시지 않게 은은하게 (2.2 → 0.95)
  const flapMat = toon('#e2d1ae', { side: THREE.DoubleSide, emissive: new THREE.Color('#7a5020'), emissiveIntensity: 0.6 });
  // 문: 사람이 드나들 수 있게 어깨가 있는 오각형 (v1.15부터 텐트 안에 들어갈 수 있다)
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.9, 0); doorShape.lineTo(0.9, 0); doorShape.lineTo(0.9, 1.25); doorShape.lineTo(0, 2.0); doorShape.lineTo(-0.9, 1.25); doorShape.closePath();
  const doorGeo = new THREE.ShapeGeometry(doorShape);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(0, 0); flapShape.lineTo(0.45, 0); flapShape.lineTo(0, 1.9); flapShape.closePath();
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  // 텐트 크기: 둥근 벽 반지름 TR (v1.15: 안에 화로와 둥근 소파가 들어가게 3 → 6.2, 층고도 높였다)
  const TR = CFG.TENT_R, WH = TENT_WH, RH = TENT_RH; // 벽 높이 · 지붕 높이
  // 창문: 벽 천에 구멍(alphaMap)을 내고 나무 창틀 + 유리. 밖에서는 안쪽 불빛이 비치는 따뜻한 유리, 들어간 텐트에서는 맑은 유리 (tent.js)
  const WIN_DEG = [65, 120, 180, 240, 295], WIN_W = 1.1, WIN_Y0 = 0.95, WIN_Y1 = 2.1;
  {
    const cv = document.createElement('canvas');
    cv.width = 2048; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#000';
    const du = WIN_W / (Math.PI * 2 * TR);
    for (const d of WIN_DEG) {
      const u = d / 360;
      cx.fillRect((u - du / 2) * cv.width, (1 - WIN_Y1 / WH) * cv.height, du * cv.width, ((WIN_Y1 - WIN_Y0) / WH) * cv.height);
    }
    canvasMat.alphaMap = new THREE.CanvasTexture(cv);
    canvasMat.alphaTest = 0.5;
  }
  const winFrameMat = toon('#7a5233');
  const winGlassGeo = new THREE.PlaneGeometry(WIN_W, WIN_Y1 - WIN_Y0);
  const winBarH = new THREE.BoxGeometry(WIN_W + 0.16, 0.08, 0.14);
  const winBarV = new THREE.BoxGeometry(0.08, WIN_Y1 - WIN_Y0 + 0.08, 0.14);
  const winMullion = new THREE.BoxGeometry(0.04, WIN_Y1 - WIN_Y0, 0.08);
  const wallGeo = new THREE.CylinderGeometry(TR, TR, WH, 36, 1, true);
  const roofGeo = new THREE.ConeGeometry(TR + 0.4, RH, 36, 1, true);
  const DW = TR * 2 + 0.9, DD = TR * 2 + 1.4, DZ = 0.4; // 데크 (문 앞이 조금 더 길다)
  const deckGeo = new THREE.BoxGeometry(DW, 0.15, DD);
  const bunting = ['#ff7a6b', '#ffd36b', '#7fd3a8', '#7fb6ff', '#d59bff'];

  const tents = new Map(); // id -> 텐트 안에 들어갔을 때 숨기거나 흐리게 할 부분
  for (const t of TENTS) {
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.facing;
    scene.add(g);

    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 0.075, DZ);
    deck.receiveShadow = true;
    deck.castShadow = true;
    g.add(deck);
    const dz = t.z + Math.cos(t.facing) * DZ;
    decks.push({ minX: t.x - DW / 2, maxX: t.x + DW / 2, minZ: dz - DD / 2, maxZ: dz + DD / 2, h: 0.15 });

    const wall = new THREE.Mesh(wallGeo, canvasMat);
    wall.position.y = 0.15 + WH / 2;
    wall.castShadow = true;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.15 + WH + RH / 2;
    roof.castShadow = true;
    // 지붕 꼭대기: 안 화로의 연통이 뚫고 나온다 (연통 · 연기는 fire.js). 깃발은 연통 옆에
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.12, 12), toon('#6b4a2b'));
    tip.position.y = 0.15 + WH + RH - 0.1;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), toon(bunting[TENTS.indexOf(t) % bunting.length], { side: THREE.DoubleSide }));
    flag.position.set(0.42, 0.15 + WH + RH + 0.55, 0);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 5), toon('#6b4a2b'));
    flagPole.position.set(0.2, 0.15 + WH + RH + 0.3, 0);
    g.add(wall, roof, tip, flag, flagPole);
    // 창문
    const glassMat = new THREE.MeshBasicMaterial({ color: '#ffb766', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const glass = [];
    for (const d of WIN_DEG) {
      const a = (d * Math.PI) / 180;
      const w = new THREE.Group();
      w.position.set(Math.sin(a) * (TR - 0.01), 0.15, Math.cos(a) * (TR - 0.01));
      w.rotation.y = a;
      const gl = new THREE.Mesh(winGlassGeo, glassMat);
      gl.position.y = (WIN_Y0 + WIN_Y1) / 2;
      glass.push(gl);
      const top = new THREE.Mesh(winBarH, winFrameMat); top.position.y = WIN_Y1 + 0.04;
      const bot = new THREE.Mesh(winBarH, winFrameMat); bot.position.y = WIN_Y0 - 0.04;
      const l = new THREE.Mesh(winBarV, winFrameMat); l.position.set(-WIN_W / 2 - 0.04, (WIN_Y0 + WIN_Y1) / 2, 0);
      const r = new THREE.Mesh(winBarV, winFrameMat); r.position.set(WIN_W / 2 + 0.04, (WIN_Y0 + WIN_Y1) / 2, 0);
      const mu = new THREE.Mesh(winMullion, winFrameMat); mu.position.y = (WIN_Y0 + WIN_Y1) / 2;
      const mh = new THREE.Mesh(new THREE.BoxGeometry(WIN_W, 0.04, 0.08), winFrameMat); mh.position.y = (WIN_Y0 + WIN_Y1) / 2;
      w.add(gl, top, bot, l, r, mu, mh);
      g.add(w);
    }
    updaters.push((time) => { flag.rotation.y = Math.sin(time * 2 + t.x) * 0.3; });

    // 열린 문 (안쪽 불빛)
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.16, TR - 0.03);
    g.add(door);
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(flapGeo, flapMat);
      flap.position.set(side * 0.92, 0.16, TR + 0.05);
      flap.scale.x = -side;
      flap.rotation.y = side * -0.5;
      g.add(flap);
    }
    // 문 앞 빛
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ff9f4a', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.17, TR + 0.6);
    g.add(spill);

    // 지붕 둘레 전구
    const local = new THREE.Vector3();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      local.set(Math.cos(a) * (TR + 0.12), 0.15 + WH + 0.07 - (i % 2) * 0.06, Math.sin(a) * (TR + 0.12));
      local.applyEuler(new THREE.Euler(0, t.facing, 0));
      bulbs.push({ x: t.x + local.x, y: local.y, z: t.z + local.z, color: i % 3 === 0 ? '#ffe6a6' : '#ffc17a', tent: true });
    }

    // 문 옆 랜턴 + 화분
    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), toon('#3b3229'));
    lanternPost.position.set(1.9, 0.7, TR + 0.45);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glow('#ffcf85', 3.5));
    lantern.position.set(1.9, 1.3, TR + 0.45);
    g.add(lanternPost, lantern);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.32, 10), toon('#c46a42'));
    pot.position.set(-2.0, 0.31, TR + 0.35);
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), toon('#4d9a54'));
    plant.position.set(-2.0, 0.7, TR + 0.35);
    plant.castShadow = true;
    g.add(pot, plant);

    // 쿨러 박스
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), toon(bunting[(TENTS.indexOf(t) + 2) % bunting.length]));
    cooler.position.set((TR + 0.7) * 0.7, 0.35, (TR + 0.7) * 0.7);
    cooler.rotation.y = 0.4;
    cooler.castShadow = true;
    g.add(cooler);

    colliders.push({ x: t.x, z: t.z, r: TR + 0.25, tent: t }); // 텐트 벽: 문으로는 드나들 수 있게 main.js 에서 따로 처리
    tents.set(t.id, { wall, roof, tip, flag, door, spill, glass, glassMat, group: g });
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
    const px = WOODYARD.x + 6.5, pz = WOODYARD.z + 1;
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
    // (쪼갠 장작 더미는 북서쪽 장작 창고 안에 쌓여 있다)
    // 꽂혀 있는 도끼 장식
    lamp(WOODYARD.x - 4.5, WOODYARD.z + 5.7, true, '#ffb565', 10); // 장작 패는 곳 앞 큰길 가
  }

  // ---------- 광장 꾸미기: 가장자리 벤치 4개(가운데를 바라봄) + 방명록 · 게시판 옆 꽃 화분
  {
    const seatMat = toon('#a8743f'), legMat = toon('#5e4129');
    const seatGeo = new THREE.BoxGeometry(2.0, 0.09, 0.55), backGeo = new THREE.BoxGeometry(2.0, 0.42, 0.08), legGeo = new THREE.BoxGeometry(0.1, 0.45, 0.5);
    for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
      const r = 8.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const b = new THREE.Group();
      b.position.set(x, 0, z);
      b.rotation.y = Math.atan2(-x, -z); // 광장 가운데를 본다
      const seat = new THREE.Mesh(seatGeo, seatMat); seat.position.y = 0.47;
      const back = new THREE.Mesh(backGeo, seatMat); back.position.set(0, 0.78, -0.27); back.rotation.x = -0.12;
      b.add(seat, back);
      for (const s of [-0.85, 0.85]) { const l = new THREE.Mesh(legGeo, legMat); l.position.set(s, 0.22, 0); b.add(l); }
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(b);
      addCol(x, z, 1.0);
    }
    const potMat = toon('#9b6a43'), soil = toon('#4a3324');
    const flowerCols = ['#ff8fb1', '#ffd36b', '#b8a2ff', '#ffffff', '#ff9f6b'];
    for (const [px, pz] of [[-5.9, 4.2], [5.9, 4.2], [0, 4.4]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.5, 10), potMat);
      pot.position.set(px, 0.25, pz);
      const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 10), soil);
      dirt.position.set(px, 0.5, pz);
      scene.add(pot, dirt);
      for (let i = 0; i < 7; i++) {
        const ang = i * 0.9 + px, rr = i === 0 ? 0 : 0.3;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), toon(flowerCols[(i + Math.round(px)) % flowerCols.length], { emissive: new THREE.Color(flowerCols[i % flowerCols.length]), emissiveIntensity: 0.15 }));
        fl.position.set(px + Math.cos(ang) * rr, 0.66 + (i % 3) * 0.05, pz + Math.sin(ang) * rr);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), toon('#4f8f4a'));
        leaf.position.set(fl.position.x, 0.56, fl.position.z);
        scene.add(fl, leaf);
      }
      pot.castShadow = true;
      addCol(px, pz, 0.6);
    }
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
  sign(WOODYARD.x - 8, WOODYARD.z + 1, '🪓 장작 패는 곳', { ry: -Math.PI / 2 }); // 광장 쪽(서쪽)을 본다
  sign(NPC.x - 6, NPC.z - 2.4, '✨ 루미의 마법 가루', { ry: -Math.PI / 2 });
  sign(-8.5, 9.5, '🏕️ 불멍 캠핑장 광장', { w: 2.4 });
  sign(KEEPER.x - 4.4, KEEPER.z + 2.0, '📦 장작 창고'); // 오두막 서쪽 앞 (광장에서 오면 먼저 보인다)

  // ---------- 장작 창고 (장작 패는 곳 북서쪽). 앞이 트인 나무 오두막에 장작이 가득, 창고지기 보리가 앞에 선다
  {
    const cx = KEEPER.x, cz = KEEPER.z - 2.6; // 오두막 가운데 (보리 뒤)
    const W2 = 2.8, D2 = 1.6, H = 2.5;          // 반폭 · 반깊이 · 처마 높이
    const plank = toon('#8a5a36'), dark = toon('#5e3d24'), roofMat = toon('#6d4a34');
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    scene.add(g);
    const box = (w, h, d, x, y, z, m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
      return b;
    };
    box(W2 * 2 + 0.2, 0.18, D2 * 2 + 0.2, 0, 0.09, 0, dark);           // 바닥
    box(W2 * 2, H + 0.4, 0.14, 0, (H + 0.4) / 2, -D2, plank);          // 뒷벽 (뒤가 높다)
    for (const sx of [-1, 1]) box(0.14, H, D2 * 2, sx * W2, H / 2, 0, plank); // 옆벽
    for (const sx of [-1, 1]) box(0.16, H, 0.16, sx * W2, H / 2, D2, dark);   // 앞기둥
    box(W2 * 2 + 0.2, 0.16, 0.16, 0, H, D2, dark);                      // 앞 들보
    const roof = box(W2 * 2 + 0.9, 0.14, D2 * 2 + 1.0, 0, H + 0.38, 0.1, roofMat);
    roof.rotation.x = 0.2;                                              // 앞(남쪽)으로 기운 외지붕
    // 안에 가득 쌓인 쪼갠 장작 (앞에서 보이는 단면)
    const logs = [];
    const shades = ['#b98455', '#a8743f', '#c99566', '#9c6a3c'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 15; i++) {
      logs.push({ x: -W2 + 0.4 + i * 0.34 + (row % 2) * 0.17, y: 0.34 + row * 0.3, z: -0.2, rx: Math.PI / 2, color: shades[(i * 3 + row) % 4] });
    }
    g.add(instanced(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 7), toon('#ffffff'), logs));
    // 보리 옆 낮은 장작 받침대 (맡긴 장작을 올려 두는 곳)
    box(1.3, 0.5, 0.8, 2.0, 0.25, D2 + 1.1, plank);
    const top = [];
    for (let i = 0; i < 4; i++) top.push({ x: 1.55 + i * 0.3, y: 0.62, z: D2 + 1.1, rx: Math.PI / 2, color: shades[i % 4] });
    g.add(instanced(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 7), toon('#ffffff'), top));
    // 처마 끝 랜턴 (발광만) + 앞마당 가로등
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glow('#ffcf85', 3));
    lantern.position.set(-W2 + 0.3, H - 0.25, D2 + 0.1);
    g.add(lantern);
    lamp(cx + W2 + 1.5, KEEPER.z + 0.6, true, '#ffb565', 8);
    // 충돌: 오두막 뒤 · 옆 (앞은 트여 있어도 장작이 막고 있다), 받침대
    for (const dx of [-2.1, -0.7, 0.7, 2.1]) addCol(cx + dx, cz - 0.4, 1.0);
    addCol(cx + 2.0, cz + D2 + 1.1, 0.7);
  }

  // ---------- NPC 가루 공방 (동쪽 장작 마당, 큰길 남쪽, 광장 쪽을 본다)
  {
    const g = new THREE.Group();
    g.position.set(NPC.x, 0, NPC.z);
    g.rotation.y = NPC.face;
    // 공방 모형 안의 위치(dx, dz)를 실제 위치로 (모형은 +x 쪽이 앞)
    const at = (dx, dz) => {
      const c = Math.cos(NPC.face), sn = Math.sin(NPC.face);
      return [NPC.x + dx * c + dz * sn, NPC.z - dx * sn + dz * c];
    };
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
    { const [lx, lz] = at(3.2, 0); lightSpots.push({ pos: new THREE.Vector3(lx, 1.8, lz), color: new THREE.Color('#d7b0ff'), intensity: 6, distance: 11 }); }
    for (const [dx, dz, r] of [[1.25, -1.1, 0.75], [1.25, 0, 0.75], [1.25, 1.1, 0.75], [-1.2, 0, 1.4], [-1.2, -1.6, 0.8], [-1.2, 1.6, 0.8]]) addCol(...at(dx, dz), r);
  }
  // ---------- 우중캠핑장: 바깥 모닥불마다 비를 막는 천막 (평소에는 숨김)
  // 불 위에 천이 바로 닿지 않게: 높이 4.1m, 한가운데는 뚫어서 열기 · 연기가 빠지고, 그 위에 작은 지붕을 띄워 비만 막는다 (이중 지붕)
  // 카메라가 위에서 내려다보면 불이 가리지 않게 반투명해진다 (update)
  const TARP_H = 4.1;
  {
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.07, TARP_H + 0.05, 7);
    const roofGeo = new THREE.CylinderGeometry(1.15, 5.3, 0.95, 4, 1, true); // 가운데가 뚫린 사각 지붕
    const capGeo = new THREE.ConeGeometry(1.75, 0.6, 4, 1, true);           // 구멍 위에 띄운 작은 지붕
    const capPostGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5);
    const trimGeo = new THREE.BoxGeometry(7.4, 0.12, 0.08);
    const poleMat = toon('#4a3626');
    for (const p of PITS) {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.visible = false;
      const mat = toon('#3f5d68', { side: THREE.DoubleSide, emissive: new THREE.Color('#1a1410'), emissiveIntensity: 0.3, transparent: true, opacity: 1 });
      const trimMat = toon('#d9c7a2', { transparent: true, opacity: 1 });
      for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, (TARP_H + 0.05) / 2, z); pole.castShadow = true; g.add(pole);
      }
      const roof = new THREE.Mesh(roofGeo, mat);
      roof.rotation.y = Math.PI / 4; roof.position.y = TARP_H + 0.47;
      roof.castShadow = true; roof.receiveShadow = true;
      const cap = new THREE.Mesh(capGeo, mat);
      cap.rotation.y = Math.PI / 4; cap.position.y = TARP_H + 0.95 + 0.42 + 0.3;
      cap.castShadow = true;
      g.add(roof, cap);
      for (const [x, z] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) { // 작은 지붕을 받치는 짧은 기둥 (사이로 연기가 빠진다)
        const cp = new THREE.Mesh(capPostGeo, poleMat); cp.position.set(x, TARP_H + 0.95 + 0.2, z); g.add(cp);
      }
      for (const [x, z, ry] of [[0, -3.7, 0], [0, 3.7, 0], [-3.7, 0, Math.PI / 2], [3.7, 0, Math.PI / 2]]) { // 처마 테두리
        const t = new THREE.Mesh(trimGeo, trimMat); t.position.set(x, TARP_H + 0.02, z); t.rotation.y = ry; g.add(t);
      }
      scene.add(g);
      themeParts.tarps.push({ g, mats: [mat, trimMat], x: p.x, z: p.z, fade: 1 });
    }
  }

  // ---------- 숨겨진 가루병 (이스터에그): 루미 공방 뒤 선반 너머 풀숲에 쓰러진 작은 병. 가까이 가야 반짝임이 보인다
  let egg;
  {
    egg = new THREE.Group();
    egg.position.set(EGG.x, 0, EGG.z);
    const jarMat = glow('#c9a2ff', 1.1);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 10), jarMat);
    jar.rotation.z = Math.PI / 2 - 0.25; jar.position.y = 0.1;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), toon('#a57a4e'));
    cork.rotation.z = Math.PI / 2 - 0.25; cork.position.set(0.14, 0.135, 0);
    egg.add(jar, cork);
    for (let i = 0; i < 6; i++) { // 덮어 둔 풀
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.38, 3), toon(i % 2 ? '#3f7a45' : '#4f8f50'));
      b.position.set((Math.random() - 0.5) * 0.4, 0.17, (Math.random() - 0.5) * 0.35);
      b.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
      egg.add(b);
    }
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#e2c8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    spark.position.y = 0.32; spark.scale.setScalar(0.35);
    egg.add(spark);
    scene.add(egg);
    const hue = new THREE.Color();
    updaters.push((t) => {
      if (!egg.visible) return;
      hue.setHSL((t * 0.08) % 1, 0.8, 0.72);
      jarMat.color.copy(hue).multiplyScalar(1.1);
      const tw = Math.max(0, Math.sin(t * 2.3)) ** 6; // 가끔 반짝
      spark.material.opacity = 0.15 + tw * 0.7;
      spark.scale.setScalar(0.3 + tw * 0.35);
    });
  }

  // ---------- 나무
  {
    const pines = [];
    const rounds = [];
    const tooClose = (x, z, list, d) => list.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);
    const blocked = (x, z) => {
      if (isPath(x, z)) return true;
      for (const t of TENTS) if ((x - t.x) ** 2 + (z - t.z) ** 2 < (CFG.TENT_R + 2.8) ** 2) return true;
      for (const p of PITS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < 5 ** 2) return true;
      if ((x - (WOODYARD.x + 6.5)) ** 2 + (z - (WOODYARD.z + 1)) ** 2 < 5 ** 2) return true;
      if ((x - NPC.x) ** 2 + (z - NPC.z) ** 2 < 6 ** 2) return true;
      if ((x - KEEPER.x) ** 2 + (z - (KEEPER.z - 2.5)) ** 2 < 6.5 ** 2) return true;
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
      if (inside && Math.abs(z) > 20 && Math.abs(z) < 37 && TENTS.some((t) => Math.abs(t.x - x) < CFG.TENT_R + 1.8)) continue;
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
    // 설산: 나뭇잎 위에 쌓인 눈 (평소에는 숨김)
    const snowMat = toon('#f4f7fd', { emissive: new THREE.Color('#2a3350'), emissiveIntensity: 0.35 });
    for (const [r, h, y] of coneLayers) {
      const list = pines.map((t) => ({ x: t.x, y: (y + h * 0.18) * t.s, z: t.z, ry: t.ry, s: t.s }));
      const m = instanced(new THREE.ConeGeometry(r * 0.78, h * 0.62, 8), snowMat, list, { cast: false });
      m.visible = false; scene.add(m); themeParts.snow.push(m);
    }
    const caps = blobs.map((b) => ({ x: b.x, y: b.y + b.s * 0.42, z: b.z, sx: b.s * 0.92, sy: b.s * 0.5, sz: b.s * 0.92 }));
    const capMesh = instanced(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat, caps, { cast: false });
    capMesh.visible = false; scene.add(capMesh); themeParts.snow.push(capMesh);
    // 크리스마스: 바늘잎나무마다 색색 전구 (캠핑장 안 · 가까운 숲만)
    const lights = [];
    const lr = mulberry32(99);
    for (const t of pines) {
      if (Math.abs(t.x) > 75 || Math.abs(t.z) > 58) continue;
      for (const [r, h, y] of coneLayers) {
        for (let k = 0; k < 7; k++) {
          const a = lr() * Math.PI * 2, f = 0.12 + lr() * 0.72;
          const rr = r * (1 - f) * t.s * 1.02;
          lights.push({ x: t.x + Math.cos(a) * rr, y: (y - h / 2 + f * h) * t.s, z: t.z + Math.sin(a) * rr, color: XMAS[Math.floor(lr() * XMAS.length)] });
        }
      }
    }
    const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), lights.length);
    const lc = new THREE.Color();
    lights.forEach((b, i) => { tmpM.makeTranslation(b.x, b.y, b.z); lm.setMatrixAt(i, tmpM); lm.setColorAt(i, lc.set(b.color).multiplyScalar(2.6)); });
    lm.instanceMatrix.needsUpdate = true; lm.instanceColor.needsUpdate = true;
    lm.visible = false; scene.add(lm);
    themeParts.xmas.push(lm);
    themeParts.xmasTwinkle.push({ mesh: lm, base: lights.map((b) => new THREE.Color(b.color).multiplyScalar(2.6)) });
  }

  // ---------- 🎄 크리스마스: 광장 큰 트리 (가운데 전구 기둥을 감싼다) · 텐트 문 둘레 전구 줄과 리스 (평소에는 숨김)
  {
    const g = new THREE.Group();
    g.visible = false;
    scene.add(g);
    themeParts.xmas.push(g);
    const greenA = toon('#1f5a3a'), greenB = toon('#28704a');
    const snowTip = toon('#f4f7fd', { emissive: new THREE.Color('#2a3350'), emissiveIntensity: 0.35 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.0, 10), toon('#6b4428'));
    trunk.position.y = 0.5; trunk.castShadow = true; g.add(trunk);
    const layers = [[2.5, 2.2, 1.7], [2.0, 2.0, 3.0], [1.5, 1.8, 4.2], [0.95, 1.5, 5.3]];
    layers.forEach(([r, h, y], i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18), i % 2 ? greenB : greenA);
      c.position.y = y; c.castShadow = true; g.add(c);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h * 0.4, 18), snowTip); // 가지 끝에 얹힌 눈
      cap.position.y = y + h * 0.3; g.add(cap);
    });
    // 오너먼트 (빨강 · 금 · 은 · 파랑 공)
    const orr = mulberry32(5);
    const ornGeo = new THREE.SphereGeometry(0.13, 12, 10);
    const ornMats = ['#d8283b', '#e8b53a', '#d9dde6', '#2f6fd8', '#c23b8f'].map((c) => toon(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.25 }));
    layers.forEach(([r, h, y]) => {
      for (let k = 0; k < 11; k++) {
        const a = orr() * Math.PI * 2, f = 0.1 + orr() * 0.55;
        const rr = r * (1 - f) + 0.06;
        const o = new THREE.Mesh(ornGeo, ornMats[Math.floor(orr() * ornMats.length)]);
        o.position.set(Math.cos(a) * rr, y - h / 2 + f * h, Math.sin(a) * rr); g.add(o);
      }
    });
    // 나선으로 감은 색색 전구
    const tl = [];
    for (let i = 0; i < 160; i++) {
      const u = i / 160, y = 0.75 + u * 5.2;
      const r = 2.45 * (1 - u) + 0.15;
      const a = u * Math.PI * 2 * 6.5;
      tl.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, color: XMAS[i % XMAS.length] });
    }
    const tm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), tl.length);
    tl.forEach((b, i) => { tmpM.makeTranslation(b.x, b.y, b.z); tm.setMatrixAt(i, tmpM); tm.setColorAt(i, new THREE.Color(b.color).multiplyScalar(2.6)); });
    tm.instanceMatrix.needsUpdate = true; tm.instanceColor.needsUpdate = true;
    g.add(tm);
    themeParts.xmasTwinkle.push({ mesh: tm, base: tl.map((b) => new THREE.Color(b.color).multiplyScalar(2.6)) });
    // 꼭대기 별
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.2 : 0.48; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.12, bevelEnabled: false }), glow('#ffd35c', 2.6));
    star.position.set(0, 6.45, -0.06); g.add(star);
    const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffcf6a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    starGlow.position.set(0, 6.45, 0); starGlow.scale.setScalar(2.4); g.add(starGlow);
    updaters.push((t) => { if (!g.visible) return; star.rotation.y = Math.sin(t * 0.6) * 0.5; starGlow.material.opacity = 0.38 + 0.14 * Math.sin(t * 2.1); });
    // 선물 상자
    [[1.9, 0.7, '#d8283b', '#ffd23b'], [-1.7, 1.2, '#2f6fd8', '#ffffff'], [0.6, -2.1, '#2f8a4a', '#d8283b'], [-1.2, -1.6, '#e8b53a', '#d8283b'], [2.1, -0.9, '#c23b8f', '#ffffff']].forEach(([x, z, c, rb], i) => {
      const s = 0.45 + (i % 3) * 0.12;
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.85, s), toon(c)); box.position.set(x, s * 0.425, z); box.rotation.y = i * 0.7; box.castShadow = true;
      const rib1 = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.87, s * 0.16), toon(rb)); rib1.position.copy(box.position); rib1.rotation.y = box.rotation.y;
      const rib2 = rib1.clone(); rib2.rotation.y += Math.PI / 2;
      g.add(box, rib1, rib2);
    });
    colliders.push({ x: 0, z: 0, r: 2.3, theme: 'christmas' }); // 크리스마스 테마일 때만 부딪힌다 (main.js)

    // 텐트 문 둘레 색색 전구 줄 + 문 위 리스
    const tb = [];
    const wreathGeo = new THREE.TorusGeometry(0.42, 0.13, 8, 20), bowGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const wreathMat = toon('#2a6e3e'), bowMat = toon('#d8283b');
    for (const t of TENTS) {
      const c = Math.cos(t.facing), sn = Math.sin(t.facing);
      const W = (lx, y, lz) => ({ x: t.x + lx * c + lz * sn, y, z: t.z - lx * sn + lz * c });
      const R = CFG.TENT_R + 0.06;
      // 문(오각형) 둘레를 따라
      const pts = [[-1.05, 0.2], [-1.05, 1.45], [0, 2.3], [1.05, 1.45], [1.05, 0.2]];
      for (let s = 0; s < pts.length - 1; s++) {
        const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
        for (let k = 0; k < 7; k++) { const u = k / 7; tb.push({ ...W(x0 + (x1 - x0) * u, 0.15 + y0 + (y1 - y0) * u, R), color: XMAS[(s * 7 + k) % XMAS.length] }); }
      }
      const wr = new THREE.Group();
      const w = W(0, 0.15 + TENT_WH - 0.05, R + 0.05);
      wr.position.set(w.x, w.y, w.z); wr.rotation.y = t.facing;
      const ring = new THREE.Mesh(wreathGeo, wreathMat);
      const bow = new THREE.Mesh(bowGeo, bowMat); bow.scale.set(1.6, 0.8, 0.6); bow.position.y = -0.42;
      wr.add(ring, bow);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), toon(k % 2 ? '#d8283b' : '#e8b53a')); b.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.12); wr.add(b); }
      g.add(wr);
    }
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), tb.length);
    tb.forEach((b, i) => { tmpM.makeTranslation(b.x, b.y, b.z); bm.setMatrixAt(i, tmpM); bm.setColorAt(i, new THREE.Color(b.color).multiplyScalar(2.6)); });
    bm.instanceMatrix.needsUpdate = true; bm.instanceColor.needsUpdate = true;
    g.add(bm);
    themeParts.xmasTwinkle.push({ mesh: bm, base: tb.map((b) => new THREE.Color(b.color).multiplyScalar(2.6)) });
    // 작은 트리: 텐트 문 앞 데크 양쪽 모서리 + 바깥 모닥불마다 TV 반대편에 두 그루 (모두 한 번에 그리도록 인스턴스로)
    {
      const spots = [];
      const mr = mulberry32(31);
      // 텐트: 문 앞 양쪽 모서리 (조금씩 앞뒤 · 좌우 · 크기를 흔든다)
      for (const t of TENTS) {
        const c = Math.cos(t.facing), sn = Math.sin(t.facing);
        for (const sx of [-1, 1]) {
          if (mr() < 0.2) continue; // 가끔은 한쪽만
          const lx = sx * (3.0 + mr() * 0.7), lz = CFG.TENT_R + 0.4 + mr() * 0.35;
          spots.push({ x: t.x + lx * c + lz * sn, z: t.z - lx * sn + lz * c, s: 0.8 + mr() * 0.35 });
        }
      }
      // 바깥 모닥불: 화로마다 1~3그루, 둘레 아무 데나 (의자 · TV 는 피해서), 크기도 제각각
      const chairs = [45, 135, 225, 315].map((d) => ({ x: Math.cos((d * Math.PI) / 180) * CFG.SEAT_RADIUS, z: Math.sin((d * Math.PI) / 180) * CFG.SEAT_RADIUS }));
      for (const p of PITS) {
        const side = p.id.startsWith('ts') ? -1 : 1; // TV 는 x + side*3.4
        const n = 1 + Math.floor(mr() * 3);
        const placed = [];
        for (let tries = 0; placed.length < n && tries < 40; tries++) {
          const a = mr() * Math.PI * 2, r = 3.1 + mr() * 1.3;
          const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
          if (Math.hypot(lx - side * 3.4, lz) < 1.7) continue;                // TV
          if (Math.abs(lx) < 1.6) continue;                                   // 텐트 ↔ 광장 길 (화로 가운데를 지나간다)
          if (chairs.some((ch) => Math.hypot(lx - ch.x, lz - ch.z) < 1.25)) continue; // 의자
          if (placed.some((q) => Math.hypot(lx - q.x, lz - q.z) < 1.5)) continue;     // 다른 트리
          placed.push({ x: lx, z: lz });
          spots.push({ x: p.x + lx, z: p.z + lz, s: 0.65 + mr() * 0.5 });
        }
      }
      const layers = [[0.85, 0.9, 0.75], [0.66, 0.8, 1.35], [0.45, 0.7, 1.9]];
      const greens = ['#1f5a3a', '#28704a', '#1f5a3a'];
      layers.forEach(([r, h, y], li) => {
        const list = spots.map((sp) => ({ x: sp.x, y: y * sp.s, z: sp.z, s: sp.s, ry: mr() * 6, rx: (mr() - 0.5) * 0.06, rz: (mr() - 0.5) * 0.06 }));
        g.add(instanced(new THREE.ConeGeometry(r, h, 12), toon(greens[li]), list));
        g.add(instanced(new THREE.ConeGeometry(r * 0.55, h * 0.4, 12), snowTip, list.map((it) => ({ ...it, y: it.y + h * 0.3 * it.s })), { cast: false }));
      });
      g.add(instanced(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 7), toon('#6b4428'), spots.map((sp) => ({ x: sp.x, y: 0.2 * sp.s, z: sp.z, s: sp.s }))));
      g.add(instanced(new THREE.OctahedronGeometry(0.13, 0), glow('#ffd35c', 2.4), spots.map((sp) => ({ x: sp.x, y: 2.35 * sp.s, z: sp.z, s: sp.s })), { cast: false })); // 꼭대기 별
      const orns = [], lightsL = [];
      for (const sp of spots) {
        layers.forEach(([r, h, y]) => {
          for (let k = 0; k < 4; k++) { const a = mr() * Math.PI * 2, f = 0.15 + mr() * 0.5, rr = (r * (1 - f) + 0.04) * sp.s; orns.push({ x: sp.x + Math.cos(a) * rr, y: (y - h / 2 + f * h) * sp.s, z: sp.z + Math.sin(a) * rr, s: sp.s, color: ['#d8283b', '#e8b53a', '#d9dde6', '#2f6fd8'][k] }); }
        });
        for (let k = 0; k < 26; k++) { const u = k / 26, y = 0.35 + u * 1.85, r = 0.85 * (1 - u) + 0.08, a = u * Math.PI * 2 * 4; lightsL.push({ x: sp.x + Math.cos(a) * r * sp.s, y: y * sp.s, z: sp.z + Math.sin(a) * r * sp.s, color: XMAS[k % XMAS.length] }); }
        colliders.push({ x: sp.x, z: sp.z, r: 0.55, theme: 'christmas' });
      }
      g.add(instanced(new THREE.SphereGeometry(0.075, 8, 6), toon('#ffffff', { emissive: new THREE.Color('#222'), emissiveIntensity: 0.4 }), orns, { cast: false }));
      const lm2 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), lightsL.length);
      lightsL.forEach((b, i) => { tmpM.makeTranslation(b.x, b.y, b.z); lm2.setMatrixAt(i, tmpM); lm2.setColorAt(i, new THREE.Color(b.color).multiplyScalar(2.6)); });
      lm2.instanceMatrix.needsUpdate = true; lm2.instanceColor.needsUpdate = true;
      g.add(lm2);
      themeParts.xmasTwinkle.push({ mesh: lm2, base: lightsL.map((b) => new THREE.Color(b.color).multiplyScalar(2.6)) });
    }
    // 반짝반짝 (보일 때만)
    const tc = new THREE.Color();
    updaters.push(() => {
      for (const tw of themeParts.xmasTwinkle) {
        if (!tw.mesh.visible || !g.visible) continue;
        for (let k = 0; k < 10; k++) { const i = Math.floor(Math.random() * tw.base.length); tw.mesh.setColorAt(i, tc.copy(tw.base[i]).multiplyScalar(0.35 + Math.random() * 0.8)); }
        tw.mesh.instanceColor.needsUpdate = true;
      }
    });
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
      if (TENTS.some((t) => Math.abs(x - t.x) < CFG.TENT_R + 1.2 && Math.abs(z - t.z) < CFG.TENT_R + 1.8)) continue;
      tufts.push({ x, y: 0.12, z, ry: rand() * 6, s: 0.7 + rand() * 0.8, color: rand() > 0.5 ? '#6fb35a' : '#5a9e4c' });
    }
    tries = 0;
    while (flowers.length < 420 && tries++ < 20000) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z)) continue;
      if (TENTS.some((t) => Math.abs(x - t.x) < CFG.TENT_R + 1.2 && Math.abs(z - t.z) < CFG.TENT_R + 1.8)) continue;
      flowers.push({ x, y: 0.18, z, s: 0.7 + rand() * 0.6, color: ['#ffe9f2', '#ffd1e6', '#fff3a8', '#c9d8ff', '#ffffff'][Math.floor(rand() * 5)] });
    }
    for (const t of TENTS) {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + (i / 3 - 0.5) * 2.2 + t.facing;
        bushes.push({ x: t.x + Math.sin(a) * (CFG.TENT_R + 1.1), y: 0.35, z: t.z + Math.cos(a) * (CFG.TENT_R + 1.1), s: 0.55 + rand() * 0.35, color: ['#3f8a4c', '#4f9a58'][i % 2] });
      }
    }
    tries = 0;
    while (bushes.length < 160 && tries++ < 5000) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z) || TENTS.some((t) => Math.abs(x - t.x) < CFG.TENT_R + 1.8 && Math.abs(z - t.z) < CFG.TENT_R + 2.0)) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 30 && rand() > 0.25) continue;
      bushes.push({ x, y: 0.3, z, s: 0.5 + rand() * 0.5, color: ['#3f8a4c', '#4f9a58', '#356f40'][Math.floor(rand() * 3)] });
    }
    for (let i = 0; i < 40; i++) {
      const x = (rand() * 2 - 1) * 56, z = (rand() * 2 - 1) * 37;
      if (isPath(x, z)) continue;
      rocks.push({ x, y: 0.1, z, s: 0.25 + rand() * 0.4, rx: rand(), ry: rand() * 6, color: ['#8d8a94', '#a19ea8', '#77747f'][i % 3] });
    }
    scene.add(instanced(new THREE.IcosahedronGeometry(1, 1), toon('#ffffff'), bushes));
    const tuftMesh = instanced(new THREE.ConeGeometry(0.07, 0.34, 3), toon('#ffffff'), tufts, { cast: false });
    const flowerMesh = instanced(new THREE.IcosahedronGeometry(0.07, 0), toon('#ffffff', { emissive: new THREE.Color('#3a3a55'), emissiveIntensity: 0.6 }), flowers, { cast: false });
    scene.add(tuftMesh, flowerMesh);
    themeParts.grass.push(tuftMesh, flowerMesh); // 눈이 쌓이면 풀 · 꽃은 덮인다
    // 덤불 위 눈
    const bushCaps = instanced(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#f4f7fd', { emissive: new THREE.Color('#2a3350'), emissiveIntensity: 0.35 }),
      bushes.map((b) => ({ x: b.x, y: b.y + b.s * 0.38, z: b.z, sx: b.s * 0.95, sy: b.s * 0.55, sz: b.s * 0.95 })), { cast: false });
    bushCaps.visible = false; scene.add(bushCaps); themeParts.snow.push(bushCaps);
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
    const normal = bulbs.map((b) => new THREE.Color(b.color).multiplyScalar(3.2));
    // 크리스마스: 텐트 지붕 둘레 전구를 색색으로
    const xmas = bulbs.map((b, i) => (b.tent ? new THREE.Color(XMAS[i % XMAS.length]).multiplyScalar(2.8) : normal[i]));
    let base = normal;
    themeParts.setBulbPalette = (on) => {
      const want = on ? xmas : normal;
      if (want === base) return;
      base = want;
      base.forEach((col, i) => mesh.setColorAt(i, col));
      mesh.instanceColor.needsUpdate = true;
    };
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
    themeParts.fireflies = ff;
    updaters.push((t, dt, shared) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = shared.uScale.value; });
  }

  function heightAt(x, z) {
    for (const d of decks) if (x > d.minX && x < d.maxX && z > d.minZ && z < d.maxZ) return d.h;
    return 0;
  }

  return {
    tents,
    colliders,
    lightSpots,
    occluders,
    stumpMeshes,
    heightAt,
    moonLight,
    egg,
    hemi,
    ambient,
    sky,
    /** 바깥 모닥불 천막 자리 (비 · 눈을 막는 곳) */
    tarpSpots: themeParts.tarps.map((t) => ({ x: t.x, z: t.z })),
    /** 테마 템플릿(shared/themes.js)대로 캠핑장을 바꾼다 */
    setTheme(th) {
      const kind = th.ground || 'grass';
      if (!groundTex[kind]) groundTex[kind] = themedGround(groundTex.grass.userData.canvas, kind);
      groundMat.map = groundTex[kind]; groundMat.needsUpdate = true;
      outerMat.color.set(kind === 'snow' ? '#dfe6f1' : kind === 'wet' ? '#2c5233' : '#3f7a3a');
      for (const m of themeParts.snow) m.visible = kind === 'snow';
      for (const m of themeParts.grass) m.visible = kind !== 'snow';
      for (const t of themeParts.tarps) t.g.visible = !!th.tarps;
      for (const m of themeParts.xmas) m.visible = th.decor === 'christmas';
      themeParts.setBulbPalette?.(th.decor === 'christmas');
      if (themeParts.fireflies) themeParts.fireflies.visible = !!th.fireflies;
      roofMat.color.set(kind === 'snow' ? '#f6f8fc' : '#eadbbd'); // 텐트 지붕에도 눈
      deckMat.color.set(kind === 'wet' ? '#7d5537' : '#9b6a43');
    },
    update(t, dt, camera, focus, shared) {
      moonLight.position.copy(focus).add(moonOffset);
      moonLight.target.position.copy(focus);
      for (const u of updaters) u(t, dt, shared);
      // 천막: 카메라가 천막 위 높은 곳에서 가까이 내려다보면 반투명하게 (불이 가리지 않게)
      for (const tp of themeParts.tarps) {
        if (!tp.g.visible) continue;
        const d = Math.hypot(camera.position.x - tp.x, camera.position.z - tp.z);
        const want = camera.position.y > TARP_H - 0.2 && d < 11 ? 0.2 : 1;
        tp.fade += (want - tp.fade) * Math.min(1, dt * 5);
        for (const m of tp.mats) { m.opacity = tp.fade; m.depthWrite = tp.fade > 0.95; }
      }
    },
  };
}
