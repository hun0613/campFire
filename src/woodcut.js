// 장작 패기 연출: 그루터기 위 통나무 → 도끼질마다 금이 벌어짐 → 두 쪽으로 갈라져 넘어짐
// → 쪼갠 사람 품으로 모임 → 그루터기가 비면 새 통나무를 올린다
import * as THREE from 'three';
import { toon } from './toon.js';

const R = 0.22, H = 0.34;
const STUMP_TOP = 0.36;
const halfGeo = new THREE.CylinderGeometry(R, R, H, 12, 1, false, 0, Math.PI);
const faceGeo = new THREE.PlaneGeometry(R * 2, H);
const crackGeo = new THREE.BoxGeometry(0.012, 0.02, R * 2.02);
const easeOut = (t) => 1 - (1 - t) * (1 - t);

let bark, inner, crackMat;
function mats() {
  bark ||= toon('#8a5a36');
  inner ||= toon('#e8c08a');
  crackMat ||= toon('#3a2414');
}

/** 반쪽 통나무 (자른 면 포함) — 다른 곳(캐릭터 품, 손)에서도 쓴다 */
export function makeHalf() {
  mats();
  const g = new THREE.Group();
  const bk = new THREE.Mesh(halfGeo, bark);
  const face = new THREE.Mesh(faceGeo, inner);
  face.rotation.y = Math.PI / 2;
  face.position.x = 0.001;
  g.add(bk, face);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
/** 통짜 통나무 (손에 들고 옮길 때) */
export function makeLog() {
  const g = new THREE.Group();
  const a = makeHalf(), b = makeHalf();
  b.rotation.y = Math.PI;
  g.add(a, b);
  return g;
}

export class Woodcut {
  constructor(scene, stumps) {
    mats();
    this.scene = scene;
    this.list = stumps.map((s) => {
      const root = new THREE.Group();
      root.position.set(s.x, STUMP_TOP, s.z);
      root.rotation.y = Math.random() * Math.PI;
      const L = makeHalf(), Rh = makeHalf();
      Rh.rotation.y = Math.PI;
      L.position.y = Rh.position.y = H / 2;
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.position.y = H + 0.004;
      root.add(L, Rh, crack);
      scene.add(root);
      return { s, root, L, R: Rh, crack, state: 'log', hits: 0, gap: 0, bounce: 0, anim: null };
    });
  }

  /** 'log' | 'splitting' | 'empty' */
  stateOf(i) { return this.list[i]?.state; }

  /** 도끼가 맞을 때: 금이 점점 벌어진다 */
  hit(i) {
    const st = this.list[i];
    if (!st || st.state !== 'log') return;
    st.hits = Math.min(2, st.hits + 1);
    st.bounce = 1;
  }

  /** 세 번째 도끼질: 두 쪽으로 갈라져 양옆으로 넘어지고, collector 품으로 모인다 */
  split(i, collector) {
    const st = this.list[i];
    if (!st || st.state !== 'log') return false;
    st.state = 'splitting';
    st.hits = 0;
    st.crack.visible = false;
    st.anim = { t: 0, collector };
    return true;
  }

  /** 새 통나무를 올려 둔다 */
  place(i) {
    const st = this.list[i];
    if (!st) return;
    st.state = 'log';
    st.hits = 0;
    st.gap = 0;
    st.anim = null;
    st.root.rotation.y = Math.random() * Math.PI;
    for (const h of [st.L, st.R]) { h.visible = true; h.position.set(0, H / 2, 0); h.rotation.set(0, h === st.R ? Math.PI : 0, 0); h.scale.setScalar(1); }
    st.crack.visible = true;
    st.bounce = 0.6;
  }

  update(dt) {
    const tmp = new THREE.Vector3();
    for (const st of this.list) {
      // 금 벌어짐 + 맞을 때 살짝 눌림
      if (st.state === 'log') {
        st.gap += ((st.hits * 0.018) - st.gap) * Math.min(1, dt * 18);
        st.L.position.x = -st.gap; st.R.position.x = st.gap;
        st.L.rotation.z = st.gap * 1.6; st.R.rotation.z = -st.gap * 1.6;
        st.crack.scale.set(1 + st.hits * 2.5, 1, 1);
        st.crack.visible = st.hits > 0;
        st.bounce = Math.max(0, st.bounce - dt * 5);
        const b = st.bounce;
        st.root.scale.set(1 + b * 0.12, 1 - b * 0.15, 1 + b * 0.12);
        continue;
      }
      if (st.state !== 'splitting' || !st.anim) continue;
      const A = st.anim;
      A.t += dt;
      // 0 ~ 0.45초: 양옆으로 쩍 갈라지며 넘어진다
      const p = Math.min(1, A.t / 0.45);
      const e = easeOut(p);
      for (const [h, side] of [[st.L, -1], [st.R, 1]]) {
        if (A.t < 0.75) {
          h.rotation.z = -side * e * 1.45;
          h.position.x = side * (0.03 + e * 0.32);
          h.position.y = H / 2 - e * 0.12 - Math.max(0, p - 0.6) * 0.15;
        }
      }
      // 0.75 ~ 1.1초: 쪼갠 사람 품으로 날아가 모인다
      if (A.t >= 0.75) {
        const q = Math.min(1, (A.t - 0.75) / 0.35);
        if (!A.from) {
          A.from = [st.L, st.R].map((h) => h.getWorldPosition(new THREE.Vector3()));
          for (const h of [st.L, st.R]) { st.root.remove(h); this.scene.add(h); }
          A.from.forEach((f, k) => { const h = k ? st.R : st.L; h.position.copy(f); });
        }
        const target = A.collector?.carryWorldPos?.(tmp) || tmp.set(st.s.x, 1, st.s.z);
        [st.L, st.R].forEach((h, k) => {
          const f = A.from[k];
          h.position.lerpVectors(f, target, easeOut(q));
          h.position.y += Math.sin(q * Math.PI) * 0.45;
          h.rotation.x += dt * 6;
          h.scale.setScalar(1 - q * 0.45);
        });
        if (q >= 1) {
          for (const h of [st.L, st.R]) { this.scene.remove(h); st.root.add(h); h.visible = false; }
          st.state = 'empty';
          st.anim = null;
          A.collector?.bumpCarry?.();
        }
      }
    }
  }
}
