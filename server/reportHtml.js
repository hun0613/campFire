// 일일 리포트 HTML: dailyReport.js 가 노션에 저장해 둔 그날 데이터(스냅숏)로 한 장짜리 HTML 문서를 만든다.
// 외부 파일 없이 혼자 열리는 문서(글꼴 · CSS 포함)라 「HTML 저장」으로 내려받아도 그대로 보인다.
const LABEL = {
  game_join: '🏕️ 입장', wood_chop: '🪓 장작 패기', wood_store: '📦 장작 창고', fire_light: '🔥 불 붙이기', fire_sit: '🪵 모닥불 앉기', fire_stand: '🚶 일어나기',
  powder_use: '✨ 마법 가루', guestbook_write: '📖 방명록', music_play: '🎶 노래 틀기', view_toggle: '👁️ 시점 전환', stargaze: '🌌 하늘 보기', board_open: '📌 게시판 열기', quest_done: '💜 루미의 부탁', share: '💌 친구 초대',
  shop_open: '✨ 루미 공방 열기', powder_buy: '🪙 가루 사기', coin_share_bonus: '🪙 공유 보너스', tent_enter: '🏕️ 텐트 들어가기', tent_sit: '🛋️ 텐트 소파', block: '🚫 차단', fire_feed: '🪵 장작 더 넣기',
};
const DEVICE = { mobile: '모바일', desktop: 'PC', tablet: '태블릿' };
const WEEK = '일월화수목금토';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dayLabel = (day) => { const [y, m, d] = day.split('-').map(Number); return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
function delta(a, b) {
  if (a == null || b == null) return '';
  const d = a - b;
  if (!d) return '<span class="d">전날과 같음</span>';
  return `<span class="d ${d > 0 ? 'up' : 'down'}">전날 대비 ${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>`;
}

// 가로 막대 목록 (한 가지 색, 값은 막대 옆에 직접)
function bars(items, { unit = '', sub } = {}) {
  if (!items.length) return '<p class="empty">기록이 없어요.</p>';
  const max = Math.max(...items.map((x) => x.value), 1);
  return `<div class="bars">${items.map((x) => `
    <div class="bar-row"><span class="bl">${esc(x.label)}</span><span class="bt"><i style="width:${Math.max(2, (x.value / max) * 100).toFixed(1)}%"></i></span><span class="bv">${fmt(x.value)}${unit}${sub ? `<small>${esc(sub(x))}</small>` : ''}</span></div>`).join('')}</div>`;
}

// 0~23시 세로 막대 (SVG, 한 가지 색, 가장 많은 시간만 진하게 + 값 표기)
function hoursChart(hours) {
  const by = new Map(hours.map((h) => [h.hour, h.users]));
  const vals = Array.from({ length: 24 }, (_, i) => by.get(i) || 0);
  const max = Math.max(...vals, 1), W = 720, H = 150, bw = W / 24;
  const top = vals.indexOf(Math.max(...vals));
  return `<svg viewBox="0 0 ${W} ${H + 24}" class="hours" role="img" aria-label="시간대별 방문자">
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#e3d9cc"/>
    ${vals.map((v, i) => { const h = (v / max) * (H - 22); const x = i * bw + 3; return v ? `<rect x="${x}" y="${H - h}" width="${bw - 6}" height="${h}" rx="3" fill="${i === top ? '#c9620f' : '#e8b27e'}"/>${i === top || v === max ? `<text x="${x + (bw - 6) / 2}" y="${H - h - 5}" class="hv">${v}</text>` : ''}` : ''; }).join('')}
    ${[0, 6, 12, 18, 23].map((i) => `<text x="${i * bw + bw / 2}" y="${H + 17}" class="hx">${i}시</text>`).join('')}
  </svg>`;
}

/** 스냅숏 → 완성된 HTML 문서 문자열 */
export function renderReport(snap) {
  // GA4가 그날 아무것도 돌려주지 않았으면(소실 등) 0을 늘어놓지 않고 「기록 없음」으로 보여 준다
  const g = snap.ga && (snap.ga.summary?.users || snap.ga.summary?.events) ? snap.ga : null;
  const s = snap.server, p = snap.prev || {};
  const hasServer = s && s.hasServer !== false && (s.joins || s.visitors);
  const kpi = (v, label, extra = '') => `<div class="kpi"><b>${v}</b><span>${label}</span>${extra}</div>`;
  const serverKpis = hasServer ? [
    kpi(`${fmt(s.visitors)}명`, '방문자 (서버)', delta(s.visitors, p.visitors)),
    kpi(`${fmt(s.joins)}번`, '입장'),
    kpi(`${fmt(s.peak)}명`, '최대 동시 접속'),
    kpi(`${s.joins ? Math.round(s.stayMin / s.joins) : 0}분`, '1회 평균 머문 시간'),
    kpi(`${fmt(s.lights)}번`, '불 붙이기'),
  ].join('') : '<p class="empty">서버 기록이 없는 날이에요 (v1.16.3 이전이거나 입장이 없었어요).</p>';
  const gaKpis = g ? [
    kpi(`${fmt(g.summary.users)}명`, `방문자 (신규 ${fmt(g.summary.newUsers)})`, delta(g.summary.users, p.gaUsers)),
    kpi(fmt(g.summary.sessions), '세션'),
    kpi(fmt(g.summary.views), '조회수'),
    kpi(`${g.summary.engagementMin}분`, '1인당 머문 시간'),
    kpi(`${Math.round((g.summary.engagedRate || 0) * 100)}%`, '몰입 세션'),
  ].join('') : `<p class="empty">GA4에 이날 기록이 없어요${snap.gaError ? ` (조회 실패: ${esc(snap.gaError)})` : ''}.</p>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>불멍 캠핑장 일일 리포트 ${esc(snap.day)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  :root { --ink:#1f1a17; --body:#3d3530; --sub:#8a8079; --accent:#e0761c; --accent-d:#c9620f; --tint:#fbf4ea; --soft:#fde3c8; --line:#ece4da; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; font-family: Pretendard, sans-serif; color: var(--ink); word-break: keep-all; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 36px 20px 60px; }
  .top { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .eyebrow { font-size: 14px; font-weight: 800; color: var(--accent); }
  h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; margin: 6px 0 4px; }
  h1 em { font-style: normal; color: var(--accent); }
  .meta { font-size: 13px; color: var(--sub); }
  .save { margin-left: auto; border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 14px; font: 600 13px Pretendard, sans-serif; cursor: pointer; }
  .note { margin: 18px 0 0; background: #fff4d6; border: 1px solid #f1d58a; border-radius: 14px; padding: 12px 16px; font-size: 14px; line-height: 1.6; color: #6b4e00; }
  .card { background: var(--tint); border-radius: 22px; padding: 22px 24px; margin-top: 18px; }
  .pill { display: inline-block; background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; padding: 5px 11px; border-radius: 7px; margin-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .kpi { background: #fff; border-radius: 14px; padding: 14px 12px; }
  .kpi b { display: block; font-size: 26px; font-weight: 800; color: var(--accent-d); letter-spacing: -0.02em; }
  .kpi span { display: block; font-size: 12.5px; color: var(--sub); margin-top: 2px; }
  .d { display: inline-block; margin-top: 6px; font-size: 11.5px; font-weight: 700; color: var(--sub); }
  .d.up { color: #2f7d4f; } .d.down { color: #b4501f; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .box { background: #fff; border-radius: 16px; padding: 16px 18px; }
  .box h3 { margin: 0 0 10px; font-size: 15px; }
  .bars { display: grid; gap: 7px; }
  .bar-row { display: grid; grid-template-columns: 130px 1fr 74px; gap: 10px; align-items: center; font-size: 13px; }
  .bl { color: var(--body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bt { background: #f6efe5; border-radius: 6px; height: 12px; overflow: hidden; }
  .bt i { display: block; height: 100%; background: var(--accent); border-radius: 6px; }
  .bv { text-align: right; font-weight: 700; color: var(--ink); }
  .bv small { display: block; font-size: 11px; font-weight: 400; color: var(--sub); }
  .hours { width: 100%; height: auto; display: block; }
  .hours .hv { font: 700 12px Pretendard, sans-serif; fill: #3d3530; text-anchor: middle; }
  .hours .hx { font: 11px Pretendard, sans-serif; fill: #8a8079; text-anchor: middle; }
  .empty { color: var(--sub); font-size: 13.5px; margin: 0; }
  .foot { font-size: 12px; color: #a39b93; line-height: 1.6; margin-top: 22px; }
  @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .bar-row { grid-template-columns: 100px 1fr 64px; } }
  @media print { .save { display: none; } }
</style></head>
<body><div class="wrap">
  <div class="top"><span class="eyebrow">Daily Report</span><span class="meta">불멍 캠핑장 · ${esc(snap.stamp || '')}</span><button class="save" onclick="(function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['<!doctype html>\\n'+document.documentElement.outerHTML],{type:'text/html'}));a.download='불멍캠핑장_리포트_${esc(snap.day)}.html';a.click();})()">HTML 저장</button></div>
  <h1>${esc(dayLabel(snap.day))} <em>하루 리포트</em></h1>
  ${snap.note ? `<div class="note">⚠️ ${esc(snap.note)}</div>` : ''}

  <div class="card"><span class="pill">서버 기록</span><div class="kpis">${serverKpis}</div></div>
  <div class="card"><span class="pill">GA4</span><div class="kpis">${gaKpis}${snap.guestbook != null ? kpi(`${fmt(snap.guestbook)}개`, '방명록') : ''}</div></div>

  ${g ? `
  <div class="card"><span class="pill">무엇을 했나요</span>
    <div class="grid">
      <div class="box"><h3>게임 행동</h3>${bars(g.events.filter((e) => e.count).map((e) => ({ label: LABEL[e.name] || e.name, value: e.count, users: e.users })), { unit: '번', sub: (x) => `${fmt(x.users)}명` })}</div>
      <div class="box"><h3>루미의 부탁 (해낸 사람)</h3>${bars(g.quests.map((q) => ({ label: q.name, value: q.users })), { unit: '명' })}</div>
    </div>
  </div>
  <div class="card"><span class="pill">어디서, 언제 왔나요</span>
    <div class="grid">
      <div class="box"><h3>유입 경로 (세션)</h3>${bars(g.sources.map((x) => ({ label: x.source, value: x.sessions, users: x.users })), { sub: (x) => `${fmt(x.users)}명` })}</div>
      <div class="box"><h3>기기</h3>${bars(g.devices.map((d) => ({ label: DEVICE[d.name] || d.name, value: d.users })), { unit: '명' })}</div>
    </div>
    <div class="box" style="margin-top:18px"><h3>시간대별 방문자</h3>${hoursChart(g.hours)}</div>
  </div>` : ''}

  <p class="foot">서버 숫자는 게임 서버가 직접 센 값이라 광고 차단 사용자도 포함돼요. GA4 숫자는 매일 00:05에 확정하고 12:00에 한 번 더 집계하는데, 숫자가 줄면 먼저 찍어 둔 값을 유지해요.</p>
</div></body></html>`;
}
