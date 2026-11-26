// 분자: 무대 타임테이블 팻말 (v1.23.1) — 캠핑장 광장 승강장 옆, 두 원목 기둥 위 칠판 팻말 + 작은 지붕 · 전구 둘
// 요소 틀: create(opts) → { group, colliders, setRows(rows) }. 바닥 y=0, 정면(읽는 쪽) +z
//   setRows([{ when: '11/27 21:00', title: '곡 제목', live: false }, …]) : 위에서부터 4줄까지 (같은 내용이면 다시 그리지 않는다)
//   긴 제목은 팻말에서는 잘라 쓰고, 가까이 가서 E(행동 버튼)를 누르면 타임테이블 창에서 전부 본다
import * as THREE from 'three';
import { plank, pole, bulb } from '../atoms/index.js';

const W = 2.3, H = 1.6, Y = 1.85; // 칠판 너비 · 높이 · 가운데 높이

export function create() {
  const group = new THREE.Group();
  group.userData.ds = 'timetable-sign';
  for (const sx of [-1, 1]) {
    group.add(pole(0.07, 0.08, Y + H / 2 + 0.1, 'wood.dark', { x: sx * (W / 2 - 0.1), y: (Y + H / 2 + 0.1) / 2, shadow: true }, 8)); // 기둥
  }
  group.add(plank(W + 0.24, H + 0.24, 0.12, 'wood.base', { y: Y, z: -0.04, shadow: true }));   // 원목 테두리
  group.add(plank(W + 0.6, 0.12, 0.5, 'wood.dark', { y: Y + H / 2 + 0.22, z: 0.02, rx: -0.18, shadow: true })); // 작은 지붕
  for (const sx of [-1, 1]) group.add(bulb(0.07, 'light.warm', { x: sx * (W / 2 - 0.25), y: Y + H / 2 + 0.06, z: 0.2 }, 2.6));

  // 칠판 면 (캔버스)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 712;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, Y, 0.03);
  group.add(face);

  let last = null;
  function setRows(rows = []) {
    const key = JSON.stringify(rows.slice(0, 4)) + (document.fonts?.check?.('40px Moneygraphy') ? '' : '…');
    if (key === last) return;
    last = key;
    const g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
    g.fillStyle = '#2b3a2f'; g.fillRect(0, 0, CW, CH);                  // 칠판 초록
    g.strokeStyle = 'rgba(255,241,216,0.18)'; g.lineWidth = 3; g.strokeRect(22, 22, CW - 44, CH - 44);
    g.textBaseline = 'middle';
    g.textAlign = 'center'; g.fillStyle = '#ffcf85'; g.font = '64px Moneygraphy, sans-serif';
    g.fillText('🎤 불멍 아레나 무대', CW / 2, 92);
    g.fillStyle = 'rgba(255,241,216,0.7)'; g.font = '34px Moneygraphy, sans-serif';
    g.fillText('타임테이블', CW / 2, 154);
    const list = rows.slice(0, 4);
    const fit = (t, max) => { if (g.measureText(t).width <= max) return t; let s = t; while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1); return `${s}…`; };
    if (!list.length) {
      g.fillStyle = '#fff1d8'; g.font = '44px Moneygraphy, sans-serif';
      g.fillText('아직 잡힌 무대가 없어요', CW / 2, 330);
      g.fillStyle = 'rgba(255,241,216,0.7)'; g.font = '32px Moneygraphy, sans-serif';
      g.fillText('아레나 승강장 앞 부스에서 신청해요', CW / 2, 400);
    }
    list.forEach((r, i) => {
      const y = 238 + i * 96;
      g.textAlign = 'left';
      g.fillStyle = r.live ? '#ff9ad8' : '#ffcf85'; g.font = '38px Moneygraphy, sans-serif';
      g.fillText(r.live ? '지금 무대' : r.when, 70, y);
      g.fillStyle = '#fff1d8'; g.font = '42px Moneygraphy, sans-serif';
      g.fillText(fit(r.title, CW - 400 - 60), 400, y);
    });
    g.textAlign = 'center'; g.fillStyle = 'rgba(255,241,216,0.6)'; g.font = '30px Moneygraphy, sans-serif';
    g.fillText('가까이 와서 눌러 보면 전체 타임테이블', CW / 2, CH - 62);
    tex.needsUpdate = true;
  }
  setRows([]);
  return { group, colliders: [{ x: -(W / 2 - 0.1), z: 0, r: 0.25 }, { x: W / 2 - 0.1, z: 0, r: 0.25 }], setRows };
}
