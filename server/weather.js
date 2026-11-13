// 캠핑장 테마: 서울 날씨(Open-Meteo, 키 없는 무료 API)를 15분마다 확인해서 비 → 우중캠핑장, 눈 → 설산캠핑장.
// 관리자는 「자동」 대신 테마를 직접 골라 이벤트처럼 바꿔 둘 수 있다 (서버가 다시 켜지면 THEME_MODE 환경 변수 또는 자동으로).
// 날씨 API에는 위치(서울 좌표)만 보내고, 이용자 정보는 보내지 않는다.
import { THEMES, THEME_IDS, weatherTheme, weatherLabel } from '../shared/themes.js';

const PLACE = { name: '서울', lat: 37.5665, lon: 126.978 };
const EVERY = 15 * 60_000;
const URL_ = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=weather_code,temperature_2m,precipitation&timezone=Asia%2FSeoul`;

let weather = { code: null, label: '알 수 없음', temp: null, theme: 'clear', at: 0, error: null };
let mode = THEME_IDS.includes(process.env.THEME_MODE) ? process.env.THEME_MODE : 'auto';
let onChange = () => {};
let last = null;

export const currentTheme = () => (mode === 'auto' ? weather.theme : mode);

function notify() {
  const t = currentTheme();
  if (t !== last) { last = t; onChange(t); }
}

async function check() {
  try {
    const r = await fetch(URL_, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const code = j.current?.weather_code ?? null;
    weather = { code, label: weatherLabel(code), temp: j.current?.temperature_2m ?? null, theme: weatherTheme(code), at: Date.now(), error: null };
  } catch (e) {
    weather = { ...weather, error: e.message, at: Date.now() }; // 실패하면 지난 날씨를 그대로 쓴다
  }
  notify();
}

/** 날씨 확인을 시작한다. cb(theme) 는 테마가 바뀔 때마다 */
export function start(cb) {
  onChange = cb;
  last = currentTheme();
  check();
  setInterval(check, EVERY).unref?.();
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
