// 유기체: 불멍 아레나 무대 (v1.23) — 캠핑장 망루처럼 붉은 지붕 오두막을 얹은 철골 탑 둘 · 작은 탑 둘,
// 가운데 대형 전광판 + 양옆 보조 전광판, 위 조명 트러스(무빙 라이트 빛줄기) · 기와 지붕 · 이름 현수막 · 깃발 줄, 스피커 기둥
// 요소 틀: create(opts) → { group, update, setTheme, colliders, seats, screens }. 바닥 y=0, 무대 가운데가 기준점, 정면(객석) +z
//   screens.main · left · right : 전광판 면 (게임이 영상 구멍 · 안내 그림을 붙인다). MAIN: 가운데 전광판 크기 · 자리
//   update(t, { energy }) : energy 0~1 (무대에 곡이 나오면 1) — 빛줄기가 조금 밝아진다. 움직임은 늘 천천히 · 작게, 깜빡임 없음 (광과민성 · 어지럼 안전)
import * as THREE from 'three';
import { plank, color } from '../atoms/index.js';
import { toon, glow, textTexture } from '../../toon.js';

export const DECK = { w: 30, d: 11, h: 1.6 };
export const MAIN = { y: 7.4, z: -3.8, w: 14.4, h: 8.1 };
export const SIDE = { x: 15.6, y: 5.8, z: -2.2, w: 7.6, h: 4.28 };
const TRUSS_Y = 13.2, TRUSS_Z = -2.4;
const BEAM_COLORS = ['stage.warm', 'stage.peach', 'stage.glow', 'stage.warm']; // 조명은 모닥불빛 한 톤 (금 · 살구 · 크림)
const FLAG_COLORS = ['balloon.red', 'balloon.cream', 'stage.amber', 'balloon.sun'];

/** 쇠막대 모음 → 인스턴스 하나 (그리기 한 번) */
function barSet() {
  const list = [];
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    add(a, b, r = 0.05) { list.push([a, b, r]); },
    mesh(mat) {
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat, list.length);
      list.forEach(([a, b, r], i) => {
        d.subVectors(b, a); const len = d.length();
        q.setFromUnitVectors(up, d.normalize());
        p.addVectors(a, b).multiplyScalar(0.5);
        m.compose(p, q, s.set(r, len, r));
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true;
      return mesh;
    },
  };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 네모 격자 탑: 모서리 기둥 4 + 층마다 가로대 + 면마다 지그재그 버팀대 */
function tower(bars, x, z, w, h, step = 1.5) {
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + a * w / 2, z + b * w / 2]);
  for (const [cx, cz] of c) bars.add(V(cx, 0, cz), V(cx, h, cz), 0.09);
  for (let y = 0, k = 0; y < h - 0.01; y += step, k++) {
    const y2 = Math.min(h, y + step);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
      bars.add(V(ax, y2, az), V(bx, y2, bz), 0.045);
      if (k % 2) bars.add(V(ax, y, az), V(bx, y2, bz), 0.035); else bars.add(V(bx, y, bz), V(ax, y2, az), 0.035);
    }
  }
}
/** 망루 오두막 + 붉은 기와 지붕 (탑 꼭대기) */
function cabin(g, x, z, y, w, h) {
  const wall = toon(color('stage.cabin')), dark = toon(color('wood.dark'));
  g.add(plank(w + 0.8, 0.22, w + 0.8, 'wood.dark', { x, y, z, shadow: true })); // 발코니 바닥
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), wall);
  box.position.set(x, y + h / 2 + 0.1, z); box.castShadow = true;
  g.add(box);
  // 창: 앞 · 옆에 노란 불빛 (빛나는 재질)
  const win = glow(color('stage.lamp'), 1.6);
  for (const [nx, nz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    for (const o of [-0.26, 0.26]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, h * 0.42), win);
      m.position.set(x + nx * (w / 2 + 0.01) + (nz ? o * w : 0), y + h * 0.58, z + nz * (w / 2 + 0.01) + (nx ? o * w * -nx : 0));
      m.rotation.y = ry;
      g.add(m);
    }
  }
  // 난간
  for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) g.add(plank(sx ? 0.06 : w + 0.8, 0.5, sz ? 0.06 : w + 0.8, 'wood.dark', { x: x + sx * (w / 2 + 0.37), y: y + 0.36, z: z + sz * (w / 2 + 0.37) }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.92, w * 0.55, 4), toon(color('stage.roof')));
  roof.rotation.y = Math.PI / 4; roof.position.set(x, y + h + 0.1 + w * 0.275, z); roof.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.32, 0.12, w * 1.32), dark);
  cap.position.set(x, y + h + 0.12, z);
  g.add(roof, cap);
}
/** 빛줄기 투명도: 조명 쪽(위)은 진하고 끝으로 갈수록 사라진다 */
function beamAlpha() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, '#777'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(cv);
}

export function create(opts = {}) {
  const group = new THREE.Group();
  group.userData.ds = 'arena-stage';
  group.userData.args = {};
  const bars = barSet();
  const steel = toon(color('stage.truss'));
  const frame = toon(color('stage.frame'));

  // ── 무대 바닥 (+ 앞 끝 분홍 불빛 띠 · 앞면 조명 상자)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK.w, DECK.h, DECK.d), toon(color('stage.deck')));
  deck.position.y = DECK.h / 2; deck.receiveShadow = true; deck.castShadow = true;
  group.add(deck);
  group.add(plank(DECK.w, 0.06, DECK.d - 0.2, 'wood.dark', { y: DECK.h + 0.03, receive: true }));
  const lip = new THREE.Mesh(new THREE.BoxGeometry(DECK.w, 0.07, 0.07), glow(color('stage.warm'), 1.6));
  lip.position.set(0, DECK.h + 0.04, DECK.d / 2 + 0.02);
  group.add(lip);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.32), glow(color(BEAM_COLORS[i % 4]), 1.0));
    m.position.set(-13.2 + i * 2.4, DECK.h * 0.5, DECK.d / 2 + 0.01);
    group.add(m);
  }

  // ── 철골: 큰 탑 둘 (오두막) · 작은 탑 둘 · 위 트러스 · 보조 전광판 다리
  const BIG = { x: 10.6, z: -3.2, w: 3.0, h: 15 }, SMALL = { x: 20.6, z: -2.6, w: 2.4, h: 9.6 };
  for (const sx of [-1, 1]) {
    tower(bars, sx * BIG.x, BIG.z, BIG.w, BIG.h);
    tower(bars, sx * SMALL.x, SMALL.z, SMALL.w, SMALL.h, 1.6);
    cabin(group, sx * BIG.x, BIG.z, BIG.h, 3.8, 2.4);
    cabin(group, sx * SMALL.x, SMALL.z, SMALL.h, 3.0, 2.0);
    // 보조 전광판 다리 (땅에서 전광판 아래까지) + 큰 탑과 잇는 가로대
    for (const ex of [-1, 1]) bars.add(V(sx * SIDE.x + ex * SIDE.w * 0.42, 0, SIDE.z - 0.3), V(sx * SIDE.x + ex * SIDE.w * 0.42, SIDE.y + SIDE.h / 2 + 0.3, SIDE.z - 0.3), 0.08);
    bars.add(V(sx * (BIG.x + BIG.w / 2), SIDE.y + SIDE.h / 2 + 0.3, SIDE.z - 0.3), V(sx * (SMALL.x - SMALL.w / 2), SIDE.y + SIDE.h / 2 + 0.3, SIDE.z - 0.3), 0.06);
  }
  // 위 트러스: 큰 탑 사이 네모 단면 (0.8m) 가로 트러스
  {
    const x0 = -BIG.x + BIG.w / 2, x1 = BIG.x - BIG.w / 2, hw = 0.4;
    const ch = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    for (const [dy, dz] of ch) bars.add(V(x0, TRUSS_Y + dy, TRUSS_Z + dz), V(x1, TRUSS_Y + dy, TRUSS_Z + dz), 0.07);
    for (let x = x0, k = 0; x < x1 - 0.01; x += 0.8, k++) {
      const x2 = Math.min(x1, x + 0.8);
      for (let i = 0; i < 4; i++) {
        const [ay, az] = ch[i], [by, bz] = ch[(i + 1) % 4];
        bars.add(V(x2, TRUSS_Y + ay, TRUSS_Z + az), V(x2, TRUSS_Y + by, TRUSS_Z + bz), 0.035);
        bars.add(V(x, TRUSS_Y + (k % 2 ? ay : by), TRUSS_Z + (k % 2 ? az : bz)), V(x2, TRUSS_Y + (k % 2 ? by : ay), TRUSS_Z + (k % 2 ? bz : az)), 0.03);
      }
    }
  }
  group.add(bars.mesh(steel));

  // ── 기와 지붕 (트러스 위 맞배지붕)
  for (const s of [-1, 1]) group.add(plank(2 * BIG.x - 1.2, 0.18, 3.8, 'stage.roof', { y: TRUSS_Y + 1.55, z: TRUSS_Z + s * 1.7, rx: s * 0.3, shadow: true }));
  group.add(plank(2 * BIG.x - 1.2, 0.2, 0.24, 'wood.dark', { y: TRUSS_Y + 2.1, z: TRUSS_Z }));

  // ── 전광판: 뒤 가림막 · 테두리 · 화면
  const back = new THREE.Mesh(new THREE.BoxGeometry(MAIN.w + 2.6, TRUSS_Y - DECK.h - 0.6, 0.3), frame);
  back.position.set(0, DECK.h + (TRUSS_Y - DECK.h - 0.6) / 2, MAIN.z - 0.6);
  group.add(back);
  const screenMat = () => new THREE.MeshBasicMaterial({ color: color('stage.screen'), toneMapped: false });
  const mkScreen = (w, h, x, y, z) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), frame);
    f.position.set(x, y, z - 0.18);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat());
    s.position.set(x, y, z);
    group.add(f, s);
    return s;
  };
  const screens = {
    main: mkScreen(MAIN.w, MAIN.h, 0, MAIN.y, MAIN.z),
    left: mkScreen(SIDE.w, SIDE.h, -SIDE.x, SIDE.y, SIDE.z),
    right: mkScreen(SIDE.w, SIDE.h, SIDE.x, SIDE.y, SIDE.z),
  };
  for (const s of Object.values(screens)) s.userData.ds = 'arena-screen';

  // ── 스피커 기둥 (큰 탑 안쪽) · 바닥 우퍼
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.4, 1.0), frame);
    col.position.set(sx * 8.4, DECK.h + 4.6, -2.3); col.castShadow = true;
    group.add(col);
    for (let i = 0; i < 6; i++) {
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), toon(color('stage.deck')));
      cone.position.set(sx * 8.4, DECK.h + 2.0 + i * 1.04, -1.79);
      group.add(cone);
    }
    for (const dx of [0, 1.3]) group.add(plank(1.2, 1.0, 1.0, 'stage.frame', { x: sx * (12.6 + dx), y: DECK.h + 0.5, z: 4.4, shadow: true }));
  }

  // ── 이름 현수막 (트러스 앞)
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.5), new THREE.MeshBasicMaterial({ map: textTexture('🔥 불멍 아레나', { w: 1024, h: 160, size: 92, bg: color('stage.deck'), fg: color('stage.amber'), border: color('stage.amber') }), toneMapped: false }));
  banner.position.set(0, TRUSS_Y - 1.05, TRUSS_Z + 0.48);
  group.add(banner);

  // ── 깃발 줄: 큰 탑 사이로 늘어진 세모 깃발 (색은 인스턴스마다)
  const flagN = 26;
  const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.5, 3), toon('#ffffff', { side: THREE.DoubleSide }), flagN);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), fs = new THREE.Vector3(1, 1, 0.2);
  for (let i = 0; i < flagN; i++) {
    const u = (i + 0.5) / flagN, x = -BIG.x + 1.5 + u * (2 * BIG.x - 3);
    fm.compose(V(x, TRUSS_Y - 0.55 - Math.sin(u * Math.PI) * 0.9, TRUSS_Z + 0.75), fq, fs);
    flags.setMatrixAt(i, fm);
    flags.setColorAt(i, new THREE.Color(color(FLAG_COLORS[i % 4])));
  }
  group.add(flags);

  // ── 무빙 라이트: 트러스 아래 조명 8개 + 빛줄기 (위가 진하고 끝으로 사라지는 원뿔)
  const alpha = beamAlpha();
  const beamGeo = new THREE.ConeGeometry(2.0, 18, 18, 1, true);
  beamGeo.translate(0, -9, 0); // 꼭짓점(위)이 조명에 오게: 꼭짓점 y=0, 넓은 끝 y=-18
  const beams = [];
  for (let i = 0; i < 8; i++) {
    const x = -7 + i * 2;
    const head = plank(0.45, 0.4, 0.45, 'stage.frame', { x, y: TRUSS_Y - 0.65, z: TRUSS_Z + 0.2 });
    group.add(head);
    const piv = new THREE.Group();
    piv.position.set(x, TRUSS_Y - 0.85, TRUSS_Z + 0.2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color(BEAM_COLORS[i % 4])), alphaMap: alpha, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const cone = new THREE.Mesh(beamGeo, mat);
    cone.userData.ds = 'arena-beam';
    piv.add(cone);
    group.add(piv);
    beams.push({ piv, mat, ph: i * 0.9, side: i < 4 ? -1 : 1 });
  }

  let e = 0, lastT = null;
  return {
    group,
    screens,
    update(t, { energy = 0 } = {}) {
      // 곡이 없으면: 아래를 은은하게 비추며 아주 천천히 흔들린다
      // 곡이 나오면: 8초마다 무대 패턴이 바뀐다 (관객 쪽 쓸기 · 부채꼴 · 엇갈리기 · 물결 · 무대 바닥) — 바뀔 땐 2~3초에 걸쳐 부드럽게
      // 깜빡임 · 빠른 회전 없음 (어지럼 · 광과민성 안전). 속도는 바꾸지 않고 위상만 쌓아서 곡 시작 · 끝에 휙 돌지 않는다
      const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      e += (energy - e) * Math.min(1, dt * 0.6);
      const P = Math.floor(t / 8) % 5, n = beams.length;
      beams.forEach((b, i) => {
        b.p = (b.p ?? b.ph) + dt * (0.12 + 0.18 * e);
        const u = i / (n - 1) - 0.5; // -0.5 (왼쪽) ~ 0.5 (오른쪽)
        let px = -0.6, pz = b.side * 0.12; // 쉴 때: 객석 쪽으로 살짝
        if (e > 0.3) {
          if (P === 0) { px = -1.15 + 0.12 * Math.sin(b.p); pz = Math.sin(b.p * 0.8 + u * 3) * 0.55; }        // 관객 쪽으로 쓸기
          else if (P === 1) { px = -0.75; pz = u * 1.5 + Math.sin(b.p) * 0.08; }                                // 부채꼴로 펼치기
          else if (P === 2) { px = -0.85; pz = -u * 1.1 + Math.sin(b.p * 0.7) * 0.1; }                          // 서로 엇갈리기
          else if (P === 3) { px = -0.9 + 0.25 * Math.sin(b.p * 1.2 + i * 0.6); pz = Math.sin(b.p + i * 0.6) * 0.35; } // 물결
          else { px = -0.25; pz = u * 0.5; }                                                                     // 무대 바닥 비추기
        }
        const kk = Math.min(1, dt * 0.9); // 천천히 따라간다
        b.piv.rotation.x += (px + 0.04 * Math.sin(b.p * 1.3) - b.piv.rotation.x) * kk;
        b.piv.rotation.z += (pz - b.piv.rotation.z) * kk;
        b.mat.opacity = 0.045 + 0.075 * e + 0.012 * Math.sin(b.p * 1.3);
      });
    },
    setTheme() {},
    colliders: [],
    seats: [],
  };
}
