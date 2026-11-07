// 유튜브 곡 검색 (YouTube Data API v3)
// - 하루 무료 한도(10,000 유닛) 안에서만 쓴다. 검색 1번 = 100유닛, 영상 정보 조회 = 1유닛
// - 한도는 미국 태평양 시간 자정(한국 오후 4~5시)에 초기화된다
// - 같은 검색어는 하루 동안 저장해 둔 결과를 다시 쓴다 (한도 안 씀)
// - API 키가 없거나 한도를 다 쓰면 검색만 막히고, 최근 곡/링크 붙여넣기는 계속 된다
const KEY = process.env.YT_API_KEY || '';
const DAILY_UNITS = Number(process.env.YT_DAILY_UNITS) || 9500; // 10,000 중 여유분을 남긴다
const SEARCH_COST = 100;
const PER_PLAYER_DAILY = 15;
const CACHE_TTL = 24 * 3600 * 1000;

export const hasKey = () => !!KEY;

// ---------------------------------------------------------------- 한도
const ptDay = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(t);
/** 다음 태평양 시간 자정 (ms) */
export function nextReset(now = Date.now()) {
  const day = ptDay(now);
  let t = now + 60_000;
  // 1시간씩 넘겨서 날짜가 바뀌는 시점을 찾고 분 단위로 다듬는다
  while (ptDay(t) === day) t += 3600_000;
  t -= 3600_000;
  while (ptDay(t) === day) t += 60_000;
  return t - (t % 60_000);
}
const quota = { day: ptDay(), used: 0, exhausted: false };
const perPlayer = new Map(); // pid|name -> count
function rollDay() {
  const d = ptDay();
  if (quota.day !== d) { quota.day = d; quota.used = 0; quota.exhausted = false; perPlayer.clear(); }
}
/** 서버가 재시작돼도 오늘 쓴 양을 잃지 않도록 내보내고/되돌려 받는다 (서명은 index.js 에서) */
export function quotaState() { rollDay(); return { day: quota.day, used: quota.used, exhausted: quota.exhausted }; }
export function restoreQuota(s) {
  rollDay();
  if (!s || s.day !== quota.day) return false;
  const used = Math.min(DAILY_UNITS + 1000, Math.max(0, Number(s.used) || 0));
  let changed = false;
  if (used > quota.used) { quota.used = used; changed = true; }
  if (s.exhausted && !quota.exhausted) { quota.exhausted = true; changed = true; }
  return changed;
}
export function searchesLeft() {
  rollDay();
  if (!KEY || quota.exhausted) return 0;
  return Math.max(0, Math.floor((DAILY_UNITS - quota.used) / SEARCH_COST));
}

// ---------------------------------------------------------------- 캐시 / 곡 정보
const cache = new Map(); // 검색어 -> { at, items }
export const known = new Map(); // vid -> { vid, title, channel, thumb, duration }
const recent = []; // 최근 재생한 곡 (한도 안 쓰고 다시 틀 수 있게)
export function addRecent(info) {
  const i = recent.findIndex((r) => r.vid === info.vid);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(info);
  recent.length = Math.min(recent.length, 12);
}
export const recentList = () => recent.slice();

function iso8601(d) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || '');
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function api(path, params) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY })) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = j?.error?.errors?.[0]?.reason || '';
    const err = new Error(reason || `http ${r.status}`);
    err.reason = reason;
    throw err;
  }
  return j;
}

/** 영상 정보(길이·재생 가능 여부) 조회 — 1유닛 */
export async function videoInfo(ids) {
  if (!KEY || !ids.length) return [];
  rollDay();
  if (quota.exhausted || quota.used + 1 > DAILY_UNITS + 400) return [];
  quota.used += 1;
  const j = await api('videos', { part: 'snippet,contentDetails,status', id: ids.join(','), maxResults: 50 });
  return (j.items || []).map((v) => {
    const info = {
      vid: v.id,
      title: decode(v.snippet?.title).slice(0, 90),
      channel: decode(v.snippet?.channelTitle).slice(0, 40),
      thumb: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
      duration: iso8601(v.contentDetails?.duration),
      embeddable: v.status?.embeddable !== false,
      live: v.snippet?.liveBroadcastContent === 'live',
    };
    known.set(info.vid, info);
    return info;
  });
}

/**
 * 곡 검색
 * @returns {{ ok: true, items, left, cached } | { ok: false, text, exhausted?, resetAt? }}
 */
export async function search(q, who) {
  rollDay();
  const query = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!query) return { ok: false, text: '검색어를 입력해 주세요' };
  const ck = query.toLowerCase();
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_TTL) return { ok: true, items: hit.items, left: searchesLeft(), cached: true };

  if (!KEY) return { ok: false, text: '아직 곡 검색이 준비되지 않았어요. 최근 곡을 고르거나 유튜브 링크를 붙여 넣어 주세요' };
  if (searchesLeft() <= 0) {
    return { ok: false, exhausted: true, resetAt: nextReset(), text: '오늘 검색할 수 있는 횟수를 다 썼어요' };
  }
  const n = perPlayer.get(who) || 0;
  if (n >= PER_PLAYER_DAILY) return { ok: false, text: `검색은 한 사람당 하루 ${PER_PLAYER_DAILY}번까지예요. 최근 곡에서 골라 주세요` };

  quota.used += SEARCH_COST;
  perPlayer.set(who, n + 1);
  try {
    const j = await api('search', {
      part: 'snippet', type: 'video', q: query, maxResults: 10,
      videoCategoryId: '10', videoEmbeddable: 'true', videoSyndicated: 'true',
      regionCode: 'KR', relevanceLanguage: 'ko', safeSearch: 'moderate',
    });
    const ids = (j.items || []).map((it) => it.id?.videoId).filter(Boolean);
    const infos = await videoInfo(ids).catch(() => []);
    const byId = new Map(infos.map((i) => [i.vid, i]));
    const items = ids.map((id) => byId.get(id)).filter((i) => i && i.embeddable && !i.live && i.duration > 0 && i.duration <= 20 * 60);
    cache.set(ck, { at: Date.now(), items });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return { ok: true, items, left: searchesLeft(), cached: false };
  } catch (e) {
    if (e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded') {
      quota.exhausted = true;
      return { ok: false, exhausted: true, resetAt: nextReset(), text: '오늘 검색할 수 있는 횟수를 다 썼어요' };
    }
    perPlayer.set(who, n); // 실패한 검색은 개인 횟수에서 빼 준다 (유튜브 한도는 보수적으로 그대로 센다)
    console.error('[youtube search]', e.message);
    return { ok: false, text: '검색이 잠깐 안 돼요. 잠시 후 다시 시도해 주세요' };
  }
}
