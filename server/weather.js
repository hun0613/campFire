// 캠핑장 테마: 서울 날씨를 15분마다 확인해서 비 → 우중캠핑장, 눈 → 설산캠핑장.
// 1순위 Open-Meteo, 막히면(Render 무료 서버는 IP를 여럿이 같이 써서 429가 날 때가 있다) 2순위 MET Norway(노르웨이 기상청).
// 둘 다 키 없는 무료 API이고, 위치(서울 좌표)만 보낸다. 이용자 정보는 보내지 않는다.
// 관리자는 「자동」 대신 테마를 직접 골라 이벤트처럼 바꿔 둘 수 있다 (서버가 다시 켜지면 THEME_MODE 환경 변수 또는 자동으로).
import { THEMES, THEME_IDS, weatherTheme, weatherLabel } from '../shared/themes.js';

const PLACE = { name: '서울', lat: 37.5665, lon: 126.978 };
const EVERY = 15 * 60_000;
const RETRY = 2 * 60_000; // 둘 다 실패하면 조금 뒤 다시
const OPEN_METEO = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=weather_code,temperature_2m,precipitation&timezone=Asia%2FSeoul`;
const MET_NO = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${PLACE.lat}&lon=${PLACE.lon}`;
const UA = 'campfire-game https://campfire-game.onrender.com'; // MET Norway는 서비스 이름을 밝히라고 한다

let weather = { code: null, label: '알 수 없음', temp: null, theme: 'clear', at: 0, error: null, source: null };
let mode = THEME_IDS.includes(process.env.THEME_MODE) ? process.env.THEME_MODE : 'auto';
let onChange = () => {};
let last = null;
let timer = null;

export const currentTheme = () => (mode === 'auto' ? weather.theme : mode);

function notify() {
  const t = currentTheme();
  if (t !== last) { last = t; onChange(t); }
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fromOpenMeteo() {
  const j = await getJson(OPEN_METEO);
  return { code: j.current?.weather_code ?? null, temp: j.current?.temperature_2m ?? null };
}

/** MET Norway 날씨 기호(symbol_code) → WMO 코드 (테마 · 설명을 같은 표로 쓰려고) */
function symbolToWmo(s) {
  if (!s) return null;
  if (s.includes('thunder')) return 95;
  if (s.includes('sleet')) return 66;
  if (s.includes('snow')) return s.includes('showers') ? 85 : 73;
  if (s.includes('rain')) return s.includes('showers') ? 80 : 63;
  if (s.startsWith('fog')) return 45;
  if (s.startsWith('cloudy')) return 3;
  if (s.startsWith('partlycloudy') || s.startsWith('fair')) return 2;
  if (s.startsWith('clearsky')) return 0;
  return null;
}

async function fromMetNo() {
  const j = await getJson(MET_NO, { 'User-Agent': UA });
  const now = j.properties?.timeseries?.[0]?.data;
  return { code: symbolToWmo(now?.next_1_hours?.summary?.symbol_code), temp: now?.instant?.details?.air_temperature ?? null };
}

async function check() {
  const errors = [];
  let ok = false;
  for (const [source, get] of [['Open-Meteo', fromOpenMeteo], ['MET Norway', fromMetNo]]) {
    try {
      const { code, temp } = await get();
      weather = { code, label: weatherLabel(code), temp, theme: weatherTheme(code), at: Date.now(), error: null, source };
      ok = true;
      break;
    } catch (e) {
      errors.push(`${source} ${e.message}`);
    }
  }
  if (!ok) weather = { ...weather, error: errors.join(' · '), at: Date.now() }; // 둘 다 실패하면 지난 날씨를 그대로 쓴다
  notify();
  clearTimeout(timer);
  timer = setTimeout(check, ok ? EVERY : RETRY);
  timer.unref?.();
}

/** 날씨 확인을 시작한다. cb(theme) 는 테마가 바뀔 때마다 */
export function start(cb) {
  onChange = cb;
  last = currentTheme();
  check();
}

/** 관리 화면: 'auto' 또는 테마 id */
export function setMode(m) {
  if (m !== 'auto' && !THEME_IDS.includes(m)) return false;
  mode = m;
  notify();
  return true;
}

export function status() {
  return {
    mode, theme: currentTheme(), place: PLACE.name, weather,
    themes: THEME_IDS.map((id) => ({ id, name: THEMES[id].name, icon: THEMES[id].icon, desc: THEMES[id].desc })),
  };
}
