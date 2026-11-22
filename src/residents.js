// 🏡 캠핑장 주민 (v1.22.0): 숲길 · 캠핑장 곳곳에서 저마다 할 일을 하는 NPC
// 목록 · 자리 · 대사는 shared/residents.js. 여기서는 모습(소품 · 몸짓)과 움직임만 맡는다
import * as THREE from 'three';
import { Character } from './character.js';
import { toon, glow } from './toon.js';
import { hillHeight } from '../shared/config.js';
import { RESIDENTS, residentPos, residentActive, RESIDENT_RANGE } from '../shared/residents.js';

const wood = toon('#8a5a34'), woodDark = toon('#5e3c22'), metal = toon('#3a3f48'), cream = toon('#f3e6cf');
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r1, r2, h, m, seg = 7) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
const ball = (r, m, seg = 8) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const shadowAll = (g) => g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

// ---------------------------------------------------------------- 앉는 자리 · 소품
function logSeat() { // 통나무 의자 (몸 옆으로 길게)
  const g = new THREE.Group();
  const log = cyl(0.22, 0.22, 1.3, wood, 8); log.rotation.z = Math.PI / 2; log.position.y = 0.22;
  const ring = cyl(0.17, 0.17, 1.31, toon('#c9a06a'), 8); ring.rotation.z = Math.PI / 2; ring.position.y = 0.22; ring.scale.set(1, 1, 1);
  g.add(log, ring);
  g.position.z = -0.08;
  return g;
}
function stool() {
  const g = new THREE.Group();
  g.add(at(cyl(0.2, 0.2, 0.06, wood, 8), 0, 0.4, -0.05));
  for (const [x, z] of [[-0.12, -0.15], [0.12, -0.15], [0, 0.08]]) g.add(at(cyl(0.025, 0.03, 0.4, woodDark, 5), x, 0.2, z));
  return g;
}
function bench() {
  const g = new THREE.Group();
  g.add(at(box(1.3, 0.07, 0.38, wood), 0, 0.42, -0.06));
  for (const x of [-0.55, 0.55]) g.add(at(box(0.08, 0.42, 0.32, woodDark), x, 0.21, -0.06));
  g.add(at(box(1.3, 0.28, 0.05, wood), 0, 0.68, -0.27));
  return g;
}
function rocker() { // 흔들의자: rock 그룹을 앞뒤로 기울인다
  const g = new THREE.Group(), rock = new THREE.Group(); g.add(rock); g.userData.rock = rock;
  rock.add(at(box(0.62, 0.06, 0.5, wood), 0, 0.42, -0.05));
  rock.add(at(box(0.62, 0.7, 0.06, wood), 0, 0.78, -0.3));
  for (const x of [-0.28, 0.28]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 4, 12, 1.1), woodDark);
    r.rotation.set(0, Math.PI / 2, Math.PI + 1.0); r.position.set(x, 0.64, -0.05); rock.add(r);
    rock.add(at(box(0.05, 0.42, 0.05, woodDark), x, 0.24, 0.15), at(box(0.05, 0.42, 0.05, woodDark), x, 0.24, -0.25));
  }
  rock.add(at(box(0.5, 0.05, 0.4, toon('#c98a6a')), 0, 0.46, -0.04)); // 방석
  return g;
}

/** 손에 드는 소품: 오른손(arms[1])의 손 위치에 붙인다 */
function inHand(ch, obj, side = 1) { obj.position.add(new THREE.Vector3(0, -0.33, 0)); ch.arms[side === 1 ? 1 : 0].add(obj); return obj; }

const PROPS = {
  photo(r, ch) { // 두 손으로 턱 앞에 든 카메라 (머리가 커서 얼굴 높이에 대면 머리에 묻힌다)
    const cam = new THREE.Group();
    cam.add(box(0.26, 0.16, 0.11, metal));                                            // 몸체
    cam.add(at(box(0.07, 0.035, 0.05, toon('#22252c')), -0.07, 0.095, 0));            // 셔터 쪽 손잡이
    cam.add(at(box(0.05, 0.03, 0.03, toon('#e8e2d6')), 0.08, 0.06, 0.06));            // 뷰파인더 창
    const lens = at(cyl(0.06, 0.065, 0.09, toon('#22252c'), 10), 0.01, -0.005, 0.095); lens.rotation.x = Math.PI / 2; cam.add(lens);
    const glass = at(cyl(0.042, 0.042, 0.01, toon('#6a8fb3'), 10), 0.01, -0.005, 0.142); glass.rotation.x = Math.PI / 2; cam.add(glass);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 12, Math.PI), toon('#7a3b2e')); strap.rotation.z = Math.PI; strap.position.set(0, 0.0, -0.02); cam.add(strap);
    cam.position.set(0, 0.98, 0.4); cam.rotation.x = -0.12; ch.body.add(cam);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#fff6dd', 6)); flash.position.set(0.09, 0.1, 0.03); flash.visible = false; cam.add(flash);
    return { flash };
  },
  farmer(r, ch) {
    const fork = new THREE.Group();
    fork.add(at(cyl(0.02, 0.02, 1.5, wood, 5), 0, 0, 0));
    for (const x of [-0.06, 0, 0.06]) fork.add(at(cyl(0.008, 0.008, 0.22, metal, 4), x, 0.84, 0));
    fork.add(at(box(0.16, 0.02, 0.02, metal), 0, 0.74, 0));
    fork.position.set(0.42, 0.75, 0.05); fork.rotation.z = -0.06; ch.root.add(fork);
    return {};
  },
  crouch(r, ch) {
    const g = new THREE.Group();
    if (r.id === 'daisy') { // 꽃바구니
      g.add(at(cyl(0.16, 0.12, 0.14, toon('#c99a5a'), 8), 0, 0.07, 0));
      for (let i = 0; i < 6; i++) g.add(at(ball(0.04, toon(i % 2 ? '#ffffff' : '#ffe27a'), 6), Math.cos(i) * 0.08, 0.16, Math.sin(i) * 0.08));
      g.position.set(-0.45, 0, 0.35);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 12), toon('#9fd17a')); crown.rotation.x = Math.PI / 2; crown.position.y = 0.33; ch.head.add(crown);
      for (let i = 0; i < 6; i++) { const f = ball(0.035, toon(i % 2 ? '#ffffff' : '#ffd36b'), 6); const a = (i / 6) * Math.PI * 2; f.position.set(Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2); ch.head.add(f); }
    } else { // 달팽이
      g.add(at(ball(0.07, toon('#c48a5a'), 8), 0, 0.07, 0), at(box(0.18, 0.04, 0.06, toon('#d9c7a0')), 0.04, 0.02, 0));
      g.add(at(cyl(0.008, 0.008, 0.06, toon('#d9c7a0'), 4), 0.12, 0.06, 0));
      g.position.set(0.05, 0, 0.6); g.userData.snail = true;
    }
    ch.root.add(g);
    return { thing: g };
  },
  walker(r, ch, scene) { // 강아지 콩이 + 목줄
    const dog = new THREE.Group(), coat = toon('#e8c08a'), dark = toon('#6b4a2b');
    const bodyM = at(box(0.24, 0.2, 0.46, coat), 0, 0.3, 0);
    const head = at(box(0.2, 0.2, 0.2, coat), 0, 0.44, 0.27);
    head.add(at(box(0.1, 0.08, 0.1, toon('#f6dcb4')), 0, -0.04, 0.12), at(ball(0.025, dark, 5), 0, 0.0, 0.18));
    for (const x of [-0.08, 0.08]) { const ear = at(box(0.06, 0.12, 0.04, dark), x, 0.1, -0.02); ear.rotation.z = x * 3; head.add(ear); head.add(at(ball(0.018, dark, 5), x * 0.6, 0.04, 0.1)); }
    const tail = at(box(0.04, 0.04, 0.2, coat), 0, 0.4, -0.28); tail.rotation.x = -0.7;
    const legs = [[-0.08, 0.16], [0.08, 0.16], [-0.08, -0.16], [0.08, -0.16]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.22, z); p.add(at(box(0.06, 0.22, 0.06, coat), 0, -0.11, 0)); dog.add(p); return p; });
    dog.add(bodyM, head, tail);
    shadowAll(dog);
    scene.add(dog);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const leash = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#d84a5a' }));
    leash.frustumCulled = false;
    scene.add(leash);
    return { dog, tail, legs, leash, head };
  },
  read(r, ch) {
    const b = bench(); ch.root.add(b);
    const book = new THREE.Group();
    // 책장은 읽는 사람 쪽(-z)을 보고, 표지는 바깥(+z)을 본다. 위쪽이 앞으로 기울어 무릎 위에서 펼쳐 든 모양
    for (const s of [-1, 1]) { const pg = at(box(0.15, 0.2, 0.012, cream), s * 0.075, 0, 0); pg.rotation.y = s * 0.35; book.add(pg); }
    book.add(at(box(0.31, 0.21, 0.01, toon('#7a4ab5')), 0, 0, 0.03));
    book.position.set(0, 0.72, 0.34); book.rotation.x = 0.93; ch.body.add(book);
    return { book };
  },
  paint(r, ch) {
    const e = new THREE.Group();
    for (const [x, z, rz, rx] of [[-0.25, 0, 0.12, 0.1], [0.25, 0, -0.12, 0.1], [0, -0.25, 0, -0.3]]) { const l = at(box(0.04, 1.5, 0.04, wood), x, 0.72, z); l.rotation.set(rx, 0, rz); e.add(l); }
    const canvas = at(box(0.6, 0.48, 0.03, toon('#fbf6ec')), 0, 1.15, 0.04); canvas.rotation.x = 0.1; e.add(canvas);
    for (const [c, x, y, w] of [['#6aa9d8', 0, 0.1, 0.52], ['#ff9a6a', 0, -0.02, 0.5], ['#5a8a5a', 0.05, -0.12, 0.4]]) { const s = at(box(w, 0.1, 0.005, toon(c)), x, y, 0.018); canvas.add(s); }
    e.add(at(box(0.62, 0.03, 0.08, wood), 0, 0.9, 0.06));
    e.position.set(0.05, 0, 0.85); e.rotation.y = Math.PI; ch.root.add(e);
    const pal = at(box(0.2, 0.015, 0.15, toon('#c99a6a')), 0, 0, 0.06); inHand(ch, pal, -1);
    const brush = at(cyl(0.01, 0.01, 0.24, woodDark, 4), 0, 0, 0.08); brush.rotation.x = Math.PI / 2; inHand(ch, brush, 1);
    return {};
  },
  fish(r, ch) {
    ch.root.add(stool());
    const rod = new THREE.Group();
    const pole = at(cyl(0.012, 0.025, 2.6, woodDark, 5), 0, 1.25, 0); rod.add(pole);
    rod.position.set(0.05, 0.6, 0.35); rod.rotation.x = 1.05; ch.body.add(rod);
    const bob = ball(0.05, glow('#ff7a5a', 2.2), 6); ch.root.add(bob); bob.position.set(0.1, 0.02, 3.4);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e8e4dc', transparent: true, opacity: 0.6 }));
    line.frustumCulled = false; ch.root.add(line);
    return { rod, pole, bob, line };
  },
  scope(r, ch) {
    const s = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const l = at(cyl(0.015, 0.015, 1.2, metal, 4), Math.cos(a) * 0.18, 0.58, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28); s.add(l); }
    const tube = at(cyl(0.07, 0.05, 0.85, toon('#c9a24a'), 10), 0, 1.3, 0); tube.rotation.x = -1.0; s.add(tube);
    s.add(at(cyl(0.08, 0.08, 0.04, toon('#2a2f45'), 10), 0, 1.3 + Math.cos(1.0) * 0.43, Math.sin(1.0) * 0.43));
    s.children[s.children.length - 1].rotation.x = -1.0;
    s.position.set(0, 0, 0.55); ch.root.add(s);
    return {};
  },
  guitar(r, ch) { ch.root.add(logSeat()); return {}; },
  roast(r, ch) {
    ch.root.add(logSeat());
    const stick = new THREE.Group();
    stick.add(at(cyl(0.01, 0.012, 1.4, woodDark, 4), 0, 0.7, 0));
    const mm = at(cyl(0.05, 0.05, 0.08, toon('#fff1d6'), 8), 0, 1.42, 0); stick.add(mm);
    const toast = at(cyl(0.051, 0.051, 0.03, toon('#c98a4a'), 8), 0, 1.42, 0); stick.add(toast);
    stick.rotation.x = Math.PI / 2 - 0.35; inHand(ch, stick, 1);
    return {};
  },
  pour(r, ch) {
    const t = new THREE.Group();
    t.add(at(box(0.7, 0.05, 0.45, wood), 0, 0.72, 0));
    for (const [x, z] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]]) t.add(at(box(0.04, 0.72, 0.04, woodDark), x, 0.36, z));
    t.add(at(cyl(0.05, 0.05, 0.1, toon('#f6efe2'), 8), -0.12, 0.8, 0)); // 컵
    t.add(at(cyl(0.08, 0.04, 0.09, toon('#e8d8c0'), 8), -0.12, 0.92, 0)); // 드리퍼
    t.add(at(cyl(0.06, 0.06, 0.12, toon('#6a8a5a'), 8), 0.2, 0.81, 0.05)); // 원두통
    t.position.set(0, 0, 0.55); ch.root.add(t);
    const kettle = new THREE.Group();
    kettle.add(at(cyl(0.07, 0.08, 0.13, metal, 8), 0, 0, 0));
    const spout = at(cyl(0.012, 0.012, 0.18, metal, 4), 0, 0.03, 0.1); spout.rotation.x = 1.0; kettle.add(spout);
    kettle.position.set(0, 0, 0.1); inHand(ch, kettle, 1);
    const steam = glow('#ffffff', 0.6); steam.transparent = true; steam.opacity = 0.35;
    const puff = at(ball(0.05, steam, 6), -0.12, 1.05, 0); t.add(puff);
    return { puff };
  },
  ranger(r, ch) {
    const fl = new THREE.Group();
    fl.add(at(cyl(0.03, 0.03, 0.2, toon('#2a2a2a'), 6), 0, 0, 0));
    fl.add(at(cyl(0.045, 0.035, 0.05, glow('#fff3c4', 3), 8), 0, -0.12, 0));
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1c0', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 12, 1, true), beamMat); beam.position.y = -1.7; fl.add(beam);
    // 팔을 앞으로 든 각도(-0.75)와 합쳐 불빛(-y 쪽)이 앞 · 살짝 아래 땅을 비추게
    fl.rotation.x = -0.45; fl.position.set(0, -0.36, 0.06); ch.arms[1].add(fl); ch.waveLeft = true; // 손전등은 오른손, 인사는 왼손으로
    return {};
  },
  rock(r, ch) { // 찻집: 흔들의자 + 찻상 + 등불
    const chair = rocker(); ch.root.add(chair);
    const stall = new THREE.Group();
    stall.add(at(cyl(0.38, 0.38, 0.05, wood, 10), 0, 0.5, 0));
    stall.add(at(cyl(0.05, 0.08, 0.5, woodDark, 6), 0, 0.25, 0));
    const pot = at(ball(0.11, toon('#d27a4a'), 8), 0.05, 0.62, 0); pot.scale.y = 0.85; stall.add(pot);
    const sp = at(cyl(0.015, 0.02, 0.12, toon('#d27a4a'), 4), 0.16, 0.65, 0); sp.rotation.z = -1.0; stall.add(sp);
    for (const x of [-0.2, -0.12]) stall.add(at(cyl(0.035, 0.03, 0.06, cream, 8), x, 0.56, 0.18));
    stall.position.set(0.75, 0, 0.45); ch.root.add(stall);
    const lamp = new THREE.Group();
    lamp.add(at(cyl(0.03, 0.03, 1.5, woodDark, 5), 0, 0.75, 0));
    lamp.add(at(box(0.16, 0.2, 0.16, glow('#ffc477', 2.4)), 0.12, 1.4, 0));
    lamp.position.set(-0.8, 0, 0.3); ch.root.add(lamp);
    const rug = at(new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), toon('#a8584a')), 0.2, 0.015, 0.3); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true; ch.root.add(rug);
    return { rock: chair.userData.rock };
  },
  snowman(r, ch) {
    const sm = new THREE.Group(), snow = toon('#f4f7fb'), dark = toon('#2a2a2a');
    sm.add(at(ball(0.38, snow, 10), 0, 0.36, 0), at(ball(0.27, snow, 10), 0, 0.88, 0));
    for (const x of [-0.08, 0.08]) sm.add(at(ball(0.03, dark, 5), x, 0.95, 0.24));
    sm.add(at(ball(0.045, toon('#7a5a3a'), 5), 0, 0.88, 0.27));
    sm.position.set(-0.9, 0, 0.4); ch.root.add(sm);
    const roll = at(ball(0.2, snow, 10), 0, 0.2, 0.55); ch.root.add(roll);
    return { roll };
  },
  blanket(r, ch) {
    ch.root.add(logSeat());
    const bl = new THREE.Group(), m = toon('#b5655a');
    bl.add(at(box(0.62, 0.5, 0.42, m), 0, 0.62, -0.02));
    bl.add(at(box(0.66, 0.08, 0.46, toon('#e8c08a')), 0, 0.86, -0.02));
    ch.body.add(bl);
    const cup = at(cyl(0.04, 0.035, 0.08, cream, 8), 0, 0, 0.05); inHand(ch, cup, 1);
    return {};
  },
};

// ---------------------------------------------------------------- 몸짓 (Character.poseFn)
const POSES = {
  photo: (s) => (t) => { const shoot = (t % 7) > 6.6; return { aL: -2.2, aR: -2.2, zL: 0.45, zR: -0.45, nod: shoot ? 0.04 : 0, lean: -0.02 }; },
  farmer: () => (t) => ({ aR: -0.25, zR: 0.05, aL: 0.25, zL: 0.12, nod: -0.25 }),
  crouch: () => (t) => ({ lL: -1.6, lR: -1.6, bodyY: -0.2, lean: 0.38, aR: -0.95 + Math.sin(t * 1.6) * 0.18, aL: -0.7, zL: -0.05, zR: 0.05, nod: 0.25 }),
  walker: (s) => (t, anim) => (anim === 'walk' ? { aR: -0.55, zR: 0.12 } : { aR: -0.55, zR: 0.12, aL: 0.05 }),
  read: () => (t) => { const flip = (t % 9) > 8.5; return { aL: -1.05, aR: -1.05 + (flip ? -0.35 : 0), zL: 0.32, zR: -0.32, nod: 0.3 }; },
  paint: () => (t) => ({ aR: -1.35 + Math.sin(t * 2.4) * 0.12, zR: -0.2 + Math.cos(t * 2.4) * 0.1, aL: -0.9, zL: 0.25, lean: 0.03 }),
  fish: () => (t) => { const doze = Math.sin(t * 0.35); return { aL: -1.0, aR: -1.0, zL: 0.28, zR: -0.28, nod: doze > 0.6 ? 0.4 : 0.05 }; },
  scope: () => () => ({ aL: -1.55, aR: -1.45, zL: 0.3, zR: -0.22, nod: -0.3, lean: 0.12 }),
  guitar: () => null,
  roast: () => (t) => ({ aR: -1.2 + Math.sin(t * 0.8) * 0.05, zR: -0.1, aL: -0.55 }),
  pour: () => (t) => ({ aR: -1.15 + Math.sin(t * 2) * 0.06, zR: -0.25 + Math.cos(t * 2) * 0.08, aL: -0.3, nod: 0.3 }),
  ranger: () => (t, anim) => ({ aR: -0.75 + (anim === 'walk' ? Math.sin(t * 2) * 0.05 : 0), zR: 0.08 }),
  rock: () => (t) => ({ aL: -0.7, aR: -0.7, zL: 0.3, zR: -0.3, headTilt: Math.sin(t * 0.5) * 0.06 }),
  snowman: () => (t) => ({ aL: -1.25, aR: -1.25, zL: 0.2, zR: -0.2, lean: 0.32 + Math.sin(t * 1.4) * 0.04, bodyY: -0.03 }),
  blanket: () => (t) => ({ aL: -0.5, aR: -1.0, zR: -0.15, headTilt: Math.sin(t * 0.4) * 0.08 + 0.05, nod: 0.12 }),
};
const SITTERS = new Set(['read', 'fish', 'guitar', 'roast', 'rock', 'blanket']);

// ---------------------------------------------------------------- 만들기 · 움직이기
export function createResidents(scene) {
  const list = RESIDENTS.map((r) => {
    const ch = new Character({ ...r.look }, { name: `${r.icon} ${r.name} · ${r.title}`, kind: 'npc' });
    ch.markEl.textContent = r.kind === 'comfort' ? '🫖' : '💬';
    const p = residentPos(r);
    ch.root.position.set(p.x, hillHeight(p.x, p.z), p.z);
    ch.root.rotation.y = p.ry;
    ch.setAnim(r.pose === 'guitar' ? 'guitar' : SITTERS.has(r.pose) ? 'sit' : 'idle');
    const props = PROPS[r.pose]?.(r, ch, scene) || {};
    ch.poseFn = POSES[r.pose]?.(r);
    if (r.outfit) ch.setOutfit(r.outfit);
    scene.add(ch.root);
    return { r, ch, props, greeted: false, active: true, pos: p };
  });

  const v = new THREE.Vector3(), w = new THREE.Vector3();
  let themeOutfit = null;

  return {
    list,
    /** 테마 옷 (우비 · 패딩 · 산타). 처음부터 우비인 아이는 그대로 */
    setOutfit(kind) { themeOutfit = kind; for (const e of list) if (!e.r.outfit) e.ch.setOutfit(kind); },
    /** 텐트 안에서는 바깥 주민을 숨긴다 */
    hideAll(hide) { for (const e of list) e.ch.root.visible = !hide && e.active; },
    /** 매 프레임: 테마 · 시각에 맞춰 나오고 숨고, 걷는 주민은 걷고, 가까이 오면 나를 본다 */
    update(dt, { me, theme, now, met, camPos, inTent, talkingId = null }) {
      for (const e of list) {
        const { r, ch, props } = e;
        const on = residentActive(r, theme, now);
        if (on !== e.active) e.active = on;
        const vis = on && !inTent;
        if (ch.root.visible !== vis) ch.root.visible = vis;
        if (props.dog) props.dog.visible = vis, props.leash.visible = vis;
        if (!vis) continue;
        const p = residentPos(r, now);
        e.pos = p;
        // 멀리 있으면 몸짓을 쉰다 (휴대폰 부담 줄이기)
        const far = camPos && (camPos.x - p.x) ** 2 + (camPos.z - p.z) ** 2 > 70 * 70;
        if (r.walk || r.patrol) {
          ch.root.position.set(p.x, hillHeight(p.x, p.z), p.z);
          ch.setAnim(p.moving ? 'walk' : 'idle');
        }
        // 계속 쳐다보지 않는다: 처음 다가올 때 2.5초 · 가끔 흘끗 1.2초 · 이야기하는 동안만 나를 보고, 나머지는 하던 일을 본다
        if (me) {
          const d = Math.hypot(me.x - p.x, me.z - p.z);
          const talking = talkingId === r.id;
          if (d < 6 && !e.greeted) { e.greeted = true; e.lookT = 2.5; ch.emote('wave', '👋'); }
          if (d > 11) e.greeted = false;
          e.lookT = Math.max(0, (e.lookT || 0) - dt);
          if (d < 5 && !talking) {
            e.glanceIn = (e.glanceIn ?? 14 + Math.random() * 10) - dt;
            if (e.glanceIn <= 0) { e.lookT = 1.2; e.glanceIn = 14 + Math.random() * 10; }
          }
          const look = talking || e.lookT > 0;
          ch.setLook(look ? Math.atan2(me.x - p.x, me.z - p.z) : null, 0);
          if (r.walk || r.patrol) { // 걷는 주민은 이야기할 때만 멈춰 서서 몸을 돌린다
            const want = talking && !p.moving ? Math.atan2(me.x - p.x, me.z - p.z) : p.ry;
            ch.root.rotation.y = lerpAngle(ch.root.rotation.y, want, Math.min(1, dt * 5));
          }
          // 말을 걸 수 있는 주민은 머리 위에 💬 (오늘 이미 만났으면 숨김)
          const can = r.kind === 'comfort' || !met.includes(r.id);
          ch.markEl.style.display = can && d < 22 ? '' : 'none';
        }
        if (far) continue;
        ch.update(dt);
        // 소품 움직임
        const t = ch.time;
        if (props.flash) props.flash.visible = (t % 7) > 6.6 && (t % 7) < 6.72;
        if (props.rock) { const a = Math.sin(t * 1.3) * 0.08; props.rock.rotation.x = a; ch.body.rotation.x += a * 0.6; }
        if (props.thing?.userData.snail) props.thing.position.x = 0.05 + Math.sin(t * 0.15) * 0.15;
        if (props.roll) { const k = (t % 30) / 30; props.roll.scale.setScalar(0.6 + k * 0.6); props.roll.position.y = 0.2 * (0.6 + k * 0.6); props.roll.rotation.x = t * 0.8; }
        if (props.puff) { const k = (t * 0.5) % 1; props.puff.position.y = 1.0 + k * 0.4; props.puff.material.opacity = 0.35 * (1 - k); props.puff.scale.setScalar(0.7 + k); }
        if (props.bob) {
          props.bob.position.y = 0.02 + Math.sin(t * 1.7) * 0.015;
          ch.body.updateMatrixWorld(true);
          props.pole.localToWorld(v.set(0, 1.3, 0)); ch.root.worldToLocal(v);
          const arr = props.line.geometry.attributes.position.array;
          arr[0] = v.x; arr[1] = v.y; arr[2] = v.z; arr[3] = props.bob.position.x; arr[4] = props.bob.position.y; arr[5] = props.bob.position.z;
          props.line.geometry.attributes.position.needsUpdate = true;
        }
        if (props.dog) { // 강아지는 주인 앞에서 걷고, 쉴 때는 앉아서 꼬리를 흔든다
          const fx = p.tx ?? Math.sin(p.ry), fz = p.tz ?? Math.cos(p.ry);
          const tx = p.x + fx * 1.15 + fz * 0.35, tz = p.z + fz * 1.15 - fx * 0.35;
          const dg = props.dog;
          dg.position.x += (tx - dg.position.x) * Math.min(1, dt * 4);
          dg.position.z += (tz - dg.position.z) * Math.min(1, dt * 4);
          dg.position.y = hillHeight(dg.position.x, dg.position.z);
          dg.rotation.y = lerpAngle(dg.rotation.y, Math.atan2(fx, fz), Math.min(1, dt * 5));
          props.tail.rotation.y = Math.sin(t * (p.moving ? 9 : 14)) * 0.6;
          props.legs.forEach((l, i) => { l.rotation.x = p.moving ? Math.sin(t * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
          dg.children[0].rotation.x = 0;
          ch.handWorldPos(v); props.head.getWorldPosition(w); w.y -= 0.08;
          const arr = props.leash.geometry.attributes.position.array;
          arr[0] = v.x; arr[1] = v.y; arr[2] = v.z; arr[3] = w.x; arr[4] = w.y; arr[5] = w.z;
          props.leash.geometry.attributes.position.needsUpdate = true;
        }
      }
    },
    /** 말을 걸 수 있는 가장 가까운 주민 */
    nearest(me) {
      let best = null, bd = RESIDENT_RANGE;
      for (const e of list) {
        if (!e.active || !e.ch.root.visible) continue;
        const d = Math.hypot(me.x - e.pos.x, me.z - e.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      return best && { e: best, d: bd };
    },
    get(id) { return list.find((e) => e.r.id === id); },
  };
}

function lerpAngle(a, b, t) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }
