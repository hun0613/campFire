// 일별 이용 기록: 게임 서버가 직접 센 하루 숫자를 노션 「일별 이용 기록」 데이터베이스에 남긴다 (한국 날짜).
// GA4가 어떤 이유로 하루를 통째로 놓쳐도(2026-11-12) 운영자가 볼 수 있는 기록이 남게 하려고 만들었다.
// - 입장: 캠핑장에 들어온 횟수 (다시 접속 포함)
// - 방문자: 들어온 기기 수. 같은 기기는 하루 1명. 기기 식별값을 그날만 쓰는 짧은 표식으로 바꿔 중복만 막는다
//   (표식은 날짜마다 달라서 다른 날과 이어 볼 수 없고, 날짜가 지나면 노션에서도 지운다)
// - 최대 동시 접속, 머문 시간 합계(분), 불 붙이기 횟수
// 서버 메모리에서 세고 10분마다(그리고 서버가 꺼질 때) 노션의 그날 줄을 고쳐 쓴다. 서버가 다시 켜지면 그날 줄을 읽어 이어 센다.
import crypto from 'node:crypto';

const TOKEN = process.env.NOTION_TOKEN || '';
const DB = (process.env.NOTION_DAILY_DB || '418fcf3f621081e5a8c7f83c90543c04').replace(/-/g, ''); // 기본값: 방명록 페이지 아래 「일별 이용 기록」
const VERSION = '2022-06-28';
const FLUSH_MS = 10 * 60_000;
const P = { day: '날짜', joins: '입장', visitors: '방문자', peak: '최대 동시 접속', stay: '머문 시간(분)', lights: '불 붙이기', tags: '표식' };

export const dailyOn = () => !!(TOKEN && DB);

const dayKST = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);

let secret = 'local';
let state = fresh(dayKST());

function fresh(day) {
  // base: 노션에 이미 있던 값 (서버가 다시 켜졌을 때), 나머지: 이번 서버가 센 값
  return { day, pageId: null, loaded: false, loading: null, base: { joins: 0, stayMin: 0, lights: 0, peak: 0 }, joins: 0, stayMs: 0, lights: 0, peak: 0, tags: new Set(), dirty: false };
}

async function notion(path, body, method = 'POST') {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.code || ''} ${j.message || ''}`.trim());
  return j;
}

const plain = (arr) => (arr || []).map((t) => t.plain_text || '').join('');
const num = (p) => (typeof p?.number === 'number' ? p.number : 0);

function fromPage(pg) {
  const pr = pg.properties || {};
  return {
    id: pg.id,
    day: plain(pr[P.day]?.title),
    joins: num(pr[P.joins]), visitors: num(pr[P.visitors]), peak: num(pr[P.peak]),
    stayMin: num(pr[P.stay]), lights: num(pr[P.lights]),
    tags: plain(pr[P.tags]?.rich_text).split(',').filter(Boolean),
  };
}

/** 그날 줄을 노션에서 찾아 이어 센다 (없으면 새로 만들 때까지 0부터) */
function load(s) {
  if (s.loaded || !dailyOn()) return Promise.resolve();
  s.loading ||= notion(`databases/${DB}/query`, { page_size: 1, filter: { property: P.day, title: { equals: s.day } } })
    .then((j) => {
      const pg = j.results?.[0];
      if (pg) {
        const d = fromPage(pg);
        s.pageId = d.id;
        s.base = { joins: d.joins, stayMin: d.stayMin, lights: d.lights, peak: d.peak };
        for (const t of d.tags) s.tags.add(t);
      }
      s.loaded = true;
    })
    .catch((e) => console.warn('[daily] 노션 읽기 실패:', e.message))
    .finally(() => { s.loading = null; });
  return s.loading;
}

function totals(s) {
  return {
    day: s.day,
    joins: s.base.joins + s.joins,
    visitors: s.tags.size,
    peak: Math.max(s.base.peak, s.peak),
    stayMin: s.base.stayMin + Math.round(s.stayMs / 60_000),
    lights: s.base.lights + s.lights,
  };
}

// 노션 글자 칸 하나는 2000자까지라 나눠 담는다
function textChunks(str) {
  const out = [];
  for (let i = 0; i < str.length && out.length < 90; i += 1900) out.push({ type: 'text', text: { content: str.slice(i, i + 1900) } });
  return out;
}

async function write(s, { final = false } = {}) {
  if (!dailyOn()) return;
  await load(s);
  if (!s.loaded) return; // 노션을 못 읽었으면 덮어쓰지 않는다 (다음에 다시)
  const t = totals(s);
  const properties = {
    [P.day]: { title: [{ type: 'text', text: { content: s.day } }] },
    [P.joins]: { number: t.joins }, [P.visitors]: { number: t.visitors }, [P.peak]: { number: t.peak },
    [P.stay]: { number: t.stayMin }, [P.lights]: { number: t.lights },
    [P.tags]: { rich_text: final ? [] : textChunks([...s.tags].join(',')) }, // 날짜가 지나면 표식은 지운다
  };
  if (s.pageId) await notion(`pages/${s.pageId}`, { properties }, 'PATCH');
  else s.pageId = (await notion('pages', { parent: { database_id: DB }, properties })).id;
  s.dirty = false;
}

/** 날짜가 바뀌었으면 어제 줄을 마무리하고 오늘을 새로 센다 */
function roll() {
  const today = dayKST();
  if (state.day === today) return state;
  const old = state;
  state = fresh(today);
  load(state);
  write(old, { final: true }).catch((e) => console.warn('[daily] 어제 기록 마무리 실패:', e.message));
  return state;
}

export async function flush() {
  const s = roll();
  if (!s.dirty && s.loaded) return;
  try { await write(s); } catch (e) { console.warn('[daily] 노션 쓰기 실패:', e.message); }
}

// ---------------------------------------------------------------- 게임 서버가 부르는 곳
export function start(opts = {}) {
  if (opts.secret) secret = opts.secret;
  load(state);
  setInterval(flush, FLUSH_MS).unref?.();
}

/** 캠핑장에 들어왔다 (pid: 기기 식별값, 없을 수도) · 지금 접속자 수 */
export function join(pid, online) {
  const s = roll();
  s.joins++;
  s.peak = Math.max(s.peak, online || 0);
  // 그날만 쓰는 짧은 표식: 날짜를 섞어서 다른 날 표식과 이어지지 않는다
  const key = pid || `anon-${s.joins}`;
  s.tags.add(crypto.createHmac('sha256', secret).update(`day|${s.day}|${key}`).digest('base64url').slice(0, 8));
  s.dirty = true;
}

/** 나갔다: 머문 시간(ms) */
export function leave(ms) {
  const s = roll();
  if (ms > 0 && ms < 24 * 3600_000) { s.stayMs += ms; s.dirty = true; }
}

/** 모닥불에 불을 붙였다 */
export function light() { const s = roll(); s.lights++; s.dirty = true; }

/** 관리 화면: 최근 days일 (오늘은 서버 메모리의 최신 값으로) */
export async function recent(days = 14) {
  const s = roll();
  await load(s);
  let rows = [];
  if (dailyOn()) {
    const j = await notion(`databases/${DB}/query`, { page_size: Math.min(100, days + 1), sorts: [{ property: P.day, direction: 'descending' }] });
    rows = (j.results || []).filter((pg) => !pg.archived && !pg.in_trash).map(fromPage).map(({ id, tags, ...r }) => r);
  }
  const today = totals(s);
  rows = [today, ...rows.filter((r) => r.day !== today.day)].slice(0, days);
  return { on: dailyOn(), rows };
}
