// 밤하늘: 은하수 · 색이 조금씩 다른 별 · 별자리(북극성/북두칠성/카시오페이아) · 별똥별 · 달
// - gaze(0~1): 하늘을 올려다보는 정도. 올려다볼수록 별이 또렷해지고 별자리 선이 은은하게 떠오른다
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { radialTexture, mulberry32 } from './toon.js';

const R = 460;
export const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.78).normalize();
// 은하수가 지나가는 큰 원의 법선 (하늘 꼭대기 근처를 비스듬히 가로지른다)
const MW_N = new THREE.Vector3(0.82, 0.18, 0.54).normalize();

const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
`;

/** 하늘 방향(고도/방위)으로 단위 벡터. 방위: 0=북(-z), +=동(+x) */
function dirAt(alt, az) {
  return new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
}

export function createSky(scene, { lowSpec = false } = {}) {
  const rand = mulberry32(2024);
  const group = new THREE.Group();
  scene.add(group);
  const uGaze = { value: 0 };
  const uTime = { value: 0 };

  // ---------- 하늘 + 은하수
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color('#040720') },
        mid: { value: new THREE.Color('#131a48') },
        bottom: { value: new THREE.Color('#3b2f63') },
        moonDir: { value: MOON_DIR },
        mwN: { value: MW_N },
        uGaze,
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      defines: { OCT: lowSpec ? 3 : 5 },
      fragmentShader: `uniform vec3 top, mid, bottom, moonDir, mwN; uniform float uGaze; varying vec3 vP;
        ${NOISE}
        void main(){
          vec3 d = normalize(vP);
          float h = d.y;
          vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.25, h));
          c = mix(c, top, smoothstep(0.25, 0.9, h));
          float m = max(dot(d, moonDir), 0.0);
          c += vec3(0.25, 0.27, 0.45) * pow(m, 18.0) * 0.35;
          // 은하수: 큰 원을 따라 흐르는 뿌연 빛 + 가운데 어두운 먼지 띠
          float k = dot(d, mwN);
          float band = exp(-k * k / 0.022);
          float lift = smoothstep(0.02, 0.35, h) * (1.0 - pow(m, 6.0));
          // 은하수가 없는 곳은 무늬 계산을 건너뛴다 (하늘 대부분 — GPU 부담을 크게 줄임)
          if (band * lift < 0.004) { gl_FragColor = vec4(c, 1.0); return; }
          float cloud = fbm(d * 5.0 + 3.1);
          float fine = fbm(d * 16.0 - 1.7);
          float glow = band * (0.35 + 0.9 * cloud) * (0.55 + 0.6 * fine);
          float dust = exp(-pow(k - 0.025, 2.0) / 0.0016) * smoothstep(0.35, 0.75, fbm(d * 9.0 + 7.0));
          glow *= 1.0 - 0.75 * dust;
          vec3 mw = mix(vec3(0.42, 0.44, 0.78), vec3(0.95, 0.82, 0.78), cloud * fine);
          c += mw * glow * lift * (0.16 + 0.12 * uGaze);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ---------- 별 (일반 + 은하수에 몰린 잔별)
  const pos = [], ph = [], sz = [], col = [];
  const tint = [new THREE.Color('#bcd2ff'), new THREE.Color('#ffffff'), new THREE.Color('#fff1d8'), new THREE.Color('#ffd2a8')];
  const addStar = (v, size) => {
    pos.push(v.x * R, v.y * R, v.z * R);
    ph.push(rand() * 100);
    sz.push(size);
    const c = tint[Math.floor(rand() * tint.length)];
    col.push(c.r, c.g, c.b);
  };
  const v = new THREE.Vector3();
  for (let i = 0; i < 3600; i++) {
    const u = rand() * Math.PI * 2;
    const y = (0.03 + rand() * 0.97) ** 0.85;
    const r = Math.sqrt(1 - y * y);
    v.set(Math.cos(u) * r, y, Math.sin(u) * r);
    const roll = rand();
    addStar(v, roll < 0.03 ? 3.6 : roll < 0.15 ? 2.4 : 0.9 + rand() * 1.2);
  }
  // 은하수 띠 위의 잔별
  const e1 = new THREE.Vector3(0, 1, 0).cross(MW_N).normalize();
  const e2 = MW_N.clone().cross(e1).normalize();
  for (let i = 0; i < 3000; i++) {
    const a = rand() * Math.PI * 2;
    const off = (rand() + rand() + rand() - 1.5) * 0.16;
    v.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(MW_N, off).normalize();
    if (v.y < 0.04) continue;
    addStar(v, 0.7 + rand() * 0.9);
  }
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime, uGaze, uPR: { value: Math.min(devicePixelRatio, 2) } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPhase; attribute float aSize; attribute vec3 aColor; uniform float uTime; uniform float uPR; uniform float uGaze;
      varying float vA; varying vec3 vC;
      void main(){
        vA = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase) * 1.8) + aPhase);
        vA *= mix(0.75, 1.15, uGaze) * smoothstep(0.0, 60.0, position.y);
        vC = aColor;
        gl_PointSize = aSize * uPR * (1.0 + 0.25 * uGaze);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vC * 1.6, smoothstep(0.5, 0.0, d) * vA); }`,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  const stars = new THREE.Points(g, starMat);
  stars.renderOrder = -9;
  group.add(stars);

  // ---------- 별자리 (북쪽 하늘). 올려다보면 선과 이름이 은은하게 떠오른다
  const POLARIS = { alt: 0.65, az: 0.12 };
  // 북극성 기준 (오른쪽=동, 위) 좌표
  const CONST = [
    { name: '북극성', stars: [[0, 0]], lines: [], big: 4.2 },
    { name: '북두칠성', stars: [[0.36, -0.2], [0.44, -0.18], [0.52, -0.22], [0.6, -0.2], [0.66, -0.29], [0.79, -0.27], [0.77, -0.15]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
    { name: '카시오페이아', stars: [[-0.44, 0.2], [-0.38, 0.29], [-0.3, 0.23], [-0.23, 0.32], [-0.15, 0.27]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  ];
  const center = dirAt(POLARIS.alt, POLARIS.az);
  const east = new THREE.Vector3(0, 1, 0).cross(center).negate().normalize();
  const up = east.clone().cross(center).normalize();
  const place = ([x, y]) => center.clone().addScaledVector(east, x).addScaledVector(up, y).normalize();
  const cPos = [], cSz = [], linePos = [];
  const labels = [];
  for (const c of CONST) {
    const pts = c.stars.map(place);
    for (const p of pts) { cPos.push(p.x * R * 0.99, p.y * R * 0.99, p.z * R * 0.99); cSz.push(c.big || 3.4); }
    for (const [a, b] of c.lines) linePos.push(...pts[a].clone().multiplyScalar(R * 0.98).toArray(), ...pts[b].clone().multiplyScalar(R * 0.98).toArray());
    const mid = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).normalize();
    const el = document.createElement('div');
    el.className = 'const-label';
    el.textContent = c.name;
    const lab = new CSS2DObject(el);
    lab.position.copy(mid).multiplyScalar(R * 0.97).addScaledVector(up, -R * 0.045);
    group.add(lab);
    labels.push(el);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
  cg.setAttribute('aSize', new THREE.Float32BufferAttribute(cSz, 1));
  cg.setAttribute('aPhase', new THREE.Float32BufferAttribute(cSz.map((_, i) => i * 7.3), 1));
  cg.setAttribute('aColor', new THREE.Float32BufferAttribute(cSz.flatMap(() => [1, 0.97, 0.9]), 3));
  const cStars = new THREE.Points(cg, starMat);
  cStars.renderOrder = -9;
  group.add(cStars);
  const lineMat = new THREE.LineBasicMaterial({ color: '#9fb6ff', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const lines = new THREE.LineSegments(lg, lineMat);
  lines.renderOrder = -9;
  group.add(lines);

  // ---------- 달
  // 블룸에 번져 눈부시지 않게 밝기를 낮췄다 (2.2 → 0.9: 블룸 문턱 바로 위라 살짝만 번진다)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3d2').multiplyScalar(0.9), fog: false }));
  moon.position.copy(MOON_DIR).multiplyScalar(420);
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#b9c4ff', transparent: true, opacity: 0.1, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(80);
  halo.position.copy(moon.position);
  group.add(halo);

  // ---------- 별똥별: 점 여러 개로 긴 꼬리를 그린다
  const TRAIL = 56;
  const shoots = [];
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uPR: starMat.uniforms.uPR },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aK; uniform float uPR; uniform float uA; varying float vA;
      void main(){ vA = (1.0 - aK); gl_PointSize = mix(3.2, 0.6, aK) * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * 2.2, smoothstep(0.5, 0.0, d) * vA * vA * uA); }`,
  });
  function makeShoot() {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    sg.setAttribute('aK', new THREE.Float32BufferAttribute(Array.from({ length: TRAIL }, (_, i) => i / (TRAIL - 1)), 1));
    const m = sMat.clone();
    m.uniforms = { uPR: sMat.uniforms.uPR, uA: { value: 0 } };
    const p = new THREE.Points(sg, m);
    p.frustumCulled = false;
    p.visible = false;
    p.renderOrder = -8;
    group.add(p);
    return { p, m, t: 0, life: 0, a: new THREE.Vector3(), axis: new THREE.Vector3(), speed: 0, len: 0 };
  }
  for (let i = 0; i < 3; i++) shoots.push(makeShoot());
  const tmpV = new THREE.Vector3();
  /** around: 이 방향 근처에서 떨어진다 (없으면 아무 데나) */
  function spawn(around) {
    const s = shoots.find((x) => !x.p.visible);
    if (!s) return null;
    const base = around ? around.clone() : dirAt(0.5 + Math.random() * 0.8, Math.random() * Math.PI * 2);
    base.x += (Math.random() - 0.5) * 0.5; base.z += (Math.random() - 0.5) * 0.5; base.y += Math.random() * 0.15;
    if (base.normalize().y < 0.3) base.y = 0.3;
    s.a.copy(base.normalize());
    // 대체로 아래쪽(지평선 쪽)으로 비스듬히 떨어지는 방향
    const side = tmpV.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const downish = new THREE.Vector3(0, -1, 0).addScaledVector(side, 1.6).normalize();
    s.axis.copy(s.a).cross(downish).normalize();
    s.speed = 0.55 + Math.random() * 0.35; // rad/s
    s.len = 0.12 + Math.random() * 0.1;
    s.life = 0.9 + Math.random() * 0.6;
    s.t = 0;
    s.p.visible = true;
    return s;
  }
  const q = new THREE.Quaternion();
  function updateShoots(dt) {
    for (const s of shoots) {
      if (!s.p.visible) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.p.visible = false; continue; }
      s.m.uniforms.uA.value = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.6) / 0.4));
      const head = s.t * s.speed;
      const arr = s.p.geometry.attributes.position.array;
      const tail = Math.min(s.len, head);
      for (let i = 0; i < TRAIL; i++) {
        q.setFromAxisAngle(s.axis, head - tail * (i / (TRAIL - 1)));
        tmpV.copy(s.a).applyQuaternion(q).multiplyScalar(R * 0.96);
        arr[i * 3] = tmpV.x; arr[i * 3 + 1] = tmpV.y; arr[i * 3 + 2] = tmpV.z;
      }
      s.p.geometry.attributes.position.needsUpdate = true;
    }
  }

  let nextShoot = 6 + Math.random() * 10;
  const look = new THREE.Vector3();
  return {
    group,
    /** @returns {boolean} 이번 프레임에 '올려다보는 중' 별똥별이 떨어졌는지 */
    update(t, dt, camera, gaze) {
      group.position.copy(camera.position);
      uTime.value = t;
      uGaze.value += (gaze - uGaze.value) * Math.min(1, dt * 3);
      const gz = uGaze.value;
      lineMat.opacity = Math.max(0, gz - 0.35) * 0.45;
      const showLab = gz > 0.55;
      for (const el of labels) el.classList.toggle('on', showLab);
      updateShoots(dt);
      nextShoot -= dt;
      if (nextShoot <= 0) {
        // 올려다보고 있으면 자주, 시야 안쪽에서 떨어진다
        nextShoot = gz > 0.4 ? 5 + Math.random() * 8 : 18 + Math.random() * 25;
        camera.getWorldDirection(look);
        const s = spawn(gz > 0.4 ? look : null);
        return !!s && gz > 0.4;
      }
      return false;
    },
  };
}
