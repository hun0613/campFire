// 🪵 나무 버튼에 새긴(음각) 선 아이콘 (v1.20). 감정 표현 말고 버튼에는 이모지 대신 이 아이콘을 쓴다.
// 24×24 기준, 같은 굵기의 둥근 선. 색 · 음각 그림자는 CSS(.ico)가 정한다.
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  map: '<path d="M3 6.5l6-2.3 6 2.3 6-2.3v13.3l-6 2.3-6-2.3-6 2.3z"/><path d="M9 4.2v13.3M15 6.5v13.3"/>',
  install: '<path d="M12 3.5v10.5"/><path d="M7.8 10L12 14.2 16.2 10"/><path d="M4 14.5v2.8A2.7 2.7 0 006.7 20h10.6a2.7 2.7 0 002.7-2.7v-2.8"/>',
  eye: '<path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  camera: '<rect x="3" y="7" width="12" height="10" rx="2.2"/><path d="M15 10.5l6-3v9l-6-3"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.5 7l8.5 6.2L20.5 7"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 010 6M18.2 6.5a8 8 0 010 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  help: '<path d="M9.2 9.2a2.9 2.9 0 115 2c-1.3.9-2.2 1.5-2.2 3"/><path d="M12 18.2v.3"/>',
  smile: '<circle cx="12" cy="12" r="8.8"/><path d="M8.3 14.2s1.3 2.2 3.7 2.2 3.7-2.2 3.7-2.2M9 9.6v.6M15 9.6v.6"/>',
  chat: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/>',
  bag: '<path d="M9 10.2C5.6 12.2 4 15.2 4.6 18.2c.4 2 2.6 2.8 7.4 2.8s7-.8 7.4-2.8c.6-3-1-6-4.4-8z"/><path d="M8.6 10.2h6.8M9.4 10.2L7.8 5.8c2.6 1 5.8 1 8.4 0l-1.6 4.4"/><path d="M19.6 3.6v.01M21 6.6v.01M17.8 6v.01"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.6" r="2.4"/>',
  log: '<path d="M6 7.5h11.5M6 16.5h11.5"/><ellipse cx="6" cy="12" rx="2.3" ry="4.5"/><ellipse cx="17.5" cy="12" rx="2.3" ry="4.5"/><path d="M17.5 10.6v2.8"/>',
  axe: '<path d="M12.5 9.5L4 18l2 2 8.5-8.5"/><path d="M12 6.5l3.5-3.5c2.6.9 4.6 2.9 5.5 5.5L17.5 12z"/>',
  box: '<path d="M3.5 7.8L12 4l8.5 3.8v8.6L12 20.2l-8.5-3.8z"/><path d="M3.5 7.8L12 11.6l8.5-3.8M12 11.6v8.6"/>',
  book: '<path d="M3.5 5.5c3-1 6-.8 8.5 1 2.5-1.8 5.5-2 8.5-1v13c-3-1-6-.8-8.5 1-2.5-1.8-5.5-2-8.5-1z"/><path d="M12 6.5v13"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  walk: '<circle cx="13.5" cy="4.3" r="1.7"/><path d="M12.6 7.6l-3 5 3 2.2v5.7M12.6 14.8l3.2 5.7M9.6 12.6L6.5 14M12.6 7.6l3.4 3.6 3 .3"/>',
  tent: '<path d="M2.5 20L12 4l9.5 16z"/><path d="M8.5 20l3.5-6.2 3.5 6.2M12 4v2"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1.2"/><path d="M3 21h18"/><circle cx="14.8" cy="12.3" r=".6"/>',
  sparkle: '<path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z"/><path d="M19 3.5v3M17.5 5h3"/>',
  chair: '<path d="M7 3.5v17M17 12.5v8M7 12.5h10M7 3.5c2 0 3.3 1.2 3.3 3.3v5.7"/>',
  fire: '<path d="M12 3c.7 3.6 5.8 5.6 5.8 10.6A5.8 5.8 0 016.2 13.6c0-2.6 1.6-4.4 2.7-5.4.1 1.8.9 2.9 1.9 3.1.8-2.7.1-5.4 1.2-8.3z"/>',
  next: '<path d="M8.5 5.5l9 6.5-9 6.5z"/>',
  prev: '<path d="M15.5 5.5l-9 6.5 9 6.5z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  pen: '<path d="M4 20l1.2-4.2L15.8 5.2a2 2 0 012.9 0l.1.1a2 2 0 010 2.9L8.2 18.8z"/><path d="M14 7l3 3"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 013 0V11M11 11V5a1.5 1.5 0 013 0v6M14 11V6.5a1.5 1.5 0 013 0V14c0 4-2.8 7-6.2 7-2.5 0-4.2-1.3-5.3-3.4l-1.9-3.8a1.5 1.5 0 012.6-1.5L8 14"/>',
  coin: '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="5"/>',
  disc: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="2.4"/><path d="M12 5.5a6.5 6.5 0 016.5 6.5"/>',
  share: '<path d="M12 3.5v11M8.2 7.2L12 3.5l3.8 3.7"/><path d="M8 10.5H6.5A1.5 1.5 0 005 12v7a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-7a1.5 1.5 0 00-1.5-1.5H16"/>',
  plusbox: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  dots: '<path d="M12 5.5v.01M12 12v.01M12 18.5v.01"/>',
  compass: '<circle cx="12" cy="12" r="8.8"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>',
  dock: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M6.5 20h11M9 16.5l-.8 3.5M15 16.5l.8 3.5"/>',
  guitar: '<path d="M14.5 9.5l5.5-5.5M18 3l3 3"/><path d="M13 7.8c-1.6-1-3.7-.6-4.7.9-.4.6-.5 1.2-1.4 1.6-2.3 1-3.4 3.6-2 5.8 1.4 2.2 4.5 2.8 6.3 1.2.9-.8 1.3-1.9 2.4-2.4 1-.5 1.8-.8 2.3-1.6 1-1.5.4-3.6-.9-4.6"/><circle cx="10.4" cy="13.6" r="1.3"/>',
};

/** 아이콘 SVG 문자열. 모르는 이름이면 빈 문자열 */
export function icon(name, cls = '') {
  const p = P[name];
  return p ? `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${p}</svg>` : '';
}

// 모바일 액션 버튼 · 버튼 글에 쓰던 이모지 → 아이콘 이름
export const EMOJI_ICON = {
  '▶': 'next', '🪵': 'log', '🪓': 'axe', '💬': 'chat', '📦': 'box', '📖': 'book', '📌': 'pin', '🚶': 'walk', '⛺': 'tent',
  '🚪': 'door', '✨': 'sparkle', '🪑': 'chair', '🔥': 'fire', '✋': 'hand', '🔊': 'sound', '🎵': 'music', '💿': 'disc', '🎸': 'guitar',
};

/** HTML 안의 [data-icon] 자리에 아이콘을 채운다 (맨 앞에) */
export function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.querySelector(':scope > svg.ico')?.remove();
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}
