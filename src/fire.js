import * as THREE from 'three';
import { toon, radialTexture } from './toon.js';
import { CFG, seatPos, seatsOf, TENT_WH, TENT_RH } from '../shared/config.js';

const VS = `
uniform float uTime, uScale, uIntensity, uHeight, uSize, uRise, uSpread, uSpeed;
attribute float aSeed; attribute vec3 aRnd;
varying float vLife; varying float vI;
void main(){
  float speed = uSpeed * (0.7 + aRnd.z * 0.6);
  float life = fract(uTime * speed + aSeed);
  vLife = life;
  float ang = aSeed * 43.98;
  float r = uSpread * aRnd.x * (1.0 - life * 0.85) * (0.55 + 0.45 * uIntensity);
  float h = life * uRise * (0.6 + aRnd.y * 0.6) * uHeight * (0.3 + 0.7 * uIntensity);
  vec3 p = vec3(cos(ang) * r, h + 0.18, sin(ang) * r);
  p.x += sin(uTime * 4.0 + aSeed * 30.0) * 0.08 * life * uHeight;
  p.z += cos(uTime * 3.3 + aSeed * 17.0) * 0.08 * life * uHeight;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = uSize * (1.0 - life * 0.55) * (0.35 + 0.65 * uIntensity) * (0.8 + 0.2 * uHeight);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
  vI = uIntensity;
}`;
const FS = `
uniform vec3 uCore, uTip; uniform float uBright;
varying float vLife; varying float vI;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 col = mix(uCore, uTip, smoothstep(0.05, 0.6, vLife));
  float a = soft * smoothstep(0.0, 0.08, vLife) * (1.0 - vLife) * min(1.0, vI * 1.5);
  gl_FragColor = vec4(col * uBright, a);
}`;

function flamePoints(count, p, shared) {
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(count);
  const rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seed[i] = Math.random();
    rnd[i * 3] = Math.sqrt(Math.random());
    rnd[i * 3 + 1] = Math.random();
    rnd[i * 3 + 2] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 6);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime, uScale: shared.uScale,
      uIntensity: { value: 0 }, uHeight: { value: 1 },
      uSize: { value: p.size }, uRise: { value: p.rise }, uSpread: { value: p.spread }, uSpeed: { value: p.speed },
      uCore: { value: new THREE.Color(p.core) }, uTip: { value: new THREE.Color(p.tip) }, uBright: { value: p.bright },
    },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = true;
  return pts;
}

const DEFAULT_CORE = new THREE.Color('#ffe7a3');
const DEFAULT_TIP = new THREE.Color('#ff5a14');
const WHITE = new THREE.Color('#ffffff');
const WOOD = new THREE.Color('#8b5a33');
const CHAR = new THREE.Color('#2a1d17');

const stoneGeo = new THREE.DodecahedronGeometry(0.17, 0);
const logGeo = new THREE.CylinderGeometry(0.075, 0.09, 1.05, 7);
const baseLogGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.0, 7);
const up = new THREE.Vector3(0, 1, 0);
const BOWL_TOP = 0.46; // 텐트 화로 그릇 높이 (데크 위)

export class FirePit {
  constructor(def, scene, shared) {
    this.def = def;
    this.id = def.id;
    this.state = 'empty';
    this.litAt = 0;
    this.endsAt = 0;
    this.seats = Array(seatsOf(def)).fill(null);
    this.stove = def.kind === 'stove';
    this.intensity = 0;
    this.height = 1;
    this.pos = new THREE.Vector3(def.x, 0, def.z);
    this.tint = { until: 0, color: new THREE.Color(), rainbow: false, pillarUntil: 0 };
    this.core = DEFAULT_CORE.clone();
    this.tip = DEFAULT_TIP.clone();
    this.flicker = 1;
    this.viewDim = 1; // 카메라가 아주 가까우면(1인칭 등) 불꽃 입자가 겹쳐 하얗게 뜨지 않도록 밝기를 낮춘다 (main.js 에서 설정)

    const g = new THREE.Group();
    g.position.copy(this.pos);
    if (this.stove) g.position.y = 0.15; // 텐트 데크 위
    scene.add(g);
    this.group = g;

    if (this.stove) this.#buildStove(def, shared);
    // 돌 테두리
    const n = this.stove ? 0 : 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = new THREE.Mesh(stoneGeo, toon(['#8d8a94', '#a3a0aa', '#7b7884'][i % 3]));
      s.position.set(Math.cos(a) * 0.74, 0.1, Math.sin(a) * 0.74);
      s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      s.scale.set(1.1 + Math.random() * 0.3, 0.8 + Math.random() * 0.3, 1.0 + Math.random() * 0.3);
      s.castShadow = true;
      g.add(s);
    }
    if (!this.stove) {
      const ash = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), toon('#3a302b'));
      ash.rotation.x = -Math.PI / 2;
      ash.position.y = 0.025;
      g.add(ash);
    }

    // 장작 (티피 형태)
    this.logMat = toon('#8b5a33', { emissive: new THREE.Color('#ff4a10'), emissiveIntensity: 0 });
    this.logs = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const B = new THREE.Vector3(Math.cos(a) * 0.4, 0.05, Math.sin(a) * 0.4);
      const T = new THREE.Vector3(Math.cos(a) * 0.04, 0.82, Math.sin(a) * 0.04);
      const m = new THREE.Mesh(logGeo, this.logMat);
      m.position.copy(B).add(T).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, T.clone().sub(B).normalize());
      m.castShadow = true;
      this.logs.add(m);
    }
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(baseLogGeo, this.logMat);
      m.rotation.z = Math.PI / 2;
      m.rotation.y = i * 1.4 + 0.2;
      m.position.y = 0.1;
      this.logs.add(m);
    }
    this.logs.visible = false;
    this.logK = 1;
    if (this.stove) this.logs.position.y = BOWL_TOP - 0.06;
    g.add(this.logs);

    // 불꽃
    this.flames = flamePoints(120, { size: 0.42, rise: 1.5, spread: 0.4, speed: 1.05, core: '#ffd98a', tip: '#ff4a10', bright: 0.75 }, shared);
    this.cores = flamePoints(40, { size: 0.3, rise: 0.7, spread: 0.2, speed: 1.6, core: '#fff3c8', tip: '#ffb84a', bright: 0.8 }, shared);
    this.embers = flamePoints(45, { size: 0.07, rise: 4.5, spread: 0.9, speed: 0.22, core: '#ffd38a', tip: '#ff7a2a', bright: 3.0 }, shared);
    g.add(this.flames, this.cores, this.embers);
    this.lift = 0; // 불꽃 바닥 높이 (텐트 화로는 그릇 위)
    this.brightK = 1; // 텐트 화로도 바깥 모닥불과 같은 불 (밝기 · 빛무리 · 바닥 불빛 모두 같다)
    if (this.stove) { // 텐트 화로: 바깥 모닥불과 똑같은 불을 그릇 위에서 피운다 (높이만 그릇만큼 올린다)
      this.lift = BOWL_TOP - 0.1;
      for (const pts of [this.flames, this.cores, this.embers]) pts.position.y = this.lift;
    }
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ff8a3a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.halo.position.y = 0.8;
    this.halo.scale.setScalar(3.2);
    g.add(this.halo);
    this.groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ff8a3a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.y = 0.04;
    g.add(this.groundGlow);

    // 좌석
    this.seatPos = [];
    for (let i = 0; i < this.seats.length; i++) {
      const s = seatPos(def, i);
      this.seatPos.push(s);
      if (this.stove) continue; // 텐트 화로 자리는 둥근 소파 (tent.js)
      const seat = def.kind === 'tent' ? this.#chair(i) : this.#stump();
      seat.position.set(s.x - def.x, 0, s.z - def.z);
      seat.rotation.y = s.ry;
      g.add(seat);
    }
  }

  /** 텐트 화로: 낮고 넓은 검은 화로 그릇 (안에 용암석) + 위에 매달린 구리 후드와 지붕 꼭대기로 나가는 연통 (불이 붙으면 연통 끝에서 연기) */
  #buildStove(def, shared) {
    const body = new THREE.Group();
    const bowlMat = toon('#2b2a2e', { emissive: new THREE.Color('#120c08'), emissiveIntensity: 0.6 });
    const rimMat = toon('#3a383d');
    // 그릇: 바깥은 아래로 좁아지는 둥근 몸통, 위는 넓은 테
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.62, BOWL_TOP - 0.06, 32), bowlMat);
    outer.position.y = (BOWL_TOP - 0.06) / 2; outer.castShadow = true; outer.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.09, 8, 36), rimMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = BOWL_TOP - 0.04;
    // 용암석 (불이 붙으면 같이 달아오른다)
    this.rockMat = toon('#4a2f28', { emissive: new THREE.Color('#ff5a1a'), emissiveIntensity: 0 });
    const bed = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), toon('#2a1c18'));
    bed.rotation.x = -Math.PI / 2; bed.position.y = BOWL_TOP - 0.07;
    body.add(outer, rim, bed);
    const rockGeo = new THREE.DodecahedronGeometry(0.06, 0);
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.2 + Math.sqrt(Math.random()) * 0.58;
      const m = new THREE.Mesh(rockGeo, i % 3 ? this.rockMat : toon('#5a3d33'));
      m.position.set(Math.cos(a) * r, BOWL_TOP - 0.05, Math.sin(a) * r);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      m.scale.setScalar(0.7 + Math.random() * 0.7);
      body.add(m);
    }
    // 후드: 불 위 높이 매달린 검은 강철 원뿔 (구리 테) → 연통이 지붕 꼭대기를 뚫고 나간다
    const copper = toon('#3a383e', { emissive: new THREE.Color('#2a1408'), emissiveIntensity: 0.5 }); // 무광 검은 강철 (화로 그릇과 같은 결)
    const band = toon('#b8733f', { emissive: new THREE.Color('#4a2410'), emissiveIntensity: 0.45 });
    const iron = toon('#3e3a40');
    const HOOD_Y = 3.15, APEX = TENT_WH + TENT_RH; // 지붕 꼭대기 (그룹이 데크 높이에 있다)
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.78, 0.62, 28, 1, true), copper);
    hood.material = copper; hood.position.y = HOOD_Y + 0.31; hood.castShadow = true;
    const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 6, 32), band);
    hoodRim.rotation.x = Math.PI / 2; hoodRim.position.y = HOOD_Y;
    copper.side = THREE.DoubleSide;
    const PIPE_TOP = APEX + 0.6;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, PIPE_TOP - (HOOD_Y + 0.6), 14), iron);
    pipe.position.y = (HOOD_Y + 0.6 + PIPE_TOP) / 2;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 14), iron);
    cap.position.y = PIPE_TOP + 0.24;
    const capPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), iron);
    capPost.position.y = PIPE_TOP + 0.07;
    // 후드에 매단 줄 (천장 쪽으로)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), iron);
      wire.position.set(Math.cos(a) * 0.45, HOOD_Y + 1.0, Math.sin(a) * 0.45);
      wire.rotation.z = Math.cos(a) * 0.25; wire.rotation.x = -Math.sin(a) * 0.25;
      body.add(wire);
    }
    body.add(hood, hoodRim, pipe, cap, capPost);
    this.group.add(body);
    // 연기: 연통 끝에서 천천히 피어올라 흩어진다 (밖에서도 보인다)
    this.smoke = flamePoints(36, { size: 1.2, rise: 3.6, spread: 0.7, speed: 0.16, core: '#bdb6ad', tip: '#6f6a66', bright: 0.32 }, shared);
    this.smoke.position.y = PIPE_TOP + 0.1;
    this.group.add(this.smoke);
  }

  #chair(i) {
    const fabric = toon(['#d65f4a', '#3f8fd1', '#e0b43a', '#5aa36b', '#b07bff'][i % 5]);
    const frame = toon('#3b3631');
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.48), fabric);
    seat.position.y = 0.4;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.05), fabric);
    back.position.set(0, 0.66, -0.26);
    back.rotation.x = -0.2;
    c.add(seat, back);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), frame);
        leg.position.set(sx * 0.25, 0.2, sz * 0.2);
        leg.rotation.x = sz * 0.25;
        c.add(leg);
      }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.45), frame);
      arm.position.set(sx * 0.29, 0.6, -0.02);
      c.add(arm);
    }
    c.children.forEach((m) => { m.castShadow = true; });
    return c;
  }

  #stump() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.42, 10), [toon('#6e4529'), toon('#e2b77d'), toon('#e2b77d')]);
    m.position.y = 0.21;
    m.castShadow = true;
    g.add(m);
    return g;
  }

  setState(p) {
    this.state = p.state;
    this.litAt = p.litAt;
    this.endsAt = p.endsAt;
    this.owner = p.owner;
    this.seats = p.seats.slice();
    this.music = p.music || null;
  }

  /** 장작을 더 넣었을 때 불길이 잠깐 확 오른다 */
  flare() { this.flareT = 1.4; }

  freeSeats() { return this.seats.filter((s) => s === null).length; }

  remaining(now) {
    if (this.state !== 'lit') return 0;
    return Math.max(0, this.endsAt - now);
  }

  applyPowder(powder, now) {
    this.tint.until = now + CFG.EFFECT_DURATION;
    this.tint.color.set(powder.color);
    this.tint.rainbow = powder.effect === 'rainbow';
    this.tint.pillarUntil = powder.effect === 'pillar' ? now + 7000 : 0;
  }

  update(t, dt, now) {
    let target = 0;
    let burn = 0;
    if (this.state === 'lit') {
      const rem = Math.max(0, Math.min(1, (this.endsAt - now) / CFG.FIRE_DURATION)); // 장작을 더 넣으면 다시 차오른다
      burn = 1 - rem;
      const ign = Math.min(1, Math.max(0, (now - this.litAt) / 2500));
      target = rem <= 0 ? 0 : ign * (rem > 0.25 ? 1 : 0.3 + (rem / 0.25) * 0.7);
    }
    this.intensity += (target - this.intensity) * Math.min(1, dt * (target > this.intensity ? 2.5 : 1.2));
    const I = this.intensity;
    this.flicker = 0.86 + Math.sin(t * 13.1 + this.pos.x) * 0.05 + Math.sin(t * 7.3 + this.pos.z) * 0.06 + Math.random() * 0.03;

    this.logs.visible = this.state !== 'empty' || I > 0.03;
    this.logMat.color.copy(WOOD).lerp(CHAR, this.state === 'lit' ? Math.min(1, burn * 1.3) : this.state === 'empty' ? 1 : 0);
    this.logMat.emissiveIntensity = I * 0.9 * this.flicker;
    if (this.rockMat) this.rockMat.emissiveIntensity = I * 0.7 * this.flicker;
    const ls = this.state === 'lit' ? 1 - burn * 0.35 : 1;
    this.logs.scale.set(this.logK, ls * this.logK, this.logK);

    // 색 변화
    let tc = DEFAULT_CORE, tt = DEFAULT_TIP;
    const tmpC = this._tc || (this._tc = new THREE.Color());
    const tmpT = this._tt || (this._tt = new THREE.Color());
    if (now < this.tint.until) {
      if (this.tint.rainbow) tmpT.setHSL((t * 0.35) % 1, 1, 0.58);
      else tmpT.copy(this.tint.color);
      tmpC.copy(tmpT).lerp(WHITE, 0.55);
      tc = tmpC; tt = tmpT;
    }
    const k = Math.min(1, dt * 4);
    this.core.lerp(tc, k);
    this.tip.lerp(tt, k);
    if (this.flareT > 0) this.flareT -= dt;
    this.height += ((now < this.tint.pillarUntil ? 2.6 : this.flareT > 0 ? 1.45 : 1) - this.height) * Math.min(1, dt * 3);

    const vis = I > 0.01;
    if (this.smoke) {
      this.smoke.visible = vis;
      const u = this.smoke.material.uniforms;
      u.uIntensity.value = Math.min(1, I * 1.3);
    }
    for (const pts of [this.flames, this.cores, this.embers]) {
      pts.visible = vis;
      const u = pts.material.uniforms;
      u.uIntensity.value = I;
      u.uHeight.value = this.height;
      u.uBaseBright ??= u.uBright.value;
      u.uBright.value = u.uBaseBright * (pts === this.embers ? 1 : this.viewDim * this.brightK);
    }
    this.flames.material.uniforms.uCore.value.copy(this.core);
    this.flames.material.uniforms.uTip.value.copy(this.tip);
    this.cores.material.uniforms.uCore.value.copy(WHITE).lerp(this.core, 0.5);
    this.cores.material.uniforms.uTip.value.copy(this.core);
    this.embers.material.uniforms.uTip.value.copy(this.tip);

    this.halo.material.color.copy(this.tip);
    this.halo.material.opacity = I * 0.22 * this.flicker * this.viewDim;
    this.halo.scale.setScalar(2.4 * (0.8 + 0.2 * this.height));
    this.halo.position.y = this.lift + 0.8 * this.height;
    this.groundGlow.material.color.copy(this.tip).lerp(DEFAULT_TIP, 0.3);
    this.groundGlow.material.opacity = I * 0.28 * this.flicker;
  }
}
