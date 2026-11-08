// 이용 분석: Google Tag Manager(GTM) → GA4
// - GTM 컨테이너 ID는 빌드 환경 변수 VITE_GTM_ID 로 받는다. 없으면(로컬 개발 등) GTM을 불러오지 않는다
// - 게임 이벤트는 dataLayer 로만 보낸다. 어떤 이벤트를 GA4로 보낼지는 GTM 화면에서 정한다
// - 유입 경로(UTM)는 GA4가 주소의 utm_* 값을 자동으로 읽는다
const GTM_ID = import.meta.env.VITE_GTM_ID || '';
const DEBUG = new URLSearchParams(location.search).has('debug_analytics');
// 로컬 개발 화면은 기록하지 않는다 (주소에 ?debug_analytics 를 붙이면 확인용으로 켬)
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(location.hostname);

window.dataLayer = window.dataLayer || [];

export function initAnalytics() {
  if (!GTM_ID || (LOCAL && !DEBUG)) return;
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(s);
}

/**
 * 게임 이벤트 기록
 * @param {string} event 이벤트 이름 (예: 'fire_light')
 * @param {Record<string, string|number|boolean>} [params]
 */
export function track(event, params = {}) {
  window.dataLayer.push({ event, ...params });
  if (DEBUG) console.log('[analytics]', event, params);
}

/** 화면이 보이는 동안 1분마다 heartbeat 를 보낸다 (실제로 머문 시간 계산용) */
export function startHeartbeat(getParams) {
  let minutes = 0;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    minutes += 1;
    track('heartbeat', { minutes, ...getParams() });
  }, 60_000);
}
