import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  CFG, FIRES, seatsOf, STUMPS, NPC, KEEPER, QUESTS, LEGEND_POWDERS, legendPowder, BOUNDS, SPAWN, RANGE, LOOKS, seatPos, randomPowder,
  TENTS, tentAt, tentLocal, kstDay, EGG,
} from '../shared/config.js';
import * as guestbook from './guestbook.js';
import { handleAdmin, adminOn } from './admin.js';
import * as board from './board.js';
import { search, searchesLeft, nextReset, videoInfo, known, addRecent, recentList, hasKey, quotaState, restoreQuota } from './youtube.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------- HTTP
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
    }
  }
  // 와이파이/이더넷(en*) 우선
  out.sort((a, b) => (b.name.startsWith('en') ? 1 : 0) - (a.name.startsWith('en') ? 1 : 0));
  return out.map((a) => `http://${a.address}:${PORT}`);
}

const server = http.createServer();
// 같은 네트워크 접속 주소 안내용
server.on('request', (req, res) => {
  if (req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // 클라우드(Render 등)에서는 내부 IP 대신 공개 주소를 알려준다
    const urls = PUBLIC_URL ? [PUBLIC_URL] : lanAddresses();
    res.end(JSON.stringify({ urls, public: !!PUBLIC_URL, players: players.size }));
  }
});
// 관리자 페이지: /admin → admin.html, /api/admin/* → 관리자 API
server.on('request', (req, res) => {
  if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin.html';
  if (req.url?.startsWith('/api/admin/')) handleAdmin(req, res, () => ({ players: players.size }), { onBoardChange: () => broadcast({ t: 'boardUpdate' }) });
});
const passThrough = (handler) => (req, res) => {
  if (req.url !== '/api/info' && !req.url?.startsWith('/api/admin/')) handler(req, res);
};

if (!isProd) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  server.on('request', passThrough(vite.middlewares));
} else {
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4',
  };
  server.on('request', passThrough((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.normalize(path.join(DIST, urlPath));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }));
}

// ---------------------------------------------------------------- 게임 상태
const sockets = new Set();
const players = new Map(); // id -> player
let nextId = 1;

// 바깥 화로 12곳 + 텐트 벽난로 12곳 (벽난로는 텐트 안에 있어야 쓸 수 있다)
const pits = new Map(FIRES.map((p) => [p.id, {
  id: p.id, state: 'empty', owner: null, litAt: 0, endsAt: 0, music: null,
  seats: Array(seatsOf(p)).fill(null),
}]));
const pitDef = new Map(FIRES.map((p) => [p.id, p]));
/** 이 자리를 쓸 수 있는 곳에 있나 (거리 + 벽난로면 그 텐트 안) */
const nearFire = (me, def, extra) => dist(me, def.x, def.z) <= RANGE.pit + extra && (def.kind !== 'stove' || me.tent === def.tent);
// 글램핑 텐트 블루투스 스피커: 텐트마다 음악 한 곡 (텐트 안에 있는 사람만 듣는다). 음악 코드는 모닥불과 같이 쓴다 (room.music)
const tentRooms = new Map(TENTS.map((t) => [t.id, { id: t.id, tent: true, music: null }]));
const roomOf = (id) => pits.get(id) || tentRooms.get(id);
/** 방(모닥불 · 텐트)의 상태를 모두에게 알린다 */
function syncRoom(room) {
  if (room.tent) broadcast({ t: 'tentMusic', tent: room.id, music: room.music });
  else broadcast({ t: 'pit', pit: room });
}
const tentMembers = (id) => [...players.values()].filter((q) => q.tent === id && q.ws);

const HEX = /^#[0-9a-f]{6}$/i;
const pickColor = (v, list) => (typeof v === 'string' && HEX.test(v) ? v : list[0]);

// ---------------------------------------------------------------- 저장 (새로고침/재접속해도 장작 유지)
// 1) 서버 메모리: 기기별 pid 로 인벤토리·위치를 기억 → 새로고침, 앱 재실행
// 2) 서명된 백업: 같은 내용을 서버 비밀키로 서명해서 기기에도 저장 → 서버가 재시작(잠듦)돼도 복원.
//    서명이 있어서 기기에서 숫자를 고쳐도 받아주지 않는다.
const SAVE_SECRET = process.env.SAVE_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SAVE_SECRET && isProd) console.warn('⚠️  SAVE_SECRET 이 없어 서버 재시작 후에는 기기 백업을 복원할 수 없어요.');
const SAVE_TTL = 14 * 24 * 3600 * 1000;
const PID = /^[A-Za-z0-9_-]{16,64}$/;
const saves = new Map(); // pid -> { wood, stored, chops, powders, quest, coins, coinDay, shareDay, eggDay, x, z, at }
const pitOwnerKey = new Map(); // pitId -> pid (공개되지 않음)
const sign = (pid, data) => crypto.createHmac('sha256', SAVE_SECRET).update(`${pid}|${data}`).digest('base64url');

function snapshotOf(p) {
  return { wood: p.wood, stored: p.stored, chops: p.chops, powders: p.powders, quest: p.quest, coins: p.coins, coinDay: p.coinDay, shareDay: p.shareDay, eggDay: p.eggDay || '' };
}
// 차단용 공개 표식: 기기 식별값(pid)에서 만든 짧은 값. pid 자체는 드러나지 않고, 다시 접속해도 같은 값이라 차단이 이어진다
const tagOf = (pid) => (pid ? crypto.createHmac('sha256', SAVE_SECRET).update(`tag|${pid}`).digest('base64url').slice(0, 12) : null);

// ---------------------------------------------------------------- 코인
// 매일 00시(한국 시간)에 30개로 다시 맞춘다. 💌 공유 보너스는 하루 한 번
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function refreshCoins(p) {
  const today = kstDay();
  if (p.coinDay === today) return false;
  p.coinDay = today;
  p.coins = CFG.DAILY_COINS;
  return true;
}
function remember(p) {
  if (!p.pid) return;
  saves.set(p.pid, { ...snapshotOf(p), powders: [...p.powders], quest: { ...p.quest }, x: p.x, z: p.z, at: Date.now() });
}
function validSnapshot(s) {
  if (!s || typeof s !== 'object') return null;
  const wood = s.wood | 0, chops = s.chops | 0, stored = s.stored | 0; // stored: 창고 (예전 백업에는 없어서 0)
  if (wood < 0 || wood > CFG.MAX_WOOD || chops < 0 || chops >= CFG.CHOPS_PER_WOOD) return null;
  if (stored < 0 || stored > CFG.MAX_STORED) return null;
  if (!Array.isArray(s.powders) || s.powders.length > CFG.MAX_POWDERS) return null;
  const powders = s.powders.filter((q) => q && HEX.test(q.color) && typeof q.effect === 'string' && typeof q.name === 'string')
    .map((q) => ({ ...q }));
  // 코인: 예전 백업에는 없어서 비워 두면 오늘 몫(30개)을 새로 받는다
  const coins = Math.max(0, Math.min(CFG.MAX_COINS, s.coins | 0));
  const coinDay = typeof s.coinDay === 'string' && DAY.test(s.coinDay) ? s.coinDay : '';
  const shareDay = typeof s.shareDay === 'string' && DAY.test(s.shareDay) ? s.shareDay : '';
  const eggDay = typeof s.eggDay === 'string' && DAY.test(s.eggDay) ? s.eggDay : '';
  return { wood, stored, chops, powders, quest: validQuest(s.quest), coins, coinDay, shareDay, eggDay };
}
// 루미의 부탁 진행 상태: i 몇 번째 부탁, p 진행 수, done 마쳤는지(루미에게 받으러 가기 전), lap 몇 바퀴째, met 루미를 만난 적 있는지
function validQuest(q) {
  const fresh = { i: 0, p: 0, done: false, lap: 0, met: false };
  if (!q || typeof q !== 'object') return fresh;
  const i = q.i | 0;
  if (i < 0 || i >= QUESTS.length) return fresh;
  return { i, p: Math.max(0, Math.min(QUESTS[i].goal, q.p | 0)), done: !!q.done, lap: Math.max(0, q.lap | 0), met: !!q.met };
}
/** 서버 기억 → 없으면 서명된 기기 백업 순서로 복원 */
function restore(pid, backup) {
  const mem = saves.get(pid);
  if (mem && Date.now() - mem.at < SAVE_TTL) return { ...validSnapshot(mem), x: mem.x, z: mem.z, fresh: Date.now() - mem.at < 30 * 60 * 1000 };
  if (backup && typeof backup.data === 'string' && typeof backup.sig === 'string' && backup.data.length < 24000) {
    const expected = sign(pid, backup.data);
    if (expected.length === backup.sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(backup.sig))) {
      try {
        const d = JSON.parse(backup.data);
        if (Date.now() - d.at < SAVE_TTL) return validSnapshot(d);
      } catch { /* 무시 */ }
    }
  }
  return null;
}
// 검색 한도 기록: 서명해서 모든 기기에 맡겨 두고, 서버가 다시 켜지면 들어오는 기기에서 돌려받는다
function quotaMsg() {
  const data = JSON.stringify(quotaState());
  return { t: 'quota', data, sig: sign('quota', data) };
}
function restoreQuotaFrom(backup) {
  if (!backup || typeof backup.data !== 'string' || typeof backup.sig !== 'string' || backup.data.length > 300) return;
  const expected = sign('quota', backup.data);
  if (expected.length !== backup.sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(backup.sig))) return;
  try {
    if (restoreQuota(JSON.parse(backup.data))) {
      console.log(`🔍 기기에 맡겨 둔 검색 기록으로 오늘 사용량을 되찾았어요 (남은 검색 ${searchesLeft()}번)`);
      broadcast(quotaMsg());
    }
  } catch { /* 무시 */ }
}

// 오래된 기억 정리
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of saves) if (now - v.at > SAVE_TTL) saves.delete(k);
}, 3600 * 1000);

function publicPlayer(p) {
  return { id: p.id, name: p.name, look: p.look, x: p.x, z: p.z, ry: p.ry, anim: p.anim, carry: p.wood, tag: p.tag };
}

// ---------------------------------------------------------------- 글램핑 텐트
// 위치로 「텐트 안」을 판정한다. 한 동에 최대 5명. 텐트 안 채팅은 같은 텐트 안 사람에게만 간다
const tentCount = (id) => { let n = 0; for (const q of players.values()) if (q.tent === id) n++; return n; };
function updateTent(p, ws) {
  const t = tentAt(p.x, p.z);
  const id = t?.id || null;
  if (id === p.tent) return;
  const prev = p.tent && tentRooms.get(p.tent);
  if (prev?.music?.by === p.id) { clearMusic(prev, 'left'); syncRoom(prev); } // 스피커로 노래를 튼 사람이 나가면 멈춘다
  if (id && tentCount(id) >= CFG.TENT_CAP) {
    // 꽉 찬 텐트: 문 밖으로 내보낸다 (보통은 기기에서 먼저 막는다)
    const out = tentLocal(t, 0, CFG.TENT_R + 1.1);
    p.x = out.x; p.z = out.z;
    p.tent = null;
    send(ws, { t: 'tentFull', x: p.x, z: p.z, cap: CFG.TENT_CAP });
    return;
  }
  p.tent = id;
  if (id) send(ws, { t: 'tentIn', tent: id, n: tentCount(id) });
}
// 「장작 N개」 부탁: 손에 든 장작 수를 그대로 진행으로 쓴다 (부탁을 받기 전에 모아 둔 장작도 인정)
function syncWoodQuest(p) {
  const q = p.quest;
  if (!q || q.done || !q.met) return;
  const def = QUESTS[q.i];
  if (def.type !== 'wood') return;
  q.p = Math.min(def.goal, p.wood);
  if (q.p >= def.goal) {
    q.done = true;
    if (p.ws) send(p.ws, { t: 'questDone', title: def.title });
  }
}
function inv(p) {
  refreshCoins(p);
  syncWoodQuest(p);
  remember(p);
  // 품에 안은 장작 더미가 다른 사람에게도 보이도록
  if (p._carry !== p.wood) { p._carry = p.wood; broadcast({ t: 'carry', id: p.id, n: p.wood }); }
  const msg = { t: 'inv', ...snapshotOf(p) };
  if (p.pid) {
    const data = JSON.stringify({ ...snapshotOf(p), at: Date.now() });
    msg.save = { data, sig: sign(p.pid, data) };
  }
  return msg;
}
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of sockets) if (ws !== except && ws.readyState === 1) ws.send(data);
}
function dist(p, x, z) {
  return Math.hypot(p.x - x, p.z - z);
}
// ---------------------------------------------------------------- 모닥불 음악 (유튜브)
// 규칙: 불 붙은 모닥불에 앉은 사람만 틀 수 있고, 곡이 끝나기 전에는 아무도 바꿀 수 없다.
//       영상 끝 / 연주자가 일어나거나 나감 / 불 꺼짐 / 재생 불가 영상 이면 멈춘다.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export function parseYouTubeId(input) {
  const s = String(input || '').trim();
  if (YT_ID.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    if (!id && m) id = m[1];
  }
  return id && YT_ID.test(id) ? id : null;
}
/** 유튜브 oEmbed로 제목 확인 + 외부 재생이 막힌 영상 걸러내기 */
async function lookupVideo(id) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { signal: AbortSignal.timeout(4000) });
    if (r.status === 401 || r.status === 403) return { ok: false, why: '이 영상은 업로더가 외부 재생을 막아 뒀어요 😢' };
    if (r.status === 404 || r.status === 400) return { ok: false, why: '영상을 찾을 수 없어요. 링크를 확인해 주세요' };
    if (!r.ok) return { ok: true, title: '' };
    const j = await r.json();
    return { ok: true, title: String(j.title || '').slice(0, 80) };
  } catch {
    return { ok: true, title: '' }; // 유튜브 확인이 안 되면 일단 틀어 본다 (재생 오류는 클라이언트가 알려줌)
  }
}
function clearMusic(pit, reason) {
  if (!pit.music) return;
  const by = players.get(pit.music.by);
  if (by?.anim === 'guitar' && (by.seat?.pit === pit.id || by.tent === pit.id)) by.anim = 'sit';
  pit.music = null;
  broadcast({ t: 'musicStop', pit: pit.id, reason });
}

function leaveSeat(p) {
  if (!p.seat) return;
  const pit = pits.get(p.seat.pit);
  if (pit?.music?.by === p.id) clearMusic(pit, 'left');
  if (pit && pit.seats[p.seat.idx] === p.id) pit.seats[p.seat.idx] = null;
  p.seat = null;
  p.anim = 'idle';
  if (pit) broadcast({ t: 'pit', pit });
}

// ---------------------------------------------------------------- 루미의 부탁 진행
/** 지금 부탁이 type 행동이면 n 만큼 진행. 다 채우면 「루미에게 가 보세요」 */
function bump(p, type, n = 1) {
  const q = p.quest;
  if (!q || q.done || !q.met) return; // 루미에게 부탁을 듣기 전에는 세지 않는다
  const def = QUESTS[q.i];
  if (def.type !== type) return;
  q.p = Math.min(def.goal, q.p + n);
  if (q.p >= def.goal) {
    q.done = true;
    if (p.ws) send(p.ws, { t: 'questDone', title: def.title });
  }
  if (p.ws) send(p.ws, inv(p));
}
// 앉아 있는 시간: 불 붙은 모닥불에 앉아 있으면 5초마다 5초씩
setInterval(() => {
  for (const p of players.values()) {
    if (!p.seat) continue;
    const pit = pits.get(p.seat.pit);
    if (pit?.state === 'lit') bump(p, 'sitSec', 5);
  }
}, 5000);

function handle(ws, ctx, m) {
  if (!m || typeof m.t !== 'string') return;
  const now = Date.now();
  if (m.t === 'ping') { send(ws, { t: 'pong' }); return; } // 화면을 다시 켰을 때 연결 확인용

  if (m.t === 'join') {
    if (ctx.me) return;
    const name = String(m.name || '').trim().slice(0, 12) || `캠퍼${nextId}`;
    const L = m.look || {};
    const look = {
      skin: pickColor(L.skin, LOOKS.skin),
      hair: pickColor(L.hair, LOOKS.hair),
      shirt: pickColor(L.shirt, LOOKS.shirt),
      pants: pickColor(L.pants, LOOKS.pants),
      hat: LOOKS.hat.some((h) => h.id === L.hat) ? L.hat : 'none',
    };
    const pid = typeof m.pid === 'string' && PID.test(m.pid) ? m.pid : null;
    // 같은 기기로 다시 들어오면(다른 탭 등) 예전 접속은 정리한다
    if (pid) {
      for (const [otherWs, otherCtx] of ctxs) {
        if (otherCtx.me?.pid === pid && otherWs !== ws) {
          remember(otherCtx.me);
          otherCtx.replaced = true;
          send(otherWs, { t: 'replaced' });
          otherWs.close();
        }
      }
    }
    const saved = pid ? restore(pid, m.save) : null;
    restoreQuotaFrom(m.quota);
    const p = {
      id: nextId++, pid, name, look,
      x: SPAWN.x + (Math.random() - 0.5) * 6, z: SPAWN.z + (Math.random() - 0.5) * 2, ry: Math.PI,
      anim: 'idle', seat: null,
      wood: saved?.wood ?? 0, stored: saved?.stored ?? 0, chops: saved?.chops ?? 0, powders: saved?.powders ?? [], quest: saved?.quest ?? validQuest(null),
      coins: saved?.coins ?? 0, coinDay: saved?.coinDay ?? '', shareDay: saved?.shareDay ?? '', eggDay: saved?.eggDay ?? '',
      tag: tagOf(pid), tent: null,
      lastChop: 0, lastChat: 0,
    };
    refreshCoins(p);
    // 방금 전까지 있던 자리로 (새로고침)
    if (saved?.fresh && Number.isFinite(saved.x)) {
      p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, saved.x));
      p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, saved.z));
    }
    if (tentAt(p.x, p.z)) { p.x = SPAWN.x; p.z = SPAWN.z; } // 다시 들어올 때 텐트 안이면 광장에서 (인원 확인을 건너뛰지 않게)
    ctx.me = p;
    p.ws = ws; // 퀘스트 진행을 이 사람에게 바로 알려 주려고 (저장 · 공개되지 않음)
    players.set(p.id, p);
    // 내가 쌓아둔 장작더미는 다시 내 것으로
    if (pid) {
      for (const [pitId, key] of pitOwnerKey) {
        const pit = pits.get(pitId);
        if (key === pid && pit.state !== 'empty') { pit.owner = p.id; broadcast({ t: 'pit', pit }); }
      }
    }
    send(ws, { t: 'welcome', id: p.id, me: publicPlayer(p), restored: saved ? { wood: p.wood, stored: p.stored, powders: p.powders.length } : null });
    send(ws, inv(p));
    send(ws, quotaMsg());
    broadcast({ t: 'join', player: publicPlayer(p) }, ws);
    broadcast({ t: 'sys', text: `${p.name}님이 캠핑장에 도착했어요 🏕️` });
    return;
  }

  const me = ctx.me;
  if (!me) return;

  switch (m.t) {
    case 'move': {
      if (me.seat) return;
      const x = Number(m.x), z = Number(m.z), ry = Number(m.ry);
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(ry)) return;
      me.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, x));
      me.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, z));
      me.ry = ry;
      me.anim = ['idle', 'walk', 'run'].includes(m.anim) ? m.anim : 'idle';
      updateTent(me, ws);
      if ((m.anim === 'sit' || m.anim === 'guitar') && me.tent) { // 텐트 안 의자에 앉기 (보여 주기만). 스피커로 노래를 틀었으면 기타
        me.anim = m.anim === 'guitar' && tentRooms.get(me.tent)?.music?.by === me.id ? 'guitar' : 'sit';
      }
      break;
    }
    case 'chop': {
      const stump = STUMPS[m.stump | 0];
      if (!stump || dist(me, stump.x, stump.z) > RANGE.stump + 1.5) return;
      if (now - me.lastChop < CFG.CHOP_COOLDOWN) return;
      me.lastChop = now;
      if (me.wood >= CFG.MAX_WOOD) {
        broadcast({ t: 'act', id: me.id, a: 'chop', stump: m.stump | 0 }, ws);
        send(ws, { t: 'toast', text: '장작을 더 들 수 없어요! 창고지기 보리에게 맡겨 보세요 📦' });
        return;
      }
      me.chops += 1;
      let gained = 0;
      if (me.chops >= CFG.CHOPS_PER_WOOD) {
        me.chops = 0;
        me.wood += 1;
        gained = 1;
      }
      // split: 이번 도끼질로 통나무가 갈라졌는지 (다른 사람 화면에서도 쪼개지는 연출)
      broadcast({ t: 'act', id: me.id, a: 'chop', stump: m.stump | 0, split: !!gained }, ws);
      send(ws, { ...inv(me), gained });
      break;
    }
    case 'place': { // 그루터기에 새 통나무 올리기 (연출만 공유)
      const stump = STUMPS[m.stump | 0];
      if (!stump || dist(me, stump.x, stump.z) > RANGE.stump + 1.5) return;
      broadcast({ t: 'act', id: me.id, a: 'place', stump: m.stump | 0 }, ws);
      break;
    }
    case 'npc': {
      if (dist(me, NPC.x, NPC.z) > RANGE.npc + 1.5) return;
      const q = me.quest;
      const first = !q.met;
      q.met = true;
      // 1) 마친 부탁이 있으면 ✦ 특별한 가루 (가방에 자리가 있어야)
      let reward = null, rewardBlocked = false, finished = null;
      if (q.done) {
        if (me.powders.length < CFG.MAX_POWDERS) {
          finished = QUESTS[q.i];
          reward = legendPowder(finished.reward);
          me.powders.push(reward);
          q.i = (q.i + 1) % QUESTS.length;
          if (q.i === 0) q.lap += 1;
          q.p = 0;
          q.done = false;
        } else rewardBlocked = true;
      }
      // 2) 기본 가루: 가방에 3개보다 적으면 3개까지 (장작은 필요 없다)
      const basic = [];
      while (me.powders.length < CFG.BASE_POWDERS) { const pw = randomPowder(); basic.push(pw); me.powders.push(pw); }
      syncWoodQuest(me); // 새로 받은 부탁이 「장작 N개」면 지금 든 장작부터 바로 반영
      const cur = QUESTS[q.i];
      send(ws, {
        t: 'npc', first, basic, reward, rewardBlocked, finished: finished && { title: finished.title },
        quest: { ...q, title: cur.title, desc: cur.desc, goal: cur.goal, type: cur.type, reward: cur.reward, rewardName: LEGEND_POWDERS[cur.reward].name },
        full: me.powders.length >= CFG.MAX_POWDERS,
      });
      send(ws, inv(me));
      if (finished) broadcast({ t: 'sys', text: `✨ ${me.name}님이 루미의 부탁 「${finished.title}」을(를) 들어주고 ${reward.name}를 받았어요` });
      break;
    }
    case 'quest': { // 서버가 직접 볼 수 없는 행동 (하늘 보기, 링크 공유)은 기기가 알려 준다
      if (!['stargaze', 'share'].includes(m.ev) || now - (me.lastQuestEv || 0) < 2000) return;
      me.lastQuestEv = now;
      bump(me, m.ev);
      // 💌 공유 보너스: 하루 한 번 +10 코인
      if (m.ev === 'share') {
        refreshCoins(me);
        const today = kstDay();
        if (me.shareDay !== today) {
          me.shareDay = today;
          me.coins = Math.min(CFG.MAX_COINS, me.coins + CFG.SHARE_BONUS);
          send(ws, { t: 'coinBonus', n: CFG.SHARE_BONUS });
        } else send(ws, { t: 'coinBonus', n: 0 });
        send(ws, inv(me));
      }
      break;
    }
    case 'egg': { // 숨겨진 가루병 (이스터에그): 기기마다 하루 한 번 ✦ 특별한 가루 하나
      if (dist(me, EGG.x, EGG.z) > EGG.range + 1) return;
      const today = kstDay();
      if (me.eggDay === today) { send(ws, { t: 'toast', text: '오늘은 이미 찾았어요. 내일 밤 다시 와 봐요 ✨' }); return; }
      if (me.powders.length >= CFG.MAX_POWDERS) { send(ws, { t: 'toast', text: '가방이 가루로 꽉 찼어요. 모닥불에 좀 뿌리고 와요' }); return; }
      const keys = Object.keys(LEGEND_POWDERS);
      const powder = legendPowder(keys[Math.floor(Math.random() * keys.length)]);
      me.eggDay = today;
      me.powders.push(powder);
      send(ws, { t: 'eggFound', powder });
      send(ws, inv(me));
      break;
    }
    case 'buy': { // 루미 상점: ✦ 특별한 가루를 코인으로
      if (dist(me, NPC.x, NPC.z) > RANGE.npc + 2.5) return;
      if (!LEGEND_POWDERS[m.effect] || now - (me.lastBuy || 0) < 300) return;
      me.lastBuy = now;
      refreshCoins(me);
      if (me.coins < CFG.LEGEND_PRICE) { send(ws, { t: 'buyFail', reason: 'coins' }); return; }
      if (me.powders.length >= CFG.MAX_POWDERS) { send(ws, { t: 'buyFail', reason: 'full' }); return; }
      me.coins -= CFG.LEGEND_PRICE;
      const powder = legendPowder(m.effect);
      me.powders.push(powder);
      send(ws, { t: 'bought', powder });
      send(ws, inv(me));
      break;
    }
    case 'store': { // 장작 창고: op 'put' 맡기기 / 'take' 찾기
      if (dist(me, KEEPER.x, KEEPER.z) > RANGE.keeper + 1.5) return;
      const want = Math.max(1, Math.min(CFG.MAX_STORED, m.n | 0));
      let n = 0, reason = '';
      if (m.op === 'put') {
        n = Math.min(want, me.wood, CFG.MAX_STORED - me.stored);
        if (n > 0) { me.wood -= n; me.stored += n; bump(me, 'store', n); } else reason = me.wood ? 'storeFull' : 'noWood';
      } else if (m.op === 'take') {
        n = Math.min(want, me.stored, CFG.MAX_WOOD - me.wood);
        if (n > 0) { me.stored -= n; me.wood += n; } else reason = me.stored ? 'handsFull' : 'empty';
      } else return;
      send(ws, { t: 'stored', op: m.op, n, reason });
      send(ws, inv(me));
      break;
    }
    case 'build': {
      const pit = pits.get(m.pit);
      const def = pitDef.get(m.pit);
      if (!pit || !nearFire(me, def, 1.5)) return;
      if (pit.state !== 'empty') return;
      if (me.wood < CFG.WOOD_PER_FIRE) {
        send(ws, { t: 'toast', text: `장작이 ${CFG.WOOD_PER_FIRE}개 필요해요` });
        return;
      }
      me.wood -= CFG.WOOD_PER_FIRE;
      pit.state = 'stacked';
      pit.owner = me.id;
      if (me.pid) pitOwnerKey.set(pit.id, me.pid);
      broadcast({ t: 'pit', pit });
      send(ws, inv(me));
      break;
    }
    case 'light': {
      const pit = pits.get(m.pit);
      const def = pitDef.get(m.pit);
      if (!pit || !nearFire(me, def, 1.5)) return;
      if (pit.state !== 'stacked') return;
      pit.state = 'lit';
      pit.litAt = now;
      pit.endsAt = now + CFG.FIRE_DURATION;
      broadcast({ t: 'pit', pit });
      broadcast({ t: 'act', id: me.id, a: 'light', pit: pit.id }, ws);
      bump(me, 'light');
      break;
    }
    case 'feed': { // 타는 불에 장작 1개 더 넣기: 2분 연장 (남은 시간은 30분까지)
      const pit = pits.get(m.pit);
      const def = pitDef.get(m.pit);
      if (!pit || !nearFire(me, def, 2)) return;
      if (pit.state !== 'lit') return;
      if (me.wood < 1) { send(ws, { t: 'toast', text: '넣을 장작이 없어요 🪵 (장작 패는 곳 · 창고에서 가져와요)' }); return; }
      // 언제든 장작 1개 = 2분 (10분 → 12분 → 14분…). 남은 시간은 30분까지
      if (pit.endsAt - now + CFG.FEED_MS > CFG.FIRE_MAX) { send(ws, { t: 'toast', text: `불이 이미 넉넉하게 타고 있어요 🔥 (남은 시간은 ${CFG.FIRE_MAX / 60000}분까지 늘릴 수 있어요)` }); return; }
      const ends = pit.endsAt + CFG.FEED_MS;
      me.wood -= 1;
      pit.endsAt = ends;
      broadcast({ t: 'pit', pit, fed: me.id });
      send(ws, inv(me));
      break;
    }
    case 'sit': {
      const pit = pits.get(m.pit);
      const def = pitDef.get(m.pit);
      if (!pit || !nearFire(me, def, 2)) return;
      // 불이 없어도(빈 화로 · 쌓아 둔 장작) 의자에 앉아 쉴 수 있다. 가루 · 음악은 불이 붙어 있어야 한다
      leaveSeat(me);
      let best = -1;
      let bestD = Infinity;
      pit.seats.forEach((occ, i) => {
        if (occ !== null) return;
        const s = seatPos(def, i);
        const d = dist(me, s.x, s.z);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) {
        send(ws, { t: 'toast', text: '자리가 모두 찼어요' });
        return;
      }
      const s = seatPos(def, best);
      pit.seats[best] = me.id;
      me.seat = { pit: pit.id, idx: best };
      me.x = s.x; me.z = s.z; me.ry = s.ry; me.anim = 'sit';
      updateTent(me, ws);
      send(ws, { t: 'sat', pit: pit.id, idx: best, x: s.x, z: s.z, ry: s.ry });
      broadcast({ t: 'pit', pit });
      // 함께 불멍: 같은 모닥불에 두 사람 이상이면 앉아 있는 모두에게
      const sitters = pit.seats.filter((id) => id !== null).map((id) => players.get(id)).filter(Boolean);
      if (sitters.length >= 2) for (const sp of sitters) bump(sp, 'together');
      break;
    }
    case 'stand': {
      leaveSeat(me);
      break;
    }
    case 'throw': {
      if (!me.seat) return;
      const pit = pits.get(me.seat.pit);
      if (!pit || pit.state !== 'lit') {
        send(ws, { t: 'toast', text: '불이 붙어 있어야 가루를 뿌릴 수 있어요 🔥' });
        return;
      }
      const idx = m.idx | 0;
      const powder = me.powders[idx];
      if (!powder) return;
      me.powders.splice(idx, 1);
      broadcast({ t: 'fx', pit: pit.id, powder, by: me.id, name: me.name });
      send(ws, inv(me));
      break;
    }
    case 'musicOpen': { // 곡 고르기 창을 열 때: 최근 곡 + 오늘 남은 검색 횟수
      send(ws, { t: 'musicMenu', recent: recentList(), left: searchesLeft(), hasKey: hasKey(), resetAt: nextReset() });
      break;
    }
    case 'search': {
      if (now - (me.lastSearch || 0) < 2500) { send(ws, { t: 'searchFail', text: '조금만 천천히 검색해 주세요' }); return; }
      me.lastSearch = now;
      search(m.q, me.pid || me.name).then((r) => {
        if (!r.cached) broadcast(quotaMsg()); // 사용량이 바뀌었으니 모두에게 새 기록을 맡긴다
        if (r.ok) send(ws, { t: 'searchResult', q: m.q, items: r.items, left: r.left, cached: r.cached });
        else send(ws, { t: 'searchFail', text: r.text, exhausted: !!r.exhausted, resetAt: r.resetAt, left: searchesLeft() });
      });
      break;
    }
    case 'music': {
      // 모닥불: 그 모닥불에 앉아 있어야 / 텐트: 그 텐트 안에 있어야 (블루투스 스피커)
      const inTent = !!me.tent && m.pit === me.tent;
      const pit = inTent ? tentRooms.get(me.tent) : me.seat && pits.get(me.seat.pit);
      if (!pit || pit.id !== m.pit) { send(ws, { t: 'toast', text: '모닥불이나 텐트 의자에 앉아서 음악을 틀 수 있어요' }); return; }
      if (!inTent && pit.state !== 'lit') { send(ws, { t: 'toast', text: '불이 붙어 있어야 음악을 틀 수 있어요' }); return; }
      if (pit.music) { send(ws, { t: 'toast', text: '지금 곡이 끝나면 다른 곡을 틀 수 있어요 🎵' }); return; }
      if (now - (me.lastMusic || 0) < 3000 || ctx.musicPending) return;
      const vid = parseYouTubeId(m.vid || m.url);
      if (!vid) { send(ws, { t: 'musicFail', text: '곡을 찾지 못했어요. 다시 골라 주세요' }); return; }
      me.lastMusic = now;
      ctx.musicPending = true;
      (async () => {
        // 검색/최근 곡이면 이미 정보가 있고, 링크면 API(1유닛) 또는 oEmbed로 확인
        let info = known.get(vid);
        if (!info && hasKey()) info = (await videoInfo([vid]).catch(() => []))[0];
        if (info) {
          if (!info.embeddable) return { ok: false, why: '이 곡은 업로더가 외부 재생을 막아 뒀어요 😢' };
          if (info.live) return { ok: false, why: '라이브 방송은 틀 수 없어요' };
          return { ok: true, ...info };
        }
        const o = await lookupVideo(vid);
        return o.ok ? { ok: true, vid, title: o.title, channel: '', thumb: '', duration: 0 } : o;
      })().then((info) => {
        ctx.musicPending = false;
        if (!info.ok) { send(ws, { t: 'musicFail', text: info.why }); return; }
        // 확인하는 사이 상황이 바뀌었을 수 있다
        if (ctx.me !== me || pit.music) return;
        if (inTent ? me.tent !== pit.id : me.seat?.pit !== pit.id || pit.state !== 'lit') return;
        const startedAt = Date.now() + 1500;
        pit.music = {
          vid, title: info.title, channel: info.channel || '', by: me.id, byName: me.name, startedAt,
          endsAt: info.duration ? startedAt + info.duration * 1000 + 2000 : 0,
        };
        me.anim = 'guitar';
        if (info.title) addRecent({ vid, title: info.title, channel: info.channel || '', thumb: info.thumb || '', duration: info.duration || 0 });
        syncRoom(pit);
        if (inTent) { // 텐트 안 일은 텐트 안 사람에게만
          for (const q of tentMembers(pit.id)) send(q.ws, { t: 'sys', text: `🔊 ${me.name}님이 스피커로 ${info.title ? `「${info.title}」` : '노래'}를 틀었어요` });
        } else {
          broadcast({ t: 'sys', text: `🎸 ${me.name}님이 ${info.title ? `「${info.title}」` : '음악'} 연주를 시작했어요` });
          bump(me, 'music');
        }
        send(ws, { t: 'musicOk' });
      }).catch((e) => { ctx.musicPending = false; console.error(e); });
      break;
    }
    case 'musicInfo': { // 클라이언트가 알려주는 영상 길이 → 끝나는 시각
      const pit = roomOf(m.pit);
      const d = Number(m.duration);
      if (!pit?.music || pit.music.vid !== m.vid || pit.music.endsAt || !Number.isFinite(d)) return;
      if (d < 3 || d > 6 * 3600) return;
      pit.music.endsAt = pit.music.startedAt + d * 1000 + 2000;
      break;
    }
    case 'musicEnd': { // 영상 끝 / 재생 오류 보고
      const pit = roomOf(m.pit);
      if (!pit?.music || pit.music.vid !== m.vid) return;
      const isDJ = pit.music.by === me.id;
      if (m.reason === 'error' && isDJ) {
        const code = m.code | 0;
        const text = code === 101 || code === 150 ? '이 영상은 업로더가 외부 재생을 막아 뒀어요 😢' : '이 영상은 재생할 수 없어요';
        send(ws, { t: 'toast', text });
        clearMusic(pit, 'error');
        syncRoom(pit);
      } else if (m.reason === 'ended' && (isDJ || (pit.music.endsAt && now >= pit.music.endsAt - 8000))) {
        clearMusic(pit, 'ended');
        syncRoom(pit);
      }
      break;
    }
    case 'boardGet': { // 캠핑장 소식 게시판
      board.snapshot()
        .then((items) => send(ws, { t: 'board', items, players: players.size }))
        .catch((e) => console.error('[board]', e.message));
      break;
    }
    case 'gbOpen': { // 방명록 펼치기
      guestbook.list().then((items) => send(ws, { t: 'gbList', items: items.slice(0, 300), saved: guestbook.notionOn() }));
      break;
    }
    case 'gbWrite': {
      const text = String(m.text || '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, guestbook.MAX_LEN);
      if (!text) { send(ws, { t: 'gbFail', text: '방명록에 남길 말을 적어 주세요' }); return; }
      if (now - (me.lastGb || 0) < 5000 || me.gbPending) { send(ws, { t: 'gbFail', text: '방금 남겼어요. 잠시 후에 다시 남길 수 있어요' }); return; }
      me.lastGb = now;
      me.gbPending = true;
      guestbook.write(me.name, text)
        .then((entry) => {
          send(ws, { t: 'gbWrote', entry });
          bump(me, 'guestbook');
          broadcast({ t: 'gbNew', entry, by: me.id }, ws);
        })
        .catch((e) => {
          console.error('[guestbook] 노션 저장 실패:', e.message);
          me.lastGb = 0;
          send(ws, { t: 'gbFail', text: '방명록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
        })
        .finally(() => { me.gbPending = false; });
      break;
    }
    case 'chat': {
      const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!text || now - me.lastChat < 400) return;
      me.lastChat = now;
      updateTent(me, ws);
      if (me.tent) {
        // 텐트 안 대화: 같은 텐트 안 사람에게만
        const msg = JSON.stringify({ t: 'chat', id: me.id, name: me.name, text, tag: me.tag, tent: me.tent });
        for (const q of players.values()) if (q.tent === me.tent && q.ws?.readyState === 1) q.ws.send(msg);
      } else broadcast({ t: 'chat', id: me.id, name: me.name, text, tag: me.tag });
      break;
    }
    default:
  }
}

// ---------------------------------------------------------------- WebSocket
const wss = new WebSocketServer({ noServer: true, maxPayload: 32768 }); // 가루를 많이 가진 사람의 저장 백업도 들어오게
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  }
});

const ctxs = new Map(); // ws -> ctx
wss.on('connection', (ws) => {
  sockets.add(ws);
  const ctx = { me: null };
  ctxs.set(ws, ctx);
  send(ws, {
    t: 'hello',
    now: Date.now(),
    pits: [...pits.values()],
    tentMusic: [...tentRooms.values()].filter((r) => r.music).map((r) => ({ tent: r.id, music: r.music })),
    players: [...players.values()].map(publicPlayer),
  });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    try { handle(ws, ctx, m); } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    sockets.delete(ws);
    ctxs.delete(ws);
    const me = ctx.me;
    if (!me) return;
    remember(me);
    leaveSeat(me);
    const tr = me.tent && tentRooms.get(me.tent);
    if (tr?.music?.by === me.id) { clearMusic(tr, 'left'); syncRoom(tr); }
    players.delete(me.id);
    broadcast({ t: 'leave', id: me.id });
    if (!ctx.replaced) broadcast({ t: 'sys', text: `${me.name}님이 캠핑장을 떠났어요` });
  });
});

// 위치 스냅샷 10Hz
setInterval(() => {
  if (!players.size) return;
  const list = [];
  for (const p of players.values()) {
    list.push([p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.ry * 100) / 100, p.anim]);
  }
  broadcast({ t: 'snap', now: Date.now(), p: list });
}, 100);

// 00시(한국 시간): 접속해 있는 사람에게도 코인을 다시 채워 준다
let coinDayNow = kstDay();
setInterval(() => {
  const today = kstDay();
  if (today === coinDayNow) return;
  coinDayNow = today;
  for (const p of players.values()) {
    if (!refreshCoins(p) || !p.ws) continue;
    send(p.ws, { t: 'coinReset', n: p.coins });
    send(p.ws, inv(p));
  }
}, 15_000);

// 모닥불 수명 체크
setInterval(() => {
  const now = Date.now();
  for (const tr of tentRooms.values()) {
    if (tr.music?.endsAt && now >= tr.music.endsAt + 5000) { clearMusic(tr, 'ended'); syncRoom(tr); }
  }
  for (const pit of pits.values()) {
    if (pit.music?.endsAt && now >= pit.music.endsAt + 5000) {
      clearMusic(pit, 'ended');
      broadcast({ t: 'pit', pit });
    }
    if (pit.state === 'lit' && now >= pit.endsAt) {
      clearMusic(pit, 'fire');
      pit.state = 'empty';
      pit.owner = null;
      pitOwnerKey.delete(pit.id);
      broadcast({ t: 'pit', pit, burnedOut: true });
    }
  }
}, 500);

server.listen(PORT, HOST, () => {
  console.log(`\n🔥 불멍 캠핑장 서버 실행 중 (${isProd ? 'production' : 'dev'})`);
  console.log(`   이 컴퓨터:      http://localhost:${PORT}`);
  const lan = lanAddresses();
  console.log(`   곡 검색:        ${hasKey() ? `켜짐 (오늘 남은 검색 ${searchesLeft()}번)` : '꺼짐 — .env 또는 환경변수에 YT_API_KEY 를 넣으면 켜져요'}`);
  console.log(`   관리자 페이지:  ${adminOn() ? `켜짐 (/admin)` : '꺼짐 — ADMIN_PASSWORD(8자 이상)를 넣으면 켜져요'}`);
  if (PUBLIC_URL) {
    console.log(`   공개 주소:      ${PUBLIC_URL}\n`);
  } else if (lan.length) {
    console.log('   같은 네트워크:  ' + lan.join('\n                   '));
    console.log('   → 같은 와이파이에 연결된 기기에서 위 주소로 접속하면 같은 서버에서 함께 놀 수 있어요.\n');
  } else {
    console.log('   (네트워크 연결을 찾지 못했어요. 와이파이를 확인하세요)\n');
  }
});
