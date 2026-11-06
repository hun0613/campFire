import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toon } from './toon.js';

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

    this.#hat(look.hat);

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
    const dur = { chop: 0.62, throw: 0.55, wave: 1.2, light: 0.7 }[name] || 0.5;
    this.action = { name, t: 0, dur, impact: opts.onImpact, done: opts.onDone, hit: false };
    if (name === 'chop') this.axe.visible = true;
  }

  setAnim(a) { this.anim = a; }

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
      }
      if (p >= 1) {
        this.action = null;
        this.axe.visible = false;
        A.done?.();
      }
    }

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

  dispose() {
    this.root.removeFromParent();
    this.labelEl.remove();
  }
}
