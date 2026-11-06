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
import { initPWA } from './pwa.js';
import { CFG, PITS, STUMPS, NPC, BOUNDS, RANGE, LOOKS } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

// 간판 글꼴이 준비된 뒤 월드를 만든다
await Promise.race([document.fonts.load('64px Jua'), new Promise((r) => setTimeout(r, 2500))]);

// ---------------------------------------------------------------- 렌더러
if (isTouch) document.body.classList.add('touch');
const MAX_PR = isTouch ? 1.5 : 2;
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PR));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
composer.addPass(new OutputPass());

const shared = { uTime: { value: 0 }, uScale: { value: 600 } };
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(Math.min(devicePixelRatio, MAX_PR));
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
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

const colliders = [...world.colliders, ...PITS.map((p) => ({ x: p.x, z: p.z, r: 0.95 }))];

const firePool = [];
for (let i = 0; i < 5; i++) {
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
  net.send({ t: 'join', name, look, pid: devicePid(), save: store.get('save', null) });
}
$('joinBtn').onclick = doJoin;
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

$('helpBtn').onclick = () => $('help').classList.remove('hidden');
initPWA();
$('mapToggle').onclick = () => document.body.classList.toggle('map-open');
$('status').addEventListener('click', () => { if (isTouch) document.body.classList.toggle('quest-open'); });
$('helpClose').onclick = () => $('help').classList.add('hidden');
$('soundBtn').onclick = (e) => {
  sound.init();
  e.currentTarget.textContent = sound.toggle() ? '🔇' : '🔊';
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
});
net.on('close', () => $('disconnected').classList.remove('hidden'));
net.on('replaced', () => {
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
  refreshInventory();
  if (m.gained && me) {
    const s = state.lastStump;
    if (s) effects.split(new THREE.Vector3(s.x, 0.7, s.z));
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
  me.char.setAnim('sit');
  refreshInventory();
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
        bounceLog(m.stump);
      },
    });
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

function addRemote(p) {
  if (p.id === state.myId || remotes.has(p.id)) return;
  const ch = new Character(p.look, { name: p.name });
  ch.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
  ch.root.rotation.y = p.ry;
  scene.add(ch.root);
  remotes.set(p.id, { ch, tx: p.x, tz: p.z, try: p.ry, anim: p.anim, name: p.name });
}
function updateOnline() { UI.setOnline(remotes.size + (me ? 1 : 0)); }

// ---------------------------------------------------------------- 도우미
const tmpV = new THREE.Vector3();
function volAt(pos) {
  const d = camera.position.distanceTo(pos);
  return Math.max(0, Math.min(1, 1 - (d - 8) / 40));
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
const logBounce = STUMPS.map(() => 0);
function bounceLog(i) { logBounce[i] = 1; }
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
  if (it.type === 'chop') return ['<kbd>E</kbd> 장작 패기 <small>(꾹 누르기)</small>'];
  if (it.type === 'npc') return ['<kbd>E</kbd> 루미와 이야기하기'];
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
  me.char.play('chop', {
    onImpact: () => {
      effects.chips(new THREE.Vector3(s.x, 0.66, s.z));
      sound.chop(1);
      state.shake = 0.12;
      bounceLog(it.idx);
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
  if (it.type === 'chop') return { icon: '🪓', label: '꾹 패기' };
  if (it.type === 'npc') return { icon: '💬', label: '대화' };
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
if (window.visualViewport) {
  const vv = visualViewport;
  const fitKeyboard = () => {
    const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${kb}px`);
    if (vv.offsetTop > 0 || scrollY > 0) scrollTo(0, 0);
  };
  vv.addEventListener('resize', fitKeyboard);
  vv.addEventListener('scroll', fitKeyboard);
}
const chatInput = $('chatInput');
addEventListener('keydown', (e) => {
  if (!me) return;
  if (document.activeElement === chatInput) {
    if (e.key === 'Enter') {
      if (e.isComposing) return;
      sendChat();
    } else if (e.key === 'Escape') closeChat();
    return;
  }
  if (document.activeElement?.tagName === 'INPUT') return;
  if (UI.dialogOpen()) {
    if (['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); UI.dialogNext(); }
    return;
  }
  if (!$('help').classList.contains('hidden')) {
    if (['Escape', 'Enter', 'Space'].includes(e.code)) $('help').classList.add('hidden');
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
  keys.add(e.code);
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
  cam.pitch = Math.min(1.25, Math.max(0.22, cam.pitch + (e.clientY - lastPY) * 0.004 * k));
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
    else me.char.setAnim('sit');
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
  const cp = cam.curPitch;
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * Math.cos(cp) * cam.curDist,
    cam.target.y + Math.sin(cp) * cam.curDist,
    cam.target.z + Math.cos(cam.yaw) * Math.cos(cp) * cam.curDist,
  );
  if (state.shake > 0) {
    state.shake -= dt;
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
  }
  camera.lookAt(cam.target);
  focus.copy(cam.target).setY(0);
}

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
  return `<div class="q-dir">🧭 ${t.label}까지 <b>${name}쪽 ${Math.round(d)}m</b> · 바닥 화살표를 따라가요</div>`;
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
  world.stumpMeshes.forEach((s, i) => {
    if (logBounce[i] > 0) logBounce[i] = Math.max(0, logBounce[i] - dt * 4);
    const b = logBounce[i];
    s.log.scale.set(1 + b * 0.25, 1 - b * 0.3, 1 + b * 0.25);
    s.log.position.y = 0.51 - b * 0.05;
  });
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  shared.uTime.value = t;

  updateLocal(dt);
  me?.char.update(dt);
  updateRemotes(dt);
  updateNpc(dt);
  updateCamera(dt, t);
  world.update(t, dt, camera, focus, shared);
  updateFires(t, dt);
  updateStumps(dt);
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그용
window.__game = { scene, pits, state, effects, camera, net, cam, get me() { return me; } };
