import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { createRender } from './render.js';
import { buildWorld } from './world.js';
import { FirePit } from './fire.js';
import { Character } from './character.js';
import { Particles } from './particles.js';
import { Effects } from './effects.js';
import { Net } from './net.js';
import { UI, groupPowders, powderIco } from './ui.js';
import { createResidents } from './residents.js';
import { MOODS, ALWAYS, STAMP_GOALS, RESIDENT_RANGE } from '../shared/residents.js';
import { Sound } from './audio.js';
import { icon, fillIcons, EMOJI_ICON } from './icons.js';
import { Precip } from './precip.js';
import { themeOf } from '../shared/themes.js';
import { Guide, pickTarget } from './guide.js';
import { Preview } from './preview.js';
import { isTouch, TouchControls } from './touch.js';
import { initQuality, PRESET, LABEL, LEVELS, AutoQuality, saveMode, saveAuto } from './quality.js';
import { initPWA, initFullscreen } from './pwa.js';
import { initAnalytics, track, startHeartbeat } from './analytics.js';
import { Music } from './music.js';
import { Monitor } from './monitor.js';
import { Woodcut } from './woodcut.js';
import { GuestbookStand } from './guestbook.js';
import { NoticeBoard } from './board.js';
import { LightPool } from './lightpool.js';
import { TentInterior, TENT_PROPS, TENT_ENTRY, collideTents, roofY } from './tent.js';
import { Arena, kstWhen } from './arena.js';
import { BASKET_R } from './elements/molecules/hot-air-balloon.js';
import { createArenaCrowd } from './arenaCrowd.js';
import { createArenaFans } from './arenaFans.js';
import { createArenaBand } from './arenaBand.js';
import { marquee, marqueeAll } from './marquee.js';
import {
  CFG, PITS, STUMPS, NPC, KEEPER, BOUNDS, RANGE, LOOKS, GUESTBOOK, BOARD, QUESTS, LEGEND_POWDERS, TENTS, FIRES, tentAt, tentLocal, EGG, kstDay, EMOTES, FENCE, GATES, SPOTS, LOUNGE_SEATS, SUNSET, ZONES, zonePath,
  ARENA, ARENA_PITS, BALLOON, TT_SIGN, inArena,
} from '../shared/config.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

// 앱 설치 버튼 · 버튼 아이콘은 월드를 만들기 전에 바로 살린다 (입장 화면에서 일찍 눌러도 반응하게)
initPWA();
fillIcons();

// 간판 글꼴이 준비된 뒤 월드를 만든다
await Promise.race([Promise.all([document.fonts.load('64px Moneygraphy'), document.fonts.load('64px MatrixMonoScreen')]), new Promise((r) => setTimeout(r, 2500))]);

// ---------------------------------------------------------------- 렌더러
if (isTouch) document.body.classList.add('touch');
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.className = 'label-layer';
document.body.insertBefore(labelRenderer.domElement, $('join'));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#1a1c44', 40, 150);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);

// 렌더러 + 후처리(픽셀 정리 → 빛 번짐 → 색감)는 src/render.js — 실험실(lab)과 같은 설정
// 🖥️ 화질 (v1.22.8): 높음(예전 PC) · 보통(휴대폰) · 가벼움 + 자동. 풀 · 꽃 밀도 같은 「처음 만들 때」 설정은 보통 이하면 휴대폰처럼
const gfx = initQuality({ isTouch });
const lowSpec = isTouch || gfx.level !== 'high';
const view3d = createRender({ scene, camera, lowSpec, quality: PRESET[gfx.level] });
const { renderer, composer, bloom, grade } = view3d;
$('app').appendChild(renderer.domElement);

const shared = { uTime: { value: 0 }, uScale: { value: 600 } };
function resize() {
  const w = innerWidth, h = innerHeight;
  view3d.resize(w, h);
  labelRenderer.setSize(w, h);
  music?.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 60 : 42; // 세로 화면에서는 시야를 넓힌다
  camera.updateProjectionMatrix();
  shared.uScale.value = baseUScale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
let baseUScale = 600;
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- 월드
const world = buildWorld(scene, { lowSpec });
const pits = new Map(FIRES.map((d) => [d.id, new FirePit(d, scene, shared)])); // 바깥 화로 + 텐트 화로
const pitList = [...pits.values()];
// 🎤 불멍 아레나 (v1.23): 무대 · 객석 마당 · 승강장 · 열기구. 객석 모닥불(늘 탄다)은 아레나와 함께 숨기고 보인다
const arena = new Arena(scene, { lowSpec });
// 📦 아레나 창고지기 콩이: 캠핑장 보리의 창고와 같은 창고 (아레나와 함께 숨기고 보인다)
const arenaKeeper = new Character({ skin: '#ffe0c7', hair: '#c9772f', shirt: '#e0b43a', pants: '#5a4330', hat: 'cap' }, { name: `📦 ${ARENA.keeper.name} · 아레나 창고지기`, kind: 'npc' });
arenaKeeper.root.position.set(ARENA.keeper.x, 0, ARENA.keeper.z);
arenaKeeper.root.rotation.y = ARENA.keeper.ry;
arenaKeeper.root.userData.ds = 'npc-kong';
arena.root.add(arenaKeeper.root);
// 🎤 아레나 사람들 (판매원 · 팬 · 안내원 · 음향 감독 · 사진가 · 아이)
const crowd = createArenaCrowd(arena.root);
// 🙌 관객 무리 (인스턴스 약 100명) · 🎸 무대 밴드 5인조
const fans = createArenaFans(arena.root, [
  ...crowd.list.map((n) => ({ x: n.x, z: n.z, r: 1.6 })), { x: -9.5 + 0.7, z: 342.1, r: 1.6 }, // 이름 있는 사람들 · 음향 콘솔
  { ...ARENA.booth, r: 4 }, { ...ARENA.apply, r: 4 }, { ...ARENA.keeper, r: 4 }, { ...ARENA.dock, r: 7 },
]);
const band = createArenaBand(arena.root);
let pyroKey = -1;
const isArenaPit = (p) => p.def.kind === 'arena';
for (const p of pitList) if (isArenaPit(p)) arena.extraVisible.push(p.group);
/** 지금 있는 곳(캠핑장 · 아레나)의 모닥불만 */
const zonePits = () => pitList.filter((p) => isArenaPit(p) === (state.zone === 'arena'));
const glowFx = new Particles(scene, shared, { max: 5000, additive: true });
const softFx = new Particles(scene, shared, { max: 1500, additive: false });
const effects = new Effects(glowFx, softFx, scene);
const sound = new Sound();
const guide = new Guide(scene);

const monitors = new Map(PITS.map((d) => [d.id, new Monitor(d, scene)]));
const woodcut = new Woodcut(scene, STUMPS);
for (const s of world.stumpMeshes) s.log.visible = false; // 그루터기 위 통나무는 woodcut 이 그린다
const gbStand = new GuestbookStand(scene, GUESTBOOK);
const board = new NoticeBoard(scene, BOARD);
const lightSpots = [...world.lightSpots, gbStand.lightSpot, board.lightSpot, ...arena.lightSpots, arena.campLight];
const lampPool = new LightPool(scene, PRESET.high.lamps); // 화질에 따라 setCount 로 줄인다
const colliders = [
  ...world.colliders.filter((c) => !c.tent), // 텐트 벽은 collideTents 에서 (들어가기 · 나가기 버튼으로만 드나든다)
  { x: GUESTBOOK.x, z: GUESTBOOK.z, r: 1.35 },
  { x: BOARD.x - 1.5, z: BOARD.z, r: 0.35 }, { x: BOARD.x + 1.5, z: BOARD.z, r: 0.35 }, { x: BOARD.x - 0.6, z: BOARD.z, r: 0.5 }, { x: BOARD.x + 0.6, z: BOARD.z, r: 0.5 },
  ...PITS.map((p) => ({ x: p.x, z: p.z, r: 0.95 })),
  ...ARENA_PITS.map((p) => ({ x: p.x, z: p.z, r: 0.95 })),
  ...arena.colliders,
  ...crowd.colliders,
  ...fans.colliders,
  ...[...monitors.values()].map((m) => ({ x: m.pos.x, z: m.pos.z, r: 0.55 })),
  ...[...monitors.values()].map((m) => ({ x: m.lpPos.x, z: m.lpPos.z, r: 0.38 })),
];

// 모닥불 조명은 가까운 불 몇 곳에만 (폰은 더 적게) — 조명 수가 곧 발열이다
const firePool = [];
let fireN = PRESET.high.fires; // 화질에 따라 줄인다 (applyQuality)
for (let i = 0; i < PRESET.high.fires; i++) {
  const L = new THREE.PointLight('#ff8a3a', 0, 16, 1.5);
  scene.add(L);
  firePool.push(L);
}

const tentRoom = new TentInterior(scene, world.tents);

// NPC 루미
// ---------------------------------------------------------------- 🌦️ 캠핑장 테마 (서버가 알려 준다: 서울 날씨 · 관리자 선택)
const precip = new Precip(scene, shared, { lowSpec });

/** 화질 적용: 픽셀 · 멀티샘플 · 빛 번짐 (render.js) + 그림자 + 실제 조명 수 */
function applyQuality(level) {
  const P = PRESET[level];
  view3d.setQuality(P);
  const ml = world.moonLight;
  if (ml.castShadow !== P.shadow > 0) ml.castShadow = P.shadow > 0;
  if (P.shadow && ml.shadow.mapSize.x !== P.shadow) { ml.shadow.mapSize.setScalar(P.shadow); ml.shadow.map?.dispose(); ml.shadow.map = null; }
  lampPool.setCount(P.lamps);
  precip.setDensity(P.precip); // 비 · 눈 양 (가벼움은 절반)
  glowFx.setBudget(P.fx, P.fxDensity); softFx.setBudget(Math.round(P.fx * 0.3), P.fxDensity); // 가루 · 연출 파티클 한도 · 양
  fireN = P.fires;
  firePool.forEach((L, i) => { L.visible = i < fireN; if (i >= fireN) L.intensity = 0; });
  gfx.level = level;
  document.body.dataset.gfx = level;
  resize();
}
applyQuality(gfx.level);
// 자동: 느리면 한 단계씩 내린다 (점검 브라우저는 재지 않는다: 기준 캡처가 흔들리지 않게)
const autoQ = new AutoQuality({
  enabled: gfx.mode === 'auto' && (!navigator.webdriver || /[?&]gfxauto\b/.test(location.search)),
  level: gfx.level,
  onDrop: (to, from, ratio) => {
    applyQuality(to);
    saveAuto(to);
    renderGfxBtn();
    UI.toast(`🖥️ 화면이 버벅여서 화질을 「${LABEL[to]}」으로 낮췄어요 · 오른쪽 위 화질 버튼에서 바꿀 수 있어요`, 5200);
    track('gfx_auto', { from, to, ratio: Math.round(ratio * 100) });
  },
});
const fogTarget = { color: new THREE.Color(scene.fog.color), near: scene.fog.near, far: scene.fog.far };
const fogBase = new THREE.Color(scene.fog.color), fogLook = new THREE.Vector3(), SUNSET_FOG = new THREE.Color('#52244a'); // 지평선 노을빛과 이어지게 (너무 검으면 앉았을 때 지평선이 어두운 띠로 보인다)
const sunsetK = () => (themeOf(state.theme).sky?.stars > 0.5 ? 1 : 0.35);
let themeLight = { hemi: 1, ambient: 1, moon: 1 };
function applyTheme(id, { announce = true } = {}) {
  const th = themeOf(id);
  const changed = state.theme !== th.id;
  state.theme = th.id;
  world.setTheme(th);
  world.sky.setTheme(th);
  tentRoom.setTheme(th);
  fogTarget.color.set(th.fog.color); fogTarget.near = th.fog.near; fogTarget.far = th.fog.far;
  themeLight = th.light;
  precip.set(th.precip);
  // 비 · 눈이 들어오지 않는 지붕: 텐트 (늘) + 바깥 모닥불 천막 (천막이 있는 테마만)
  const shel = TENTS.map((t) => ({ x: t.x, z: t.z, r: CFG.TENT_R + 0.3, h: 6.8 }));
  if (th.tarps) for (const p of world.tarpSpots) shel.push({ x: p.x, z: p.z, r: 3.9, h: 5.8 }); // 천막 (높이 4.1m + 이중 지붕)
  precip.setShelters(shel);
  sound.setAmbience(th.ambience);
  for (const ch of [npc, keeper, arenaKeeper, ...crowd.list.map((n) => n.ch), me?.char, ...[...remotes.values()].map((r) => r.ch)]) ch?.setOutfit(th.outfit);
  residents.setOutfit(th.outfit);
  // 🎤 아레나도 같은 테마로 (땅 · 나무 위 눈 · 전구 · 크리스마스 트리 · 관객 우산/모자 · 밴드 옷 · 하늘길)
  arena.setTheme(th, world.xmasTree); fans.setTheme(th); band.setTheme(th);
  document.body.dataset.theme = th.id;
  if (announce && changed && th.toast && me) UI.toast(th.toast, 5200);
}

const npc = new Character({ skin: '#ffe0c7', hair: '#c9a2ff', shirt: '#6a4bb5', pants: '#3a2f5a', hat: 'wizard' }, { name: '✨ 루미 · 가루 상인', kind: 'npc' });
npc.root.position.set(NPC.x, 0, NPC.z);
npc.root.rotation.y = NPC.ry;
npc.root.userData.ds = 'npc-lumi'; // 디자인 시스템 이름표
scene.add(npc.root);

// NPC 보리 (장작 창고지기)
const keeper = new Character({ skin: '#f6c9a0', hair: '#6b4a2b', shirt: '#5f8a45', pants: '#5a4330', hat: 'beanie' }, { name: '📦 보리 · 장작 창고지기', kind: 'npc' });
keeper.root.position.set(KEEPER.x, 0, KEEPER.z);
keeper.root.rotation.y = KEEPER.ry;
keeper.root.userData.ds = 'npc-bori'; // 디자인 시스템 이름표
scene.add(keeper.root);

// 🏡 캠핑장 주민 (v1.22.0): 숲길 8명 · 캠핑장 4명 · 날씨 · 밤 주민 · 찻집 할머니
const residents = createResidents(scene);

// ---------------------------------------------------------------- 상태
const state = {
  myId: null,
  inv: { wood: 0, stored: 0, chops: 0, powders: [], quest: null, coins: 0, coinDay: '', shareDay: '' },
  sitting: null,
  lounge: null, // 앉은 벤치 {i, seat, at}
  tent: null,   // 지금 들어가 있는 글램핑 텐트 (TENTS 항목)
  tentMusic: new Map(), // 텐트 id -> 블루투스 스피커로 트는 곡
  clockOffset: 0,
  lastSent: { x: 0, z: 0, ry: 0, anim: '' },
  lookT: 0, lastLook: { y: 99, p: 0 },
  sendT: 0,
  shake: 0,
  zone: 'camp', // 'camp' | 'arena' (열기구로 오간다)
  ride: null,   // 열기구 바구니 자리 (타고 있을 때)
  festUntil: 0, // ✦ 페스티벌 가루 연출 중 (무대 조명이 더 세게)
};
state.theme = 'clear';
let me = null; // { char, x, z, ry }
const remotes = new Map();
const keys = new Set();
const serverNow = () => Date.now() + state.clockOffset;

const ORBIT_MIN = 0.14; // 이보다 더 내리면 카메라가 고개를 들어 하늘을 본다
const PITCH_MIN = ORBIT_MIN - 1.0;
// 시점: 'tp' 3인칭 / 'fp' 1인칭 (기기에 기억)
// 서 있을 때는 늘 3인칭, 모닥불에 앉으면 1인칭으로 바뀐다 (앉은 동안 🎥 버튼 · V로 3인칭 ↔ 1인칭)
const view = { fp: false };
// 휠 · 두 손가락 줌 범위. 처음 들어오면 가장 넓게(멀리) 보여 답답하지 않게 (v1.21.2), 그 뒤로는 사용자가 정한 대로
const CAM_DIST_MIN = 6, CAM_DIST_MAX = 26;
const CAM_START_DIST = 20; // 처음 들어왔을 때 카메라 거리 (넓게 보이되 캐릭터가 너무 작지 않게)
const CAM_START_PITCH = 0.24; // 처음 들어왔을 때 카메라 높이 (낮을수록 하늘이 많이 보인다. 기본 0.78 은 땅만 보였다)
const cam = { look: 0, yaw: 0, pitch: 0.78, dist: CAM_START_DIST, curDist: 34, target: new THREE.Vector3(0, 0, 0), dragging: false };

// ---------------------------------------------------------------- 입장 화면
/** 기기마다 고정된 무작위 ID (장작 저장용, 다른 사람에게는 공개되지 않음) */
function devicePid() {
  let pid = store.get('pid', null);
  if (typeof pid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(pid)) {
    const b = new Uint8Array(18);
    crypto.getRandomValues(b);
    pid = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    store.set('pid', pid);
  }
  return pid;
}
const look = store.get('look', null) || {
  skin: LOOKS.skin[0],
  hair: LOOKS.hair[Math.floor(Math.random() * LOOKS.hair.length)],
  shirt: LOOKS.shirt[Math.floor(Math.random() * LOOKS.shirt.length)],
  pants: LOOKS.pants[0],
  hat: 'straw',
};
$('nameInput').value = store.get('name', '');
const preview = new Preview($('previewCanvas'));
preview.setLook(look);
const syncName = () => { $('previewName').textContent = $('nameInput').value.trim() || '캠퍼'; };
$('nameInput').addEventListener('input', syncName);
syncName();
document.querySelectorAll('.swatches').forEach((box) => {
  const key = box.dataset.key;
  for (const c of LOOKS[key]) {
    const s = document.createElement('div');
    s.className = `swatch${look[key] === c ? ' sel' : ''}`;
    s.style.background = c;
    s.onclick = () => {
      look[key] = c;
      box.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel'));
      s.classList.add('sel');
      sound.init(); sound.pop();
      preview.setLook(look);
    };
    box.appendChild(s);
  }
});
document.querySelectorAll('.choices').forEach((box) => {
  for (const h of LOOKS.hat) {
    const s = document.createElement('div');
    s.className = `choice${look.hat === h.id ? ' sel' : ''}`;
    s.textContent = h.name;
    s.onclick = () => {
      look.hat = h.id;
      box.querySelectorAll('.choice').forEach((x) => x.classList.remove('sel'));
      s.classList.add('sel');
      sound.init(); sound.pop();
      preview.setLook(look);
    };
    box.appendChild(s);
  }
});

function doJoin() {
  const btn = $('joinBtn');
  if (btn.disabled || state.myId) return;
  btn.disabled = true;
  btn.textContent = '입장 중…';
  sound.init();
  const name = $('nameInput').value.trim();
  store.set('name', name);
  store.set('look', look);
  net.send({ t: 'join', name, look, pid: devicePid(), save: store.get('save', null), quota: store.get('quota', null) });
}
$('joinBtn').onclick = doJoin;
// 입장 버튼이 카드 아래에 붙어 있는지(sticky) 확인해 표시: 붙어 있을 때만 아래 내용을 가린다
{
  const card = document.querySelector('.join-card'), jb = $('joinBtn');
  const end = document.createElement('div'); jb.after(end);
  const sync = () => jb.classList.toggle('stuck', end.getBoundingClientRect().top - jb.getBoundingClientRect().bottom > 1);
  card.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  new ResizeObserver(sync).observe(card);
  requestAnimationFrame(sync);
}
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

$('helpBtn').onclick = () => $('help').classList.remove('hidden');

// ---------------------------------------------------------------- 모바일: 오른쪽 메뉴(독) 접기 · 펼치기
// 처음에는 ☰ 버튼 하나만 (접속자 수 배지). 누르면 펼쳐지고, 메뉴를 하나 고르거나 화면을 만지면 다시 접힌다
function setDock(open) {
  document.body.classList.toggle('dock-open', open);
  $('dockToggle').innerHTML = icon(open ? 'close' : 'menu');
  $('dockToggle').title = open ? '메뉴 접기' : '메뉴 펼치기';
  $('dockToggle').setAttribute('aria-expanded', String(open));
}
$('dockToggle').onclick = (e) => { e.stopPropagation(); setDock(!document.body.classList.contains('dock-open')); };
$('topright').addEventListener('click', (e) => {
  if (isTouch && e.target.closest('.icon-btn') && e.target.id !== 'dockToggle') setTimeout(() => setDock(false), 250);
});
renderer.domElement.addEventListener('pointerdown', () => { if (document.body.classList.contains('dock-open')) setDock(false); });

// 상태창(왼쪽 위) 높이가 바뀌면(루미의 부탁 줄 등) 남은 장작 · 알림을 그 바로 아래로
if (typeof ResizeObserver !== 'undefined') {
  const placeUnderStatus = () => document.documentElement.style.setProperty('--status-b', `${Math.round($('status').getBoundingClientRect().bottom)}px`);
  new ResizeObserver(placeUnderStatus).observe($('status'));
  addEventListener('resize', placeUnderStatus);
}
function setView(fp, { silent = false } = {}) {
  if (fp && !state.sitting && !state.lounge) fp = false; // 서 있을 때는 3인칭만
  const changed = view.fp !== fp;
  view.fp = fp;
  cam.look = state.sitting ? -0.14 : 0;
  fpPos.set(0, 0, 0);
  // 앉아 있을 때 보이는 시점 버튼: 지금과 반대 시점을 알려 준다
  // 작은 아이콘 버튼: 누르면 바뀔 시점을 보여 준다 (설명은 툴팁)
  $('seatViewBtn').innerHTML = icon(fp ? 'camera' : 'eye');
  $('seatViewBtn').title = `${fp ? '3인칭' : '1인칭'}으로 보기${isTouch ? '' : ' (V)'}`;
  $('seatViewBtn').setAttribute('aria-label', $('seatViewBtn').title);
  document.body.classList.toggle('fp', fp);
  if (changed && !fp && me && state.sitting && state.tent) { // 텐트 화로 3인칭: 내 옆 뒤쪽 높은 곳에서 화로와 둘레 소파를 내려다본다
    const pd = pits.get(state.sitting.pit);
    cam.yaw = Math.atan2(me.x - pd.pos.x, me.z - pd.pos.z) + 0.75; cam.pitch = 0.75; cam.dist = 6;
  }
  if (changed && !silent && me) {
    track('view_toggle', { view: fp ? 'fp' : 'tp' });
    UI.toast(fp ? '👁️ 1인칭 시점' : '🎥 3인칭 시점', 1600);
  }
}
$('seatViewBtn').onclick = (e) => { e.currentTarget.blur(); setView(!view.fp); };
// 💌 친구 초대: 휴대폰은 공유 창, PC는 링크 복사. 공유하면 루미의 「친구 초대」 부탁이 채워진다
$('shareBtn').onclick = (e) => { e.currentTarget.blur(); $('shareBtn').classList.remove('pulse'); shareInvite(); };
async function shareInvite() {
  const url = `${location.origin}/?utm_source=friend&utm_medium=share&utm_campaign=invite`;
  const text = '🔥 같이 불멍하자! 장작 패고 모닥불 피우고, 별 보면서 쉬는 3D 캠핑장이야';
  let ok = false;
  try {
    if (navigator.share) { await navigator.share({ title: '불멍 캠핑장', text, url }); ok = true; }
    else { await navigator.clipboard.writeText(`${text}\n${url}`); ok = true; UI.toast('초대 링크를 복사했어요! 친구에게 붙여 넣어 보내 주세요 💌'); }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      try { await navigator.clipboard.writeText(url); ok = true; UI.toast('초대 링크를 복사했어요! 💌'); } catch { UI.toast(`이 주소를 친구에게 보내 주세요: ${location.origin}`, 6000); }
    }
  }
  if (ok) { net.send({ t: 'quest', ev: 'share' }); track('share', { method: navigator.share ? 'share' : 'copy' }); }
  return ok;
}
initAnalytics();
fillIcons(); // 버튼 아이콘 (나무에 새긴 선 아이콘)
$('seatViewBtn').innerHTML = icon('eye'); $('seatViewBtn').title = `1인칭으로 보기${isTouch ? '' : ' (V)'}`; // 처음엔 3인칭 (setView는 카메라 준비 뒤에 쓴다)
initFullscreen();
// 🗺️ 지도 여닫기 (v1.21.1): 휴대폰 · 좁은 창은 기본 닫힘(map-open 으로 열기), 넓은 PC 는 기본 열림(map-closed 로 접기, 기억함)
const mapFolds = () => isTouch || innerWidth <= 640; // 지도가 접혀 있는 화면
const mapShown = () => (mapFolds() ? document.body.classList.contains('map-open') : !document.body.classList.contains('map-closed'));
function setMap(open) {
  if (mapFolds()) document.body.classList.toggle('map-open', open);
  else { document.body.classList.toggle('map-closed', !open); store.set('mapClosed', !open); }
  $('mapToggle').title = open ? '지도 닫기' : '지도 열기';
  $('mapToggle').classList.toggle('on', open);
}
document.body.classList.toggle('map-closed', !!store.get('mapClosed', false));
setMap(mapShown());
$('mapToggle').onclick = () => setMap(!mapShown());
$('mapClose').onclick = () => setMap(false);
// 휴대폰: 펼친 지도를 한 번 누르면 바로 닫힌다 (☰ 메뉴를 다시 열 필요 없이)
$('mapPanel').addEventListener('click', () => { if (mapFolds() && mapShown()) setMap(false); });
$('status').addEventListener('click', () => { if (isTouch) document.body.classList.toggle('quest-open'); });
$('helpClose').onclick = () => $('help').classList.add('hidden');
// 소리 장치가 꺼져 있으면(아이패드 · 아이폰: 화면을 끄거나 다른 앱에 다녀온 뒤) 화면을 누를 때마다 다시 켠다
for (const t of ['touchend', 'click', 'keydown']) addEventListener(t, () => sound.unlock(), { capture: true, passive: true });
// 🖥️ 화질 버튼: 자동 → 높음 → 보통 → 가벼움 → 자동 (휴대폰은 높음 없음)
function renderGfxBtn() {
  const b = $('gfxBtn');
  const t = gfx.mode === 'auto' ? `화질: 자동 (지금 ${LABEL[gfx.level]})` : `화질: ${LABEL[gfx.mode]}`;
  b.title = t; b.setAttribute('aria-label', t);
  b.dataset.level = gfx.level;
}
/** 화질 고르기: 자동 · 높음 · 보통 · 가벼움 */
function setGfxMode(mode) {
  gfx.mode = mode;
  saveMode(mode);
  autoQ.on = mode === 'auto';
  const level = mode === 'auto' ? gfx.top : mode; // 자동으로 돌아가면 가장 높은 단계부터 다시 잰다
  if (mode === 'auto') saveAuto(level);
  autoQ.level = level; autoQ.reset(3000); autoQ.slow = 0;
  applyQuality(level);
  renderGfxBtn();
  const lowNow = level !== 'high' || isTouch;
  UI.toast(`🖥️ 화질 「${LABEL[mode]}」${mode === 'auto' ? ' · 버벅이면 알아서 낮춰요' : ''}${lowNow !== lowSpec ? ' · 풀 · 꽃 밀도는 다시 들어오면 바뀌어요' : ''}`, 3200);
  track('gfx_set', { mode });
}
function renderGfxMenu() {
  for (const b of $('gfxMenu').querySelectorAll('.gfx-opt')) b.classList.toggle('on', b.dataset.mode === gfx.mode);
  $('gfxAutoNow').textContent = gfx.mode === 'auto' ? `버벅이면 알아서 낮춰요 · 지금 ${LABEL[gfx.level]}` : '버벅이면 알아서 낮춰요';
}
function setGfxMenu(open) {
  const m = $('gfxMenu');
  if (!open) { m.classList.add('hidden'); return; }
  renderGfxMenu();
  m.classList.remove('hidden');
  // 버튼 바로 아래 (화면 밖으로 나가지 않게). 휴대폰 메뉴가 접혀 버튼이 안 보이면 오른쪽 위에
  const r = $('gfxBtn').getBoundingClientRect(), w = m.offsetWidth;
  const left = r.width ? Math.min(innerWidth - w - 10, Math.max(10, r.right - w)) : innerWidth - w - 16;
  m.style.left = `${left}px`; m.style.right = 'auto';
  m.style.top = `${(r.height ? r.bottom : 60) + 8}px`;
}
$('gfxBtn').onclick = (e) => { e.currentTarget.blur(); setGfxMenu($('gfxMenu').classList.contains('hidden')); };
$('gfxMenu').addEventListener('click', (e) => {
  const b = e.target.closest('.gfx-opt');
  if (!b) return;
  if (b.dataset.mode !== gfx.mode) setGfxMode(b.dataset.mode);
  setGfxMenu(false);
});
addEventListener('pointerdown', (e) => { if (!e.target.closest('#gfxMenu, #gfxBtn')) setGfxMenu(false); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape') setGfxMenu(false); });
renderGfxBtn();
$('soundBtn').onclick = (e) => {
  sound.init();
  const muted = sound.toggle();
  e.currentTarget.innerHTML = icon(muted ? 'mute' : 'sound');
  music.muted = muted;
};

// ---------------------------------------------------------------- 네트워크
const net = new Net();
net.on('theme', (m) => applyTheme(m.theme)); // 🌦️ 날씨 · 이벤트로 테마가 바뀌었다

// 공개 서버일 때만 '친구에게 주소 공유' 안내를 띄운다
fetch('/api/info').then((r) => r.json()).then(({ urls, public: isPublic }) => {
  if (!isPublic || !urls?.length) return;
  const html = `🔗 친구에게<br><b>${urls[0]}</b><br>주소를 보내면 같은 캠핑장에서 만나요`;
  $('lanInfo').innerHTML = html;
  $('lanInfo').classList.remove('hidden');
  $('lanHelp').innerHTML = html;
  $('lanHelp').classList.remove('hidden');
}).catch(() => {});

net.on('open', () => {
  $('joinBtn').disabled = false;
  $('joinBtn').textContent = '캠핑장 입장 🏕️';
  // 화면을 껐다 켜서 다시 접속한 경우: 입장 화면 없이 바로 들어간다
  let auto = false;
  try { auto = sessionStorage.getItem('autojoin') === '1'; sessionStorage.removeItem('autojoin'); } catch { /* 무시 */ }
  if (auto) {
    doJoin();
    // 자동 입장은 터치 없이 일어나서 소리가 잠겨 있다. 처음 화면을 누를 때 소리를 켠다
    // (iOS 는 pointerdown 을 「사용자가 누름」으로 쳐 주지 않을 때가 있어 touchend · click 에서도)
    const wake = () => { sound.init(); for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) removeEventListener(t, wake, true); };
    for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(t, wake, { capture: true });
  }
});

// ---- 연결이 끊기면 (폰 화면 끄기, 앱 전환, 서버 재시작) 저절로 다시 접속
// 서버가 응답하면 새로 고쳐서 바로 입장한다. 장작·가루는 이 기기에 저장돼 있어서 그대로 돌아온다
let reconnecting = false;
function reconnect() {
  if (reconnecting || state.replaced) return;
  reconnecting = true;
  const box = $('disconnected');
  box.querySelector('.title').textContent = '다시 연결하는 중… 🌙';
  box.querySelector('.btn').classList.add('hidden');
  box.classList.remove('hidden');
  const attempt = async (n) => {
    if (document.hidden) { setTimeout(() => attempt(n), 1000); return; } // 화면이 꺼져 있으면 켜질 때까지 기다림
    try {
      const r = await fetch('/api/info', { cache: 'no-store' });
      if (r.ok) {
        try { if (me) sessionStorage.setItem('autojoin', '1'); } catch { /* 무시 */ }
        location.reload();
        return;
      }
    } catch { /* 아직 연결 안 됨 */ }
    if (n >= 30) {
      box.querySelector('.title').textContent = '연결이 끊겼어요 🌙';
      box.querySelector('.btn').classList.remove('hidden');
      reconnecting = false;
      return;
    }
    setTimeout(() => attempt(n + 1), Math.min(4000, 700 + n * 300));
  };
  attempt(0);
}
net.on('close', reconnect);
// 화면을 다시 켰을 때: 연결이 겉으로는 살아 있어도 실제로는 죽어 있을 수 있어서 확인한다
let pongAt = 0;
net.on('pong', () => { pongAt = performance.now(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden || reconnecting || state.replaced) return;
  if (net.ws.readyState > 1) { reconnect(); return; }
  const sent = performance.now();
  net.send({ t: 'ping' });
  setTimeout(() => {
    if (!document.hidden && pongAt < sent && !reconnecting) { try { net.ws.close(); } catch { /* 무시 */ } reconnect(); }
  }, 3500);
});
net.on('quota', (m) => store.set('quota', { data: m.data, sig: m.sig })); // 서버 재시작 대비 검색 사용량 보관
net.on('replaced', () => {
  state.replaced = true;
  $('disconnected').querySelector('.title').textContent = '다른 창에서 접속했어요 🌙';
});

net.on('hello', (m) => {
  state.clockOffset = m.now - Date.now();
  for (const p of m.pits) pits.get(p.id)?.setState(p);
  state.tentMusic.clear();
  for (const r of m.tentMusic || []) state.tentMusic.set(r.tent, r.music);
  for (const p of m.players) addRemote(p);
  if (m.arena) arena.setState(m.arena);
  state.pendingTheme = m.theme || 'clear';
  applyTheme(state.pendingTheme, { announce: false });
  updateOnline();
});

net.on('welcome', (m) => {
  state.myId = m.id;
  const char = new Character(look, { name: m.me.name, kind: 'me' });
  char.root.position.set(m.me.x, 0, m.me.z);
  scene.add(char.root);
  me = { char, x: m.me.x, z: m.me.z, ry: m.me.ry, name: m.me.name, tag: m.me.tag };
  state.zone = m.zone || 'camp'; state.ride = null;
  char.setOutfit(themeOf(state.theme).outfit);
  if (themeOf(state.theme).toast) setTimeout(() => UI.toast(themeOf(state.theme).toast, 5200), 2600); // 들어오자마자 오늘의 캠핑장 안내
  // 첫 시점 (v1.21.2): 가장 넓게 · 낮게 깔아 하늘과 지평선이 보이게, 첫 목적지인 루미의 가루 공방(빛기둥) 쪽을 바라본다. 그 뒤로는 사용자가 정한 대로
  cam.yaw = Math.atan2(me.x - NPC.x, me.z - NPC.z); cam.pitch = CAM_START_PITCH; cam.dist = CAM_START_DIST;
  if (state.zone === 'arena') cam.yaw = 0; // 아레나에서 다시 들어오면 무대 쪽을 본다
  $('join').classList.add('hidden');
  preview.dispose();
  $('hud').classList.remove('hidden');
  const firstTime = !store.get('helpSeen', false);
  requestBoard();
  track('game_join', { device: isTouch ? 'mobile' : 'pc', view: view.fp ? 'fp' : 'tp', returning: !firstTime, gfx: gfx.level });
  if (gfx.soft && !store.get('softTip', false)) { // 그래픽 가속이 꺼진 브라우저: 가볍게 + 켜는 법 안내 (한 번만)
    store.set('softTip', true);
    setTimeout(() => UI.tip('🖥️ 브라우저 그래픽 가속이 꺼져 있어 화면이 느릴 수 있어요 · 크롬 설정 → 시스템 → 「가능한 경우 그래픽 가속 사용」을 켜 주세요', 8000), 3000);
  }
  if (!state.hbStarted) { state.hbStarted = true; startHeartbeat(() => ({ sitting: !!state.sitting, view: view.fp ? 'fp' : 'tp', zone: state.ride != null ? 'sky' : state.zone })); }
  if (firstTime) {
    $('help').classList.remove('hidden');
    store.set('helpSeen', true);
    store.set('coinIntroSeen', true); // 처음 온 사람은 안내서에 코인 · 텐트 이야기가 들어 있다
  } else if (!store.get('coinIntroSeen', false)) {
    // 원래 오던 사람: v1.15 새 소식(코인 · 루미 상점 · 텐트)을 한 번 알려 준다
    store.set('coinIntroSeen', true);
    setTimeout(() => $('coinIntro').classList.remove('hidden'), 900);
  }
  const hintN = store.get('touchHintN', 0);
  const showHint = touch && hintN < 3;
  if (showHint) store.set('touchHintN', hintN + 1);
  // 터치 안내 → (세로로 들고 있으면) 가로모드 추천, 도움말이 떠 있으면 닫은 뒤에
  const afterHelp = () => {
    if (showHint) touch.showHint();
    const rotN = store.get('rotateTipN', 0);
    if (touch && rotN < 3) {
      setTimeout(() => {
        if (innerHeight <= innerWidth) return;
        store.set('rotateTipN', rotN + 1);
        UI.tip('📱 가로로 돌리면 더 넓게 볼 수 있어요', 5000);
      }, showHint ? 5600 : 1500);
    }
  };
  if (firstTime) $('helpClose').addEventListener('click', afterHelp, { once: true });
  else afterHelp();
  const r = m.restored;
  if (r && (r.wood || r.powders || r.stored)) {
    UI.addChat('', `🎒 가지고 있던 장작 ${r.wood}개${r.powders ? `, 가루 ${r.powders}개` : ''}를 그대로 챙겨 왔어요!${r.stored ? ` (창고에 ${r.stored}개)` : ''}`, true);
  } else UI.addChat('', '🌙 불멍 캠핑장에 오신 걸 환영해요! 동쪽에서 장작을 패 보세요.', true);
  updateOnline();
});

net.on('join', (m) => { addRemote(m.player); updateOnline(); });
// ---------------------------------------------------------------- 🎈 열기구 · 🎤 아레나
net.on('arena', (m) => { arena.setState(m); if (!$('arenaModal').classList.contains('hidden')) renderArenaTable(); });
net.on('ride', (m) => {
  if (m.id === state.myId) {
    if (!me) return;
    if (m.slot != null) {
      state.ride = m.slot;
      setView(false, { silent: true });
      cam.pitch = Math.max(cam.pitch, 0.35); cam.dist = Math.max(cam.dist, 15); // 커진 열기구가 다 보이게
      UI.toast(`🎈 열기구에 탔어요! ${arena.b.at ? `${Math.ceil(arena.b.next)}초 뒤 출발해요` : ''} · 출발 전엔 E로 내릴 수 있어요`, 3600);
      track('balloon_board', { from: state.zone });
    } else {
      state.ride = null;
      me.x = m.x; me.z = m.z;
      if (m.zone) state.zone = m.zone;
    }
    return;
  }
  const r = remotes.get(m.id);
  if (!r) return;
  r.ride = m.slot;
  if (m.slot == null) { r.tx = m.x; r.tz = m.z; r.ch.root.position.set(m.x, world.heightAt(m.x, m.z), m.z); }
});
net.on('arrive', (m) => {
  if (m.zone === 'arena') {
    cam.yaw = 0; // 무대를 바라본다
    UI.toast('🎤 불멍 아레나에 도착했어요! 객석 모닥불에 앉아 무대를 즐겨요 · 돌아갈 땐 뒤쪽 승강장에서', 5200);
    const nx = arena.show ? null : arena.next(serverNow());
    if (arena.show) setTimeout(() => UI.tip(`🎵 지금 무대: 「${arena.show.title}」 · ${arena.show.byName}`, 4200), 1800);
    else if (nx) setTimeout(() => UI.tip(`📅 다음 무대 ${kstWhen(nx.at)} 「${nx.title}」`, 4200), 1800);
  } else UI.toast('🏕️ 캠핑장으로 돌아왔어요', 3000);
  track('balloon_arrive', { zone: m.zone });
});
net.on('festBought', (m) => {
  const seller = crowd.list.find((n) => n.p.id === 'seller');
  if (seller) { seller.ch.say('고마워요! 객석 모닥불에서 뿌려 봐요 ✨'); seller.ch.play('hop'); }
  UI.toast(`${m.powder.name}를 받았어요! 객석 모닥불에 앉아 뿌려 보세요 ✨`, 4200);
  sound.gift();
  track('festival_buy');
});
net.on('festFail', (m) => UI.toast(m.reason === 'wood' ? `장작이 ${CFG.FESTIVAL_PRICE}개 필요해요 🪵 (캠핑장에서 패 오거나 창고에서 찾아와요)` : '가방이 가득 찼어요'));
net.on('carry', (m) => remotes.get(m.id)?.ch.setCarry(m.n));
net.on('leave', (m) => {
  const r = remotes.get(m.id);
  if (r) { r.ch.dispose(); remotes.delete(m.id); }
  updateOnline();
});

net.on('snap', (m) => {
  const est = m.now - Date.now();
  state.clockOffset = state.clockOffset * 0.9 + est * 0.1;
  for (const [id, x, z, ry, anim, ly, lp] of m.p) {
    if (id === state.myId) continue;
    const r = remotes.get(id);
    if (!r) continue;
    r.tx = x; r.tz = z; r.try = ry; r.anim = anim;
    r.ly = ly ?? null; r.lp = lp || 0;
  }
});

net.on('inv', (m) => {
  if (m.save) store.set('save', m.save); // 서버가 서명한 백업 (서버가 재시작돼도 장작 복원)
  const prev = state.inv;
  state.inv = {
    wood: m.wood, stored: m.stored || 0, chops: m.chops, powders: m.powders, quest: m.quest || null,
    coins: m.coins ?? 0, coinDay: m.coinDay || '', shareDay: m.shareDay || '', eggDay: m.eggDay || '',
    resDay: m.resDay || '', resMet: m.resMet || [],
  };
  world.egg.visible = state.inv.eggDay !== kstDay(); // 오늘 이미 주웠으면 내 화면에서는 숨긴다
  if (storeIsOpen()) renderStore(prev);
  if (shopIsOpen()) renderShop();
  setCoins(state.inv.coins, prev.coins);
  if (m.gained && me && state.lastStumpIdx != null) splitLog(state.lastStumpIdx, me.char);
  me?.char.setCarry(m.wood);
  refreshInventory();
  if (m.gained && me) {
    track('wood_chop', { wood: m.wood });
    floatText('+1 🪵', me.char.root.position.clone().setY(2.55));
    sound.wood();
    if (m.wood === CFG.WOOD_PER_FIRE) UI.toast('장작 5개 완성! 글램핑장 앞 화로에 쌓아 불을 피워 봐요 🔥');
    if (m.wood === CFG.MAX_WOOD) UI.toast(`장작이 ${CFG.MAX_WOOD}개 가득! 북서쪽 창고지기 보리에게 맡기면 더 팰 수 있어요 📦`);
  }
  if (prev.powders.length < m.powders.length) sound.gift();
});

// ---------------------------------------------------------------- 장작 창고 (창고지기 보리)
const STORE_SAY = {
  hello: ['장작은 내가 잘 맡아 둘게! 🪵', '어서 와! 오늘도 장작 패느라 수고 많았지?', '창고는 네 기기에만 열리는 너만의 칸이야 📦'],
  put: (n) => `${n}개 받았어! 차곡차곡 쌓아 둘게 🪵`,
  take: (n) => `여기 ${n}개! 따뜻한 불 피우렴 🔥`,
  noWood: '손에 든 장작이 없네. 통나무 앞에서 패 오렴 🪓',
  storeFull: `창고가 꽉 찼어! (최대 ${CFG.MAX_STORED}개) 모닥불에 좀 쓰고 오렴`,
  handsFull: `손이 가득 찼어! (최대 ${CFG.MAX_WOOD}개) 화로에 쌓고 다시 오렴`,
  empty: '창고가 비어 있어. 장작을 패서 맡겨 보렴!',
};
const storeIsOpen = () => !$('storeModal').classList.contains('hidden');
function renderStore(prev) {
  const inv = state.inv;
  const hand = $('storeHand'), box = $('storeBox');
  hand.textContent = inv.wood; box.textContent = inv.stored;
  $('storeHandMax').textContent = `/ ${CFG.MAX_WOOD}`;
  $('storeBoxMax').textContent = `/ ${CFG.MAX_STORED}`;
  if (prev) {
    for (const [el, a, b] of [[hand, prev.wood, inv.wood], [box, prev.stored, inv.stored]]) {
      if (a !== b) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }
  }
  const canPut = inv.wood > 0 && inv.stored < CFG.MAX_STORED;
  const canTake = inv.stored > 0 && inv.wood < CFG.MAX_WOOD;
  for (const b of $('storeModal').querySelectorAll('[data-op]')) b.disabled = b.dataset.op === 'put' ? !canPut : !canTake;
}
/** 지금 있는 곳의 창고지기 (캠핑장 보리 · 아레나 콩이 — 같은 창고) */
const curKeeper = () => (state.zone === 'arena' ? { ch: arenaKeeper, ...ARENA.keeper } : { ch: keeper, ...KEEPER, name: '보리' });
function openStore() {
  const kp = curKeeper();
  faceTo(kp.x, kp.z);
  kp.ch.play('wave');
  $('storeTitle').textContent = state.zone === 'arena' ? `📦 ${kp.name}의 장작 창고 · 캠핑장 창고와 같아요` : '📦 보리의 장작 창고';
  $('storeSay').textContent = STORE_SAY.hello[Math.floor(Math.random() * STORE_SAY.hello.length)];
  renderStore();
  $('storeModal').classList.remove('hidden');
}
function closeStore() { $('storeModal').classList.add('hidden'); }
$('storeClose').onclick = closeStore;
/**
 * 창 바깥(어두운 배경)을 누르면 닫기. 누르기 시작한 곳과 뗀 곳이 모두 배경일 때만 닫는다.
 * 행동 버튼(📌 소식 등)을 누르는 순간 창이 열리면, 손을 뗄 때 생기는 클릭이 방금 열린 창의 배경에 떨어져
 * 열리자마자 닫히곤 했다(깜빡임). 예전에는 「열고 0.6초 동안은 무시」로 막았는데, 길게 누르거나 반응이 늦으면 그대로 닫혔다.
 */
function closeOnBackdrop(el, close) {
  let downOnBackdrop = false;
  el.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === el; });
  el.addEventListener('pointercancel', () => { downOnBackdrop = false; });
  el.addEventListener('click', (e) => {
    const ok = downOnBackdrop && e.target === el;
    downOnBackdrop = false;
    if (ok) close();
  });
}
closeOnBackdrop($('storeModal'), () => closeStore());
/**
 * 창 안의 버튼도 같은 문제(v1.23.1): 휴대폰 행동 버튼을 누르는 순간 창이 열리면, 손을 뗄 때 생기는 클릭이
 * 방금 열린 창의 「닫기」 같은 버튼에 떨어져 바로 닫혔다. 창 안에서 누르기 시작한 클릭만 받는다
 * (키보드 Enter · 코드로 누른 클릭은 detail 이 0 이라 그대로 통과)
 */
function guardStrayClicks(el) {
  let armed = false;
  el.addEventListener('pointerdown', () => { armed = true; }, true);
  el.addEventListener('click', (e) => {
    if (e.detail !== 0 && !armed) { e.stopPropagation(); e.preventDefault(); }
    armed = false;
  }, true);
  new MutationObserver(() => { if (!el.classList.contains('hidden')) armed = false; }).observe(el, { attributes: true, attributeFilter: ['class'] }); // 열릴 때마다 새로
}
for (const el of document.querySelectorAll('.overlay')) guardStrayClicks(el);
for (const b of $('storeModal').querySelectorAll('[data-op]')) {
  b.onclick = () => {
    const op = b.dataset.op;
    const n = b.dataset.n === 'all' ? CFG.MAX_STORED : Number(b.dataset.n);
    net.send({ t: 'store', op, n });
  };
}
net.on('stored', (m) => {
  if (m.n > 0) {
    $('storeSay').textContent = STORE_SAY[m.op](m.n);
    sound.wood();
    track('wood_store', { op: m.op, n: m.n });
  } else if (STORE_SAY[m.reason]) $('storeSay').textContent = STORE_SAY[m.reason];
});

// 루미의 부탁 한 줄 설명 (진행 수 포함)
function questProgress(q) {
  const def = QUESTS[q.i];
  if (def.type === 'sitSec') return `${Math.floor(q.p / 60)}분 ${q.p % 60}초 / ${def.goal / 60}분`;
  return `${q.p} / ${def.goal}`;
}
net.on('questDone', (m) => {
  UI.toast(`✨ 루미의 부탁 「${m.title}」 완료! 길 건너 루미에게 선물을 받으러 가요`, 4500);
  sound.gift();
  track('quest_done', { quest: m.title });
});

net.on('npc', (m) => {
  const q = m.quest;
  const pages = [];
  // 처음 만났을 때 · 부탁을 마쳤을 때만 대화로 들려주고, 나머지는 바로 가루 공방(상점)을 연다
  const talk = m.first || m.finished || m.rewardBlocked;
  const say = m.basic.length ? `마법 가루 ${m.basic.length}개를 채워 줬어! ✨ 기본 가루는 늘 공짜야`
    : m.full ? '가방이 가루로 꽉 찼네! 모닥불에 좀 뿌리고 오렴 🔥'
    : SHOP_SAY[Math.floor(Math.random() * SHOP_SAY.length)];
  if (!talk) {
    if (m.basic.length) npc.play('wave');
    openShop(say);
    return;
  }
  const chips = (list) => UI.powderGrid(list, 'sm');
  if (m.first) {
    pages.push('안녕! 나는 가루 공방의 루미야 ✨\n모닥불 색을 바꾸는 <b>마법 가루</b>를 만들어.');
    pages.push(`가루는 내가 늘 <b>${CFG.BASE_POWDERS}개까지</b> 채워 줄게.\n장작은 필요 없어! 다 쓰면 또 놀러 오렴.`);
  }
  if (m.finished) {
    pages.push(`와, 「${m.finished.title}」을(를) 해냈구나!\n정말 고마워 💜`);
    pages.push(`약속한 선물이야. 아주 특별한 가루지!\n${chips([m.reward])}`);
    npc.play('wave');
  } else if (m.rewardBlocked) {
    pages.push('부탁을 들어줬구나! 고마워 💜\n그런데 가방이 꽉 찼네… 모닥불에 가루를 하나 뿌리고 오면 선물을 줄게!');
  }
  if (m.basic.length) {
    pages.push(`자, 마법 가루 ${m.basic.length}개 채워 줬어.\n${chips(m.basic)}`);
    if (!m.finished) npc.play('wave');
  }
  if (m.first) pages.push(`그리고 <b>🪙 코인</b>이 있으면 공방에서 <b>✦ 특별한 가루</b>도 살 수 있어.\n코인은 매일 밤 12시에 ${CFG.DAILY_COINS}개로 채워져!`);
  if (!m.rewardBlocked) {
    const lap = q.lap ? ` <small>(${q.lap + 1}바퀴째)</small>` : '';
    if (m.first || m.finished) {
      pages.push(`그리고… 부탁이 하나 있어${lap}\n<b>「${q.title}」</b> — ${q.desc}`);
      pages.push(`해 주면 <b>${q.rewardName}</b>를 줄게!\n<small>왼쪽 위에서 진행 상황을 볼 수 있어</small>`);
    } else if (q.done) {
      pages.push(`「${q.title}」은(는) 벌써 해냈네!`);
    } else {
      pages.push(`부탁한 <b>「${q.title}」</b>은(는) 어떻게 돼 가? (${questProgress(q)})\n${q.desc}`);
    }
  }
  UI.dialog(pages, () => openShop(say));
});

// ---------------------------------------------------------------- 🪙 코인 · 루미의 가루 공방 (상점)
const SHOP_SAY = ['어서 와! 오늘은 어떤 가루로 모닥불을 물들여 볼래? ✨', '특별한 가루는 내가 밤새 정성껏 빻은 거야 💜', '코인이 모자라면 💌 친구에게 캠핑장을 알려 줘! 하루 한 번 보너스를 줄게'];
const shopIsOpen = () => !$('shopModal').classList.contains('hidden');
const shareBonusLeft = () => state.inv.shareDay !== state.inv.coinDay; // 오늘(서버 기준) 공유 보너스를 아직 안 받았는지
function setCoins(n, prev) {
  $('coinCount').textContent = n;
  if (prev != null && prev !== n) { const el = $('coinCount').parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function renderShop() {
  const inv = state.inv;
  $('shopCoins').textContent = inv.coins;
  const full = inv.powders.length >= CFG.MAX_POWDERS;
  $('shopShelf').innerHTML = Object.entries(LEGEND_POWDERS).filter(([, L]) => !L.gift).map(([id, L]) => {
    const have = inv.powders.filter((p) => p.effect === id && p.legend).length;
    const can = inv.coins >= CFG.LEGEND_PRICE && !full;
    return `<div class="shop-item">
      ${powderIco({ legend: true, effect: id, color: L.color }, 'shop-bottle')}
      <span class="shop-txt"><b>${escHtml(L.name)}</b><small>${escHtml(L.desc)}${have ? ` · 가방에 ${have}개` : ''}</small></span>
      <button class="shop-buy" data-effect="${id}"${can ? '' : ' disabled'}>${icon('coin')} ${CFG.LEGEND_PRICE}</button>
    </div>`;
  }).join('');
  for (const b of $('shopShelf').querySelectorAll('.shop-buy')) b.onclick = () => { b.disabled = true; net.send({ t: 'buy', effect: b.dataset.effect }); };
  // 루미의 부탁: 지금 부탁과 진행 상황 (부탁을 들어주면 받는 선물도)
  const q = inv.quest;
  if (q?.met) {
    const def = QUESTS[q.i];
    const pct = Math.round((q.p / def.goal) * 100);
    $('shopQuest').innerHTML = `<div class="sq-head">💜 루미의 부탁 <b>${escHtml(def.title)}</b> <span>${q.done ? '완료! 말을 걸면 선물을 줄게' : questProgress(q)}</span></div>
      <div class="sq-desc">${escHtml(def.desc)}</div><i class="sq-bar" style="--p:${pct}%"></i>
      <div class="sq-reward">선물: ${escHtml(LEGEND_POWDERS[def.reward].name)}</div>`;
    $('shopQuest').classList.remove('hidden');
  } else $('shopQuest').classList.add('hidden');
  const legend = inv.powders.filter((p) => p.legend).length;
  $('shopBag').innerHTML = `<div class="shop-bag-head">${icon('bag')} 내 가방 <small>가루 ${inv.powders.length}개${legend ? ` · ✦ ${legend}개` : ''}</small></div>`
    + (inv.powders.length ? UI.powderGrid(inv.powders, 'sm') : '<div class="bag-empty">가방이 비었어요</div>')
    + `<div class="shop-bag-note">기본 가루는 ${CFG.BASE_POWDERS}개까지 공짜로 채워 줘요</div>`;
  $('shopShare').classList.toggle('hidden', !shareBonusLeft());
}
function openShop(say) {
  faceTo(NPC.x, NPC.z);
  $('shopSay').textContent = say || SHOP_SAY[0];
  renderShop();
  $('shopModal').classList.remove('hidden');
  track('shop_open', { coins: state.inv.coins });
}
function closeShop() { $('shopModal').classList.add('hidden'); }
$('shopClose').onclick = closeShop;
closeOnBackdrop($('shopModal'), () => closeShop());
$('shopShare').onclick = () => shareInvite();
net.on('bought', (m) => {
  $('shopSay').textContent = `${m.powder.name} 여기 있어! 타오르는 모닥불에 뿌려 봐 ✨`;
  npc.play('wave');
  track('powder_buy', { powder: m.powder.effect, coins: state.inv.coins });
});
net.on('buyFail', (m) => {
  $('shopSay').textContent = m.reason === 'coins'
    ? `코인이 모자라… 밤 12시가 지나면 ${CFG.DAILY_COINS}개로 채워져.${shareBonusLeft() ? ` 💌 친구에게 알려 주면 오늘 ${CFG.SHARE_BONUS}개를 더 줄게!` : ''}`
    : '가방이 가루로 꽉 찼어! 모닥불에 좀 뿌리고 오렴 🔥';
  if (shopIsOpen()) renderShop();
});
net.on('coinBonus', (m) => {
  if (m.n > 0) {
    UI.toast(`💌 공유 고마워요! 코인 +${m.n} 🪙`, 4000);
    if (me) floatText(`+${m.n} 🪙`, me.char.root.position.clone().setY(2.55));
    sound.gift();
    track('coin_share_bonus', { n: m.n });
  } else UI.toast('오늘 공유 보너스는 이미 받았어요 · 밤 12시가 지나면 또 받을 수 있어요 💌', 3500);
});
net.on('coinReset', (m) => { UI.toast(`🌙 밤 12시가 지났어요! 코인이 ${m.n}개로 채워졌어요 🪙`, 5000); sound.gift(); });

// 코인 안내 (v1.15 새 소식, 한 번만)
function closeCoinIntro() {
  $('coinIntro').classList.add('hidden');
  // 💌 버튼 위치를 알려 준다 (모바일은 ☰ 메뉴 밖에 꺼내 둔 💌)
  $('shareBtn').classList.add('pulse');
  setTimeout(() => $('shareBtn').classList.remove('pulse'), 12000);
  UI.toast('오른쪽 위 편지 모양 버튼으로 언제든 친구를 초대할 수 있어요', 4500);
}
$('ciClose').onclick = closeCoinIntro;
$('ciShare').onclick = async () => { await shareInvite(); closeCoinIntro(); };

// ---------------------------------------------------------------- 차단 (이 기기에서만)
// 차단한 캠퍼의 채팅과 말풍선은 이 기기에서 보이지 않는다. 다시 접속해도 이어진다 (서버가 주는 표식 tag 기준)
const blocked = new Map((store.get('blocked', []) || []).filter((b) => b && typeof b.tag === 'string').map((b) => [b.tag, b.name]));
const saveBlocked = () => { store.set('blocked', [...blocked].map(([tag, name]) => ({ tag, name }))); renderBlockInfo(); };
function renderBlockInfo() {
  $('blockInfo').classList.toggle('hidden', !blocked.size);
  $('blockN').textContent = blocked.size;
}
renderBlockInfo();
let blockTarget = null;
$('chatLog').addEventListener('click', (e) => {
  const who = e.target.closest('.who');
  if (!who || !who.dataset.tag || who.dataset.tag === me?.tag) return;
  blockTarget = { tag: who.dataset.tag, name: who.dataset.name };
  $('blockName').textContent = blockTarget.name;
  $('blockModal').classList.remove('hidden');
});
$('blockCancel').onclick = () => $('blockModal').classList.add('hidden');
$('blockOk').onclick = () => {
  $('blockModal').classList.add('hidden');
  if (!blockTarget) return;
  blocked.set(blockTarget.tag, blockTarget.name);
  saveBlocked();
  // 이미 떠 있는 말풍선 · 채팅도 숨긴다
  for (const el of $('chatLog').querySelectorAll(`.msg[data-tag="${CSS.escape(blockTarget.tag)}"]`)) el.remove();
  for (const r of remotes.values()) if (r.tag === blockTarget.tag) r.ch.bubbleWrap?.replaceChildren();
  UI.toast(`🚫 ${blockTarget.name}님을 차단했어요. 이 기기에서 채팅이 보이지 않아요`, 4000);
  track('block');
  blockTarget = null;
};
$('unblockAll').onclick = () => { blocked.clear(); saveBlocked(); UI.toast('차단을 모두 풀었어요'); };

net.on('pit', (m) => {
  const pit = pits.get(m.pit.id);
  if (!pit) return;
  const prev = pit.state;
  pit.setState(m.pit);
  if (prev !== 'lit' && pit.state === 'lit') {
    effects.ignite(pit.pos);
    sound.ignite(volAt(pit.pos));
  } else if (m.fed && pit.state === 'lit') { // 누가 장작을 더 넣었다
    pit.flare();
    effects.ignite(pit.pos);
    if (m.fed === state.myId) {
      const rem = Math.ceil(pit.remaining(serverNow()) / 1000);
      UI.toast(`🪵 장작을 넣었어요 · 남은 시간 ${fmtRem(rem)}`, 2200);
      track('fire_feed', { pit: pit.id });
    }
  }
  if (prev === 'empty' && pit.state === 'stacked') sound.pop();
  if (m.burnedOut && state.sitting?.pit === pit.id) {
    UI.toast('장작이 다 타버렸어요… 다시 장작을 패러 가볼까요? 🪓');
  }
});

net.on('sat', (m) => {
  if (!me) return;
  state.sitting = { pit: m.pit, idx: m.idx, at: performance.now() };
  track('fire_sit', { pit: m.pit });
  setView(true, { silent: true }); // 앉으면 1인칭으로 (🎥 버튼으로 3인칭)
  me.x = m.x; me.z = m.z; me.ry = m.ry;
  // 앉으면 모닥불과 옆 TV·LP가 함께 보이도록 카메라를 TV 반대편에서 비스듬히 바라보게
  const mon = monitors.get(m.pit);
  const pd = FIRES.find((d) => d.id === m.pit);
  if (pd?.kind === 'stove') track('tent_sit', { tent: pd.tent });
  if (view.fp && pd) {
    cam.yaw = Math.atan2(-(pd.x - m.x), -(pd.z - m.z));
    cam.look = -0.14;
  } else if (pd?.kind === 'stove') {
    cam.yaw = Math.atan2(m.x - pd.x, m.z - pd.z) + 0.75; cam.pitch = 0.75; cam.dist = 6; // 내 옆 뒤쪽 높은 곳에서 화로와 소파를 내려다본다
  } else if (mon && pd) {
    // TV · LP가 함께 보이는 기본 방향 근처에서, 내 캐릭터가 카메라와 불 사이에 끼지 않는 각도를 고른다
    const base = Math.atan2(-(mon.pos.x - pd.x), -(mon.pos.z - pd.z));
    const seatA = Math.atan2(m.x - pd.x, m.z - pd.z);
    const diff = (a) => Math.abs(Math.atan2(Math.sin(a - seatA), Math.cos(a - seatA)));
    cam.yaw = [0.45, -0.45, 0.85, -0.85].map((o) => base + o).reduce((best, a) => (diff(a) > diff(best) ? a : best));
  }
  me.char.setAnim('sit');
  refreshInventory();
  if (pd?.kind === 'stove') {
    setTimeout(() => UI.tip('🔥 텐트 화로 불멍 · 가만히 있으면 화면이 조용해져요 (🎥 3인칭으로 보면 텐트 안이 다 보여요)', 4500), 1200);
  } else if (!stargazeHinted) {
    stargazeHinted = true;
    setTimeout(() => UI.tip(isTouch ? '🌌 오른쪽 화면을 위로 쓸어 올리면 밤하늘을 올려다볼 수 있어요' : '🌌 화면을 위로 드래그하면 밤하늘을 올려다볼 수 있어요', 5000), 2500);
  }
});

net.on('act', (m) => {
  const r = remotes.get(m.id);
  if (!r) return;
  if (m.a === 'chop') {
    const s = STUMPS[m.stump];
    r.ch.play('chop', {
      onImpact: () => {
        if (!s) return;
        effects.chips(new THREE.Vector3(s.x, 0.66, s.z));
        sound.chop(volAt(new THREE.Vector3(s.x, 0, s.z)) * 0.7);
        if (m.split) splitLog(m.stump, r.ch); else woodcut.hit(m.stump);
      },
    });
  } else if (m.a === 'place') {
    r.ch.play('place', { onImpact: () => woodcut.place(m.stump) });
  } else if (m.a === 'light') {
    r.ch.play('light');
  }
});

net.on('fx', (m) => {
  const pit = pits.get(m.pit);
  if (!pit) return;
  if (isArenaPit(pit) !== (state.zone === 'arena') && state.ride == null) return; // 다른 곳(캠핑장 · 아레나)의 가루는 보이지 않는다
  if (m.powder.effect === 'festival') { // ✦ 페스티벌 가루: 무대 전체가 터진다
    const thrower = m.by === state.myId ? me?.char : remotes.get(m.by)?.ch;
    const firePos = pit.pos.clone().setY(0.7);
    if (thrower) thrower.play('throw', { onImpact: () => effects.arc(thrower.handWorldPos(), firePos, m.powder.color, 0.45) });
    setTimeout(() => {
      pit.applyPowder(m.powder, serverNow());
      effects.play('festival', pit.pos, m.powder.color); // 뿌린 객석 모닥불에서 (무대 빛줄기도 함께 세진다)
      state.festUntil = performance.now() + 16000;
      sound.powder(1);
    }, thrower ? 750 : 0);
    UI.toast(m.by === state.myId ? `${m.powder.name}를 뿌렸어요! 무대를 보세요 🎆` : `🎆 ${m.name}님이 ${m.powder.name}를 뿌렸어요!`, 3600);
    return;
  }
  const thrower = m.by === state.myId ? me?.char : remotes.get(m.by)?.ch;
  const firePos = pit.pos.clone().setY(0.7);
  if (thrower) {
    thrower.play('throw', { onImpact: () => effects.arc(thrower.handWorldPos(), firePos, m.powder.color, 0.45) });
  }
  setTimeout(() => {
    pit.applyPowder(m.powder, serverNow());
    effects.play(m.powder.effect, pit.pos, m.powder.color);
    sound.powder(volAt(pit.pos));
  }, thrower ? 750 : 0);
  if (m.by === state.myId) UI.toast(`${m.powder.name}를 뿌렸어요 ✨`);
  else if (me && Math.hypot(me.x - pit.pos.x, me.z - pit.pos.z) < 14) UI.toast(`${m.name}님이 ${m.powder.name}를 뿌렸어요!`);
});

net.on('chat', (m) => {
  if (m.tag && blocked.has(m.tag) && m.id !== state.myId) return; // 차단한 캠퍼
  UI.addChat(m.name, m.text, false, { tag: m.tag, tent: !!m.tent });
  peekChat();
  const ch = m.id === state.myId ? me?.char : remotes.get(m.id)?.ch;
  ch?.say(m.text);
});
net.on('tentFull', (m) => {
  if (!me) return;
  me.x = m.x; me.z = m.z;
  UI.toast(`이 텐트는 꽉 찼어요 (최대 ${m.cap}명) 🏕️`);
});
net.on('sys', (m) => UI.addChat('', m.text, true));
net.on('eggFound', (m) => { // 숨겨진 가루병을 찾았다
  world.egg.visible = false;
  effects.play('stars', new THREE.Vector3(EGG.x, 0, EGG.z), m.powder.color);
  sound.powder?.(0.6);
  UI.toast(`✨ 숨겨진 가루병을 찾았어요! ${m.powder.name}를 받았어요`, 4200);
});
net.on('toast', (m) => UI.toast(m.text));

/** 통나무가 갈라짐 → 쪼갠 사람이 허리 숙여 줍고, 조각이 그 사람 장작 더미로 날아간다 */
function splitLog(idx, ch) {
  if (!woodcut.split(idx, ch)) return;
  ch.carryPending += 1;
  setTimeout(() => { if (!ch.busy()) ch.play('gather'); }, 420);
}

function addRemote(p) {
  if (p.id === state.myId || remotes.has(p.id)) return;
  const ch = new Character(p.look, { name: p.name });
  ch.setOutfit(themeOf(state.theme).outfit);
  ch.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
  ch.root.rotation.y = p.ry;
  scene.add(ch.root);
  remotes.set(p.id, { ch, tx: p.x, tz: p.z, try: p.ry, anim: p.anim, name: p.name, tag: p.tag, ride: p.ride ?? null });
  ch.setCarry(p.carry || 0);
}
function updateOnline() { UI.setOnline(remotes.size + (me ? 1 : 0)); }

// ---------------------------------------------------------------- 도우미
const tmpV = new THREE.Vector3();
function volAt(pos) {
  const d = camera.position.distanceTo(pos);
  return Math.max(0, Math.min(1, 1 - (d - 8) / 40));
}
// ---------------------------------------------------------------- 모닥불 음악
var music = new Music({
  layerParent: document.body,
  before: labelRenderer.domElement,
  hint: $('musicHint'),
  onDuration: (pit, vid, duration) => net.send({ t: 'musicInfo', pit, vid, duration }),
  onEnded: (pit, vid) => net.send({ t: 'musicEnd', pit, vid, reason: 'ended' }),
  onError: (pit, vid, code) => net.send({ t: 'musicEnd', pit, vid, reason: 'error', code }),
});
// 음악이 나오는 「방」: 앉아 있는 모닥불, 또는 들어가 있는 글램핑 텐트(블루투스 스피커). 텐트는 서 있어도 들린다
const tentMusicRoom = (t) => ({ id: t.id, tent: true, state: 'lit', music: state.tentMusic.get(t.id) || null });
const myMusicPit = () => {
  if (state.tent) return tentMusicRoom(state.tent); // 텐트 안이면 늘 스피커
  const p = state.sitting ? pits.get(state.sitting.pit) : null;
  return p && !isArenaPit(p) ? p : null; // 아레나 객석 모닥불은 무대 음악을 함께 듣는다 (곡 고르기 없음)
};
const amDJ = () => myMusicPit()?.music?.by === state.myId;
net.on('tentMusic', (m) => {
  if (m.music) state.tentMusic.set(m.tent, m.music); else state.tentMusic.delete(m.tent);
});

// 남은 불 시간 (초): 1시간 넘으면 1:05:30, 아니면 12:30 (v1.21.1 최대 2시간)
function fmtRem(sec) { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = String(sec % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`; }
const fmtDur = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '');
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const music$ = { left: 0, hasKey: false, resetAt: 0, busy: false };

function openMusicModal() {
  const pit = myMusicPit();
  if (pit?.tent && !state.sitting) { UI.toast('화로 둘레 소파에 앉으면 TV장 스피커로 노래를 틀 수 있어요 🔊'); return; }
  if (!pit || pit.state !== 'lit') { UI.toast('불 붙은 모닥불이나 텐트 화로 소파에 앉아서 곡을 고를 수 있어요 💿'); return; }
  if (pit.music) { UI.toast('지금 곡이 끝나면 다른 곡을 틀 수 있어요 🎵'); return; }
  $('musicErr').classList.add('hidden');
  $('musicModal').classList.remove('hidden');
  music$.busy = false;
  net.send({ t: 'musicOpen' });
  if (!isTouch) setTimeout(() => $('musicQ').focus(), 50);
}
function closeMusicModal() {
  $('musicModal').classList.add('hidden');
  $('musicQ').blur();
}
function showMusicErr(text) {
  $('musicErr').textContent = text;
  $('musicErr').classList.toggle('hidden', !text);
}
function renderQuota() {
  const el = $('musicQuota');
  if (!music$.hasKey) { el.textContent = ''; return; }
  if (music$.left > 0) el.innerHTML = `오늘 남은 검색 <b>${music$.left}</b>번 · 같은 검색어와 최근 곡은 횟수를 쓰지 않아요`;
  else {
    const at = new Date(music$.resetAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    el.innerHTML = `오늘 검색을 다 썼어요 · <b>${at}</b>에 다시 열려요 (최근 곡은 틀 수 있어요)`;
  }
  $('musicQ').disabled = music$.left <= 0;
  $('musicSearch').disabled = music$.left <= 0;
}
function renderSongs(title, items, empty) {
  $('musicListTitle').textContent = title;
  const list = $('musicList');
  if (!items.length) { list.innerHTML = `<div class="mm-empty">${empty}</div>`; return; }
  list.innerHTML = items.map((it, i) => `
    <button class="song" data-i="${i}">
      ${it.thumb ? `<img src="${escHtml(it.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="song-noimg">💿</span>'}
      <span class="song-txt"><b>${escHtml(it.title)}</b><small>${escHtml(it.channel || '')}${it.duration ? ` · ${fmtDur(it.duration)}` : ''}</small></span>
      <span class="song-play">▶</span>
    </button>`).join('');
  list.querySelectorAll('.song').forEach((b) => b.addEventListener('click', () => playSong(items[+b.dataset.i], b)));
}
function playSong(it, el) {
  const pit = myMusicPit();
  if (!pit || music$.busy) return;
  music$.busy = true;
  el?.classList.add('loading');
  net.send({ t: 'music', pit: pit.id, vid: it.vid });
}
$('musicForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('musicQ').value.trim();
  if (!q) return;
  showMusicErr('');
  // 유튜브 링크를 붙여 넣었으면 검색 없이 바로 튼다
  if (/youtu\.?be/i.test(q)) {
    const pit = myMusicPit();
    if (pit && !music$.busy) { music$.busy = true; net.send({ t: 'music', pit: pit.id, url: q }); }
    return;
  }
  $('musicSearch').disabled = true;
  $('musicSearch').innerHTML = `${icon('search')}…`;
  $('musicQ').blur();
  net.send({ t: 'search', q });
});
$('musicBtn').addEventListener('click', (e) => { e.currentTarget.blur(); const tip = $('musicBtn').dataset.tip; if (tip) UI.toast(tip, 2600); else openMusicModal(); });
$('musicCancel').addEventListener('click', closeMusicModal);
$('musicQ').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMusicModal(); });

// ---------------------------------------------------------------- 🎤 불멍 아레나 무대 신청 (아레나 승강장 앞 부스)
const arena$ = { pick: null, mine: [], slotMin: 30, maxDays: 14, busy: false };
const arenaOpen = () => !$('arenaModal').classList.contains('hidden');
function arenaErr(text) { $('arenaErr').textContent = text || ''; $('arenaErr').classList.toggle('hidden', !text); }
function openArena({ view = false } = {}) {
  arenaErr('');
  arena$.busy = false;
  // view: 캠핑장 승강장 팻말에서 연 「타임테이블만 보기」 (신청은 아레나 부스에서만)
  $('arenaModal').querySelector('.arena-card').classList.toggle('view', view);
  $('arenaTitle').textContent = view ? '🎤 불멍 아레나 타임테이블' : '🎤 불멍 아레나 무대 신청';
  $('arenaModal').classList.remove('hidden');
  renderArenaTable();
  renderArenaWhen();
  net.send({ t: 'arenaOpen' });
  track(view ? 'arena_timetable' : 'arena_booth');
}
function closeArena() { $('arenaModal').classList.add('hidden'); $('arenaQ').blur(); }
const STATUS_TXT = { 대기: '⏳ 승인 대기', 승인: '✅ 승인', 거절: '🙏 이번엔 어려워요' };
function renderArenaTable() {
  const now = serverNow();
  const rows = arena.table.slice(0, 8);
  $('arenaTable').innerHTML = rows.length ? rows.map((e) => {
    const live = arena.show?.id === e.id && now >= e.at;
    return `<div class="ar-row${live ? ' live' : ''}"><span class="ar-at">${live ? '🎵 지금 무대' : kstWhen(e.at)}</span><span class="ar-t" data-mq>${escHtml(e.title)}</span><small>${escHtml(e.by)}</small></div>`;
  }).join('') : '<div class="ar-empty">아직 잡힌 무대가 없어요. 첫 무대를 신청해 보세요!</div>';
  $('arenaMine').innerHTML = arena$.mine.length ? `<div class="mm-list-title">🙋 내 신청</div>${arena$.mine.map((e) => `<div class="ar-row"><span class="ar-at">${e.at ? kstWhen(e.at) : '-'}</span><span class="ar-t" data-mq>${escHtml(e.title)}</span><small>${STATUS_TXT[e.status] || e.status}</small></div>`).join('')}` : '';
  marqueeAll($('arenaModal')); // 긴 제목은 흐르게
}
/** 날짜 (오늘부터 maxDays 일) · 시각 (30분 칸). 이미 잡힌 무대 · 10분 안 칸은 고를 수 없다 */
function renderArenaWhen() {
  const now = serverNow(), slot = arena$.slotMin * 60e3, day0 = Date.parse(`${kstDay(now)}T00:00:00+09:00`);
  const daySel = $('arenaDay'), prevDay = daySel.value;
  daySel.innerHTML = Array.from({ length: arena$.maxDays }, (_, i) => {
    const d = day0 + i * 86400e3;
    return `<option value="${d}">${i === 0 ? '오늘 ' : i === 1 ? '내일 ' : ''}${kstWhen(d).replace(/ \d\d:\d\d$/, '')}</option>`;
  }).join('');
  if (prevDay && [...daySel.options].some((o) => o.value === prevDay)) daySel.value = prevDay;
  const busy = (t) => arena.table.some((e) => t < e.at + Math.min(900, e.dur || 600) * 1000 + 2000 && e.at < t + slot);
  const fill = () => {
    const d = Number(daySel.value), timeSel = $('arenaTime'), prev = timeSel.value;
    let html = '';
    for (let t = d; t < d + 86400e3; t += slot) {
      const off = t < now + 10 * 60e3, taken = !off && busy(t);
      if (off) continue;
      html += `<option value="${t}"${taken ? ' disabled' : ''}>${kstWhen(t, { day: false })}${taken ? ' (무대 있음)' : ''}</option>`;
    }
    timeSel.innerHTML = html || '<option value="">이 날은 남은 칸이 없어요</option>';
    if (prev && [...timeSel.options].some((o) => o.value === prev && !o.disabled)) timeSel.value = prev;
    else { const first = [...timeSel.options].find((o) => !o.disabled && Number(o.value) >= d + 20 * 3600e3) || [...timeSel.options].find((o) => !o.disabled); if (first) timeSel.value = first.value; } // 처음엔 저녁 8시쯤
  };
  daySel.onchange = fill;
  fill();
}
function arenaSongs(items, title) {
  $('arenaSearch').disabled = false;
  items = (items || []).filter((it) => !it.duration || it.duration <= 900); // 무대는 15분까지 (검색은 20분까지 나온다)
  const list = $('arenaSongs');
  if (!items?.length) { list.innerHTML = `<div class="mm-empty">${title ? '무대에 올릴 수 있는 곡을 찾지 못했어요' : ''}</div>`; return; }
  list.innerHTML = items.slice(0, 8).map((it, i) => `
    <button class="song" data-i="${i}">
      ${it.thumb ? `<img src="${escHtml(it.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="song-noimg">💿</span>'}
      <span class="song-txt"><b>${escHtml(it.title)}</b><small>${escHtml(it.channel || '')}${it.duration ? ` · ${fmtDur(it.duration)}` : ''}</small></span>
      <span class="song-play">✓</span>
    </button>`).join('');
  list.querySelectorAll('.song').forEach((b) => b.addEventListener('click', () => arenaPick(items[+b.dataset.i])));
}
function arenaPick(it) {
  if (it?.duration > 900) { arenaErr('한 무대는 15분까지예요. 더 짧은 곡을 골라 주세요'); return; }
  arena$.pick = it;
  arenaErr('');
  $('arenaSongs').innerHTML = '';
  const el = $('arenaPick');
  el.classList.toggle('hidden', !it);
  if (it) {
    el.innerHTML = `${it.thumb ? `<img src="${escHtml(it.thumb)}" alt="" referrerpolicy="no-referrer">` : '<span class="song-noimg">💿</span>'}<span>🎵 ${escHtml(it.title || '유튜브 링크')}</span><button type="button" aria-label="다시 고르기">✕</button>`;
    el.querySelector('button').onclick = () => arenaPick(null);
  }
}
$('arenaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('arenaQ').value.trim();
  if (!q) return;
  arenaErr('');
  if (/youtu\.?be/i.test(q)) { arenaPick({ url: q, title: '유튜브 링크로 신청' }); $('arenaQ').value = ''; return; }
  $('arenaSearch').disabled = true;
  $('arenaQ').blur();
  net.send({ t: 'search', q });
});
$('arenaSend').addEventListener('click', () => {
  if (arena$.busy) return;
  if (!arena$.pick) { arenaErr('먼저 곡을 골라 주세요 (곡 이름으로 찾거나 유튜브 링크를 붙여 넣어요)'); return; }
  const at = Number($('arenaTime').value);
  if (!at) { arenaErr('원하는 시각을 골라 주세요'); return; }
  arena$.busy = true;
  $('arenaSend').disabled = true;
  net.send({ t: 'arenaApply', vid: arena$.pick.vid, url: arena$.pick.url, title: arena$.pick.title, at, msg: $('arenaMsg').value.trim() });
});
$('arenaClose').addEventListener('click', closeArena);
closeOnBackdrop($('arenaModal'), closeArena);
net.on('arenaMenu', (m) => {
  Object.assign(arena$, { mine: m.mine || [], slotMin: m.slotMin || 30, maxDays: m.maxDays || 14 });
  arena.setState(m);
  renderArenaTable();
  renderArenaWhen();
  $('arenaQ').placeholder = m.hasKey ? '곡 이름 · 가수 또는 유튜브 링크' : '유튜브 링크를 붙여 넣어 주세요';
});
net.on('arenaApplied', (m) => {
  arena$.busy = false; $('arenaSend').disabled = false;
  arena$.mine = m.mine || [];
  arenaPick(null); $('arenaMsg').value = '';
  renderArenaTable();
  UI.toast(`🎤 신청했어요! ${kstWhen(m.item.at)} 「${m.item.title}」 · 운영자가 확인하면 타임테이블에 올라가요`, 5200);
  sound.gift();
  track('arena_apply');
});
net.on('arenaFail', (m) => { arena$.busy = false; $('arenaSend').disabled = false; arenaErr(m.text); });
net.on('musicMenu', (m) => {
  Object.assign(music$, { left: m.left, hasKey: m.hasKey, resetAt: m.resetAt });
  renderQuota();
  renderSongs('🕘 최근에 모닥불에서 나온 곡', m.recent, m.hasKey ? '아직 없어요. 곡을 검색해 보세요!' : '아직 없어요. 유튜브 링크를 붙여 넣어 틀 수 있어요');
  if (!m.hasKey) $('musicQ').placeholder = '유튜브 링크를 붙여 넣어 주세요';
});
net.on('searchResult', (m) => {
  if (arenaOpen()) { arenaSongs(m.items, `"${m.q}" 검색 결과`); return; }
  $('musicSearch').innerHTML = `${icon('search')}검색`;
  music$.left = m.left;
  renderQuota();
  renderSongs(`🔍 "${m.q}" 검색 결과`, m.items, '틀 수 있는 곡을 찾지 못했어요. 다른 검색어로 해 보세요');
});
net.on('searchFail', (m) => {
  if (arenaOpen()) { $('arenaSearch').disabled = false; arenaErr(m.text); return; }
  $('musicSearch').innerHTML = `${icon('search')}검색`;
  if (m.exhausted) { music$.left = 0; music$.resetAt = m.resetAt; } else if (m.left != null) music$.left = m.left;
  renderQuota();
  if (!m.exhausted) { $('musicSearch').disabled = false; $('musicQ').disabled = false; }
  showMusicErr(m.text);
});
net.on('musicOk', () => { track('music_play'); closeMusicModal(); $('musicQ').value = ''; music$.busy = false; });
net.on('musicFail', (m) => {
  music$.busy = false;
  document.querySelectorAll('#musicList .song.loading').forEach((b) => b.classList.remove('loading'));
  showMusicErr(m.text);
});
net.on('musicStop', (m) => {
  if (state.sitting?.pit !== m.pit) return;
  const text = { ended: '🎵 곡이 끝났어요. 이제 다른 곡을 틀 수 있어요', left: '🎸 연주자가 자리를 떠나서 음악이 멈췄어요', fire: '🔥 불이 꺼져서 음악이 멈췄어요', long: '⏱️ 20분이 넘는 영상이라 멈췄어요 · 20분 이하 곡을 골라 주세요' }[m.reason];
  if (text) UI.toast(text);
});

// ---------------------------------------------------------------- 방명록
const gb$ = { items: [], page: 0, busy: false, mineIds: new Set(), newId: null };
const GB_PER_PAGE = 5;
const gbOpen = () => !$('gbModal').classList.contains('hidden');
function fmtDay(at) {
  const d = new Date(at);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function openGuestbook() {
  $('gbErr').classList.add('hidden');
  $('gbModal').classList.remove('hidden');
  if (!gb$.items.length) $('gbBook').innerHTML = '<div class="gb-empty">방명록을 펼치는 중…</div>';
  gb$.page = 0;
  renderGuestbook();
  net.send({ t: 'gbOpen' });
  if (!isTouch) setTimeout(() => $('gbText').focus(), 50);
}
function closeGuestbook() {
  $('gbModal').classList.add('hidden');
  $('gbText').blur();
}
function renderGuestbook() {
  const n = gb$.items.length;
  const pages = Math.max(1, Math.ceil(n / GB_PER_PAGE));
  gb$.page = Math.min(gb$.page, pages - 1);
  $('gbSub').textContent = n ? `지금까지 ${n}개의 이야기가 남겨졌어요` : '캠핑장에서 보낸 시간을 한 줄 남겨 주세요';
  const list = gb$.items.slice(gb$.page * GB_PER_PAGE, (gb$.page + 1) * GB_PER_PAGE);
  if (n) {
    $('gbBook').innerHTML = list.map((e) => `
      <div class="gb-entry${gb$.mineIds.has(e.id) ? ' mine' : ''}${gb$.newId === e.id ? ' new' : ''}">
        <div class="gb-text">${escHtml(e.text)}</div>
        <div class="gb-meta"><b>${escHtml(e.name)}</b> · ${fmtDay(e.at)}</div>
        ${e.reply ? `<div class="gb-reply"><span class="gb-reply-by">🔥 캠핑장 주인장</span><div class="gb-text">${escHtml(e.reply)}</div></div>` : ''}
      </div>`).join('');
  } else if (gb$.loaded) {
    $('gbBook').innerHTML = '<div class="gb-empty">아직 아무도 남기지 않았어요.<br>첫 번째 방명록의 주인공이 되어 주세요 ✨</div>';
  }
  $('gbBook').scrollTop = 0;
  $('gbPage').textContent = `${gb$.page + 1} / ${pages}쪽`;
  $('gbPrev').disabled = gb$.page <= 0;
  $('gbNext').disabled = gb$.page >= pages - 1;
}
function gbCount() { $('gbCount').textContent = `${$('gbText').value.length} / 300`; }
$('gbText').addEventListener('input', gbCount);
$('gbText').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeGuestbook(); });
$('gbPrev').addEventListener('click', () => { gb$.page--; renderGuestbook(); });
$('gbNext').addEventListener('click', () => { gb$.page++; renderGuestbook(); });
$('gbClose').addEventListener('click', closeGuestbook);
closeOnBackdrop($('gbModal'), () => closeGuestbook());
$('gbForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('gbText').value.trim();
  if (!text || gb$.busy) return;
  gb$.busy = true;
  $('gbSend').disabled = true;
  $('gbSend').innerHTML = `${icon('pen')}남기는 중…`;
  $('gbErr').classList.add('hidden');
  net.send({ t: 'gbWrite', text });
});
function gbDone() {
  gb$.busy = false;
  $('gbSend').disabled = false;
  $('gbSend').innerHTML = `${icon('pen')}남기기`;
}
// ---------------------------------------------------------------- 캠핑장 소식 게시판
const board$ = { items: [], timer: null };
net.on('board', (m) => { board$.items = m.items || []; board.setItems(board$.items); if (!$('boardModal').classList.contains('hidden')) renderBoard(); });
net.on('boardUpdate', () => net.send({ t: 'boardGet' }));
function requestBoard() {
  net.send({ t: 'boardGet' });
  clearInterval(board$.timer);
  board$.timer = setInterval(() => net.send({ t: 'boardGet' }), 3 * 60_000); // 방명록 한 줄 · 공지가 바뀌면 따라가게
}
function renderBoard() {
  const items = board$.items;
  $('boardList').innerHTML = items.length ? items.map((it) => `
    <div class="board-item ${it.kind}">
      <div class="board-title">${escHtml(it.title || '')}</div>
      ${it.text ? `<div class="board-text">${escHtml(it.reply ? `“${it.text}”` : it.text)}</div>` : ''}
      ${it.reply ? `<div class="gb-reply"><b>🔥 캠핑장 주인장</b> ${escHtml(it.reply)}</div>` : ''}
    </div>`).join('') : '<div class="gb-empty">🔥 지금은 붙은 소식이 없어요<br>오늘 밤도 따뜻하게 쉬어 가요</div>';
}
function openBoard() {
  renderBoard();
  $('boardModal').classList.remove('hidden');
  net.send({ t: 'boardGet' });
  track('board_open', { items: board$.items.length });
}
function closeBoard() { $('boardModal').classList.add('hidden'); }
$('boardClose').onclick = closeBoard;
closeOnBackdrop($('boardModal'), () => closeBoard());

net.on('gbList', (m) => {
  gb$.items = m.items || [];
  gb$.loaded = true;
  if (gbOpen()) renderGuestbook();
});
net.on('gbWrote', (m) => {
  gbDone();
  $('gbText').value = '';
  gbCount();
  gb$.mineIds.add(m.entry.id);
  gb$.newId = m.entry.id;
  gb$.items = [m.entry, ...gb$.items.filter((e) => e.id !== m.entry.id)];
  gb$.page = 0;
  renderGuestbook();
  gbStand.ping();
  sound.pop?.();
  UI.toast('📖 방명록을 남겼어요! 다녀가 줘서 고마워요');
  track('guestbook_write', { length: (m.entry.text || '').length });
  net.send({ t: 'chat', text: '📖 방명록에 한마디 남겼어요' });
});
net.on('gbFail', (m) => {
  gbDone();
  $('gbErr').textContent = m.text;
  $('gbErr').classList.remove('hidden');
});
net.on('gbNew', (m) => {
  gb$.items = [m.entry, ...gb$.items.filter((e) => e.id !== m.entry.id)];
  gbStand.ping();
  if (gbOpen() && gb$.page === 0) renderGuestbook();
});

// LP 플레이어 누르기 (화면을 짧게 탭/클릭) — 모바일 왼쪽 조이스틱 영역에서도 동작
const lpHits = [...monitors.values()].map((m) => m.hit);
const raycaster = new THREE.Raycaster();
const tapStart = new Map();
addEventListener('pointerdown', (e) => {
  if (e.target === canvas || e.target.id === 'joyZone') tapStart.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
}, true);
addEventListener('pointerup', (e) => {
  const s = tapStart.get(e.pointerId);
  tapStart.delete(e.pointerId);
  if (!s || !me || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || performance.now() - s.t > 400) return;
  if (document.body.classList.contains('chat-open')) return; // 채팅 중 탭은 키보드 내리기 · 채팅 닫기용
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (state.tent) { // 텐트 안: 탁자 위 스피커 · 태블릿을 누르면 곡 고르기
    if (!raycaster.intersectObject(tentRoom.hit, false)[0]) return;
    if (state.sitting) openMusicModal(); else UI.toast('화로 둘레 소파에 앉으면 TV장 스피커로 노래를 틀 수 있어요 🔊');
    return;
  }
  const hit = raycaster.intersectObjects(lpHits, false)[0];
  if (!hit) return;
  const mon = hit.object.userData.monitor;
  const pitId = [...monitors].find(([, v]) => v === mon)?.[0];
  if (state.sitting?.pit === pitId) openMusicModal();
  else UI.toast('이 모닥불에 앉으면 LP로 곡을 고를 수 있어요 💿');
}, true);

// 앉아 있는 내 모닥불의 LP 위에 '눌러서 곡 고르기' 안내 (움직이지 않는 작은 표시)
const lpTagEl = document.createElement('div');
lpTagEl.className = 'lp-tag';
lpTagEl.textContent = '💿 눌러서 곡 고르기';
const lpTag = new CSS2DObject(lpTagEl);
lpTag.visible = false;
scene.add(lpTag);

// ---------------------------------------------------------------- 🌲 숲길: 출입구 · 쉼터 팻말, 처음 도착하면 알림
const tag3d = (html, x, y, z) => {
  const wrap = document.createElement('div');
  const el = document.createElement('div');
  el.className = 'gb-tag spot-tag';
  el.innerHTML = html;
  wrap.appendChild(el);
  const o = new CSS2DObject(wrap);
  o.position.set(x, y, z);
  scene.add(o);
  return el;
};
// 장소 팻말은 가까이 있을 때만 (멀리 있는 곳은 미니맵이 알려 준다). 쉼터 · 들판은 안에 들어오면 숨긴다 (도착 알림이 뜬다)
const PLACE_NEAR = { spot: 25, gate: 15 };
const placeTags = [
  ...GATES.map((g) => ({ el: tag3d('<span class="gb-tag-icon">🌲</span><b>숲길</b>', g.x, 3.7, g.z), x: g.x, z: g.z, near: PLACE_NEAR.gate, inside: 0 })),
  ...SPOTS.map((sp) => ({ el: tag3d(`<span class="gb-tag-icon">${sp.icon}</span><b>${sp.name}</b>`, sp.x, world.heightAt(sp.x, sp.z) + 3.4, sp.z), x: sp.x, z: sp.z, near: PLACE_NEAR.spot, inside: sp.r * 0.6 })),
  { el: tag3d('<span class="gb-tag-icon">🎈</span><b>불멍 아레나행 열기구</b>', BALLOON.camp.x, 4.6, BALLOON.camp.z), x: BALLOON.camp.x, z: BALLOON.camp.z, near: PLACE_NEAR.spot, inside: 3 },
];
let placeT = 0;
function updatePlaceTags(dt) {
  placeT -= dt;
  if (placeT > 0 || !me) return;
  placeT = 0.25;
  for (const t of placeTags) {
    const d = Math.hypot(me.x - t.x, me.z - t.z);
    t.el.classList.toggle('far', d > t.near || d < t.inside);
  }
}
const trailSeen = new Set(); // 이번 접속에서 처음 온 쉼터만 알린다
let trailT = 0, wasOutside = false;
function updateTrail(dt) {
  trailT -= dt;
  if (trailT > 0 || !me) return;
  trailT = 0.5;
  if (state.zone === 'arena' || state.ride != null) return; // 아레나 · 열기구는 숲길이 아니다
  const outside = me.x < FENCE.minX - 1.2 || me.x > FENCE.maxX + 1.2 || me.z < FENCE.minZ - 1.2 || me.z > FENCE.maxZ + 1.2;
  if (outside && !wasOutside && !trailSeen.has('enter')) {
    trailSeen.add('enter');
    UI.toast('🌲 숲길이에요. 한 바퀴 천천히 걸어 봐요', 2800);
    track('trail_enter');
  }
  wasOutside = outside;
  for (const sp of SPOTS) {
    if (trailSeen.has(sp.id) || Math.hypot(me.x - sp.x, me.z - sp.z) > sp.r) continue;
    trailSeen.add(sp.id);
    UI.toast(`${sp.icon} ${sp.name}에 왔어요`, 2600);
    track('trail_spot', { spot: sp.id });
  }
}
// 텐트 문 위 「⛺ 2/5」: 지금 안에 몇 명 있는지 (밖에서 문 가까이 있을 때만)
const tentTags = new Map(TENTS.map((t) => {
  const el = document.createElement('div');
  el.className = 'lp-tag tent-tag';
  const o = new CSS2DObject(el);
  const p = tentLocal(t, 0, CFG.TENT_R + 0.35);
  o.position.set(p.x, 3.15, p.z);
  o.visible = false;
  scene.add(o);
  return [t.id, { o, el, n: -1, door: p }];
}));
let tentTagT = 0;
let skyDim = 1;
function updateTentTags(dt) {
  tentTagT -= dt;
  if (tentTagT > 0 || !me) return;
  tentTagT = 0.4;
  for (const t of TENTS) {
    const tag = tentTags.get(t.id);
    const n = tentCount(t);
    tentRoom.setOccupancy(t.id, n);
    const vis = !state.tent && !state.sitting && !state.lounge && Math.hypot(me.x - tag.door.x, me.z - tag.door.z) < 10; // 문 앞 10m 안에서만 (지나가며 보는 텐트 하나둘)
    tag.o.visible = vis;
    if (vis && tag.n !== n) {
      tag.n = n;
      tag.el.textContent = n >= CFG.TENT_CAP ? `⛺ 가득 ${n}/${CFG.TENT_CAP}` : `⛺ ${n}/${CFG.TENT_CAP}명`;
      tag.el.classList.toggle('full', n >= CFG.TENT_CAP);
      tag.el.classList.toggle('busy', n > 0 && n < CFG.TENT_CAP);
    }
  }
}

// 연주 중인 모닥불 TV 켜기, 내가 앉은 모닥불의 음악 재생 (음표 효과는 없다)
function updateMusicFx(dt) {
  for (const p of pitList) monitors.get(p.id)?.update(dt, !!(p.state === 'lit' && p.music));
  if (me) {
    music.clockOffset = state.clockOffset;
    const pit = myMusicPit();
    const now = serverNow();
    const show = arena.show && now >= arena.show.startedAt ? arena.show : null;
    const onStage = state.zone === 'arena' && state.ride == null && !!show;
    if (state._hintStage !== onStage) { state._hintStage = onStage; $('musicHint').textContent = onStage ? '🎤 무대 전광판 가운데 ▶를 한 번 눌러 같이 들어요' : '📺 옆 TV 화면 가운데 ▶를 한 번 눌러 같이 들어요'; }
    if (onStage) music.update(dt, { id: 'arena', state: 'lit', music: show }, arena, now, camera); // 🎤 아레나 무대: 대형 전광판
    else music.update(dt, pit, pit && (pit.tent ? tentRoom : monitors.get(pit.id)), now, camera);
    // 곡을 고를 수 있으면 LP(텐트는 스피커) 위에 작은 안내
    const showTag = pit?.tent ? false : !!pit && pit.state === 'lit' && !pit.music; // 텐트는 「노래 틀기」 버튼이 있어서 스피커 위 안내는 띄우지 않는다 (화면을 덜 가리게)
    if (showTag) {
      if (pit.tent) tentRoom.speakerWorld(lpTag.position).setY(1.35); else lpTag.position.copy(monitors.get(pit.id).lpPos).setY(1.25);
      const txt = pit.tent ? '🔊 눌러서 노래 틀기' : '💿 눌러서 곡 고르기';
      if (lpTagEl.textContent !== txt) lpTagEl.textContent = txt;
    }
    lpTag.visible = showTag;
  }
}

// 머리 위 +1 같은 짧은 표시. 바깥 div 는 CSS2DRenderer 가 위치(transform)를 잡고, 안쪽 span 만 떠오르게 한다
// (같은 요소에 애니메이션 transform 을 걸면 위치가 덮여 화면 왼쪽 위 구석, 안내판 밑으로 가 버린다)
function floatText(text, pos) {
  const el = document.createElement('div');
  const inner = document.createElement('span');
  inner.className = 'floater';
  inner.textContent = text;
  el.appendChild(inner);
  const o = new CSS2DObject(el);
  o.position.copy(pos);
  scene.add(o);
  setTimeout(() => { scene.remove(o); el.remove(); }, 1100);
}
function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
function refreshInventory() {
  const pit = state.sitting ? pits.get(state.sitting.pit) : null;
  UI.setInventory(state.inv, { onThrow: throwPowder, canThrow: !!pit && pit.state === 'lit' });
  refreshBag();
  requestAnimationFrame(() => markPowderOverflow?.());
}

// 앉았을 때 가루 줄: 넘치면 끝을 흐리게, PC는 마우스 휠로 옆으로 넘긴다
const powderRow = $('powders');
const markPowderOverflow = () => {
  const over = powderRow.scrollWidth > powderRow.clientWidth + 2;
  powderRow.classList.toggle('more', over && powderRow.scrollLeft + powderRow.clientWidth < powderRow.scrollWidth - 4); // 오른쪽에 더 있음
  powderRow.classList.toggle('less', over && powderRow.scrollLeft > 4);                                              // 왼쪽에 지나간 것 있음
};
powderRow.addEventListener('scroll', markPowderOverflow, { passive: true });
powderRow.addEventListener('wheel', (e) => {
  if (powderRow.scrollWidth <= powderRow.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  powderRow.scrollLeft += e.deltaY;
}, { passive: false });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(markPowderOverflow).observe(powderRow);

// ---------------------------------------------------------------- 🎒 가방 (서 있을 때 가진 가루 보기)
let bagLast = -1;
function refreshBag() {
  const list = state.inv.powders;
  const n = list.length;
  $('bagCount').textContent = n || ''; // 비어 있으면 숫자를 숨긴다
  if (bagLast >= 0 && n > bagLast) { $('bagBtn').classList.remove('bump'); void $('bagBtn').offsetWidth; $('bagBtn').classList.add('bump'); }
  bagLast = n;
  $('bagBtn').classList.toggle('has-legend', list.some((p) => p.legend));
  if ($('bagPanel').classList.contains('hidden')) return;
  const legend = list.filter((p) => p.legend).length;
  $('bagSub').textContent = n ? `마법 가루 ${n}개${legend ? ` · ✦ 특별한 가루 ${legend}개` : ''}` : '';
  $('bagList').innerHTML = n ? UI.powderGrid(list)
    : `<div class="bag-empty">가루가 없어요.<br>길 건너 <b>루미</b>에게 가면 ${CFG.BASE_POWDERS}개까지 채워 줘요 ✨</div>`;
}
function setBag(open) {
  $('bagPanel').classList.toggle('hidden', !open);
  $('bagBtn').classList.toggle('on', open);
  if (open) refreshBag();
}
$('bagBtn').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); setBag($('bagPanel').classList.contains('hidden')); };
addEventListener('pointerdown', (e) => {
  if (!$('bagPanel').classList.contains('hidden') && !e.target.closest('#bagPanel, #bagBtn')) setBag(false);
}, true);

// ---------------------------------------------------------------- 상호작용
function findInteraction() {
  if (!me) return null;
  if (state.ride != null) return { type: 'riding' };
  if (state.sitting) return { type: 'seated', pit: pits.get(state.sitting.pit) };
  if (state.lounge) return { type: 'lounge' };
  let best = null;
  let bestD = Infinity;
  // 🎈 열기구 승강장 · 아레나 부스 (✦ 페스티벌 가루 · 🎤 무대 신청)
  {
    const dock = BALLOON[state.zone], b = arena.b;
    const dd = Math.hypot(me.x - dock.x, me.z - dock.z);
    if (dd < BALLOON.range) { best = b.at === state.zone ? { type: 'balloon' } : { type: 'balloonWait' }; bestD = dd; }
    if (state.zone === 'camp') { // 🎤 승강장 옆 타임테이블 팻말
      const dt2 = Math.hypot(me.x - TT_SIGN.x, me.z - TT_SIGN.z);
      if (dt2 < 2.6 && dt2 < bestD) { best = { type: 'timetable' }; bestD = dt2; }
    }
    if (state.zone === 'arena') { // 아레나: 부스 둘 · 창고지기 콩이 · 사람들 · 객석 모닥불
      for (const [bp, type] of [[ARENA.booth, 'festBooth'], [ARENA.apply, 'arenaBooth']]) {
        const db = Math.hypot(me.x - bp.x, me.z - bp.z);
        if (db < RANGE.npc && db < bestD) { best = { type }; bestD = db; }
      }
      const dk = Math.hypot(me.x - ARENA.keeper.x, me.z - ARENA.keeper.z);
      if (dk < RANGE.keeper && dk < bestD) { best = { type: 'keeper' }; bestD = dk; }
      const cn = crowd.nearest(me); // 아레나 사람들에게 말 걸기 (가루 판매원은 부스로)
      if (cn && cn.n.p.id !== 'seller' && cn.d - 0.5 < bestD) { best = { type: 'arenaNpc', n: cn.n }; bestD = cn.d - 0.5; }
      for (const pit of pitList) {
        if (!isArenaPit(pit)) continue;
        const d = Math.hypot(me.x - pit.pos.x, me.z - pit.pos.z);
        if (d < RANGE.pit && d < bestD) { best = { type: 'pit', pit }; bestD = d; }
      }
      return best;
    }
  }
  if (state.tent) {
    // 텐트 안: 문 앞이면 「나가기」, 그 밖에서는 가운데 화로 (장작 쌓기 · 불 붙이기 · 소파에 앉기)
    const ex = tentLocal(state.tent, 0, CFG.TENT_R - 0.9);
    if (Math.hypot(me.x - ex.x, me.z - ex.z) < 1.8) return { type: 'tentExit' };
    return { type: 'pit', pit: pits.get(`f${state.tent.id}`) };
  }
  // 텐트 문 앞: 「들어가기」
  for (const t of TENTS) {
    const door = tentLocal(t, 0, CFG.TENT_R + 0.6);
    const d = Math.hypot(me.x - door.x, me.z - door.z);
    if (d < 1.8 && d < bestD) { best = { type: 'tentDoor', t }; bestD = d; }
  }
  STUMPS.forEach((s, i) => {
    const d = Math.hypot(me.x - s.x, me.z - s.z);
    if (d < RANGE.stump && d < bestD) { best = { type: 'chop', idx: i, s }; bestD = d; }
  });
  const dn = Math.hypot(me.x - NPC.x, me.z - NPC.z);
  if (dn < RANGE.npc && dn < bestD) { best = { type: 'npc' }; bestD = dn; }
  if (world.egg.visible) { // 숨겨진 가루병: 바로 옆에서만
    const de = Math.hypot(me.x - EGG.x, me.z - EGG.z);
    if (de < EGG.range && de < bestD) { best = { type: 'egg' }; bestD = de; }
  }
  const dk = Math.hypot(me.x - KEEPER.x, me.z - KEEPER.z);
  if (dk < RANGE.keeper && dk < bestD) { best = { type: 'keeper' }; bestD = dk; }
  const rs = residents.nearest(me); // 🏡 캠핑장 주민
  if (rs && rs.d - 0.8 < bestD) { best = { type: 'resident', e: rs.e }; bestD = rs.d - 0.8; } // 화로 · 의자보다 주민을 먼저 (모닥불 옆 주민에게 말 걸기 쉽게)
  const dg = Math.hypot(me.x - GUESTBOOK.x, me.z - GUESTBOOK.z);
  if (dg < RANGE.guestbook && dg < bestD) { best = { type: 'guestbook' }; bestD = dg; }
  const db = Math.hypot(me.x - BOARD.x, me.z - BOARD.z);
  if (db < RANGE.board && db < bestD) { best = { type: 'board' }; bestD = db; }
  LOUNGE_SEATS.forEach((st, i) => { // 언덕 · 호숫가 · 광장 벤치
    const d = Math.hypot(me.x - st.x, me.z - st.z);
    if (d < 1.4 && d < bestD && !chairTaken(i)) { best = { type: 'chair', i, kind: st.kind }; bestD = d; }
  });
  for (const pit of pitList) {
    if (pit.stove || isArenaPit(pit)) continue; // 텐트 화로는 텐트 안에서만
    const d = Math.hypot(me.x - pit.pos.x, me.z - pit.pos.z);
    if (d < RANGE.pit && d < bestD) { best = { type: 'pit', pit }; bestD = d; }
  }
  return best;
}

function promptFor(it) {
  const W = CFG.WOOD_PER_FIRE;
  const inv = state.inv;
  if (!it) return [null];
  if (it.type === 'chop') {
    return woodcut.stateOf(it.idx) === 'empty' ? ['<kbd>E</kbd> 통나무 올리기 <small>(꾹 누르면 계속 패요)</small>'] : ['<kbd>E</kbd> 장작 패기 <small>(꾹 누르기)</small>'];
  }
  if (it.type === 'npc') return ['<kbd>E</kbd> 루미와 이야기하기'];
  if (it.type === 'resident') return [`<kbd>E</kbd> ${it.e.r.name}에게 말 걸기 ${it.e.r.icon}`];
  if (it.type === 'keeper') return [`<kbd>E</kbd> 장작 창고 열기 📦 <small>(맡긴 장작 ${inv.stored}개)</small>`];
  if (it.type === 'guestbook') return ['<kbd>E</kbd> 방명록 펼쳐 보기 📖'];
  if (it.type === 'board') return ['<kbd>E</kbd> 캠핑장 소식 보기 📌'];
  if (it.type === 'tentDoor') {
    const n = tentCount(it.t);
    return n >= CFG.TENT_CAP ? [`🏕️ ${it.t.label}은(는) 꽉 찼어요 (${n}/${CFG.TENT_CAP}명)`, true] : [`<kbd>E</kbd> 텐트 들어가기 ⛺ <small>(${n}/${CFG.TENT_CAP}명 · 안에서 한 말은 텐트 안에만 들려요)</small>`];
  }
  if (it.type === 'tentExit') return ['<kbd>E</kbd> 텐트 밖으로 나가기 🚪'];
  if (it.type === 'egg') return ['<kbd>E</kbd> 풀숲에서 반짝이는 걸 줍기 ✨'];
  if (it.type === 'chair') return [it.kind === 'hill' ? '<kbd>E</kbd> 벤치에 앉아 노을 보기 🌅' : '<kbd>E</kbd> 벤치에 앉아 쉬기 🪑'];
  if (it.type === 'lounge') return ['<kbd>E</kbd> 일어나기 · 화면을 끌어 둘러봐요'];
  if (it.type === 'riding') return arena.b.at ? [`🎈 ${Math.ceil(arena.b.next)}초 뒤 출발 · <kbd>E</kbd> 내리기`] : [`🎈 ${arena.b.to === 'arena' ? '불멍 아레나로' : '캠핑장으로'} 날아가는 중…`, true];
  if (it.type === 'balloon') return [`<kbd>E</kbd> 열기구 타기 🎈 <small>(${state.zone === 'arena' ? '캠핑장행' : '불멍 아레나행'} · ${Math.ceil(arena.b.next)}초 뒤 출발)</small>`];
  if (it.type === 'balloonWait') return [`🎈 열기구가 오는 중이에요 <small>(1분마다 출발 · 승강장 전광판을 봐 주세요)</small>`, true];
  if (it.type === 'arenaBooth') return ['<kbd>E</kbd> 무대 신청 · 타임테이블 보기 🎤'];
  if (it.type === 'timetable') return ['<kbd>E</kbd> 아레나 무대 타임테이블 보기 🎤'];
  if (it.type === 'arenaNpc') return [`<kbd>E</kbd> ${it.n.p.name}에게 말 걸기 ${it.n.p.icon}`];
  if (it.type === 'festBooth') return inv.wood >= CFG.FESTIVAL_PRICE ? [`<kbd>E</kbd> ✦ 페스티벌 가루 받기 <small>(🪵 ${CFG.FESTIVAL_PRICE}개)</small>`] : [`✦ 페스티벌 가루는 장작 ${CFG.FESTIVAL_PRICE}개 <small>(🪵 ${inv.wood}/${CFG.FESTIVAL_PRICE} · 캠핑장에서 패 와요)</small>`, true];
  if (it.type === 'pit') {
    const p = it.pit;
    if (p.state === 'empty') {
      if (inv.wood >= W) return [`<kbd>E</kbd> 장작 쌓기 <small>(🪵 ${W}개 사용)</small>`];
      return p.freeSeats() > 0 ? [`<kbd>E</kbd> 의자에 앉아 쉬기 <small>(장작 ${W}개면 불을 피울 수 있어요 · 🪵 ${inv.wood}/${W})</small>`] : ['자리가 꽉 찼어요', true];
    }
    if (p.state === 'stacked') return ['<kbd>E</kbd> 불 붙이기 🔥'];
    if (p.state === 'lit') return p.freeSeats() > 0 ? [isArenaPit(p) ? '<kbd>E</kbd> 객석 모닥불에 앉아 무대 보기 🎤' : '<kbd>E</kbd> 앉아서 불멍하기 🔥'] : ['자리가 꽉 찼어요', true];
  }
  if (it.type === 'seated') {
    const p = it.pit;
    if (p.stove && p.state !== 'lit') return [`<kbd>E</kbd> 일어나기 · 장작 ${W}개로 화로를 피울 수 있어요 · 노래는 TV장 스피커로`];
    if (p.state !== 'lit') return ['<kbd>E</kbd> 일어나기 · 불을 피우면 가루 · 노래를 쓸 수 있어요'];
    const n = inv.powders.length;
    if (n) return [`<kbd>1</kbd>${n > 1 ? `~<kbd>${n}</kbd>` : ''} 가루 뿌리기 · <kbd>E</kbd> 일어나기`];
    return ['<kbd>E</kbd> 일어나기 · 루미에게 받은 가루가 있으면 뿌릴 수 있어요'];
  }
  return [null];
}

function interact(it) {
  if (!it || !me) return;
  if (it.type === 'chop') tryChop(it);
  else if (it.type === 'resident') talkTo(it.e);
  else if (it.type === 'npc') {
    net.send({ t: 'npc' });
    // NPC가 나를 바라보도록
  } else if (it.type === 'keeper') {
    openStore();
  } else if (it.type === 'board') {
    faceTo(BOARD.x, BOARD.z);
    openBoard();
  } else if (it.type === 'guestbook') {
    faceTo(GUESTBOOK.x, GUESTBOOK.z);
    openGuestbook();
  } else if (it.type === 'pit') {
    const p = it.pit;
    faceTo(p.pos.x, p.pos.z);
    if (p.state === 'empty' && state.inv.wood >= CFG.WOOD_PER_FIRE) net.send({ t: 'build', pit: p.id });
    else if (p.state === 'empty' && p.freeSeats() > 0) net.send({ t: 'sit', pit: p.id }); // 장작이 없으면 그냥 앉아서 쉬기
    else if (p.state === 'stacked') {
      me.char.play('light', { onImpact: () => {} });
      net.send({ t: 'light', pit: p.id });
      track('fire_light', { pit: p.id });
    } else if (p.state === 'lit') net.send({ t: 'sit', pit: p.id });
  } else if (it.type === 'seated') standUp();
  else if (it.type === 'chair') sitChair(it.i);
  else if (it.type === 'lounge') leaveChair();
  else if (it.type === 'tentDoor') enterTent(it.t);
  else if (it.type === 'tentExit') exitTent();
  else if (it.type === 'riding') { if (arena.b.at) net.send({ t: 'rideOff' }); }
  else if (it.type === 'balloon') { faceTo(BALLOON[state.zone].x, BALLOON[state.zone].z); net.send({ t: 'rideOn' }); }
  else if (it.type === 'arenaBooth') { faceTo(ARENA.apply.x, ARENA.apply.z); openArena(); }
  else if (it.type === 'timetable') { faceTo(TT_SIGN.x, TT_SIGN.z); openArena({ view: true }); }
  else if (it.type === 'arenaNpc') { faceTo(it.n.x, it.n.z); crowd.talk(it.n); }
  else if (it.type === 'festBooth') { faceTo(ARENA.booth.x, ARENA.booth.z); if (state.inv.wood >= CFG.FESTIVAL_PRICE) net.send({ t: 'festBuy' }); else UI.toast(`장작이 ${CFG.FESTIVAL_PRICE}개 필요해요 🪵`); }
  else if (it.type === 'egg') { faceTo(EGG.x, EGG.z); me.char.play('light', { onImpact: () => {} }); net.send({ t: 'egg' }); }
}
/** 문 앞 「들어가기」: 문 안쪽에 서서 화로를 바라본다. 카메라는 들어가기 전 높이 · 거리를 기억해 두고 텐트 안에 맞춘다 */
function enterTent(t) {
  if (!me || state.tent || state.sitting) return;
  if (tentCount(t) >= CFG.TENT_CAP) { UI.toast(`이 텐트는 꽉 찼어요 (최대 ${CFG.TENT_CAP}명) 🏕️`); return; }
  const o = tentLocal(t, TENT_ENTRY.x, TENT_ENTRY.z);
  me.x = o.x; me.z = o.z;
  me.ry = t.facing + Math.PI;
  state.camSave = { pitch: cam.pitch, dist: cam.dist };
  cam.yaw = t.facing - 0.5; // 문 쪽 조금 왼편에서 나와 화로 · 소파를 함께 본다
  cam.pitch = 0.7; cam.dist = 5.5;
  cam.curDist = cam.dist; cam.curPitch = cam.pitch;
  cam.target.set(me.x, 0.9, me.z);
  net.send({ t: 'move', x: me.x, z: me.z, ry: me.ry, anim: 'idle' });
}
/** 문 앞 「나가기」: 문 밖 한 걸음 앞으로 나와 텐트 앞(화로 쪽)을 보게 한다 */
function exitTent() {
  const t = state.tent;
  if (!t || state.sitting) return;
  const o = tentLocal(t, 0, CFG.TENT_R + 1.3);
  me.x = o.x; me.z = o.z;
  me.ry = t.facing;
  cam.yaw = t.facing + Math.PI; // 카메라는 내 뒤 (텐트 쪽) 높은 곳에서 앞을 본다 (가리는 텐트는 반투명해진다)
  const sv = state.camSave || { pitch: 0.6, dist: cam.dist };
  cam.pitch = Math.max(0.6, sv.pitch); cam.dist = Math.max(8, sv.dist);
  cam.curDist = cam.dist; cam.curPitch = cam.pitch;
  cam.target.set(me.x, 1.0, me.z);
  state.camSave = null;
  net.send({ t: 'move', x: me.x, z: me.z, ry: me.ry, anim: 'idle' });
}

// ---------------------------------------------------------------- 🏕️ 글램핑 텐트
/** 텐트 t 안에 있는 사람 수 (나 포함). 다른 사람 위치는 서버가 보내 준 마지막 위치로 센다 */
function tentCount(t) {
  let n = me && state.ride == null && tentAt(me.x, me.z) === t ? 1 : 0;
  for (const r of remotes.values()) if (r.ride == null && tentAt(r.tx, r.tz) === t) n++; // 열기구로 위를 지나가는 사람은 세지 않는다
  return n;
}
/** 내가 텐트에 들어가고 나오는 것 · 다른 텐트 안 사람 숨기기 */
function updateTentState() {
  if (!me) return;
  const t = state.ride != null || state.zone === 'arena' ? null : tentAt(me.x, me.z); // 🎈 열기구로 텐트 위를 지나갈 땐 텐트 안이 아니다
  if (t !== state.tent) {
    const prev = state.tent;
    state.tent = t;
    tentRoom.set(t);
    document.body.classList.toggle('in-tent', !!t);
    // 카메라는 enterTent / exitTent 에서. 그 밖의 길로 나왔으면 (서버가 내보냄 등) 기억해 둔 시점으로
    if (!t && prev && state.camSave) {
      cam.pitch = Math.max(0.4, state.camSave.pitch);
      cam.dist = state.camSave.dist;
      state.camSave = null;
    }
    $('chatInput').placeholder = t ? '텐트 안 사람에게만 보여요…' : (isTouch ? '메시지를 입력하세요…' : 'Enter 를 눌러 채팅…');
    if (t) {
      UI.toast(`🏕️ ${t.label} · 여기서 한 말은 텐트 안에만 들려요`, 4200);
      track('tent_enter', { tent: t.id, n: tentCount(t) });
    } else if (prev) UI.toast('🌙 텐트 밖으로 나왔어요', 1800);
  }
  // 텐트 안에서는 바깥 NPC 이름표가 벽 너머로 보이지 않게
  if (npc.root.visible === !!state.tent) { npc.root.visible = !state.tent; keeper.root.visible = !state.tent; }
  // 다른 텐트 안에 있는 사람은 벽 · 지붕에 가려지므로 이름표 · 말풍선까지 숨긴다
  // (보이기 · 숨기기는 updateRemotes 에서 아레나 · 열기구와 함께 정한다)
}

// 걸을 때 발소리 (설산: 뽀득뽀득 · 우중: 찰박). 걸은 거리로 박자를 맞춘다
let stepDist = 0, stepPrev = null;
function stepSounds() {
  if (!me) return;
  const kind = themeOf(state.theme).step;
  const p = { x: me.x, z: me.z };
  if (stepPrev && kind && !state.sitting && !state.tent) {
    const d = Math.hypot(p.x - stepPrev.x, p.z - stepPrev.z);
    if (d < 1) { // 순간이동은 빼고
      stepDist += d;
      if (stepDist > 0.72) { stepDist = 0; sound.step(kind, 0.9 + Math.random() * 0.2); }
    }
  }
  stepPrev = p;
}

function faceTo(x, z) { me.ry = Math.atan2(x - me.x, z - me.z); }

function tryChop(it) {
  if (me.char.busy()) return;
  const s = it.s;
  const dx = s.x - me.x, dz = s.z - me.z;
  const d = Math.hypot(dx, dz) || 1;
  me.x = s.x - (dx / d) * 0.95;
  me.z = s.z - (dz / d) * 0.95;
  me.ry = Math.atan2(dx, dz);
  state.lastStump = s;
  state.lastStumpIdx = it.idx;
  const st = woodcut.stateOf(it.idx);
  if (st === 'splitting') return; // 쪼갠 장작이 모이는 중
  if (st === 'empty') {
    // 옆에서 통나무를 들어 그루터기에 올린다
    net.send({ t: 'place', stump: it.idx });
    me.char.play('place', { onImpact: () => { woodcut.place(it.idx); sound.pop?.(); } });
    return;
  }
  if (state.inv.wood >= CFG.MAX_WOOD) {
    // E를 꾹 누르고 있으면 매 프레임 여기로 오므로, 안내는 3초에 한 번만
    const now = performance.now();
    if (now - (state.fullToastAt || 0) > 3000) {
      state.fullToastAt = now;
      UI.toast('장작을 더 들 수 없어요! 북서쪽 창고지기 보리에게 맡겨 보세요 📦');
    }
    return;
  }
  me.char.play('chop', {
    onImpact: () => {
      effects.chips(new THREE.Vector3(s.x, 0.66, s.z));
      sound.chop(1);
      state.shake = 0.12;
      woodcut.hit(it.idx);
      net.send({ t: 'chop', stump: it.idx });
    },
  });
}

// ---------------------------------------------------------------- 🌅 노을 지는 언덕 흔들의자: 앉으면 천천히 흔들리며 하늘을 올려다본다
function chairTaken(i) {
  const st = LOUNGE_SEATS[i];
  return [...remotes.values()].some((r) => r.anim === 'sit' && Math.hypot(r.tx - st.x, r.tz - st.z) < 0.45);
}
// 앉으면 늘 1인칭. 흔들의자는 하늘을 올려다보고, 벤치는 앞을 본다 (화면을 끌면 둘러볼 수 있다)
function sitChair(i) {
  if (!me || state.sitting || chairTaken(i)) return;
  const st = LOUNGE_SEATS[i];
  state.lounge = { i, seat: st, at: performance.now() };
  me.x = st.x; me.z = st.z; me.ry = st.ry;
  me.char.root.rotation.y = st.ry;
  me.char.setAnim('sit');
  setView(true, { silent: true });
  cam.yaw = st.ry + Math.PI;
  cam.look = st.kind === 'hill' ? 0.06 : -0.04; // 노을 지는 언덕: 지평선 (끌어 올리면 별)
  UI.toast(st.kind === 'hill' ? '🌅 노을을 보며 쉬어요 · 위로 끌면 별이 보여요' : '🪑 화면을 끌어 둘러봐요 · 움직이면 일어나요', 3000);
}
function leaveChair() {
  if (!state.lounge || !me) return;
  const st = state.lounge.seat;
  state.lounge = null;
  me.char.root.rotation.x = 0;
  me.char.setAnim('idle');
  setView(false, { silent: true });
  const step = 1.45; // 벤치 앞으로 한 걸음
  me.x = st.x + Math.sin(st.ry) * step; me.z = st.z + Math.cos(st.ry) * step;
  collide(me);
  cam.yaw = st.ry + Math.PI; cam.pitch = Math.max(cam.pitch, 0.6);
}
/** 앉은 사람이 있는 흔들의자만 천천히 흔든다 (나 · 다른 캠퍼 모두) */
function updateChairs(t) {
  LOUNGE_SEATS.forEach((st, i) => {
    let ch = state.lounge?.i === i ? me.char : null;
    if (!ch) for (const r of remotes.values()) if (r.anim === 'sit' && Math.hypot(r.tx - st.x, r.tz - st.z) < 0.45) { ch = r.ch; r.ch.root.rotation.y = st.ry; break; }
    if (st.kind !== 'rock') return;
    const a = ch ? Math.sin(t * 1.5 + i * 1.3) * 0.085 : 0;
    world.trail.rockChair(st.chair, a);
    if (ch) ch.root.rotation.x = a;
  });
  for (const r of remotes.values()) if (r.ch.root.rotation.x && r.anim !== 'sit') r.ch.root.rotation.x = 0;
}

function standUp() {
  if (!state.sitting || !me) return;
  const pit = pits.get(state.sitting.pit);
  net.send({ t: 'stand' });
  track('fire_stand', { pit: state.sitting.pit, seconds: Math.round((performance.now() - (state.sitting.at || performance.now())) / 1000) });
  state.sitting = null;
  setView(false, { silent: true }); // 일어나면 3인칭
  me.char.setAnim('idle');
  if (pit) {
    const dx = me.x - pit.pos.x, dz = me.z - pit.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    me.x += (dx / d) * 0.35;
    me.z += (dz / d) * 0.35;
  }
  refreshInventory();
}

function throwPowder(i) {
  if (!state.sitting) { UI.toast('모닥불 앞에 앉아서 뿌릴 수 있어요'); return; }
  const pit = pits.get(state.sitting.pit);
  if (!pit || pit.state !== 'lit') { UI.toast('불이 붙어 있어야 가루를 뿌릴 수 있어요 🔥'); return; }
  if (!state.inv.powders[i]) return;
  if (me.char.busy()) return;
  if (state.inv.powders[i].effect === 'festival' && !isArenaPit(pit)) { UI.toast('✦ 페스티벌 가루는 불멍 아레나 객석 모닥불에서만 뿌릴 수 있어요 🎤'); return; }
  net.send({ t: 'throw', idx: i });
  track('powder_use', { powder: state.inv.powders[i].effect });
}

// ---------------------------------------------------------------- 입력
function pressAction() {
  if (!me) return;
  if (UI.dialogOpen()) { UI.dialogNext(); return; }
  keys.add('KeyE');
  const it = findInteraction();
  if (it?.type !== 'chop') interact(it);
}
const touch = isTouch ? new TouchControls({
  onActionDown: pressAction,
  onActionUp: () => keys.delete('KeyE'),
}) : null;

function actionFor(it) {
  if (UI.dialogOpen()) return { icon: '▶', label: '다음' };
  if (!it) return null;
  if (it.type === 'chop') return woodcut.stateOf(it.idx) === 'empty' ? { icon: '🪵', label: '통나무 올리기' } : { icon: '🪓', label: '꾹 패기' };
  if (it.type === 'npc') return { icon: '💬', label: '대화' };
  if (it.type === 'resident') return { icon: '💬', label: '말 걸기' };
  if (it.type === 'keeper') return { icon: '📦', label: '창고' };
  if (it.type === 'guestbook') return { icon: '📖', label: '방명록' };
  if (it.type === 'board') return { icon: '📌', label: '소식' };
  if (it.type === 'seated') return { icon: '🚶', label: '일어나기' };
  if (it.type === 'tentDoor') return tentCount(it.t) >= CFG.TENT_CAP ? null : { icon: '⛺', label: '들어가기' };
  if (it.type === 'tentExit') return { icon: '🚪', label: '나가기' };
  if (it.type === 'egg') return { icon: '✨', label: '줍기' };
  if (it.type === 'chair') return { icon: '🪑', label: '앉기' };
  if (it.type === 'lounge') return { icon: '🚶', label: '일어나기' };
  if (it.type === 'riding') return arena.b.at ? { icon: '🚶', label: '내리기' } : null;
  if (it.type === 'balloon') return { icon: '🎈', label: '타기' };
  if (it.type === 'arenaBooth') return { icon: '🎤', label: '무대 신청' };
  if (it.type === 'timetable') return { icon: '🎤', label: '타임테이블' };
  if (it.type === 'arenaNpc') return { icon: '💬', label: '말 걸기' };
  if (it.type === 'festBooth') return state.inv.wood >= CFG.FESTIVAL_PRICE ? { icon: '✦', label: '가루 받기' } : null;
  if (it.type === 'pit') {
    const p = it.pit;
    if (p.state === 'empty' && state.inv.wood >= CFG.WOOD_PER_FIRE) return { icon: '🪵', label: '장작 쌓기' };
    if (p.state === 'stacked') return { icon: '🔥', label: '불 붙이기' };
    if (p.freeSeats() > 0 && (p.state === 'lit' || p.state === 'empty')) return { icon: '🪑', label: '앉기' };
  }
  return null;
}

// 채팅 (모바일 전송 버튼 / 열기 버튼)
function sendChat() {
  const text = $('chatInput').value.trim();
  if (text) net.send({ t: 'chat', text });
  $('chatInput').value = '';
  // 모바일: 메신저처럼 키보드를 연 채로 이어서 대화. PC: 입력 끝나면 게임으로
  if (isTouch && text) { $('chatInput').focus(); return; }
  closeChat();
}
if (isTouch) $('chatInput').placeholder = '메시지를 입력하세요…';
function openChat() {
  document.body.classList.add('chat-open');
  if (isTouch) setEmotePanel(true); // 휴대폰: 입력창 위에 이모지 줄
  $('chatInput').focus();
  chatToBottom();
}
// 채팅을 치는 동안에는 늘 가장 최신 채팅이 보이게 맨 아래로
function chatToBottom() {
  const log = $('chatLog');
  log.scrollTop = log.scrollHeight;
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}
const chatting = () => document.activeElement === $('chatInput') || document.body.classList.contains('chat-open');
$('chatInput').addEventListener('focus', () => { chatToBottom(); setTimeout(chatToBottom, 350); }); // 키보드가 다 올라온 뒤 한 번 더
$('chatInput').addEventListener('input', chatToBottom);
new ResizeObserver(() => { if (chatting()) chatToBottom(); }).observe($('chatLog'));
function closeChat() {
  $('chatInput').blur();
  document.body.classList.remove('chat-open');
  if (isTouch) setEmotePanel(false);
}
// ---------------------------------------------------------------- 😊 감정 표현
const emotePanel = $('emotePanel');
emotePanel.replaceChildren(...EMOTES.map((x) => {
  const b = document.createElement('button');
  b.className = 'emote-item';
  b.dataset.id = x.id;
  b.title = x.label;
  b.innerHTML = `<span>${x.e}</span><small>${x.label}</small>`;
  return b;
}));
emotePanel.addEventListener('pointerdown', (e) => e.preventDefault()); // 휴대폰: 눌러도 키보드가 먼저 내려가며 깜빡이지 않게
emotePanel.addEventListener('click', (e) => { const b = e.target.closest('.emote-item'); if (b) doEmote(b.dataset.id); });
function setEmotePanel(on) {
  emotePanel.classList.toggle('hidden', !on);
  $('emoteBtn').classList.toggle('on', on);
}
$('emoteBtn').addEventListener('click', (e) => { e.currentTarget.blur(); setEmotePanel(emotePanel.classList.contains('hidden')); });
let lastEmoteAt = 0;
function doEmote(id) {
  const x = EMOTES.find((q) => q.id === id);
  if (!me || !x) return;
  const now = performance.now();
  if (now - lastEmoteAt < 1200) return; // 서버와 같은 간격 (연타 방지)
  lastEmoteAt = now;
  me.char.emote(x.id, x.e);
  if (view.fp) { // 1인칭: 내 캐릭터가 안 보이니 화면 가운데 아래에
    const el = $('selfEmote');
    el.textContent = x.e;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  net.send({ t: 'emote', e: x.id });
  track('emote', { emote: x.id });
  setEmotePanel(false);
  if (isTouch) closeChat(); // 휴대폰: 채팅 시트를 닫아 내 캐릭터가 보이게
}
net.on('emote', (m) => {
  const x = EMOTES.find((q) => q.id === m.e);
  const r = remotes.get(m.id);
  if (x && r) r.ch.emote(x.id, x.e);
});

$('chatSend').addEventListener('pointerdown', (e) => e.preventDefault()); // 전송 눌러도 키보드 유지
$('chatSend').addEventListener('click', sendChat);
$('chatClose').addEventListener('click', closeChat);
$('chatToggle').addEventListener('click', () => {
  if (document.body.classList.contains('chat-open')) closeChat(); else openChat();
});
// 모바일 키보드 높이만큼 채팅 시트를 올린다 (iOS는 화면이 줄지 않고 키보드가 덮기 때문)
// - iOS Safari: 키보드가 떠도 레이아웃 높이는 그대로고 innerHeight 가 같이 줄어들며,
//   입력창을 보여주려고 화면을 위로 밀어 올린다(visualViewport.offsetTop).
//   → 기준은 변하지 않는 레이아웃 높이(clientHeight), 보이는 영역의 '바닥'에 시트를 붙인다.
//   (예전엔 scrollTo(0,0)으로 밀어올린 화면을 되돌려서 입력창이 키보드 뒤로 숨었다)
// - 안드로이드 '전체화면' PWA: 키보드가 떠도 화면이 상태바 높이만큼 덜 줄어드는 버그가 있어서
//   키보드 높이를 브라우저(VirtualKeyboard API)에게 직접 받는다.
// ▶ 방식: '레이아웃 높이 - 키보드 높이'로 bottom 을 계산하면 브라우저마다 기준 높이가 달라서
//   (iOS는 innerHeight가 줄고, 안드로이드 Chrome은 주소창 때문에 clientHeight가 실제와 다름)
//   키보드 위에 틈이 생기거나 가려졌다. 그래서 '지금 눈에 보이는 영역의 바닥 좌표'
//   (visualViewport.offsetTop + height)를 직접 구해 시트의 top 으로 쓰고, 시트를 자기 높이만큼 끌어올린다.
// ▶ 안드로이드 '전체화면' PWA는 키보드가 떠도 화면 크기가 제대로 안 줄어서
//   VirtualKeyboard API가 알려주는 키보드 높이를 쓴다.
const root = document.documentElement;
// 안드로이드 크롬(브라우저 · 앱 모두): 키보드를 화면 위에 덮어 띄우고(화면을 밀어 올리지 않음) 높이만 받아 UI만 올린다 → 불멍 배경은 그대로
const vkMode = 'virtualKeyboard' in navigator && isTouch;
let vkH = 0;
function fitKeyboard() {
  const vv = window.visualViewport;
  let top, h;
  let t0 = 0; // 보이는 영역의 위쪽 (iOS 는 화면을 밀어 올리므로 그만큼)
  if (vkMode) { h = innerHeight - vkH; top = h; } else if (vv) { h = vv.height; top = vv.offsetTop + vv.height; t0 = vv.offsetTop; } else { h = innerHeight; top = innerHeight; }
  root.style.setProperty('--vvb', `${Math.round(top)}px`);
  root.style.setProperty('--vvt', `${Math.round(t0)}px`);
  root.style.setProperty('--vvh', `${Math.round(h)}px`);
  document.body.classList.toggle('kb-open', vkMode ? vkH > 100 : root.clientHeight - h > 120);
}
if (vkMode) {
  navigator.virtualKeyboard.overlaysContent = true;
  navigator.virtualKeyboard.addEventListener('geometrychange', (e) => { vkH = e.target.boundingRect.height; fitKeyboard(); });
}
{
  // 키보드 애니메이션 동안 resize 이벤트가 늦게/드문드문 오므로 잠깐 매 프레임 맞춘다
  let until = 0;
  const follow = () => { fitKeyboard(); if (performance.now() < until) requestAnimationFrame(follow); };
  const burst = () => { const run = performance.now() >= until; until = performance.now() + 900; if (run) follow(); };
  window.visualViewport?.addEventListener('resize', burst);
  window.visualViewport?.addEventListener('scroll', burst);
  addEventListener('resize', burst);
  chatInputEl().addEventListener('focus', burst);
  chatInputEl().addEventListener('blur', () => {
    burst();
    // 키보드가 닫히면 iOS가 밀어올린 화면을 원래대로
    setTimeout(() => { if (scrollY || root.scrollTop || document.body.scrollTop) scrollTo(0, 0); }, 120);
  });
  fitKeyboard();
}
function chatInputEl() { return $('chatInput'); }
const chatInput = $('chatInput');
// 채팅 입력은 <textarea> (안드로이드 Chrome이 <input> 위에 비밀번호·카드·주소 자동완성 막대를 띄워 입력창을 가리기 때문)
// 안드로이드 키보드의 '보내기'는 keydown 대신 줄바꿈으로 들어오는 경우가 많아서 여기서 전송 처리
chatInput.addEventListener('input', () => {
  if (chatInput.value.includes('\n')) {
    chatInput.value = chatInput.value.replace(/\n/g, '');
    sendChat();
  }
});
addEventListener('keydown', (e) => {
  if (!me) return;
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') {
      if (e.isComposing) return;
      e.preventDefault();
      sendChat();
    } else if (e.key === 'Escape') closeChat();
    return;
  }
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (UI.dialogOpen()) {
    if (['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); UI.dialogNext(); }
    return;
  }
  if (gbOpen()) {
    if (e.code === 'Escape') closeGuestbook();
    return;
  }
  if (!$('boardModal').classList.contains('hidden')) {
    if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code) && !e.repeat) closeBoard();
    return;
  }
  if (storeIsOpen()) {
    if (['Escape', 'KeyE'].includes(e.code) && !e.repeat) closeStore();
    return;
  }
  if (shopIsOpen()) {
    if (['Escape', 'KeyE'].includes(e.code) && !e.repeat) closeShop();
    return;
  }
  if (!$('coinIntro').classList.contains('hidden')) {
    if (['Escape', 'Enter'].includes(e.code)) closeCoinIntro();
    return;
  }
  if (!$('blockModal').classList.contains('hidden')) {
    if (e.code === 'Escape') $('blockModal').classList.add('hidden');
    return;
  }
  if (!$('help').classList.contains('hidden')) {
    if (['Escape', 'Enter', 'Space'].includes(e.code)) $('help').classList.add('hidden');
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
  if (e.code === 'KeyT' && !e.repeat && !isTouch) { setEmotePanel(emotePanel.classList.contains('hidden')); return; }
  if (e.code === 'Escape' && !emotePanel.classList.contains('hidden')) { setEmotePanel(false); return; }
  keys.add(e.code);
  if (e.code === 'KeyM' && !e.repeat && state.sitting) { e.preventDefault(); openMusicModal(); return; }
  if (e.code === 'KeyF' && !e.repeat && feedPit()) { feedFire(); return; }
  if (e.code === 'KeyV' && !e.repeat) { if (state.sitting || state.lounge) setView(!view.fp); else UI.toast('모닥불 · 텐트 화로 · 벤치에 앉으면 1인칭 · 3인칭을 바꿀 수 있어요', 2000); return; }
  if (e.code === 'KeyE' && !e.repeat) {
    const it = findInteraction();
    if (it?.type !== 'chop') interact(it);
  }
  if (/^Digit[1-9]$/.test(e.code)) { const g = groupPowders(state.inv.powders)[Number(e.code.slice(5)) - 1]; if (g) throwPowder(g.idxs[0]); } // 숫자 = 가루 칸 순서 (같은 가루는 한 칸)
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const canvas = renderer.domElement;
let lastPX = 0, lastPY = 0;
const ptrs = new Map();
let pinchD = 0;
const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (ptrs.size === 1) { cam.dragging = true; lastPX = e.clientX; lastPY = e.clientY; }
  if (ptrs.size === 2) { cam.dragging = false; pinchD = pinchDist(); }
  if (!isTouch && document.activeElement === chatInput) closeChat(); // PC: 화면을 누르면 게임으로
  if (!isTouch) setEmotePanel(false);
  chatTap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
});
let chatTap = null;
// 모바일 채팅 중 화면을 '탭'하면: 키보드만 내리고 채팅창은 그대로 → 한 번 더 탭하면 닫기 (끌어서 시점을 돌릴 때는 닫지 않는다)
canvas.addEventListener('pointerup', (e) => {
  const s = chatTap; chatTap = null;
  if (!isTouch || !s || s.id !== e.pointerId || !document.body.classList.contains('chat-open')) return;
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || performance.now() - s.t > 350) return;
  if (document.activeElement === chatInput) chatInput.blur(); else closeChat();
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    const d = pinchDist();
    if (pinchD > 0) cam.dist = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, cam.dist * (pinchD / d)));
    pinchD = d;
    return;
  }
  if (!cam.dragging) return;
  const k = isTouch ? 1.4 : 1;
  cam.yaw -= (e.clientX - lastPX) * 0.006 * k;
  if (view.fp) cam.look = Math.min(1.25, Math.max(-1.1, cam.look - (e.clientY - lastPY) * 0.004 * k)); // 1인칭: 위로 끌면 올려다보기
  else cam.pitch = Math.min(1.25, Math.max(PITCH_MIN, cam.pitch + (e.clientY - lastPY) * 0.004 * k));
  lastPX = e.clientX; lastPY = e.clientY;
});
const ptrEnd = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchD = 0;
  if (ptrs.size === 1) { const [p] = ptrs.values(); lastPX = p.x; lastPY = p.y; cam.dragging = true; }
  if (ptrs.size === 0) cam.dragging = false;
};
canvas.addEventListener('pointerup', ptrEnd);
canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', (e) => {
  cam.dist = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, cam.dist * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: true });

// ---------------------------------------------------------------- 업데이트
function collide(p, r = 0.35) {
  for (const c of colliders) {
    if (c.theme && c.theme !== state.theme) continue; // 테마에서만 있는 것 (크리스마스 트리 등)
    const dx = p.x - c.x, dz = p.z - c.z;
    const min = c.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    }
  }
  // 텐트 벽 (걸어서는 못 드나든다: 들어가기 · 나가기 버튼으로) + 텐트 안 소품
  collideTents(p);
  if (state.tent) {
    for (const o of TENT_PROPS) {
      if (o.theme && o.theme !== state.theme) continue; // 테마에서만 있는 것 (크리스마스 트리)
      const c = tentLocal(state.tent, o.x, o.z);
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = o.r + r;
      if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
    }
  }
  // 🎈 내려앉았거나 낮게 떠 있는 열기구 바구니는 걸어서 통과하지 못한다 (타는 건 바구니 옆에서 E)
  for (const { el } of arena.balloons) {
    const g = el.group.position;
    if (g.y > 2.2) continue;
    const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz), min = BASKET_R + 0.2 + r;
    if (d < min && d > 1e-6) { p.x = g.x + (dx / d) * min; p.z = g.z + (dz / d) * min; }
  }
  const B = state.zone === 'arena' ? ARENA.bounds : BOUNDS; // 캠핑장 · 아레나 사이는 열기구로만
  p.x = Math.min(B.maxX, Math.max(B.minX, p.x));
  p.z = Math.min(B.maxZ, Math.max(B.minZ, p.z));
}
const rideTmp = new THREE.Vector3();

function updateLocal(dt) {
  if (!me) return;
  const blocked = document.activeElement === chatInput || UI.dialogOpen();
  let ix = 0, iz = 0;
  if (!blocked) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  }
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  // 앉아 있을 때는 조이스틱을 쓰지 않는다: 시점을 돌리려고 화면을 쓸다가 일어나 버리지 않게 (일어나기 버튼으로만 일어난다)
  if (!blocked && !state.sitting && touch?.active && touch.mag > 0) {
    ix = touch.x; iz = touch.y;
    run = touch.mag > 0.92;
  }
  const moving = ix !== 0 || iz !== 0;
  // 길 찾기: 걷는 동안에는 지도를 자동으로 띄우고, 멈추면 잠시 뒤 숨긴다 (모바일 · 좁은 PC 창처럼 지도가 접혀 있을 때)
  const tNow = performance.now();
  if (moving && !state.sitting) state.lastMoveAt = tNow;
  const mapAuto = !state.sitting && tNow - (state.lastMoveAt || -1e9) < 1800;
  if (mapAuto !== document.body.classList.contains('map-auto')) document.body.classList.toggle('map-auto', mapAuto);
  if (document.body.classList.contains('seated') !== !!state.sitting) {
    document.body.classList.toggle('seated', !!state.sitting);
    if (state.sitting) setBag(false); // 앉으면 가루 칸이 다시 나오니 가방은 닫는다
    else if (view.fp) setView(false, { silent: true }); // 어떤 이유로든 일어나면 3인칭
  }

  const riding = state.ride != null;
  if (riding) { // 🎈 바구니 안: 서서 둘러본다 (움직일 수 없다)
    arena.riderPos(state.ride, rideTmp);
    me.x = rideTmp.x; me.z = rideTmp.z; me.ry = arena.riderRy(state.ride); // 바구니 안에서 바깥 풍경을 본다
    me.char.setAnim('idle');
    if (moving && !state._rideHint) { state._rideHint = true; UI.toast(arena.b.at ? '🎈 출발 전엔 E(행동 버튼)로 내릴 수 있어요' : '🎈 날고 있어요! 도착하면 내려요', 2400); }
    if (!moving) state._rideHint = false;
  }
  if (state.sitting) {
    if (moving) standUp();
    else me.char.setAnim(amDJ() ? 'guitar' : 'sit');
  }
  if (state.lounge) {
    if (moving) leaveChair();
    else { const st = state.lounge.seat; me.x = st.x; me.z = st.z; me.ry = st.ry; me.char.setAnim('sit'); }
  }
  if (!state.sitting && !state.lounge && !riding) {
    const chopping = me.char.action?.name === 'chop';
    if (moving && !chopping) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      let mx = fx * -iz + rx * ix;
      let mz = fz * -iz + rz * ix;
      const l = Math.hypot(mx, mz);
      mx /= l; mz /= l;
      const sp = run ? 7.5 : 4.5;
      me.x += mx * sp * dt;
      me.z += mz * sp * dt;
      collide(me);
      me.ry = lerpAngle(me.ry, Math.atan2(mx, mz), Math.min(1, dt * 14));
      me.char.setAnim(run ? 'run' : 'walk');
    } else {
      me.char.setAnim('idle');
      if (view.fp && !me.char.busy()) me.ry = lerpAngle(me.ry, cam.yaw + Math.PI, Math.min(1, dt * 8));
    }
    // 장작 패기 (E 꾹 누르기)
    if (!blocked && keys.has('KeyE') && !me.char.busy()) {
      const it = findInteraction();
      if (it?.type === 'chop') tryChop(it);
    }
  }

  const r = me.char.root;
  r.position.set(me.x, riding ? rideTmp.y : world.heightAt(me.x, me.z), me.z);
  r.rotation.y = state.sitting || state.lounge ? me.ry : lerpAngle(r.rotation.y, me.ry, Math.min(1, dt * 16));

  // 고개 방향: 1인칭은 내 시야(카메라가 보는 방향)를 따라 고개를 돌린다.
  // 3인칭은 몸 정면으로 고정 (카메라를 돌려 내 얼굴을 볼 때 고개가 반대로 돌아가 뒤통수만 보이지 않게). 하늘을 올려다볼 때 고개를 드는 것만 남긴다
  camera.getWorldDirection(lookDir);
  const lookYaw = view.fp ? Math.atan2(lookDir.x, lookDir.z) : r.rotation.y;
  const elev = Math.asin(Math.max(-1, Math.min(1, lookDir.y)));
  const lookPitch = view.fp ? elev : Math.max(0, elev); // 3인칭은 늘 내려다보는 카메라라 위로 볼 때만
  me.char.setLook(lookYaw, lookPitch);
  // 다른 사람 화면에도 같은 방향으로 (서버 스냅샷과 같은 10Hz, 바뀌었을 때만. v1.21.1: 5Hz → 10Hz 로 고개가 바로 따라 돌게)
  state.lookT += dt;
  if (state.lookT >= 0.1) {
    state.lookT = 0;
    const L = state.lastLook;
    const dy = Math.abs(Math.atan2(Math.sin(lookYaw - L.y), Math.cos(lookYaw - L.y)));
    if (dy > 0.03 || Math.abs(lookPitch - L.p) > 0.03) {
      net.send({ t: 'look', y: +lookYaw.toFixed(2), p: +lookPitch.toFixed(2) });
      L.y = lookYaw; L.p = lookPitch;
    }
  }

  // 서버로 위치 전송 (10Hz)
  state.sendT += dt;
  if (state.sendT >= 0.1) {
    state.sendT = 0;
    const anim = state.sitting ? 'sit' : me.char.anim;
    const L = state.lastSent;
    if (!state.sitting && !riding && (Math.abs(L.x - me.x) > 0.01 || Math.abs(L.z - me.z) > 0.01 || Math.abs(L.ry - me.ry) > 0.02 || L.anim !== anim)) {
      net.send({ t: 'move', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), anim });
      Object.assign(L, { x: me.x, z: me.z, ry: me.ry, anim });
    }
  }
}

function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const p = r.ch.root.position;
    const k = Math.min(1, dt * 10);
    if (r.ride != null) { // 🎈 바구니 안
      arena.riderPos(r.ride, p);
      r.try = arena.riderRy(r.ride);
      r.ch.root.visible = true;
    } else {
      p.x += (r.tx - p.x) * k;
      p.z += (r.tz - p.z) * k;
      p.y = world.heightAt(p.x, p.z);
      const rt = tentAt(r.tx, r.tz);
      r.ch.root.visible = (!rt || rt === state.tent) // 다른 텐트 안 사람은 벽 · 지붕에 가려지므로 이름표 · 말풍선까지 숨긴다
        && (state.ride != null || inArena(p.x, p.z) === (state.zone === 'arena')); // 다른 곳(캠핑장 · 아레나)에 있는 사람은 그리지 않는다
    }
    r.ch.root.rotation.y = lerpAngle(r.ch.root.rotation.y, r.try, k);
    r.ch.setAnim(r.anim);
    r.ch.setLook(r.ly ?? null, r.lp || 0);
    r.ch.update(dt);
  }
}

const focus = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const fpPos = new THREE.Vector3(), fpHead = new THREE.Vector3(), fpDir = new THREE.Vector3();
const lookDir = new THREE.Vector3();
// 🌸 벚꽃 터널 카메라: 터널 길 가운데에서 4m 안이면 1, 9m 밖이면 0 (입구 · 출구에서 자연스럽게 섞인다)
// 🌸🌾 걷는 길 카메라 (v1.21 벚꽃 터널 → v1.21.2 핑크뮬리 · 갈대 · 억새 들판도): 들어서면 어깨 뒤로 낮게 다가가 풀 · 꽃 사이를 걷는 느낌, 빠져나오면 원래대로
const WALK_CAM = {
  cherry: { dist: 5.4, distPortrait: 7.6, pitch: 0.2 }, // 꽃 지붕 아래로
  muhly: { dist: 6.2, distPortrait: 8.2, pitch: 0.3 },  // 사람 키를 넘는 풀 사이로 (꽃 지붕이 없어 조금 더 높게)
  reed: { dist: 6.2, distPortrait: 8.2, pitch: 0.3 },
  kochia: { dist: 6.6, distPortrait: 8.6, pitch: 0.34 },
};
const WALK_IN = 4, WALK_OUT = 9; // 길에서 이 거리 안이면 완전히, 밖이면 원래 시점
const walkPts = ZONES.filter((z) => WALK_CAM[z.kind]).flatMap((z) => zonePath(z, 0.02).map(([x, z2]) => [x, z2, WALK_CAM[z.kind]]));
const walkCur = { ...WALK_CAM.cherry };
let walkK = 0, walkT = 0, walkGoal = 0, walkSet = WALK_CAM.cherry;
function walkCam(dt) {
  walkT -= dt;
  if (walkT <= 0 && me) {
    walkT = 0.15;
    let best = Infinity, set = walkSet;
    for (const [x, z, c] of walkPts) { const d = (x - me.x) ** 2 + (z - me.z) ** 2; if (d < best) { best = d; set = c; } }
    walkGoal = 1 - THREE.MathUtils.smoothstep(Math.sqrt(best), WALK_IN, WALK_OUT);
    walkSet = set;
  }
  const e = Math.min(1, dt * 1.6); // 천천히 다가가고 천천히 물러난다 (들판이 바뀌면 높이도 천천히)
  walkK += (walkGoal - walkK) * e;
  for (const key of ['dist', 'distPortrait', 'pitch']) walkCur[key] += (walkSet[key] - walkCur[key]) * e;
  return walkK;
}
function updateCamera(dt, t) {
  if (me) me.char.root.visible = !view.fp; // 1인칭이면 내 화면에서만 내 캐릭터를 숨긴다 (다른 사람에겐 보임)
  if (view.fp && me) {
    // 눈높이: 머리 위치를 따라가되 걸을 때 흔들림은 부드럽게
    me.char.head.getWorldPosition(fpHead);
    fpHead.y += 0.08;
    if (fpPos.lengthSq() === 0 || fpPos.distanceTo(fpHead) > 3) fpPos.copy(fpHead);
    else fpPos.lerp(fpHead, Math.min(1, dt * 12));
    const el = cam.look;
    fpDir.set(-Math.sin(cam.yaw) * Math.cos(el), Math.sin(el), -Math.cos(cam.yaw) * Math.cos(el));
    // 앉아 있으면 불까지 2m 남짓이라 너무 가깝다 → 눈 위치를 살짝 뒤 · 위로 빼서 불 전체가 보이게
    camera.position.copy(fpPos).addScaledVector(fpDir, state.sitting ? -0.95 : state.lounge ? -0.2 : 0.3);
    if (state.sitting || state.lounge) camera.position.y += 0.16; // 앉아서 1인칭: 의자에 앉은 눈높이 그대로, 반 걸음만 물러나 모닥불 둘레가 보이게
    if (state.shake > 0) {
      state.shake -= dt;
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.2;
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.2;
    }
    lookTmp.copy(camera.position).add(fpDir);
    camera.lookAt(lookTmp);
    cam.gaze = THREE.MathUtils.smoothstep(el, 0.35, 1.0);
    // 1인칭은 시야를 넓게 (가까운 불·사람이 화면을 꽉 채우지 않게). 텐트 안은 더 넓게.
    // 벤치는 먼 풍경(노을 · 해)을 보는 자리라 서서 볼 때와 비슷한 화각으로 — 넓으면 해가 작아지고 하늘만 휑해 보인다
    const fov = state.lounge ? (innerWidth < innerHeight ? 62 : 48) + 8 * cam.gaze
      : (innerWidth < innerHeight ? 82 : 72) + (state.tent ? 12 : 0) + 8 * cam.gaze;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    cam.target.set(me.x, 1.0, me.z);
    focus.set(me.x, 0, me.z);
    return;
  }
  let dist = cam.dist, pitch = cam.pitch;
  if (!me) {
    cam.yaw += dt * 0.04;
    camTarget.set(0, 0.5, 2);
    dist = 30; pitch = 0.5;
  } else if (state.sitting) {
    const pit = pits.get(state.sitting.pit);
    if (pit.stove) camTarget.set(pit.pos.x, 0.95, pit.pos.z); // 텐트 화로: 화로를 가운데 두고 둘레 소파가 다 보이게
    else camTarget.set((me.x + pit.pos.x) / 2, 0.9, (me.z + pit.pos.z) / 2);
    if (state.tent) { // 텐트 화로: 스와이프한 만큼 그대로 보이게 범위를 cam 값 자체에 건다 (숨은 값이 쌓이지 않게). 카메라는 텐트 안에 머문다
      cam.pitch = Math.min(Math.max(cam.pitch, ORBIT_MIN), 1.05);
      cam.dist = Math.min(cam.dist, 6.5);
    } else {
      dist = Math.min(cam.dist, 8.5);
      pitch = Math.min(cam.pitch, 0.5);
    }
  } else if (state.tent) {
    // 텐트 안: 실내에 머무는 가까운 3인칭. 좌우 · 위아래 스와이프로 자유롭게 돌려 볼 수 있다 (벽 · 지붕을 넘어가지 않게 아래에서 잡아 둔다)
    camTarget.set(me.x, 0.9, me.z);
    cam.pitch = Math.min(Math.max(cam.pitch, 0.25), 1.05);
    cam.dist = Math.min(cam.dist, 6);
  } else {
    camTarget.set(me.x, 1.0 + (state.ride != null ? me.char.root.position.y : world.heightAt(me.x, me.z)), me.z); // 언덕 위 · 열기구 바구니 안에서도 캐릭터를 본다
    // 🌸 벚꽃 터널: 걸어 들어가면 카메라가 어깨 뒤로 낮게 다가가 꽃 지붕 아래에서 걷는 느낌으로. 빠져나오면 원래대로
    // (내가 정한 거리 · 높이는 그대로 두고, 터널 안에서만 보이는 값을 섞는다)
    const k = walkCam(dt);
    if (k > 0.001) {
      const cd = innerWidth < innerHeight ? walkCur.distPortrait : walkCur.dist; // 휴대폰 세로는 화면이 좁아 조금 더 뒤에서
      dist = THREE.MathUtils.lerp(dist, Math.min(dist, cd), k);
      pitch = THREE.MathUtils.lerp(pitch, Math.min(pitch, walkCur.pitch), k);
    }
  }
  cam.target.lerp(camTarget, state.ride != null ? 1 : Math.min(1, dt * (me ? 6 : 1))); // 열기구 위: 바구니에 딱 붙어 따라간다 (늦게 따라가면 덜컹여 보인다)
  cam.curDist += (dist - cam.curDist) * Math.min(1, dt * 3);
  cam.curPitch = (cam.curPitch ?? pitch) + (pitch - (cam.curPitch ?? pitch)) * Math.min(1, dt * 3);
  // 낮게 내려가면 카메라는 캐릭터 뒤 낮은 곳에 머물고, 고개를 들어 하늘을 올려다본다
  const cp = cam.curPitch;
  const orbit = Math.max(cp, ORBIT_MIN);
  const tilt = me ? Math.max(0, ORBIT_MIN - cp) : 0;
  cam.gaze = THREE.MathUtils.smoothstep(tilt, 0.08, 0.75);
  const d = cam.curDist * (1 - 0.35 * cam.gaze);
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * Math.cos(orbit) * d,
    cam.target.y + Math.sin(orbit) * d,
    cam.target.z + Math.cos(cam.yaw) * Math.cos(orbit) * d,
  );
  if (me && state.tent) { // 텐트 안: 카메라가 벽 · 지붕 밖으로 나가지 않게 (밖이 보이지 않게). 보는 방향은 그대로 두고 바라보는 점 쪽으로 당긴다
    const t = state.tent, rMax = CFG.TENT_R - 0.4;
    const inside = (x, y, z) => { const r = Math.hypot(x - t.x, z - t.z); return r <= rMax && y <= roofY(r) - 0.35; };
    const T = cam.target, P = camera.position;
    if (!inside(P.x, P.y, P.z)) {
      let lo = 0, hi = 1; // T + (P - T) * k 가 안에 들어오는 가장 큰 k
      for (let i = 0; i < 12; i++) { const k = (lo + hi) / 2; if (inside(T.x + (P.x - T.x) * k, T.y + (P.y - T.y) * k, T.z + (P.z - T.z) * k)) lo = k; else hi = k; }
      P.set(T.x + (P.x - T.x) * lo, T.y + (P.y - T.y) * lo, T.z + (P.z - T.z) * lo);
    }
  }
  if (state.shake > 0) {
    state.shake -= dt;
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
  }
  if (tilt > 0) {
    const el = -orbit + tilt * 1.2; // 위로 고개 드는 각도 (최대 약 65°)
    lookTmp.set(-Math.sin(cam.yaw) * Math.cos(el), Math.sin(el), -Math.cos(cam.yaw) * Math.cos(el)).add(camera.position);
    camera.lookAt(lookTmp);
  } else camera.lookAt(cam.target);
  // 올려다볼수록 화각을 넓혀 하늘을 크게 담는다
  // 텐트 안은 카메라가 가까우니 화각을 넓혀 방이 한눈에 보이게 (좁은 화각이면 머리만 크게 보인다)
  const fov = state.tent && me ? (innerWidth < innerHeight ? 96 : 84) : 42 + 18 * cam.gaze; // 텐트 안은 넓게 (답답하지 않게)
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  focus.copy(cam.target).setY(0);
}
const lookTmp = new THREE.Vector3();

// ---- 카메라와 보는 곳(앉아 있으면 모닥불, 아니면 내 캐릭터) 사이를 가리는 기둥은 반투명하게
const fadedMats = new Map();
const fadeMat = (m) => {
  if (!fadedMats.has(m)) { const f = m.clone(); f.transparent = true; f.opacity = 0.3; f.depthWrite = false; fadedMats.set(m, f); }
  return fadedMats.get(m);
};
for (const o of world.occluders) o.orig = o.mesh.material;
function updateOccluders() {
  // 모닥불에 앉아 불을 볼 때만 가리는 기둥을 흐리게 한다 (서서 다닐 때 흐려지면 랜턴 머리만 떠 보여서)
  const pit = state.sitting && pits.get(state.sitting.pit);
  if (view.fp || !pit) { for (const o of world.occluders) if (o.mesh.material !== o.orig) o.mesh.material = o.orig; return; }
  const tx = pit.pos.x, tz = pit.pos.z;
  const cx = camera.position.x, cz = camera.position.z;
  const dx = tx - cx, dz = tz - cz, len2 = dx * dx + dz * dz || 1;
  for (const o of world.occluders) {
    // 기둥(세로 원기둥)과 카메라→목표 선분 사이의 거리 (위에서 내려다본 평면 기준)
    const t = ((o.x - cx) * dx + (o.z - cz) * dz) / len2;
    let hide = false;
    if (t > 0.02 && t < 0.98) {
      const px = cx + dx * t, pz = cz + dz * t;
      hide = Math.hypot(o.x - px, o.z - pz) < 1.1 + o.r;
    }
    const want = hide ? fadeMat(o.orig) : o.orig;
    if (o.mesh.material !== want) o.mesh.material = want;
  }
}

// 별 보기: 하늘을 올려다보면 화면 UI가 옅어지고, 별똥별이 떨어지면 알려 준다
let gazing = false, lastWish = -1e9, stargazeHinted = false;
function updateStargaze(t, dt) {
  const shot = world.sky.update(t, dt, camera, cam.gaze || 0);
  const on = (cam.gaze || 0) > 0.45;
  if (on !== gazing) { gazing = on; document.body.classList.toggle('stargaze', on); if (on) { track('stargaze', { view: view.fp ? 'fp' : 'tp' }); net.send({ t: 'quest', ev: 'stargaze' }); } }
  if (shot && t - lastWish > 40) {
    lastWish = t;
    UI.toast(WISHES[Math.floor(Math.random() * WISHES.length)], 3500);
  }
}
const WISHES = ['🌠 별똥별이에요! 얼른 소원을 빌어 봐요', '🌠 방금 별똥별 봤어요?', '🌠 별이 떨어졌어요… 소원 하나 ✨'];

const FIRE_COLOR = new THREE.Color('#ff7a2a');
function updateFires(t, dt) {
  const now = serverNow();
  // 카메라가 불에 가까울수록(1인칭, 앉아서 보기) 불꽃 밝기와 빛 번짐을 줄여 하얗게 뜨지 않게
  let nearLit = Infinity;
  for (const p of pitList) {
    const d = camera.position.distanceTo(p.pos);
    p.viewDim = (0.38 + 0.62 * THREE.MathUtils.smoothstep(d, 2.5, 9)) * (view.fp && state.sitting ? 0.78 : 1); // 1인칭으로 앉으면 불꽃 한가운데가 하얗게 뜨지 않게 한 번 더
    if (p.state === 'lit' && d < nearLit) nearLit = d;
    p.update(t, dt, now);
  }
  const bloomTarget = (view.fp && !state.lounge ? 0.16 : 0.22) + 0.2 * THREE.MathUtils.smoothstep(nearLit, 2.5, 9);
  // 가루 효과(빛나는 파티클): 1인칭으로 앉아 있으면 불이 눈앞이라 눈부시다 → 빛 세기를 낮춘다
  const glowTarget = view.fp && state.sitting ? 0.5 : 1;
  glowFx.points.material.uniforms.uGlow.value += (glowTarget - glowFx.points.material.uniforms.uGlow.value) * Math.min(1, dt * 4);
  bloom.strength += (bloomTarget - bloom.strength) * Math.min(1, dt * 3);
  // 가까운 모닥불에 실제 조명 배정
  const lit = pitList.filter((p) => p.intensity > 0.02)
    .map((p) => ({ p, d: p.pos.distanceToSquared(focus) }))
    .sort((a, b) => a.d - b.d);
  firePool.forEach((L, i) => {
    const e = i < fireN ? lit[i] : null; // 화질에 따라 쓰는 조명 수가 다르다
    if (!e) { L.intensity = 0; return; }
    L.position.set(e.p.pos.x, 1.1 * e.p.height, e.p.pos.z);
    L.color.copy(e.p.tip).lerp(FIRE_COLOR, 0.35);
    // 가루 색이 바닥에 번지는 빛도 1인칭으로 앉아 있으면 조금 낮춘다
    L.intensity = 14 * e.p.intensity * e.p.flicker * (view.fp && state.sitting ? 0.72 : 1);
  });
  // 연기 & 소리
  let level = 0;
  for (const { p, d } of lit) {
    if (!p.stove && d < 45 * 45 && Math.random() < dt * 2.2 * p.intensity) effects.smoke(p.pos, p.intensity); // 텐트 화로 연기는 지붕 위 연통에서 (fire.js)
    const dc = camera.position.distanceTo(p.pos);
    level = Math.max(level, p.intensity * Math.max(0, 1 - (dc - 4) / 16));
  }
  sound.update(dt, level);
}

function updateNpc(dt) {
  if (me) {
    const d = Math.hypot(me.x - NPC.x, me.z - NPC.z);
    const target = d < 8 ? Math.atan2(me.x - NPC.x, me.z - NPC.z) : NPC.ry;
    npc.root.rotation.y = lerpAngle(npc.root.rotation.y, target, Math.min(1, dt * 4));
    if (d < 6 && !npc._greeted) { npc._greeted = true; npc.play('wave'); }
    if (d > 10) npc._greeted = false;
    if (d > RANGE.npc + 2.5 && UI.dialogOwner() === 'lumi') UI.dialogClose();
    if (d > RANGE.npc + 2.5 && shopIsOpen()) closeShop();
    const can = state.inv.powders.length < CFG.BASE_POWDERS || !!state.inv.quest?.done || (state.inv.quest && !state.inv.quest.met);
    npc.markEl.style.display = can ? '' : 'none';
    // 보리도 가까이 오면 나를 본다. 멀어지면 창고 창을 닫는다
    for (const [ch, K] of [[keeper, KEEPER], [arenaKeeper, ARENA.keeper]]) { // 보리 · 콩이 (아레나)
      const dk = Math.hypot(me.x - K.x, me.z - K.z);
      const tk = dk < 8 ? Math.atan2(me.x - K.x, me.z - K.z) : K.ry;
      ch.root.rotation.y = lerpAngle(ch.root.rotation.y, tk, Math.min(1, dt * 4));
      if (dk < 6 && !ch._greeted) { ch._greeted = true; ch.play('wave'); }
      if (dk > 10) ch._greeted = false;
      ch.markEl.textContent = '📦';
      ch.markEl.style.display = state.inv.wood >= CFG.MAX_WOOD && state.inv.stored < CFG.MAX_STORED ? '' : 'none';
    }
    const kp = curKeeper();
    if (Math.hypot(me.x - kp.x, me.z - kp.z) > RANGE.keeper + 2.5 && storeIsOpen()) closeStore();
  }
  npc.update(dt);
  keeper.update(dt);
  if (state.zone === 'arena' || state.ride != null) arenaKeeper.update(dt);
  crowd.update(dt, me, state.zone === 'arena' || state.ride != null, !!(arena.show && serverNow() >= arena.show.startedAt));
  { // 🙌 관객 · 🎸 밴드 · 🎆 무대 연출: 곡이 나오는 동안
    const now = serverNow(), show = arena.show && now >= arena.show.startedAt ? arena.show : null;
    const playing = !!show && (state.zone === 'arena' || state.ride != null);
    fans.update(dt, performance.now() / 1000, playing);
    const nx = arena.next(now);
    const onStage = !!show || (!!nx && nx.at - now < 30000); // 곡 시작 30초 전에 무대로 걸어 들어온다
    band.update(dt, performance.now() / 1000, playing, onStage);
    const key = show ? Math.floor((now - show.startedAt) / 18000) : -1; // 18초마다 무대 불꽃 (곡이 시작할 때부터)
    if (key !== pyroKey) { pyroKey = key; if (playing && state.zone === 'arena') effects.play('stagepyro', new THREE.Vector3(ARENA.stage.x, 0, ARENA.stage.z + 5.5), '#ffcf8a'); }
  }
}

// ---------------------------------------------------------------- 🏡 캠핑장 주민 (v1.22.0)
const tidy = (id) => (id === 'christmas' ? 'snow' : id);
function residentLine(r) {
  const extra = r.lines[tidy(state.theme)];
  const pool = extra?.length && Math.random() < 0.6 ? extra : r.lines.base;
  return pool[Math.floor(Math.random() * pool.length)];
}
function stampLine(met = state.inv.resMet || []) {
  const n = ALWAYS.filter((a) => met.includes(a.id)).length, all = ALWAYS.length;
  const next = n < STAMP_GOALS[0] ? `${STAMP_GOALS[0]}명을 만나면 ✦ 특별한 가루!` : n < all ? `${all}명을 다 만나면 ✦ 하나 더!` : '오늘 주민을 모두 만났어요 🎉';
  return `🏅 오늘의 주민 도장 <b>${n}/${all}</b> <small>${next}</small>`;
}
function talkTo(e) {
  faceTo(e.pos.x, e.pos.z);
  if (e.r.kind === 'comfort') { openTea(e); return; }
  net.send({ t: 'talk', id: e.r.id });
}
net.on('talk', (m) => {
  const e = residents.get(m.id);
  if (!e) return;
  const r = e.r, chips = (list) => UI.powderGrid(list, 'sm');
  if (r.kind === 'comfort') { UI.dialog(comfortReply(m), null, { name: `${r.icon} ${r.name}`, owner: r.id }); return; }
  const pages = [residentLine(r)];
  if (m.reward) {
    pages.push(`${r.gift}\n${chips([m.reward])}`);
    pages.push(r.kind === 'always' ? stampLine(m.met || []) : `✨ <b>숨은 도장</b>을 찾았어요!\n<small>${r.kind === 'night' ? '깊은 밤에만' : '이런 날씨에만'} 만날 수 있는 주민이에요</small>`);
  } else if (m.full) pages.push('가방이 가루로 꽉 찼네요. 모닥불에 좀 뿌리고 또 와요.');
  if (m.bonus?.length) pages.push(`🏅 주민 도장을 채운 선물이에요!\n${chips(m.bonus)}`);
  e.ch.emote('happy', '😊');
  UI.dialog(pages, null, { name: `${r.icon} ${r.name}`, owner: r.id });
  track('npc_talk', { npc: r.id });
});
/** 🫖 찻집 할머니: 오늘 마음을 고르면 위로의 말과 함께 ✦ 위로의 풍등 가루 (하루 한 번) */
function openTea(e) {
  UI.dialog([{
    html: '어서 와요. 오늘 하루 어땠어요?',
    choices: MOODS.map((md) => `${md.icon} ${md.label}`),
    pick: (i) => { net.send({ t: 'talk', id: 'grandma', mood: MOODS[i].id }); track('npc_talk', { npc: `grandma_${MOODS[i].id}` }); return []; },
  }], null, { name: '🫖 찻집 할머니', owner: 'grandma' });
  e.ch.emote('love', '🥰');
}
function comfortReply(m) {
  const md = MOODS.find((x) => x.id === m.mood) || MOODS[0];
  const pages = [md.replies[Math.floor(Math.random() * md.replies.length)]];
  if (m.reward) {
    pages.push(md.pos ? `좋은 일엔 축하가 빠질 수 없죠!\n모닥불에 뿌리면 팡팡 터져요.\n${UI.powderGrid([m.reward], 'sm')}`
      : `이 마음, 가루에 담아 줄게요.\n모닥불에 뿌리면 따뜻한 풍등이 하늘로 떠올라요.\n${UI.powderGrid([m.reward], 'sm')}`);
    let el = document.getElementById('warmGlow');
    if (!el) { el = document.createElement('div'); el.id = 'warmGlow'; document.body.appendChild(el); }
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  } else if (m.full) pages.push('가방이 가득 찼네요. 가루 조금 뿌리고 또 와요.');
  return pages;
}
function updateResidents(dt) {
  const now = serverNow();
  residents.update(dt, { me, theme: state.theme, now, met: state.inv.resDay === kstDay(now) ? state.inv.resMet || [] : [], camPos: camera.position, inTent: !!state.tent, talkingId: UI.dialogOwner() });
  // 이야기하던 주민에게서 멀어지면 대화창을 닫는다 (걸어 다니는 주민은 조금 더 넉넉하게)
  const own = UI.dialogOwner(), e = own && own !== 'lumi' ? residents.get(own) : null;
  if (e && me && Math.hypot(me.x - e.pos.x, me.z - e.pos.z) > RESIDENT_RANGE + (e.r.walk || e.r.patrol ? 6 : 3)) UI.dialogClose();
}

function questText() {
  const inv = state.inv;
  const W = CFG.WOOD_PER_FIRE;
  if (state.sitting) {
    const pit = pits.get(state.sitting.pit);
    if (pit.state === 'lit') return inv.powders.length ? '<b>불멍 중…</b> 숫자키로 마법 가루를 뿌려 보세요 ✨' : '<b>불멍 중…</b> 타닥타닥 🔥';
    return pit.state === 'stacked' ? '쌓인 장작에 <b>불을 붙이면</b> 따뜻해져요 🔥 (일어나서 E)' : `<b>쉬는 중…</b> 장작 ${W}개를 모아 오면 불을 피울 수 있어요 🪵`;
  }
  if (state.tent) {
    const sp = pits.get(`f${state.tent.id}`);
    const tip = sp.state === 'lit' ? '타오르는 <b>화로</b> 둘레 소파에 앉아 쉬어요 🔥'
      : sp.state === 'stacked' ? '<b>화로</b>에 쌓인 장작에 불을 붙여요 🔥'
      : inv.wood >= W ? `가운데 <b>화로</b>에 장작 ${W}개를 넣고 불을 피워요 🪵` : `<b>화로</b>는 장작 ${W}개로 피워요 (🪵 ${inv.wood}/${W}) · 소파에 앉아 쉬어도 돼요`;
    return `🏕️ <b>${state.tent.label}</b> (${tentCount(state.tent)}/${CFG.TENT_CAP}명) · ${tip}`;
  }
  if (pitList.some((p) => p.owner === state.myId && p.state === 'stacked')) return '쌓아둔 장작에 <b>불을 붙여요</b> 🔥';
  if (inv.quest?.done) return '루미의 부탁 완료! 길 건너 <b>루미</b>에게 선물을 받으러 가요 ✨';
  if (inv.wood >= CFG.MAX_WOOD) return `장작이 가득! <b>화로</b>에 쌓거나 북서쪽 <b>창고지기 보리</b>에게 맡겨요 📦`;
  if (inv.wood >= W) return '<b>글램핑장 앞 화로</b>에 장작을 쌓아요';
  if (!inv.powders.length) return '장작 패는 곳 길 건너 <b>루미</b>에게 가면 마법 가루를 그냥 줘요 ✨';
  if (inv.powders.length && pitList.some((p) => p.state === 'lit')) return '타오르는 <b>모닥불</b>에 앉아 가루를 뿌려 봐요 🔥';
  return `동쪽 <b>통나무</b>에서 장작을 패요 (${inv.wood}/${W})`;
}

// 왼쪽 위 안내판 아래: 지금 루미의 부탁과 진행 상황
function lumiQuestLine() {
  const q = state.inv.quest;
  if (!q || !q.met || state.sitting && !['sitSec', 'together', 'music'].includes(QUESTS[q.i].type)) return '';
  const def = QUESTS[q.i];
  const pct = Math.round((q.p / def.goal) * 100);
  return `<div class="q-lumi${q.done ? ' done' : ''}">💜 루미의 부탁 <b>${def.title}</b> <span>${q.done ? '완료!' : questProgress(q)}</span><i style="--p:${pct}%"></i></div>`;
}

function directionText(t) {
  if (!t || !me) return '';
  const dx = t.x - me.x, dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d < 4) return '';
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const a = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
  const name = dirs[Math.round(a / (Math.PI / 4)) % 8];
  return `<div class="q-dir">🧭 ${t.label}까지 <b>${name}쪽 ${Math.round(d)}m</b></div>`; // 늘 한 줄 (방향 · 거리가 바뀌어도 줄이 넘치지 않게)
}

function updateHud() {
  if (!me) return;
  // 모바일: 앉아 있을 때는 UI를 화면 가장자리로 옮겨 모닥불이 잘 보이게 (CSS body.seated)
  const seated = !!state.sitting;
  if (document.body.classList.contains('seated') !== seated) document.body.classList.toggle('seated', seated);
  // 벤치 · 흔들의자(숲길 · 광장)에 앉았을 때: 시점 버튼을 보여 준다 (CSS body.lounging)
  if (document.body.classList.contains('lounging') !== !!state.lounge) document.body.classList.toggle('lounging', !!state.lounge);
  const it = findInteraction();
  let [html, dim] = promptFor(it);
  if (isTouch && html) {
    html = html.replace(/<kbd>E<\/kbd>\s*/g, '')
      .replace(/<kbd>\d<\/kbd>(~<kbd>\d<\/kbd>)?\s*가루 뿌리기/, '아래 가루를 탭해서 뿌리기')
      .replace('(꾹 누르기)', '(버튼 꾹)');
  }
  const action = actionFor(it);
  // 모바일: 액션 버튼에 이미 표시되는 안내는 중복으로 띄우지 않는다
  UI.setPrompt(UI.dialogOpen() || (isTouch && action && !dim) ? null : html, dim);
  touch?.setAction(action);
  const target = state.tent || state.zone === 'arena' || state.ride != null ? null : pickTarget({ me, inv: state.inv, sitting: state.sitting, pitList: pitList.filter((p) => !isArenaPit(p) && (!p.stove || p.owner === state.myId)), myId: state.myId, CFG }); // 텐트 안 · 아레나 · 열기구에서는 길 안내를 쉰다
  state.target = target;
  // 🎈 아레나 · 승강장 근처에서는 열기구가 올 때까지 남은 시간을 맨 위에
  const nearDock = state.zone === 'camp' && Math.hypot(me.x - BALLOON.camp.x, me.z - BALLOON.camp.z) < 18;
  if (state.ride != null || nearDock) { // 열기구 안 · 광장 승강장 근처: 남은 시간
    const [head, when] = arena.timeText(state.zone);
    UI.setQuest(`<b>${state.ride != null ? `🎈 ${arena.b.at ? `${Math.ceil(arena.b.next)}초 뒤 출발` : '날아가는 중'}` : `${head} ${when}`}</b><br>${questText() + lumiQuestLine()}`);
  } else if (state.zone === 'arena') UI.setQuest(arenaHint()); // 아레나: 무대는 위젯으로, 여기는 짧은 안내만
  else UI.setQuest(questText() + lumiQuestLine() + directionText(target));
  updateStageWidget();
  const pit = it?.pit;
  if (pit && pit.state === 'lit') {
    const rem = Math.ceil(pit.remaining(serverNow()) / 1000);
    UI.setFireTimer(`🔥 남은 장작 ${fmtRem(rem)}`);
  } else UI.setFireTimer(null);
  const mp = myMusicPit();
  let mb = null;
  // 버튼 글은 한 줄로 짧게, 자세한 설명은 누르면 알림으로 (tip)
  const M = isTouch ? '' : ' <kbd>M</kbd>';
  if (mp?.tent) {
    if (mp.music?.by === state.myId) mb = { text: '🔊 재생 중', on: false, tip: '🔊 스피커로 트는 중이에요 · 텐트를 나가면 멈춰요' };
    else if (state.sitting) mb = mp.music ? { text: '🎵 재생 중', on: false, tip: '🎵 지금 곡이 끝나면 다른 곡을 틀 수 있어요' } : { text: `🔊 노래 틀기${M}`, on: true };
  } else if (mp && mp.state === 'lit') {
    if (!mp.music) mb = { text: `💿 곡 고르기${M}`, on: true };
    else if (mp.music.by === state.myId) mb = { text: '🎸 연주 중', on: false, tip: '🎸 연주 중이에요 · 일어나면 멈춰요' };
    else mb = { text: '🎵 재생 중', on: false, tip: '🎵 지금 곡이 끝나면 다른 곡을 틀 수 있어요' };
  }
  const mbKey = mb ? mb.text + mb.on : '';
  if (state._mb !== mbKey) {
    state._mb = mbKey;
    const b = $('musicBtn');
    b.classList.toggle('hidden', !mb);
    if (mb) { b.innerHTML = mb.text.replace(/^(\S+) /, (m, e) => (EMOJI_ICON[e] ? icon(EMOJI_ICON[e]) + ' ' : m)); b.classList.toggle('off', !mb.on); b.dataset.tip = mb.tip || ''; b.title = mb.tip || ''; }
  }
  if (!mp && !$('musicModal').classList.contains('hidden')) closeMusicModal();
  // 🪵 장작 더 넣기: 타는 불 옆(앉아 있어도)에서 손에 장작이 있고, 2분 넘게 늘릴 여유가 있을 때
  const fp = feedPit();
  const fk = fp ? (isTouch ? '1' : '0') : '';
  if (state._fk !== fk) {
    state._fk = fk;
    $('feedBtn').classList.toggle('hidden', !fp);
    if (fp) $('feedBtn').innerHTML = `${icon('log')} 장작 <small>+${CFG.FEED_MS / 60000}분</small>${isTouch ? '' : ' <kbd>F</kbd>'}`;
  }
  const canThrow = !!state.sitting && pits.get(state.sitting.pit)?.state === 'lit';
  if (canThrow !== state._canThrow) { state._canThrow = canThrow; UI.setPowderEnabled(canThrow); }
}

/** 아레나 상태 칸 한 줄 안내 */
const arenaHint = () => '🔥 객석 모닥불에 장작 5개로 불을 피워요 · 장작은 왼쪽 창고지기 콩이에게';

// 🎤 아레나 무대 위젯: 지금 무대(썸네일 · 제목 · 신청자 · 진행 막대) / 다음 무대 / 없으면 신청 안내
let swKey = '', swT = 0;
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function updateStageWidget() {
  const el = $('stageWidget');
  const on = state.zone === 'arena' && state.ride == null && !!me;
  if (el.classList.contains('hidden') === on) { el.classList.toggle('hidden', !on); if (on) marquee($('swTitle')); } // 보이는 순간 다시 잰다 (숨어 있을 땐 너비가 0)
  if (!on) return;
  const now = serverNow();
  const show = arena.show && now >= arena.show.startedAt ? arena.show : null;
  const nx = show ? null : arena.next(now);
  const e = show || nx;
  const key = `${show?.id || ''}|${nx?.id || ''}`;
  if (key !== swKey) {
    swKey = key;
    el.classList.toggle('live', !!show);
    $('swTag').textContent = show ? '지금 무대' : nx ? '다음 무대' : '무대';
    marquee($('swTitle'), e ? `${e.title} · 🎤 ${show ? show.byName : nx.by}` : '아직 잡힌 무대가 없어요 · 승강장 앞 부스에서 신청해요'); // 긴 제목은 흐르게
  }
  if ((swT -= 1) > 0) return; // 시간 글은 가끔만
  swT = 10;
  if (show) {
    const dur = (arena.table.find((x) => x.id === show.id)?.dur) || (show.endsAt ? (show.endsAt - show.startedAt - 2000) / 1000 : 600);
    const at = Math.min(dur, Math.max(0, (now - show.startedAt) / 1000));
    $('swFill').style.width = `${(at / dur) * 100}%`;
    $('swWhen').textContent = `${fmtClock(at)} / ${fmtClock(dur)}`;
  } else if (nx) {
    const left = Math.max(0, (nx.at - now) / 1000);
    $('swWhen').textContent = left < 3600 ? `${Math.ceil(left / 60)}분 뒤` : kstWhen(nx.at);
  } else $('swWhen').textContent = '';
}

/** 지금 장작을 더 넣을 수 있는 타는 불 (없으면 null) */
function feedPit() {
  const it = findInteraction();
  const p = it?.pit;
  if (!p || p.state !== 'lit' || state.inv.wood < 1) return null;
  if (p.remaining(serverNow()) + CFG.FEED_MS > CFG.FIRE_MAX) return null; // 남은 시간은 2시간까지
  return p;
}
function feedFire() {
  const p = feedPit();
  if (!p) return;
  net.send({ t: 'feed', pit: p.id });
}
$('feedBtn').onclick = (e) => { e.currentTarget.blur(); feedFire(); };

// 팻말끼리 화면에서 겹치면: 지금 가야 할 곳 · 가까운 팻말만 또렷하게, 뒤쪽은 옅게 (0.25초마다)
let declutterT = 0;
function declutterLabels(dt) {
  declutterT -= dt;
  if (declutterT > 0) return;
  declutterT = 0.25;
  // NPC 이름표(루미 · 보리)도 같은 장소 팻말과 겹치면 정리한다 (캠퍼 이름표 · 말풍선은 건드리지 않는다)
  const els = [...document.querySelectorAll('.beacon, .gb-tag, .nametag.npc')].filter((el) => !el.classList.contains('here') && !el.classList.contains('near') && !el.classList.contains('far'));
  const items = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) { el.classList.remove('label-dim'); continue; }
    items.push({ el, r, on: el.classList.contains('on'), npc: el.classList.contains('npc'), d: Number(el.dataset.d || 999) });
  }
  items.sort((a, b) => (b.on - a.on) || (a.npc - b.npc) || (a.d - b.d)); // 목적지 → 장소 팻말 → NPC 이름표, 같은 종류면 가까운 것부터
  const kept = [];
  for (const it of items) {
    const hit = kept.some((k) => it.r.left < k.right + 4 && it.r.right > k.left - 4 && it.r.top < k.bottom + 4 && it.r.bottom > k.top - 4);
    it.el.classList.toggle('label-dim', hit);
    if (!hit) kept.push(it.r);
  }
}

function updateLabels() {
  const all = [npc, ...[...remotes.values()].map((r) => r.ch), ...(me ? [me.char] : [])];
  for (const ch of all) {
    const d = camera.position.distanceTo(ch.root.position);
    const vis = d < 48;
    if (ch._labelVis !== vis) { ch._labelVis = vis; ch.labelEl.style.visibility = vis ? 'visible' : 'hidden'; }
  }
  // 주민 이름표는 가까이(24m) 와야 보인다. 주민이 많아서 멀리까지 띄우면 화면이 복잡하다
  for (const { ch } of residents.list) {
    const vis = camera.position.distanceTo(ch.root.position) < 24;
    if (ch._labelVis !== vis) { ch._labelVis = vis; ch.labelEl.style.visibility = vis ? 'visible' : 'hidden'; }
  }
}

function updateStumps(dt) {
  woodcut.update(dt);
}

// ---- 프레임 제한 (발열 줄이기)
// - 120Hz/144Hz 화면에서도 초당 60번까지만 그린다
// - 조작이 없을 때(앉아서 불멍, 가만히 서 있기) 초당 30번으로 낮추고, 움직이거나 화면을 만지면 바로 60번으로 (PC · 폰 모두)
// - PC에서 다른 창을 보고 있을 때도 30번
let lastInputAt = 0;
const markInput = () => { lastInputAt = performance.now(); };
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchmove']) addEventListener(ev, markInput, { passive: true, capture: true });

// ---------------------------------------------------------------- 불멍 · 스피커 조명멍 몰입: 앉아서 가만히 있으면 UI를 흐리게
// 5초 동안 조작이 없으면 화면 UI가 천천히 사라지고, 화면을 만지거나 키를 누르면 바로 돌아온다.
// 흐린 상태에서 처음 누른 버튼은 UI만 깨운다 (실수로 일어나거나 가루를 뿌리지 않게)
const CALM_AFTER = 5000;
// 불멍으로 UI가 흐린 동안 새 채팅이 오면 채팅창만 몇 초 또렷하게 보여 준다
let peekTimer = 0;
function peekChat() {
  document.body.classList.add('chat-peek');
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => document.body.classList.remove('chat-peek'), 7000);
}
let swallowClick = false;
function updateCalm(now) {
  const busy = UI.dialogOpen() || document.querySelector('.overlay:not(.hidden)') || !$('bagPanel').classList.contains('hidden')
    || document.body.classList.contains('chat-open') || document.activeElement === chatInput || touch?.active || cam.dragging;
  const calm = !!(state.sitting || state.lounge) && !busy && now - lastInputAt > CALM_AFTER;
  if (calm !== document.body.classList.contains('calm')) document.body.classList.toggle('calm', calm);
}
addEventListener('pointerdown', (e) => {
  if (!document.body.classList.contains('calm')) { swallowClick = false; return; } // 깨운 뒤 다음 누름은 그대로 동작
  document.body.classList.remove('calm');
  if (e.target.closest?.('#chatToggle, #chat')) return; // 채팅은 한 번에 열리게 (흐림만 풀고 그대로 동작)
  if (e.target.closest?.('button, .powder, #status, #topright, #mapPanel')) {
    e.stopPropagation(); e.preventDefault();
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 700);
  }
}, { capture: true });
addEventListener('click', (e) => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, { capture: true });
addEventListener('keydown', () => document.body.classList.remove('calm'), { capture: true });

let lastDraw = 0;
function targetFps(now) {
  if (!document.hasFocus() && !isTouch) return 30;
  const busy = now - lastInputAt < 1500 || keys.size > 0 || touch?.active || cam.dragging || me?.char.busy?.();
  return busy ? 60 : 30;
}

const clock = new THREE.Clock();
function frame(now = performance.now()) {
  requestAnimationFrame(frame);
  const interval = 1000 / targetFps(now);
  if (now - lastDraw < interval - 3) return;
  lastDraw = now;
  autoQ.frame(now, targetFps(now)); // 🖥️ 자동 화질: 목표만큼 못 그리면 한 단계 낮춘다
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  shared.uTime.value = t;

  // 🎈 열기구를 먼저 움직이고 나서 탄 사람 · 카메라를 맞춘다 (반대 순서면 한 프레임 늦게 따라가 바구니 밖으로 삐져나오고 덜컹인다)
  arena.update(dt, t, serverNow(), { zone: state.zone, ride: state.ride, energy: Math.max(arena.show && serverNow() >= arena.show.startedAt ? 1 : 0, performance.now() < state.festUntil ? 1 : 0) });
  updateLocal(dt);
  updateTentState();
  tentRoom.fadeNear(camera.position, me && !view.fp && !state.tent ? me : null);
  // 텐트 안: 하늘빛(달빛 · 주변광)을 줄여 어둡게 — 화로 불빛이 주인공
  {
    const k = state.tent ? 0.4 : 1;
    skyDim += (k - skyDim) * Math.min(1, dt * 4);
    world.hemi.intensity = 0.45 * skyDim * themeLight.hemi; world.ambient.intensity = 0.18 * skyDim * themeLight.ambient; world.moonLight.intensity = 0.45 * skyDim * themeLight.moon;
    // 테마 안개 (천천히)
    const fk = Math.min(1, dt * 0.6);
    fogBase.lerp(fogTarget.color, fk);
    // 🌅 노을 쪽을 볼수록 안개가 분홍빛 (반대쪽은 밤 안개 그대로)
    camera.getWorldDirection(fogLook);
    const sw = Math.max(0, (fogLook.x * SUNSET.x + fogLook.z * SUNSET.z) / (Math.hypot(fogLook.x, fogLook.z) || 1));
    scene.fog.color.copy(fogBase).lerp(SUNSET_FOG, sw * sw * 0.7 * sunsetK()); // 어두운 보랏빛: 숲이 노을 앞 검은 실루엣으로
    scene.fog.near += (fogTarget.near - scene.fog.near) * fk;
    scene.fog.far += (fogTarget.far - scene.fog.far) * fk;
  }
  updateTentTags(dt);
  tentRoom.update(dt, !!(state.tent && state.tentMusic.get(state.tent.id)), camera.position);
  me?.char.update(dt);
  updateRemotes(dt);
  updateNpc(dt);
  updateResidents(dt);
  updateCamera(dt, t);
  // 불꽃 입자 크기 기준: 텐트 안 3인칭은 화각을 넓혀서(84°) 그대로 두면 입자가 2배 넘게 커져 하얗게 뭉친다 → 실제 화각으로 맞춘다
  // (바깥은 지금 보이는 불 모양 그대로 둔다)
  shared.uScale.value = state.tent && !view.fp ? renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) : baseUScale;
  updateOccluders();
  world.update(t, dt, camera, focus, shared);
  precip.update(dt, t, camera.position);
  // 지붕 아래(텐트 안 · 천막 아래 모닥불)면 빗방울이 지붕을 두드리는 소리
  if (me) sound.sheltered = !!state.tent || (themeOf(state.theme).tarps && world.tarpSpots.some((p) => Math.hypot(me.x - p.x, me.z - p.z) < 3.9));
  stepSounds(dt);
  updateStargaze(t, dt);
  updateFires(t, dt);
  updateMusicFx(dt);
  updateStumps(dt);
  updateTrail(dt);
  updatePlaceTags(dt);
  updateChairs(performance.now() / 1000);
  gbStand.update(dt, me);
  board.update(dt, me);
  lampPool.update(dt, focus, lightSpots);
  effects.update(dt);
  glowFx.update(dt);
  softFx.update(dt);
  updateHud();
  updateCalm(now);
  updateLabels();
  declutterLabels(dt);
  // 🎤 아레나 · 🎈 열기구
  const riding = state.ride != null;
  arena.setZone(state.zone, riding, hideCamp);
  world.sky.group.position.z = Math.max(0, camera.position.z - 120); // 하늘은 아레나까지 따라간다 (캠핑장에서는 그대로)
  if (document.body.classList.contains('in-arena') !== (state.zone === 'arena' || riding)) document.body.classList.toggle('in-arena', state.zone === 'arena' || riding);
  guide.update(dt, {
    me, target: state.target, pits: campPits, camYaw: cam.yaw,
    remotes: [...remotes.values()].map((r) => r.ch.root.position),
  });

  composer.render();
  labelRenderer.render(scene, camera);
}
requestAnimationFrame(frame);

// 아레나에 있을 땐 캠핑장 전체를 그리지 않는다 (처음 아레나에 갈 때 캠핑장 물체를 한 무리로 묶어 둔다)
// 묶지 않는 것: 하늘 · 조명 · 가루 입자 · 비/눈 · 아레나 · 열기구 · 객석 모닥불 · 사람(캐릭터)
let campGroup = null;
function hideCamp(hide) {
  if (!hide && !campGroup) return;
  if (!campGroup) {
    const keep = new Set([world.sky.group, glowFx.points, softFx.points, precip.rain, precip.snow, arena.root, arena.route.group, ...arena.balloons.map((b) => b.el.group), me?.char.root,
      ...arena.extraVisible, ...[...remotes.values()].map((r) => r.ch.root)].filter(Boolean));
    campGroup = new THREE.Group();
    campGroup.name = 'camp';
    for (const o of [...scene.children]) if (!keep.has(o) && !o.isLight && !o.userData?.character) campGroup.add(o);
    scene.add(campGroup);
  }
  campGroup.visible = !hide;
}
const campPits = pitList.filter((p) => !isArenaPit(p));

// 디버그용
window.__game = { scene, pits, state, effects, camera, net, cam, preview, monitors, tentRoom, THREE, renderer, composer, bloom, grade, remotes, arena, get me() { return me; } };
