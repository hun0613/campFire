// 🎤 불멍 아레나 무대 신청 · 타임테이블 (v1.23)
// - 게임 속 무대 신청 부스에서 곡(유튜브) · 원하는 시각 · 한마디를 신청한다 → 노션 「🎤 아레나 무대 신청」에 「대기」로 한 줄
// - 관리실 🎤 아레나 탭(또는 노션)에서 「승인」하면 타임테이블에 올라가고, 그 시각에 아레나 대형 전광판에서 모두 함께 듣는다
// - 노션 키가 없으면(로컬 테스트) 서버 메모리에만 둔다
const TOKEN = process.env.NOTION_TOKEN || '';
const DB = (process.env.NOTION_ARENA_DB || '424fcf3f62108120bc83e040a42f0a1b').replace(/-/g, '');
const VERSION = '2022-06-28';
const REFRESH_MS = 60_000;
export const DEFAULT_DUR = 600; // 곡 길이를 모를 때 (영상이 재생되면 실제 길이로 고친다)
export const MAX_DUR = 15 * 60; // 한 무대는 15분까지
export const SLOT_MIN = 30;     // 신청은 30분 칸 단위
export const MAX_DAYS = 14;     // 2주 뒤까지 신청
export const PER_DEVICE = 2;    // 한 기기가 동시에 걸어 둘 수 있는 신청 (대기 + 앞으로 할 무대)
export const MSG_LEN = 60;

export const notionOn = () => !!TOKEN;

let items = []; // [{ id, title, vid, channel, by, msg, at, status, dur, tag, created }]
let loadedAt = 0;
let loading = null;
let onChange = () => {};
export const setOnChange = (f) => { onChange = f; };

async function notion(path, body, method = 'POST') {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.code || ''} ${j.message || ''}`.trim());
  return j;
}
const plain = (arr) => (arr || []).map((t) => t.plain_text || '').join('');
const rt = (s) => (s ? [{ text: { content: String(s).slice(0, 1900) } }] : []);
/** ms → 노션 날짜 (한국 시간) */
const kstIso = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 19) + '+09:00';

function fromPage(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    title: plain(p['곡']?.title).slice(0, 120) || '제목 없는 곡',
    vid: plain(p['영상 ID']?.rich_text).trim(),
    channel: plain(p['채널']?.rich_text).slice(0, 80),
    by: plain(p['신청자']?.rich_text).slice(0, 24) || '익명의 캠퍼',
    msg: plain(p['한마디']?.rich_text).slice(0, MSG_LEN * 2),
    at: Date.parse(p['공연 시각']?.date?.start || '') || 0,
    status: p['상태']?.select?.name || '대기',
    dur: Number(p['곡 길이(초)']?.number) || 0,
    tag: plain(p['기기']?.rich_text).slice(0, 32),
    created: Date.parse(pg.created_time) || 0,
  };
}
const props = (e) => ({
  곡: { title: rt(e.title) },
  '영상 ID': { rich_text: rt(e.vid) },
  채널: { rich_text: rt(e.channel) },
  신청자: { rich_text: rt(e.by) },
  한마디: { rich_text: rt(e.msg) },
  '공연 시각': { date: e.at ? { start: kstIso(e.at) } : null },
  상태: { select: { name: e.status } },
  '곡 길이(초)': { number: e.dur || null },
  기기: { rich_text: rt(e.tag) },
});

async function reload() {
  const out = [];
  let cursor;
  do {
    const j = await notion(`databases/${DB}/query`, {
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const pg of j.results || []) if (!pg.archived && !pg.in_trash) out.push(fromPage(pg));
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor && out.length < 400);
  const before = JSON.stringify(timetable(Date.now()));
  items = out.filter((e) => /^[A-Za-z0-9_-]{11}$/.test(e.vid));
  loadedAt = Date.now();
  if (JSON.stringify(timetable(Date.now())) !== before) onChange();
}

/** 1분마다 노션에서 다시 읽는다 (노션에서 직접 승인 · 시각을 바꿔도 게임에 반영) */
export function tick() {
  if (notionOn() && Date.now() - loadedAt > REFRESH_MS && !loading) {
    loading = reload().catch((e) => console.error('[arena] 노션 읽기 실패:', e.message)).finally(() => { loading = null; });
  }
}

const endOf = (e) => e.at + Math.min(MAX_DUR, e.dur || DEFAULT_DUR) * 1000 + 2000;
/** 앞으로 할 (또는 지금 하는) 승인된 무대, 시각 순 */
export function timetable(now = Date.now()) {
  return items.filter((e) => e.status === '승인' && e.at && endOf(e) > now).sort((a, b) => a.at - b.at)
    .slice(0, 30).map(({ id, title, channel, by, msg, at, dur, vid }) => ({ id, title, channel, by, msg, at, dur, vid }));
}
/** 지금 무대에서 나오는 곡 (없으면 null) — music 모양(startedAt · endsAt)으로 */
export function current(now = Date.now()) {
  const e = items.find((x) => x.status === '승인' && x.at && x.at <= now && now < endOf(x));
  return e ? { id: e.id, vid: e.vid, title: e.title, channel: e.channel, byName: e.by, msg: e.msg, startedAt: e.at, endsAt: e.dur ? endOf(e) : 0 } : null;
}
/** 이 기기의 신청 (대기 · 앞으로 할 승인 · 최근 거절) */
export function mine(tag, now = Date.now()) {
  if (!tag) return [];
  return items.filter((e) => e.tag === tag && (e.status === '대기' || (e.at && endOf(e) > now - 86400e3)))
    .slice(0, 6).map(({ id, title, at, status, msg }) => ({ id, title, at, status, msg }));
}
const busyFor = (tag, now) => items.filter((e) => e.tag === tag && (e.status === '대기' || (e.status === '승인' && endOf(e) > now))).length;

/** 칸이 승인된 무대와 겹치는지 (except: 자기 자신) */
function overlaps(at, dur, except) {
  const end = at + Math.min(MAX_DUR, dur || DEFAULT_DUR) * 1000 + 2000;
  return items.find((e) => e.id !== except && e.status === '승인' && e.at && e.at < end && at < endOf(e)) || null;
}

/** 게임에서 신청 */
export async function apply({ vid, title, channel, dur, by, msg, at, tag }, now = Date.now()) {
  if (!Number.isFinite(at) || at % (SLOT_MIN * 60e3) !== 0) return { ok: false, why: '시각을 다시 골라 주세요' };
  if (at < now + 10 * 60e3) return { ok: false, why: '지금부터 10분 뒤 칸부터 신청할 수 있어요' };
  if (at > now + MAX_DAYS * 86400e3) return { ok: false, why: `${MAX_DAYS}일 안의 칸만 신청할 수 있어요` };
  if (dur > MAX_DUR) return { ok: false, why: `한 무대는 ${MAX_DUR / 60}분까지예요. 더 짧은 곡을 골라 주세요` };
  if (tag && busyFor(tag, now) >= PER_DEVICE) return { ok: false, why: `신청은 한 사람이 ${PER_DEVICE}곡까지 걸어 둘 수 있어요 (끝나거나 거절되면 다시 신청)` };
  if (overlaps(at, dur)) return { ok: false, why: '그 시각엔 이미 무대가 잡혀 있어요. 다른 칸을 골라 주세요' };
  const e = { id: '', title: String(title || '').slice(0, 120) || '제목 없는 곡', vid, channel: String(channel || '').slice(0, 80), by: String(by || '').slice(0, 24), msg: String(msg || '').trim().slice(0, MSG_LEN), at, status: '대기', dur: Math.round(dur) || 0, tag: tag || '', created: now };
  if (notionOn()) {
    const pg = await notion('pages', { parent: { database_id: DB }, properties: props(e) });
    e.id = pg.id;
  } else e.id = `local-${now}-${Math.random().toString(36).slice(2, 7)}`;
  items.unshift(e);
  return { ok: true, item: e };
}

// ---------------------------------------------------------------- 관리실
/** 관리실에서 바로 무대 올리기 (신청 없이 · 바로 「승인」, 칸 · 기기 제한 없음. 겹치는 무대만 막는다) */
export async function addByAdmin({ vid, title, channel, dur, by, msg, at }) {
  if (!Number.isFinite(at) || at <= 0) throw new Error('잘못된 시각');
  if (dur > MAX_DUR) throw new Error(`잘못된 곡: 한 무대는 ${MAX_DUR / 60}분까지예요`);
  const o = overlaps(at, dur);
  if (o) throw new Error(`잘못된 시각: 「${o.title}」 무대와 겹쳐요`);
  const e = { id: '', title: String(title || '').slice(0, 120) || '제목 없는 곡', vid, channel: String(channel || '').slice(0, 80), by: String(by || '').slice(0, 24) || '캠핑장 주인장', msg: String(msg || '').trim().slice(0, MSG_LEN), at, status: '승인', dur: Math.round(dur) || 0, tag: 'admin', created: Date.now() };
  if (notionOn()) e.id = (await notion('pages', { parent: { database_id: DB }, properties: props(e) })).id;
  else e.id = `local-${e.created}-${Math.random().toString(36).slice(2, 7)}`;
  items.unshift(e);
  onChange();
  return e;
}

export async function refresh() {
  if (notionOn()) await reload();
  return items;
}
const validId = (id) => typeof id === 'string' && /^[0-9a-f-]{32,36}$|^local-/.test(id);
/** 상태 · 시각 바꾸기 (승인할 때 겹치면 거절) */
export async function update(id, { status, at }) {
  if (!validId(id)) throw new Error('잘못된 신청 ID');
  const e = items.find((x) => x.id === id);
  if (!e) throw new Error('잘못된 신청 ID (목록을 새로 고쳐 주세요)');
  const next = { ...e };
  if (status !== undefined) { if (!['대기', '승인', '거절'].includes(status)) throw new Error('잘못된 상태'); next.status = status; }
  if (at !== undefined) { const t = Number(at); if (!Number.isFinite(t) || t <= 0) throw new Error('잘못된 시각'); next.at = t; }
  if (next.status === '승인') {
    const o = overlaps(next.at, next.dur, id);
    if (o) throw new Error(`잘못된 시각: 「${o.title}」 무대와 겹쳐요`);
  }
  if (notionOn() && !id.startsWith('local-')) await notion(`pages/${id}`, { properties: { 상태: { select: { name: next.status } }, '공연 시각': { date: next.at ? { start: kstIso(next.at) } : null } } }, 'PATCH');
  Object.assign(e, next);
  onChange();
  return e;
}
export async function remove(id) {
  if (!validId(id)) throw new Error('잘못된 신청 ID');
  if (notionOn() && !id.startsWith('local-')) await notion(`pages/${id}`, { archived: true }, 'PATCH');
  items = items.filter((x) => x.id !== id);
  onChange();
}
/** 재생해 보니 알게 된 곡 길이 (처음 한 번만 기록) */
export function setDuration(id, sec) {
  const e = items.find((x) => x.id === id);
  if (!e || e.dur || !(sec > 3)) return;
  e.dur = Math.round(Math.min(sec, MAX_DUR));
  if (notionOn() && !id.startsWith('local-')) notion(`pages/${id}`, { properties: { '곡 길이(초)': { number: e.dur } } }, 'PATCH').catch(() => {});
  onChange();
}

if (notionOn()) {
  loading = reload()
    .then(() => console.log(`[arena] 노션 무대 신청 ${items.length}개 불러옴`))
    .catch((e) => console.error('[arena] 노션 연결 실패 — 「🎤 아레나 무대 신청」 데이터베이스에 통합(연결)을 추가했는지 확인하세요:', e.message))
    .finally(() => { loading = null; });
}
