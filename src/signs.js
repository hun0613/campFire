// 🪧 이정표 · 팻말 (v1.22.2)
//   fingerpost: 각진 원목 기둥 + 밝은 오크 화살표 판, 진한 갈색으로 새긴 글씨 (시골 길가 이정표 느낌)
//   hangingSign: 나무 기둥 팔에 사슬로 매단 검은 간판, 크림색 글씨 · 불꽃 문양 · 방향 줄 (숲속 캐빈 입구 간판 느낌)
import * as THREE from 'three';
import { toon } from './toon.js';

const FONT = "Moneygraphy, 'Apple SD Gothic Neo', sans-serif";
const PX = 256; // 판 1m = 256px
const redraws = [];
let fontHooked = false;
function onFont(draw) { // 글꼴을 받기 전에 그렸다면 받은 뒤 한 번 더 그린다
  redraws.push(draw); draw();
  if (!fontHooked && document.fonts) { fontHooked = true; document.fonts.load(`40px ${FONT}`).then(() => redraws.forEach((f) => f()), () => {}); }
}

// ---------------------------------------------------------------- 원목 화살표 이정표
const ARM_H = 0.34, ARM_D = 0.06, TIP = 0.24;
function armShape(len) { // 기둥 쪽(왼쪽 끝 x=0)에서 +x 로 뻗고, 끝이 뾰족한 화살표
  const s = new THREE.Shape(), h = ARM_H / 2;
  s.moveTo(0, -h); s.lineTo(len - TIP, -h); s.lineTo(len, 0); s.lineTo(len - TIP, h); s.lineTo(0, h); s.closePath();
  return s;
}
function measure(text, size) { const g = document.createElement('canvas').getContext('2d'); g.font = `${size}px ${FONT}`; return g.measureText(text).width; }
/** 화살표 판 앞면 그림: 오크 나뭇결 + 새긴 글씨. flip 이면 화살표가 왼쪽을 가리킨다 (뒷면용) */
function armTexture(text, len, flip) {
  const w = Math.round(len * PX), h = Math.round(ARM_H * PX);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const seed = text.length * 7.3;
  onFont(() => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
    g.save(); if (flip) { g.translate(w, 0); g.scale(-1, 1); }
    const tip = TIP * PX;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w - tip, 0); g.lineTo(w, h / 2); g.lineTo(w - tip, h); g.lineTo(0, h); g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#d9a56b'); grd.addColorStop(0.5, '#c8925a'); grd.addColorStop(1, '#b37c48');
    g.fillStyle = grd; g.fill(); g.clip();
    g.strokeStyle = 'rgba(110,62,26,0.22)'; g.lineWidth = 2; // 나뭇결
    for (let y = 6; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * 0.012 + y * 0.7 + seed) * 2.2); g.stroke(); }
    g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 5; g.stroke(); // 가장자리 살짝 어둡게 (다듬은 모서리)
    g.restore();
    const cx = flip ? (TIP * PX + (w - TIP * PX) / 2) : (w - TIP * PX) / 2;
    g.font = `${Math.round(h * 0.5)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,226,180,0.55)'; g.fillText(text, cx, h / 2 + 3); // 새긴 홈의 아래쪽 밝은 테
    g.fillStyle = '#3a2314'; g.fillText(text, cx, h / 2 + 1);
    tex.needsUpdate = true;
  });
  return tex;
}
const POST_MAT = () => toon('#7d6650');
/**
 * 원목 화살표 이정표. arms: [{ text, to: {x, z} }] (위에서부터 차례로). 화살표 끝이 to 쪽을 가리킨다.
 * 돌아오는 값: Group (scene 에 이미 붙임)
 */
export function fingerpost(scene, x, z, arms, { height = 2.5 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, height, 0.15), POST_MAT()); post.position.y = height / 2; post.castShadow = true; post.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 4), POST_MAT()); cap.position.y = height + 0.05; cap.rotation.y = Math.PI / 4;
  g.add(post, cap);
  arms.forEach((a, i) => {
    const size = Math.round(ARM_H * PX * 0.5), len = Math.max(1.0, measure(a.text, size) / PX + 0.34 + TIP);
    const dx = a.to.x - x, dz = a.to.z - z, ang = Math.atan2(-dz, dx);
    const arm = new THREE.Group(); arm.position.y = height - 0.32 - i * (ARM_H + 0.1); arm.rotation.y = ang;
    arm.rotation.z = (i % 2 ? -1 : 1) * 0.015; // 손으로 단 듯 살짝 기울게
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(armShape(len), { depth: ARM_D, bevelEnabled: false }), toon('#c48d58'));
    body.position.set(0.06, 0, -ARM_D / 2); body.castShadow = true;
    const face = (flip) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, ARM_H), toon('#ffffff', { map: armTexture(a.text, len, flip), transparent: true, alphaTest: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.22 }));
      m.material.emissiveMap = m.material.map; // 밤에도 오크 판과 새긴 글씨가 보이게 은은하게
      m.position.set(0.06 + len / 2, 0, (flip ? -1 : 1) * (ARM_D / 2 + 0.003)); if (flip) m.rotation.y = Math.PI;
      return m;
    };
    arm.add(body, face(false), face(true));
    g.add(arm);
  });
  scene.add(g);
  return g;
}

// ---------------------------------------------------------------- 매달린 검은 간판
function flame(g, cx, cy, r) { // 크림색 선으로 그린 작은 불꽃 문양 (원 안에)
  g.lineWidth = r * 0.09; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - r * 0.62);
  g.bezierCurveTo(cx + r * 0.55, cy - r * 0.1, cx + r * 0.45, cy + r * 0.5, cx, cy + r * 0.55);
  g.bezierCurveTo(cx - r * 0.45, cy + r * 0.5, cx - r * 0.55, cy - r * 0.05, cx - r * 0.12, cy - r * 0.28);
  g.bezierCurveTo(cx - r * 0.1, cy, cx + r * 0.02, cy + r * 0.05, cx, cy - r * 0.62);
  g.stroke();
  g.beginPath(); g.moveTo(cx - r * 0.42, cy + r * 0.7); g.lineTo(cx + r * 0.42, cy + r * 0.7); g.stroke(); // 장작 한 줄
}
function arrowLine(g, x, y, len, left) {
  const t = len * 0.22, s = len * 0.16;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y);
  if (left) { g.moveTo(x + t, y - s); g.lineTo(x, y); g.lineTo(x + t, y + s); } else { g.moveTo(x + len - t, y - s); g.lineTo(x + len, y); g.lineTo(x + len - t, y + s); }
  g.stroke();
}
/** 간판 한 면. lines: [{ text, dir: 'l' | 'r' }]. mirror 면 방향을 뒤집는다 (뒷면) */
function boardTexture(w, h, { title, small, lines }, mirror) {
  const W = Math.round(w * PX * 1.6), H = Math.round(h * PX * 1.6);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  onFont(() => {
    const g = cv.getContext('2d');
    g.fillStyle = '#262320'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } // 칠한 판의 결
    const cream = '#efe2c4';
    g.strokeStyle = cream; g.fillStyle = cream; g.lineCap = 'round'; g.lineJoin = 'round';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const u = W / 100; // 가로 1% 단위
    // 세로 배치 (가로 1% = u, 판 높이는 약 126u): 제목 · 불꽃 문양 · 제목 사이를 넉넉히 띄우고, 가는 선 아래에 길 안내
    let y = u * 20;
    if (title) {
      g.font = `${u * 13}px ${FONT}`; g.fillText(title[0], W / 2, y);
      const fy = y + u * 22;
      flame(g, W / 2, fy, u * 7.5);
      if (small) { g.font = `${u * 5}px ${FONT}`; g.globalAlpha = 0.85; g.fillText(small[0], W * 0.2, fy); g.fillText(small[1], W * 0.8, fy); g.globalAlpha = 1; }
      g.font = `${u * 13}px ${FONT}`; g.fillText(title[1], W / 2, y + u * 44);
      g.globalAlpha = 0.4; g.lineWidth = u * 0.4; g.beginPath(); g.moveTo(W / 2 - u * 16, y + u * 60); g.lineTo(W / 2 + u * 16, y + u * 60); g.stroke(); g.globalAlpha = 1;
      y += u * 74;
    }
    g.font = `${u * 8.4}px ${FONT}`; g.lineWidth = u * 0.8;
    for (const ln of lines) {
      const left = (ln.dir === 'l') !== mirror;
      const tw = g.measureText(ln.text).width, al = u * 8, gap = u * 2.5, total = tw + gap + al, x0 = (W - total) / 2;
      if (left) { arrowLine(g, x0, y, al, true); g.textAlign = 'left'; g.fillText(ln.text, x0 + al + gap, y); }
      else { g.textAlign = 'left'; g.fillText(ln.text, x0, y); arrowLine(g, x0 + tw + gap, y, al, false); }
      g.textAlign = 'center';
      y += u * 15;
    }
    tex.needsUpdate = true;
  });
  return tex;
}
/**
 * 나무 기둥 팔에 사슬로 매단 검은 간판. ry: 간판 앞면이 보는 방향 (0 이면 +z 쪽에서 읽힌다).
 * content: { title: ['불멍', '캠핑장'], small: ['BULMEONG', 'CAMP'], lines: [{ text, dir }] }  (dir 은 앞면 기준)
 */
export function hangingSign(scene, x, z, ry, content, { w = 1.15, h = 1.45, height = 3.1, arm = 1.55 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const wood = toon('#7a4e2e'), iron = toon('#2b2a28');
  const add = (m, px, py, pz) => { m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.Mesh(new THREE.BoxGeometry(0.2, height, 0.2), wood), 0, height / 2, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(arm + 0.3, 0.17, 0.17), wood), (arm + 0.3) / 2 - 0.15, height - 0.3, 0);
  const brace = add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.09), wood), 0.24, height - 0.58, 0); brace.rotation.z = Math.PI / 4;
  const cx = arm * 0.58, top = height - 0.38, chain = 0.34;
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 5; k++) { // 사슬 고리
      const link = add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), iron), cx + sx * (w / 2 - 0.1), top - 0.04 - k * (chain / 5), 0);
      link.rotation.y = k % 2 ? Math.PI / 2 : 0;
    }
  }
  const mat = (mirror) => toon('#ffffff', { map: boardTexture(w, h, content, mirror), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.28 });
  const edge = toon('#1d1b19');
  const fm = mat(false); fm.emissiveMap = fm.map;
  const bm = mat(true); bm.emissiveMap = bm.map;
  add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [edge, edge, edge, edge, fm, bm]), cx, top - chain - h / 2, 0);
  scene.add(g);
  return g;
}

/** 작은 검은 이름판 텍스처 (방명록 같은 짧은 팻말) */
export function darkPlateTexture(text, { w = 384, h = 126 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  onFont(() => {
    const g = cv.getContext('2d');
    g.fillStyle = '#262320'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(239,226,196,0.55)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#efe2c4'; g.font = `${Math.round(h * 0.42)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    tex.needsUpdate = true;
  });
  return tex;
}
