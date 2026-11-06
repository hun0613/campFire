import * as THREE from 'three';

let gradient = null;
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([110, 190, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map();
/** 부드러운 셀 셰이딩 재질. opts 가 없으면 색상별로 캐시한다. */
export function toon(color, opts) {
  if (!opts) {
    const key = String(color);
    if (!cache.has(key)) cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() }));
    return cache.get(key);
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
}

/** 빛나는(블룸) 재질: 색에 배율을 곱해 HDR 로 만든다. */
export function glow(color, strength = 3) {
  const c = new THREE.Color(color).multiplyScalar(strength);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: true });
}

let radial = null;
export function radialTexture() {
  if (radial) return radial;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  radial = new THREE.CanvasTexture(cv);
  return radial;
}

/** 표지판용 캔버스 텍스처 */
export function textTexture(text, { w = 512, h = 160, bg = '#f6e3bf', fg = '#6b4a2b', size = 64, border = '#a8794a' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // 나뭇결
  g.strokeStyle = 'rgba(120,80,40,0.12)';
  g.lineWidth = 3;
  for (let y = 12; y < h; y += 18) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 3);
    g.stroke();
  }
  g.strokeStyle = border;
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg;
  g.font = `${size}px Jua, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
