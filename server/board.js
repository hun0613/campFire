// 캠핑장 소식 게시판
// - 운영자 공지는 노션 「캠핑장 소식」 데이터베이스에 저장한다 (관리실에서 쓰고 고친다). 「게시」에 체크된 것만 게임에 보인다
// - 게임에는 게시 중인 공지만 보낸다
// - 노션 키가 없으면(로컬 테스트 등) 서버 메모리에만 저장한다

const TOKEN = process.env.NOTION_TOKEN || '';
const DB = (process.env.NOTION_NOTICE_DB || '2bc768d102834a198be2e84afc16866e').replace(/-/g, ''); // 기본값: 「캠핑장 소식」
const VERSION = '2022-06-28';
const TITLE_PROP = '제목';
const TEXT_PROP = '내용';
const PUB_PROP = '게시';
export const MAX_TITLE = 40;
export const MAX_TEXT = 200;
const on = () => !!(TOKEN && DB);

let notices = []; // [{ id, title, text, published, at }] 최신순 (게시 안 한 것 포함)
let loadedAt = 0;
let loading = null;

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
const fromPage = (pg) => ({
  id: pg.id,
  title: plain(pg.properties?.[TITLE_PROP]?.title).slice(0, MAX_TITLE),
  text: plain(pg.properties?.[TEXT_PROP]?.rich_text).slice(0, MAX_TEXT),
  published: !!pg.properties?.[PUB_PROP]?.checkbox,
  at: Date.parse(pg.created_time) || 0,
});

async function reload() {
  const j = await notion(`databases/${DB}/query`, { page_size: 50, sorts: [{ timestamp: 'created_time', direction: 'descending' }] });
  notices = (j.results || []).filter((pg) => !pg.archived && !pg.in_trash).map(fromPage).filter((n) => n.title || n.text);
  loadedAt = Date.now();
}

async function ensure(force = false) {
  if (!on()) return;
  if (force || Date.now() - loadedAt > 60_000) {
    loading ||= reload().catch((e) => console.error('[board] 노션 읽기 실패:', e.message)).finally(() => { loading = null; });
    if (force || !loadedAt) await loading;
  }
}

// ---------------------------------------------------------------- 관리실
export async function listAll() { await ensure(true); return notices; }

const clean = (v, max) => String(v ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max);
const validId = (id) => typeof id === 'string' && /^[0-9a-f-]{32,36}$|^local-/.test(id);

export async function create({ title, text, published = true }) {
  const n = { id: '', title: clean(title, MAX_TITLE), text: clean(text, MAX_TEXT), published: !!published, at: Date.now() };
  if (!n.title && !n.text) throw new Error('잘못된 공지: 제목이나 내용을 적어 주세요');
  if (on()) {
    const pg = await notion('pages', {
      parent: { database_id: DB },
      properties: {
        [TITLE_PROP]: { title: [{ text: { content: n.title || n.text.slice(0, MAX_TITLE) } }] },
        [TEXT_PROP]: { rich_text: n.text ? [{ text: { content: n.text } }] : [] },
        [PUB_PROP]: { checkbox: n.published },
      },
    });
    n.id = pg.id;
  } else n.id = `local-${n.at}`;
  notices.unshift(n);
  return n;
}

export async function update(id, { title, text, published }) {
  if (!validId(id)) throw new Error('잘못된 공지 ID');
  const n = notices.find((x) => x.id === id) || { id };
  const props = {};
  if (title !== undefined) { n.title = clean(title, MAX_TITLE); props[TITLE_PROP] = { title: [{ text: { content: n.title } }] }; }
  if (text !== undefined) { n.text = clean(text, MAX_TEXT); props[TEXT_PROP] = { rich_text: n.text ? [{ text: { content: n.text } }] : [] }; }
  if (published !== undefined) { n.published = !!published; props[PUB_PROP] = { checkbox: n.published }; }
  if (on() && !id.startsWith('local-')) await notion(`pages/${id}`, { properties: props }, 'PATCH');
  return n;
}

export async function remove(id) {
  if (!validId(id)) throw new Error('잘못된 공지 ID');
  if (on() && !id.startsWith('local-')) await notion(`pages/${id}`, { archived: true }, 'PATCH');
  notices = notices.filter((x) => x.id !== id);
}

// ---------------------------------------------------------------- 게임에 보낼 게시판 내용
// 관리실에서 「게시」한 공지만 보낸다 (없으면 게임에서는 불멍 캠핑장 로고를 보여 준다)
export async function snapshot() {
  await ensure();
  return notices.filter((x) => x.published).slice(0, 5).map((n) => ({ kind: 'notice', title: n.title, text: n.text, at: n.at }));
}
