import * as THREE from 'three';

// ---------------------------------------------------------------- 비 · 눈
// 카메라 둘레 상자 안에서만 GPU로 떨어뜨린다 (카메라가 움직이면 상자 안을 빙글 돌려 쓰므로 끝없이 내리는 것처럼 보인다).
// 지붕 아래(텐트 · 모닥불 천막)로는 들어오지 않게 shelters 원기둥 안의 빗방울 · 눈송이는 숨긴다.
const MAX_SHELTERS = 32;
const BOX = 46;   // 가로 · 세로 (m)
const H = 24;     // 높이 (m)

const SHELTER_GLSL = `
uniform vec4 uShel[${MAX_SHELTERS}]; // x, z, 반지름, 지붕 높이
bool sheltered(vec3 p) {
  for (int i = 0; i < ${MAX_SHELTERS}; i++) {
    vec4 s = uShel[i];
    if (s.z <= 0.0) continue;
    vec2 d = p.xz - s.xy;
    if (dot(d, d) < s.z * s.z && p.y < s.w) return true;
  }
  return false;
}
vec3 wrapPos(vec3 base, float fall, float t) {
  vec3 p;
  p.x = uCam.x + mod(base.x * ${BOX.toFixed(1)} - uCam.x, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
  p.z = uCam.z + mod(base.z * ${BOX.toFixed(1)} - uCam.z, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
  p.y = mod(base.y * ${H.toFixed(1)} - t * fall, ${H.toFixed(1)}) + max(uCam.y - ${(H * 0.45).toFixed(1)}, -2.0);
  return p;
}`;

export class Precip {
  constructor(scene, shared, { lowSpec = false } = {}) {
    this.amount = 0;    // 지금 보이는 양 (0~1, 테마가 바뀌면 천천히)
    this.kind = null;   // 'rain' | 'snow' | null
    this.want = null;
    const shel = Array.from({ length: MAX_SHELTERS }, () => new THREE.Vector4(0, 0, 0, 0));
    this.shel = shel;
    const common = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uShel: { value: shel }, uScale: shared.uScale };
    this.u = common;

    // 비: 짧은 선분. 꼭짓점 둘(위 · 아래)이 같은 빗방울을 나눠 쓴다
    {
      const n = lowSpec ? 1500 : 2800;
      const base = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = Math.random(), y = Math.random(), z = Math.random();
        for (let k = 0; k < 2; k++) { base.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(base, 3));
      g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      this.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({
        uniforms: common, transparent: true, depthWrite: false, fog: false,
        vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uAmount; attribute float aEnd; varying float vA;
          ${SHELTER_GLSL}
          void main(){
            vec3 p = wrapPos(position, 17.0, uTime);
            float keep = step(position.x * 0.7 + position.z * 0.3, uAmount); // 양에 따라 일부만
            if (p.y < 0.0 || sheltered(p) || keep < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vA = 0.0; return; }
            p += aEnd * vec3(0.06, 0.62, 0.02); // 빗줄기 길이 · 살짝 바람
            vA = mix(0.0, 1.0, aEnd);
            gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `varying float vA; uniform float uAmount; void main(){ gl_FragColor = vec4(0.72, 0.78, 0.9, (0.12 + 0.3 * vA) * min(1.0, uAmount * 1.5)); }`,
      }));
      this.rain.frustumCulled = false;
      this.rain.visible = false;
      scene.add(this.rain);
    }
    // 눈: 둥근 점. 천천히 흔들리며 내린다
    {
      const n = lowSpec ? 2000 : 4200;
      const base = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { base.set([Math.random(), Math.random(), Math.random()], i * 3); seed[i] = Math.random(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(base, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      this.snow = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: common, transparent: true, depthWrite: false, fog: false,
        vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uAmount; uniform float uScale; attribute float aSeed; varying float vA;
          ${SHELTER_GLSL}
          void main(){
            vec3 p = wrapPos(position, 1.1 + aSeed * 0.7, uTime);
            p.x += sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.6;
            p.z += cos(uTime * (0.5 + aSeed * 0.8) + aSeed * 23.0) * 0.5;
            float keep = step(aSeed, uAmount);
            if (p.y < 0.0 || sheltered(p) || keep < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vA = 0.0; return; }
            vec4 mv = viewMatrix * vec4(p, 1.0);
            gl_PointSize = (0.08 + aSeed * 0.07) * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
            vA = smoothstep(${(-H * 0.45).toFixed(1)}, 0.0, -abs(mv.z) + 2.0) * min(1.0, uAmount * 1.5);
          }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.95, 0.97, 1.0, smoothstep(0.5, 0.15, d) * 0.9 * vA); }`,
      }));
      this.snow.frustumCulled = false;
      this.snow.visible = false;
      scene.add(this.snow);
    }
  }

  /** 지붕들: [{x, z, r, h}] (텐트 · 천막) */
  setShelters(list) {
    for (let i = 0; i < MAX_SHELTERS; i++) {
      const s = list[i];
      this.shel[i].set(s ? s.x : 0, s ? s.z : 0, s ? s.r : 0, s ? s.h : 0);
    }
  }

  /** 'rain' | 'snow' | null — 천천히 바뀐다 */
  set(kind) { this.want = kind; }

  update(dt, t, camPos) {
    // 다른 것이 내리고 있으면 먼저 그치고 나서 바꾼다
    if (this.kind !== this.want) {
      this.amount = Math.max(0, this.amount - dt * 0.6);
      if (this.amount <= 0) this.kind = this.want;
    } else if (this.kind) this.amount = Math.min(1, this.amount + dt * 0.35);
    this.u.uTime.value = t;
    this.u.uCam.value.copy(camPos);
    this.u.uAmount.value = this.amount;
    this.rain.visible = this.kind === 'rain' && this.amount > 0.01;
    this.snow.visible = this.kind === 'snow' && this.amount > 0.01;
  }
}
