// 캠핑장 테마 템플릿 (서버 · 클라이언트 공통)
// 테마 하나 = 하늘 · 안개 · 빛 · 내리는 것 · 땅 · 옷 · 천막 · 소리 설정 묶음.
// 서버는 「자동(서울 날씨)」 또는 관리자가 고른 테마를 모두에게 알리고, 클라이언트는 이 템플릿대로 캠핑장을 바꾼다.
// 새 이벤트 테마(예: 크리스마스)는 여기에 항목을 하나 더 만들면 관리자 화면에 바로 나온다.
export const THEMES = {
  clear: {
    id: 'clear', name: '불멍 캠핑장', icon: '🌙', desc: '맑은 밤. 별과 달, 풀벌레 소리',
    sky: { top: '#040720', mid: '#131a48', bottom: '#3b2f63', stars: 1, moon: 1, milky: 1 },
    fog: { color: '#1a1c44', near: 40, far: 150 },
    light: { hemi: 1, ambient: 1, moon: 1 },
    precip: null,        // 'rain' | 'snow' | null
    ground: 'grass',     // 'grass' | 'wet' | 'snow'
    outfit: null,        // 'raincoat' | 'puffer' | null
    tarps: false,        // 바깥 모닥불 위 천막
    fireflies: true,
    ambience: 'crickets', // 'crickets' | 'rain' | 'snow'
    step: null,          // 걸을 때 발소리: 'crunch'(눈) | 'splash'(비) | null
    toast: null,
  },
  rain: {
    id: 'rain', name: '우중캠핑장', icon: '☔', desc: '비 오는 밤. 모닥불엔 천막, 모두 우비 차림, 빗소리 · 천막 위 토독토독',
    sky: { top: '#141a2c', mid: '#28324a', bottom: '#43506a', stars: 0, moon: 0, milky: 0 },
    fog: { color: '#2a3348', near: 32, far: 135 },
    light: { hemi: 1.3, ambient: 1.6, moon: 0.7 }, // 구름 낀 밤이지만 어둡지 않게
    precip: 'rain',
    ground: 'wet',
    outfit: 'raincoat',
    tarps: true,
    fireflies: false,
    ambience: 'rain',
    step: 'splash',
    toast: '☔ 비가 와서 오늘은 우중캠핑장이에요 · 모닥불엔 천막을 쳐 뒀어요',
  },
  snow: {
    id: 'snow', name: '설산캠핑장', icon: '❄️', desc: '눈 내리는 밤. 하얗게 쌓인 눈, 모두 패딩 차림',
    sky: { top: '#0e1428', mid: '#262f4b', bottom: '#4a5674', stars: 0, moon: 0, milky: 0 }, // 눈 오는 밤은 구름이 두꺼워 별 · 달이 안 보인다
    fog: { color: '#2e3854', near: 24, far: 110 },
    light: { hemi: 1.35, ambient: 1.4, moon: 0.75 },
    precip: 'snow',
    ground: 'snow',
    outfit: 'puffer',
    tarps: false,
    fireflies: false,
    ambience: 'snow',
    step: null, // 눈 밟는 소리는 쓰지 않는다 (2026-11-13 요청)
    toast: '❄️ 눈이 와서 오늘은 설산캠핑장이에요 · 따뜻하게 패딩 입고 불 앞으로',
  },
  // 이벤트 테마: 날씨로는 바뀌지 않고 관리실에서 고를 때만
  christmas: {
    id: 'christmas', name: '크리스마스 캠핑장', icon: '🎄', desc: '이벤트. 눈 내리는 밤, 광장 큰 트리, 나무마다 색색 전구, 산타 모자', event: true,
    sky: { top: '#0b1230', mid: '#1f2a52', bottom: '#3e4a72', stars: 0, moon: 0, milky: 0 },
    fog: { color: '#262f52', near: 30, far: 125 },
    light: { hemi: 1.3, ambient: 1.5, moon: 0.7 },
    precip: 'snow',
    ground: 'snow',
    outfit: 'santa',
    decor: 'christmas',   // 광장 트리 · 나무 전구 · 텐트 전구 줄 · 리스
    tarps: false,
    fireflies: false,
    ambience: 'snow',
    step: null,
    toast: '🎄 메리 크리스마스! 오늘은 크리스마스 캠핑장이에요 · 광장 트리 앞에서 만나요',
  },
};
export const THEME_IDS = Object.keys(THEMES);
export const themeOf = (id) => THEMES[id] || THEMES.clear;

/** WMO 날씨 코드(Open-Meteo) → 테마 */
export function weatherTheme(code) {
  if (code == null) return 'clear';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  return 'clear';
}
/** WMO 날씨 코드 → 짧은 설명 (관리 화면용) */
export function weatherLabel(code) {
  if (code == null) return '알 수 없음';
  if (code === 0) return '맑음';
  if (code <= 3) return '구름';
  if (code === 45 || code === 48) return '안개';
  if (code >= 51 && code <= 57) return '이슬비';
  if (code >= 61 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code === 85 || code === 86) return '눈 소나기';
  if (code >= 95) return '뇌우';
  return `코드 ${code}`;
}
