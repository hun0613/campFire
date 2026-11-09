// GA4 통계 조회 (관리실 📊 통계 탭용)
// - Google Analytics Data API 를 서비스 계정으로 읽는다. 외부 패키지 없이 JWT 를 직접 서명한다
// - 환경 변수
//     GA_PROPERTY_ID : GA4 속성 ID (숫자. G-로 시작하는 측정 ID 와는 다름)
//     GA_SA_KEY      : 서비스 계정 키 JSON (그대로 또는 base64)
// - 같은 조회는 잠시 저장해 두고 다시 쓴다 (기간별 5분, 실시간 1분) → API 한도 · 속도 보호
import crypto from 'node:crypto';

const PROPERTY = String(process.env.GA_PROPERTY_ID || '').trim();
const KEY = parseKey(process.env.GA_SA_KEY || '');
const API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}`;
const GAME_EVENTS = ['game_join', 'wood_chop', 'wood_store', 'fire_light', 'fire_sit', 'fire_stand', 'powder_use', 'guestbook_write', 'music_play', 'view_toggle', 'stargaze'];

function parseKey(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const j = JSON.parse(s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8'));
    return j.client_email && j.private_key ? j : null;
  } catch { return null; }
}

export const analyticsOn = () => !!(PROPERTY && KEY);
export const analyticsStatus = () => ({
  on: analyticsOn(),
  property: !!PROPERTY,
  key: !!KEY,
  email: KEY?.client_email || null, // GA4 에 뷰어로 추가할 주소 (비밀 아님)
});

// ---------------------------------------------------------------- 인증 (서비스 계정 → 액세스 토큰)
let token = null; // { value, exp }
const b64url = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function accessToken() {
  if (token && token.exp - 60_000 > Date.now()) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'RS256', typ: 'JWT' });
  const claim = b64url({
    iss: KEY.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(KEY.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`구글 인증 실패: ${j.error_description || j.error || r.status}`);
  token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return token.value;
}

async function call(method, body) {
  const r = await fetch(`${API}:${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || r.status;
    if (r.status === 403) throw new Error(`GA4 접근 권한이 없어요. GA4 속성 액세스 관리에 ${KEY.client_email} 을(를) 뷰어로 추가했는지 확인하세요. (${msg})`);
    throw new Error(`GA4 조회 실패: ${msg}`);
  }
  return j;
}

// ---------------------------------------------------------------- 보고서 → 다루기 쉬운 행 배열
function rows(report) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((r) => {
    const o = {};
    dims.forEach((d, i) => { o[d] = r.dimensionValues[i].value; });
    mets.forEach((m, i) => { o[m] = Number(r.metricValues[i].value); });
    return o;
  });
}
const inList = (field, values) => ({ filter: { fieldName: field, inListFilter: { values } } });
const RANGES = { today: 'today', '7d': '6daysAgo', '28d': '27daysAgo' };

const cache = new Map(); // key -> { at, data }
async function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ttl) return c.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** 기간 통계 (today | 7d | 28d) */
export function report(range = '7d') {
  const start = RANGES[range] || RANGES['7d'];
  return cached(`r:${range}`, 5 * 60_000, async () => {
    const dateRanges = [{ startDate: start, endDate: 'today' }];
    const trendRange = [{ startDate: '13daysAgo', endDate: 'today' }];
    const [a, b, c, h] = await Promise.all([
      call('batchRunReports', {
        requests: [
          // 0 요약
          { dateRanges, metrics: ['activeUsers', 'newUsers', 'sessions', 'userEngagementDuration', 'engagedSessions'].map((name) => ({ name })) },
          // 1 게임 행동
          { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: inList('eventName', GAME_EVENTS) },
          // 2 유입 경로별 방문
          { dateRanges, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 },
          // 3 유입 경로별 입장
          { dateRanges, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'eventCount' }], dimensionFilter: inList('eventName', ['game_join']), limit: 50 },
          // 4 캠페인
          { dateRanges, dimensions: [{ name: 'sessionCampaignName' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 },
        ],
      }),
      call('batchRunReports', {
        requests: [
          // 0 최근 14일 일별 방문자
          { dateRanges: trendRange, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }] },
          // 1 최근 14일 일별 입장
          { dateRanges: trendRange, dimensions: [{ name: 'date' }], metrics: [{ name: 'eventCount' }], dimensionFilter: inList('eventName', ['game_join']) },
          // 2 기기
          { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] },
          // 3 신규 · 재방문
          { dateRanges, dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'activeUsers' }] },
        ],
      }),
      // 맞춤 측정기준 · 측정항목 (등록 직후에는 실패할 수 있어 따로 조회)
      call('batchRunReports', {
        requests: [
          { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'customEvent:seconds' }], dimensionFilter: inList('eventName', ['fire_stand']) },
          { dateRanges, dimensions: [{ name: 'customEvent:view' }], metrics: [{ name: 'eventCount' }], dimensionFilter: inList('eventName', ['heartbeat']) },
        ],
      }).catch((e) => ({ error: e.message })),
      // 시간대 · 요일 (GA4 속성의 시간대 기준)
      call('batchRunReports', {
        requests: [
          { dateRanges, dimensions: [{ name: 'hour' }], metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }] },
          { dateRanges, dimensions: [{ name: 'hour' }], metrics: [{ name: 'eventCount' }], dimensionFilter: inList('eventName', ['game_join']) },
          { dateRanges, dimensions: [{ name: 'dayOfWeek' }], metrics: [{ name: 'activeUsers' }] },
        ],
      }).catch((e) => ({ error: e.message })),
    ]);

    // 0~23시를 빈 시간까지 채운다. 요일은 0=일요일
    let hours = null, weekdays = null, timeZone = null;
    if (!h.error) {
      timeZone = h.reports[0]?.metadata?.timeZone || null;
      const hu = new Map(rows(h.reports[0]).map((r) => [Number(r.hour), r]));
      const hj = new Map(rows(h.reports[1]).map((r) => [Number(r.hour), r.eventCount]));
      hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, users: hu.get(i)?.activeUsers || 0, engagementSec: Math.round(hu.get(i)?.userEngagementDuration || 0), joins: hj.get(i) || 0 }));
      const wd = new Map(rows(h.reports[2]).map((r) => [Number(r.dayOfWeek), r.activeUsers]));
      weekdays = Array.from({ length: 7 }, (_, i) => ({ day: i, users: wd.get(i) || 0 }));
    }

    const [sum = {}] = rows(a.reports[0]);
    const joinsBySrc = new Map(rows(a.reports[3]).map((r) => [`${r.sessionSource} / ${r.sessionMedium}`, r.eventCount]));
    const usersByDay = rows(b.reports[0]);
    const joinsByDay = new Map(rows(b.reports[1]).map((r) => [r.date, r.eventCount]));

    // 14일을 빈 날까지 채운다
    const trend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() + 9 * 3600_000 - i * 86400_000); // 한국 날짜
      const key = d.toISOString().slice(0, 10).replace(/-/g, '');
      const u = usersByDay.find((r) => r.date === key);
      trend.push({ date: key, users: u?.activeUsers || 0, newUsers: u?.newUsers || 0, joins: joinsByDay.get(key) || 0 });
    }

    let sitting = null, viewShare = null;
    if (!c.error) {
      const [st] = rows(c.reports[0]);
      if (st?.eventCount) sitting = { avgSeconds: Math.round(st['customEvent:seconds'] / st.eventCount), count: st.eventCount };
      const vs = rows(c.reports[1]);
      const total = vs.reduce((s, r) => s + r.eventCount, 0);
      if (total) viewShare = { fp: (vs.find((r) => r['customEvent:view'] === 'fp')?.eventCount || 0) / total, minutes: total };
    }

    return {
      range,
      updatedAt: Date.now(),
      summary: {
        users: sum.activeUsers || 0,
        newUsers: sum.newUsers || 0,
        sessions: sum.sessions || 0,
        avgEngagementSec: sum.activeUsers ? Math.round((sum.userEngagementDuration || 0) / sum.activeUsers) : 0,
        engagedRate: sum.sessions ? (sum.engagedSessions || 0) / sum.sessions : 0,
      },
      events: GAME_EVENTS.map((name) => {
        const r = rows(a.reports[1]).find((x) => x.eventName === name);
        return { name, count: r?.eventCount || 0, users: r?.totalUsers || 0 };
      }),
      sources: rows(a.reports[2]).map((r) => {
        const key = `${r.sessionSource} / ${r.sessionMedium}`;
        return { source: key, sessions: r.sessions, users: r.activeUsers, joins: joinsBySrc.get(key) || 0 };
      }),
      campaigns: rows(a.reports[4]).filter((r) => r.sessionCampaignName && r.sessionCampaignName !== '(not set)')
        .map((r) => ({ name: r.sessionCampaignName, sessions: r.sessions, users: r.activeUsers })),
      trend,
      devices: rows(b.reports[2]).map((r) => ({ name: r.deviceCategory, users: r.activeUsers })),
      newVsReturning: rows(b.reports[3]).filter((r) => r.newVsReturning).map((r) => ({ name: r.newVsReturning, users: r.activeUsers })),
      sitting,
      viewShare,
      hours,
      weekdays,
      timeZone,
      hourError: h.error || null,
      customError: c.error || null,
    };
  });
}

/** 실시간 (최근 30분) */
export function realtime() {
  return cached('rt', 60_000, async () => {
    const [tot, dev, ev] = await Promise.all([
      call('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }),
      call('runRealtimeReport', { dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] }),
      call('runRealtimeReport', { dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: inList('eventName', GAME_EVENTS) }),
    ]);
    return {
      updatedAt: Date.now(),
      users: rows(tot)[0]?.activeUsers || 0,
      devices: rows(dev).map((r) => ({ name: r.deviceCategory, users: r.activeUsers })),
      events: rows(ev).map((r) => ({ name: r.eventName, count: r.eventCount })).sort((x, y) => y.count - x.count),
    };
  });
}
