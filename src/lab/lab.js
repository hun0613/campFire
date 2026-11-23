// 불멍 디자인 시스템 (실험실): 게임과 똑같이 월드를 만든 뒤, 이름표(userData.ds)로 요소를 골라 따로 · 조합해서 본다
// 목록은 src/ds/catalog.js (아토믹 단계). 디자인 점검(괜찮음 / 검토 필요 / 디자인 필요 + 메모)은 노션 현황판에 남긴다 (로컬 서버에서만)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRender } from '../render.js';
import { buildWorld } from '../world.js';
import { FirePit } from '../fire.js';
import { Monitor } from '../monitor.js';
import { GuestbookStand } from '../guestbook.js';
import { NoticeBoard } from '../board.js';
import { TentInterior } from '../tent.js';
import { Woodcut, makeLog, makeHalf } from '../woodcut.js';
import { LightPool } from '../lightpool.js';
import { Precip } from '../precip.js';
import { Character } from '../character.js';
import { createResidents } from '../residents.js';
import { icon, NORM } from '../icons.js';
import { powderIco } from '../ui.js';
import { PALETTE, PARTS } from '../elements/atoms/index.js';
import { FIRES, PITS, STUMPS, NPC, KEEPER, WOODYARD, GUESTBOOK, BOARD, TENTS, SUNSET, LOUNGE_SEATS, hillHeight, POWDER_EFFECTS, POWDER_COLORS, LEGEND_POWDERS } from '../../shared/config.js';
import { THEMES, themeOf } from '../../shared/themes.js';
import { CATALOG, LEVELS, byId, tagsOf } from '../ds/catalog.js';
import { tagOf } from '../ds/tag.js';
import { createGraph, matchPath, MOLECULES } from './swap.js';

const $ = (id) => document.getElementById(id);
const HIDE = 30; // 숨길 물체를 옮겨 두는 레이어 (카메라는 0번만 본다)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

await Promise.race([document.fonts.load('64px Moneygraphy'), new Promise((r) => setTimeout(r, 2500))]);

// ---------------------------------------------------------------- 게임과 같은 장면
const viewEl = $('labView');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#1a1c44', 40, 150);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
const R = createRender({ scene, camera, lowSpec: false });
viewEl.appendChild(R.renderer.domElement);
const shared = { uTime: { value: 0 }, uScale: { value: 600 } };

const world = buildWorld(scene, { lowSpec: false });
const pits = FIRES.map((d) => new FirePit(d, scene, shared));
const monitors = PITS.map((d) => new Monitor(d, scene));
const woodcut = new Woodcut(scene, STUMPS);
for (const s of world.stumpMeshes) s.log.visible = false;
const gbStand = new GuestbookStand(scene, GUESTBOOK);
const board = new NoticeBoard(scene, BOARD);
const lightSpots = [...world.lightSpots, gbStand.lightSpot, board.lightSpot];
const lampPool = new LightPool(scene, 3);
const firePool = [0, 1, 2, 3].map(() => { const L = new THREE.PointLight('#ff8a3a', 0, 16, 1.5); scene.add(L); return L; });
const tentRoom = new TentInterior(scene, world.tents);
const precip = new Precip(scene, shared, { lowSpec: false });
const npc = new Character({ skin: '#ffe0c7', hair: '#c9a2ff', shirt: '#6a4bb5', pants: '#3a2f5a', hat: 'wizard' }, { name: '루미', kind: 'npc' });
npc.root.position.set(NPC.x, 0, NPC.z); npc.root.rotation.y = NPC.ry; npc.root.userData.ds = 'npc-lumi'; scene.add(npc.root);
const keeper = new Character({ skin: '#f6c9a0', hair: '#6b4a2b', shirt: '#5f8a45', pants: '#5a4330', hat: 'beanie' }, { name: '보리', kind: 'npc' });
keeper.root.position.set(KEEPER.x, 0, KEEPER.z); keeper.root.rotation.y = KEEPER.ry; keeper.root.userData.ds = 'npc-bori'; scene.add(keeper.root);
const residents = createResidents(scene);
tentRoom.set(TENTS.find((t) => t.id === 'ts3') || TENTS[0]); // 텐트 안은 한 동만 보여 준다

// 견본: 게임에서는 잠깐만 생기는 물체 (도끼질할 때 쪼갠 장작, 들어온 이용자). 그 요소를 고를 때만 보인다
const samples = [];
{
  const g = new THREE.Group(); g.position.set(WOODYARD.x + 3.2, 0, WOODYARD.z + 3.6);
  const log = makeLog(); log.position.set(0, 0.45, 0); g.add(log);
  const a = makeHalf(), b = makeHalf(); a.position.set(1.1, 0.2, 0.2); a.rotation.set(0, 0.4, Math.PI / 2); b.position.set(1.5, 0.2, -0.3); b.rotation.set(0, -0.8, -Math.PI / 2); g.add(a, b);
  g.userData.ds = 'split-log'; scene.add(g); samples.push(g);
}
const sampleChars = [
  { skin: '#ffe0c7', hair: '#5a3a28', shirt: '#7fb3d5', pants: '#3d4a6b', hat: 'none' },
  { skin: '#f6c9a0', hair: '#c9772f', shirt: '#f2a7c3', pants: '#3d4a6b', hat: 'straw' },
  { skin: '#e8b48a', hair: '#2a1f1c', shirt: '#79b35a', pants: '#5a4330', hat: 'beanie' },
].map((look, i) => { const ch = new Character(look, { name: '견본' }); ch.root.position.set(-3 + i * 1.6, 0, 6.5); ch.root.rotation.y = 0.15; scene.add(ch.root); samples.push(ch.root); return ch; });
for (const p of PARTS) { // 원자 부품 견본: 바닥 위에 올려 놓는다
  const m = p.make(); m.userData.ds = p.id;
  const bb = new THREE.Box3().setFromObject(m); m.position.set(3, -bb.min.y, 4);
  scene.add(m); samples.push(m);
}
for (const s of samples) s.traverse((o) => { o.userData.labSample = true; });

const controls = new OrbitControls(camera, R.renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = Math.PI * 0.495;

// ---------------------------------------------------------------- 불 · 테마 (게임의 applyTheme 과 같은 순서)
const FIRE_COLOR = new THREE.Color('#ff7a2a');
const lab = { pairOf: new Map(), swap: null, ab: 'after', theme: 'clear', fire: 'lit', mode: 'solo', all: false, ground: true, sel: null, cluster: 0, clusters: [], solo: [], residentNow: null, residentTheme: null, checks: {}, notion: false };
function setFire(kind) {
  lab.fire = kind;
  const now = Date.now();
  for (const p of pits) p.setState(kind === 'lit' ? { state: 'lit', litAt: now - 60000, endsAt: now + 3600000, owner: null, seats: p.seats } : { state: kind === 'stacked' ? 'stacked' : 'empty', litAt: 0, endsAt: 0, owner: null, seats: p.seats });
}
let themeLight = { hemi: 1, ambient: 1, moon: 1 };
const fogTarget = { color: new THREE.Color(scene.fog.color), near: scene.fog.near, far: scene.fog.far };
function setTheme(id) {
  const th = themeOf(id);
  lab.theme = th.id;
  world.setTheme(th); world.sky.setTheme(th); tentRoom.setTheme(th);
  fogTarget.color.set(th.fog.color); fogTarget.near = th.fog.near; fogTarget.far = th.fog.far;
  themeLight = th.light; precip.set(th.precip);
  for (const ch of [npc, keeper, ...sampleChars]) ch.setOutfit(th.outfit);
  residents.setOutfit(th.outfit);
  applyIsolation(); // 테마로 켜지고 꺼지는 물체가 있다
}
setFire('lit');

// ---------------------------------------------------------------- 요소 고르기 (이름표 → 자리 묶음 → 따로 보기)
let renderables = [];
function collectRenderables() { renderables = []; scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isSprite || o.isLine) renderables.push(o); }); }
collectRenderables();
const ENV = new Set(['sky', 'light']); // 늘 보이는 배경
const box = new THREE.Box3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4();

/** 이름표들에 해당하는 「뿌리」: 자기 이름표가 있고 부모는 다른 이름표인 물체. 인스턴스는 하나하나를 뿌리로 */
function rootsOf(tags) {
  const out = [];
  const visibleNow = (o) => { for (let x = o; x; x = x.parent) if (!x.visible && !x.userData.labBefore) return false; return true; };
  const push = (o, part) => {
    if (o.isInstancedMesh && o.count > 1) {
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); v3.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); out.push({ obj: o, index: i, pos: v3.clone(), part }); }
      return;
    }
    o.updateWorldMatrix(true, true);
    box.setFromObject(o);
    const big = box.getSize(v3).length() > 30;
    if (big && o.isPoints) { // 넓게 흩어진 점 구름(반딧불이 등): 첫 점 근처를 보여 준다
      const p = new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position, 0).applyMatrix4(o.matrixWorld);
      out.push({ obj: o, index: -1, pos: p, spot: true, part }); return;
    }
    if (big && !o.isMesh && (o.children.length >= 4 || o.children.some((ch) => ch.isInstancedMesh))) { for (const ch of o.children) push(ch, true); return; } // 여러 개를 한 그룹에 모아 둔 것(물웅덩이 등): 하나씩
    const c = box.isEmpty() ? o.getWorldPosition(v3).clone() : box.getCenter(new THREE.Vector3());
    out.push({ obj: o, index: -1, pos: c, part });
  };
  scene.traverse((o) => {
    const t = o.userData?.ds;
    if (t == null || !tags.has(t) || (o.parent && tags.has(tagOf(o.parent)))) return;
    if (o.userData.labAfter) return; // 바꿔 끼운 「후」는 「전」의 짝으로 따라 보인다
    if (!visibleNow(o)) return; // 지금 게임에서 숨어 있는 것(도끼질 전 쪼갠 장작 등)은 빼고
    push(o, false);
  });
  return out;
}
/** 가까운 뿌리끼리 묶어 「한 자리」로 (가로등 = 기둥 + 빛 웅덩이) */
function clusterRoots(roots, R0) {
  roots.sort((a, b) => a.pos.length() - b.pos.length());
  const cl = [];
  for (const r of roots) {
    const c = cl.find((k) => k.center.distanceTo(r.pos) < R0);
    if (c) { c.items.push(r); c.center.multiplyScalar(c.items.length - 1).add(r.pos).divideScalar(c.items.length); } else cl.push({ center: r.pos.clone(), items: [r] });
  }
  return cl;
}

// 인스턴스 하나만 보이기: 고른 인스턴스를 앞쪽 칸으로 옮기고 count 를 줄인다 (되돌릴 때 원래 배열로)
function soloInstances(mesh, indices) {
  const saved = { mesh, count: mesh.count, arrays: [] };
  const attrs = [mesh.instanceMatrix, mesh.instanceColor, ...Object.values(mesh.geometry.attributes).filter((a) => a.isInstancedBufferAttribute)].filter(Boolean);
  for (const a of attrs) {
    saved.arrays.push([a, a.array.slice()]);
    const n = a.itemSize, src = a.array.slice();
    indices.forEach((idx, j) => { for (let k = 0; k < n; k++) a.array[j * n + k] = src[idx * n + k]; });
    a.needsUpdate = true;
  }
  mesh.count = indices.length;
  lab.solo.push(saved);
}
function unsolo() {
  for (const s of lab.solo) { for (const [a, arr] of s.arrays) { a.array.set(arr); a.needsUpdate = true; } s.mesh.count = s.count; }
  lab.solo = [];
}

/** 지금 고른 요소 · 자리 · 보기 방식대로 물체를 보이고 숨긴다 */
function applyIsolation() {
  unsolo();
  const e = lab.sel;
  const showAll = !e || e.level === 'page' || lab.mode === 'context' || e.view;
  if (showAll) { for (const o of renderables) o.layers.set(o.userData.labSample ? HIDE : 0); return; }
  if (e.region) { // 템플릿: 구역 안 물체만 (자연 배경 인스턴스는 그대로)
    const { x, z, r, band } = e.region;
    for (const o of renderables) {
      const t = tagOf(o);
      if (o.userData.labSample) { o.layers.set(HIDE); continue; }
      if (ENV.has(t) || t === 'ground' || o.isInstancedMesh) { o.layers.set(0); continue; }
      o.getWorldPosition(v3);
      const inside = band ? Math.abs(v3.z - z) < band && Math.abs(v3.x - x) < r : Math.hypot(v3.x - x, v3.z - z) < r;
      o.layers.set(inside ? 0 : HIDE);
    }
    return;
  }
  const tags = tagsOf(e);
  const cl = lab.all ? lab.clusters : [lab.clusters[lab.cluster]].filter(Boolean);
  const showObjs = new Set(), soloMap = new Map();
  for (const c of cl) for (const it of c.items) {
    if (it.index >= 0) { if (!soloMap.has(it.obj)) soloMap.set(it.obj, []); soloMap.get(it.obj).push(it.index); showObjs.add(it.obj); } else { it.obj.traverse((o) => showObjs.add(o)); lab.pairOf.get(it.obj)?.traverse((o) => showObjs.add(o)); }
  }
  for (const o of renderables) {
    const t = tagOf(o);
    const on = ENV.has(t) || (lab.ground && t === 'ground') || (showObjs.has(o) && tags.has(t));
    o.layers.set(on ? 0 : HIDE);
  }
  for (const [mesh, idx] of soloMap) if (!lab.all) soloInstances(mesh, idx);
}

function frame(target, dist, { yaw = 0.7, pitch = 0.42 } = {}) {
  controls.target.copy(target);
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.near = Math.max(0.05, dist / 200); camera.updateProjectionMatrix();
  controls.update();
}
/** 지금 보이는 자리에 카메라를 맞춘다 */
function frameCluster() {
  const c = lab.clusters[lab.cluster];
  if (!c) return;
  const b = new THREE.Box3();
  const own = c.items.filter((it) => (it.part ? tagOf(it.obj) : it.obj.userData.ds) === c.primary);
  for (const it of own.length ? own : c.items) {
    if (it.spot) { b.expandByPoint(it.pos.clone().addScalar(-5)); b.expandByPoint(it.pos.clone().addScalar(5)); continue; } // 점 구름은 그 둘레 넓게
    if (it.index >= 0) { const g = it.obj.geometry; if (!g.boundingBox) g.computeBoundingBox(); it.obj.getMatrixAt(it.index, m4); b.union(g.boundingBox.clone().applyMatrix4(m4.premultiply(it.obj.matrixWorld))); } else { // 그 요소 이름표가 붙은 물체만 (한 그룹 안에 다른 요소가 섞여 있어도)
      it.obj.updateWorldMatrix(true, true);
      const want = new Set([c.primary, ...tagsOf(lab.sel)]);
      it.obj.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && want.has(tagOf(o)) && (own.length ? tagOf(o) === c.primary : true)) b.union(new THREE.Box3().setFromObject(o, true)); });
      if (b.isEmpty()) b.union(new THREE.Box3().setFromObject(it.obj));
    }
  }
  for (const it of c.items) { const a = lab.pairOf.get(it.obj); if (a?.visible) b.union(new THREE.Box3().setFromObject(a)); } // 바꿔 끼운 「후」도 함께 (나란히)
  const size = b.getSize(v3).length() || 2, ctr = b.getCenter(new THREE.Vector3());
  // 앞모습: 그 물체가 보는 쪽(+z)에서 비스듬히 (주민 · 벤치 · NPC). 인스턴스 · 점 구름은 기본 방향
  const lead = (own.length ? own : c.items).find((it) => it.index < 0 && !it.spot);
  let yaw = 0.7;
  if (lead) { const q = lead.obj.getWorldQuaternion(new THREE.Quaternion()); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); if (Math.abs(f.y) < 0.7) yaw = Math.atan2(f.x, f.z) + 0.55; }
  frame(ctr, Math.max(lab.sel?.level === 'organism' ? 3.6 : 0.9, size * (lab.sel?.level === 'atom' ? 2.2 : 1.6)), { yaw, pitch: 0.38 });
  focus.copy(ctr);
}

const focus = new THREE.Vector3();
function cameraFor(e) {
  const cam = e.camera || {};
  if (cam.fp) { // 모닥불에 앉은 1인칭
    const p = pits.find((q) => q.id === cam.fp), s = p.seatPos[0];
    const eye = new THREE.Vector3(s.x, 1.15, s.z);
    controls.target.set(p.pos.x, 0.7, p.pos.z); camera.position.copy(eye); camera.near = 0.05; camera.updateProjectionMatrix(); controls.update(); focus.copy(p.pos); return;
  }
  if (cam.fpAt) { // 벤치에 앉은 1인칭
    const s = LOUNGE_SEATS.find((q) => q.kind === cam.fpAt);
    const y = hillHeight(s.x, s.z) + 1.15;
    camera.position.set(s.x, y, s.z); controls.target.set(s.x + Math.sin(s.ry) * 6, y + 0.4, s.z + Math.cos(s.ry) * 6); camera.near = 0.05; camera.updateProjectionMatrix(); controls.update(); focus.set(s.x, 0, s.z); return;
  }
  const r = e.region || {};
  const t = new THREE.Vector3(cam.x ?? r.x ?? 0, 1, cam.z ?? r.z ?? 0);
  frame(t, cam.dist || 30, cam); focus.copy(t);
}

// ---------------------------------------------------------------- 고르기
function select(id, { keepCluster = false } = {}) {
  const e = byId.get(id);
  if (!e) return;
  lab.sel = e;
  history.replaceState(null, '', `#${id}`);
  document.querySelectorAll('.lab-item').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  // 날씨 · 밤에만 나오는 주민은 그때인 것처럼
  const rid = id.startsWith('resident-') ? id.slice(9) : null;
  lab.residentTheme = rid === 'raincoat' ? 'rain' : rid === 'snowman' ? 'snow' : null;
  lab.residentNow = rid === 'night' || rid === 'star' ? Date.parse('2026-11-23T01:00:00+09:00') : null;
  residents.update(0, { me: null, theme: lab.residentTheme || lab.theme, now: lab.residentNow ?? Date.now(), met: [], camPos: camera.position, inTent: false }); // 날씨 · 밤 주민을 먼저 나타나게 (숨은 물체는 고를 때 빠지므로)
  if (e.theme && lab.theme !== e.theme) { lab.themeBefore ??= lab.theme; setTheme(e.theme); } // 그 테마에서만 보이는 요소
  else if (!e.theme && lab.themeBefore) { const b = lab.themeBefore; lab.themeBefore = null; setTheme(b); } // 보고 나면 원래 테마로
  if (e.fire && lab.fire !== e.fire) setFire(e.fire); // 장작더미는 장작만, 불꽃은 불 붙은 상태로
  if (e.view) { showHtml(e); } else {
    $('labHtml').classList.add('hidden');
    if (e.level === 'page' || e.region) { lab.clusters = []; applyIsolation(); cameraFor(e); } else {
      const R0 = e.cluster ?? (e.level === 'organism' ? 9 : 3.2); // 작은 자연물은 하나씩
      const primary = (e.tags || [e.id])[0];
      lab.clusters = clusterRoots(rootsOf(tagsOf(e)), R0).filter((c) => c.items.some((it) => (it.part ? tagOf(it.obj) : it.obj.userData.ds) === primary)); // 이루는 요소만 있는 자리는 빼고, 그 요소 자신이 있는 자리만
      for (const c of lab.clusters) c.primary = primary;
      if (!keepCluster) lab.cluster = 0;
      applyIsolation(); frameCluster();
    }
  }
  renderPicker(); renderInfo(); renderSide();
  setTimeout(renderInfo, 400); // 숨어 있던 주민이 나타난 뒤 숫자를 다시 센다
}
function renderPicker() {
  const el = $('labPicker'), e = lab.sel;
  const n = lab.clusters.length;
  if (!e || e.view || n <= 1 || lab.mode === 'context' && false) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const c = lab.clusters[lab.cluster];
  const extra = c?.items[0]?.obj.userData.style ? ` · ${c.items[0].obj.userData.style}` : '';
  el.innerHTML = `<button data-d="-1">◀</button><span>${lab.all ? `전부 ${n}곳` : `${lab.cluster + 1} / ${n}곳${extra}`}</span><button data-d="1">▶</button><button data-all class="${lab.all ? 'on' : ''}">${lab.all ? '하나씩' : '전부'}</button>`;
  el.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.all != null) { lab.all = !lab.all; applyIsolation(); if (!lab.all) frameCluster(); renderPicker(); renderInfo(); return; }
    lab.all = false; lab.cluster = (lab.cluster + +b.dataset.d + n) % n; applyIsolation(); frameCluster(); renderPicker(); renderInfo();
  };
}

// ---------------------------------------------------------------- 아래 정보: 설명 · 위치 · 쓰는 원자(색 · 재질) · 성능 숫자
function statsOf(e) {
  if (!e || e.view) return null;
  const mats = new Map(); let objs = 0, tris = 0, inst = 0;
  for (const o of renderables) {
    if (!o.layers.isEnabled(0) || !o.visible) continue;
    const t = tagOf(o);
    if (ENV.has(t) || t === 'ground') continue;
    let vis = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) continue;
    objs++;
    const g = o.geometry; const n = o.isInstancedMesh ? o.count : 1; if (o.isInstancedMesh) inst += n;
    tris += Math.round(((g?.index ? g.index.count : g?.attributes?.position?.count || 0) / 3) * n);
    for (const m of [].concat(o.material || [])) {
      const key = m.uuid; if (!mats.has(key)) mats.set(key, { m, n: 0 }); mats.get(key).n++;
    }
  }
  return { objs, tris, inst, mats: [...mats.values()] };
}
const hex = (m) => (m.color ? `#${m.color.getHexString()}` : null);
const paletteHex = new Set(Object.values(PALETTE).flatMap((g) => Object.values(g)).map((h) => h.toLowerCase()));
function renderInfo() {
  const e = lab.sel, el = $('labInfo');
  if (!e) { el.innerHTML = ''; return; }
  const lv = LEVELS.find((l) => l.id === e.level);
  const st = statsOf(e);
  const parts = (e.parts || []).map((p) => byId.get(p)).filter(Boolean);
  const users = CATALOG.filter((x) => x.parts?.includes(e.id));
  const ch = lab.checks[e.id];
  let html = `<h2>${esc(e.name)} <span class="st">${lv.name}</span> ${statusBadge(e.id)} ${e.extracted ? '<span class="st st-ok">떼어 냄 · 바꿔 끼우기 가능</span>' : e.view || e.level === 'page' || e.region ? '' : '<span class="st">보기만 (아직 떼어 내지 않음)</span>'}</h2>
    <div class="desc">${esc(e.desc || '')}</div>
    <div class="meta"><span>코드 <code>${esc(e.where || '—')}</code></span>${e.api ? `<span>쓰는 법 <code>${esc(e.api)}</code></span>` : ''}<span>이름표 <code>${[...tagsOf(e)].join(', ')}</code></span>${ch?.memo ? `<span>메모 <b>${esc(ch.memo)}</b></span>` : ''}</div>`;
  if (parts.length) html += `<div class="lab-chips">이루는 요소 ${parts.map((p) => `<button class="lab-chip" data-go="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  if (users.length) html += `<div class="lab-chips">쓰이는 곳 ${users.map((p) => `<button class="lab-chip" data-go="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  if (st) {
    const cols = [...new Map(st.mats.filter((x) => hex(x.m)).map((x) => [hex(x.m), x])).values()].sort((a, b) => b.n - a.n);
    html += swapCompareHtml();
    html += `<div class="perf"><span>물체<br><b>${st.objs.toLocaleString()}</b></span><span class="${st.tris > 60000 ? 'warn' : ''}">면<br><b>${st.tris.toLocaleString()}</b></span><span>재질<br><b>${st.mats.length}</b></span><span>인스턴스<br><b>${st.inst.toLocaleString()}</b></span><span>그리기 횟수 (화면 효과 포함)<br><b id="labCalls">…</b></span></div>`;
    if (cols.length) html += `<div class="lab-chips">쓰는 색 ${cols.slice(0, 24).map((x) => `<span class="sw" title="${x.m.type} · ${x.n}개 물체"><i style="background:${hex(x.m)}"></i>${hex(x.m)}${paletteHex.has(hex(x.m)) ? ' ✓' : ''}</span>`).join(' ')}${cols.length > 24 ? ` <span class="sw">외 ${cols.length - 24}색</span>` : ''}</div><div class="desc" style="margin-top:4px">✓ = 공용 팔레트(atoms/palette.js)에 있는 색</div>`;
  }
  el.innerHTML = html;
  el.onclick = (ev) => { const b = ev.target.closest('[data-go]'); if (b) select(b.dataset.go); };
}

// ---------------------------------------------------------------- 오른쪽 조절판
function renderSide() {
  const e = lab.sel, el = $('labSide');
  if (!e) { el.innerHTML = ''; return; }
  const is3d = !e.view;
  const btn = (k, v, label, on) => `<button class="lab-btn ${on ? 'on' : ''}" data-k="${k}" data-v="${v}">${label}</button>`;
  let h = '';
  if (is3d) {
    if (e.level !== 'page' && !e.region) h += `<h3>보기</h3><div class="lab-row">${btn('mode', 'solo', '따로 보기', lab.mode === 'solo')}${btn('mode', 'context', '게임 속에서', lab.mode === 'context')}${btn('ground', 'x', '바닥', lab.ground)}</div>`;
    h += `<h3>카메라</h3><div class="lab-row">${btn('cam', 'fit', '맞추기', false)}${btn('cam', 'tp', '게임 3인칭', false)}${btn('cam', 'fp', '서서 1인칭', false)}${btn('cam', 'top', '위에서', false)}</div>`;
    h += `<h3>테마</h3><div class="lab-row">${Object.values(THEMES).map((t) => btn('theme', t.id, `${t.icon} ${{ clear: '맑은 밤', rain: '비', snow: '눈', christmas: '크리스마스' }[t.id] || t.name}`, lab.theme === t.id)).join('')}</div>`;
    h += `<h3>모닥불</h3><div class="lab-row">${btn('fire', 'empty', '빈 화로', lab.fire === 'empty')}${btn('fire', 'stacked', '장작', lab.fire === 'stacked')}${btn('fire', 'lit', '불 붙음', lab.fire === 'lit')}</div>`;
  }
  const ch = lab.checks[e.id] || {};
  h += `<h3>디자인 점검</h3><div class="lab-row lab-check">${[['ok', '괜찮음'], ['review', '검토 필요'], ['design', '디자인 필요']].map(([k, l]) => `<button class="lab-btn st-${k} ${ch.status === k ? 'on' : ''}" data-check="${k}">${l}</button>`).join('')}</div>
    <textarea id="labMemo" placeholder="무엇이 아쉬운지, 어떻게 바뀌면 좋을지">${esc(ch.memo || '')}</textarea>
    <div class="lab-row" style="margin-top:6px"><button class="lab-btn" id="labSave">저장</button><span class="note" id="labSaveMsg">${lab.notion ? '노션 현황판에 저장돼요' : '노션 연결 확인 중… (로컬 서버에서만 저장)'}</span></div>`;
  const styles = [...new Set(lab.clusters.map((c) => c.items[0]?.obj.userData.style).filter(Boolean))];
  if (is3d && styles.length > 1) h += `<h3>모양 (변형)</h3><div class="lab-row">${styles.map((st) => btn('style', st, st, lab.clusters[lab.cluster]?.items[0]?.obj.userData.style === st)).join('')}</div>`;
  h += swapPanel(e, btn);
  el.innerHTML = h;
  el.onclick = onSide;
}
function onSide(ev) {
  const b = ev.target.closest('button'); if (!b) return;
  const { k, v } = b.dataset;
  if (b.dataset.check) return saveCheck(b.dataset.check);
  if (b.id === 'labSave') return saveCheck(lab.checks[lab.sel.id]?.status || null);
  if (k === 'mode') { lab.mode = v; applyIsolation(); }
  if (k === 'style') { lab.all = false; lab.cluster = lab.clusters.findIndex((c) => c.items[0]?.obj.userData.style === v); applyIsolation(); frameCluster(); renderPicker(); }
  if (k === 'ab') { lab.ab = v; applyAB(); applyIsolation(); if (v === 'side') frameCluster(); }
  if (k === 'swap-reset') { clearSwap(); select(lab.sel.id, { keepCluster: true }); return; }
  if (k === 'swap-pick') { $('labFile').click(); return; }
  if (k === 'ground') { lab.ground = !lab.ground; applyIsolation(); }
  if (k === 'theme') { lab.themeBefore = null; setTheme(v); }
  if (k === 'fire') setFire(v);
  if (k === 'cam') {
    const t = controls.target.clone();
    if (v === 'fit') { if (lab.clusters.length) frameCluster(); else cameraFor(lab.sel); } else if (v === 'tp') frame(t, 7, { yaw: Math.atan2(camera.position.x - t.x, camera.position.z - t.z), pitch: 0.55 }); else if (v === 'top') frame(t, 26, { yaw: 0.3, pitch: 1.2 }); else { // 서서 1인칭: 2.5m 앞 눈높이
      const yaw = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
      camera.position.set(t.x + Math.sin(yaw) * 2.6, 1.55, t.z + Math.cos(yaw) * 2.6); controls.target.set(t.x, Math.max(0.6, t.y), t.z); camera.near = 0.05; camera.updateProjectionMatrix(); controls.update();
    }
  }
  renderSide(); setTimeout(renderInfo, 50);
}
// ---------------------------------------------------------------- 바꿔 끼우기 (디자이너 파일 → 수정 전/후)
// 성능 한도 (초안): 휴대폰에서 같은 요소가 여러 개 놓여도 버티는 정도. 넘으면 빨갛게
const LIMITS = { atom: { tris: 500, mats: 1, objs: 1 }, molecule: { tris: 3000, mats: 6, objs: 40 }, organism: { tris: 40000, mats: 30, objs: 400 } };
function countOf(root) {
  let objs = 0, tris = 0; const mats = new Set();
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
    objs++;
    const g = o.geometry, n = o.isInstancedMesh ? o.count : 1;
    tris += Math.round(((g?.index ? g.index.count : g?.attributes?.position?.count || 0) / 3) * n);
    for (const m of [].concat(o.material || [])) mats.add(m.color ? `${m.type}|${m.color.getHexString()}` : m.uuid);
  });
  return { objs, tris, mats: mats.size };
}
function swapPanel(e, btn) {
  const sw = lab.swap;
  const mine = sw && (sw.path === e.extracted || sw.touches.has(e.id));
  let h = '<h3>바꿔 끼우기</h3>';
  if (!e.extracted && !mine) return h + `<div class="note">아직 떼어 내지 않은 요소라 보기만 돼요. 떼어 내면(<code>src/elements/</code>) 디자이너 파일을 끌어다 놓아 바꿔 볼 수 있어요.</div>`;
  if (mine) {
    h += `<div class="note">「${esc(sw.name)}」 바꿔 끼움 · ${sw.count}곳</div><div class="lab-row" style="margin-top:6px">${btn('ab', 'before', '수정 전', lab.ab === 'before')}${btn('ab', 'after', '수정 후', lab.ab === 'after')}${btn('ab', 'side', '나란히', lab.ab === 'side')}${btn('swap-reset', 'x', '되돌리기', false)}</div>`;
  } else h += `<div class="note">떼어 낸 요소예요 (<code>${esc(e.extracted)}</code>). 디자이너가 보낸 같은 이름의 파일을 <b>화면에 끌어다 놓으면</b> 바꿔 끼워 수정 전/후를 비교해요.</div>`;
  h += `<div class="lab-row" style="margin-top:6px">${btn('swap-pick', 'x', '파일 고르기', false)}</div>`;
  if (lab.swapError) h += `<div class="note" style="color:#ff9a9a">${esc(lab.swapError)}</div>`;
  return h;
}
/** 지금 고른 자리의 수정 전/후 숫자 */
function swapCompareHtml() {
  const c = lab.clusters[lab.cluster];
  if (!lab.swap || !c) return '';
  const pairs = c.items.map((it) => [it.obj, lab.pairOf.get(it.obj)]).filter(([, a]) => a);
  if (!pairs.length) return '';
  const sum = (arr) => arr.reduce((s, x) => ({ objs: s.objs + x.objs, tris: s.tris + x.tris, mats: Math.max(s.mats, x.mats) }), { objs: 0, tris: 0, mats: 0 });
  const b = sum(pairs.map(([x]) => countOf(x))), a = sum(pairs.map(([, y]) => countOf(y)));
  const lim = LIMITS[lab.sel.level] || LIMITS.molecule;
  const cell = (k, label) => { const d = a[k] - b[k]; return `<span class="${a[k] > lim[k] ? 'warn' : ''}">${label}<br><b>${b[k].toLocaleString()} → ${a[k].toLocaleString()}</b> ${d ? `(${d > 0 ? '+' : ''}${d.toLocaleString()})` : ''}${a[k] > lim[k] ? ` · 한도 ${lim[k].toLocaleString()} 넘음` : ''}</span>`; };
  return `<div class="perf" style="grid-template-columns:repeat(3,auto)">${cell('objs', '수정 전 → 후 물체')}${cell('tris', '면')}${cell('mats', '재질')}</div>`;
}
function clearSwap() {
  for (const [before, after] of lab.pairOf) { after.removeFromParent(); before.visible = true; delete before.userData.labBefore; }
  lab.pairOf.clear(); lab.swap = null; lab.swapError = null; lab.ab = 'after';
  collectRenderables();
}
function applyAB() {
  for (const [before, after] of lab.pairOf) {
    before.visible = lab.ab !== 'after';
    after.visible = lab.ab !== 'before';
    after.position.copy(before.position); after.quaternion.copy(before.quaternion); after.scale.copy(before.scale);
    if (lab.ab === 'side') { // 수정 후를 옆(요소의 오른쪽)에 나란히
      const bb = new THREE.Box3().setFromObject(before), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) + 0.6;
      after.position.add(new THREE.Vector3(w, 0, 0).applyQuaternion(before.quaternion));
    }
  }
}
/** 놓은 파일을 바꿔 끼운다. 원자면 그 원자를 쓰는 분자를 모두 다시 조립 */
async function swapIn(name, text) {
  lab.swapError = null;
  try {
    const path = matchPath(name);
    const graph = createGraph({ [path]: text });
    clearSwap();
    const touches = new Set();
    const isAtom = path.includes('/atoms/');
    let count = 0;
    const pair = (before, after) => {
      after.position.copy(before.position); after.quaternion.copy(before.quaternion); after.scale.copy(before.scale);
      before.parent.add(after);
      before.userData.labBefore = true;
      after.traverse((o) => { o.userData.labAfter = true; });
      lab.pairOf.set(before, after); count++;
    };
    for (const mp of isAtom ? MOLECULES : [path]) {
      if (!isAtom && !mp.includes('/molecules/') && !mp.includes('/organisms/')) break;
      const mod = await graph.load(mp);
      if (typeof mod.create !== 'function') throw new Error(`${mp}: create(opts) 가 없어요 (요소 틀을 지켜 주세요)`);
      const probe = mod.create({}).group, id = probe.userData.ds;
      if (!id) throw new Error(`${mp}: group.userData.ds (이름표)가 없어요`);
      touches.add(id);
      const olds = []; scene.traverse((o) => { if (o.userData.ds === id && o.userData.args && !o.userData.labAfter) olds.push(o); });
      for (const old of olds) pair(old, mod.create({ ...old.userData.args }).group);
    }
    if (isAtom) { // 원자 견본도 새 것으로
      const atoms = await graph.load('src/elements/atoms/index.js');
      for (const p of atoms.PARTS || []) {
        const old = samples.find((s) => s.userData.ds === p.id); if (!old) continue;
        if (p.file === path) touches.add(p.id);
        const m = p.make(); m.userData.ds = p.id; m.traverse((o) => { o.userData.labSample = true; });
        const bb = new THREE.Box3().setFromObject(m); m.position.set(old.position.x, -bb.min.y, old.position.z);
        scene.add(m); old.userData.labBefore = true; m.traverse((o) => { o.userData.labAfter = true; }); lab.pairOf.set(old, m);
        m.position.copy(old.position); m.position.y = -bb.min.y;
      }
    }
    lab.swap = { path, name, count, touches };
    collectRenderables(); applyAB();
    const go = byId.get([...touches][0]) ? [...touches][0] : lab.sel?.id;
    select(touches.has(lab.sel?.id) ? lab.sel.id : go, { keepCluster: touches.has(lab.sel?.id) });
  } catch (err) {
    lab.swapError = `바꿔 끼우지 못했어요: ${err.message}`;
    console.error(err);
    renderSide();
  }
}
// 끌어다 놓기 · 파일 고르기
{
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.js,text/javascript', id: 'labFile', hidden: true });
  document.body.appendChild(input);
  input.addEventListener('change', async () => { const f = input.files[0]; if (f) await swapIn(f.name, await f.text()); input.value = ''; });
  const over = document.createElement('div'); over.className = 'lab-drop hidden'; over.textContent = '여기에 놓으면 바꿔 끼워요 (bench.js · plank.js 처럼 원래 파일 이름 그대로)';
  $('labStage').appendChild(over);
  let depth = 0;
  addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { depth++; over.classList.remove('hidden'); } });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; over.classList.add('hidden'); } });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', async (e) => {
    e.preventDefault(); depth = 0; over.classList.add('hidden');
    const f = e.dataTransfer?.files?.[0]; if (f) await swapIn(f.name, await f.text());
  });
}


// ---------------------------------------------------------------- 디자인 점검 → 노션 현황판 (로컬 서버의 /api/ds/*)
const statusBadge = (id) => { const s = lab.checks[id]?.status; return s ? `<span class="st st-${s}">${{ ok: '괜찮음', review: '검토 필요', design: '디자인 필요' }[s]}</span>` : '<span class="st st-none">미점검</span>'; };
async function loadChecks() {
  try {
    const r = await fetch('/api/ds/checks'); if (!r.ok) throw new Error(r.status);
    const j = await r.json(); lab.checks = j.checks || {}; lab.notion = !!j.notion;
  } catch { lab.notion = false; }
  renderNav(); renderInfo(); renderSide();
  const m = $('labSaveMsg'); if (m && !lab.notion) m.textContent = '저장 안 됨: 로컬 서버(npm run dev)에서 열어야 노션에 저장돼요';
}
async function saveCheck(status) {
  const e = lab.sel, memo = $('labMemo')?.value || '';
  const msg = $('labSaveMsg');
  lab.checks[e.id] = { ...(lab.checks[e.id] || {}), status, memo };
  renderNav(); renderSide(); renderInfo();
  try {
    const r = await fetch('/api/ds/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, name: e.name, level: LEVELS.find((l) => l.id === e.level).name, area: e.area === 'ui' ? 'UI' : '3D', where: e.where || '', extracted: !!e.extracted, status, memo }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    const j = await r.json(); lab.checks[e.id] = j.check;
    if ($('labSaveMsg')) $('labSaveMsg').textContent = '노션 현황판에 저장했어요 ✓';
  } catch (err) { if ($('labSaveMsg')) $('labSaveMsg').textContent = `저장 못 함: ${err.message}`; else if (msg) msg.textContent = '저장 못 함'; }
}

// ---------------------------------------------------------------- 왼쪽 목록
function renderNav() {
  const q = $('labSearch').value.trim().toLowerCase();
  const nav = $('labNav');
  const open = new Set([...nav.querySelectorAll('details[open]')].map((d) => d.dataset.level));
  const first = !nav.children.length;
  nav.innerHTML = LEVELS.map((lv) => {
    const items = CATALOG.filter((e) => e.level === lv.id && !e.hidden && (!q || `${e.name} ${e.id} ${e.group} ${e.desc}`.toLowerCase().includes(q)));
    if (!items.length) return '';
    const groups = [...new Set(items.map((e) => e.group || ''))];
    const done = items.filter((e) => lab.checks[e.id]?.status).length;
    return `<details class="lab-level" data-level="${lv.id}" ${first || q || open.has(lv.id) ? 'open' : ''}><summary>${lv.name} <small>${lv.en}</small><span class="cnt">${done}/${items.length}</span></summary>${groups.map((g) => `<div class="lab-group">${esc(g)}</div>${items.filter((e) => (e.group || '') === g).map((e) => `<button class="lab-item ${lab.sel?.id === e.id ? 'on' : ''}" data-id="${e.id}"><span class="dot ${lab.checks[e.id]?.status ? `st-${lab.checks[e.id].status}` : ''}"></span>${esc(e.name)}${e.extracted ? '<span class="ex">떼어 냄</span>' : ''}</button>`).join('')}`).join('')}</details>`;
  }).join('');
}
$('labNav').addEventListener('click', (ev) => { const b = ev.target.closest('.lab-item'); if (b) select(b.dataset.id); });
$('labSearch').addEventListener('input', renderNav);

// ---------------------------------------------------------------- 3D 가 아닌 화면 (원자 · UI)
function sceneMaterials() {
  const m = new Map();
  for (const o of renderables) for (const mat of [].concat(o.material || [])) {
    if (!m.has(mat)) m.set(mat, new Set());
    const t = tagOf(o); if (t) m.get(mat).add(t);
  }
  return m;
}
function showHtml(e) {
  const el = $('labHtml');
  el.classList.remove('hidden');
  let h = `<h2>${esc(e.name)}</h2><p>${esc(e.desc || '')}</p>`;
  if (e.view === 'palette') {
    h += '<h3>공용 팔레트 (src/elements/atoms/palette.js)</h3><div class="grid-sw">' + Object.entries(PALETTE).flatMap(([g, cs]) => Object.entries(cs).map(([k, c]) => `<div class="c"><i style="background:${c}"></i><div><b>${g}.${k}</b><br>${c}</div></div>`)).join('') + '</div>';
    const byHex = new Map();
    for (const [mat, tags] of sceneMaterials()) {
      const c = hex(mat); if (!c) continue;
      if (!byHex.has(c)) byHex.set(c, { tags: new Set(), n: 0 });
      const x = byHex.get(c); x.n++; tags.forEach((t) => x.tags.add(t));
    }
    const list = [...byHex.entries()].map(([c, x]) => ({ c, ...x, hsl: new THREE.Color(c).getHSL({}) })).sort((a, b) => (a.hsl.s < 0.12) - (b.hsl.s < 0.12) || a.hsl.h - b.hsl.h || a.hsl.l - b.hsl.l);
    h += `<h3>장면에서 쓰는 색 ${list.length}가지 (재질 기준, 같은 색끼리 모음 · 팔레트에 있는 색 ✓)</h3><p>비슷한 색이 여러 개면 팔레트로 합칠 후보예요. 이름은 그 색을 쓰는 요소예요.</p><div class="grid-sw">` +
      list.map((x) => `<div class="c"><i style="background:${x.c}"></i><div><b>${x.c}${paletteHex.has(x.c) ? ' ✓' : ''}</b> · 재질 ${x.n}<br>${[...x.tags].slice(0, 4).map((t) => byId.get(t)?.name || t).join(', ')}${x.tags.size > 4 ? ` 외 ${x.tags.size - 4}` : ''}</div></div>`).join('') + '</div>';
  } else if (e.view === 'materials') {
    const by = new Map();
    for (const [mat, tags] of sceneMaterials()) {
      const k = `${mat.type}${mat.transparent ? ' · 투명' : ''}${mat.blending === THREE.AdditiveBlending ? ' · 빛 더하기' : ''}`;
      if (!by.has(k)) by.set(k, { n: 0, tags: new Set() });
      const x = by.get(k); x.n++; tags.forEach((t) => x.tags.add(t));
    }
    h += '<table class="lab-table"><tr><th>재질</th><th>개수</th><th>쓰는 요소</th></tr>' + [...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `<tr><td>${k}</td><td>${x.n}</td><td>${[...x.tags].map((t) => byId.get(t)?.name || t).join(', ')}</td></tr>`).join('') + '</table>';
    h += '<p>키트 규칙: 새 요소는 <code>toon()</code>(셀 셰이딩) · <code>glow()</code>(빛나는 것)만 쓴다. MeshToonMaterial 은 같은 색이면 하나를 나눠 쓴다 (src/toon.js).</p>';
  } else if (e.view === 'tokens') {
    const cs = getComputedStyle(document.documentElement);
    const names = ['--cream', '--cream-2', '--brown', '--brown-2', '--orange', '--orange-2', '--green', '--wood-hi', '--wood', '--wood-lo', '--wood-edge', '--wood-deep', '--engrave', '--engrave-hi'];
    h += '<h3>색</h3><div class="grid-sw">' + names.map((n) => `<div class="c"><i style="background:var(${n})"></i><div><b>${n}</b><br>${cs.getPropertyValue(n).trim()}</div></div>`).join('') + '</div>';
    h += `<h3>그림자 · 둥근 정도 · 나뭇결</h3><div class="ui-sheet light"><div class="card" style="width:220px;padding:18px">카드 (--cream · --shadow · 28px)</div><div style="width:220px;height:90px;border-radius:var(--radius);box-shadow:var(--shadow);background:var(--cream-2);display:flex;align-items:center;justify-content:center;color:var(--brown)">--radius ${cs.getPropertyValue('--radius').trim()}</div><div style="width:220px;height:90px;border-radius:14px;background:var(--grain),linear-gradient(180deg,var(--wood-hi),var(--wood) 55%,var(--wood-lo));border:1px solid var(--wood-edge);display:flex;align-items:center;justify-content:center;color:var(--engrave)">나뭇결 --grain</div></div>`;
  } else if (e.view === 'icons') {
    h += '<div class="ui-sheet">' + Object.keys(NORM).sort().map((n) => `<div class="icon-cell"><button class="icon-btn">${icon(n)}</button>${n}</div>`).join('') + '</div>';
  } else if (e.view === 'powder-icons') {
    h += '<h3>기본 가루 (효과 8가지 · 색은 무작위 8가지 중 하나)</h3><div class="ui-sheet">' + POWDER_EFFECTS.map((f, i) => `<div class="icon-cell">${powderIco({ effect: f.id, color: POWDER_COLORS[i % POWDER_COLORS.length].hex }, 'big')}${f.name}</div>`).join('') + '</div>';
    h += '<h3>색 8가지 (같은 효과 · 반짝이)</h3><div class="ui-sheet">' + POWDER_COLORS.map((c) => `<div class="icon-cell">${powderIco({ effect: 'sparkle', color: c.hex }, 'big')}${c.name}</div>`).join('') + '</div>';
    h += '<h3>✦ 특별한 가루</h3><div class="ui-sheet">' + Object.entries(LEGEND_POWDERS).map(([k, p]) => `<div class="icon-cell">${powderIco({ effect: k, color: p.color, bg: p.bg, legend: true }, 'big')}${esc(p.name.replace('✦ ', '').replace(' 가루', ''))}</div>`).join('') + '</div>';
  } else if (e.view === 'font') {
    h += '<div class="font-sample">' + [40, 28, 20, 15, 12].map((s) => `<div style="font-size:${s}px;margin:6px 0">불멍 캠핑장 · 오늘 하루 수고했어요 🔥 ${s}px</div>`).join('') + '</div><p>게임 · 간판 · 이정표에 같은 글꼴을 쓴다. 원본 OTF 를 수정 없이 그대로 제공 (서브셋 · 변환 · 재배포 금지).</p>';
  } else if (e.view === 'ui-button') {
    h += '<h3>아이콘 버튼 (.icon-btn)</h3><div class="ui-sheet">' + ['map', 'mail', 'sound', 'help', 'eye', 'install', 'menu'].map((n) => `<button class="icon-btn">${icon(n)}</button>`).join('') + '</div>';
    h += '<h3>글자 버튼 (.btn) · 가방 (.bag-btn) · 가루 사기 (.shop-buy)</h3><div class="ui-sheet light"><button class="btn">캠핑장 들어가기</button><button class="bag-btn">' + icon('bag') + '</button><button class="shop-buy">10 코인</button></div>';
  } else if (e.view === 'ui-label') {
    h += '<div class="ui-sheet"><div class="char-label" style="position:static"><span class="name">🔥 기준</span></div><div class="bubble" style="position:relative;transform:none;left:auto;top:auto">오늘 불멍 하기 좋은 날이에요</div><div class="npc-mark" style="position:static">💬</div></div><p>게임 화면에서는 캐릭터 머리 위에 붙어요 (CSS2D).</p>';
  } else if (e.view === 'ui-page' || e.view === 'ui-game') {
    h += `<p>실제 게임을 그대로 띄워요 (입장 화면부터). 들어가기를 누르면 이 로컬 서버의 캠핑장에 접속해요.</p><div class="lab-frames"><figure><figcaption>PC 1280 × 720 (½ 크기)</figcaption><div class="fr" style="width:640px;height:360px"><iframe src="/" style="width:1280px;height:720px;transform:scale(.5)"></iframe></div></figure><figure><figcaption>휴대폰 390 × 844 (½ 크기)</figcaption><div class="fr" style="width:195px;height:422px"><iframe src="/" style="width:390px;height:844px;transform:scale(.5)"></iframe></div></figure></div>`;
  }
  el.innerHTML = h;
}

// ---------------------------------------------------------------- 크기 · 그리기
function resize() {
  const w = viewEl.clientWidth, h = viewEl.clientHeight;
  if (!w || !h) return;
  R.resize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  shared.uScale.value = R.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
new ResizeObserver(resize).observe(viewEl);
resize();

const clock = new THREE.Clock();
let infoT = 0;
R.renderer.info.autoReset = false;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = Date.now();
  shared.uTime.value = t;
  controls.update();
  if (!lab.sel || lab.sel.view) { /* 3D 를 쉰다 */ if (lab.sel?.view) return; }
  world.hemi.intensity = 0.45 * themeLight.hemi; world.ambient.intensity = 0.18 * themeLight.ambient; world.moonLight.intensity = 0.45 * themeLight.moon;
  const fk = Math.min(1, dt * 2);
  scene.fog.color.lerp(fogTarget.color, fk); scene.fog.near += (fogTarget.near - scene.fog.near) * fk; scene.fog.far += (fogTarget.far - scene.fog.far) * fk;
  world.update(t, dt, camera, focus, shared);
  world.sky.update(t, dt, camera, 0);
  const fpSit = !!lab.sel?.camera?.fp; // 모닥불에 앉은 1인칭 (게임과 같은 밝기 보정)
  let nearLit = Infinity;
  for (const p of pits) { const d = camera.position.distanceTo(p.pos); p.viewDim = (0.38 + 0.62 * THREE.MathUtils.smoothstep(d, 2.5, 9)) * (fpSit ? 0.78 : 1); if (p.state === 'lit' && d < nearLit) nearLit = d; p.update(t, dt, now); }
  const fpView = fpSit || !!lab.sel?.camera?.fpAt;
  R.bloom.strength += ((fpView && !lab.sel?.camera?.fpAt ? 0.16 : 0.22) + 0.2 * THREE.MathUtils.smoothstep(nearLit, 2.5, 9) - R.bloom.strength) * Math.min(1, dt * 3);
  const lit = pits.filter((p) => p.intensity > 0.02).map((p) => ({ p, d: p.pos.distanceToSquared(focus) })).sort((a, b) => a.d - b.d);
  firePool.forEach((L, i) => { const e = lit[i]; if (!e) { L.intensity = 0; return; } L.position.set(e.p.pos.x, 1.1 * e.p.height, e.p.pos.z); L.color.copy(e.p.tip).lerp(FIRE_COLOR, 0.35); L.intensity = 14 * e.p.intensity * e.p.flicker * (fpSit ? 0.72 : 1); });
  for (let i = 0; i < monitors.length; i++) monitors[i].update(dt, false);
  lampPool.update(dt, focus, lightSpots);
  precip.update(dt, t, camera.position);
  residents.update(dt, { me: null, theme: lab.residentTheme || lab.theme, now: lab.residentNow ?? now, met: [], camPos: camera.position, inTent: false });
  npc.update(dt); keeper.update(dt); woodcut.update(dt); for (const ch of sampleChars) ch.update(dt);
  tentRoom.update(dt, false, camera.position);
  gbStand.update(dt, null); board.update(dt, null);
  R.renderer.info.reset();
  R.composer.render();
  if ((infoT -= dt) < 0) { infoT = 0.5; const c = $('labCalls'); if (c) c.textContent = R.renderer.info.render.calls; }
}

// ---------------------------------------------------------------- 시작
$('labLoading').remove();
renderNav();
select(location.hash.slice(1) && byId.has(location.hash.slice(1)) ? location.hash.slice(1) : 'bench');
loadChecks();
loop();
window.__lab = { scene, camera, controls, lab, select, world, pits, residents, R };
