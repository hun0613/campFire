import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { buildWorld } from './world.js';
import { FirePit } from './fire.js';
import { Character } from './character.js';
import { Particles } from './particles.js';
import { Effects } from './effects.js';
import { Net } from './net.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { Guide, pickTarget } from './guide.js';
import { Preview } from './preview.js';
import { isTouch, TouchControls } from './touch.js';
import { initPWA, initFullscreen } from './pwa.js';
import { initAnalytics, track, startHeartbeat } from './analytics.js';
import { Music } from './music.js';
import { Monitor } from './monitor.js';
import { Woodcut } from './woodcut.js';
import { GuestbookStand } from './guestbook.js';
import { NoticeBoard } from './board.js';
import { LightPool } from './lightpool.js';
import { CFG, PITS, STUMPS, NPC, KEEPER, BOUNDS, RANGE, LOOKS, GUESTBOOK, BOARD, QUESTS } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

// 간판 글꼴이 준비된 뒤 월드를 만든다
await Promise.race([document.fonts.load('64px Jua'), new Promise((r) => setTimeout(r, 2500))]);

// ---------------------------------------------------------------- 렌더러
if (isTouch) document.body.classList.add('touch');
// 화면 배율: 레티나 같은 고해상도 화면에서 2~3배로 그리면 GPU가 몇 배로 일해서 기기가 뜨거워진다.
// 배율은 최대 1.5배, 그리고 전체 픽셀 수가 예산(PC 320만 · 폰 220만)을 넘지 않게 맞춘다
const MAX_PR = 1.5;
const PIXEL_BUDGET = isTouch ? 2.2e6 : 3.2e6;
const renderPR = (w = innerWidth, h = innerHeight) => Math.max(0.75, Math.min(devicePixelRatio, MAX_PR, Math.sqrt(PIXEL_BUDGET / (w * h))));
// alpha: TV 화면 자리만 투명하게 뚫어서, 캔버스 '뒤'에 있는 유튜브 영상이 보이게 한다 (앞의 물체가 영상을 제대로 가림)
// antialias 는 끈다: 장면은 composer 의 별도 버퍼에 그려서 캔버스 안티에일리어싱은 효과 없이 메모리·대역폭만 쓴다
// powerPreference 는 기본값: 'high-performance' 는 외장 GPU를 강제로 깨워 노트북을 뜨겁게 한다
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(renderPR());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // (PCFSoft 는 three r187 에서 없어져 PCF 로 동작)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('app').appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.className = 'label-layer';
document.body.insertBefore(labelRenderer.domElement, $('join'));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#1a1c44', 40, 150);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.32, 0.85);
composer.addPass(bloom);
// 빛 번짐(블룸)은 원래 흐릿한 효과라 절반 해상도로 계산해도 티가 거의 안 난다 — GPU 부담은 크게 준다
{ const set = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => set(Math.round(w / 2), Math.round(h / 2)); }
// 블룸을 더할 때 투명도(알파)는 건드리지 않게 → TV 화면 구멍이 블룸에 메워지지 않는다
Object.assign(bloom.blendMaterial, {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
});
composer.addPass(new OutputPass());

const shared = { uTime: { value: 0 }, uScale: { value: 600 } };
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(renderPR(w, h));
  composer.setPixelRatio(renderPR(w, h));
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  music?.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 60 : 42; // 세로 화면에서는 시야를 넓힌다
  camera.updateProjectionMatrix();
  shared.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- 월드
const world = buildWorld(scene, { lowSpec: isTouch });
const pits = new Map(PITS.map((d) => [d.id, new FirePit(d, scene, shared)]));
const pitList = [...pits.values()];
const glowFx = new Particles(scene, shared, { max: 5000, additive: true });
const softFx = new Particles(scene, shared, { max: 1500, additive: false });
const effects = new Effects(glowFx, softFx);
const sound = new Sound();
const guide = new Guide(scene);

const monitors = new Map(PITS.map((d) => [d.id, new Monitor(d, scene)]));
const woodcut = new Woodcut(scene, STUMPS);
for (const s of world.stumpMeshes) s.log.visible = false; // 그루터기 위 통나무는 woodcut 이 그린다
const gbStand = new GuestbookStand(scene, GUESTBOOK);
const board = new NoticeBoard(scene, BOARD);
const lightSpots = [...world.lightSpots, gbStand.lightSpot, board.lightSpot];
const lampPool = new LightPool(scene, isTouch ? 2 : 3);
const colliders = [
  ...world.colliders,
  { x: GUESTBOOK.x, z: GUESTBOOK.z, r: 1.35 },
  { x: BOARD.x - 1.5, z: BOARD.z, r: 0.35 }, { x: BOARD.x + 1.5, z: BOARD.z, r: 0.35 }, { x: BOARD.x - 0.6, z: BOARD.z, r: 0.5 }, { x: BOARD.x + 0.6, z: BOARD.z, r: 0.5 },
  ...PITS.map((p) => ({ x: p.x, z: p.z, r: 0.95 })),
  ...[...monitors.values()].map((m) => ({ x: m.pos.x, z: m.pos.z, r: 0.55 })),
  ...[...monitors.values()].map((m) => ({ x: m.lpPos.x, z: m.lpPos.z, r: 0.38 })),
];

// 모닥불 조명은 가까운 불 몇 곳에만 (폰은 더 적게) — 조명 수가 곧 발열이다
const firePool = [];
for (let i = 0; i < (isTouch ? 3 : 4); i++) {
  const L = new THREE.PointLight('#ff8a3a', 0, 16, 1.5);
  scene.add(L);
  firePool.push(L);
}

// NPC 루미
const npc = new Character({ skin: '#ffe0c7', hair: '#c9a2ff', shirt: '#6a4bb5', pants: '#3a2f5a', hat: 'wizard' }, { name: '✨ 루미 · 가루 상인', kind: 'npc' });
npc.root.position.set(NPC.x, 0, NPC.z);
npc.root.rotation.y = NPC.ry;
scene.add(npc.root);

// NPC 보리 (장작 창고지기)
const keeper = new Character({ skin: '#f6c9a0', hair: '#6b4a2b', shirt: '#5f8a45', pants: '#5a4330', hat: 'beanie' }, { name: '📦 보리 · 장작 창고지기', kind: 'npc' });
keeper.root.position.set(KEEPER.x, 0, KEEPER.z);
keeper.root.rotation.y = KEEPER.ry;
scene.add(keeper.root);

// ---------------------------------------------------------------- 상태
const state = {
  myId: null,
  inv: { wood: 0, stored: 0, chops: 0, powders: [], quest: null },
  sitting: null,
  clockOffset: 0,
  lastSent: { x: 0, z: 0, ry: 0, anim: '' },
  sendT: 0,
  shake: 0,
};
let me = null; // { char, x, z, ry }
const remotes = new Map();
const keys = new Set();
const serverNow = () => Date.now() + state.clockOffset;

const ORBIT_MIN = 0.14; // 이보다 더 내리면 카메라가 고개를 들어 하늘을 본다
const PITCH_MIN = ORBIT_MIN - 1.0;
// 시점: 'tp' 3인칭 / 'fp' 1인칭 (기기에 기억)
// 서 있을 때는 늘 3인칭, 모닥불에 앉으면 1인칭으로 바뀐다 (앉은 동안 🎥 버튼 · V로 3인칭 ↔ 1인칭)
const view = { fp: false };
const cam = { look: 0, yaw: 0, pitch: 0.78, dist: 15, curDist: 34, target: new THREE.Vector3(0, 0, 0), dragging: false };

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
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

$('helpBtn').onclick = () => $('help').classList.remove('hidden');

// ---------------------------------------------------------------- 모바일: 오른쪽 메뉴(독) 접기 · 펼치기
// 처음에는 ☰ 버튼 하나만 (접속자 수 배지). 누르면 펼쳐지고, 메뉴를 하나 고르거나 화면을 만지면 다시 접힌다
function setDock(open) {
  document.body.classList.toggle('dock-open', open);
  $('dockToggle').textContent = open ? '✕' : '☰';
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
  if (fp && !state.sitting) fp = false; // 서 있을 때는 3인칭만
  const changed = view.fp !== fp;
  view.fp = fp;
  cam.look = state.sitting ? -0.14 : 0;
  fpPos.set(0, 0, 0);
  // 앉아 있을 때 보이는 시점 버튼: 지금과 반대 시점을 알려 준다
  $('seatViewBtn').innerHTML = fp ? '🎥 3인칭으로 보기' : '👁️ 1인칭으로 보기';
  if (!isTouch) $('seatViewBtn').innerHTML += ' <kbd>V</kbd>';
  document.body.classList.toggle('fp', fp);
  if (changed && !silent && me) {
    track('view_toggle', { view: fp ? 'fp' : 'tp' });
    UI.toast(fp ? '👁️ 1인칭 시점' : '🎥 3인칭 시점', 1600);
  }
}
$('seatViewBtn').onclick = (e) => { e.currentTarget.blur(); setView(!view.fp); };
// 💌 친구 초대: 휴대폰은 공유 창, PC는 링크 복사. 공유하면 루미의 「친구 초대」 부탁이 채워진다
$('shareBtn').onclick = async (e) => {
  e.currentTarget.blur();
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
};
initPWA();
initAnalytics();
$('seatViewBtn').innerHTML = `👁️ 1인칭으로 보기${isTouch ? '' : ' <kbd>V</kbd>'}`; // 처음엔 3인칭 (setView는 카메라 준비 뒤에 쓴다)
initFullscreen();
$('mapToggle').onclick = () => document.body.classList.toggle('map-open');
$('status').addEventListener('click', () => { if (isTouch) document.body.classList.toggle('quest-open'); });
$('helpClose').onclick = () => $('help').classList.add('hidden');
$('soundBtn').onclick = (e) => {
  sound.init();
  const muted = sound.toggle();
  e.currentTarget.textContent = muted ? '🔇' : '🔊';
  music.muted = muted;
};

// ---------------------------------------------------------------- 네트워크
const net = new Net();

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
    addEventListener('pointerdown', () => sound.init(), { once: true, capture: true });
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
  for (const p of m.players) addRemote(p);
  updateOnline();
});

net.on('welcome', (m) => {
  state.myId = m.id;
  const char = new Character(look, { name: m.me.name, kind: 'me' });
  char.root.position.set(m.me.x, 0, m.me.z);
  scene.add(char.root);
  me = { char, x: m.me.x, z: m.me.z, ry: m.me.ry, name: m.me.name };
  cam.yaw = 0;
  $('join').classList.add('hidden');
  preview.dispose();
  $('hud').classList.remove('hidden');
  const firstTime = !store.get('helpSeen', false);
  requestBoard();
  track('game_join', { device: isTouch ? 'mobile' : 'pc', view: view.fp ? 'fp' : 'tp', returning: !firstTime });
  if (!state.hbStarted) { state.hbStarted = true; startHeartbeat(() => ({ sitting: !!state.sitting, view: view.fp ? 'fp' : 'tp' })); }
  if (firstTime) {
    $('help').classList.remove('hidden');
    store.set('helpSeen', true);
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
        UI.toast('📱 가로로 돌리면 더 넓게 볼 수 있어요', 5000);
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
net.on('carry', (m) => remotes.get(m.id)?.ch.setCarry(m.n));
net.on('leave', (m) => {
  const r = remotes.get(m.id);
  if (r) { r.ch.dispose(); remotes.delete(m.id); }
  updateOnline();
});

net.on('snap', (m) => {
  const est = m.now - Date.now();
  state.clockOffset = state.clockOffset * 0.9 + est * 0.1;
  for (const [id, x, z, ry, anim] of m.p) {
    if (id === state.myId) continue;
    const r = remotes.get(id);
    if (!r) continue;
    r.tx = x; r.tz = z; r.try = ry; r.anim = anim;
  }
});

net.on('inv', (m) => {
  if (m.save) store.set('save', m.save); // 서버가 서명한 백업 (서버가 재시작돼도 장작 복원)
  const prev = state.inv;
  state.inv = { wood: m.wood, stored: m.stored || 0, chops: m.chops, powders: m.powders, quest: m.quest || null };
  if (storeIsOpen()) renderStore(prev);
  if (m.gained && me && state.lastStumpIdx != null) splitLog(state.lastStumpIdx, me.char);
  me?.char.setCarry(m.wood);
  refreshInventory();
  if (m.gained && me) {
    track('wood_chop', { wood: m.wood });
    floatText('+1 🪵', me.char.root.position.clone().setY(2.3));
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
function openStore() {
  faceTo(KEEPER.x, KEEPER.z);
  keeper.play('wave');
  $('storeSay').textContent = STORE_SAY.hello[Math.floor(Math.random() * STORE_SAY.hello.length)];
  renderStore();
  $('storeModal').classList.remove('hidden');
  state.storeOpenedAt = performance.now();
}
function closeStore() { $('storeModal').classList.add('hidden'); }
$('storeClose').onclick = closeStore;
$('storeModal').addEventListener('click', (e) => { if (e.target.id === 'storeModal' && performance.now() - (state.storeOpenedAt || 0) > 600) closeStore(); });
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
  const chips = (list) => list.map((p) => UI.powderChip(p)).join('');
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
  if (!m.basic.length && !m.finished && !m.first) {
    pages.unshift(m.full ? '어머, 가방이 가루로 꽉 찼네! 모닥불에 좀 뿌리고 오렴 🔥' : `가루는 아직 넉넉하네! ${CFG.BASE_POWDERS}개보다 적어지면 또 채워 줄게 ✨`);
  }
  UI.dialog(pages);
});

net.on('pit', (m) => {
  const pit = pits.get(m.pit.id);
  if (!pit) return;
  const prev = pit.state;
  pit.setState(m.pit);
  if (prev !== 'lit' && pit.state === 'lit') {
    effects.ignite(pit.pos);
    sound.ignite(volAt(pit.pos));
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
  const pd = PITS.find((d) => d.id === m.pit);
  if (view.fp && pd) {
    cam.yaw = Math.atan2(-(pd.x - m.x), -(pd.z - m.z));
    cam.look = -0.14;
  } else if (mon && pd) {
    // TV · LP가 함께 보이는 기본 방향 근처에서, 내 캐릭터가 카메라와 불 사이에 끼지 않는 각도를 고른다
    const base = Math.atan2(-(mon.pos.x - pd.x), -(mon.pos.z - pd.z));
    const seatA = Math.atan2(m.x - pd.x, m.z - pd.z);
    const diff = (a) => Math.abs(Math.atan2(Math.sin(a - seatA), Math.cos(a - seatA)));
    cam.yaw = [0.45, -0.45, 0.85, -0.85].map((o) => base + o).reduce((best, a) => (diff(a) > diff(best) ? a : best));
  }
  me.char.setAnim('sit');
  refreshInventory();
  if (!stargazeHinted) {
    stargazeHinted = true;
    setTimeout(() => UI.toast(isTouch ? '🌌 오른쪽 화면을 위로 쓸어 올리면 밤하늘을 올려다볼 수 있어요' : '🌌 화면을 위로 드래그하면 밤하늘을 올려다볼 수 있어요', 5000), 2500);
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
  UI.addChat(m.name, m.text);
  const ch = m.id === state.myId ? me?.char : remotes.get(m.id)?.ch;
  ch?.say(m.text);
});
net.on('sys', (m) => UI.addChat('', m.text, true));
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
  ch.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
  ch.root.rotation.y = p.ry;
  scene.add(ch.root);
  remotes.set(p.id, { ch, tx: p.x, tz: p.z, try: p.ry, anim: p.anim, name: p.name });
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
const myMusicPit = () => (state.sitting ? pits.get(state.sitting.pit) : null);
const amDJ = () => myMusicPit()?.music?.by === state.myId;

const fmtDur = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '');
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const music$ = { left: 0, hasKey: false, resetAt: 0, busy: false };

function openMusicModal() {
  const pit = myMusicPit();
  if (!pit || pit.state !== 'lit') { UI.toast('불 붙은 모닥불에 앉아서 곡을 고를 수 있어요 💿'); return; }
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
  $('musicSearch').textContent = '…';
  $('musicQ').blur();
  net.send({ t: 'search', q });
});
$('musicBtn').addEventListener('click', openMusicModal);
$('musicCancel').addEventListener('click', closeMusicModal);
$('musicQ').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMusicModal(); });
net.on('musicMenu', (m) => {
  Object.assign(music$, { left: m.left, hasKey: m.hasKey, resetAt: m.resetAt });
  renderQuota();
  renderSongs('🕘 최근에 모닥불에서 나온 곡', m.recent, m.hasKey ? '아직 없어요. 곡을 검색해 보세요!' : '아직 없어요. 유튜브 링크를 붙여 넣어 틀 수 있어요');
  if (!m.hasKey) $('musicQ').placeholder = '유튜브 링크를 붙여 넣어 주세요';
});
net.on('searchResult', (m) => {
  $('musicSearch').textContent = '검색';
  music$.left = m.left;
  renderQuota();
  renderSongs(`🔍 "${m.q}" 검색 결과`, m.items, '틀 수 있는 곡을 찾지 못했어요. 다른 검색어로 해 보세요');
});
net.on('searchFail', (m) => {
  $('musicSearch').textContent = '검색';
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
  const text = { ended: '🎵 곡이 끝났어요. 이제 다른 곡을 틀 수 있어요', left: '🎸 연주자가 자리를 떠나서 음악이 멈췄어요', fire: '🔥 불이 꺼져서 음악이 멈췄어요' }[m.reason];
  if (text) UI.toast(text);
});

// ---------------------------------------------------------------- 방명록
const gb$ = { items: [], page: 0, busy: false, mineIds: new Set(), newId: null, openedAt: 0 };
const GB_PER_PAGE = 5;
const gbOpen = () => !$('gbModal').classList.contains('hidden');
function fmtDay(at) {
  const d = new Date(at);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function openGuestbook() {
  $('gbErr').classList.add('hidden');
  $('gbModal').classList.remove('hidden');
  gb$.openedAt = performance.now();
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
// 바깥(어두운 배경)을 누르면 닫기. 단, 모바일 버튼으로 연 직후 손을 떼며 생기는 클릭은 무시한다
$('gbModal').addEventListener('click', (e) => {
  if (e.target === $('gbModal') && performance.now() - gb$.openedAt > 600) closeGuestbook();
});
$('gbForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('gbText').value.trim();
  if (!text || gb$.busy) return;
  gb$.busy = true;
  $('gbSend').disabled = true;
  $('gbSend').textContent = '남기는 중…';
  $('gbErr').classList.add('hidden');
  net.send({ t: 'gbWrite', text });
});
function gbDone() {
  gb$.busy = false;
  $('gbSend').disabled = false;
  $('gbSend').textContent = '✍️ 남기기';
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
  board$.openedAt = performance.now();
  net.send({ t: 'boardGet' });
  track('board_open', { items: board$.items.length });
}
function closeBoard() { $('boardModal').classList.add('hidden'); }
$('boardClose').onclick = closeBoard;
$('boardModal').addEventListener('click', (e) => { if (e.target.id === 'boardModal' && performance.now() - (board$.openedAt || 0) > 600) closeBoard(); });

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
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
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

// 연주자 주위로 ♪, 연주 중인 모닥불 TV 켜기, 내가 앉은 모닥불의 음악 재생
let noteT = 0;
function updateMusicFx(dt) {
  noteT += dt;
  const emit = noteT > 0.9;
  if (emit) noteT = 0;
  for (const p of pitList) {
    const m = p.state === 'lit' ? p.music : null;
    monitors.get(p.id).update(dt, !!m);
    if (m && emit) {
      const ch = m.by === state.myId ? me?.char : remotes.get(m.by)?.ch;
      if (ch && camera.position.distanceTo(ch.root.position) < 40) {
        const pos = ch.root.position.clone();
        pos.x += (Math.random() - 0.5) * 0.8; pos.y = 1.4 + Math.random() * 0.4; pos.z += (Math.random() - 0.5) * 0.8;
        floatText(Math.random() < 0.5 ? '♪' : '♫', pos);
      }
    }
  }
  if (me) {
    music.clockOffset = state.clockOffset;
    const pit = myMusicPit();
    music.update(dt, pit, pit && monitors.get(pit.id), serverNow(), camera);
    const showTag = !!pit && pit.state === 'lit' && !pit.music;
    if (showTag) lpTag.position.copy(monitors.get(pit.id).lpPos).setY(1.25);
    lpTag.visible = showTag;
  }
}

function floatText(text, pos) {
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.copy(pos);
  scene.add(o);
  setTimeout(() => { scene.remove(o); el.remove(); }, 1300);
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
  $('bagCount').textContent = n;
  if (bagLast >= 0 && n > bagLast) { $('bagBtn').classList.remove('bump'); void $('bagBtn').offsetWidth; $('bagBtn').classList.add('bump'); }
  bagLast = n;
  $('bagBtn').classList.toggle('has-legend', list.some((p) => p.legend));
  if ($('bagPanel').classList.contains('hidden')) return;
  const legend = list.filter((p) => p.legend).length;
  $('bagSub').textContent = n ? `마법 가루 ${n}개${legend ? ` · ✦ 특별한 가루 ${legend}개` : ''}` : '';
  $('bagList').innerHTML = n ? list.map((p) => UI.powderChip(p)).join('')
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
  if (state.sitting) return { type: 'seated', pit: pits.get(state.sitting.pit) };
  let best = null;
  let bestD = Infinity;
  STUMPS.forEach((s, i) => {
    const d = Math.hypot(me.x - s.x, me.z - s.z);
    if (d < RANGE.stump && d < bestD) { best = { type: 'chop', idx: i, s }; bestD = d; }
  });
  const dn = Math.hypot(me.x - NPC.x, me.z - NPC.z);
  if (dn < RANGE.npc && dn < bestD) { best = { type: 'npc' }; bestD = dn; }
  const dk = Math.hypot(me.x - KEEPER.x, me.z - KEEPER.z);
  if (dk < RANGE.keeper && dk < bestD) { best = { type: 'keeper' }; bestD = dk; }
  const dg = Math.hypot(me.x - GUESTBOOK.x, me.z - GUESTBOOK.z);
  if (dg < RANGE.guestbook && dg < bestD) { best = { type: 'guestbook' }; bestD = dg; }
  const db = Math.hypot(me.x - BOARD.x, me.z - BOARD.z);
  if (db < RANGE.board && db < bestD) { best = { type: 'board' }; bestD = db; }
  for (const pit of pitList) {
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
  if (it.type === 'keeper') return [`<kbd>E</kbd> 장작 창고 열기 📦 <small>(맡긴 장작 ${inv.stored}개)</small>`];
  if (it.type === 'guestbook') return ['<kbd>E</kbd> 방명록 펼쳐 보기 📖'];
  if (it.type === 'board') return ['<kbd>E</kbd> 캠핑장 소식 보기 📌'];
  if (it.type === 'pit') {
    const p = it.pit;
    if (p.state === 'empty') {
      if (inv.wood >= W) return [`<kbd>E</kbd> 장작 쌓기 <small>(🪵 ${W}개 사용)</small>`];
      return p.freeSeats() > 0 ? [`<kbd>E</kbd> 의자에 앉아 쉬기 <small>(장작 ${W}개면 불을 피울 수 있어요 · 🪵 ${inv.wood}/${W})</small>`] : ['자리가 꽉 찼어요', true];
    }
    if (p.state === 'stacked') return ['<kbd>E</kbd> 불 붙이기 🔥'];
    if (p.state === 'lit') return p.freeSeats() > 0 ? ['<kbd>E</kbd> 앉아서 불멍하기 🔥'] : ['자리가 꽉 찼어요', true];
  }
  if (it.type === 'seated') {
    const p = it.pit;
    if (p.state !== 'lit') return ['<kbd>E</kbd> 일어나기 · 불이 붙으면 가루를 뿌리고 노래를 틀 수 있어요'];
    const n = inv.powders.length;
    if (n) return [`<kbd>1</kbd>${n > 1 ? `~<kbd>${n}</kbd>` : ''} 가루 뿌리기 · <kbd>E</kbd> 일어나기`];
    return ['<kbd>E</kbd> 일어나기 · 루미에게 받은 가루가 있으면 뿌릴 수 있어요'];
  }
  return [null];
}

function interact(it) {
  if (!it || !me) return;
  if (it.type === 'chop') tryChop(it);
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
  if (it.type === 'keeper') return { icon: '📦', label: '창고' };
  if (it.type === 'guestbook') return { icon: '📖', label: '방명록' };
  if (it.type === 'board') return { icon: '📌', label: '소식' };
  if (it.type === 'seated') return { icon: '🚶', label: '일어나기' };
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
  $('chatInput').focus();
  const log = $('chatLog');
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}
function closeChat() {
  $('chatInput').blur();
  document.body.classList.remove('chat-open');
}
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
const vkMode = 'virtualKeyboard' in navigator && matchMedia('(display-mode: fullscreen)').matches;
let vkH = 0;
function fitKeyboard() {
  const vv = window.visualViewport;
  let top, h;
  if (vkMode) { h = innerHeight - vkH; top = h; } else if (vv) { h = vv.height; top = vv.offsetTop + vv.height; } else { h = innerHeight; top = innerHeight; }
  root.style.setProperty('--vvb', `${Math.round(top)}px`);
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
  if (!$('help').classList.contains('hidden')) {
    if (['Escape', 'Enter', 'Space'].includes(e.code)) $('help').classList.add('hidden');
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
  keys.add(e.code);
  if (e.code === 'KeyM' && !e.repeat && state.sitting) { e.preventDefault(); openMusicModal(); return; }
  if (e.code === 'KeyV' && !e.repeat) { if (state.sitting) setView(!view.fp); else UI.toast('모닥불에 앉으면 1인칭 · 3인칭을 바꿀 수 있어요', 2000); return; }
  if (e.code === 'KeyE' && !e.repeat) {
    const it = findInteraction();
    if (it?.type !== 'chop') interact(it);
  }
  if (/^Digit[1-9]$/.test(e.code)) throwPowder(Number(e.code.slice(5)) - 1);
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
  if (document.activeElement === chatInput || document.body.classList.contains('chat-open')) closeChat();
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    const d = pinchDist();
    if (pinchD > 0) cam.dist = Math.min(26, Math.max(6, cam.dist * (pinchD / d)));
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
  cam.dist = Math.min(26, Math.max(6, cam.dist * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: true });

// ---------------------------------------------------------------- 업데이트
function collide(p, r = 0.35) {
  for (const c of colliders) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const min = c.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    }
  }
  p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x));
  p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z));
}

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
  if (document.body.classList.contains('seated') !== !!state.sitting) {
    document.body.classList.toggle('seated', !!state.sitting);
    if (state.sitting) setBag(false); // 앉으면 가루 칸이 다시 나오니 가방은 닫는다
    else if (view.fp) setView(false, { silent: true }); // 어떤 이유로든 일어나면 3인칭
  }

  if (state.sitting) {
    if (moving) standUp();
    else me.char.setAnim(amDJ() ? 'guitar' : 'sit');
  }
  if (!state.sitting) {
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
  r.position.set(me.x, world.heightAt(me.x, me.z), me.z);
  r.rotation.y = state.sitting ? me.ry : lerpAngle(r.rotation.y, me.ry, Math.min(1, dt * 16));

  // 서버로 위치 전송 (10Hz)
  state.sendT += dt;
  if (state.sendT >= 0.1) {
    state.sendT = 0;
    const anim = state.sitting ? 'sit' : me.char.anim;
    const L = state.lastSent;
    if (!state.sitting && (Math.abs(L.x - me.x) > 0.01 || Math.abs(L.z - me.z) > 0.01 || Math.abs(L.ry - me.ry) > 0.02 || L.anim !== anim)) {
      net.send({ t: 'move', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), anim });
      Object.assign(L, { x: me.x, z: me.z, ry: me.ry, anim });
    }
  }
}

function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const p = r.ch.root.position;
    const k = Math.min(1, dt * 10);
    p.x += (r.tx - p.x) * k;
    p.z += (r.tz - p.z) * k;
    p.y = world.heightAt(p.x, p.z);
    r.ch.root.rotation.y = lerpAngle(r.ch.root.rotation.y, r.try, k);
    r.ch.setAnim(r.anim);
    r.ch.update(dt);
  }
}

const focus = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const fpPos = new THREE.Vector3(), fpHead = new THREE.Vector3(), fpDir = new THREE.Vector3();
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
    camera.position.copy(fpPos).addScaledVector(fpDir, state.sitting ? -0.75 : 0.3);
    if (state.sitting) camera.position.y += 0.25;
    if (state.shake > 0) {
      state.shake -= dt;
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.2;
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.2;
    }
    lookTmp.copy(camera.position).add(fpDir);
    camera.lookAt(lookTmp);
    cam.gaze = THREE.MathUtils.smoothstep(el, 0.35, 1.0);
    const fov = (innerWidth < innerHeight ? 82 : 72) + 8 * cam.gaze; // 1인칭은 시야를 넓게 (가까운 불·사람이 화면을 꽉 채우지 않게)
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
    camTarget.set((me.x + pit.pos.x) / 2, 0.9, (me.z + pit.pos.z) / 2);
    dist = Math.min(cam.dist, 8.5);
    pitch = Math.min(cam.pitch, 0.5);
  } else {
    camTarget.set(me.x, 1.0, me.z);
  }
  cam.target.lerp(camTarget, Math.min(1, dt * (me ? 6 : 1)));
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
  const fov = 42 + 18 * cam.gaze;
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
    p.viewDim = 0.38 + 0.62 * THREE.MathUtils.smoothstep(d, 2.5, 9);
    if (p.state === 'lit' && d < nearLit) nearLit = d;
    p.update(t, dt, now);
  }
  const bloomTarget = 0.22 + 0.2 * THREE.MathUtils.smoothstep(nearLit, 2.5, 9);
  bloom.strength += (bloomTarget - bloom.strength) * Math.min(1, dt * 3);
  // 가까운 모닥불에 실제 조명 배정
  const lit = pitList.filter((p) => p.intensity > 0.02)
    .map((p) => ({ p, d: p.pos.distanceToSquared(focus) }))
    .sort((a, b) => a.d - b.d);
  firePool.forEach((L, i) => {
    const e = lit[i];
    if (!e) { L.intensity = 0; return; }
    L.position.set(e.p.pos.x, 1.1 * e.p.height, e.p.pos.z);
    L.color.copy(e.p.tip).lerp(FIRE_COLOR, 0.35);
    L.intensity = 14 * e.p.intensity * e.p.flicker;
  });
  // 연기 & 소리
  let level = 0;
  for (const { p, d } of lit) {
    if (d < 45 * 45 && Math.random() < dt * 2.2 * p.intensity) effects.smoke(p.pos, p.intensity);
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
    if (d > RANGE.npc + 2.5 && UI.dialogOpen()) UI.dialogClose();
    const can = state.inv.powders.length < CFG.BASE_POWDERS || !!state.inv.quest?.done || (state.inv.quest && !state.inv.quest.met);
    npc.markEl.style.display = can ? '' : 'none';
    // 보리도 가까이 오면 나를 본다. 멀어지면 창고 창을 닫는다
    const dk = Math.hypot(me.x - KEEPER.x, me.z - KEEPER.z);
    const tk = dk < 8 ? Math.atan2(me.x - KEEPER.x, me.z - KEEPER.z) : KEEPER.ry;
    keeper.root.rotation.y = lerpAngle(keeper.root.rotation.y, tk, Math.min(1, dt * 4));
    if (dk < 6 && !keeper._greeted) { keeper._greeted = true; keeper.play('wave'); }
    if (dk > 10) keeper._greeted = false;
    if (dk > RANGE.keeper + 2.5 && storeIsOpen()) closeStore();
    keeper.markEl.textContent = '📦';
    keeper.markEl.style.display = state.inv.wood >= CFG.MAX_WOOD && state.inv.stored < CFG.MAX_STORED ? '' : 'none';
  }
  npc.update(dt);
  keeper.update(dt);
}

function questText() {
  const inv = state.inv;
  const W = CFG.WOOD_PER_FIRE;
  if (state.sitting) {
    const pit = pits.get(state.sitting.pit);
    if (pit.state === 'lit') return inv.powders.length ? '<b>불멍 중…</b> 숫자키로 마법 가루를 뿌려 보세요 ✨' : '<b>불멍 중…</b> 타닥타닥 🔥';
    return pit.state === 'stacked' ? '쌓인 장작에 <b>불을 붙이면</b> 따뜻해져요 🔥 (일어나서 E)' : `<b>쉬는 중…</b> 장작 ${W}개를 모아 오면 불을 피울 수 있어요 🪵`;
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
  return `<div class="q-dir">🧭 ${t.label}까지 <b>${name}쪽 ${Math.round(d)}m</b> · 미니맵을 참고해요</div>`;
}

function updateHud() {
  if (!me) return;
  // 모바일: 앉아 있을 때는 UI를 화면 가장자리로 옮겨 모닥불이 잘 보이게 (CSS body.seated)
  const seated = !!state.sitting;
  if (document.body.classList.contains('seated') !== seated) document.body.classList.toggle('seated', seated);
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
  const target = pickTarget({ me, inv: state.inv, sitting: state.sitting, pitList, myId: state.myId, CFG });
  state.target = target;
  UI.setQuest(questText() + lumiQuestLine() + directionText(target));
  const pit = it?.pit;
  if (pit && pit.state === 'lit') {
    const rem = Math.ceil(pit.remaining(serverNow()) / 1000);
    UI.setFireTimer(`🔥 남은 장작 ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`);
  } else UI.setFireTimer(null);
  const mp = myMusicPit();
  let mb = null;
  if (mp && mp.state === 'lit') {
    if (!mp.music) mb = { text: isTouch ? '💿 곡 고르기' : '💿 곡 고르기 <kbd>M</kbd>', on: true };
    else if (mp.music.by === state.myId) mb = { text: '🎸 연주 중 · 일어나면 멈춰요', on: false };
    else mb = { text: '🎵 지금 곡이 끝나면 다른 곡을 틀 수 있어요', on: false };
  }
  const mbKey = mb ? mb.text + mb.on : '';
  if (state._mb !== mbKey) {
    state._mb = mbKey;
    const b = $('musicBtn');
    b.classList.toggle('hidden', !mb);
    if (mb) { b.innerHTML = mb.text; b.classList.toggle('off', !mb.on); }
  }
  if (!mp && !$('musicModal').classList.contains('hidden')) closeMusicModal();
  const canThrow = !!state.sitting && pits.get(state.sitting.pit)?.state === 'lit';
  if (canThrow !== state._canThrow) { state._canThrow = canThrow; UI.setPowderEnabled(canThrow); }
}

function updateLabels() {
  const all = [npc, ...[...remotes.values()].map((r) => r.ch), ...(me ? [me.char] : [])];
  for (const ch of all) {
    const d = camera.position.distanceTo(ch.root.position);
    const vis = d < 48;
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

// ---------------------------------------------------------------- 불멍 몰입: 앉아서 가만히 있으면 UI를 흐리게
// 5초 동안 조작이 없으면 화면 UI가 천천히 사라지고, 화면을 만지거나 키를 누르면 바로 돌아온다.
// 흐린 상태에서 처음 누른 버튼은 UI만 깨운다 (실수로 일어나거나 가루를 뿌리지 않게)
const CALM_AFTER = 5000;
let swallowClick = false;
function updateCalm(now) {
  const busy = UI.dialogOpen() || document.querySelector('.overlay:not(.hidden)') || !$('bagPanel').classList.contains('hidden')
    || document.body.classList.contains('chat-open') || document.activeElement === chatInput || touch?.active || cam.dragging;
  const calm = !!state.sitting && !busy && now - lastInputAt > CALM_AFTER;
  if (calm !== document.body.classList.contains('calm')) document.body.classList.toggle('calm', calm);
}
addEventListener('pointerdown', (e) => {
  if (!document.body.classList.contains('calm')) return;
  document.body.classList.remove('calm');
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
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  shared.uTime.value = t;

  updateLocal(dt);
  me?.char.update(dt);
  updateRemotes(dt);
  updateNpc(dt);
  updateCamera(dt, t);
  updateOccluders();
  world.update(t, dt, camera, focus, shared);
  updateStargaze(t, dt);
  updateFires(t, dt);
  updateMusicFx(dt);
  updateStumps(dt);
  gbStand.update(dt, me);
  board.update(dt, me);
  lampPool.update(dt, focus, lightSpots);
  effects.update(dt);
  glowFx.update(dt);
  softFx.update(dt);
  updateHud();
  updateCalm(now);
  updateLabels();
  guide.update(dt, {
    me, target: state.target, pits: pitList, camYaw: cam.yaw,
    remotes: [...remotes.values()].map((r) => r.ch.root.position),
  });

  composer.render();
  labelRenderer.render(scene, camera);
}
requestAnimationFrame(frame);

// 디버그용
window.__game = { scene, pits, state, effects, camera, net, cam, preview, monitors, THREE, renderer, get me() { return me; } };
