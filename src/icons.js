// 🪵 나무 버튼에 새긴(음각) 아이콘. 감정 표현 말고 버튼에는 이모지 대신 이 아이콘을 쓴다.
// v1.22.2: 꽉 찬 면(솔리드) 글리프. 24×24 기준. 색 · 음각 그림자는 CSS(.ico)가 정한다.
//   s: 꽉 찬 면 (기본 fill, 선이 필요하면 stroke 를 직접 준다)
//   c: s 에서 파낼 모양 (기본은 굵기 1.6 의 선, fill="#000" 을 주면 면으로 파낸다)
//   t: 파내지 않고 맨 위에 얹는 면
const L = (d, w) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`; // 면 아이콘 안의 굵은 선
const F = 'fill="#000" stroke="none"';
const G = {
  menu: { s: '<rect x="3" y="4.5" width="18" height="3.2" rx="1.6"/><rect x="3" y="10.4" width="18" height="3.2" rx="1.6"/><rect x="3" y="16.3" width="18" height="3.2" rx="1.6"/>' },
  close: { s: L('M6 6l12 12M18 6L6 18', 3.3) },
  map: { s: '<path d="M2.5 5.6L9 3l6.5 2.6L22 3v15.4L15.5 21 9 18.4l-6.5 2.6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>', c: '<path d="M9 3.6v14.6M15.5 5.8v14.6" stroke-width="1.4"/>' },
  install: { s: '<path d="M10.3 2.8h3.4v7.6h3.5L12 15.9l-5.2-5.5h3.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M2.8 14.2h3.4v3.6h11.6v-3.6h3.4v4.6a2.4 2.4 0 01-2.4 2.4H5.2a2.4 2.4 0 01-2.4-2.4z"/>' },
  eye: { s: '<path d="M1.2 12C3.8 7 7.7 4.8 12 4.8s8.2 2.2 10.8 7.2c-2.6 5-6.5 7.2-10.8 7.2S3.8 17 1.2 12z"/>', c: '<circle cx="12" cy="12" r="4.4" stroke-width="1.7"/>' },
  camera: { s: '<rect x="1.8" y="5.8" width="14" height="12.4" rx="2.8"/><path d="M17 10.4l4.2-2.9c.6-.4 1.3 0 1.3.7v7.6c0 .7-.7 1.1-1.3.7L17 13.6z"/>' },
  mail: { s: '<rect x="1.8" y="4.3" width="20.4" height="15.4" rx="2.8"/>', c: '<path d="M3.4 6.6l8.6 6.6 8.6-6.6" stroke-width="1.8"/>' },
  sound: { s: '<path d="M2.5 9.2c0-.6.5-1.1 1.1-1.1h3.6L12 4.3c.6-.5 1.5-.1 1.5.7v14c0 .8-.9 1.2-1.5.7l-4.8-3.8H3.6c-.6 0-1.1-.5-1.1-1.1z"/>' + L('M16.3 9.1a4.2 4.2 0 010 5.8M19.1 6.4a8.2 8.2 0 010 11.2', 2.2) },
  mute: { s: '<path d="M2.5 9.2c0-.6.5-1.1 1.1-1.1h3.6L12 4.3c.6-.5 1.5-.1 1.5.7v14c0 .8-.9 1.2-1.5.7l-4.8-3.8H3.6c-.6 0-1.1-.5-1.1-1.1z"/>' + L('M16.4 9.4l5 5.2M21.4 9.4l-5 5.2', 2.3) },
  help: { s: '<circle cx="12" cy="12" r="10"/>', c: '<path d="M9.2 9.4a2.9 2.9 0 115.1 1.9c-1.2 1-2.3 1.5-2.3 3.1" stroke-width="2.3"/><circle cx="12" cy="17.6" r="1.45" ' + F + '/>' },
  smile: { s: '<circle cx="12" cy="12" r="10"/>', c: '<circle cx="8.6" cy="9.8" r="1.45" ' + F + '/><circle cx="15.4" cy="9.8" r="1.45" ' + F + '/><path d="M7.6 13.7s1.6 2.9 4.4 2.9 4.4-2.9 4.4-2.9" stroke-width="1.9"/>' },
  chat: { s: '<path d="M4.6 3.6h14.8a2.6 2.6 0 012.6 2.6v9.2a2.6 2.6 0 01-2.6 2.6h-9.1l-4.6 3.6c-.5.4-1.2 0-1.2-.6V18h-.1A2.4 2.4 0 012 15.6V6.2a2.6 2.6 0 012.6-2.6z"/>' },
  talk: { s: '<path d="M7.2 3.8h9.6a4.2 4.2 0 014.2 4.2v5.2a4.2 4.2 0 01-4.2 4.2h-5.3l-4 3.1c-.6.5-1.4 0-1.4-.7v-2.5A4.2 4.2 0 013 13.2V8a4.2 4.2 0 014.2-4.2z"/>', c: '<circle cx="8" cy="10.6" r="1.35" ' + F + '/><circle cx="12" cy="10.6" r="1.35" ' + F + '/><circle cx="16" cy="10.6" r="1.35" ' + F + '/>' },
  bag: { s: '<path d="M8.6 9.6C5 11.6 3.3 15 4 18.2c.5 2.2 2.9 3 8 3s7.5-.8 8-3c.7-3.2-1-6.6-4.6-8.6z"/><path d="M7.4 4.5c3.4 1.1 5.8 1.1 9.2 0l-1.6 4.6H9z"/><circle cx="20.2" cy="3.4" r="1"/><circle cx="21.6" cy="6.8" r=".8"/>', c: '<path d="M7.6 9.4h8.8" stroke-width="1.3"/>' },
  music: { s: '<ellipse cx="6.4" cy="17.6" rx="3.1" ry="2.6"/><ellipse cx="16.6" cy="15.6" rx="3.1" ry="2.6"/><path d="M8.3 17.4V6.2L20.5 3.6v12h-2.2V8.4l-7.8 1.7v7.3z"/>' },
  log: { s: '<path d="M6.4 6.6h11.8c1.9 0 3.4 2.4 3.4 5.4s-1.5 5.4-3.4 5.4H6.4C4.5 17.4 3 15 3 12s1.5-5.4 3.4-5.4z"/>', c: '<ellipse cx="18.2" cy="12" rx="1.9" ry="3.7" stroke-width="1.3"/><path d="M18.2 11.1v1.8" stroke-width="1.2"/><path d="M8 9.4h6M9.5 14.6h5" stroke-width="1.2"/>' },
  axe: { s: L('M13.2 10.6L4.4 19.4', 2.8) + '<path d="M11.8 6.2l3.9-3.9c3 1 5.1 3.1 6.1 6.1l-3.9 3.9z"/>' },
  box: { s: '<path d="M12 2.4l9.2 4.1v11L12 21.6l-9.2-4.1v-11z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>', c: '<path d="M3.4 6.9L12 10.8l8.6-3.9M12 10.8v10.4" stroke-width="1.5"/>' },
  book: { s: '<path d="M1.8 5.1c3.5-1.4 7-1.2 9.4.8v15c-2.4-1.6-5.9-1.8-9.4-.6zM22.2 5.1c-3.5-1.4-7-1.2-9.4.8v15c2.4-1.6 5.9-1.8 9.4-.6z"/>' },
  pin: { s: '<path d="M12 22.2s-7.6-6.8-7.6-12.6a7.6 7.6 0 0115.2 0c0 5.8-7.6 12.6-7.6 12.6z"/>', c: '<circle cx="12" cy="9.7" r="2.9" ' + F + '/>' },
  walk: { s: '<circle cx="13.6" cy="3.7" r="2.2"/>' + L('M12.6 8.1l-1.6 5.3', 3.5) + L('M12.2 8.7L9.7 11.2 9 14.1M12.7 8.7l2 3 2.6 1.4', 2.1) + L('M11.4 13.5l2.2 3.5 1.3 4.1M10.8 13.7l-1.2 3.5-2.7 3.3', 2.7) },
  tent: { s: '<path d="M12 3L22 20.5H2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', c: '<path d="M12 12.6l4.1 8.2H7.9z" ' + F + '/>' },
  door: { s: '<path d="M7.2 2.8h9.6c.7 0 1.2.5 1.2 1.2v15.6H6V4c0-.7.5-1.2 1.2-1.2z"/>' + L('M3 20.4h18', 2.2), c: '<circle cx="15" cy="11.8" r="1.2" ' + F + '/>' },
  sparkle: { s: '<path d="M11 3.6l2.1 6.6 6.6 2.1-6.6 2.1L11 21l-2.1-6.6-6.6-2.1 6.6-2.1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M19 1.8l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" stroke="currentColor" stroke-width=".8" stroke-linejoin="round"/>' },
  chair: { s: '<circle cx="11" cy="3.9" r="2.2"/>' + L('M10.6 8.3l-.7 5.3', 3.4) + L('M10.9 9.3l2.1 2.4 2.4-.3', 2) + L('M10 13.6h4.7l.4 6.4', 2.7) + L('M6.2 9.4v11.3M6.2 16.7h6.3M11.9 16.7v4', 1.9) },
  fire: { s: '<path d="M12 2.4c.8 3.8 6.4 5.9 6.4 11.3a6.4 6.4 0 01-12.8 0c0-2.8 1.7-4.8 3-5.9.1 2 1 3.2 2.1 3.4.9-3 .1-5.9 1.3-8.8z"/>', c: '<path d="M12 13.2c1.4 1.4 2.6 2.6 2.6 4.2a2.6 2.6 0 01-5.2 0c0-1.6 1.2-2.8 2.6-4.2z" ' + F + '/>' },
  hand: { s: L('M8.4 12.6V6.9M11.7 11V4.8M15 11V6.2M18.2 12.4V8.8', 2.8) + '<path d="M7 11.6h12.6v3.1c0 4.2-2.9 7.5-6.8 7.5-2.6 0-4.4-1.3-5.6-3.5l-2.6-4.5a1.6 1.6 0 012.7-1.6z"/>' },
  next: { s: '<path d="M8 4.8c0-.9 1-1.4 1.7-.9l9.6 7.2c.6.5.6 1.4 0 1.8l-9.6 7.2c-.7.5-1.7 0-1.7-.9z"/>' },
  prev: { s: '<path d="M16 4.8c0-.9-1-1.4-1.7-.9l-9.6 7.2c-.6.5-.6 1.4 0 1.8l9.6 7.2c.7.5 1.7 0 1.7-.9z"/>' },
  search: { s: '<circle cx="10.3" cy="10.3" r="7.3"/>' + L('M15.8 15.8l5.2 5.2', 3.4), c: '<circle cx="10.3" cy="10.3" r="4.5" ' + F + '/>' },
  pen: { s: '<path d="M3.2 20.8l1.3-5L15.4 4.9a2.4 2.4 0 013.4 0l.3.3a2.4 2.4 0 010 3.4L8.2 19.5z"/>', c: '<path d="M13.7 6.6l3.7 3.7" stroke-width="1.4"/>' },
  coin: { s: '<circle cx="12" cy="12" r="10"/>', c: '<circle cx="12" cy="12" r="6.1" stroke-width="1.6"/>' },
  disc: { s: '<circle cx="12" cy="12" r="10"/>', c: '<circle cx="12" cy="12" r="2.6" ' + F + '/><path d="M12 5.2a6.8 6.8 0 016.8 6.8" stroke-width="1.4"/>' },
  share: { s: '<rect x="3.6" y="9.2" width="16.8" height="12.6" rx="2.6"/>', c: '<rect x="9.4" y="7.6" width="5.2" height="9.4" rx="1.4" ' + F + '/>', t: '<path d="M12 2.2l4.6 4.7h-3v8.6h-3.2V6.9h-3z"/>' },
  plusbox: { s: '<rect x="3" y="3" width="18" height="18" rx="4.6"/>', c: '<path d="M12 7.6v8.8M7.6 12h8.8" stroke-width="2.3"/>' },
  dots: { s: '<circle cx="12" cy="5.4" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="18.6" r="2.2"/>' },
  compass: { s: '<circle cx="12" cy="12" r="10"/>', c: '<path d="M16.4 7.6l-2.8 6-6 2.8 2.8-6z" ' + F + '/>' },
  copy: { s: '<rect x="2.6" y="2.6" width="13" height="13" rx="2.8"/>', c: '<rect x="7" y="7" width="15.6" height="15.6" rx="3.6" ' + F + '/>', t: '<rect x="8.6" y="8.6" width="12.6" height="12.6" rx="2.6"/>' },
  dock: { s: '<rect x="1.8" y="3.2" width="20.4" height="13.8" rx="2.4"/><path d="M9.4 16.6h5.2l.8 3.4H8.6z"/><rect x="6.4" y="19.4" width="11.2" height="2" rx="1"/>' },
  guitar: { s: '<circle cx="8.6" cy="15.6" r="5.6"/><circle cx="12.2" cy="11.8" r="3.7"/>' + L('M13.4 10.6L19.6 4.4', 2.4) + '<path d="M18.2 3.2l1.6-1.6 2.6 2.6-1.6 1.6z"/>', c: '<circle cx="9.6" cy="14.6" r="1.5" ' + F + '/><path d="M5.6 17.8l2.6 2.6" stroke-width="1.3"/>' },
};
const P = G; // 이름 목록 (측정 스크립트 · 다른 모듈 호환용)

// 아이콘마다 그려지는 크기 · 위치가 달라서, 모두 비슷한 무게로 가운데에 오게 맞춘다 [배율, x 이동, y 이동]
// (scratchpad 의 측정 스크립트가 만든 값. 아이콘을 고치면 다시 잰다)
export const NORM = {
  menu: [1.024, 0, 0],
  close: [1.124, 0, 0],
  map: [0.856, -0.25, 0],
  install: [0.92, 0, -1.11],
  eye: [0.919, 0, 0],
  camera: [0.99, 0.55, 0],
  mail: [0.935, 0, -0.2],
  sound: [0.94, -0.16, 0],
  mute: [0.935, 0.16, 0],
  help: [0.86, 0.04, -0.12],
  smile: [0.86, 0, 0.1],
  chat: [0.892, 0.13, 0.14],
  talk: [0.979, 0.11, 0.44],
  bag: [0.92, -0.64, -1.08],
  music: [1.014, -0.67, 0.1],
  log: [1.102, 0.26, -0.01],
  axe: [0.921, -0.99, 1.03],
  box: [0.865, 0, -0.06],
  book: [0.909, 0, -0.38],
  pin: [0.945, 0, 0.48],
  walk: [0.972, -0.05, -0.56],
  tent: [0.835, 0, -1.02],
  door: [0.878, 0.03, -0.49],
  sparkle: [0.841, -0.05, 0.63],
  chair: [1.028, 1.14, -0.5],
  fire: [1.093, -0.13, 0.11],
  hand: [0.993, -0.39, -1.18],
  next: [1.173, -0.95, 0],
  prev: [1.173, 0.95, 0],
  search: [0.873, -0.52, -0.52],
  pen: [1.036, 0.57, -0.57],
  coin: [0.86, 0, 0],
  disc: [0.86, 0.14, -0.14],
  share: [0.931, 0, -1.31],
  plusbox: [0.956, 0, 0],
  dots: [1.165, 0, 0],
  compass: [0.86, 0, 0],
  copy: [0.925, 0, 0],
  dock: [0.881, 0, 0.31],
  guitar: [0.881, 0.14, -0.2],
};

let uid = 0;
/** 아이콘 SVG 문자열. 모르는 이름이면 빈 문자열. raw 면 크기 맞춤 없이 (측정용) */
export function icon(name, cls = '', raw = false) {
  const g = G[name];
  if (!g) return '';
  const id = `icm${++uid}`;
  let body = (g.c ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32"><rect x="-4" y="-4" width="32" height="32" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${g.c}</g></mask><g mask="url(#${id})">${g.s}</g>` : g.s) + (g.t || '');
  const n = !raw && NORM[name];
  if (n) body = `<g transform="translate(12 12) scale(${n[0]}) translate(${-12 + n[1]} ${-12 + n[2]})">${body}</g>`;
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">${body}</svg>`;
}

// 모바일 액션 버튼 · 버튼 글에 쓰던 이모지 → 아이콘 이름
export const EMOJI_ICON = {
  '▶': 'next', '🪵': 'log', '🪓': 'axe', '💬': 'talk', '📦': 'box', '📖': 'book', '📌': 'pin', '🚶': 'walk', '⛺': 'tent',
  '🚪': 'door', '✨': 'sparkle', '🪑': 'chair', '🔥': 'fire', '✋': 'hand', '🔊': 'sound', '🎵': 'music', '💿': 'disc', '🎸': 'guitar',
};

/** HTML 안의 [data-icon] 자리에 아이콘을 채운다 (맨 앞에) */
export function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.querySelector(':scope > svg.ico')?.remove();
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}
