// 관리자 API (/api/admin/*)
// - 비밀번호는 환경 변수 ADMIN_PASSWORD 에만 둔다. 비어 있으면 관리자 기능 전체가 꺼진다
// - 로그인하면 12시간짜리 서명 토큰을 준다. 이후 요청은 Authorization: Bearer <토큰>
// - 비밀번호를 틀리면 IP마다 10분에 5번까지만 다시 시도할 수 있다
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as guestbook from './guestbook.js';

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = crypto.createHash('sha256').update(`admin:${PASSWORD}:${process.env.SAVE_SECRET || ''}`).digest();
const TOKEN_TTL = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const FAIL_WINDOW = 10 * 60 * 1000;
const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// 릴리즈 노트 맨 위 버전의 새 기능 목록 (안내 문구 만들기에서 기본값으로 쓴다)
function latestRelease() {
  try {
    const md = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const start = md.indexOf('\n## v');
    if (start < 0) return null;
    const end = md.indexOf('\n## v', start + 5);
    const sec = md.slice(start + 1, end < 0 ? undefined : end);
    const version = (sec.match(/^## (v[\d.]+)/) || [])[1] || '';
    const feats = [];
    let inNew = false;
    for (const line of sec.split('\n')) {
      if (line.startsWith('### ')) inNew = line.includes('새 기능');
      const m = inNew && line.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/);
      if (m) feats.push({ title: m[1].trim(), desc: m[2].trim() });
    }
    return { version, features: feats };
  } catch { return null; }
}

export const adminOn = () => PASSWORD.length >= 8;

const fails = new Map(); // ip -> { n, until }

const sign = (exp) => crypto.createHmac('sha256', SECRET).update(String(exp)).digest('base64url');
function issueToken() {
  const exp = Date.now() + TOKEN_TTL;
  return `${exp}.${sign(exp)}`;
}
function validToken(tok) {
  const [exp, sig] = String(tok || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function samePassword(input) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 16 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * /api/admin/* 요청을 처리한다. 처리했으면 true
 * @param {() => {players:number}} getStats
 */
export async function handleAdmin(req, res, getStats) {
  const url = new URL(req.url || '/', 'http://x');
  if (!url.pathname.startsWith('/api/admin/')) return false;
  const route = url.pathname.slice('/api/admin/'.length);

  if (!adminOn()) { send(res, 503, { error: '관리자 기능이 꺼져 있어요. 서버 환경 변수 ADMIN_PASSWORD(8자 이상)를 설정하세요.' }); return true; }

  try {
    if (route === 'login' && req.method === 'POST') {
      const ip = clientIp(req);
      const f = fails.get(ip);
      if (f && f.n >= MAX_FAILS && f.until > Date.now()) {
        send(res, 429, { error: `비밀번호를 여러 번 틀렸어요. ${Math.ceil((f.until - Date.now()) / 60000)}분 뒤에 다시 시도하세요.` });
        return true;
      }
      const { password } = await readJson(req);
      if (typeof password === 'string' && samePassword(password)) {
        fails.delete(ip);
        send(res, 200, { token: issueToken(), ttl: TOKEN_TTL });
      } else {
        const n = f && f.until > Date.now() ? f.n + 1 : 1;
        fails.set(ip, { n, until: Date.now() + FAIL_WINDOW });
        send(res, 401, { error: '비밀번호가 맞지 않아요.' });
      }
      return true;
    }

    const auth = String(req.headers.authorization || '');
    if (!validToken(auth.replace(/^Bearer\s+/i, ''))) { send(res, 401, { error: '다시 로그인해 주세요.' }); return true; }

    if (route === 'stats' && req.method === 'GET') {
      send(res, 200, { version: VERSION, notion: guestbook.notionOn(), latest: latestRelease(), ...getStats() });
      return true;
    }
    if (route === 'guestbook' && req.method === 'GET') {
      const items = await guestbook.refresh();
      send(res, 200, { items, notion: guestbook.notionOn() });
      return true;
    }
    const m = route.match(/^guestbook\/([^/]+)(\/reply)?$/);
    if (m && m[2] && req.method === 'POST') {
      const { reply } = await readJson(req);
      const entry = await guestbook.setReply(m[1], reply);
      send(res, 200, { entry });
      return true;
    }
    if (m && !m[2] && req.method === 'DELETE') {
      await guestbook.remove(m[1]);
      send(res, 200, { ok: true });
      return true;
    }
    send(res, 404, { error: '없는 기능이에요.' });
  } catch (e) {
    console.error('[admin]', e.message);
    const bad = e.message.startsWith('잘못된') || e.message === 'bad json' || e.message === 'too large';
    send(res, bad ? 400 : 500, { error: bad ? e.message : `처리하지 못했어요: ${e.message}` });
  }
  return true;
}
