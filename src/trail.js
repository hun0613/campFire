// 🌲 숲길 (둘레길, v1.19): 울타리 밖을 한 바퀴 도는 흙길 + 쉼터 3곳 (개울 다리 · 호숫가 · 노을 지는 언덕)
// - 길 · 물 · 언덕은 바닥에 붙은 납작한 메시. 랜턴은 빛나는 재질로만 (실제 조명을 늘리지 않는다 — 폰 발열)
// - 언덕과 다리 · 데크는 heightAt 으로 올라서고, 호수 · 연못은 충돌로 못 들어간다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, glow, radialTexture } from './toon.js';
import { TRAIL, GATES, SPOTS, ZONES, LAKE, POND, STREAM, HILL, BOUNDS, FENCE, HILL_BENCH, HILL_CAT, LAKE_BENCH, SUNSET, WINDMILL, hillHeight, trailCurve, zonePath } from '../shared/config.js';

const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3();
function instanced(geo, mat, list, { cast = false } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => {
    tmpP.set(it.x, it.y ?? 0, it.z);
    tmpE.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0, it.order || 'XYZ');
    tmpQ.setFromEuler(tmpE);
    if (typeof it.s === 'number') tmpS.setScalar(it.s); else tmpS.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
    if (it.color) mesh.setColorAt(i, new THREE.Color(it.color));
  });
  mesh.castShadow = cast;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** 점 목록을 따라가는 납작한 띠 (u: 가로 0~1, v: 길이 방향 m/4) */
function ribbonGeometry(pts, width, closed) {
  const n = pts.length, pos = [], uv = [], idx = [];
  let along = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz * width / 2, nz = tx * width / 2;
    if (i > 0) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0] + nx, 0, pts[i][1] + nz, pts[i][0] - nx, 0, pts[i][1] - nz);
    uv.push(0, along / 4, 1, along / 4);
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 흙길 무늬 (길이 방향으로 반복) + 가장자리가 풀밭으로 흐려지는 투명도 */
function dirtTextures() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#b08d62'; g.fillRect(0, 0, 64, 256);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? 'rgba(120,92,62,0.55)' : 'rgba(178,148,108,0.45)'; g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(140,130,118,0.8)'; g.beginPath(); g.arc(r() * 64, r() * 256, 1 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
  const map = new THREE.CanvasTexture(cv); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace;
  const av = document.createElement('canvas'); av.width = 64; av.height = 4;
  const ag = av.getContext('2d'), grd = ag.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#000'); grd.addColorStop(0.22, '#fff'); grd.addColorStop(0.78, '#fff'); grd.addColorStop(1, '#000');
  ag.fillStyle = grd; ag.fillRect(0, 0, 64, 4);
  const alpha = new THREE.CanvasTexture(av); alpha.wrapT = THREE.RepeatWrapping;
  return { map, alpha };
}

/** 아래(base)에서 위(tip)로 색이 바뀌게 버텍스 색을 칠한다 */
function paint(geo, base, tip, y0, y1) {
  const p = geo.attributes.position, cols = [], a = new THREE.Color(base), b = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); c.copy(a).lerp(b, k * k); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}
/** 핑크뮬리 한 포기: 가는 잎 여러 가닥이 사방으로 퍼지고 끝으로 갈수록 분홍 안개처럼 */
function muhlyTuft() {
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.ConeGeometry(0.045, 1.15, 3, 1, true);
    g.translate(0, 0.575, 0);
    g.rotateZ(0.18 + (i % 4) * 0.13);
    g.rotateY(i * 2.39);
    parts.push(paint(g.toNonIndexed(), '#4e3b3a', '#ffbfdc', 0.05, 0.9));
  }
  return mergeGeometries(parts);
}
/** 데이지 한 송이: 가는 줄기 + 흰 꽃잎 + 노란 가운데 (위를 보고 핀다) */
function daisyFlower() {
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 3); stem.translate(0, 0.21, 0); paint(stem, '#4f8a3a', '#6fae4f', 0, 0.42);
  const petals = new THREE.CircleGeometry(0.11, 10); petals.rotateX(-Math.PI / 2); petals.translate(0, 0.43, 0); paint(petals, '#ffffff', '#ffffff', 0, 1);
  const eye = new THREE.SphereGeometry(0.04, 6, 4); eye.scale(1, 0.55, 1); eye.translate(0, 0.445, 0); paint(eye, '#f4c430', '#ffd84a', 0.42, 0.47);
  return mergeGeometries([stem.toNonIndexed(), petals.toNonIndexed(), eye.toNonIndexed()]);
}
/** 흔들의자: 나무 받침(곡선 다리) 위에 앉는 자리 · 등받이. userData.rock 을 기울여 흔든다 */
function rockingChair() {
  const g = new THREE.Group();
  const rock = new THREE.Group(); g.add(rock); g.userData.rock = rock;
  const wood = toon('#7a4e2e'), dark = toon('#5c3a22'), cush = toon('#c0504d');
  for (const sx of [-0.33, 0.33]) {
    const runner = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 5, 16, 0.95), dark);
    runner.rotation.y = Math.PI / 2; runner.rotation.z = Math.PI / 2 + 0.475 + Math.PI; runner.position.set(sx, 0.92, -0.05); rock.add(runner);
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), wood); legF.position.set(sx, 0.25, 0.25); rock.add(legF);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), wood); legB.position.set(sx, 0.25, -0.25); rock.add(legB);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.6), wood); arm.position.set(sx, 0.72, 0); rock.add(arm);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.62), wood); seat.position.set(0, 0.47, 0); seat.castShadow = true; rock.add(seat);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.55), cush); pad.position.set(0, 0.53, 0.01); rock.add(pad);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.06), wood); back.position.set(0, 0.93, -0.33); back.rotation.x = -0.28; back.castShadow = true; rock.add(back);
  return g;
}
/** 댑싸리 한 포기: 둥글게 부푼 덤불 (아래는 짙고 위는 밝게) */
function kochiaBush() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.08 * Math.sin(x * 9 + y * 7) * Math.cos(z * 8); p.setXYZ(i, x * k * 0.56, (y * 0.62 + 0.6) * k, z * k * 0.56); }
  g.computeVertexNormals();
  return paint(g.toNonIndexed(), '#5a4a3a', '#ffffff', 0.05, 1.2);
}
/** 갈대 한 대: 긴 줄기 + 고개를 숙인 은빛 이삭 */
function reedStem() {
  const stalk = new THREE.CylinderGeometry(0.018, 0.028, 1, 4); stalk.translate(0, 0.5, 0);
  paint(stalk, '#5d6a3a', '#9a9468', 0, 1);
  const plume = new THREE.SphereGeometry(1, 6, 5); plume.scale(0.07, 0.34, 0.07); plume.rotateZ(0.55); plume.translate(0.12, 1.22, 0);
  paint(plume, '#cdb88a', '#f4ead0', 0.9, 1.5);
  return mergeGeometries([stalk.toNonIndexed(), plume.toNonIndexed()]);
}

/** 점 (x, z)에서 선분 목록까지 가장 가까운 거리 */
function distToPolyline(x, z, pts, closed) {
  let best = Infinity;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** 돌린 직사각형 안인지 (다리 · 데크) */
const inRot = (x, z, r) => {
  const dx = x - r.x, dz = z - r.z, c = Math.cos(r.ang), s = Math.sin(r.ang);
  const along = dx * c + dz * s, side = -dx * s + dz * c;
  return Math.abs(along) <= r.len / 2 && Math.abs(side) <= r.w / 2;
};

export function buildTrail(scene, { addCol, updaters, lightSpots, lowSpec = false }) {
  const loop = trailCurve(TRAIL.loop, true, 1.5);
  const spurs = TRAIL.spurs.map((s) => trailCurve(s, false, 1.2));
  const stream = trailCurve(STREAM, false, 1.5);
  const decks = []; // 올라서는 곳 {x,z,ang,len,w,h}
  let hillMat = null;
  const chairs = []; // 흔들의자 {seat, g, rock}
  const lanterns = []; // 랜턴 자리 (들판 풀이 겹치지 않게)

  // ---------- 흙길
  const { map, alpha } = dirtTextures();
  const pathMat = toon('#ffffff', { map, alphaMap: alpha, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const addRibbon = (pts, closed, w = TRAIL.width) => {
    const m = new THREE.Mesh(ribbonGeometry(pts, w, closed), pathMat);
    m.position.y = 0.015; m.receiveShadow = true; m.renderOrder = 1;
    scene.add(m);
  };
  addRibbon(loop, true);
  for (const s of spurs) addRibbon(s, false, TRAIL.width - 0.3);

  // ---------- 물 (호수 · 연못 · 개울)
  // 밤 정원 연못 느낌: 짙은 남색 물 위에 별빛 같은 반짝임, 잉어 · 분수 둘레로 퍼지는 가는 물결 고리, 물가 석등 불빛이 보는 쪽으로 길게 비친다
  const LANTERNS = [
    ...[2.45, -0.75].map((a) => [POND.x + Math.cos(a) * (POND.r + 1.0), POND.z + Math.sin(a) * (POND.r + 1.0)]),
    ...[2.6, 1.45, 3.7].map((a) => [LAKE.x + Math.cos(a) * (LAKE.rx + 1.2), LAKE.z + Math.sin(a) * (LAKE.rz + 1.2)]),
  ];
  const RIPN = 10; // 물결 고리 자리 (잉어 · 분수)
  const waterU = {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color('#0b1a36') }, uLight: { value: new THREE.Color('#2a5a94') },
    uGlow: { value: new THREE.Color('#ffc77a') }, uFrozen: { value: 0 }, uRain: { value: 0 },
    uRip: { value: Array.from({ length: RIPN }, () => new THREE.Vector3(9999, 9999, 0)) },
    uLant: { value: LANTERNS.map(([x, z]) => new THREE.Vector2(x, z)) },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, waterU]),
    fog: true, polygonOffset: true, polygonOffsetFactor: -3,
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uGlow; uniform float uFrozen; uniform float uRain;
      uniform vec3 uRip[${RIPN}]; uniform vec2 uLant[${LANTERNS.length}]; varying vec3 vW;
      #include <fog_pars_fragment>
      float hash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
      float wv(vec2 p, float t) { return sin(p.x * 1.3 + t * 1.1) * 0.5 + sin(p.y * 1.7 - t * 0.9) * 0.5 + sin((p.x + p.y) * 2.3 + t * 1.7) * 0.35; }
      // 가는 동심원 물결 (중심에서 퍼져 나가며 옅어진다)
      float rings(float d, float freq, float speed, float decay) { float f = fract(d * freq - uTime * speed); return smoothstep(0.1, 0.0, abs(f - 0.5)) * exp(-d * decay); }
      void main() {
        vec2 p = vW.xz;
        float t = uTime * (1.0 - uFrozen * 0.92);
        float w = wv(p * 0.7, t) + 0.5 * wv(p * 1.9 + 7.0, t * 1.3);
        vec3 col = mix(uDeep, uLight, clamp(w * 0.12 + 0.28, 0.0, 1.0));
        // 별빛 같은 작은 반짝임 (동그란 점, 깜빡깜빡)
        vec2 g = p * 4.0, c = floor(g), f = fract(g) - 0.5;
        float rn = hash(c), rn2 = hash(c + 3.7);
        float dotv = smoothstep(0.09, 0.0, length(f - (vec2(rn, rn2) - 0.5) * 0.6)) * step(0.88, rn) * (0.55 + 0.45 * sin(t * 2.5 + rn2 * 30.0));
        col += dotv * mix(vec3(0.55, 0.85, 1.0), vec3(1.0), rn2) * (1.0 - uRain * 0.8); // 비 오면 별빛 반짝임은 거의 없다
        // 물결 고리: 잉어가 지나간 자리 · 분수 둘레 (하늘색 가는 선)
        float rl = 0.0;
        for (int i = 0; i < ${RIPN}; i++) { vec3 r = uRip[i]; float d = distance(p, r.xy); rl += rings(d, r.z > 1.5 ? 1.5 : 3.2, r.z > 1.5 ? 0.8 : 0.6, r.z > 1.5 ? 0.75 : 1.3) * min(r.z, 1.0); }
        col += rl * vec3(0.45, 0.8, 1.0) * 0.42;
        // 🌧 비 오는 날: 수면 곳곳에 빗방울이 떨어져 작은 고리가 퍼진다 (칸마다 하나씩, 시간 엇갈리게)
        if (uRain > 0.01) {
          vec2 gp = p * 1.7, rc = floor(gp); float rr = 0.0;
          for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) {
            vec2 cc = rc + vec2(float(dx), float(dy));
            float h = hash(cc), h2 = hash(cc + 5.1), ph = fract(uTime * 1.1 + h * 7.0);
            float d = distance(p, (cc + vec2(h, h2)) / 1.7);
            rr += smoothstep(0.03, 0.0, abs(d - ph * 0.5)) * (1.0 - ph) * (1.0 - ph);
          }
          col += rr * uRain * vec3(0.6, 0.8, 1.0) * 0.45;
        }
        // 석등 불빛이 보는 쪽으로 길게 비친다 (끊어진 빛 조각)
        for (int i = 0; i < ${LANTERNS.length}; i++) {
          vec2 L = uLant[i], q = p - L, dir = normalize(cameraPosition.xz - L + 1e-4);
          float along = dot(q, dir), perp = length(q - along * dir);
          float streak = exp(-perp * perp * 22.0) * exp(-max(along, 0.0) * 0.28) * step(0.0, along) * (0.55 + 0.45 * sin(along * 7.0 - uTime * 2.2 + perp * 18.0));
          col += (streak * 0.9 + exp(-length(q) * 1.6) * 0.35) * vec3(1.0, 0.72, 0.38);
        }
        col += exp(-distance(p, uRip[0].xy) * 0.45) * 0.25 * uGlow; // 분수 밑 조명
        col = mix(col, vec3(0.72, 0.8, 0.9), uFrozen * 0.65);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // 물결 고리 자리: 0 = 호수 분수, 1 = 연못 분수, 나머지 = 잉어 (koi 가 매 프레임 채운다)
  waterMat.uniforms.uRip.value[0].set(LAKE.x, LAKE.z, 2);
  waterMat.uniforms.uRip.value[1].set(POND.x, POND.z, 1);
  updaters.push((t) => { waterMat.uniforms.uTime.value = t; });
  const shoreMat = toon('#7d6b4f', { polygonOffset: true, polygonOffsetFactor: -1 });
  const flat = (geo, mat, x, z, y, sx = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.set(sx, sz, 1); m.receiveShadow = true; scene.add(m); return m;
  };
  // 호수: 모래 물가 + 물 + 물에 비친 달
  flat(new THREE.CircleGeometry(1, 48), shoreMat, LAKE.x, LAKE.z, 0.01, LAKE.rx + 1.6, LAKE.rz + 1.6);
  flat(new THREE.CircleGeometry(1, 48), waterMat, LAKE.x, LAKE.z, 0.03, LAKE.rx, LAKE.rz);
  const moonMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#fff0c8', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const moonRef = flat(new THREE.PlaneGeometry(1, 1), moonMat, LAKE.x + 1.5, LAKE.z - 1.2, 0.04, 2.2, 6.5);
  updaters.push((t) => { moonMat.opacity = 0.26 + 0.07 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 3.1); moonRef.scale.x = 2.2 + 0.25 * Math.sin(t * 0.9); });
  // 호수 가장자리 갈대
  {
    const reeds = [];
    let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      if (Math.cos(a) < -0.35 && Math.sin(a) > 0.2) continue; // 데크 쪽은 비운다
      const k = 0.97 + r() * 0.12;
      reeds.push({ x: LAKE.x + Math.cos(a) * LAKE.rx * k, z: LAKE.z + Math.sin(a) * LAKE.rz * k, y: 0.45, s: 0.6 + r() * 0.6, ry: r() * 6, rz: (r() - 0.5) * 0.25, color: r() > 0.5 ? '#5d7a3a' : '#7d8a44' });
    }
    scene.add(instanced(new THREE.ConeGeometry(0.06, 1.0, 4), toon('#ffffff'), reeds));
  }
  // ---------- 분수 (호숫가 · 개울 다리 연못): 돌 수반에서 물줄기가 솟고 물방울이 흩어진다.
  // 물 밑에서 은은한 조명이 비추고, 빛 색은 금빛 → 장밋빛 → 물빛 → 라일락으로 천천히 바뀐다 (가까이 가면 실제 조명도 켜진다)
  const GLOW = ['#ffc77a', '#ff9ec8', '#8fe3ff', '#c8a8ff'].map((c) => new THREE.Color(c));
  const glowNow = new THREE.Color('#ffc77a');
  updaters.push((t) => {
    const k = (t / 9) % GLOW.length, i = Math.floor(k);
    glowNow.copy(GLOW[i]).lerp(GLOW[(i + 1) % GLOW.length], k - i);
    waterMat.uniforms.uGlow.value.copy(glowNow);
  });
  // ❄️ 눈 오는 날 숲길에서 바뀌는 것들 (setTheme 에서 한꺼번에 켜고 끈다)
  const snowFx = []; let snowy = false;
  function fountain(F, { scale = 1, ring = 8, n = 220, seedStart = 77 } = {}) {
    const S = scale, stone = toon('#8b8f99'), stoneD = toon('#6f7380');
    const g = new THREE.Group(); g.position.set(F.x, 0, F.z); scene.add(g);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new THREE.CylinderGeometry(1.5 * S, 1.7 * S, 0.42, 24), stone, 0, 0.2, 0).castShadow = true;
    const rim = add(new THREE.TorusGeometry(1.45 * S, 0.12, 6, 28), stoneD, 0, 0.42, 0); rim.rotation.x = Math.PI / 2;
    const inner = add(new THREE.CircleGeometry(1.36 * S, 24), waterMat, 0, 0.4, 0); inner.rotation.x = -Math.PI / 2;
    add(new THREE.CylinderGeometry(0.16 * S, 0.26 * S, 1.0 * S, 10), stone, 0, 0.4 + 0.5 * S, 0);
    add(new THREE.CylinderGeometry(0.55 * S, 0.25 * S, 0.2, 16), stoneD, 0, 0.4 + 1.02 * S, 0);
    const top = 0.4 + 1.15 * S;
    // 물 밑 조명: 수반 둘레 빛 고리 + 물기둥을 따라 올라가는 옅은 빛줄기
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.2 * S, 3.4 * S, 40), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; g.add(halo);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = add(new THREE.CylinderGeometry(0.55 * S, 0.3 * S, 3.2 * S, 18, 1, true), beamMat, 0, top + 1.3 * S, 0);
    const colMat = new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const col = add(new THREE.CylinderGeometry(0.06 * S, 0.12 * S, 1.6 * S, 10, 1, true), colMat, 0, top + 0.75 * S, 0);
    // ❄️ 눈 오는 날: 물줄기가 멈추고 얼어붙은 얼음 기둥 (물 밑 조명이 얼음을 은은하게 비춘다)
    const ice = new THREE.Group(); ice.visible = false; g.add(ice);
    const iceMat = new THREE.MeshStandardMaterial({ color: '#d6ecff', emissive: new THREE.Color('#5d7fa6'), emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.82 });
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * S, 0.22 * S, 1.5 * S, 7), iceMat); m.position.y = top + 0.72 * S; ice.add(m); }
    for (let k = 0; k < 9; k++) { // 수반 가장자리에 매달린 고드름
      const a = k * Math.PI * 2 / 9, m = new THREE.Mesh(new THREE.ConeGeometry(0.06 * S, 0.34 * S, 5), iceMat);
      m.rotation.x = Math.PI; m.position.set(Math.cos(a) * 0.5 * S, 0.4 + 0.85 * S, Math.sin(a) * 0.5 * S); ice.add(m);
    }
    { const m = new THREE.Mesh(new THREE.CircleGeometry(1.36 * S, 24), new THREE.MeshStandardMaterial({ color: '#e8f3ff', roughness: 0.3, emissive: new THREE.Color('#3a5272'), emissiveIntensity: 0.3 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.415; ice.add(m); }
    // 물방울
    const drops = [];
    const dropMat = new THREE.MeshBasicMaterial({ color: '#d8ecff', transparent: true, opacity: 0.85, depthWrite: false });
    const dm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05 * Math.max(0.7, S), 5, 4), dropMat, n);
    dm.frustumCulled = false; scene.add(dm);
    let seed = seedStart; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spawn = (d) => {
      if (r() < 0.55) { // 가운데 물줄기: 높이 솟았다 수반으로
        const a = r() * 6.28, sp = (0.25 + r() * 0.45) * S;
        d.p.set(F.x, top, F.z); d.v.set(Math.cos(a) * sp, (4.6 + r() * 0.9) * Math.sqrt(S), Math.sin(a) * sp);
      } else { // 수반 테두리에서 물 쪽으로 둥글게 뿜는 작은 물줄기
        const k = Math.floor(r() * ring), a = k * Math.PI * 2 / ring + (r() - 0.5) * 0.08;
        d.p.set(F.x + Math.cos(a) * 1.4 * S, 0.45, F.z + Math.sin(a) * 1.4 * S); d.v.set(Math.cos(a) * (1.3 + r() * 0.3) * S, (2.6 + r() * 0.4) * Math.sqrt(S), Math.sin(a) * (1.3 + r() * 0.3) * S);
      }
    };
    for (let i = 0; i < n; i++) { const d = { p: new THREE.Vector3(), v: new THREE.Vector3() }; spawn(d); d.p.addScaledVector(d.v, r() * 0.9); drops.push(d); }
    const splash = new THREE.Mesh(new THREE.RingGeometry(1.7 * S, 2.1 * S, 32), new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    splash.rotation.x = -Math.PI / 2; splash.position.y = 0.05; g.add(splash);
    snowFx.push((on) => { ice.visible = on; dm.visible = !on; splash.visible = !on; col.visible = !on; beam.visible = !on; });
    const tint = new THREE.Color(), white = new THREE.Color('#e6f2ff');
    const spot = { pos: new THREE.Vector3(F.x, 1.2, F.z), color: new THREE.Color('#ffc77a'), intensity: 9 * S, distance: 16 * Math.sqrt(S) };
    lightSpots.push(spot);
    updaters.push((t, dt) => {
      dt = Math.min(dt, 0.05);
      if (snowy) { halo.material.color.copy(glowNow); spot.color.copy(glowNow); return; } // 얼어 있으면 물방울 계산은 쉰다
      drops.forEach((d, i) => {
        d.v.y -= 9.2 * dt; d.p.addScaledVector(d.v, dt);
        const inBasin = Math.hypot(d.p.x - F.x, d.p.z - F.z) < 1.4 * S;
        if (d.p.y < (inBasin ? 0.42 : 0.04)) spawn(d);
        tmpP.copy(d.p); tmpS.set(1, 1 + Math.min(1.5, Math.abs(d.v.y) * 0.15), 1);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS); dm.setMatrixAt(i, tmpM);
      });
      dm.instanceMatrix.needsUpdate = true;
      // 조명 색이 물방울 · 물기둥 · 빛줄기에 은은하게 물든다
      tint.copy(white).lerp(glowNow, 0.45); dropMat.color.copy(tint); colMat.color.copy(tint);
      beamMat.color.copy(glowNow); beamMat.opacity = 0.025 + 0.01 * Math.sin(t * 1.3);
      halo.material.color.copy(glowNow);
      spot.color.copy(glowNow);
      colMat.opacity = 0.28 + 0.08 * Math.sin(t * 9);
      const k = (t * 0.6) % 1; splash.scale.setScalar(1 + k * 0.5); splash.material.opacity = 0.32 * (1 - k);
    });
  }
  fountain({ x: LAKE.x, z: LAKE.z });

  // 연못 + 개울 (연못에서 숲 바깥쪽으로 흘러간다)
  flat(new THREE.CircleGeometry(POND.r + 1.1, 32), shoreMat, POND.x, POND.z, 0.01);
  flat(new THREE.CircleGeometry(POND.r, 32), waterMat, POND.x, POND.z, 0.03);
  fountain({ x: POND.x, z: POND.z }, { scale: 0.55, ring: 6, n: 110, seedStart: 91 }); // 개울 다리 연못의 작은 분수
  {
    const s1 = new THREE.Mesh(ribbonGeometry(stream, 2.6, false), shoreMat); s1.position.y = 0.012; scene.add(s1);
    const s2 = new THREE.Mesh(ribbonGeometry(stream, 1.8, false), waterMat); s2.position.y = 0.03; scene.add(s2);
    // 물가 돌
    const stones = [];
    let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 44; i++) {
      const a = r() * Math.PI * 2;
      stones.push({ x: POND.x + Math.cos(a) * (POND.r + 0.5), z: POND.z + Math.sin(a) * (POND.r + 0.5), y: 0.08, s: 0.18 + r() * 0.2, ry: r() * 6, color: r() > 0.5 ? '#6f7a8e' : '#7f8798' });
    }
    for (let i = 2; i < stream.length - 1; i += 2) {
      const [x, z] = stream[i], [x2, z2] = stream[i - 1];
      const tx = x - x2, tz = z - z2, tl = Math.hypot(tx, tz) || 1, side = r() > 0.5 ? 1 : -1;
      stones.push({ x: x - (tz / tl) * 1.25 * side, z: z + (tx / tl) * 1.25 * side, y: 0.08, s: 0.15 + r() * 0.18, ry: r() * 6, color: '#8f8b86' });
    }
    scene.add(instanced(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff'), stones, { cast: true }));
  }
  // (물결 반짝임은 물 셰이더가 직접 그린다)
  // ---------- 밤 정원 연못: 둥근 바위 · 석등 · 연잎 · 떠 있는 꽃잎 · 헤엄치는 비단잉어
  {
    let seed = 313; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const deckAng = Math.atan2(SPOTS.find((q) => q.id === 'lake').z - LAKE.z, SPOTS.find((q) => q.id === 'lake').x - LAKE.x);
    const nearDeck = (a) => Math.abs(Math.atan2(Math.sin(a - deckAng), Math.cos(a - deckAng))) < 0.32;
    // 물가 큰 바위 (푸른 회색, 둥글게)
    const rocks = [];
    const rockCol = ['#56627a', '#636f86', '#4b566c', '#6c768c'];
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + r() * 0.3, k = 1 + 0.05 * r(); const s0 = 0.45 + r() * 0.45; rocks.push({ x: POND.x + Math.cos(a) * (POND.r + 0.35 + s0 * 0.5) * k, z: POND.z + Math.sin(a) * (POND.r + 0.35 + s0 * 0.5) * k, y: s0 * 0.35, sx: s0 * 1.2, sy: s0 * 0.75, sz: s0, ry: r() * 6, color: rockCol[i % 4] }); }
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * 6.28 + r() * 0.15; if (nearDeck(a)) continue;
      const s0 = 0.5 + r() * 0.6;
      rocks.push({ x: LAKE.x + Math.cos(a) * (LAKE.rx + 0.3 + s0 * 0.4), z: LAKE.z + Math.sin(a) * (LAKE.rz + 0.3 + s0 * 0.4), y: s0 * 0.35, sx: s0 * 1.3, sy: s0 * 0.7, sz: s0 * 1.05, ry: r() * 6, color: rockCol[i % 4] });
    }
    // 개울 다리 쪽(길에서 연못으로 가는 곳)은 바위를 비운다
    const keep = rocks.filter((k) => !(Math.hypot(k.x - (POND.x + 4), k.z - POND.z) < 1.6 && false));
    scene.add(instanced(new THREE.IcosahedronGeometry(1, 1), toon('#ffffff'), keep, { cast: true }));
    // 석등: 돌 받침 · 기둥 · 불 켜진 등 · 지붕
    const stone = toon('#7d8597'), stoneD = toon('#636a7a');
    const lampGlow = glow('#ffc56b', 2.6);
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffb35c', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const [x, z] of LANTERNS) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r() * 6;
      const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
      part(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 8), stoneD, 0.07);
      part(new THREE.CylinderGeometry(0.1, 0.13, 0.55, 8), stone, 0.42);
      part(new THREE.BoxGeometry(0.42, 0.06, 0.42), stoneD, 0.72);
      part(new THREE.BoxGeometry(0.26, 0.26, 0.26), lampGlow, 0.88);
      for (const [px, pz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) { const c = part(new THREE.BoxGeometry(0.05, 0.3, 0.05), stone, 0.88); c.position.x = px; c.position.z = pz; }
      const roof = part(new THREE.ConeGeometry(0.4, 0.26, 4), stoneD, 1.14); roof.rotation.y = Math.PI / 4;
      part(new THREE.SphereGeometry(0.06, 6, 4), stone, 1.3);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; g.add(pool);
      scene.add(g);
      addCol(x, z, 0.35);
      lightSpots.push({ pos: new THREE.Vector3(x, 1.0, z), color: new THREE.Color('#ffb35c'), intensity: 6, distance: 10 });
    }
    // 연잎 (가장자리를 따라) + 몇 송이 연꽃
    const pads = [], lotus = [];
    const padCol = ['#4f9a5e', '#5cab68', '#46895a', '#6bb874'];
    const addPad = (x, z, s0) => { pads.push({ x, y: 0.045, z, rx: -Math.PI / 2, rz: r() * 6.28, s: s0, color: padCol[Math.floor(r() * 4)] }); if (r() < 0.22) lotus.push({ x, y: 0.12, z, s: 0.8 + r() * 0.4, ry: r() * 6 }); };
    for (let i = 0; i < 34; i++) { const a = r() * 6.28; if (nearDeck(a)) continue; const k = 0.62 + r() * 0.3; addPad(LAKE.x + Math.cos(a) * LAKE.rx * k, LAKE.z + Math.sin(a) * LAKE.rz * k, 0.7 + r() * 0.6); }
    for (let i = 0; i < 12; i++) { const a = r() * 6.28, rr = 1.3 + r() * 1.6; addPad(POND.x + Math.cos(a) * rr, POND.z + Math.sin(a) * rr, 0.5 + r() * 0.4); }
    scene.add(instanced(new THREE.CircleGeometry(0.42, 14, 0.4, Math.PI * 2 - 0.8), toon('#ffffff', { side: THREE.DoubleSide, emissive: new THREE.Color('#123a1e'), emissiveIntensity: 0.8 }), pads));
    if (lotus.length) {
      const petals = paint(new THREE.ConeGeometry(0.13, 0.22, 6, 1, true).toNonIndexed(), '#ffd9ea', '#ff8fbd', -0.11, 0.11);
      scene.add(instanced(petals, toon('#ffffff', { vertexColors: true, emissive: new THREE.Color('#5a2440'), emissiveIntensity: 0.6, side: THREE.DoubleSide }), lotus));
    }
    // 물 위에 떠 있는 주황 꽃잎 · 낙엽
    const floaters = [];
    const flCol = ['#ff8a3d', '#ffb347', '#ff6f3c', '#ffd27a'];
    for (let i = 0; i < 70; i++) { const a = r() * 6.28, k = Math.sqrt(r()) * 0.9; const x = LAKE.x + Math.cos(a) * LAKE.rx * k, z = LAKE.z + Math.sin(a) * LAKE.rz * k; if (Math.hypot(x - LAKE.x, z - LAKE.z) < 2.2) continue; floaters.push({ x, y: 0.05, z, rx: -Math.PI / 2, rz: r() * 6, s: 0.6 + r() * 0.6, color: flCol[i % 4] }); }
    for (let i = 0; i < 22; i++) { const a = r() * 6.28, rr = 1.1 + r() * 2.0; floaters.push({ x: POND.x + Math.cos(a) * rr, y: 0.05, z: POND.z + Math.sin(a) * rr, rx: -Math.PI / 2, rz: r() * 6, s: 0.6 + r() * 0.5, color: flCol[i % 4] }); }
    scene.add(instanced(new THREE.CircleGeometry(0.06, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), floaters));
    // 비단잉어: 몸통 + 꼬리, 천천히 둥글게 헤엄치며 물결 고리를 남긴다
    const body = new THREE.SphereGeometry(1, 10, 6); body.scale(0.1, 0.05, 0.3);
    const tail = new THREE.ConeGeometry(0.12, 0.22, 4); tail.rotateX(-Math.PI / 2); tail.scale(1, 0.25, 1); tail.translate(0, 0, -0.38);
    const fishGeo = paint(mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()]), '#ffffff', '#ffffff', 0, 1);
    const fishMat = toon('#ffffff', { vertexColors: true, emissive: new THREE.Color('#3a1a0a'), emissiveIntensity: 0.7 });
    const KOI_COL = ['#ff7a2f', '#ff9a3c', '#f6efe4', '#ff5a3a', '#ffb06b', '#ff7a2f', '#f6efe4'];
    const koi = [
      ...Array.from({ length: 7 }, (_, i) => ({ cx: LAKE.x, cz: LAKE.z, rx: LAKE.rx * (0.45 + (i % 3) * 0.12), rz: LAKE.rz * (0.42 + (i % 3) * 0.12), sp: (0.12 + (i % 4) * 0.035) * (i % 2 ? 1 : -1), ph: i * 0.9, s: 1.45 + (i % 3) * 0.2 })),
      ...Array.from({ length: 4 }, (_, i) => ({ cx: POND.x, cz: POND.z, rx: 1.6 + (i % 2) * 0.6, rz: 1.5 + (i % 2) * 0.5, sp: (0.25 + i * 0.05) * (i % 2 ? -1 : 1), ph: i * 1.6, s: 1.05 })),
    ];
    const fm = new THREE.InstancedMesh(fishGeo, fishMat, koi.length);
    koi.forEach((k, i) => fm.setColorAt(i, new THREE.Color(KOI_COL[i % KOI_COL.length])));
    fm.frustumCulled = false; scene.add(fm);
    const e = new THREE.Euler();
    updaters.push((t) => {
      koi.forEach((k, i) => {
        const a = k.ph + t * k.sp, wob = Math.sin(t * 0.37 + k.ph) * 0.12;
        const x = k.cx + Math.cos(a) * k.rx * (1 + wob), z = k.cz + Math.sin(a) * k.rz * (1 - wob);
        const dx = -Math.sin(a) * k.rx * Math.sign(k.sp), dz = Math.cos(a) * k.rz * Math.sign(k.sp);
        tmpP.set(x, 0.05, z); e.set(0, Math.atan2(dx, dz) + Math.sin(t * 6 + i) * 0.12, 0); tmpQ.setFromEuler(e); tmpS.setScalar(k.s);
        tmpM.compose(tmpP, tmpQ, tmpS); fm.setMatrixAt(i, tmpM);
        if (i + 2 < RIPN) waterMat.uniforms.uRip.value[i + 2].set(x, z, 1);
      });
      fm.instanceMatrix.needsUpdate = true;
    });
  }

  // ---------- 나무다리 · 데크 (올라서는 곳)
  const plankMat = toon('#8a5d3b'), railMat = toon('#6e472b');
  function deck({ x, z, ang, len, w, h, rails = true, cap = false }) {
    decks.push({ x, z, ang, len, w, h });
    const c = Math.cos(ang), sn = Math.sin(ang);
    const at = (along, side) => [x + along * c - side * sn, z + along * sn + side * c];
    for (let a = -len / 2; a <= len / 2 + 0.01; a += 0.55) for (const sd of [-w / 2 - 0.05, w / 2 + 0.05]) addCol(...at(a, sd), 0.16);
    if (cap) for (let sd = -w / 2; sd <= w / 2 + 0.01; sd += 0.55) addCol(...at(len / 2 + 0.05, sd), 0.16);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -ang;
    const planks = [];
    for (let a = -len / 2 + 0.2; a <= len / 2 - 0.15; a += 0.42) planks.push({ x: a, y: h - 0.05, z: 0, sx: 0.36, sy: 0.1, sz: w, color: Math.round(a * 7) % 2 ? '#8a5d3b' : '#94653f' });
    g.add(instanced(new THREE.BoxGeometry(1, 1, 1), toon('#ffffff'), planks, { cast: true }));
    for (const sz of [-w / 2 + 0.12, w / 2 - 0.12]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.18), railMat); beam.position.set(0, h - 0.17, sz); g.add(beam); }
    if (rails) {
      const posts = [];
      for (const sz of [-w / 2, w / 2]) for (let a = -len / 2; a <= len / 2 + 0.01; a += len / 3) posts.push({ x: a, y: h + 0.35, z: sz });
      g.add(instanced(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6), railMat, posts, { cast: true }));
      for (const sz of [-w / 2, w / 2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), railMat); rail.position.set(0, h + 0.7, sz); g.add(rail); }
    }
    scene.add(g);
    return g;
  }
  // 다리: 숲길이 개울을 건너는 곳, 길 방향으로
  {
    const b = SPOTS.find((s) => s.id === 'bridge');
    let bi = 0, bd = Infinity;
    loop.forEach((p, i) => { const d = Math.hypot(p[0] - b.x, p[1] - b.z); if (d < bd) { bd = d; bi = i; } });
    const pa = loop[(bi - 2 + loop.length) % loop.length], pb = loop[(bi + 2) % loop.length];
    deck({ x: b.x, z: b.z, ang: Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), len: 5.2, w: 2.6, h: 0.32 });
  }
  // 호숫가 데크: 숲길에서 호수 쪽으로 내민 나무 데크 + 벤치
  const lakeSpot = SPOTS.find((s) => s.id === 'lake');
  {
    const ang = Math.atan2(LAKE.z - lakeSpot.z, LAKE.x - lakeSpot.x);
    const len = 7.5, cx = lakeSpot.x + Math.cos(ang) * (len / 2 - 1.2), cz = lakeSpot.z + Math.sin(ang) * (len / 2 - 1.2);
    deck({ x: cx, z: cz, ang, len, w: 2.6, h: 0.3, cap: true });
    const ex = lakeSpot.x + Math.cos(ang) * (len - 2.6), ez = lakeSpot.z + Math.sin(ang) * (len - 2.6);
    scene.add(bench(LAKE_BENCH.x, LAKE_BENCH.z, LAKE_BENCH.y, LAKE_BENCH.ry)); // 앉을 수 있는 벤치 (config LOUNGE_SEATS)
  }

  // ---------- 물가는 못 들어간다 (데크 · 다리 위는 비운다)
  const onDeck = (x, z, r) => decks.some((d) => inRot(x, z, { ...d, len: d.len + r * 2, w: d.w + r * 2 }));
  const water = (x, z, r) => { if (!onDeck(x, z, r)) addCol(x, z, r); };
  for (let gx = -LAKE.rx; gx <= LAKE.rx; gx += 2.2) {
    for (let gz = -LAKE.rz; gz <= LAKE.rz; gz += 2.2) {
      if ((gx / LAKE.rx) ** 2 + (gz / LAKE.rz) ** 2 > 0.8) continue;
      water(LAKE.x + gx, LAKE.z + gz, 1.7);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.08) water(LAKE.x + Math.cos(a) * LAKE.rx, LAKE.z + Math.sin(a) * LAKE.rz, 0.8); // 물가 따라 촘촘히
  water(POND.x, POND.z, POND.r + 0.2);
  for (let i = 0; i < stream.length; i++) water(stream[i][0], stream[i][1], 1.0);

  // ---------- 숲 경계 울타리: 걸어 다닐 수 있는 맵 끝 (여기서 더는 못 나간다는 게 보이게)
  {
    const posts = [], rails = [];
    const x0 = BOUNDS.minX - 0.8, x1 = BOUNDS.maxX + 0.8, z0 = BOUNDS.minZ - 0.8, z1 = BOUNDS.maxZ + 0.8;
    const yAt = (x, z) => hillHeight(x, z);
    const overWater = (x, z) => distToPolyline(x, z, stream, false) < 1.6;
    const line = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 2.6), ang = Math.atan2(bz - az, bx - ax);
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        if (!overWater(x, z)) posts.push({ x, y: yAt(x, z) + 0.62, z, ry: i * 1.7, color: i % 2 ? '#5e4129' : '#694830' });
        if (i < n) {
          const mx = x + (bx - ax) / n / 2, mz = z + (bz - az) / n / 2;
          if (overWater(mx, mz)) continue;
          const y = yAt(mx, mz);
          rails.push({ x: mx, y: y + 0.95, z: mz, ry: -ang, sx: len / n });
          rails.push({ x: mx, y: y + 0.5, z: mz, ry: -ang, sx: len / n });
        }
      }
    };
    line(x0, z0, x1, z0); line(x1, z0, x1, z1); line(x1, z1, x0, z1); line(x0, z1, x0, z0);
    scene.add(instanced(new THREE.CylinderGeometry(0.11, 0.14, 1.25, 6), toon('#ffffff'), posts, { cast: true }));
    scene.add(instanced(new THREE.BoxGeometry(1, 0.11, 0.09), toon('#5b3e27'), rails));
  }

  // ---------- 풍차: 북쪽 숲 경계 너머, 노을 하늘을 배경으로 천천히 도는 날개
  {
    const W = WINDMILL, H = 26, white = toon('#e9e6ef'), g = new THREE.Group();
    g.position.set(W.x, 0, W.z); g.rotation.y = Math.atan2(-W.x, -W.z); // 캠핑장 쪽을 본다
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, H, 12), white); tower.position.y = H / 2; g.add(tower);
    const nac = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 2.6), white); nac.position.set(0, H + 0.3, 0.2); g.add(nac);
    const hub = new THREE.Group(); hub.position.set(0, H + 0.3, 1.6); g.add(hub);
    hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), white));
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 11, 0.12), white); b.geometry.translate(0, 5.6, 0);
      b.rotation.z = k * Math.PI * 2 / 3; hub.add(b);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glow('#ff5a4a', 2)); tip.position.set(0, H + 1.0, 0.2); g.add(tip); // 꼭대기 빨간 경고등
    scene.add(g);
    updaters.push((t) => { hub.rotation.z = t * 0.45; tip.material.color.setScalar(0).add(new THREE.Color('#ff5a4a').multiplyScalar(1.2 + Math.sin(t * 2.5) * 0.8)); });
  }

  const hazeMats = []; // 흐리거나 비 · 눈 오는 날엔 옅게
  // ---------- 🌅 노을 쪽 숲 너머 낮게 깔린 분홍 · 보랏빛 안개 (나무가 검은 실루엣으로 보이게)
  {
    // 위아래 · 좌우 가장자리가 모두 부드럽게 사라지는 안개 결 (판 모서리가 네모로 보이지 않게)
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g2 = cv.getContext('2d');
    const im = g2.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const v = y / 63, hx = Math.sin((x / 63) * Math.PI);
      const a = Math.pow(Math.sin(v * Math.PI), 1.6) * Math.pow(hx, 2.4); // 위 · 아래 · 좌우 모두 0으로 (어느 모서리도 선으로 안 보이게)
      const o = (y * 64 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = Math.round(a * 255);
    }
    g2.putImageData(im, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    // 언덕을 중심으로 노을 쪽 먼 숲 뒤에 반원으로 (언덕 바로 옆에 판이 서 있으면 판 가장자리가 하늘에 선처럼 보인다)
    const base = Math.atan2(SUNSET.z, SUNSET.x);
    for (const [rad, col, op, h] of [[58, '#8a3d78', 0.08, 12], [78, '#b2507f', 0.08, 16], [100, '#d8637a', 0.09, 22]]) {
      for (let k = -6; k <= 6; k++) {
        const a = base + k * 0.13, x = HILL.x + Math.cos(a) * rad, z = HILL.z + Math.sin(a) * rad;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(rad * 0.42, h), new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: op * Math.pow(Math.cos((k / 7) * Math.PI / 2), 1.5), depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
        m.position.set(x, h * 0.32, z); m.lookAt(HILL.x, h * 0.32, HILL.z); scene.add(m);
        m.material.userData.op = m.material.opacity; hazeMats.push(m.material);
      }
    }
  }

  // ---------- 노을 지는 언덕
  {
    const R = HILL.r, seg = 28;
    const geo = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hillHeight(HILL.x + p.getX(i), HILL.z + p.getZ(i)) - 0.03);
    geo.computeVertexNormals();
    hillMat = toon('#4f9149');
    const hill = new THREE.Mesh(geo, hillMat); hill.position.set(HILL.x, 0, HILL.z); hill.receiveShadow = true; scene.add(hill);
    // 꼭대기: 노을을 바라보는 등받이 없는 나무 벤치 하나 + 한쪽 끝에 앉은 고양이 (노을 앞 실루엣)
    {
      const B = HILL_BENCH, g = new THREE.Group();
      g.position.set(B.x, hillHeight(B.x, B.z), B.z); g.rotation.y = B.ry;
      const wood = toon('#5a3b26'), dark = toon('#3e2819');
      const seat = new THREE.Mesh(new THREE.BoxGeometry(B.len, 0.09, 0.42), wood); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
      for (const sx of [-B.len / 2 + 0.3, B.len / 2 - 0.3]) {
        for (const sz of [-0.15, 0.15]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.08), dark); l.position.set(sx, 0.24, sz); g.add(l); }
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.05), dark); br.position.set(sx + (sx < 0 ? 0.24 : -0.24), 0.25, 0); br.rotation.z = sx < 0 ? -0.75 : 0.75; g.add(br); // 비스듬한 버팀대
      }
      scene.add(g);
      addCol(B.x, B.z, 0.25);
      // 고양이: 벤치 끝에 앉아 노을을 본다. 꼬리를 살랑이고 이따금 고개를 돌린다
      const C = HILL_CAT, cat = new THREE.Group();
      cat.position.set(C.x, hillHeight(B.x, B.z) + 0.545, C.z); cat.rotation.y = B.ry;
      const fur = toon('#2c2430'), fur2 = toon('#3a3040');
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), fur); body.scale.set(0.14, 0.17, 0.17); body.position.set(0, 0.14, -0.02); cat.add(body);
      const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), fur2); chest.scale.set(0.1, 0.13, 0.08); chest.position.set(0, 0.2, 0.08); cat.add(chest);
      const head = new THREE.Group(); head.position.set(0, 0.36, 0.06); cat.add(head);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), fur); skull.scale.set(1, 0.9, 0.95); head.add(skull);
      for (const sx of [-0.055, 0.055]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), fur); ear.position.set(sx, 0.09, 0); ear.rotation.z = sx > 0 ? -0.25 : 0.25; head.add(ear); }
      for (const sx of [-0.06, 0.06]) { const paw = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), fur); paw.position.set(sx, 0.02, 0.1); cat.add(paw); }
      const tail = new THREE.Group(); tail.position.set(0.02, 0.05, -0.16); cat.add(tail);
      const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.32, 6), fur); tl.geometry.translate(0, 0.16, 0); tl.rotation.x = -1.2; tail.add(tl);
      scene.add(cat);
      updaters.push((t) => {
        tail.rotation.z = Math.sin(t * 1.4) * 0.35 + Math.sin(t * 3.1) * 0.08;
        const look = Math.sin(t * 0.21) > 0.75 ? Math.sin(t * 0.6) * 0.9 : 0; // 가끔 옆을 돌아본다
        head.rotation.y += (look - head.rotation.y) * 0.03;
        head.rotation.x = Math.sin(t * 0.5) * 0.04 - 0.08;
      });
    }
    // 언덕은 랜턴 대신 은은한 달빛 (가까이 가면 켜진다) — 별이 잘 보이게 어둡게 두되 길은 보이게
    lightSpots.push({ pos: new THREE.Vector3(HILL.x + 1, HILL.h + 3.2, HILL.z + 3), color: new THREE.Color('#c2d0ff'), intensity: 14, distance: 18 });
  }

  // ---------- 출입구: 나무 아치 + 랜턴
  const archMat = toon('#7a5233');
  const lampHead = glow('#ffcf85', 3.2);
  for (const gt of GATES) {
    const g = new THREE.Group(); g.position.set(gt.x, 0, gt.z);
    if (gt.axis === 'z') g.rotation.y = Math.PI / 2;
    for (const sx of [-gt.half - 0.15, gt.half + 0.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.9, 8), archMat); post.position.set(sx, 1.45, 0); post.castShadow = true; g.add(post);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), lampHead); head.position.set(sx, 2.25, 0.25); g.add(head);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(gt.half * 2 + 0.9, 0.2, 0.24), archMat); beam.position.set(0, 2.95, 0); beam.castShadow = true; g.add(beam);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), toon('#a47448')); board.position.set(0, 2.55, 0.06); g.add(board);
    scene.add(g);
  }

  // ---------- 갈림길 표지판 (v1.19.1): 숲길에서 캠핑장 출입구로 꺾이는 곳마다 「🔥 불멍존」 화살표 팻말
  //   팻말 끝이 출입구 쪽을 가리킨다. 숲길을 따라 어느 쪽에서 와도 읽히게 앞뒤 양면 (뒷면은 화살표 방향을 반대로)
  {
    const signTex = (flip) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const draw = () => {
        const g2 = cv.getContext('2d'); g2.clearRect(0, 0, 512, 160);
        // 화살표 모양 나무판 (flip 이면 왼쪽을 가리킨다)
        g2.save(); if (flip) { g2.translate(512, 0); g2.scale(-1, 1); }
        g2.fillStyle = '#a47448'; g2.strokeStyle = '#6e4a2c'; g2.lineWidth = 8;
        g2.beginPath(); g2.moveTo(12, 22); g2.lineTo(410, 22); g2.lineTo(498, 80); g2.lineTo(410, 138); g2.lineTo(12, 138); g2.closePath(); g2.fill(); g2.stroke();
        g2.strokeStyle = 'rgba(80,50,28,0.35)'; g2.lineWidth = 3;
        for (const y of [52, 84, 112]) { g2.beginPath(); g2.moveTo(24, y); g2.lineTo(400, y + 4); g2.stroke(); }
        g2.restore();
        g2.fillStyle = '#fff4e2'; g2.font = "64px Jua, 'Apple SD Gothic Neo', sans-serif"; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        g2.shadowColor = 'rgba(40,20,10,0.6)'; g2.shadowBlur = 6;
        g2.fillText('🔥 불멍존', flip ? 285 : 227, 84);
        tex.needsUpdate = true;
      };
      draw(); document.fonts?.load("64px Jua").then(draw, () => {});
      return tex;
    };
    const texR = signTex(false), texL = signTex(true);
    const postMat = toon('#6e4a2c'), boardGeo = new THREE.PlaneGeometry(2.6, 0.82);
    const matR = new THREE.MeshBasicMaterial({ map: texR, transparent: true, alphaTest: 0.5, color: new THREE.Color('#eadbc6') });
    const matL = new THREE.MeshBasicMaterial({ map: texL, transparent: true, alphaTest: 0.5, color: new THREE.Color('#eadbc6') });
    for (const sp of TRAIL.spurs) {
      const [jx, jz] = sp[sp.length - 1], [px, pz] = sp[sp.length - 2];
      const dl = Math.hypot(px - jx, pz - jz) || 1, dx = (px - jx) / dl, dz = (pz - jz) / dl; // 갈림길 → 출입구 쪽
      // 숲길 가장자리, 갈림길 옆 (출입구 쪽 길 입구 한쪽)
      const sx = jx + dx * (TRAIL.width / 2 + 1.6) - dz * 2.1, sz = jz + dz * (TRAIL.width / 2 + 1.6) + dx * 2.1;
      const g = new THREE.Group(); g.position.set(sx, 0, sz); g.rotation.y = Math.atan2(-dz, dx); // 판의 +x 가 출입구 쪽
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.5, 6), postMat); post.position.y = 1.25; post.castShadow = true; g.add(post);
      const front = new THREE.Mesh(boardGeo, matR); front.position.set(1.05, 2.1, 0.03); g.add(front);
      const back = new THREE.Mesh(boardGeo, matL); back.position.set(1.05, 2.1, -0.03); back.rotation.y = Math.PI; g.add(back);
      scene.add(g); addCol(sx, sz, 0.15);
    }
  }

  // ---------- 숲길 랜턴: 길을 따라 듬성듬성, 언덕 근처는 별이 잘 보이게 비운다
  {
    const posts = [], heads = [], pools = [];
    let side = 1;
    for (let i = 0; i < loop.length; i += 6) {
      const [x, z] = loop[i], [nx, nz] = loop[(i + 1) % loop.length];
      if (Math.hypot(x - HILL.x, z - HILL.z) < 18) continue;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < 13) continue;
      const tx = nx - x, tz = nz - z, tl = Math.hypot(tx, tz) || 1;
      side = -side;
      const px = x - (tz / tl) * 1.9 * side, pz = z + (tx / tl) * 1.9 * side;
      posts.push({ x: px, y: 0.38, z: pz });
      heads.push({ x: px, y: 0.82, z: pz });
      pools.push({ x: px, y: 0.02, z: pz, rx: -Math.PI / 2 });
      lanterns.push([px, pz, x - (tz / tl) * 0.3 * side, z + (tx / tl) * 0.3 * side]);
      addCol(px, pz, 0.18);
      // 가까운 랜턴 몇 개만 실제로 켜진다 (main.js 의 LightPool, 폰 2개 · PC 3개 — 발열은 그대로)
      lightSpots.push({ pos: new THREE.Vector3(px, 1.3, pz), color: new THREE.Color('#ffb565'), intensity: 7, distance: 13 });
    }
    // 호숫가 데크 입구 양옆
    for (const s of [-1, 1]) {
      const ang = Math.atan2(LAKE.z - lakeSpot.z, LAKE.x - lakeSpot.x);
      const px = lakeSpot.x - Math.cos(ang) * 1.6 - Math.sin(ang) * 1.6 * s, pz = lakeSpot.z - Math.sin(ang) * 1.6 + Math.cos(ang) * 1.6 * s;
      posts.push({ x: px, y: 0.38, z: pz }); heads.push({ x: px, y: 0.82, z: pz }); pools.push({ x: px, y: 0.02, z: pz, rx: -Math.PI / 2 });
    }
    scene.add(instanced(new THREE.CylinderGeometry(0.06, 0.08, 0.76, 6), archMat, posts, { cast: true }));
    scene.add(instanced(new THREE.BoxGeometry(0.2, 0.22, 0.2), lampHead, heads));
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffae5c', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(instanced(new THREE.PlaneGeometry(5.2, 5.2), poolMat, pools));
  }

  // ---------- 들판: 🌸 핑크뮬리 · 🌾 갈대 (숲길이 가운데를 지나간다). 바람에 살랑 — 흔들림은 셰이더에서 (폰 부담 적게)
  const swayTime = { value: 0 };
  updaters.push((t) => { swayTime.value = t; });
  // 가리는 부분 비우기: 안쪽은 깨끗하게 완전히 비우고, 가장자리 얇은 띠만 4×4 규칙 무늬(Bayer)로 부드럽게.
  // (예전엔 넓은 범위를 픽셀마다 무작위로 비워 모래알 같은 노이즈가 보였다)
  const BAYER4 = `float bayer4(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i] + 0.5) / 16.0;
  }
`;
  // 카메라와 내 캐릭터 사이를 가리는 꽃구름은 비워 속이 보이게 (hole) — 벚꽃 터널이 화면을 덮지 않게
  const focusU = { value: new THREE.Vector3(0, -999, 0) };
  const swayMat = (opts, amp, speed, hole = false) => {
    const m = toon('#ffffff', opts);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSway = swayTime;
      sh.uniforms.uFocus = focusU;
      sh.vertexShader = 'uniform float uSway;\nvarying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float k = max(position.y + 0.5, 0.0);
          float w = sin(uSway * ${speed.toFixed(2)} + ip.x * 0.23 + ip.z * 0.17) + 0.4 * sin(uSway * ${(speed * 2.3).toFixed(2)} + ip.x * 0.6);
          transformed.x += w * ${amp.toFixed(3)} * k; transformed.z += w * ${(amp * 0.5).toFixed(3)} * k; }`).replace('#include <project_vertex>', `#include <project_vertex>
        vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
      if (hole) {
        sh.fragmentShader = 'uniform vec3 uFocus;\nvarying vec3 vWp;\n' + BAYER4 + sh.fragmentShader.replace('void main() {', `void main() {
          { vec3 a = cameraPosition, b = uFocus + vec3(0.0, 0.8, 0.0), ab = b - a;
            float tt = clamp(dot(vWp - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float dl = distance(vWp, a + ab * tt);               // 카메라→캐릭터 선까지 거리
            float dc = distance(vWp, cameraPosition);             // 카메라가 꽃구름 속에 있을 때
            float keep = min(smoothstep(1.7, 2.3, dl) + step(0.97, tt), smoothstep(2.6, 3.2, dc));
            if (keep < 1.0 && bayer4(gl_FragCoord.xy) > keep) discard; }`);
      }
    };
    m.customProgramCacheKey = () => `sway${amp}${speed}${hole}`;
    return m;
  };
  // 흔들리지 않는 물체(벚나무 줄기 · 가지 · 붉은 문)도 카메라와 캐릭터 사이를 가리면 비워 속이 보이게
  const holeMat = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFocus = focusU;
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
      sh.fragmentShader = 'uniform vec3 uFocus;\nvarying vec3 vWp;\n' + BAYER4 + sh.fragmentShader.replace('void main() {', `void main() {
          { vec3 a = cameraPosition, b = uFocus + vec3(0.0, 0.8, 0.0), ab = b - a;
            float tt = clamp(dot(vWp - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float dl = distance(vWp, a + ab * tt);
            float dc = distance(vWp, cameraPosition);
            float keep = min(smoothstep(0.9, 1.3, dl) + step(0.97, tt), smoothstep(2.0, 2.6, dc));
            if (keep < 1.0 && bayer4(gl_FragCoord.xy) > keep) discard; }`);
    };
    m.customProgramCacheKey = () => 'holeMat';
    return m;
  };
  const muhlyMat = swayMat({ vertexColors: true, emissive: new THREE.Color('#5a1d3c'), emissiveIntensity: 0.5, side: THREE.DoubleSide }, 0.12, 1.1); // v1.21.2: 키 큰 풀이 캐릭터를 가려도 그대로 둔다 (비우면 더 어색해서)
  const reedPlumeMat = swayMat({ vertexColors: true, emissive: new THREE.Color('#2e2a20'), emissiveIntensity: 0.45 }, 0.14, 1.3);
  const daisyMat = swayMat({ vertexColors: true, emissive: new THREE.Color('#3a3a30'), emissiveIntensity: 0.55 }, 0.05, 1.6);
  const blossomMat = swayMat({ vertexColors: true, emissive: new THREE.Color('#6a2a4c'), emissiveIntensity: 0.6 }, 0.025, 0.7, true);
  updaters.push((t, dt, shared) => { if (shared?.focus) focusU.value.copy(shared.focus); });
  const nearPath = (x, z, m) => distToPolyline(x, z, loop, true) < TRAIL.width / 2 + m || spurs.some((sp) => distToPolyline(x, z, sp, false) < TRAIL.width / 2 + m);
  const zonePaths = ZONES.map((z) => zonePath(z));
  const BAND = 8.5; // 길 가운데에서 양옆으로 이만큼까지 심는다
  // 들판에 심지 않는 곳: 캠핑장 울타리 · 맵 끝 · 물 · 언덕 · 데크 · 랜턴
  const plantBlocked = (x, z) =>
    (Math.abs(x) < FENCE.maxX + 3 && Math.abs(z) < FENCE.maxZ + 3) ||
    x < BOUNDS.minX + 0.8 || x > BOUNDS.maxX - 0.8 || z < BOUNDS.minZ + 0.8 || z > BOUNDS.maxZ - 0.8 ||
    ((x - LAKE.x) / (LAKE.rx + 2)) ** 2 + ((z - LAKE.z) / (LAKE.rz + 2)) ** 2 < 1 ||
    Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5 || distToPolyline(x, z, stream, false) < 1.8 ||
    Math.hypot(x - HILL.x, z - HILL.z) < HILL.r + 0.5 ||
    decks.some((d) => inRot(x, z, { ...d, len: d.len + 1, w: d.w + 1 })) ||
    lanterns.some(([lx, lz]) => (lx - x) ** 2 + (lz - z) ** 2 < 2.2); // v1.21.2: 랜턴 둘레 약 1.5m 는 비워 풀이 빛에 하얗게 타지 않게
  const scatter = (path, count, seedStart, band = BAND) => {
    let seed = seedStart; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = [];
    for (let tries = 0; out.length < count && tries < count * 8; tries++) {
      const i = Math.floor(r() * (path.length - 1)), [ax, az] = path[i], [bx, bz] = path[i + 1];
      const f = r(), x0 = ax + (bx - ax) * f, z0 = az + (bz - az) * f;
      const tx = bx - ax, tz = bz - az, tl = Math.hypot(tx, tz) || 1;
      const side = r() < 0.5 ? -1 : 1, off = TRAIL.width / 2 + 0.5 + Math.pow(r(), 1.3) * (band - TRAIL.width / 2 - 0.5);
      const x = x0 - (tz / tl) * off * side, z = z0 + (tx / tl) * off * side;
      if (nearPath(x, z, 0.4) || plantBlocked(x, z)) continue;
      // 길에서 멀수록 듬성듬성 (숲으로 자연스럽게)
      if (off > band * 0.75 && r() < 0.5) continue;
      out.push([x, z, r(), r(), r(), off, (tz / tl) * side, -(tx / tl) * side]); // 6~8번째: 길 가장자리까지 거리, 길 쪽 방향
    }
    return out;
  };
  const addPatch = (geo, mat, list) => { if (!list.length) return null; const m = instanced(geo, mat, list); m.computeBoundingSphere(); scene.add(m); return m; };
  const lenOf = (path) => path.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);
  const dens = lowSpec ? 0.5 : 1;
  // 🌾 길 쪽으로 기울이기 (v1.21.2): 길에 가까울수록 키가 크고 길 위로 휘어 덮는다. order XZY = 제자리에서 돌린 뒤 기울인다
  const PATH_EDGE = TRAIL.width / 2 + 0.5;
  const nearK = (off, reach) => Math.max(0, 1 - (off - PATH_EDGE) / reach); // 길 가장자리 1 → reach 밖 0
  const leanTo = (nx, nz, ang) => ({ rx: ang * nz, rz: -ang * nx, order: 'XZY' });
  // 저사양(휴대폰)은 들판을 절반만 심지만, 길가 줄(가장자리 3m)은 PC 만큼 채워 길을 덮는 느낌을 지킨다
  const fieldScatter = (path, perM, seed, band = BAND) => {
    const L = lenOf(path), list = scatter(path, Math.round(L * perM * dens), seed, band);
    return lowSpec ? list.concat(scatter(path, Math.round(L * perM * 0.3), seed + 977, PATH_EDGE + 3)) : list;
  };
  const tuftGeo = muhlyTuft(), reedGeo = reedStem(), daisyGeo = daisyFlower(), kochiaGeo = kochiaBush();
  const kochiaMat = swayMat({ vertexColors: true, emissive: new THREE.Color('#3a1a12'), emissiveIntensity: 0.55 }, 0.025, 0.9);
  const cherryTrees = [];
  ZONES.forEach((zn, zi) => {
    const path = zonePaths[zi], L = lenOf(path), seed = 101 + zi * 37;
    if (zn.kind === 'muhly') {
      const tints = ['#ffffff', '#ffe6f1', '#f6d2e4', '#ffeef6'];
      // v1.21.2: 두 배 넘게 빽빽하게, 길 가까이는 사람 키보다 높게(최대 약 2.6m) 길 위로 휘어 분홍 터널처럼
      addPatch(tuftGeo, muhlyMat, fieldScatter(path, 26, seed).map(([x, z, a, b, c, off, nx, nz]) => {
        const k = nearK(off, 3.2), w = 0.8 + a * 0.4 + k * 0.4, hy = (0.75 + c * 0.35) * (1 + k); // 키: 먼 곳 0.9~1.3m · 길가 최대 약 2.5m
        return { x, y: 0, z, sx: w * (1 + b * 0.3), sy: hy, sz: w * (1 + c * 0.3), ry: b * 6.28, ...leanTo(nx, nz, 0.08 + k * 0.3), color: tints[Math.floor(c * tints.length)] };
      }));
      const haze = new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ff8fc2', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
      addPatch(new THREE.PlaneGeometry(1, 1), haze, path.filter((_, i) => i % 6 === 0).flatMap(([x, z]) => [{ x, y: 0.04, z, rx: -Math.PI / 2, sx: BAND * 2, sy: 9 }]));
    } else if (zn.kind === 'kochia') {
      // 🍂 댑싸리: 길 가까이 줄지어, 색은 무리 지어 바뀐다 (빨강 · 주황 · 연두)
      const KC = ['#d8304a', '#e8503c', '#f08a3a', '#c9c24a', '#8fbf4a', '#d8304a'];
      const bushes = scatter(path, Math.round(L * 7 * dens), seed, 5.2).filter(([x, z]) => !nearPath(x, z, 0.9)).map(([x, z, a, b]) => {
        const ci = Math.floor(((Math.sin(x * 0.11) + Math.cos(z * 0.13)) * 0.25 + 0.5) * (KC.length - 1) + (a - 0.5) * 1.2);
        const s0 = 0.65 + b * 0.45;
        return { x, y: 0, z, sx: s0, sy: s0 * (0.9 + a * 0.3), sz: s0, ry: a * 6, color: KC[Math.max(0, Math.min(KC.length - 1, ci))] };
      });
      addPatch(kochiaGeo, kochiaMat, bushes);
      // 그 뒤로 키 큰 은빛 억새
      const silver = ['#ffffff', '#f6f1e6', '#efe8da', '#fffaf0'];
      // v1.21.2: 더 빽빽하고 키 크게, 밧줄 울타리 너머에서 길 쪽으로 드리운다
      addPatch(reedGeo, reedPlumeMat, scatter(path, Math.round(L * 16 * dens), seed + 3).filter(([x, z]) => !nearPath(x, z, 2.6)).map(([x, z, a, b, c, off, nx, nz]) => {
        const k = nearK(off, 4), h = 1.6 + a * 0.6 + k * 0.4;
        return { x, y: 0, z, sx: 1.15, sy: h, sz: 1.15, ry: c * 6.28, ...leanTo(nx, nz, 0.06 + k * 0.28 + (b - 0.5) * 0.12), color: silver[Math.floor(b * silver.length)] };
      }));
      // 나무 말뚝 + 흰 밧줄 울타리 (길 양옆)
      const posts = [], ropes = [];
      for (const side of [-1, 1]) {
        let prev = null, acc = 0;
        for (let i = 1; i < path.length; i++) {
          const [ax, az] = path[i - 1], [bx, bz] = path[i], tl = Math.hypot(bx - ax, bz - az) || 1;
          acc += tl; if (acc < 2.4 && prev) continue; acc = 0;
          const px = bx - ((bz - az) / tl) * 1.75 * side, pz = bz + ((bx - ax) / tl) * 1.75 * side;
          if (plantBlocked(px, pz)) { prev = null; continue; }
          posts.push({ x: px, y: 0.42, z: pz, ry: i, color: '#8a6a3e' });
          if (prev) for (const [y0, sag] of [[0.62, 0.1]]) { // 밧줄은 가운데가 살짝 처진다
            const mx = (prev[0] + px) / 2, mz = (prev[1] + pz) / 2;
            for (const [x0, z0, x1, z1, ya, yb] of [[prev[0], prev[1], mx, mz, y0, y0 - sag], [mx, mz, px, pz, y0 - sag, y0]]) {
              const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), dy = yb - ya;
              ropes.push({ x: (x0 + x1) / 2, y: (ya + yb) / 2, z: (z0 + z1) / 2, ry: -Math.atan2(dz, dx), rz: Math.atan2(dy, len), sx: Math.hypot(len, dy) });
            }
          }
          prev = [px, pz];
        }
      }
      addPatch(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 7), toon('#ffffff'), posts);
      addPatch(new THREE.BoxGeometry(1, 0.025, 0.025), toon('#eeeae2', { emissive: new THREE.Color('#2a2a2a'), emissiveIntensity: 0.5 }), ropes);
    } else if (zn.kind === 'reed') {
      const tints = ['#ffffff', '#f3ead6', '#e8dcc0', '#fff8e8'];
      // v1.21.2: 빽빽하게, 길가는 키가 커지고 길 위로 이삭이 드리운다
      addPatch(reedGeo, reedPlumeMat, fieldScatter(path, 30, seed).map(([x, z, a, b, c, off, nx, nz]) => {
        const k = nearK(off, 3.5), h = 1.2 + a * 0.4 + k * 0.5; // 키(이삭까지): 먼 곳 1.7~2.2m · 길가 최대 약 2.9m
        return { x, y: 0, z, sx: 1.1, sy: h, sz: 1.1, ry: c * 6.28, ...leanTo(nx, nz, 0.05 + k * 0.32 + (b - 0.5) * 0.12), color: tints[Math.floor(b * tints.length)] };
      }));
    } else if (zn.kind === 'daisy') {
      const tints = ['#ffffff', '#fffbe6', '#f4f0ff', '#ffffff', '#fff2f6'];
      addPatch(daisyGeo, daisyMat, scatter(path, Math.round(L * 22 * dens), seed, BAND - 1).map(([x, z, a, b, c]) => {
        const sz = 0.75 + a * 0.5;
        return { x, y: 0, z, s: sz, ry: b * 6.28, rx: (c - 0.5) * 0.25, color: tints[Math.floor(c * tints.length)] };
      }));
      // 데이지 사이 연두 풀
      addPatch(new THREE.ConeGeometry(0.05, 0.45, 3), toon('#ffffff'), scatter(path, Math.round(L * 10 * dens), seed + 5, BAND - 1).map(([x, z, a, b]) => ({ x, y: 0.2, z, s: 0.8 + a * 0.6, ry: b * 6, rz: (a - 0.5) * 0.4, color: b > 0.5 ? '#6fae4f' : '#82bd5c' })));
    } else if (zn.kind === 'cherry') {
      // 벚꽃 터널: 길 양옆 5.5m 간격으로, 길 위로 휘어 꽃구름이 맞닿게
      let acc = 0;
      for (let i = 1; i < path.length; i++) {
        acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        if (acc < 5.5) continue;
        acc = 0;
        const [ax, az] = path[i - 1], [bx, bz] = path[i], tx = bx - ax, tz = bz - az, tl = Math.hypot(tx, tz) || 1;
        const nx = -tz / tl, nz = tx / tl; // 길 옆 방향
        for (const side of [-1, 1]) {
          const x = bx + nx * 3.8 * side, z = bz + nz * 3.8 * side; // 길에서 조금 떨어져 터널이 답답하지 않게
          if (plantBlocked(x, z)) continue;
          cherryTrees.push({ x, z, nx: nx * side, nz: nz * side, tx: tx / tl, tz: tz / tl, cx: bx, cz: bz, s: 0.92 + ((i * 7) % 5) * 0.05, k: cherryTrees.length });
          addCol(x, z, 0.35);
        }
      }
      // 길은 꽃잎 카펫, 길가는 꽃잎 깔린 풀밭
      const PK = ['#ff9fc6', '#ffb6d3', '#ff8fbd', '#ffc6dc', '#f78ab6'];
      const petals = scatter(path, Math.round(L * 30 * dens), seed, 6).map(([x, z, a, b, c]) => ({ x, y: 0.02 + a * 0.01, z, rx: -Math.PI / 2, rz: b * 6.28, s: 0.7 + c * 0.6, color: PK[Math.floor(a * 5)] }));
      let ps = 9; const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
      for (const [x, z] of path) for (let k = 0; k < (lowSpec ? 5 : 9); k++) petals.push({ x: x + (pr() - 0.5) * 2.6, y: 0.025 + pr() * 0.005, z: z + (pr() - 0.5) * 2.6, rx: -Math.PI / 2, rz: pr() * 6.28, s: 0.7 + pr() * 0.6, color: PK[Math.floor(pr() * 5)] });
      const carpet = addPatch(new THREE.CircleGeometry(0.055, 5), new THREE.MeshBasicMaterial({ color: '#d9d9d9' }), petals);
      // 길가 보랏빛 꽃
      const PU = ['#c9a3f0', '#d8a8e8', '#b58ee0', '#e2b6f2'];
      const purple = addPatch(new THREE.IcosahedronGeometry(0.045, 1), toon('#ffffff', { emissive: new THREE.Color('#2e1c4a'), emissiveIntensity: 0.5 }),
        scatter(path, Math.round(L * 40 * dens), seed + 11, 7).map(([x, z, a, b]) => ({ x, y: 0.08 + a * 0.06, z, s: 0.8 + b * 0.7, color: PU[Math.floor(a * 4)] })));
      snowFx.push((on) => { if (carpet) carpet.visible = !on; if (purple) purple.visible = !on; });
      // 양 끝 붉은 나무 문
      for (const [k0, k1] of [[2, 0], [path.length - 3, path.length - 1]]) {
        const [gx, gz] = path[k0], [hx, hz] = path[k1], ang = Math.atan2(hz - gz, hx - gx);
        const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = -ang + Math.PI / 2;
        const red = holeMat(toon('#c8442c', { emissive: new THREE.Color('#3a0e08'), emissiveIntensity: 0.5 })), dark = holeMat(toon('#2c2220', {}));
        for (const sx of [-2.3, 2.3]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.7, 10), red); pl.position.set(sx, 1.85, 0); pl.castShadow = true; g.add(pl); const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.25, 10), dark); ft.position.set(sx, 0.12, 0); g.add(ft); }
        const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 0.18), red); nuki.position.y = 2.95; g.add(nuki);
        const kasa = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.26, 0.34), dark); kasa.position.y = 3.72; g.add(kasa);
        const kasa2 = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.18, 0.28), red); kasa2.position.y = 3.52; g.add(kasa2);
        for (const sx of [-3.05, 3.05]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.34), dark); tip.position.set(sx, 3.8, 0); tip.rotation.z = sx > 0 ? 0.25 : -0.25; g.add(tip); }
        scene.add(g);
        for (const sx of [-2.3, 2.3]) { const wx = gx + Math.cos(ang + Math.PI / 2) * sx, wz = gz + Math.sin(ang + Math.PI / 2) * sx; addCol(wx, wz, 0.25); }
      }
    }
  });
  // 벚나무: 길 위로 휜 굵은 줄기 · 가지 + 크고 밝은 꽃구름, 가지 끝에 매달린 종이 등불
  if (cherryTrees.length) {
    const trunks = [], branches = [], blooms = [], lanterns2 = [], strings = [];
    const bloomColors = ['#ffc0d9', '#ffb0cf', '#ffd6e6', '#f7a6c6', '#ffe4ee', '#ffcbe0'];
    const up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), q = new THREE.Quaternion(), eu = new THREE.Euler();
    const seg = (list, ax, ay, az, bx, by, bz, color) => { // a → b 를 잇는 기둥 (instanced 원기둥, 높이 1 기준)
      v.set(bx - ax, by - ay, bz - az); const len = v.length(); q.setFromUnitVectors(up, v.normalize()); eu.setFromQuaternion(q);
      list.push({ x: (ax + bx) / 2, y: (ay + by) / 2, z: (az + bz) / 2, rx: eu.x, ry: eu.y, rz: eu.z, sx: 1, sy: len, sz: 1, color });
    };
    let cs = 21; const cr = () => ((cs = (cs * 16807) % 2147483647) / 2147483647);
    cherryTrees.forEach((t, i) => {
      // 줄기: 뿌리에서 길 쪽으로 휘어 오른다
      const kx = t.x - t.nx * 1.4, kz = t.z - t.nz * 1.4, ky = 3.5 * t.s;
      seg(trunks, t.x, 0, t.z, kx, ky, kz, '#3e2a22');
      // 꽃구름 가운데: 길 한가운데 쪽으로 더 나가 높이 (양옆 나무의 꽃이 길 위에서 맞닿는다)
      const cx = t.x - t.nx * 2.6, cz = t.z - t.nz * 2.6, cy = 5.1 * t.s;
      for (let k = 0; k < 4; k++) { // 가지
        const a = k * 1.6 + i, ex = cx + Math.cos(a) * 1.4, ez = cz + Math.sin(a) * 1.4, ey = cy - 0.2 + (k % 2) * 0.5;
        seg(branches, kx, ky, kz, ex, ey, ez, '#3e2a22');
      }
      for (let k = 0; k < 11; k++) {
        const a = cr() * 6.28, rr = k === 0 ? 0 : 0.8 + cr() * 1.9;
        blooms.push({ x: cx + Math.cos(a) * rr + t.tx * (cr() - 0.5) * 1.6, y: cy + (cr() - 0.3) * 1.3, z: cz + Math.sin(a) * rr + t.tz * (cr() - 0.5) * 1.6, s: (k === 0 ? 1.8 : 0.95 + cr() * 0.75) * t.s, ry: a, color: bloomColors[Math.floor(cr() * bloomColors.length)] });
      }
      // 종이 등불: 꽃구름 아래, 길 위로 매달린다
      if (i % 2 === 0 || cr() < 0.4) {
        const lx = t.x - t.nx * (2.5 + cr() * 0.6) + t.tx * (cr() - 0.5) * 1.5, lz = t.z - t.nz * (2.5 + cr() * 0.6) + t.tz * (cr() - 0.5) * 1.5, ly = 3.0 + cr() * 0.6;
        lanterns2.push({ x: lx, y: ly, z: lz });
        strings.push({ x: lx, y: (ly + cy - 0.6) / 2 + 0.2, z: lz, sy: cy - 0.6 - ly });
        if (lanterns2.length % 2) lightSpots.push({ pos: new THREE.Vector3(lx, ly, lz), color: new THREE.Color('#ffc278'), intensity: 4.5, distance: 9 });
      }
    });
    addPatch(new THREE.CylinderGeometry(0.2, 0.3, 1, 8), holeMat(toon('#ffffff', {})), trunks);
    addPatch(new THREE.CylinderGeometry(0.06, 0.11, 1, 5), holeMat(toon('#ffffff', {})), branches);
    const bloomGeo = paint(new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), '#f08fb4', '#ffeaf3', -0.9, 0.9);
    addPatch(bloomGeo, blossomMat, blooms);
    if (lanterns2.length) {
      addPatch(new THREE.CylinderGeometry(0.17, 0.17, 0.38, 10), glow('#ffd29a', 1.5), lanterns2);
      addPatch(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), toon('#3a2a20'), lanterns2.flatMap((l) => [{ ...l, y: l.y + 0.21 }, { ...l, y: l.y - 0.21 }]));
      addPatch(new THREE.CylinderGeometry(0.008, 0.008, 1, 3), toon('#2a201a'), strings);
      const glowMat = new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb766', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const l of lanterns2) { const sp = new THREE.Sprite(glowMat); sp.position.set(l.x, l.y, l.z); sp.scale.setScalar(1.1); scene.add(sp); }
    }
    // 흩날리는 꽃잎 (밝게) + 떠다니는 따뜻한 불티
    const PN = lowSpec ? 110 : 230, fall = [];
    const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.06), new THREE.MeshBasicMaterial({ color: '#ff9fc6', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), PN);
    pm.frustumCulled = false; scene.add(pm);
    snowFx.push((on) => pm.material.color.set(on ? '#f4f8ff' : '#ff9fc6')); // 눈 오면 꽃잎 대신 눈송이
    let ps = 5; const r = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
    const respawn = (f, anyY) => {
      const b = blooms[Math.floor(r() * blooms.length)];
      f.x = b.x + (r() - 0.5) * 1.6; f.z = b.z + (r() - 0.5) * 1.6; f.y = anyY ? r() * b.y : b.y - 0.4;
      f.vy = 0.3 + r() * 0.35; f.ph = r() * 6.28; f.sp = 0.8 + r() * 1.2;
    };
    for (let i = 0; i < PN; i++) { const f = {}; respawn(f, true); fall.push(f); }
    const SN = lowSpec ? 30 : 60, sparks = [];
    const sm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 5, 3), new THREE.MeshBasicMaterial({ color: '#ffb48a', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), SN);
    sm.frustumCulled = false; scene.add(sm);
    for (let i = 0; i < SN; i++) { const t0 = cherryTrees[Math.floor(r() * cherryTrees.length)]; sparks.push({ x: t0.x - t0.nx * 2 + (r() - 0.5) * 4, z: t0.z - t0.nz * 2 + (r() - 0.5) * 4, y: 0.5 + r() * 3.5, ph: r() * 6.28, sp: 0.2 + r() * 0.4 }); }
    const e = new THREE.Euler();
    updaters.push((t, dt) => {
      dt = Math.min(dt, 0.05);
      fall.forEach((f, i) => {
        f.y -= f.vy * dt; f.x += Math.sin(t * f.sp + f.ph) * 0.5 * dt + 0.2 * dt; f.z += Math.cos(t * f.sp * 0.8 + f.ph) * 0.4 * dt;
        if (f.y < 0.03) respawn(f, false);
        tmpP.set(f.x, f.y, f.z); e.set(t * f.sp + f.ph, t * 0.7 + f.ph, 0); tmpQ.setFromEuler(e); tmpS.setScalar(1);
        tmpM.compose(tmpP, tmpQ, tmpS); pm.setMatrixAt(i, tmpM);
      });
      pm.instanceMatrix.needsUpdate = true;
      sparks.forEach((s0, i) => {
        tmpP.set(s0.x + Math.sin(t * s0.sp + s0.ph) * 0.6, s0.y + Math.sin(t * s0.sp * 1.3 + s0.ph) * 0.4, s0.z + Math.cos(t * s0.sp + s0.ph) * 0.6);
        tmpS.setScalar(0.6 + 0.6 * Math.max(0, Math.sin(t * 2 + s0.ph)));
        tmpM.compose(tmpP, tmpQ.identity(), tmpS); sm.setMatrixAt(i, tmpM);
      });
      sm.instanceMatrix.needsUpdate = true;
    });
  }

  // 나무를 심지 않을 곳 (길 · 물 · 언덕 · 데크 · 들판)
  function treeBlocked(x, z) {
    if (distToPolyline(x, z, loop, true) < TRAIL.width / 2 + 4.2) return true; // 카메라가 나무 속에 묻히지 않게 넉넉히
    for (const s of spurs) if (distToPolyline(x, z, s, false) < TRAIL.width / 2 + 1.8) return true;
    if (((x - LAKE.x) / (LAKE.rx + 3.5)) ** 2 + ((z - LAKE.z) / (LAKE.rz + 3.5)) ** 2 < 1) return true;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) return true;
    if (distToPolyline(x, z, stream, false) < 2.6) return true;
    if (Math.hypot(x - HILL.x, z - HILL.z) < HILL.r + 1.5) return true;
    if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 9) return true;
    { // 노을 지는 언덕에서 해 지는 쪽은 가까운 나무를 비워 지평선이 트이게 (먼 숲 실루엣은 남긴다)
      const dx = x - HILL.x, dz = z - HILL.z, along = dx * SUNSET.x + dz * SUNSET.z, perp = Math.abs(-dx * SUNSET.z + dz * SUNSET.x);
      if (along > 0 && along < 55 && perp < 4 + along * 0.42) return true;
    }
    if (Math.hypot(x - lakeSpot.x, z - lakeSpot.z) < 5) return true;
    if (zonePaths.some((zp) => distToPolyline(x, z, zp, false) < BAND + 1.5)) return true;
    return false;
  }
  /** 언덕 · 다리 · 데크 위에서의 높이 */
  function heightAt(x, z) {
    for (const d of decks) if (inRot(x, z, d)) return d.h;
    return hillHeight(x, z);
  }
  // 🌧 비 오는 날: 랜턴 옆 길 위 물웅덩이 (짙은 물빛 + 랜턴 불빛이 길게 비친다). 평소에는 숨김
  const puddles = new THREE.Group(); puddles.visible = false; scene.add(puddles);
  {
    let ps = 31; const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
    const pudList = [], glints = [];
    for (const [lx, lz, cx, cz] of lanterns) {
      if (cx === undefined) continue;
      const a = pr() * 6.28, ux = Math.cos(a), uz = Math.sin(a);
      pudList.push({ x: cx, y: 0.035, z: cz, rx: -Math.PI / 2, rz: a, sx: 0.9 + pr() * 0.6, sy: 0.55 + pr() * 0.35, sz: 1 });
      if (pr() < 0.6) pudList.push({ x: cx + ux * 0.7, y: 0.034, z: cz + uz * 0.7, rx: -Math.PI / 2, rz: a + 1, sx: 0.45 + pr() * 0.3, sy: 0.3 + pr() * 0.2, sz: 1 });
      const dx = lx - cx, dz = lz - cz, dl = Math.hypot(dx, dz) || 1;
      glints.push({ x: cx + dx / dl * 0.15, y: 0.04, z: cz + dz / dl * 0.15, rx: -Math.PI / 2, rz: Math.atan2(dx, dz), sx: 0.5, sy: 1.5, sz: 1 });
    }
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 64; // 가장자리만 부드러운 물웅덩이 (가운데는 또렷한 물빛, 위쪽은 하늘이 비쳐 살짝 밝게)
    { const g2 = pcv.getContext('2d'), gr = g2.createRadialGradient(28, 26, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(150,170,215,1)'); gr.addColorStop(0.55, 'rgba(70,90,140,1)'); gr.addColorStop(0.8, 'rgba(40,55,95,0.9)'); gr.addColorStop(1, 'rgba(40,55,95,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); }
    for (let i = 3; i < loop.length; i += 6) { // 랜턴 사이 길 위에도 작은 웅덩이 몇 개
      if (pr() < 0.45) continue;
      const [x, z] = loop[i]; if (Math.hypot(x - HILL.x, z - HILL.z) < 14 || Math.hypot(x - LAKE.x, z - LAKE.z) < 12) continue;
      pudList.push({ x: x + (pr() - 0.5) * 0.9, y: 0.034, z: z + (pr() - 0.5) * 0.9, rx: -Math.PI / 2, rz: pr() * 6.28, sx: 0.5 + pr() * 0.5, sy: 0.35 + pr() * 0.3, sz: 1 });
    }
    const pm = instanced(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pcv), color: '#5d6f99', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), pudList, { cast: false });
    const gm = instanced(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffc27a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5 }), glints, { cast: false });
    puddles.add(pm, gm);
    // 물웅덩이 위로 빗방울 고리가 반짝이게 불빛을 살짝 일렁인다
    updaters.push((t) => { if (puddles.visible) gm.material.opacity = 0.7 + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 3.1); });
  }

  return {
    treeBlocked, heightAt, loop, spurs, chairs,
    /** 흔들의자 흔들기 (a: 기울기 rad) */
    rockChair(i, a) { const c = chairs[i]; if (c) c.rock.rotation.x = a; },
    setTheme(kind) {
      const snow = kind === 'snow';
      snowy = snow;
      // 눈 오면 들판에도 눈이 내려앉은 빛: 흙길은 얇게 눈 덮인 빛, 꽃 · 풀 끝은 하얗게, 벚꽃 터널은 눈꽃 터널로
      pathMat.emissive.set(snow ? '#8f97ab' : '#000000'); pathMat.emissiveIntensity = snow ? 0.75 : 1;
      for (const [m, c, k] of [[daisyMat, '#3a3a30', 0.55], [kochiaMat, '#3a1a12', 0.55], [reedPlumeMat, '#2e2a20', 0.45], [blossomMat, '#6a2a4c', 0.6]]) {
        m.emissive.set(snow ? (m === blossomMat ? '#9aa3bb' : '#7b8396') : c); m.emissiveIntensity = snow ? (m === blossomMat ? 0.6 : 0.7) : k;
      }
      for (const f of snowFx) f(snow);
      // 🌧 비 오는 날: 흙길은 짙게 젖고, 길 위에 물웅덩이, 호수 · 연못엔 빗방울 물결
      const wet = kind === 'wet';
      pathMat.color.set(wet ? '#8d8078' : '#ffffff');
      puddles.visible = wet;
      waterMat.uniforms.uRain.value = wet ? 1 : 0;
      for (const m of hazeMats) m.opacity = m.userData.op * (kind === 'grass' ? 1 : 0.3);
      muhlyMat.color.set(snow ? '#f3e6ee' : '#ffffff');
      waterMat.uniforms.uFrozen.value = kind === 'snow' ? 1 : 0;
      hillMat?.color.set(kind === 'snow' ? '#e6ecf5' : kind === 'wet' ? '#356538' : '#4f9149');
    },
  };
}

/** 등받이 나무 벤치 (ry: 앉은 사람이 보는 방향) */
function bench(x, z, y, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const wood = toon('#8b5a35'), leg = toon('#5c3b22');
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), wood); seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), wood); back.position.set(0, 0.78, -0.24); back.rotation.x = -0.12; g.add(back);
  for (const sx of [-0.75, 0.75]) for (const sz of [-0.18, 0.18]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), leg); l.position.set(sx, 0.22, sz); g.add(l); }
  return g;
}
