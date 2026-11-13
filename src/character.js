import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toon } from './toon.js';
import { makeHalf, makeLog } from './woodcut.js';

const G = {
  head: new THREE.SphereGeometry(0.42, 28, 20),
  hairCap: new THREE.SphereGeometry(0.445, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hairBack: new THREE.SphereGeometry(0.43, 20, 14),
  bang: new THREE.SphereGeometry(0.16, 12, 10),
  eye: new THREE.SphereGeometry(0.06, 12, 10),
  shine: new THREE.SphereGeometry(0.02, 6, 6),
  blush: new THREE.CircleGeometry(0.075, 16),
  mouth: new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI),
  torso: new THREE.CylinderGeometry(0.2, 0.27, 0.42, 16),
  collar: new THREE.TorusGeometry(0.15, 0.035, 6, 16),
  arm: new THREE.CapsuleGeometry(0.068, 0.2, 4, 10),
  hand: new THREE.SphereGeometry(0.075, 10, 8),
  leg: new THREE.CapsuleGeometry(0.085, 0.16, 4, 10),
  shoe: new THREE.SphereGeometry(0.1, 12, 8),
  brim: new THREE.CylinderGeometry(0.66, 0.66, 0.04, 28),
  crown: new THREE.CylinderGeometry(0.33, 0.37, 0.24, 24),
  ribbon: new THREE.CylinderGeometry(0.375, 0.375, 0.07, 24, 1, true),
  beanie: new THREE.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  beanieRim: new THREE.TorusGeometry(0.43, 0.06, 8, 28),
  pom: new THREE.SphereGeometry(0.11, 12, 10),
  visor: new THREE.CylinderGeometry(0.3, 0.3, 0.035, 20, 1, false, -Math.PI / 2, Math.PI),
  wizard: new THREE.ConeGeometry(0.36, 0.75, 20),
  shadow: new THREE.CircleGeometry(0.42, 20),
  axeHandle: new THREE.CylinderGeometry(0.025, 0.03, 0.62, 6),
  axeHead: new THREE.BoxGeometry(0.05, 0.16, 0.2),
  gBody: new THREE.SphereGeometry(0.15, 18, 12),
  gHole: new THREE.CircleGeometry(0.05, 16),
  gNeck: new THREE.BoxGeometry(0.42, 0.05, 0.03),
  gHead: new THREE.BoxGeometry(0.09, 0.07, 0.035),
  gString: new THREE.BoxGeometry(0.62, 0.004, 0.004),
  // 테마 옷: 우비 · 패딩
  coat: new THREE.CylinderGeometry(0.235, 0.32, 0.58, 18),
  coatBtn: new THREE.SphereGeometry(0.022, 8, 6),
  // 모자(후드): 얼굴 쪽(+z)을 비워 둔 반구
  hood: new THREE.SphereGeometry(0.5, 26, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.6),
  hoodRim: new THREE.TorusGeometry(0.43, 0.04, 6, 24, Math.PI * 1.05),
  sleeve: new THREE.CapsuleGeometry(0.085, 0.2, 4, 10),
  boot: new THREE.CylinderGeometry(0.1, 0.105, 0.2, 12),
  puffBand: new THREE.SphereGeometry(1, 20, 12),
  puffCore: new THREE.CylinderGeometry(0.25, 0.29, 0.5, 16),
  puffCollar: new THREE.TorusGeometry(0.17, 0.065, 8, 20),
  puffSleeve: new THREE.CapsuleGeometry(0.1, 0.18, 4, 10),
  scarf: new THREE.TorusGeometry(0.165, 0.05, 8, 20),
  scarfTail: new THREE.BoxGeometry(0.09, 0.22, 0.04),
  santaCone: new THREE.ConeGeometry(0.38, 0.62, 20),
  santaBrim: new THREE.TorusGeometry(0.39, 0.09, 8, 24),
  santaPom: new THREE.SphereGeometry(0.11, 10, 8),
};

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;
const lerp = (a, b, t) => a + (b - a) * t;

let shadowTex = null;
function blobShadowMat() {
  if (!shadowTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(cv);
  }
  return new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
}

export class Character {
  constructor(look, { name = '', kind = 'other' } = {}) {
    this.look = look;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const skin = toon(look.skin);
    const hair = toon(look.hair);
    const shirt = toon(look.shirt);
    const pants = toon(look.pants);
    const dark = toon('#2a1f1c');
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const cast = (m) => { m.castShadow = true; return m; };

    // 그림자
    const sh = new THREE.Mesh(G.shadow, blobShadowMat());
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    sh.renderOrder = 1;
    this.root.add(sh);

    // 다리
    this.legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.11, 0.36, 0);
      const leg = cast(new THREE.Mesh(G.leg, pants));
      leg.position.y = -0.14;
      const shoe = cast(new THREE.Mesh(G.shoe, toon('#5a3a2a')));
      shoe.scale.set(0.95, 0.7, 1.25);
      shoe.position.set(0, -0.3, 0.03);
      pivot.add(leg, shoe);
      this.body.add(pivot);
      this.legs.push(pivot);
    }

    // 몸통
    const torso = cast(new THREE.Mesh(G.torso, shirt));
    torso.position.y = 0.58;
    this.body.add(torso);
    const collar = new THREE.Mesh(G.collar, toon(new THREE.Color(look.shirt).offsetHSL(0, 0, 0.12)));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.79;
    this.body.add(collar);

    // 팔
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.26, 0.76, 0);
      const arm = cast(new THREE.Mesh(G.arm, shirt));
      arm.position.y = -0.14;
      const hand = new THREE.Mesh(G.hand, skin);
      hand.position.y = -0.31;
      pivot.add(arm, hand);
      pivot.rotation.z = side * 0.18;
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    this.handR = this.arms[1].children[1];

    // 도끼 (오른손)
    this.axe = new THREE.Group();
    const handle = new THREE.Mesh(G.axeHandle, toon('#a5733f'));
    handle.position.y = -0.2;
    const head = new THREE.Mesh(G.axeHead, toon('#b9c2cc'));
    head.position.set(0, -0.46, 0.08);
    this.axe.add(handle, head);
    this.axe.position.set(0, -0.31, 0);
    this.axe.visible = false;
    this.arms[1].add(this.axe);

    // 기타 (연주할 때만 보임) — 무릎 위, 넥은 왼쪽 위로
    this.guitar = new THREE.Group();
    const gWood = toon('#d9873f'), gDark = toon('#6b3d1f');
    const lower = new THREE.Mesh(G.gBody, gWood);
    lower.scale.set(1.15, 1.05, 0.38);
    const upper = new THREE.Mesh(G.gBody, gWood);
    upper.scale.set(0.85, 0.8, 0.36);
    upper.position.x = -0.17;
    const hole = new THREE.Mesh(G.gHole, toon('#2b1a10'));
    hole.position.set(-0.1, 0, 0.06);
    const neck = new THREE.Mesh(G.gNeck, gDark);
    neck.position.set(-0.47, 0, 0.02);
    const ghead = new THREE.Mesh(G.gHead, gDark);
    ghead.position.set(-0.72, 0, 0.02);
    const str = new THREE.Mesh(G.gString, toon('#f3e7c9'));
    str.position.set(-0.37, 0, 0.045);
    this.guitar.add(lower, upper, hole, neck, ghead, str);
    this.guitar.traverse((o) => { o.castShadow = true; });
    this.guitar.position.set(0.12, 0.5, 0.3);
    this.guitar.rotation.set(0, 0, -0.42);
    this.guitar.scale.setScalar(1.2);
    this.guitar.visible = false;
    this.body.add(this.guitar);

    // 품에 안은 장작 더미 (장작 수만큼 쌓임, 최대 8조각까지 보임)
    this.carry = new THREE.Group();
    this.carryHome = new THREE.Vector3(0, 0.6, 0.36);
    this.carry.position.copy(this.carryHome);
    this.carryPieces = [];
    for (let k = 0; k < 8; k++) {
      const h = makeHalf();
      h.scale.set(0.62, 1.15, 0.62);
      h.rotation.set(0, (k % 2) * Math.PI, Math.PI / 2); // 눕혀서
      h.position.set(0, Math.floor(k / 2) * 0.11, (k % 2 ? -1 : 1) * 0.07);
      h.visible = false;
      this.carry.add(h);
      this.carryPieces.push(h);
    }
    this.body.add(this.carry);
    this.carryN = 0;
    this.carryPending = 0;
    this.carryBounce = 0;
    this.stashed = false;
    // 그루터기에 올릴 때 손에 드는 통나무
    this.handLog = makeLog();
    this.handLog.visible = false;
    this.body.add(this.handLog);

    // 머리
    this.head = new THREE.Group();
    this.head.position.y = 1.18;
    this.body.add(this.head);
    const skull = cast(new THREE.Mesh(G.head, skin));
    skull.scale.set(1, 0.94, 0.95);
    this.head.add(skull);

    const cap = cast(new THREE.Mesh(G.hairCap, hair));
    cap.rotation.x = -0.32;
    cap.position.set(0, 0.02, -0.02);
    this.head.add(cap);
    const back = new THREE.Mesh(G.hairBack, hair);
    back.scale.set(1.02, 0.9, 0.85);
    back.position.set(0, -0.02, -0.1);
    this.head.add(back);
    for (const [x, y, z, s] of [[-0.2, 0.2, 0.3, 1], [0.02, 0.24, 0.33, 1.1], [0.22, 0.19, 0.3, 0.95]]) {
      const b = new THREE.Mesh(G.bang, hair);
      b.position.set(x, y, z);
      b.scale.set(s * 1.25, s * 0.7, s * 0.8);
      this.head.add(b);
    }

    // 얼굴
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(G.eye, dark);
      eye.scale.set(0.85, 1.15, 0.5);
      eye.position.set(side * 0.145, -0.02, 0.375);
      const shine = new THREE.Mesh(G.shine, white);
      shine.position.set(side * 0.145 + 0.02, 0.015, 0.405);
      const blush = new THREE.Mesh(G.blush, new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.55 }));
      blush.position.set(side * 0.25, -0.12, 0.315);
      blush.rotation.y = side * 0.62;
      this.head.add(eye, shine, blush);
    }
    const mouth = new THREE.Mesh(G.mouth, dark);
    mouth.position.set(0, -0.15, 0.385);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);

    const nHead = this.head.children.length;
    this.#hat(look.hat);
    this.hatParts = this.head.children.slice(nHead); // 우비 후드를 쓰면 숨긴다
    this.outfit = null;
    this.outfits = {};

    // 라벨 (이름표 + 말풍선)
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'char-label';
    this.bubbleWrap = document.createElement('div');
    this.labelEl.appendChild(this.bubbleWrap);
    if (kind === 'npc') {
      this.markEl = document.createElement('div');
      this.markEl.className = 'npc-mark';
      this.markEl.textContent = '✨';
      this.markEl.style.display = 'none';
      this.labelEl.appendChild(this.markEl);
    }
    this.nameEl = document.createElement('div');
    this.nameEl.className = `nametag ${kind}`;
    this.nameEl.textContent = name;
    this.labelEl.appendChild(this.nameEl);
    this.label = new CSS2DObject(this.labelEl);
    this.label.position.y = kind === 'npc' ? 2.45 : 2.05;
    this.root.add(this.label);

    this.anim = 'idle';
    this.phase = Math.random() * 10;
    this.time = Math.random() * 10;
    this.action = null;
    this.blinkT = 2 + Math.random() * 3;
    this.eyes = this.head.children.filter((c) => c.geometry === G.eye);
  }

  #hat(type) {
    const h = this.head;
    if (type === 'straw') {
      const straw = toon('#e9c77b');
      const g = new THREE.Group();
      const brim = new THREE.Mesh(G.brim, straw);
      const crown = new THREE.Mesh(G.crown, straw);
      crown.position.y = 0.13;
      const rib = new THREE.Mesh(G.ribbon, toon('#d9463b', { side: THREE.DoubleSide }));
      rib.position.y = 0.06;
      g.add(brim, crown, rib);
      g.position.set(0, 0.33, -0.02);
      g.rotation.x = -0.12;
      g.children.forEach((c) => { c.castShadow = true; });
      h.add(g);
    } else if (type === 'beanie') {
      const col = new THREE.Color(this.look.shirt).offsetHSL(0.5, -0.1, 0);
      const m = toon(col);
      const b = new THREE.Mesh(G.beanie, m);
      b.position.y = 0.06;
      b.rotation.x = -0.18;
      b.castShadow = true;
      const rim = new THREE.Mesh(G.beanieRim, toon(col.clone().offsetHSL(0, 0, -0.08)));
      rim.rotation.x = Math.PI / 2 - 0.18;
      rim.position.set(0, 0.08, 0.01);
      const pom = new THREE.Mesh(G.pom, toon('#fff4e2'));
      pom.position.set(0, 0.52, -0.08);
      h.add(b, rim, pom);
    } else if (type === 'cap') {
      const col = new THREE.Color(this.look.shirt).offsetHSL(0.08, 0, 0.05);
      const m = toon(col);
      const b = new THREE.Mesh(G.beanie, m);
      b.scale.set(0.97, 0.75, 0.97);
      b.position.y = 0.1;
      b.rotation.x = -0.15;
      b.castShadow = true;
      const visor = new THREE.Mesh(G.visor, m);
      visor.position.set(0, 0.13, 0.33);
      visor.scale.set(1, 1, 1.25);
      visor.rotation.x = 0.12;
      h.add(b, visor);
    } else if (type === 'wizard') {
      const m = toon('#5b3fa3');
      const brim = new THREE.Mesh(G.brim, m);
      brim.scale.set(0.95, 1, 0.95);
      brim.position.y = 0.3;
      const cone = new THREE.Mesh(G.wizard, m);
      cone.position.set(0, 0.68, -0.06);
      cone.rotation.x = -0.25;
      const band = new THREE.Mesh(G.ribbon, toon('#ffd35c', { side: THREE.DoubleSide }));
      band.scale.set(0.92, 1, 0.92);
      band.position.y = 0.36;
      [brim, cone].forEach((c) => { c.castShadow = true; });
      h.add(brim, cone, band);
    }
  }

  setName(n) { this.nameEl.textContent = n; }

  say(text) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    this.bubbleWrap.replaceChildren(b);
    clearTimeout(this._bubbleT);
    this._bubbleT = setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.remove(), 400);
    }, 5000);
  }

  busy() { return !!this.action; }

  /** 'chop' | 'throw' | 'wave' 같은 단발 동작 */
  play(name, opts = {}) {
    const dur = { chop: 0.62, throw: 0.55, wave: 1.2, light: 0.7, place: 1.0, gather: 0.6 }[name] || 0.5;
    this.action = { name, t: 0, dur, impact: opts.onImpact, done: opts.onDone, hit: false };
    if (name === 'chop') this.axe.visible = true;
  }

  setAnim(a) { this.anim = a; }

  /** 가진 장작 수 → 품의 더미 (날아오는 중인 조각은 도착하면 보인다) */
  setCarry(n) {
    this.carryN = n;
    this.#showCarry();
  }
  /** 쪼갠 장작 조각이 더미에 도착 */
  bumpCarry() {
    this.carryPending = Math.max(0, this.carryPending - 1);
    this.carryBounce = 1;
    this.#showCarry();
  }
  #showCarry() {
    const n = Math.max(0, Math.min(8, this.carryN - this.carryPending));
    this.carryPieces.forEach((p, k) => { p.visible = k < n; });
    this.carry.visible = n > 0;
  }
  /** 장작 더미 맨 위 (월드 좌표) */
  carryWorldPos(out = new THREE.Vector3()) {
    const n = Math.max(0, Math.min(8, this.carryN - this.carryPending));
    this.carry.updateWorldMatrix(true, false);
    return this.carry.localToWorld(out.set(0, Math.floor(n / 2) * 0.11 + 0.08, 0));
  }
  /** 장작을 패거나 앉을 때는 더미를 옆 바닥에 내려 두고, 걷기 시작하면 다시 안는다 */
  #stash(on) {
    if (this.stashed === on || !this.root.parent) return;
    this.stashed = on;
    if (on) {
      const p = this.root.localToWorld(new THREE.Vector3(0.62, 0, -0.25));
      this.root.parent.add(this.carry);
      this.carry.position.set(p.x, 0.07, p.z);
      this.carry.rotation.set(0, this.root.rotation.y + 0.4, 0);
    } else {
      this.body.add(this.carry);
      this.carry.position.copy(this.carryHome).add(new THREE.Vector3(0, -0.25, 0.1));
      this.carry.rotation.set(0, 0, 0);
    }
  }

  handWorldPos(out = new THREE.Vector3()) {
    return this.handR.getWorldPosition(out);
  }

  update(dt) {
    this.time += dt;
    const [legL, legR] = this.legs;
    const [armL, armR] = this.arms;
    let bodyY = 0;
    let lean = 0;
    let headTilt = 0;

    // 기본 포즈
    let aL = 0, aR = 0, lL = 0, lR = 0, zL = -0.18, zR = 0.18;

    if (this.anim === 'walk' || this.anim === 'run') {
      const speed = this.anim === 'run' ? 15 : 10;
      this.phase += dt * speed;
      const amp = this.anim === 'run' ? 0.95 : 0.7;
      const s = Math.sin(this.phase);
      lL = s * amp; lR = -s * amp;
      aL = -s * amp * 0.8; aR = s * amp * 0.8;
      bodyY = Math.abs(Math.cos(this.phase)) * 0.05;
      lean = this.anim === 'run' ? 0.12 : 0.05;
    } else if (this.anim === 'guitar') {
      // 앉아서 기타 치기: 왼손은 넥, 오른손은 줄을 튕긴다
      lL = lR = -1.45;
      const beat = this.time * 9.5;
      aL = -1.2; zL = -0.55;
      aR = -0.82 + Math.sin(beat) * 0.16; zR = -0.38 + Math.cos(beat) * 0.05;
      bodyY = 0.06 + Math.abs(Math.sin(this.time * 4.75)) * 0.012;
      lean = 0.1 + Math.sin(this.time * 2.37) * 0.025;
      headTilt = Math.sin(this.time * 2.37) * 0.12;
    } else if (this.anim === 'sit') {
      lL = lR = -1.45;
      aL = aR = -0.55;
      zL = -0.05; zR = 0.05;
      bodyY = 0.06 + Math.sin(this.time * 1.2) * 0.005;
      lean = 0.04 + Math.sin(this.time * 0.6) * 0.02;
      headTilt = Math.sin(this.time * 0.5) * 0.06;
    } else {
      const br = Math.sin(this.time * 2.2);
      bodyY = br * 0.008;
      aL = br * 0.03; aR = -br * 0.03;
      headTilt = Math.sin(this.time * 0.7) * 0.04;
    }

    // 장작을 안고 있으면 두 팔로 더미를 받친다 (걸을 때도 팔을 흔들지 않음)
    const holding = this.carry.visible && !this.stashed;
    if (holding && (this.anim === 'idle' || this.anim === 'walk' || this.anim === 'run')) {
      aL = aR = -1.05; zL = 0.42; zR = -0.42;
      lean = Math.max(lean, 0.02) - 0.04;
    }

    // 단발 동작
    const A = this.action;
    if (A) {
      A.t += dt;
      const p = Math.min(1, A.t / A.dur);
      if (A.name === 'chop') {
        let r;
        if (p < 0.5) r = lerp(0, -2.9, easeOut(p / 0.5));
        else if (p < 0.7) r = lerp(-2.9, -1.3, easeIn((p - 0.5) / 0.2));
        else r = lerp(-1.3, -0.9, (p - 0.7) / 0.3);
        aL = aR = r;
        zL = -0.32; zR = 0.32;
        lean = p > 0.5 && p < 0.85 ? 0.18 : 0.02;
        if (!A.hit && p >= 0.7) { A.hit = true; A.impact?.(); }
      } else if (A.name === 'throw' || A.name === 'light') {
        const r = p < 0.4 ? lerp(0, 0.9, easeOut(p / 0.4)) : lerp(0.9, -2.0, easeOut((p - 0.4) / 0.6));
        aR = r;
        if (this.anim === 'sit') lean = 0.1;
        if (!A.hit && p >= 0.55) { A.hit = true; A.impact?.(); }
      } else if (A.name === 'wave') {
        aR = -2.7;
        zR = 0.4 + Math.sin(p * Math.PI * 6) * 0.35;
      } else if (A.name === 'place') {
        // 허리 숙여 통나무 들기 → 가슴 높이로 → 앞으로 내밀어 그루터기에 올리기
        const L = this.handLog;
        L.visible = p < 0.82;
        if (p < 0.35) {
          const e = easeOut(p / 0.35);
          lean = 0.55 * e; bodyY = -0.06 * e; aL = aR = -0.55; lL = lR = -0.5 * e;
          L.position.set(0, 0.22, 0.4);
        } else if (p < 0.7) {
          const e = easeOut((p - 0.35) / 0.35);
          lean = lerp(0.55, 0.08, e); bodyY = lerp(-0.06, 0, e); aL = aR = lerp(-0.55, -1.15, e); lL = lR = lerp(-0.5, 0, e);
          L.position.set(0, lerp(0.22, 0.62, e), 0.4);
        } else {
          const e = easeOut((p - 0.7) / 0.3);
          lean = 0.08 + 0.12 * e; aL = aR = lerp(-1.15, -1.45, e);
          L.position.set(0, lerp(0.62, 0.55, e), lerp(0.4, 0.78, e));
        }
        zL = 0.32; zR = -0.32;
        if (!A.hit && p >= 0.8) { A.hit = true; A.impact?.(); }
      } else if (A.name === 'gather') {
        // 허리 숙여 쪼갠 장작 줍기
        const e = Math.sin(p * Math.PI);
        lean = 0.6 * e; bodyY = -0.07 * e; lL = lR = -0.55 * e;
        aL = aR = -0.4 - 0.5 * e; zL = 0.25; zR = -0.25;
        if (!A.hit && p >= 0.85) { A.hit = true; A.impact?.(); }
      }
      if (p >= 1) {
        this.action = null;
        this.axe.visible = false;
        this.handLog.visible = false;
        A.done?.();
      }
    }

    this.guitar.visible = this.anim === 'guitar' && !A;
    // 장작 더미: 패거나 앉아 있으면 바닥에 내려 두고, 걸으면 다시 안는다 (천천히 품으로)
    const busyHere = (A && (A.name === 'chop' || A.name === 'place' || A.name === 'gather')) || this.anim === 'sit' || this.anim === 'guitar';
    if (busyHere) this.#stash(true);
    else if (this.stashed && (this.anim === 'walk' || this.anim === 'run')) this.#stash(false);
    if (!this.stashed) this.carry.position.lerp(this.carryHome, Math.min(1, dt * 10));
    this.carryBounce = Math.max(0, this.carryBounce - dt * 5);
    const cb = this.carryBounce;
    this.carry.scale.set(1 + cb * 0.12, 1 - cb * 0.12, 1 + cb * 0.12);
    const k = Math.min(1, dt * 14);
    legL.rotation.x = lerp(legL.rotation.x, lL, k);
    legR.rotation.x = lerp(legR.rotation.x, lR, k);
    const ka = A ? Math.min(1, dt * 30) : k;
    armL.rotation.x = lerp(armL.rotation.x, aL, ka);
    armR.rotation.x = lerp(armR.rotation.x, aR, ka);
    armL.rotation.z = lerp(armL.rotation.z, zL, ka);
    armR.rotation.z = lerp(armR.rotation.z, zR, ka);
    this.body.position.y = lerp(this.body.position.y, bodyY, k);
    this.body.rotation.x = lerp(this.body.rotation.x, lean, k);
    this.head.rotation.z = lerp(this.head.rotation.z, headTilt, k * 0.5);

    // 눈 깜빡임
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12;
    for (const e of this.eyes) e.scale.y = blink ? 0.15 : 1.15;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
  }

  /** 테마 옷 입기: 'raincoat'(우비) | 'puffer'(패딩) | null(평상복). 처음 입을 때 만들어 두고 켜고 끈다 */
  setOutfit(kind) {
    kind = kind || null;
    if (this.outfit === kind) return;
    for (const [k, parts] of Object.entries(this.outfits)) for (const p of parts) p.visible = k === kind;
    if (kind && !this.outfits[kind]) this.outfits[kind] = kind === 'raincoat' ? this.#raincoat() : kind === 'santa' ? [...this.#puffer(), ...this.#santaHat()] : this.#puffer();
    for (const p of this.hatParts) p.visible = kind !== 'raincoat' && kind !== 'santa'; // 후드 · 산타 모자를 쓰면 원래 모자는 벗는다
    this.outfit = kind;
  }

  /** 옷 색: 셔츠 색을 바탕으로 (흰 · 검정처럼 색이 없는 셔츠면 노란 우비 · 남색 패딩) */
  #outfitColor(kind) {
    const c = new THREE.Color(this.look.shirt);
    const hsl = {}; c.getHSL(hsl);
    if (hsl.s < 0.18) return new THREE.Color(kind === 'raincoat' ? '#f2c230' : '#3b4a78');
    return kind === 'raincoat' ? new THREE.Color().setHSL(hsl.h, 0.72, 0.6) : new THREE.Color().setHSL(hsl.h, 0.5, 0.45);
  }

  #raincoat() {
    const col = this.#outfitColor('raincoat');
    const m = toon(col, { emissive: col.clone().multiplyScalar(0.12), emissiveIntensity: 1 });
    const dark = toon(col.clone().offsetHSL(0, -0.1, -0.22));
    const parts = [];
    const coat = new THREE.Mesh(G.coat, m); coat.position.y = 0.6; coat.castShadow = true;
    this.body.add(coat); parts.push(coat);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(G.coatBtn, dark); b.position.set(0, 0.76 - i * 0.14, 0.27 + i * 0.012); this.body.add(b); parts.push(b); }
    const hood = new THREE.Mesh(G.hood, toon(col, { side: THREE.DoubleSide }));
    hood.position.set(0, 0.04, -0.03); hood.rotation.x = -0.25; hood.castShadow = true;
    const rim = new THREE.Mesh(G.hoodRim, m);
    rim.position.set(0, 0.04, 0.1); rim.rotation.set(-0.25, 0, -0.025 * Math.PI);
    this.head.add(hood, rim); parts.push(hood, rim);
    for (const pivot of this.arms) { const s = new THREE.Mesh(G.sleeve, m); s.position.y = -0.13; s.castShadow = true; pivot.add(s); parts.push(s); }
    for (const pivot of this.legs) { const b = new THREE.Mesh(G.boot, dark); b.position.y = -0.24; pivot.add(b); parts.push(b); }
    return parts;
  }

  /** 산타 모자: 빨간 고깔이 뒤로 살짝 접히고, 하얀 털 테두리와 방울 */
  #santaHat() {
    const red = toon('#d8283b'), white = toon('#f7f3ec');
    const g = new THREE.Group();
    g.position.set(0, 0.3, -0.03); g.rotation.x = -0.18;
    const cone = new THREE.Mesh(G.santaCone, red); cone.position.set(0, 0.3, -0.05); cone.rotation.x = -0.45; cone.castShadow = true;
    const brim = new THREE.Mesh(G.santaBrim, white); brim.rotation.x = Math.PI / 2;
    const pom = new THREE.Mesh(G.santaPom, white); pom.position.set(0, 0.5, -0.32);
    g.add(cone, brim, pom);
    this.head.add(g);
    return [g];
  }

  #puffer() {
    const col = this.#outfitColor('puffer');
    const m = toon(col), shade = toon(col.clone().offsetHSL(0, 0, -0.07));
    const parts = [];
    const core = new THREE.Mesh(G.puffCore, shade); core.position.y = 0.6; core.castShadow = true;
    this.body.add(core); parts.push(core);
    [[0.42, 0.31], [0.58, 0.32], [0.74, 0.29]].forEach(([y, r]) => { // 볼록한 패딩 줄
      const band = new THREE.Mesh(G.puffBand, m); band.scale.set(r, 0.11, r * 0.95); band.position.y = y; band.castShadow = true;
      this.body.add(band); parts.push(band);
    });
    const collar = new THREE.Mesh(G.puffCollar, m); collar.rotation.x = Math.PI / 2; collar.position.y = 0.86;
    this.body.add(collar); parts.push(collar);
    const scarfCol = new THREE.Color(col).offsetHSL(0.5, 0.15, 0.12);
    const sm = toon(scarfCol);
    const scarf = new THREE.Mesh(G.scarf, sm); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.93;
    const tail = new THREE.Mesh(G.scarfTail, sm); tail.position.set(0.1, 0.8, 0.27); tail.rotation.z = 0.15;
    this.body.add(scarf, tail); parts.push(scarf, tail);
    for (const pivot of this.arms) { const s = new THREE.Mesh(G.puffSleeve, m); s.position.y = -0.13; s.castShadow = true; pivot.add(s); parts.push(s); }
    return parts;
  }

  dispose() {
    this.carry.removeFromParent();
    this.root.removeFromParent();
    this.labelEl.remove();
  }
}
