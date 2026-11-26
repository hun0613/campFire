// ✨ 가루 아이콘 (v1.21): 효과마다 다른 모양. 색은 가루 색(배경)이 채우고, 모양은 CSS mask 로 가린다.
// 24×24, 검은 면 = 보이는 부분. 선 모양은 stroke 로 그려도 mask 에서 그대로 보인다.
import { POWDER_COLORS, POWDER_EFFECTS, LEGEND_POWDERS } from '../shared/config.js';

const S = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"';
const dots = (...d) => d.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');

const SHAPES = {
  // 반짝이: 네 갈래 반짝임 + 작은 반짝임
  sparkle: '<path d="M10 2.5l2.1 6.4 6.4 2.1-6.4 2.1L10 19.5l-2.1-6.4L1.5 11l6.4-2.1z"/><path d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>' + dots([19, 4.5, 1.3]),
  // 소용돌이
  spiral: `<path ${S} stroke-width="2.6" d="M12.6 12.4c.2-1.3-1.6-1.8-2.4-.8-1.2 1.5 0 3.7 1.9 3.8 2.6.2 4.2-2.6 3.3-4.9-1.1-3-4.9-3.9-7.4-2.1-3.2 2.2-3.2 7-.2 9.4 3.4 2.8 8.7 1.8 10.8-1.9"/>` + dots([20.3, 5, 1.3], [17, 2.6, .9]),
  // 불기둥: 길게 솟은 불꽃
  pillar: '<path d="M12 1.2c1 3.2 3.6 4.8 4.7 8 .8-1.2 1-2.6.7-4 2.7 2.4 3.6 5.5 3.6 8.3a9 8.6 0 01-18 0c0-2.6 1.3-5 3.2-6.6.1 1.6.8 2.9 1.9 3.6.1-3.5 1.7-6.3 3.9-9.3z"/>' + dots([20.6, 2.6, 1]),
  // 연기고리: 위로 떠오르는 고리 둘
  rings: `<ellipse ${S} stroke-width="3" cx="11" cy="16.5" rx="7.6" ry="3.3"/><ellipse ${S} stroke-width="2.8" cx="13.5" cy="6.8" rx="4.8" ry="2.3"/>` + dots([20.5, 2.8, 1]),
  // 반딧불: 크고 작은 빛 방울
  fireflies: dots([8.5, 14.5, 3.6], [17, 8, 2.6], [17.5, 18, 1.9], [5.5, 5.5, 1.5], [12, 4, 1]),
  // 별가루: 큰 별 + 작은 별
  stars: '<path d="M10.5 4.4L12.7 10L18.7 10.3L14 14.1L15.6 20L10.5 16.7L5.4 20L7 14.1L2.3 10.3L8.3 10z"/><path d="M19 2.3L19.8 4.4L22 4.5L20.3 5.9L20.9 8.1L19 6.9L17.1 8.1L17.7 5.9L16 4.5L18.2 4.4z"/>' + dots([20, 19, 1.1]),
  // 하트: 큰 하트 + 작은 하트
  hearts: '<path d="M10.5 21s-8-4.8-8-10.4A4.4 4.4 0 0110.5 8a4.4 4.4 0 018 2.6c0 5.6-8 10.4-8 10.4z"/><path d="M18.6 7.6s-3.3-2-3.3-4.3a1.8 1.8 0 013.3-1.1 1.8 1.8 0 013.3 1.1c0 2.3-3.3 4.3-3.3 4.3z"/>',
  // 무지개: 겹친 무지개 띠
  rainbow: `<path ${S} stroke-width="2.6" d="M2.5 19a9.5 9.5 0 0119 0"/><path ${S} stroke-width="2.6" d="M7 19a5 5 0 0110 0"/>` + dots([12, 19, 1.4]),
  // ✦ 오로라: 물결치는 빛의 띠
  aurora: `<path ${S} stroke-width="2.6" d="M2 8.5c3.3-3.4 6.7 2.6 10 0s6.7-3.4 10 0"/><path ${S} stroke-width="2.6" d="M2 14c3.3-3.4 6.7 2.6 10 0s6.7-3.4 10 0"/><path ${S} stroke-width="2.6" d="M2 19.5c3.3-3.4 6.7 2.6 10 0s6.7-3.4 10 0"/>`,
  // ✦ 불꽃놀이: 사방으로 터지는 불꽃
  fireworks: `<g ${S} stroke-width="2.3"><path d="M12 2.5v4.2M12 17.3v4.2M2.5 12h4.2M17.3 12h4.2M5.3 5.3l3 3M15.7 15.7l3 3M18.7 5.3l-3 3M8.3 15.7l-3 3"/></g>` + dots([12, 12, 2.4]),
  // ✦ 꽃잎 회오리: 다섯 장 꽃
  petals: [0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.6" rx="3.4" ry="5" transform="rotate(${a} 12 12.5)"/>`).join(''),
  // ✦ 은하수: 소용돌이 원반
  galaxy: `<path ${S} stroke-width="2.4" d="M12 12c2.6-3.6 8.4-2.4 9 1.6M12 12c-2.6 3.6-8.4 2.4-9-1.6"/><ellipse ${S} stroke-width="1.6" cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)"/>` + dots([12, 12, 3], [4.5, 4, 1], [19.5, 20, 1]),
  // ✦ 나비 떼: 나비
  // ✦ 위로의 풍등: 떠오르는 등 둘
  lanterns: '<path d="M5.2 9.2h7.6l-1.1 9.2H6.3z"/><path d="M6.4 7.4h5.2v1.2H6.4z"/><path d="M14.6 4h5.4l-.8 6.6h-3.8z"/><path d="M15.4 2.6h3.8v.9h-3.8z"/>' + dots([9, 21, 1], [17.3, 12.6, .8]),
  // ✦ 축하의 팡팡: 꼬깔 축포에서 터지는 색종이
  cheers: '<path d="M2.6 21.4l4.6-11.6 7 7z"/>' + `<path ${S} stroke-width="1.8" d="M13.2 9.6l3.4-3.4M16 13l4.2-1.2M11 7.6l.9-4.4"/>` + '<path d="M18.6 2.4l2.6.9-.9 2.6-2.6-.9z"/><path d="M20.4 15.6l2 1.4-1.4 2-2-1.4z"/>' + dots([15.4, 3.4, 1], [21.2, 8.4, .9], [8.6, 4.2, .8]),
  // ✦ 페스티벌 가루 (아레나): 마이크 + 터지는 반짝임
  festival: '<rect x="6.2" y="2.2" width="7.2" height="10.6" rx="3.6"/>' + `<path ${S} stroke-width="1.9" d="M4 10.4a5.8 5.8 0 0011.6 0M9.8 16.2v4.4M6.4 21.2h6.8"/>` + '<path d="M19.4 2.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/><path d="M19 12.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>' + dots([22, 19.6, 1]),
  butterflies: '<ellipse cx="7.4" cy="8.6" rx="4.6" ry="5" transform="rotate(-25 7.4 8.6)"/><ellipse cx="16.6" cy="8.6" rx="4.6" ry="5" transform="rotate(25 16.6 8.6)"/><ellipse cx="8.4" cy="16.4" rx="3.3" ry="3.8" transform="rotate(20 8.4 16.4)"/><ellipse cx="15.6" cy="16.4" rx="3.3" ry="3.8" transform="rotate(-20 15.6 16.4)"/>' + `<path ${S} stroke-width="1.6" d="M10.6 3.2L12 6.4l1.4-3.2"/>`,
};

// 모양별 CSS 클래스(.pm-효과)를 한 번만 만든다. 요소에는 class="pm-hearts" 만 붙인다
const css = Object.entries(SHAPES).map(([id, body]) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
  return `.pm-${id}{--pm:url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")}`;
}).join('\n');
if (typeof document !== 'undefined') {
  const st = document.createElement('style');
  st.id = 'powderIcons';
  st.textContent = css;
  document.head.appendChild(st);
}

/** 아이콘 모양 클래스 (모르는 효과는 기본 가루 더미) */
export const pmClass = (effect) => (SHAPES[effect] ? `pm-${effect}` : '');

/** 칸에 쓸 이름 두 줄: 종류(효과) + 색 / ✦ 특별한 가루 */
export function powderLabel(p) {
  if (p.legend) return { kind: (LEGEND_POWDERS[p.effect]?.name || p.name).replace(/^✦\s*/, '').replace(/\s*가루$/, ''), sub: '특별한 가루' };
  const e = POWDER_EFFECTS.find((x) => x.id === p.effect);
  const kind = e ? (e.id === 'stars' ? '별' : e.name) : p.name.replace(/\s*가루$/, '');
  if (p.effect === 'rainbow') return { kind, sub: '오색' };
  const c = POWDER_COLORS.find((x) => x.hex.toLowerCase() === String(p.color).toLowerCase());
  return { kind, sub: c ? c.name : (p.name.split(' ')[0] || '') };
}

