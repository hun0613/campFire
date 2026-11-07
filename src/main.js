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
import { Music } from './music.js';
import { Monitor } from './monitor.js';
import { Woodcut } from './woodcut.js';
import { GuestbookStand } from './guestbook.js';
import { LightPool } from './lightpool.js';
import { CFG, PITS, STUMPS, NPC, BOUNDS, RANGE, LOOKS, GUESTBOOK } from '../shared/config.js';

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
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.38, 0.85);
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
const lightSpots = [...world.lightSpots, gbStand.lightSpot];
const lampPool = new LightPool(scene, isTouch ? 2 : 3);
const colliders = [
  ...world.colliders,
  { x: GUESTBOOK.x, z: GUESTBOOK.z, r: 1.35 },
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

// ---------------------------------------------------------------- 상태
const state = {
  myId: null,
  inv: { wood: 0, chops: 0, powders: [], canPowder: true },
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
const cam = { yaw: 0, pitch: 0.78, dist: 15, curDist: 34, target: new THREE.Vector3(0, 0, 0), dragging: false };

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
initPWA();
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
  if (r && (r.wood || r.powders)) {
    UI.addChat('', `🎒 가지고 있던 장작 ${r.wood}개${r.powders ? `, 가루 ${r.powders}개` : ''}를 그대로 챙겨 왔어요!`, true);
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
  state.inv = { wood: m.wood, chops: m.chops, powders: m.powders, canPowder: m.canPowder };
  if (m.gained && me && state.lastStumpIdx != null) splitLog(state.lastStumpIdx, me.char);
  me?.char.setCarry(m.wood);
  refreshInventory();
  if (m.gained && me) {
    floatText('+1 🪵', me.char.root.position.clone().setY(2.3));
    sound.wood();
    if (m.wood === CFG.WOOD_PER_FIRE && m.canPowder) UI.toast('장작 5개 완성! 서쪽 루미에게 가 보세요 ✨');
  }
  if (prev.powders.length < m.powders.length) sound.gift();
});

net.on('npc', (m) => {
  let pages;
  const W = CFG.WOOD_PER_FIRE;
  if (m.kind === 'give') {
    pages = [
      `우와, 장작을 ${m.wood}개나 모아왔구나!\n정말 수고했어 🪵`,
      `자, 이건 내가 직접 만든 <b>마법 가루</b>야.\n${m.powders.map((p) => UI.powderChip(p)).join('')}`,
      `<b>공터</b>나 <b>글램핑장 앞 화로</b>에 장작을 쌓고 불을 붙여 봐.\n불 앞에 앉아서 가루를 뿌리면… 후후, 깜짝 놀랄걸? ✨`,
    ];
    npc.play('wave');
  } else if (m.kind === 'need') {
    pages = [
      '안녕! 나는 가루 공방의 루미야 ✨',
      `동쪽 <b>장작 패는 곳</b>에서 장작을 ${W}개 모아 오면\n모닥불 색을 바꾸는 신기한 마법 가루를 줄게!`,
      `지금 장작은 ${m.wood}개구나. 조금만 더 힘내! 💪`,
    ];
  } else if (m.kind === 'used') {
    pages = ['가루는 벌써 줬잖아~ 😊', '얼른 화로에 장작을 쌓고 불을 붙여 봐.\n그리고 장작을 다시 모아 오면 또 줄게!'];
  } else {
    pages = ['어머, 가방이 가루로 꽉 찼네!', '먼저 모닥불에 좀 뿌리고 오렴 🔥'];
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
  state.sitting = { pit: m.pit, idx: m.idx };
  me.x = m.x; me.z = m.z; me.ry = m.ry;
  // 앉으면 모닥불과 옆 TV·LP가 함께 보이도록 카메라를 TV 반대편에서 비스듬히 바라보게
  const mon = monitors.get(m.pit);
  const pd = PITS.find((d) => d.id === m.pit);
  if (mon && pd) cam.yaw = Math.atan2(-(mon.pos.x - pd.x), -(mon.pos.z - pd.z)) + 0.45;
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
net.on('musicOk', () => { closeMusicModal(); $('musicQ').value = ''; music$.busy = false; });
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
}

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
  const dg = Math.hypot(me.x - GUESTBOOK.x, me.z - GUESTBOOK.z);
  if (dg < RANGE.guestbook && dg < bestD) { best = { type: 'guestbook' }; bestD = dg; }
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
  if (it.type === 'guestbook') return ['<kbd>E</kbd> 방명록 펼쳐 보기 📖'];
  if (it.type === 'pit') {
    const p = it.pit;
    if (p.state === 'empty') {
      return inv.wood >= W ? [`<kbd>E</kbd> 장작 쌓기 <small>(🪵 ${W}개 사용)</small>`] : [`장작 ${W}개가 있으면 불을 피울 수 있어요 (🪵 ${inv.wood}/${W})`, true];
    }
    if (p.state === 'stacked') return ['<kbd>E</kbd> 불 붙이기 🔥'];
    if (p.state === 'lit') return p.freeSeats() > 0 ? ['<kbd>E</kbd> 앉아서 불멍하기 🔥'] : ['자리가 꽉 찼어요', true];
  }
  if (it.type === 'seated') {
    const p = it.pit;
    if (p.state !== 'lit') return ['불이 꺼졌어요 · <kbd>E</kbd> 일어나기'];
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
  } else if (it.type === 'guestbook') {
    faceTo(GUESTBOOK.x, GUESTBOOK.z);
    openGuestbook();
  } else if (it.type === 'pit') {
    const p = it.pit;
    faceTo(p.pos.x, p.pos.z);
    if (p.state === 'empty' && state.inv.wood >= CFG.WOOD_PER_FIRE) net.send({ t: 'build', pit: p.id });
    else if (p.state === 'stacked') {
      me.char.play('light', { onImpact: () => {} });
      net.send({ t: 'light', pit: p.id });
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
  if (state.inv.wood >= CFG.MAX_WOOD) { UI.toast('장작을 더 들 수 없어요! 모닥불에 써 보세요 🔥'); return; }
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
  state.sitting = null;
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
  if (!pit || pit.state !== 'lit') { UI.toast('불이 꺼져 있어요'); return; }
  if (!state.inv.powders[i]) return;
  if (me.char.busy()) return;
  net.send({ t: 'throw', idx: i });
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
  if (it.type === 'guestbook') return { icon: '📖', label: '방명록' };
  if (it.type === 'seated') return { icon: '🚶', label: '일어나기' };
  if (it.type === 'pit') {
    const p = it.pit;
    if (p.state === 'empty' && state.inv.wood >= CFG.WOOD_PER_FIRE) return { icon: '🪵', label: '장작 쌓기' };
    if (p.state === 'stacked') return { icon: '🔥', label: '불 붙이기' };
    if (p.state === 'lit' && p.freeSeats() > 0) return { icon: '🪑', label: '앉기' };
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
  if (!$('help').classList.contains('hidden')) {
    if (['Escape', 'Enter', 'Space'].includes(e.code)) $('help').classList.add('hidden');
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
  keys.add(e.code);
  if (e.code === 'KeyM' && !e.repeat && state.sitting) { e.preventDefault(); openMusicModal(); return; }
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
  cam.pitch = Math.min(1.25, Math.max(PITCH_MIN, cam.pitch + (e.clientY - lastPY) * 0.004 * k));
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
  if (!blocked && touch?.active && touch.mag > 0) {
    ix = touch.x; iz = touch.y;
    run = touch.mag > 0.92;
  }
  const moving = ix !== 0 || iz !== 0;

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
function updateCamera(dt, t) {
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

// 별 보기: 하늘을 올려다보면 화면 UI가 옅어지고, 별똥별이 떨어지면 알려 준다
let gazing = false, lastWish = -1e9, stargazeHinted = false;
function updateStargaze(t, dt) {
  const shot = world.sky.update(t, dt, camera, cam.gaze || 0);
  const on = (cam.gaze || 0) > 0.45;
  if (on !== gazing) { gazing = on; document.body.classList.toggle('stargaze', on); }
  if (shot && t - lastWish > 40) {
    lastWish = t;
    UI.toast(WISHES[Math.floor(Math.random() * WISHES.length)], 3500);
  }
}
const WISHES = ['🌠 별똥별이에요! 얼른 소원을 빌어 봐요', '🌠 방금 별똥별 봤어요?', '🌠 별이 떨어졌어요… 소원 하나 ✨'];

const FIRE_COLOR = new THREE.Color('#ff7a2a');
function updateFires(t, dt) {
  const now = serverNow();
  for (const p of pitList) p.update(t, dt, now);
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
    const can = state.inv.wood >= CFG.WOOD_PER_FIRE && state.inv.canPowder && state.inv.powders.length < CFG.MAX_POWDERS;
    npc.markEl.style.display = can ? '' : 'none';
  }
  npc.update(dt);
}

function questText() {
  const inv = state.inv;
  const W = CFG.WOOD_PER_FIRE;
  if (state.sitting) {
    const pit = pits.get(state.sitting.pit);
    if (pit.state === 'lit') return inv.powders.length ? '<b>불멍 중…</b> 숫자키로 마법 가루를 뿌려 보세요 ✨' : '<b>불멍 중…</b> 타닥타닥 🔥';
    return '불이 꺼졌어요. 다시 <b>장작</b>을 패러 가볼까요? 🪓';
  }
  if (pitList.some((p) => p.owner === state.myId && p.state === 'stacked')) return '쌓아둔 장작에 <b>불을 붙여요</b> 🔥';
  if (inv.wood >= W && inv.canPowder && inv.powders.length < CFG.MAX_POWDERS) return '서쪽 <b>루미</b>에게 가서 마법 가루를 받아요 ✨';
  if (inv.wood >= W) return '<b>공터</b>나 <b>글램핑장 앞 화로</b>에 장작을 쌓아요';
  if (inv.powders.length && pitList.some((p) => p.state === 'lit')) return '타오르는 <b>모닥불</b>에 앉아 가루를 뿌려 봐요 🔥';
  return `동쪽 <b>통나무</b>에서 장작을 패요 (${inv.wood}/${W})`;
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
  UI.setQuest(questText() + directionText(target));
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
  world.update(t, dt, camera, focus, shared);
  updateStargaze(t, dt);
  updateFires(t, dt);
  updateMusicFx(dt);
  updateStumps(dt);
  gbStand.update(dt, me);
  lampPool.update(dt, focus, lightSpots);
  effects.update(dt);
  glowFx.update(dt);
  softFx.update(dt);
  updateHud();
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
