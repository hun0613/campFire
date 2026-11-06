import * as THREE from 'three';

const VS = `
attribute float aSize; attribute float aAlpha; attribute float aShape; attribute vec3 aColor; attribute float aRot;
uniform float uScale;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main(){
  vColor = aColor; vAlpha = aAlpha; vShape = aShape; vRot = aRot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform float uAdditive;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  float a;
  if (vShape < 0.5) {
    float d = length(p);
    a = smoothstep(0.5, 0.0, d);
    a = a * a * 1.4 + smoothstep(0.12, 0.0, d);
  } else if (vShape < 1.5) {
    // 별
    float ang = atan(p.y, p.x) - 1.5708;
    float r = length(p) * 2.0;
    float k = 0.42 + 0.5 * pow(0.5 + 0.5 * cos(5.0 * ang), 4.0);
    a = smoothstep(k, k - 0.15, r) + smoothstep(0.3, 0.0, r) * 0.6;
  } else if (vShape < 2.5) {
    // 하트
    vec2 q = p * 2.6; q.y = -q.y + 0.15;
    float v = pow(q.x * q.x + q.y * q.y - 1.0, 3.0) - q.x * q.x * q.y * q.y * q.y;
    a = smoothstep(0.05, -0.15, v);
  } else {
    // 부드러운 연기
    float d = length(p);
    a = smoothstep(0.5, 0.1, d);
  }
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

/** CPU 파티클 풀. additive=true 면 빛나는 마법 효과, false 면 연기/나무 조각 */
export class Particles {
  constructor(scene, shared, { max = 4000, additive = true } = {}) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.p = []; // 시뮬레이션 데이터
    const geo = new THREE.BufferGeometry();
    const attr = (name, arr, n) => {
      const a = new THREE.BufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    this.aPos = attr('position', this.pos, 3);
    this.aCol = attr('aColor', this.col, 3);
    this.aSize = attr('aSize', this.size, 1);
    this.aAlpha = attr('aAlpha', this.alpha, 1);
    this.aShape = attr('aShape', this.shape, 1);
    this.aRot = attr('aRot', this.rot, 1);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: shared.uScale, uAdditive: { value: additive ? 1 : 0 } },
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }

  /**
   * o: { x,y,z, vx,vy,vz, color(THREE.Color), size, life, grav, drag, shape, grow, spin,
   *      orbit:{cx,cz,ang,angVel,rad,radVel}, bob, alpha }
   */
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      r: o.color.r, g: o.color.g, b: o.color.b,
      size: o.size ?? 0.2, life: o.life ?? 1, age: 0,
      grav: o.grav || 0, drag: o.drag || 0, shape: o.shape || 0,
      grow: o.grow || 0, spin: o.spin || 0, rot: o.rot ?? Math.random() * 6.28,
      orbit: o.orbit || null, bob: o.bob || 0, bobPh: Math.random() * 6.28,
      alpha: o.alpha ?? 1,
    });
  }

  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= q.grav * dt;
      if (q.drag) {
        const f = Math.max(0, 1 - q.drag * dt);
        q.vx *= f; q.vy *= f; q.vz *= f;
      }
      if (q.orbit) {
        const o = q.orbit;
        o.ang += o.angVel * dt;
        o.rad += o.radVel * dt;
        q.y += q.vy * dt;
        q.x = o.cx + Math.cos(o.ang) * o.rad;
        q.z = o.cz + Math.sin(o.ang) * o.rad;
      } else {
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      if (q.bob) q.y += Math.cos(q.age * 2.2 + q.bobPh) * q.bob * dt;
      q.rot += q.spin * dt;
      if (q.y < 0.03 && q.grav > 0) { q.y = 0.03; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
      const lt = q.age / q.life;
      const fade = Math.min(1, lt / 0.1) * (lt > 0.6 ? 1 - (lt - 0.6) / 0.4 : 1);
      this.pos[w * 3] = q.x; this.pos[w * 3 + 1] = q.y; this.pos[w * 3 + 2] = q.z;
      this.col[w * 3] = q.r; this.col[w * 3 + 1] = q.g; this.col[w * 3 + 2] = q.b;
      this.size[w] = q.size * (1 + q.grow * q.age);
      this.alpha[w] = fade * q.alpha;
      this.shape[w] = q.shape;
      this.rot[w] = q.rot;
      P[w] = q;
      w++;
    }
    P.length = w;
    this.points.geometry.setDrawRange(0, w);
    for (const a of [this.aPos, this.aCol, this.aSize, this.aAlpha, this.aShape, this.aRot]) {
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, w * a.itemSize);
    }
  }
}
