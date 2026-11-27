// 🖼️ 아레나 타임테이블 포스터 (관리실 v1.23.3): 날짜를 고르면 그날 승인된 무대로 포스터를 캔버스에 그린다 → 미리보기 · PNG 내려받기
// - 위: 노을 하늘 · 별 · 지평선 실루엣(망루 · 무대 · 열기구 · 깃발 · 천막 · 나무)  가운데: MAIN STAGE 세로 타임라인(좌우 번갈아)  아래: 게임 속 공연 장면
// - 1080 × 1350 (4:5). 무대가 많으면 세로로 늘려 1080 × 1920 까지, 그래도 넘치면 줄 간격을 좁힌다
// - 유튜브 영상 제목은 parseTitle 로 「가수 · 곡」으로 나누고, 관리실에서 줄마다 고칠 수 있다
const W = 1080, BASE_H = 1350, MAX_H = 1920, SCALE = 2;
const FONT = 'Moneygraphy, sans-serif';
const CROWD_H = 390;

/** 유튜브 영상 제목 → { artist, song } (꼬리표 · 화질 · 방송 정보 · 다른 이름 괄호를 걷어 낸다) */
export function parseTitle(raw = '') {
  const live = /\blive\b|라이브/i.test(raw);
  let t = String(raw)
    .replace(/\[[^\]]*\]|【[^】]*】/g, ' ')                       // [LIVE] · [#2026MAMA]
    .split(/\s[|｜]\s/)[0]                                        // 「| Mnet 261120 방송」
    .replace(/\((?=[^()]*(?:\b(?:1080p|720p|4k|hd|official|m\/?v|lyrics?|audio|visuali[sz]er|ver|live|clip|performance|festival|concert|stage)\b|방송|가사|음원))[^()]*\)/gi, ' ') // 단어로만 (Birthday 의 hd 는 아님)
    .replace(/\b(?:official\s+(?:music\s+)?video|m\/?v|mv|lyric\s+video|audio)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  let artist = t, song = '';
  const q = t.match(/^(.*?)[“"'「『](.+?)[”"'」』](.*)$/);
  if (q) { artist = q[1]; song = (q[2] + ' ' + q[3]).trim(); } else if (/\s[-–—_]\s/.test(t)) { const i = t.search(/\s[-–—_]\s/); artist = t.slice(0, i); song = t.slice(i + 3); }
  artist = artist.replace(/\s*\([^()]*\)\s*$/, '').replace(/[-–—:\s]+$/, '').trim();   // RESCENE (리센느) → RESCENE
  song = song.replace(/\s+/g, ' ').trim();
  if (live && song && !/live/i.test(song)) song += ' (LIVE)';
  return { artist: artist || t, song };
}

const pad2 = (n) => String(n).padStart(2, '0');
const kst = (ms) => new Date(ms + 9 * 3600e3);
export const kstDay = (ms) => kst(ms).toISOString().slice(0, 10);
export const hhmm = (ms) => { const d = kst(ms); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
export function dateLabel(day, today) {
  const d = new Date(`${day}T00:00:00Z`);
  const wd = '일월화수목금토'[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${wd}요일 · ${day === today ? '오늘의 ' : ''}타임테이블`;
}

let bgImg = null;
function loadBg() {
  if (bgImg) return bgImg;
  bgImg = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '/arena-poster-bg.jpg'; });
  return bgImg;
}

/** 글자 사이를 띄워 가운데 정렬로 쓴다 (캔버스 letterSpacing 이 없는 브라우저도) */
function spaced(g, text, cx, y, sp) {
  const chars = [...text], ws = chars.map((c) => g.measureText(c).width);
  let x = cx - (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
  g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, x, y); x += ws[i] + sp; });
  g.textAlign = 'center';
}
/** 너비에 맞게 글자 크기를 줄이고, 최소 크기로도 넘치면 끝을 말줄임표로 (포스터 밖으로 나가지 않게) → 쓸 글자 */
function fit(g, text, size, max, min = size * 0.6) {
  let s = size;
  for (; s > min; s -= 1) { g.font = `${s}px ${FONT}`; if (g.measureText(text).width <= max) return text; }
  g.font = `${min}px ${FONT}`;
  if (g.measureText(text).width <= max) return text;
  let t = [...text];
  while (t.length > 1 && g.measureText(`${t.join('')}…`).width > max) t.pop();
  return `${t.join('').trimEnd()}…`;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function pill(g, text, cy, { size = 22, bg = null } = {}) {
  g.font = `${size}px ${FONT}`;
  const w = g.measureText(text).width + 60, h = size + 26;
  roundRect(g, (W - w) / 2, cy - h / 2, w, h, h / 2);
  if (bg) { g.fillStyle = bg; g.fill(); }
  g.strokeStyle = 'rgba(255,243,228,.75)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff3e4'; g.fillText(text, W / 2, cy + 1);
}

// 지평선 실루엣 (직접 그린 SVG 길을 그대로: 0~1080 × 0~130)
const RIDGE_FILL = [
  'M0 108 C 80 98, 150 104, 230 100 S 380 92, 470 98 S 640 100, 720 96 S 900 104, 1080 98 L1080 130 L0 130 Z',
  'M40 104 l14 -40 l14 40 Z M70 106 l18 -54 l18 54 Z M980 104 l16 -46 l16 46 Z M1012 106 l13 -36 l13 36 Z M1040 104 l12 -30 l12 30 Z',
  'M150 104 l26 -22 l26 22 Z M196 104 l20 -17 l20 17 Z M860 104 l24 -20 l24 20 Z M902 104 l18 -15 l18 15 Z',
  'M240 74 h14 v10 h-14 Z M302 72 h14 v10 h-14 Z M792 72 h14 v10 h-14 Z M844 74 h14 v10 h-14 Z',
  'M392 100 L 398 52 L 402 52 L 396 100 Z M430 100 L 424 52 L 420 52 L 426 100 Z M384 37 L 411 20 L 438 37 Z',
  'M652 100 L 658 52 L 662 52 L 656 100 Z M690 100 L 684 52 L 680 52 L 686 100 Z M644 37 L 671 20 L 698 37 Z',
  'M776 30 c 0 -16 26 -16 26 0 c 0 10 -8 16 -10 20 h -6 c -2 -4 -10 -10 -10 -20 Z M822 44 c 0 -11 18 -11 18 0 c 0 7 -6 11 -7 14 h -4 c -1 -3 -7 -7 -7 -14 Z',
];
const RIDGE_STROKE = ['M238 101 V 74 M300 99 V 72 M790 99 V 72 M842 101 V 74', 'M394 70 L 428 86 M 428 70 L 394 86 M654 70 L 688 86 M 688 70 L 654 86', 'M462 34 L 618 34 M 472 34 L 488 24 L 504 34 L 520 24 L 536 34 L 552 24 L 568 34 L 584 24 L 600 34 L 616 24'];
const RIDGE_RECT = [[390, 36, 42, 18], [650, 36, 42, 18], [462, 30, 10, 72], [608, 30, 10, 72], [452, 24, 176, 10], [480, 44, 120, 44], [456, 88, 168, 14], [785, 53, 8, 6], [828, 60, 6, 4]];
function ridge(g, top) {
  g.save(); g.translate(0, top);
  g.fillStyle = '#0b0a14'; g.strokeStyle = '#0b0a14';
  for (const d of RIDGE_FILL) g.fill(new Path2D(d));
  g.lineWidth = 2.5; for (const d of RIDGE_STROKE) g.stroke(new Path2D(d));
  for (const r of RIDGE_RECT) g.fillRect(...r);
  g.fillStyle = '#2a1a4a'; g.fillRect(486, 50, 108, 32); // 전광판
  g.fillStyle = '#ffcf85'; for (const x of [397, 408, 419, 657, 668, 679]) g.fillRect(x, 41, 6, 8); // 망루 창 불빛
  g.restore();
}

/**
 * 포스터 그리기
 * @param {HTMLCanvasElement} cv
 * @param {{ date: string, rows: { time: string, artist: string, song: string }[] }} o  date: 위에 쓰는 날짜 글
 */
export async function drawPoster(cv, { date, rows }) {
  await Promise.all([document.fonts.load(`40px ${FONT.split(',')[0]}`), loadBg()]);
  const bg = await loadBg();
  // 줄 배치: 기본은 한 줄 152px · 글자 100%. 많으면 ① 세로로 늘리고(최대 1920) ② 줄 간격을 좁히고 ③ 글자도 함께 줄인다
  //   좌우 번갈아 놓이니 같은 쪽 두 줄(2칸 간격)만 안 겹치면 된다: 2 × step ≥ 줄 높이 + 16
  //   글자를 55%까지 줄여도 안 들어가면 들어가는 만큼만 그리고 「외 N곡」
  const TOP = 524, ROW_H = 125, FLOOR = CROWD_H - 20; // 타임라인은 공연 장면이 보이기 전에 끝난다
  let list = rows, more = 0, k = 1, step = 152;
  const need = (m, kk, st) => TOP + (m - 1) * st + ROW_H * kk + FLOOR;
  let H = Math.max(BASE_H, need(list.length, 1, step));
  if (H > MAX_H) {
    H = MAX_H;
    const room = H - FLOOR - TOP; // 첫 줄 위 ~ 마지막 줄 아래
    const solve = (m) => { if (m <= 1) return { k: 1, step }; const st = Math.min(152, (room - ROW_H) / (m - 1)); if (2 * st >= ROW_H + 16) return { k: 1, step: st }; const kk = (room - 8 * (m - 1)) / (62.5 * (m - 1) + ROW_H); return { k: kk, step: (ROW_H * kk + 16) / 2 }; };
    let sol = solve(list.length);
    while (sol.k < 0.55 && list.length > 2) { list = rows.slice(0, list.length - 1); more = rows.length - list.length; sol = solve(list.length + 1); } // 「외 N곡」 한 줄 자리도 남긴다
    k = Math.min(1, sol.k); step = sol.step;
  }
  const n = list.length;
  cv.width = W * SCALE; cv.height = H * SCALE;
  const g = cv.getContext('2d');
  g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  g.textBaseline = 'top'; g.textAlign = 'center';

  // 하늘
  const SKY = 432;
  let gr = g.createLinearGradient(0, 0, 0, SKY);
  [[0, '#160c2e'], [0.3, '#2f1450'], [0.58, '#6a2269'], [0.8, '#b23f72'], [1, '#e2735c']].forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, W, SKY);
  gr = g.createRadialGradient(W / 2, SKY * 1.05, 0, W / 2, SKY * 1.05, 520);
  gr.addColorStop(0, 'rgba(255,150,80,.85)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
  g.save(); g.scale(1, 0.55); g.fillStyle = gr; g.fillRect(0, 0, W, SKY / 0.55); g.restore();
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; // 늘 같은 별
  for (let i = 0; i < 170; i++) { const y = Math.pow(rnd(), 1.7) * 380, x = rnd() * W, a = 0.25 + rnd() * 0.6, r = rnd() < 0.08 ? 1.6 : 0.9; g.globalAlpha = a; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;

  // 밤 (타임라인 바탕)
  gr = g.createLinearGradient(0, SKY, 0, H);
  [[0, '#0b0a14'], [0.45, '#101a2c'], [0.7, '#182a40'], [1, '#0f1a2a']].forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, SKY, W, H - SKY);
  ridge(g, 314);

  // 머리글
  g.fillStyle = '#ff8fc8'; g.font = `20px ${FONT}`; spaced(g, 'BULMEONG ARENA · 불멍 캠핑장', W / 2, 62, 6.4);
  g.fillStyle = '#fffaf2'; g.shadowColor = 'rgba(40,0,60,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 4;
  g.font = `92px ${FONT}`; g.fillText('불멍 아레나 무대', W / 2, 98);
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = '#ffb45e'; g.font = `30px ${FONT}`; g.fillText(date, W / 2, 208);
  g.textBaseline = 'middle'; pill(g, '🎈 광장 승강장에서 열기구 타고 1분', 283); g.textBaseline = 'top';

  // 아래: 게임 속 공연 장면 (위쪽은 어둠 속으로 녹아든다)
  const cy = H - CROWD_H;
  if (bg) {
    const off = document.createElement('canvas'); off.width = W * SCALE; off.height = CROWD_H * SCALE;
    const o = off.getContext('2d'); o.scale(SCALE, SCALE);
    const iw = 1160, ih = (bg.height / bg.width) * iw;
    o.drawImage(bg, -40, -40, iw, ih);
    o.globalCompositeOperation = 'destination-in';
    const m = o.createLinearGradient(0, 0, 0, 200); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.2, 'rgba(0,0,0,0)'); m.addColorStop(1, '#000');
    o.fillStyle = m; o.fillRect(0, 0, W, CROWD_H);
    g.drawImage(off, 0, cy, W, CROWD_H);
  }
  gr = g.createLinearGradient(0, cy, 0, H);
  gr.addColorStop(0.5, 'rgba(11,10,20,0)'); gr.addColorStop(0.72, 'rgba(11,10,20,.3)'); gr.addColorStop(1, 'rgba(11,10,20,.92)');
  g.fillStyle = gr; g.fillRect(0, cy, W, CROWD_H);

  // 타임라인
  g.fillStyle = '#e86fb5'; g.font = `26px ${FONT}`; spaced(g, 'MAIN STAGE', W / 2, 466, 3.6);
  if (!n) {
    g.fillStyle = '#fff3e4'; g.font = `40px ${FONT}`; g.fillText('아직 잡힌 무대가 없어요', W / 2, 640);
    g.fillStyle = 'rgba(255,243,228,.7)'; g.font = `24px ${FONT}`; g.fillText('아레나 승강장 앞 부스에서 내 노래를 신청해요', W / 2, 700);
  } else {
    const lineEnd = TOP + (n - 1 + (more ? 1 : 0)) * step + ROW_H * k - 10;
    gr = g.createLinearGradient(0, 516, 0, lineEnd);
    gr.addColorStop(0, 'rgba(255,243,228,.05)'); gr.addColorStop(0.12, 'rgba(255,243,228,.35)'); gr.addColorStop(0.88, 'rgba(255,243,228,.35)'); gr.addColorStop(1, 'rgba(255,243,228,.05)');
    g.fillStyle = gr; g.fillRect(539, 516, 2, lineEnd - 516);
    list.forEach((r, i) => {
      const y = TOP + i * step, left = i % 2 === 0;
      const x = left ? W / 2 - 32 : W / 2 + 32, max = W / 2 - 32 - 40; // 포스터 가장자리에서 40px 안쪽까지
      g.textAlign = left ? 'right' : 'left';
      const dy = y + 21 * k;
      g.fillStyle = 'rgba(255,243,228,.12)'; g.beginPath(); g.arc(540, dy, 12 * Math.max(k, 0.7), 0, Math.PI * 2); g.fill();
      g.shadowColor = 'rgba(255,180,94,.7)'; g.shadowBlur = 18; g.fillStyle = '#fff3e4'; g.beginPath(); g.arc(540, dy, 7 * Math.max(k, 0.7), 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent'; g.shadowBlur = 0;
      g.fillStyle = '#ffb45e'; g.font = `${Math.round(24 * k)}px ${FONT}`; g.fillText(r.time, x, y + 4 * k);
      g.fillStyle = '#fffaf2'; g.fillText(fit(g, r.artist || '', Math.round(46 * k), max, Math.round(30 * k)), x, y + 36 * k);
      if (r.song) { g.fillStyle = 'rgba(255,243,228,.78)'; g.fillText(fit(g, r.song, Math.round(23 * k), max, Math.round(17 * k)), x, y + 92 * k); }
    });
    if (more) { // 다 못 그린 무대
      const y = TOP + n * step, left = n % 2 === 0;
      g.textAlign = left ? 'right' : 'left';
      g.fillStyle = 'rgba(255,243,228,.75)'; g.font = `${Math.round(26 * Math.max(k, 0.8))}px ${FONT}`;
      g.fillText(`외 ${more}곡 · 전체는 게임 타임테이블에서`, left ? W / 2 - 32 : W / 2 + 32, y + 10);
    }
    g.textAlign = 'center';
  }

  // 아래 안내
  g.textBaseline = 'middle';
  pill(g, '🎤 내 신청곡도 무대에 · 아레나 승강장 앞 부스', H - 92 - 24, { bg: 'rgba(11,10,20,.45)' });
  g.fillStyle = 'rgba(255,243,228,.7)'; g.font = `19px ${FONT}`; g.fillText('불멍 캠핑장 · 설치 · 가입 없이 무료 · 객석 모닥불에 앉아 함께 들어요 🔥', W / 2, H - 48);
  g.textBaseline = 'top';
  return { width: W, height: H };
}
