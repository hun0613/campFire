// 방명록: 노션 데이터베이스를 저장소로 쓴다
// - 쓰면 노션에 한 줄 추가 → 사장님이 노션에서 보고 지울 수 있다
// - 게임에 보여 줄 목록도 노션에서 읽어 온다 (1분마다 새로 고침 → 노션에서 지우면 게임에서도 사라짐)
// - 노션의 '운영자 답글' 칸에 적으면 게임 속 방명록에 답글로 보인다
// - 노션 키가 없으면(로컬 테스트 등) 서버 메모리에만 저장한다 (서버를 끄면 사라짐)
const TOKEN = process.env.NOTION_TOKEN || '';
const DB = (process.env.NOTION_GUESTBOOK_DB || '5c18c9a4ca29407fa760afe913914120').replace(/-/g, ''); // 기본값: 「불멍 캠핑장 방명록」 데이터베이스
const VERSION = '2022-06-28';
const REFRESH_MS = 60_000;
const MAX_ITEMS = 300;
export const MAX_LEN = 300;
export const NAME_PROP = '이름';
export const TEXT_PROP = '내용';
export const REPLY_PROP = '운영자 답글'; // 운영자가 노션에서 적는 답글

export const notionOn = () => !!(TOKEN && DB);

let items = []; // [{ id, name, text, at }] 최신순
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
function fromPage(pg) {
  const pr = pg.properties || {};
  return {
    id: pg.id,
    name: plain(pr[NAME_PROP]?.title).slice(0, 24) || '익명의 캠퍼',
    text: plain(pr[TEXT_PROP]?.rich_text).slice(0, MAX_LEN * 2),
    reply: plain(pr[REPLY_PROP]?.rich_text).trim().slice(0, 1000),
    at: Date.parse(pg.created_time) || 0,
  };
}

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
  } while (cursor && out.length < MAX_ITEMS);
  items = out.filter((e) => e.text.trim());
  loadedAt = Date.now();
}

/** 목록 (오래됐으면 노션에서 다시 읽는다) */
export async function list() {
  if (notionOn() && Date.now() - loadedAt > REFRESH_MS) {
    loading ||= reload().catch((e) => console.error('[guestbook] 노션 읽기 실패:', e.message)).finally(() => { loading = null; });
    // 처음이면 기다리고, 이미 목록이 있으면 일단 있는 걸 보여 준다
    if (!loadedAt) await loading;
  }
  return items;
}

/** 방명록 쓰기 */
export async function write(name, text) {
  const entry = { id: '', name, text, at: Date.now() };
  if (notionOn()) {
    const pg = await notion('pages', {
      parent: { database_id: DB },
      properties: {
        [NAME_PROP]: { title: [{ text: { content: name } }] },
        [TEXT_PROP]: { rich_text: [{ text: { content: text } }] },
      },
    });
    entry.id = pg.id;
    entry.at = Date.parse(pg.created_time) || entry.at;
  } else {
    entry.id = `local-${entry.at}-${Math.random().toString(36).slice(2, 7)}`;
  }
  items.unshift(entry);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  return entry;
}

// ---------------------------------------------------------------- 관리자 페이지용
/** 노션에서 바로 다시 읽어 온다 (관리자 페이지는 항상 최신 목록을 본다) */
export async function refresh() {
  if (notionOn()) await reload();
  return items;
}

const validId = (id) => typeof id === 'string' && /^[0-9a-f-]{32,36}$|^local-/.test(id);

/** 운영자 답글 달기 · 고치기 (빈 문자열이면 답글 지우기) */
export async function setReply(id, reply) {
  if (!validId(id)) throw new Error('잘못된 방명록 ID');
  const text = String(reply ?? '').trim().slice(0, 1000);
  if (notionOn() && !id.startsWith('local-')) {
    await notion(`pages/${id}`, {
      properties: { [REPLY_PROP]: { rich_text: text ? [{ text: { content: text } }] : [] } },
    }, 'PATCH');
  }
  const e = items.find((x) => x.id === id);
  if (e) e.reply = text;
  return e || { id, reply: text };
}

/** 방명록 지우기 (노션에서는 휴지통으로 옮긴다 → 30일 안에 노션에서 되살릴 수 있다) */
export async function remove(id) {
  if (!validId(id)) throw new Error('잘못된 방명록 ID');
  if (notionOn() && !id.startsWith('local-')) await notion(`pages/${id}`, { archived: true }, 'PATCH');
  items = items.filter((x) => x.id !== id);
}

// 서버가 켜질 때 미리 한 번 읽어 둔다
if (notionOn()) {
  reload()
    .then(() => console.log(`[guestbook] 노션 방명록 ${items.length}개 불러옴`))
    .catch((e) => console.error('[guestbook] 노션 연결 실패 — NOTION_TOKEN / 데이터베이스 연결을 확인하세요:', e.message));
} else {
  console.log('[guestbook] 노션 키가 없어 방명록을 서버 메모리에만 저장해요');
}
