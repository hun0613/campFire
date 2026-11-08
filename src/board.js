// 캠핑장 소식 게시판: 광장 입구(방명록 맞은편)에 세운 나무 게시판
// - 앞면은 캔버스로 그린다. 관리실에서 게시한 공지를 몇 초마다 번갈아 보여 주고, 공지가 없으면 불멍 캠핑장 로고를 보여 준다
// - 위에 작은 랜턴, 멀리서도 보이는 떠 있는 표시
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toon, glow, radialTexture } from './toon.js';

const KIND = {
  notice: { label: '📌 공지', color: '#e8682a' },
  release: { label: '✨ 업데이트', color: '#7a5bd6' },
  guestbook: { label: '📖 방명록', color: '#3f8f5a' },
};
const ROTATE_SEC = 7;

export class NoticeBoard {
  /** @param {{x:number,z:number}} pos */
  constructor(scene, pos) {
    this.pos = new THREE.Vector3(pos.x, 0, pos.z);
    this.items = [];
    this.idx = 0;
    this.t = 0;
    this.cardT = 0;

    const root = new THREE.Group();
    root.position.copy(this.pos);
    root.rotation.y = 0; // 광장 입구(남쪽)를 정면으로 본다 (방명록과 나란히)
    root.scale.setScalar(1.65);
    this.root = root;

    const wood = toon('#8a5a36'), dark = toon('#6b4a2b');
    // 기둥 두 개 + 가로대
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 2.2, 7), dark);
      post.position.set(s * 0.98, 1.1, 0);
      root.add(post);
    }
    // 게시판 틀
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.32, 0.09), wood);
    frame.position.y = 1.35;
    root.add(frame);
    // 앞면 (캔버스)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 512;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.2),
      toon('#ffffff', { map: this.tex, emissive: new THREE.Color('#fff0d6'), emissiveIntensity: 0.12 }),
    );
    face.position.set(0, 1.35, 0.047);
    root.add(face);
    // 작은 지붕
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.42), dark);
    roof.position.set(0, 2.12, 0.08);
    roof.rotation.x = -0.18;
    root.add(roof);
    // 지붕 밑 랜턴
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.14), glow('#ffc674', 2.2));
    lantern.position.set(-0.86, 2.0, 0.22); // 판을 가리지 않게 모서리에
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb766', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.8);
    halo.position.copy(lantern.position);
    this.halo = halo;
    root.add(lantern, halo);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(root);

    // 실제 조명은 LightPool 이 가까이 있을 때만 켠다
    const front = new THREE.Vector3(0, 0, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y);
    this.lightSpot = {
      pos: new THREE.Vector3(pos.x + front.x, 1.8, pos.z + front.z), color: new THREE.Color('#ffcf8a'), distance: 5,
      intensity: () => 1.8 + Math.sin(this.t * 2.1) * 0.2,
    };

    // 멀리서도 보이는 떠 있는 표시
    const wrap = document.createElement('div');
    const el = document.createElement('div');
    el.className = 'gb-tag board-tag';
    el.innerHTML = '<span class="gb-tag-icon">📌</span><b>캠핑장 소식</b><small>새 소식을 확인해요</small>';
    wrap.appendChild(el);
    this.tagEl = el;
    this.tag = new CSS2DObject(wrap);
    this.tag.position.set(pos.x, 5.0, pos.z); // 게시판 머리띠를 가리지 않게 위로
    scene.add(this.tag);

    this.draw();
    document.fonts?.ready.then(() => this.draw()); // Jua 글꼴을 받은 뒤 다시 그린다
  }

  /** @param {{kind:string,title:string,text:string,reply?:string}[]} items */
  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
    this.tagEl.querySelector('small').textContent = this.items.length ? `새 소식 ${this.items.length}개` : '오늘 밤도 따뜻하게';
    this.idx = Math.min(this.idx, Math.max(0, this.items.length - 1));
    this.cardT = 0;
    this.draw();
  }

  draw() {
    const g = this.canvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height;
    const it = this.items[this.idx];
    if (!it) { this.drawLogo(g, W, H); this.tex.needsUpdate = true; return; }
    // 코르크판 느낌의 바탕
    g.fillStyle = '#f3e1bd';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(160,110,60,0.10)';
    for (let i = 0; i < 260; i++) g.fillRect((i * 97) % W, (i * 53) % H, 3, 3);
    // 머리띠
    g.fillStyle = '#6b4a2b';
    g.fillRect(0, 0, W, 78);
    g.fillStyle = '#fff3dc';
    g.font = '44px Jua, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('📌 캠핑장 소식', W / 2, 42);
    // 종이 쪽지
    g.save();
    g.translate(W / 2, 300);
    g.rotate(((this.idx % 3) - 1) * 0.012);
    g.fillStyle = '#fffaf0';
    g.shadowColor = 'rgba(80,50,20,0.25)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.fillRect(-330, -180, 660, 360);
    g.restore();
    // 압정
    g.fillStyle = '#e04a3a';
    g.beginPath(); g.arc(W / 2, 132, 11, 0, Math.PI * 2); g.fill();
    // 멀리서도 읽히게 큰 제목, 그 아래 내용 한두 줄 (자세한 내용은 가까이 가서 「소식 보기」)
    g.textAlign = 'left';
    g.fillStyle = '#3e2c1c';
    g.font = '70px Jua, sans-serif';
    const tl = wrap(g, it.title || it.text || '', 620, 2);
    tl.forEach((ln, i) => g.fillText(ln, 70, 200 + i * 84));
    if (it.title && it.text) {
      g.fillStyle = '#6a5038';
      g.font = '38px Jua, sans-serif';
      wrap(g, it.text, 620, tl.length > 1 ? 1 : 2).forEach((ln, i) => g.fillText(ln, 70, 200 + tl.length * 84 + 8 + i * 50));
    }
    // 쪽 번호 점
    const n = this.items.length;
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        g.fillStyle = i === this.idx ? '#6b4a2b' : 'rgba(107,74,43,0.3)';
        g.beginPath(); g.arc(W / 2 + (i - (n - 1) / 2) * 26, H - 26, 7, 0, Math.PI * 2); g.fill();
      }
    }
    this.tex.needsUpdate = true;
  }

  // 공지가 없을 때: 밤하늘 바탕에 모닥불과 「불멍 캠핑장」 로고
  drawLogo(g, W, H) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1d44');
    sky.addColorStop(1, '#3a2340');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // 별
    for (let i = 0; i < 70; i++) {
      const x = (i * 137.5) % W, y = (i * 71.3) % (H * 0.55);
      g.fillStyle = `rgba(255,244,214,${0.35 + ((i * 7) % 10) / 16})`;
      g.fillRect(x, y, i % 9 === 0 ? 4 : 2, i % 9 === 0 ? 4 : 2);
    }
    // 모닥불 빛
    const cx = W / 2, cy = H * 0.5;
    const glowG = g.createRadialGradient(cx, cy + 20, 0, cx, cy + 20, 210);
    glowG.addColorStop(0, 'rgba(255,170,80,0.55)');
    glowG.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = glowG;
    g.fillRect(0, 0, W, H);
    // 장작
    g.fillStyle = '#6b4226';
    g.save(); g.translate(cx, cy + 70); g.rotate(0.35); g.fillRect(-90, -13, 180, 26); g.restore();
    g.save(); g.translate(cx, cy + 70); g.rotate(-0.35); g.fillRect(-90, -13, 180, 26); g.restore();
    // 불꽃 (바깥 주황 → 안쪽 노랑)
    const flame = (h, w, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(cx, cy + 60 - h);
      g.bezierCurveTo(cx + w, cy + 10 - h * 0.35, cx + w * 0.9, cy + 60, cx, cy + 62);
      g.bezierCurveTo(cx - w * 0.9, cy + 60, cx - w, cy + 10 - h * 0.35, cx, cy + 60 - h);
      g.fill();
    };
    flame(150, 70, '#ff7a2a');
    flame(105, 46, '#ffb547');
    flame(62, 26, '#fff0b0');
    // 로고 글자
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '86px Jua, sans-serif';
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(40,20,10,0.55)';
    g.strokeText('불멍 캠핑장', cx, H - 92);
    g.fillStyle = '#ffe9c2';
    g.fillText('불멍 캠핑장', cx, H - 92);
    g.font = '30px Jua, sans-serif';
    g.fillStyle = 'rgba(255,233,194,0.75)';
    g.fillText('오늘 밤도 따뜻하게 쉬어 가요', cx, H - 34);
  }

  /** @param {THREE.Vector3|{x:number,z:number}} [mePos] */
  update(dt, mePos) {
    this.t += dt;
    this.cardT += dt;
    if (this.items.length > 1 && this.cardT > ROTATE_SEC) {
      this.cardT = 0;
      this.idx = (this.idx + 1) % this.items.length;
      this.draw();
    }
    const near = mePos ? Math.hypot(mePos.x - this.pos.x, mePos.z - this.pos.z) < 2.2 : false;
    if (this._near !== near) { this._near = near; this.tagEl.classList.toggle('near', near); }
    this.halo.material.opacity = 0.4 + Math.sin(this.t * 2.1) * 0.06;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 한글은 글자 단위로 줄을 나눈다. 넘치면 마지막 줄 끝에 …
function wrap(g, text, maxW, maxLines) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch.trimStart(); } else cur += ch;
    }
    lines.push(cur);
  }
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines);
    let last = out[maxLines - 1];
    while (last && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    out[maxLines - 1] = `${last}…`;
    return out;
  }
  return lines;
}
