// 일일 리포트: 매일 00:05(한국 시간)에 전날 숫자를 확정해 노션 「일별 이용 기록 · 일일 리포트」의 그날 줄에 저장하고,
// 그 줄(페이지) 본문에 리포트 데이터(JSON)를 넣는다. 사람이 보는 리포트는 관리실에서 HTML로 그린다 (reportHtml.js). 12:00에 GA4를 한 번 더 집계하되 숫자가 줄었으면 덮어쓰지 않는다
// (GA4가 나중에 하루치를 잃어도 — 2026-11-12처럼 — 먼저 찍어 둔 값이 남게).
// - 서버 숫자: daily.js 가 센 방문자 · 입장 · 최대 동시 접속 · 머문 시간 · 불 붙이기
// - GA4 숫자: 방문자 · 신규 · 세션 · 조회수 · 이벤트 · 1인당 머문 시간, 게임 행동 · 유입 경로 · 기기 · 시간대 · 루미의 부탁
// - 방명록: 그날 남긴 글 수
// 서버가 00시 배포 · 재시작으로 꺼져 있었어도, 켜지면 어제 리포트가 없을 때 바로 만든다.
import * as daily from './daily.js';
import * as ga from './analytics.js';
import * as guestbook from './guestbook.js';

const FIRST_AT = { h: 0, m: 5 };  // 확정
const SECOND_AT = { h: 12, m: 0 }; // 재집계

const kstNow = () => new Date(Date.now() + 9 * 3600_000); // getUTC* 로 한국 시각을 읽는다
const dayOf = (t) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
const stampNow = () => { const k = kstNow(); return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`; };

// 날짜별 특이사항 (리포트 맨 위 안내)
const NOTES = {
  '2026-11-12': 'GA4 일시 소실 후 복구된 날이에요. 당일 집계된 하루치가 Google의 일일 처리 과정에서 11/13~11/15 동안 0으로 보였다가, 11/15에 GA4가 되살렸어요 (Google 커뮤니티에 신고함). 서버 기록은 v1.16.3 이전이라 없어요.',
};

// ---------------------------------------------------------------- 노션: 리포트 데이터(JSON)를 그날 줄 본문에 코드 블록으로 보관
// (Render 무료 서버는 디스크가 재시작 때마다 지워져 파일로 남길 수 없다. HTML은 관리실에서 열 때 이 데이터로 그린다)
const DATA_CAPTION = 'report-data';
function dataBlocks(snap) {
  const json = JSON.stringify(snap);
  const chunks = [];
  for (let i = 0; i < json.length && chunks.length < 100; i += 1900) chunks.push({ type: 'text', text: { content: json.slice(i, i + 1900) } });
  return [
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '📅 하루 리포트는 관리실 → 통계 → 🗒️ 서버 기록 → 「보기」에서 HTML로 열려요. 아래는 리포트 데이터예요 (지우지 마세요).' } }] } },
    { object: 'block', type: 'code', code: { language: 'json', caption: [{ type: 'text', text: { content: DATA_CAPTION } }], rich_text: chunks } },
  ];
}

/** 그날 리포트 데이터(스냅숏)를 노션에서 읽는다. 없으면 null */
export async function getSnapshot(day) {
  const page = await daily.findDay(day);
  if (!page) return null;
  const kids = await daily.notion(`blocks/${page.id}/children?page_size=100`, null, 'GET');
  const code = (kids.results || []).find((b) => b.type === 'code' && (b.code.caption || []).some((c) => c.plain_text === DATA_CAPTION));
  if (!code) return null;
  try { return JSON.parse(code.code.rich_text.map((t) => t.plain_text).join('')); } catch { return null; }
}

// ---------------------------------------------------------------- 모으기
async function guestbookCount(day) {
  try { return (await guestbook.list()).filter((e) => e.at && dayOf(e.at) === day).length; } catch { return null; }
}

async function collect(day) {
  const page = await daily.findDay(day);
  const server = page ? daily.fromPage(page) : null;
  let gaData = null, gaError = null;
  if (ga.analyticsOn()) { try { gaData = await ga.dayReport(day); } catch (e) { gaError = e.message; } }
  const prevDay = dayOf(Date.parse(`${day}T12:00:00+09:00`) - 86400_000);
  const prevPage = await daily.findDay(prevDay).catch(() => null);
  const prev = prevPage ? daily.fromPage(prevPage) : null;
  return { day, page, server, ga: gaData, gaError, guestbook: await guestbookCount(day), prev };
}

// ---------------------------------------------------------------- 저장
async function replaceBody(pageId, blocks) {
  const old = await daily.notion(`blocks/${pageId}/children?page_size=100`, null, 'GET');
  for (const b of old.results || []) await daily.notion(`blocks/${b.id}`, null, 'DELETE');
  for (let i = 0; i < blocks.length; i += 90) await daily.notion(`blocks/${pageId}/children`, { children: blocks.slice(i, i + 90) }, 'PATCH');
}

/** 그날 리포트를 만들거나 다시 집계한다. stage: '확정' | '재집계' */
export async function build(day, stage = '확정') {
  if (!daily.dailyOn()) return { skipped: 'notion off' };
  await daily.settle(); // 어제 서버 숫자를 노션에 다 쓴 뒤에 읽는다
  const r = await collect(day);
  // 재집계에서 GA 방문자가 먼저 찍어 둔 값보다 줄었으면 GA 숫자 · 본문을 덮어쓰지 않는다
  const kept = r.server?.ga && r.ga && r.ga.summary.users < r.server.ga.users;
  const stampPrev = r.server?.stamp || '';
  const stamp = `${stampPrev ? `${stampPrev} · ` : ''}${stampNow()} ${stage}${kept ? ' (GA 감소 → 이전 값 유지)' : ''}`;
  const properties = {
    '날짜': { title: [{ type: 'text', text: { content: day } }] },
    '집계 시각': { rich_text: [{ type: 'text', text: { content: stamp.slice(0, 1900) } }] },
  };
  if (r.guestbook != null) properties['방명록'] = { number: Math.max(r.guestbook, r.server?.guestbook ?? 0) };
  if (r.ga && !kept) {
    Object.assign(properties, {
      'GA 방문자': { number: r.ga.summary.users }, 'GA 신규': { number: r.ga.summary.newUsers }, 'GA 세션': { number: r.ga.summary.sessions },
      'GA 조회수': { number: r.ga.summary.views }, 'GA 이벤트': { number: r.ga.summary.events }, 'GA 1인당 머문 시간(분)': { number: r.ga.summary.engagementMin },
    });
  }
  let pageId = r.page?.id;
  if (pageId) await daily.notion(`pages/${pageId}`, { properties }, 'PATCH');
  else pageId = (await daily.notion('pages', { parent: { database_id: daily.DB }, properties })).id;
  if (!kept) {
    const sv = r.server && r.server.hasServer !== false ? { hasServer: true, visitors: r.server.visitors, joins: r.server.joins, peak: r.server.peak, stayMin: r.server.stayMin, lights: r.server.lights } : null;
    const snap = { v: 1, day, stamp, note: NOTES[day] || null, server: sv, ga: r.ga, gaError: r.gaError, guestbook: r.guestbook,
      prev: { visitors: r.prev?.hasServer ? r.prev.visitors : null, gaUsers: r.prev?.ga ? r.prev.ga.users : null } };
    await replaceBody(pageId, dataBlocks(snap));
  }
  console.log(`[report] ${day} ${stage}${kept ? ' (GA 감소, 이전 값 유지)' : ''}`);
  return { day, stage, kept, ga: !!r.ga, server: !!r.server };
}

// ---------------------------------------------------------------- 시계
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const k = kstNow(), mins = k.getUTCHours() * 60 + k.getUTCMinutes();
    const yesterday = dayOf(Date.now() - 86400_000);
    const page = await daily.findDay(yesterday);
    const stamp = page ? daily.fromPage(page).stamp : '';
    if (mins >= FIRST_AT.h * 60 + FIRST_AT.m && !stamp.includes('확정')) await build(yesterday, '확정');
    else if (mins >= SECOND_AT.h * 60 + SECOND_AT.m && stamp.includes('확정') && !stamp.includes('재집계')) await build(yesterday, '재집계');
  } catch (e) {
    console.warn('[report] 일일 리포트 실패:', e.message);
  } finally { busy = false; }
}

export function start() {
  if (!daily.dailyOn()) return;
  setTimeout(tick, 30_000).unref?.(); // 켜지자마자 어제 리포트가 없으면 만든다
  setInterval(tick, 60_000).unref?.();
}
