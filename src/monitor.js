// 모닥불 옆 작은 레트로 TV: 음악이 나올 때 화면이 켜지고, 앉은 사람에게는 그 화면에서 유튜브 영상이 나온다
import * as THREE from 'three';
import { toon } from './toon.js';

export const SCREEN = { w: 0.8, h: 0.45, px: 356 }; // 화면 크기(m) / 영상 iframe 가로 픽셀
const OFFSET = 3.4; // 모닥불 중심에서 떨어진 거리 (의자 사이 빈자리)

const crateGeo = new THREE.BoxGeometry(0.72, 0.62, 0.56);
const plankGeo = new THREE.BoxGeometry(0.74, 0.06, 0.58);
const tvGeo = new THREE.BoxGeometry(1.0, 0.66, 0.5);
const bezelGeo = new THREE.BoxGeometry(0.88, 0.53, 0.02);
const screenGeo = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h);
const knobGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10);
const antGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5);
const tipGeo = new THREE.SphereGeometry(0.025, 8, 6);

const smallCrateGeo = new THREE.BoxGeometry(0.62, 0.5, 0.52);
const deckGeo = new THREE.BoxGeometry(0.56, 0.09, 0.46);
const platterGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.025, 28);
const recordGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.012, 28);
const grooveGeo = new THREE.RingGeometry(0.09, 0.165, 28);
const labelGeo = new THREE.CircleGeometry(0.06, 20);
const armGeo = new THREE.BoxGeometry(0.018, 0.018, 0.26);
const armBaseGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.05, 10);
const hitGeo = new THREE.BoxGeometry(0.8, 0.9, 0.7);
const LABELS = ['#e65a45', '#f2a93b', '#5aa36b', '#3f8fd1', '#8b5cc7', '#f07fa8'];

// 화면 구멍: 색·알파를 (0,0,0,0)으로 '덮어써서' 캔버스 뒤의 영상이 비쳐 보이게 한다. 깊이는 정상적으로 기록
const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false, fog: false });

const OFF = new THREE.Color('#1b1a2b');
const ON = new THREE.Color('#9fd3ff');

export class Monitor {
  /** @param {{x:number,z:number,kind:string}} def 모닥불 정의 */
  constructor(def, scene) {
    // 북쪽 글램핑 앞은 +x, 남쪽 글램핑 앞은 -x (공터 쪽에서 텐트를 볼 때 오른쪽), 공터 화로는 +x
    const side = def.id?.startsWith('ts') ? -1 : 1;
    this.pos = new THREE.Vector3(def.x + side * OFFSET, 0, def.z);
    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.root.rotation.y = Math.atan2(def.x - this.pos.x, def.z - this.pos.z); // 화면이 모닥불을 본다

    const wood = toon('#a26a3c'), woodDark = toon('#7b4d2a');
    const crate = new THREE.Mesh(crateGeo, wood);
    crate.position.y = 0.31;
    const plank = new THREE.Mesh(plankGeo, woodDark);
    plank.position.y = 0.63;
    const tv = new THREE.Mesh(tvGeo, toon('#f0dcb4'));
    tv.position.y = 0.66 + 0.33;
    const bezel = new THREE.Mesh(bezelGeo, toon('#3b3346'));
    bezel.position.set(0, tv.position.y + 0.02, 0.255);
    this.screenMat = new THREE.MeshBasicMaterial({ color: OFF.clone() });
    this.screen = new THREE.Mesh(screenGeo, this.screenMat);
    this.screen.position.set(0, bezel.position.y, 0.267);
    const kmat = toon('#c9772f');
    const k1 = new THREE.Mesh(knobGeo, kmat); k1.rotation.x = Math.PI / 2; k1.position.set(0.46, 0.84, 0.255);
    const ant = new THREE.Group();
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(antGeo, toon('#4a4458'));
      a.position.set(s * 0.1, 0.18, 0);
      a.rotation.z = -s * 0.45;
      const tip = new THREE.Mesh(tipGeo, toon('#e65a45'));
      tip.position.set(s * 0.19, 0.37, 0);
      ant.add(a, tip);
    }
    ant.position.y = 0.66 + 0.66;
    this.root.add(crate, plank, tv, bezel, this.screen, k1, ant);

    // LP 턴테이블 (TV 옆 작은 상자 위) — 누르면 곡 고르기
    this.lp = new THREE.Group();
    this.lp.position.set(-0.78, 0, 0.12);
    this.lp.rotation.y = 0.35;
    const sc = new THREE.Mesh(smallCrateGeo, wood);
    sc.position.y = 0.25;
    const deck = new THREE.Mesh(deckGeo, toon('#3b3346'));
    deck.position.y = 0.545;
    const platter = new THREE.Mesh(platterGeo, toon('#8d8899'));
    platter.position.set(-0.05, 0.6, 0);
    this.record = new THREE.Group();
    this.record.position.set(-0.05, 0.62, 0);
    const disc = new THREE.Mesh(recordGeo, toon('#151319'));
    const groove = new THREE.Mesh(grooveGeo, new THREE.MeshBasicMaterial({ color: '#2c2833' }));
    groove.rotation.x = -Math.PI / 2; groove.position.y = 0.0065;
    const label = new THREE.Mesh(labelGeo, toon(LABELS[Math.floor(Math.random() * LABELS.length)]));
    label.rotation.x = -Math.PI / 2; label.position.y = 0.007;
    const mark = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), toon('#fff3dc'));
    mark.rotation.x = -Math.PI / 2; mark.position.set(0.035, 0.008, 0);
    this.record.add(disc, groove, label, mark);
    const armBase = new THREE.Mesh(armBaseGeo, toon('#c9c3d1'));
    armBase.position.set(0.2, 0.615, -0.15);
    this.arm = new THREE.Group();
    this.arm.position.set(0.2, 0.645, -0.15);
    const armBar = new THREE.Mesh(armGeo, toon('#c9c3d1'));
    armBar.position.z = 0.12;
    this.arm.add(armBar);
    this.arm.rotation.y = 0.15;
    // 누르기 쉬운 투명 판정 상자
    this.hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.45;
    this.hit.userData.monitor = this;
    this.lp.add(sc, deck, platter, this.record, armBase, this.arm, this.hit);
    this.root.add(this.lp);
    this.root.traverse((o) => { if (o.isMesh && o !== this.screen && o !== this.hit) { o.castShadow = true; o.receiveShadow = true; } });

    scene.add(this.root);
    this.root.updateMatrixWorld(true);
    this.lpPos = this.lp.localToWorld(new THREE.Vector3(0, 0, 0));
    this.on = 0;
    this.t = Math.random() * 10;
  }

  /** 영상이 이 TV에서 나오는 동안 화면을 구멍으로 바꾼다 */
  setHole(on) { this.screen.material = on ? HOLE : this.screenMat; }

  /** 화면 위 영상(CSS3D)을 놓을 위치/방향 */
  screenPose(outPos, outQuat) {
    this.screen.updateWorldMatrix(true, false);
    this.screen.getWorldPosition(outPos);
    this.screen.getWorldQuaternion(outQuat);
  }

  /** LP 주변 판정용 위치 (월드) */
  lpWorldPos(out = new THREE.Vector3()) { return this.hit.getWorldPosition(out); }

  update(dt, playing) {
    this.t += dt;
    this.on += ((playing ? 1 : 0) - this.on) * Math.min(1, dt * 4);
    // 켜져 있으면 화면이 은은하게 일렁인다 (TV 빛)
    const flick = 0.85 + Math.sin(this.t * 7.3) * 0.06 + Math.sin(this.t * 13.1) * 0.04;
    this.screenMat.color.copy(OFF).lerp(ON, this.on * flick);
    // 재생 중이면 LP가 돌고, 바늘이 판 위로 올라간다
    this.record.rotation.y -= dt * 3.5 * this.on;
    this.arm.rotation.y = 0.15 + this.on * 0.55;
  }
}
