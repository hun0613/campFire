// 일일 리포트: 매일 00:05(한국 시간)에 전날 숫자를 확정해 노션 「일별 이용 기록 · 일일 리포트」의 그날 줄에 저장하고,
// 그 줄(페이지) 본문에 하루 리포트를 쓴다. 12:00에 GA4를 한 번 더 집계하되 숫자가 줄었으면 덮어쓰지 않는다
// (GA4가 나중에 하루치를 잃어도 — 2026-11-12처럼 — 먼저 찍어 둔 값이 남게).
// - 서버 숫자: daily.js 가 센 방문자 · 입장 · 최대 동시 접속 · 머문 시간 · 불 붙이기
// - GA4 숫자: 방문자 · 신규 · 세션 · 조회수 · 이벤트 · 1인당 머문 시간, 게임 행동 · 유입 경로 · 기기 · 시간대 · 루미의 부탁
// - 방명록: 그날 남긴 글 수
// 서버가 00시 배포 · 재시작으로 꺼져 있었어도, 켜지면 어제 리포트가 없을 때 바로 만든다.
import * as daily from './daily.js';
import * as ga from './analytics.js';
import * as guestbook from './guestbook.js';

const LABEL = {
  game_join: '🏕️ 입장', wood_chop: '🪓 장작 패기', wood_store: '📦 장작 창고', fire_light: '🔥 불 붙이기', fire_sit: '🪵 모닥불 앉기', fire_stand: '🚶 일어나기',
  powder_use: '✨ 마법 가루', guestbook_write: '📖 방명록', music_play: '🎶 노래 틀기', view_toggle: '👁️ 시점 전환', stargaze: '🌌 하늘 보기', board_open: '📌 게시판 열기', quest_done: '💜 루미의 부탁', share: '💌 친구 초대',
  shop_open: '✨ 루미 공방 열기', powder_buy: '🪙 가루 사기', coin_share_bonus: '🪙 공유 보너스', tent_enter: '🏕️ 텐트 들어가기', tent_sit: '🛋️ 텐트 소파', block: '🚫 차단', fire_feed: '🪵 장작 더 넣기',
};
const DEVICE = { mobile: '모바일', desktop: 'PC', tablet: '태블릿' };
const WEEK = '일월화수목금토';
const FIRST_AT = { h: 0, m: 5 };  // 확정
const SECOND_AT = { h: 12, m: 0 }; // 재집계

const kstNow = () => new Date(Date.now() + 9 * 3600_000); // getUTC* 로 한국 시각을 읽는다
const dayOf = (t) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
const label = (day) => { const [y, m, d] = day.split('-').map(Number); return `${m}/${d} (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
const stampNow = () => { const k = kstNow(); return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`; };
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const diff = (a, b) => (b == null || a == null ? '' : a === b ? ' (전날과 같음)' : ` (전날 대비 ${a > b ? '+' : ''}${fmt(a - b)})`);

// ---------------------------------------------------------------- 노션 블록 만들기
const txt = (content, bold = false) => ({ type: 'text', text: { content: String(content) }, annotations: bold ? { bold: true } : undefined });
const h2 = (t) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: [txt(t)] } });
const para = (...parts) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: parts.map((p) => (typeof p === 'string' ? txt(p) : p)) } });
const bullet = (...parts) => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: parts.map((p) => (typeof p === 'string' ? txt(p) : p)) } });
const callout = (emoji, t) => ({ object: 'block', type: 'callout', callout: { icon: { type: 'emoji', emoji }, rich_text: [txt(t)] } });
const table = (head, body) => ({
  object: 'block', type: 'table',
  table: {
    table_width: head.length, has_column_header: true, has_row_header: false,
    children: [head, ...body].map((cells) => ({ type: 'table_row', table_row: { cells: cells.map((c) => [txt(c)]) } })),
  },
});

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

function buildBlocks(r, stamp) {
  const s = r.server, g = r.ga, p = r.prev;
  const out = [callout('🔥', `${label(r.day)} 불멍 캠핑장 하루 리포트 · ${stamp}`)];

  out.push(h2('한눈에 보기'));
  if (s && (s.joins || s.visitors)) {
    out.push(bullet(txt('방문자 ', true), `${fmt(s.visitors)}명${diff(s.visitors, p?.visitors)} · 입장 ${fmt(s.joins)}번 · 최대 동시 접속 ${fmt(s.peak)}명`));
    out.push(bullet(txt('머문 시간 ', true), `1회 평균 ${s.joins ? Math.round(s.stayMin / s.joins) : 0}분 (합계 ${fmt(s.stayMin)}분) · 불 붙이기 ${fmt(s.lights)}번`));
  } else out.push(bullet('서버 기록: 그날 입장이 없거나, 서버 기록을 시작하기 전(v1.16.3 이전)이에요.'));
  if (g) {
    out.push(bullet(txt('GA4 ', true), `방문자 ${fmt(g.summary.users)}명 (신규 ${fmt(g.summary.newUsers)})${diff(g.summary.users, p?.ga?.users)} · 세션 ${fmt(g.summary.sessions)} · 조회수 ${fmt(g.summary.views)} · 이벤트 ${fmt(g.summary.events)}`));
    out.push(bullet(txt('참여 ', true), `1인당 머문 시간 ${g.summary.engagementMin}분 · 몰입 세션 ${Math.round(g.summary.engagedRate * 100)}%`));
  } else out.push(bullet(`GA4: ${r.gaError ? `조회 실패 (${r.gaError})` : '연결 안 됨'}`));
  if (r.guestbook != null) out.push(bullet(txt('방명록 ', true), `${fmt(r.guestbook)}개`));

  if (g?.events?.length) {
    out.push(h2('게임 행동'));
    out.push(table(['행동', '횟수', '사람'], g.events.filter((e) => e.count).map((e) => [LABEL[e.name] || e.name, fmt(e.count), `${fmt(e.users)}명`])));
  }
  if (g?.quests?.length) {
    out.push(h2('루미의 부탁'));
    out.push(table(['부탁', '해낸 사람'], g.quests.map((q) => [q.name, `${fmt(q.users)}명`])));
  }
  if (g?.sources?.length) {
    out.push(h2('유입 경로'));
    out.push(table(['경로', '세션', '사람'], g.sources.map((x) => [x.source, fmt(x.sessions), `${fmt(x.users)}명`])));
  }
  if (g) {
    out.push(h2('기기 · 시간대'));
    if (g.devices.length) out.push(bullet(g.devices.map((d) => `${DEVICE[d.name] || d.name} ${fmt(d.users)}명`).join(' · ')));
    const top = g.hours.filter((h) => h.users).slice(0, 3);
    if (top.length) out.push(bullet(`많이 온 시간: ${top.map((h) => `${h.hour}시 (${fmt(h.users)}명)`).join(' · ')}`));
  }
  out.push(para(txt('서버 숫자는 게임 서버가 직접 센 값이라 광고 차단 사용자도 포함돼요. GA4 숫자는 자정 직후 집계라 늦게 반영되는 기록이 빠질 수 있어 12:00에 한 번 더 집계하고, 숫자가 줄면 먼저 찍어 둔 값을 유지해요.')));
  return out;
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
  if (!kept) await replaceBody(pageId, buildBlocks(r, stamp));
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
