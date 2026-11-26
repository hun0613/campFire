// 🎤 불멍 아레나 (v1.23): 캠핑장에서 멀리 떨어진 페스티벌 무대 · 객석 마당 · 무대 신청 부스 + 광장 승강장 + 오가는 열기구
// - 무대 · 열기구 · 부스 · 승강장 모양은 요소 파일(src/elements)에. 여기는 놓기 · 전광판 글 · 열기구 움직임 · 보이기/숨기기만
// - 아레나는 캠핑장과 같은 월드의 먼 자리 (z ≈ 330). 캠핑장에 있을 땐 아레나를, 아레나에 있을 땐 캠핑장을 숨겨 그리기를 줄인다
// - 전광판: 곡이 나오면 가운데 화면에 영상 구멍 (music.js 가 유튜브를 뒤에 붙인다), 아니면 다음 무대 안내 그림
import * as THREE from 'three';
import { toon, glow, mulberry32 } from './toon.js';
import { ARENA, BALLOON, TT_SIGN, balloonState, basketSlot, rideOf } from '../shared/config.js';
import { create as createTimetableSign } from './elements/molecules/timetable-sign.js';
import { create as createStage, DECK, MAIN, SIDE } from './elements/organisms/arena-stage.js';
import { textStrip } from './marquee.js';
import { create as createBalloon, FLOOR as BASKET_FLOOR, VARIANTS as BALLOON_LOOKS } from './elements/molecules/hot-air-balloon.js';
import { create as createBooth } from './elements/molecules/festival-booth.js';
import { create as createDock } from './elements/molecules/balloon-dock.js';
import { create as createLogPile } from './elements/molecules/log-pile.js';
import { tag } from './ds/tag.js';
import { buildSkyRoute } from './skyroute.js';

const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false, fog: false });
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 한국 시간 「11/30(일) 21:00」 */
export function kstWhen(ms, { day = true } = {}) {
  const d = new Date(ms + 9 * 3600e3);
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return day ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEK[d.getUTCDay()]}) ${hm}` : hm;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** 요소를 월드 자리에 놓고, 요소의 부딪힘 원을 월드 좌표로 */
function put(parent, el, x, z, ry = 0, colliders) {
  el.group.position.set(x, 0, z);
  el.group.rotation.y = ry;
  parent.add(el.group);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const o of el.colliders || []) colliders?.push({ x: x + o.x * c + o.z * s, z: z - o.x * s + o.z * c, r: o.r });
  return el;
}

export class Arena {
  constructor(scene, { lowSpec = false } = {}) {
    this.scene = scene;
    this.colliders = [];      // 걷는 길을 막는 것 (월드 좌표)
    this.lightSpots = [];
    this.root = new THREE.Group(); // 아레나 쪽 (캠핑장에 있을 땐 숨긴다)
    this.root.userData.ds = 'arena';
    scene.add(this.root);

    // ── 바닥: 페스티벌 잔디 마당 + 무대 앞 흙바닥 + 승강장까지 흙길
    // 땅 색은 테마(풀밭 · 젖은 땅 · 눈)에 따라 바뀐다 — 다른 곳과 나눠 쓰지 않게 재질을 따로 만든다
    this.groundMats = { lawn: toon('#4d8a46', {}), pit: toon('#7d6650', {}), aisle: toon('#8c7458', {}) };
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.bounds.maxX - ARENA.bounds.minX + 40, ARENA.bounds.maxZ - ARENA.bounds.minZ + 56), this.groundMats.lawn);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(ARENA.x, 0.005, (ARENA.bounds.minZ + ARENA.bounds.maxZ) / 2 - 8);
    lawn.receiveShadow = true;
    tag(lawn, 'arena-ground');
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(56, 9), this.groundMats.pit);
    pit.rotation.x = -Math.PI / 2; pit.position.set(ARENA.x, 0.012, ARENA.stage.z + DECK.d / 2 + 4.6);
    tag(pit, 'arena-ground');
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(4, ARENA.dock.z - 330), this.groundMats.aisle);
    aisle.rotation.x = -Math.PI / 2; aisle.position.set(ARENA.x, 0.01, (ARENA.dock.z + 330) / 2);
    tag(aisle, 'arena-ground');
    this.root.add(lawn, pit, aisle);

    // ── 숲 울타리: 마당을 둘러싼 침엽수 (인스턴스, 무대 뒤는 비운다)
    {
      const rnd = mulberry32(91);
      const list = [];
      for (let i = 0; i < (lowSpec ? 60 : 95); i++) {
        const a = rnd() * Math.PI * 2, r = 52 + rnd() * 26;
        const x = ARENA.x + Math.sin(a) * r * 1.05, z = ARENA.z + 8 + Math.cos(a) * r * 0.95;
        if (z < ARENA.stage.z + 2 && Math.abs(x) < 30) continue;
        list.push({ x, z, s: 0.8 + rnd() * 0.7 });
      }
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6), toon('#5a3d28'), list.length);
      const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 7.5, 7), toon('#2f5a37'), list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      list.forEach((t, i) => {
        trunk.setMatrixAt(i, m.compose(p.set(t.x, 1.1 * t.s, t.z), q, s.setScalar(t.s)));
        crown.setMatrixAt(i, m.compose(p.set(t.x, (2.2 + 3.75) * t.s, t.z), q, s.setScalar(t.s)));
      });
      // 설산 · 크리스마스: 나무 위에 쌓인 눈 (평소엔 숨김)
      const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 3.2, 7), toon('#f4f7fd', { emissive: new THREE.Color('#2a3350'), emissiveIntensity: 0.35 }), list.length);
      list.forEach((t, i) => caps.setMatrixAt(i, m.compose(p.set(t.x, (2.2 + 5.6) * t.s, t.z), q, s.setScalar(t.s))));
      caps.visible = false;
      this.snowCaps = caps;
      tag(trunk, 'arena-trees'); tag(crown, 'arena-trees'); tag(caps, 'arena-trees');
      this.root.add(trunk, crown, caps);
    }

    // ── 마당 둘레 전구 줄: 기둥 사이로 늘어진 알록달록 전구 (빛나는 재질, 인스턴스)
    {
      const B = ARENA.bounds, posts = [];
      for (let x = B.minX; x <= B.maxX + 0.1; x += 12.7) posts.push([x, B.maxZ + 1.5]);
      for (let z = B.maxZ + 1.5 - 13; z > B.minZ + 4; z -= 13) { posts.push([B.minX - 1.5, z]); posts.push([B.maxX + 1.5, z]); }
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), toon('#3b3229'), posts.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      posts.forEach(([x, z], i) => pole.setMatrixAt(i, m.compose(p.set(x, 2.1, z), q, one)));
      tag(pole, 'arena-lights');
      // 줄: 남쪽 끝 기둥들 사이 + 양옆 기둥 줄을 따라
      const lines = [];
      const south = posts.filter(([, z]) => z > B.maxZ);
      for (let i = 0; i < south.length - 1; i++) lines.push([south[i], south[i + 1]]);
      for (const side of [B.minX - 1.5, B.maxX + 1.5]) {
        const col = posts.filter(([x]) => x === side).sort((a, b) => a[1] - b[1]);
        for (let i = 0; i < col.length - 1; i++) lines.push([col[i], col[i + 1]]);
      }
      const bulbs = [];
      const tones = ['#ffd9a0', '#ffcf85', '#ffe6c2', '#ffb877']; // 전구도 무대 조명과 같은 따뜻한 한 톤
      for (const [a, b] of lines) for (let k = 1; k < 9; k++) {
        const u = k / 9;
        bulbs.push({ x: a[0] + (b[0] - a[0]) * u, y: 4.0 - Math.sin(u * Math.PI) * 0.9, z: a[1] + (b[1] - a[1]) * u, c: tones[bulbs.length % tones.length] });
      }
      const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length);
      bulbs.forEach((o, i) => { bm.setMatrixAt(i, m.compose(p.set(o.x, o.y, o.z), q, one)); bm.setColorAt(i, new THREE.Color(o.c).multiplyScalar(2.4)); });
      tag(bm, 'arena-lights');
      this.root.add(pole, bm);
      this.bulbs = { mesh: bm, warm: bulbs.map((o) => new THREE.Color(o.c).multiplyScalar(2.4)), xmas: bulbs.map((o, i) => new THREE.Color(['#ff3b3b', '#ffd23b', '#3bff6e', '#3bb8ff', '#ff7ad9'][i % 5]).multiplyScalar(2.6)) };
    }

    // ── 무대 · 페스티벌 가루 부스 · 아레나 승강장 (요소)
    this.stage = put(this.root, createStage(), ARENA.stage.x, ARENA.stage.z, 0);
    this.booth = put(this.root, createBooth({ variant: 'powder' }), ARENA.booth.x, ARENA.booth.z, ARENA.booth.ry, this.colliders);
    this.arenaDock = put(this.root, createDock({ title: '🎈 캠핑장행 열기구' }), BALLOON.arena.x, BALLOON.arena.z, Math.PI, this.colliders);
    // 📦 아레나 창고지기 자리: 장작더미 둘 + 나무 매대 (창고지기 캐릭터는 main.js 가 이 자리에 세운다)
    {
      const K = ARENA.keeper, g = new THREE.Group();
      g.position.set(K.x, 0, K.z); g.rotation.y = K.ry;
      g.userData.ds = 'arena-woodstand';
      for (const x of [-1.5, 1.5]) { const p = createLogPile(); p.group.position.set(x, 0, -1.1); g.add(p.group); }
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.6), toon('#8b5a35'));
      counter.position.set(0, 0.45, 0.9); counter.castShadow = true;
      g.add(counter);
      this.root.add(g);
      const c = Math.cos(K.ry), sn = Math.sin(K.ry);
      for (const [lx, lz, r] of [[-1.5, -1.1, 0.6], [1.5, -1.1, 0.6], [-0.6, 0.9, 0.5], [0.6, 0.9, 0.5]]) this.colliders.push({ x: K.x + lx * c + lz * sn, z: K.z - lx * sn + lz * c, r });
      this.lightSpots.push({ pos: new THREE.Vector3(K.x + Math.sin(K.ry) * 2.6, 1.8, K.z + Math.cos(K.ry) * 2.6), color: new THREE.Color('#ffc98a'), intensity: 3, distance: 9 });
    }
    // 무대 앞을 비추는 빛 (조명 풀이 가까울 때만 켠다)
    for (const x of [-8, 8]) this.lightSpots.push({ pos: new THREE.Vector3(ARENA.stage.x + x, 4, ARENA.stage.z + DECK.d / 2 + 3), color: new THREE.Color('#ffc98a'), intensity: 12, distance: 26 });
    this.lightSpots.push({ pos: new THREE.Vector3(ARENA.booth.x + Math.sin(ARENA.booth.ry) * 2.6, 1.8, ARENA.booth.z + Math.cos(ARENA.booth.ry) * 2.6), color: new THREE.Color('#ffc98a'), intensity: 3, distance: 9 });

    // ── 캠핑장 쪽: 광장 승강장 (늘 보인다)
    this.campDock = put(scene, createDock({ title: '🎈 아레나행 열기구' }), BALLOON.camp.x, BALLOON.camp.z, Math.PI, this.colliders);
    this.ttSign = put(scene, createTimetableSign(), TT_SIGN.x, TT_SIGN.z, TT_SIGN.ry, this.colliders); // 🎤 타임테이블 팻말 (v1.23.1)
    this.applyBooth = put(this.root, createBooth({ variant: 'apply' }), ARENA.apply.x, ARENA.apply.z, ARENA.apply.ry, this.colliders); // 🎤 무대 신청 (아레나)
    this.lightSpots.push({ pos: new THREE.Vector3(ARENA.apply.x + Math.sin(ARENA.apply.ry) * 2.6, 1.8, ARENA.apply.z + Math.cos(ARENA.apply.ry) * 2.6), color: new THREE.Color('#ffc98a'), intensity: 3, distance: 9 });
    this.campLight = { pos: new THREE.Vector3(BALLOON.camp.x, 2.4, BALLOON.camp.z), color: new THREE.Color('#ffc98a'), intensity: 3, distance: 9 }; // 광장 승강장 불빛

    // ── 열기구 (양쪽을 오간다)
    // 두 대가 엇갈려 오간다 (노을 줄무늬 · 페스티벌 줄무늬)
    this.balloons = Array.from({ length: BALLOON.fleet }, (_, k) => {
      const el = createBalloon({ stripes: BALLOON_LOOKS[k % BALLOON_LOOKS.length].stripes });
      scene.add(el.group);
      return { el, b: balloonState(0, k), spin: k * 2.1, tilt: new THREE.Vector2() };
    });
    this.balloon = this.balloons[0].el; // (실험실 · 예전 코드 호환)
    this.route = buildSkyRoute(scene); // 🎈 하늘길 볼거리 (탔을 때만 보인다)
    this.b = this.balloons[0].b;

    // ── 전광판: 안내 그림 (캔버스) · 영상 구멍
    const S = this.stage.screens;
    this.infoCv = document.createElement('canvas'); this.infoCv.width = 1024; this.infoCv.height = 576;
    this.infoTex = new THREE.CanvasTexture(this.infoCv); this.infoTex.colorSpace = THREE.SRGBColorSpace;
    this.infoMat = new THREE.MeshBasicMaterial({ map: this.infoTex, toneMapped: false, fog: false });
    S.main.material = this.infoMat;
    this.sideCv = document.createElement('canvas'); this.sideCv.width = 512; this.sideCv.height = 288;
    this.sideTex = new THREE.CanvasTexture(this.sideCv); this.sideTex.colorSpace = THREE.SRGBColorSpace;
    const sideMat = new THREE.MeshBasicMaterial({ map: this.sideTex, toneMapped: false, fog: false });
    S.left.material = sideMat; S.right.material = sideMat;
    // 🎞️ 긴 곡 제목은 흐르게 (v1.23.1): 제목 줄만 투명한 글자 띠로 전광판 위에 얹는다 (큰 그림은 30초에 한 번만 다시 그린다)
    this.mainTitle = textStrip({ w: MAIN.w * 0.92, h: MAIN.h * 92 / 576, px: 942, py: 92, font: '52px Moneygraphy, sans-serif' });
    this.mainTitle.mesh.position.z = 0.02;
    S.main.add(this.mainTitle.mesh);
    this.sideTitles = [0, 1, 2, 3].map((i) => {
      const st = textStrip({ w: SIDE.w * 276 / 512, h: SIDE.h * 46 / 288, px: 552, py: 92, font: '48px Moneygraphy, sans-serif', align: 'left' });
      const y = (0.5 - (98 + i * 50) / 288) * SIDE.h, x = ((228 + 138) / 512 - 0.5) * SIDE.w;
      st.mesh.position.set(x, y, 0.02);
      const twin = new THREE.Mesh(st.mesh.geometry, st.mesh.material); twin.position.copy(st.mesh.position); twin.renderOrder = 2;
      S.left.add(st.mesh); S.right.add(twin);
      return st;
    });
    this.screenW = MAIN.w;
    this.show = null; this.table = [];
    this._info = '';
    this.extraVisible = []; // 아레나와 함께 숨기고 보일 것 (객석 모닥불 등, main.js 가 넣는다)
    this.zoneShown = null;
  }

  /** 🌦️ 테마 (캠핑장과 같은 템플릿): 땅 색 · 나무 위 눈 · 전구 색 · 크리스마스 트리 · 하늘길 */
  setTheme(th, xmasTree) {
    const g = th.ground || 'grass';
    const C = { grass: ['#4d8a46', '#7d6650', '#8c7458'], wet: ['#2f5a36', '#4f3e31', '#5f4b3a'], snow: ['#dfe6f1', '#e8edf5', '#cfd8e6'] }[g] || ['#4d8a46', '#7d6650', '#8c7458'];
    this.groundMats.lawn.color.set(C[0]); this.groundMats.pit.color.set(C[1]); this.groundMats.aisle.color.set(C[2]);
    this.snowCaps.visible = g === 'snow';
    const xmas = th.decor === 'christmas';
    const B = this.bulbs; (xmas ? B.xmas : B.warm).forEach((c, i) => B.mesh.setColorAt(i, c)); B.mesh.instanceColor.needsUpdate = true;
    // 크리스마스: 캠핑장 광장 트리와 같은 트리 둘 (무대 양옆 앞)
    if (xmas && !this.xmasTrees && xmasTree) {
      // (캠핑장 크리스마스 묶음엔 작은 트리 · 텐트 장식도 들어 있어서, 이름표가 없는 큰 트리 부분만 골라 복제한다)
      const bigParts = xmasTree.children.filter((c) => c.userData.ds == null || c.userData.ds === 'xmas-tree');
      this.xmasTrees = [[-32, 310], [32, 310]].map(([x, z]) => {
        const t = new THREE.Group();
        for (const c of bigParts) t.add(c.clone(true));
        t.position.set(x, 0, z); t.scale.setScalar(1.15); t.userData.ds = 'arena-xmas-tree'; this.root.add(t); return t;
      });
      for (const [x, z] of [[-32, 310], [32, 310]]) this.colliders.push({ x, z, r: 2.6 });
    }
    for (const t of this.xmasTrees || []) t.visible = xmas;
    this.route.setTheme?.(th);
  }

  // ---------------------------------------------------------------- music.js 가 쓰는 전광판 (Monitor 와 같은 모양)
  setHole(on) { this.stage.screens.main.material = on ? HOLE : this.infoMat; this.mainTitle.mesh.visible = !on; } // 영상이 나오면 제목 띠도 숨긴다
  screenPose(outPos, outQuat) {
    const s = this.stage.screens.main;
    s.updateWorldMatrix(true, false);
    s.getWorldPosition(outPos);
    s.getWorldQuaternion(outQuat);
  }

  /** 서버가 알려 준 무대 상태 */
  setState({ show, table }) { this.show = show || null; this.table = table || []; this._info = ''; }

  /** 다음 무대 (지금 하는 무대 빼고) */
  next(now) { return this.table.find((e) => e.at > now && (!this.show || e.id !== this.show.id)) || null; }

  #drawInfo(now) {
    const show = this.show && now >= this.show.startedAt ? this.show : null;
    const nx = this.next(now);
    const key = `${show?.id || ''}|${nx?.id || ''}|${Math.floor(now / 30000)}`;
    if (key === this._info) return;
    this._info = key;
    const g = this.infoCv.getContext('2d'), W = 1024, H = 576;
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#2a1446'); grd.addColorStop(0.55, '#4a1f5e'); grd.addColorStop(1, '#14284a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffb347'; g.font = '64px Moneygraphy, sans-serif';
    g.fillText('🔥 불멍 아레나', W / 2, 96);
    g.fillStyle = '#fff1d8';
    const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
    const title = (text, y, c = '#fff1d8') => { this.mainTitle.set(text, c); this.mainTitle.mesh.position.y = (0.5 - y / 576) * MAIN.h; }; // 흐르는 제목 띠
    if (show) {
      g.font = '44px Moneygraphy, sans-serif'; g.fillText('지금 무대', W / 2, 220);
      title(`「${show.title}」`, 300);
      g.font = '36px Moneygraphy, sans-serif'; g.fillText(`🎤 ${show.byName}`, W / 2, 380);
    } else if (nx) {
      g.font = '40px Moneygraphy, sans-serif'; g.fillText('다음 무대', W / 2, 205);
      g.fillStyle = '#ff9ad8'; g.font = '58px Moneygraphy, sans-serif'; g.fillText(kstWhen(nx.at), W / 2, 285);
      g.fillStyle = '#fff1d8'; title(`「${nx.title}」`, 365);
      g.font = '32px Moneygraphy, sans-serif'; g.fillText(`🎤 ${nx.by}${nx.msg ? ` · ${clip(nx.msg, 24)}` : ''}`, W / 2, 430);
    } else {
      title('', 0);
      g.font = '46px Moneygraphy, sans-serif'; g.fillText('오늘은 조용한 불멍 무대', W / 2, 250);
      g.font = '32px Moneygraphy, sans-serif'; g.fillText('승강장 앞 「🎤 무대 신청」 부스에서 내 노래를 무대에 올려 보세요', W / 2, 330);
    }
    g.fillStyle = 'rgba(255,241,216,0.65)'; g.font = '26px Moneygraphy, sans-serif';
    g.fillText('객석 모닥불에 앉아 함께 들어요 · ✦ 페스티벌 가루는 뒤쪽 부스에서', W / 2, 520);
    this.infoTex.needsUpdate = true;
  }
  #drawSide(now) {
    const key = `${this.show?.id || ''}|${this.table.length}|${Math.floor(now / 30000)}`;
    if (key === this._side) return;
    this._side = key;
    const g = this.sideCv.getContext('2d'), W = 512, H = 288;
    g.fillStyle = '#1a1030'; g.fillRect(0, 0, W, H);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = '#5cf0ff'; g.font = '30px Moneygraphy, sans-serif'; g.fillText('TIMETABLE', 28, 40);
    const rows = this.table.slice(0, 4);
    g.font = '24px Moneygraphy, sans-serif';
    if (!rows.length) { g.fillStyle = '#fff1d8'; g.fillText('아직 잡힌 무대가 없어요', 28, 120); }
    rows.forEach((e, i) => {
      const live = this.show?.id === e.id;
      g.fillStyle = live ? '#ff9ad8' : '#ffb347'; g.fillText(live ? 'NOW' : kstWhen(e.at), 28, 98 + i * 50);
    });
    this.sideTitles.forEach((st, i) => st.set(rows[i]?.title || '')); // 제목은 흐르는 글자 띠로
    this.sideTex.needsUpdate = true;
  }

  /** 이 승강장(side) 기준 가장 빠른 열기구: 내려앉아 있으면 출발까지, 아니면 도착까지 (초) */
  #soonest(side) {
    const dwell = BALLOON.back - BALLOON.fly; // 한쪽에 머무는 시간
    let best = null;
    for (const { b } of this.balloons) {
      if (b.at === side) return { mode: 'go', sec: b.next };
      const sec = !b.at && b.to === side ? (1 - b.u) * BALLOON.fly : b.at ? b.next + BALLOON.fly : (1 - b.u) * BALLOON.fly + dwell + BALLOON.fly;
      if (!best || sec < best.sec) best = { mode: 'come', sec, flying: !b.at && b.to === side };
    }
    return best;
  }
  /** 전광판 정보: { head, mode: 'go'(출발까지) | 'come'(도착까지), sec } */
  timeInfo(side) {
    return { head: side === 'camp' ? '아레나행 열기구' : '캠핑장행 열기구', ...this.#soonest(side) };
  }
  /** 화면 안내 글: [제목, 남은 시간, 한 줄 설명] */
  timeText(side) {
    const head = side === 'camp' ? '🎈 아레나행 열기구' : '🎈 캠핑장행 열기구', s = this.#soonest(side);
    if (s.mode === 'go') return [head, `${mmss(s.sec)} 뒤 출발`, '바구니에 다가가 타요'];
    return [head, s.flying ? `도착까지 ${mmss(s.sec)}` : `${mmss(s.sec)} 뒤 도착`, '1분마다 출발해요'];
  }

  /** 탄 자리(r = 열기구 × 정원 + 자리) → 바구니 안 발 자리 (열기구의 기울기 · 회전을 따른다) */
  riderPos(r, out) {
    const { k, slot } = rideOf(r), sl = basketSlot(slot), g = this.balloons[k].el.group;
    g.updateMatrixWorld();
    return out.set(sl.x, BASKET_FLOOR, sl.z).applyMatrix4(g.matrixWorld);
  }
  /** 탄 사람이 보는 방향 (바깥 풍경) */
  riderRy(r) { const { k, slot } = rideOf(r); return basketSlot(slot).ry + this.balloons[k].el.group.rotation.y; }
  /** 탄 자리의 열기구 상태 */
  rideState(r) { return this.balloons[rideOf(r).k].b; }
  /** 이 승강장에 내려앉아 있는 열기구 상태 (없으면 가장 빨리 오는 쪽) */
  dockState(zone) {
    const here = this.balloons.find((x) => x.b.at === zone);
    if (here) return here.b;
    const s = this.#soonest(zone);
    return { ...this.balloons[0].b, at: null, next: s.sec, to: zone };
  }

  /** 캠핑장 · 아레나 중 어디를 그릴지 (riding: 열기구에서는 둘 다) */
  setZone(zone, riding, hideCamp) {
    const key = `${zone}|${riding}`;
    if (key === this.zoneShown) return;
    this.zoneShown = key;
    const arenaOn = zone === 'arena' || riding;
    this.root.visible = arenaOn;
    this.route.group.visible = !!riding;
    for (const o of this.extraVisible) o.visible = arenaOn;
    hideCamp?.(zone === 'arena' && !riding);
  }

  update(dt, t, now, { energy = 0, zone = 'camp', ride = null } = {}) {
    // 열기구: 서버 시각표대로 (두 대). 기울기는 실제 움직임의 가속도에서 — 출발할 땐 뒤로, 설 땐 앞으로 살짝 기운다 (바구니가 매달린 느낌)
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    this.balloons.forEach((B, k) => {
      const b = balloonState(now, k);
      B.b = b;
      const g = B.el.group;
      const bob = b.at ? 0 : Math.sin(t * 0.9 + k) * 0.25; // 공중에서 살짝 출렁
      g.position.set(b.x, b.y + (b.at ? 0.16 : 0) + bob, b.z);
      const h = 0.35;
      const a = balloonState(now - h * 1000, k), c = balloonState(now + h * 1000, k);
      p0.set(a.x, a.y, a.z); p1.set(b.x, b.y, b.z); p2.set(c.x, c.y, c.z);
      const ax = (p2.x - 2 * p1.x + p0.x) / (h * h), az = (p2.z - 2 * p1.z + p0.z) / (h * h);
      const want = new THREE.Vector2(THREE.MathUtils.clamp(az * 0.02, -0.12, 0.12), THREE.MathUtils.clamp(-ax * 0.02, -0.12, 0.12));
      B.tilt.lerp(want, Math.min(1, dt * 1.5)); // 늦게 따라와 흔들리는 느낌
      const sway = b.at ? 0.008 : 0.025;
      B.spin += dt * (b.at ? 0.01 : 0.05); // 날 때는 천천히 돈다
      g.rotation.set(B.tilt.x + Math.sin(t * 0.7 + k) * sway, B.spin, B.tilt.y + Math.cos(t * 0.6 + k) * sway);
      // 버너: 떠오를 때 세게 · 높이 떠 있을 땐 가끔 · 내려앉을 땐 약하게
      const rising = !b.at && b.u < 0.34, gust = Math.max(0, Math.sin(t * 0.8 + k * 2)) ** 6;
      B.el.update(t, { burn: b.at ? (b.next < 6 ? 0.7 : 0.12) : rising ? 1 : b.u > 0.7 ? 0.15 : 0.3 + 0.6 * gust });
    });
    this.b = ride != null ? this.rideState(ride) : this.dockState(zone);
    this.route.update(dt, t, ride != null ? this.b : null);
    // 시각판
    const boardFor = (side) => this.timeInfo(side);
    this.campDock.setBoard(boardFor('camp'));
    if (zone === 'camp' && (this._ttT = (this._ttT || 0) - dt) <= 0) { // 팻말: 1초에 한 번 (바뀐 게 없으면 다시 그리지 않는다)
      this._ttT = 1;
      this.ttSign.setRows(this.table.slice(0, 4).map((e) => ({ when: kstWhen(e.at), title: e.title, live: this.show?.id === e.id && now >= e.at })));
    }
    this.arenaDock.setBoard(boardFor('arena'));
    if (this.root.visible) {
      this.stage.update(t, { energy });
      this.#drawInfo(now);
      this.#drawSide(now);
      this.mainTitle.update(dt);
      for (const st of this.sideTitles) st.update(dt);
    }
  }
}
