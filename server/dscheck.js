// 불멍 디자인 시스템(/lab)의 「디자인 점검」을 노션 「🎨 디자인 점검 · 협업 현황판」에 남긴다
// - 로컬 서버(개발)에서만 연다. 운영 서버에서는 /api/ds/* 가 404 (실험실은 보기만)
// - 요소 하나 = 노션 행 하나 (id 로 찾아 있으면 고치고, 없으면 만든다)
//   GET  /api/ds/checks → { notion, checks: { [id]: { status, memo, pageId } } }
//   POST /api/ds/check  { id, name, level, area, where, extracted, status, memo } → { check }

const TOKEN = process.env.NOTION_TOKEN || '';
const DB = (process.env.NOTION_DS_DB || '421fcf3f621081dfb6d2c0976d4a09b5').replace(/-/g, '');
const VERSION = '2022-06-28';
const STATUS = { ok: '괜찮음', review: '검토 필요', design: '디자인 필요' };
const STATUS_BACK = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [v, k]));

async function notion(path, body, method = 'POST') {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.code || ''} ${j.message || ''}`.trim());
  return j;
}
const plain = (arr) => (arr || []).map((t) => t.plain_text || '').join('');
const text = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });

async function list() {
  const out = {};
  let cursor;
  do {
    const j = await notion(`databases/${DB}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    for (const pg of j.results) {
      const id = plain(pg.properties?.id?.rich_text);
      if (!id) continue;
      const st = pg.properties?.['상태']?.select?.name || '';
      out[id] = { status: STATUS_BACK[st] || null, statusName: st || null, memo: plain(pg.properties?.['메모']?.rich_text), pageId: pg.id };
    }
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

async function save(b) {
  if (!b?.id || !/^[a-z0-9-]{1,60}$/.test(b.id)) throw new Error('요소 id 가 이상해요');
  const props = {
    요소: { title: [{ text: { content: String(b.name || b.id).slice(0, 100) } }] },
    id: text(b.id),
    단계: b.level ? { select: { name: String(b.level) } } : undefined,
    영역: b.area ? { select: { name: String(b.area) } } : undefined,
    상태: b.status && STATUS[b.status] ? { select: { name: STATUS[b.status] } } : undefined,
    메모: text(b.memo || ''),
    '코드 위치': text(b.where || ''),
    '떼어 냄': { checkbox: !!b.extracted },
    점검일: { date: { start: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) } },
  };
  for (const k of Object.keys(props)) if (props[k] === undefined) delete props[k];
  const q = await notion(`databases/${DB}/query`, { filter: { property: 'id', rich_text: { equals: b.id } }, page_size: 1 });
  const pg = q.results[0]
    ? await notion(`pages/${q.results[0].id}`, { properties: props }, 'PATCH')
    : await notion('pages', { parent: { database_id: DB }, properties: props });
  return { status: b.status || null, memo: b.memo || '', pageId: pg.id };
}

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

/** /api/ds/* 요청을 처리했으면 true */
export function handleDs(req, res) {
  if (!req.url?.startsWith('/api/ds/')) return false;
  if (!TOKEN) { send(res, 503, { error: '노션 키가 없어요 (.env 의 NOTION_TOKEN)' }); return true; }
  if (req.method === 'GET' && req.url === '/api/ds/checks') {
    list().then((checks) => send(res, 200, { notion: true, checks })).catch((e) => send(res, 502, { notion: false, error: e.message, checks: {} }));
    return true;
  }
  if (req.method === 'POST' && req.url === '/api/ds/check') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      let b; try { b = JSON.parse(body); } catch { send(res, 400, { error: '잘못된 요청' }); return; }
      save(b).then((check) => send(res, 200, { check })).catch((e) => send(res, 502, { error: e.message }));
    });
    return true;
  }
  send(res, 404, { error: 'not found' });
  return true;
}
