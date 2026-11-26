// 분자: 열기구 승강장 — 둥근 나무 데크 + 밧줄 울타리(앞은 트여 있다) + 기둥 위 출발 전광판 (도트 숫자, v1.23)
// 요소 틀: create(opts) → { group, update, setTheme, colliders, seats, setBoard(info) }. 바닥 y=0, 정면(들어오는 쪽) +z
//   setBoard({ head: '아레나행 열기구', mode: 'go' | 'come', sec: 42 }) : 출발 전광판 (같은 내용이면 다시 그리지 않는다)
//   opts.title: 시각판 제목 (기본 '🎈 열기구 승강장')
import * as THREE from 'three';
import { plank, pole, bulb, color } from '../atoms/index.js';
import { toon } from '../../toon.js';

export const DECK_R = 3.6;

export function create(opts = {}) {
  const title = opts.title || '🎈 열기구 승강장';
  const group = new THREE.Group();
  group.userData.ds = 'balloon-dock';
  group.userData.args = { title };

  // 데크: 둥근 나무판 + 가운데 내려앉는 자리 표시(동그라미)
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(DECK_R, DECK_R + 0.1, 0.16, 28), toon(color('wood.light')));
  deck.position.y = 0.08; deck.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.22, 32), toon(color('balloon.cream')));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.165;
  group.add(deck, ring);
  // 밧줄 울타리: 말뚝 9개 (앞 +z 쪽 90°는 입구로 비운다) + 말뚝 위 작은 전구
  const posts = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 4 + (i / 8) * Math.PI * 1.5; // +z 기준 45° ~ 315°
    const x = Math.sin(a) * (DECK_R - 0.12), z = Math.cos(a) * (DECK_R - 0.12);
    posts.push([x, z]);
    group.add(pole(0.06, 0.07, 1.0, 'wood.dark', { x, y: 0.66, z, shadow: true }, 6));
    group.add(bulb(0.06, 'light.warm', { x, y: 1.2, z }, 2.4));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < posts.length - 1; i++) {
    const A = new THREE.Vector3(posts[i][0], 0.95, posts[i][1]), B = new THREE.Vector3(posts[i + 1][0], 0.95, posts[i + 1][1]);
    const rope = pole(0.02, 0.02, A.distanceTo(B), 'balloon.rim', {}, 4);
    rope.position.copy(A).add(B).multiplyScalar(0.5).setY(0.9);
    rope.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
    group.add(rope);
  }
  // 🕒 출발 전광판 (v1.23): 데크 옆 두 기둥 위 붉은 원목 테두리 + 크림색 안쪽 테 + 검은 LED 판.
  //   도트 글꼴(MatrixMonoScreen)의 호박색 숫자로 남은 시간, 왼쪽에 「출발 · 도착」 표시등, 위 머리판에 행선지
  const BW = 3.3, BH = 1.55, BY = 3.15;                 // 전광판 너비 · 높이 · 가운데 높이
  const bx = -(DECK_R + 0.9), bz = 0.9, bry = 0.45;      // 입구 왼쪽 옆 (들어오는 쪽을 비스듬히 본다)
  const board = new THREE.Group();
  board.position.set(bx, 0, bz); board.rotation.y = bry;
  board.userData.ds = 'balloon-board';
  for (const sx of [-1, 1]) {
    board.add(pole(0.08, 0.1, BY + BH / 2, 'stage.cabin', { x: sx * (BW / 2 - 0.25), y: (BY + BH / 2) / 2, shadow: true }, 8)); // 기둥
    board.add(pole(0.11, 0.11, 0.12, 'balloon.red', { x: sx * (BW / 2 - 0.25), y: 0.06 }, 8));                                 // 기둥 받침
  }
  board.add(plank(BW + 0.2, BH + 0.2, 0.18, 'balloon.red', { y: BY, z: -0.05, shadow: true }));      // 붉은 테두리
  board.add(plank(BW - 0.05, BH - 0.05, 0.05, 'balloon.cream', { y: BY, z: 0.06 }));                 // 크림색 안쪽 테
  board.add(plank(BW * 0.72, 0.42, 0.14, 'balloon.red', { y: BY + BH / 2 + 0.24, z: -0.02 }));       // 위 머리판
  for (const sx of [-1, 1]) board.add(bulb(0.06, 'light.warm', { x: sx * (BW * 0.36 + 0.08), y: BY + BH / 2 + 0.24, z: 0.08 }, 2.6));
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.3, BH - 0.3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, BY, 0.09);
  const hcv = document.createElement('canvas'); hcv.width = 512; hcv.height = 96;
  const htex = new THREE.CanvasTexture(hcv); htex.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.68, 0.36), new THREE.MeshBasicMaterial({ map: htex, transparent: true, toneMapped: false }));
  head.position.set(0, BY + BH / 2 + 0.24, 0.06);
  board.add(face, head);
  group.add(board);

  const ON = color('stage.amber'), DIM = color('stage.ledDim');
  const DIGIT_FONT = 'MatrixMonoScreen, monospace'; // 도트 전광판 글꼴 (public/fonts, 게임이 미리 읽어 둔다)
  let last = '';
  /** info: { head: '아레나행 열기구', mode: 'go'(출발) | 'come'(도착), sec: 남은 초 } */
  function setBoard(info) {
    const sec = Math.max(0, Math.ceil(info.sec || 0));
    const key = `${info.head}|${info.mode}|${sec}`;
    if (key === last) return;
    last = key;
    const g = cv.getContext('2d'), W = 1024, H = 512;
    g.fillStyle = color('stage.ledBg'); g.fillRect(0, 0, W, H);
    // 왼쪽 표시등: 출발 · 도착 (지금 쪽만 켜진다)
    g.font = '58px Moneygraphy, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [m, label, y] of [['go', '출발', 175], ['come', '도착', 335]]) {
      const on = info.mode === m;
      g.fillStyle = on ? ON : DIM; g.shadowBlur = on ? 18 : 0; g.shadowColor = ON;
      g.fillText(label, 130, y);
    }
    g.shadowBlur = 0;
    // 남은 시간 M:SS: 오른쪽 칸(표시등 옆) 한가운데에 — 글자 실제 크기(잉크 경계)로 가로 · 세로 가운데를 맞춘다
    const txt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const L = 250, R = W - 40, cx = (L + R) / 2, cy = H / 2;
    let size = 330;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; // 재기 전에 기준을 맞춘다 (잉크 경계는 정렬 기준에서 잰 값)
    g.font = `${size}px ${DIGIT_FONT}`;
    let m = g.measureText(txt);
    const fit = (R - L - 40) / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    if (fit < 1) { size = Math.floor(size * fit); g.font = `${size}px ${DIGIT_FONT}`; m = g.measureText(txt); }
    const tw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, th = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const x0 = cx - tw / 2 + m.actualBoundingBoxLeft, y0 = cy + th / 2 - m.actualBoundingBoxDescent;
    g.fillStyle = color('stage.ledOff'); g.fillText('8:88'.slice(-txt.length), x0, y0); // 꺼진 칸 (전광판 느낌)
    g.fillStyle = ON; g.shadowBlur = 22; g.shadowColor = ON;
    g.fillText(txt, x0, y0);
    g.shadowBlur = 0;
    tex.needsUpdate = true;
    // 머리판: 행선지
    const h = hcv.getContext('2d');
    h.clearRect(0, 0, 512, 96);
    h.font = '56px Moneygraphy, sans-serif'; h.textAlign = 'center'; h.textBaseline = 'middle';
    h.lineWidth = 8; h.strokeStyle = color('stage.frame'); h.strokeText(info.head, 256, 52);
    h.fillStyle = color('stage.amber'); h.fillText(info.head, 256, 52);
    htex.needsUpdate = true;
  }
  setBoard({ head: title.replace(/^🎈\s*/, ''), mode: 'go', sec: 0 });
  const c = Math.cos(bry), sn = Math.sin(bry);
  const cols = [-1, 1].map((sx) => { const lx = sx * (BW / 2 - 0.25); return { x: bx + lx * c, z: bz - lx * sn, r: 0.3 }; });
  return { group, update() {}, setTheme() {}, colliders: cols, seats: [], setBoard };
}
