import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CFG, TENTS, STUMPS, NPC, KEEPER, WOODYARD, BOUNDS, FENCE, GATES, TRAIL, SPOTS, ZONES, zonePath, LAKE, POND, STREAM, HILL, trailCurve, GUESTBOOK, BOARD, BALLOON } from '../shared/config.js';

// 숲길 · 개울 곡선 (지도 · 레이더에서 그린다)
const TRAIL_PTS = trailCurve(TRAIL.loop, true, 3);
const SPUR_PTS = TRAIL.spurs.map((sp) => trailCurve(sp, false, 3));
const STREAM_PTS = trailCurve(STREAM, false, 3);
// 숲길 구간 풍경 (지도에 색 띠로)
const ZONE_PTS = ZONES.map((z) => ({ kind: z.kind, pts: zonePath(z, 0.12) }));
const ZONE_COLOR = { kochia: 'rgba(225, 95, 80, 0.7)', muhly: 'rgba(232, 140, 185, 0.7)', reed: 'rgba(205, 180, 115, 0.7)', daisy: 'rgba(235, 238, 215, 0.6)', cherry: 'rgba(255, 182, 211, 0.75)' };

// 목적지 안내: 멀리서 보이는 빛기둥 + 표지, 미니맵

const PILLAR_VS = `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PILLAR_FS = `uniform vec3 uColor; uniform float uTime; uniform float uOn; varying float vY;
void main(){
  float a = pow(1.0 - vY, 1.6) * (0.35 + 0.65 * uOn) * (0.8 + 0.2 * sin(uTime * 3.0 - vY * 12.0));
  gl_FragColor = vec4(uColor * (1.0 + 0.4 * uOn), a * 0.28); // 은은하게 (예전 0.55)
}`;

function makeBeacon(scene, { x, z, color, icon, title, sub }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 26, 20, 1, true), mat);
  pillar.position.set(x, 13, z);
  pillar.userData.ds = 'guide-beacon'; // 디자인 시스템 이름표
  scene.add(pillar);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.6, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  ring.userData.ds = 'guide-beacon'; // 디자인 시스템 이름표
  scene.add(ring);

  // 바깥 div 는 CSS2DRenderer 가 transform 으로 위치를 잡으므로, 애니메이션은 안쪽(.beacon)에만 건다
  const wrap = document.createElement('div');
  const el = document.createElement('div');
  el.className = 'beacon';
  el.style.setProperty('--c', color);
  // 한 줄 알약: 아이콘 · 이름 · 거리. 긴 설명은 지금 가야 할 곳(.on)일 때만
  el.innerHTML = `<div class="b-row"><span class="b-icon">${icon}</span><span class="b-title">${title}</span><span class="b-dist"></span></div><div class="b-sub">${sub}</div>`;
  wrap.appendChild(el);
  const label = new CSS2DObject(wrap);
  label.position.set(x, 3.8, z);
  label.userData.ds = 'guide-beacon'; // 디자인 시스템 이름표
  scene.add(label);
  return { x, z, mat, ring, el, distEl: el.querySelector('.b-dist') };
}

export class Guide {
  constructor(scene) {
    this.beacons = {
      wood: makeBeacon(scene, { x: WOODYARD.x, z: WOODYARD.z, color: '#ffa040', icon: '🪓', title: '장작 패는 곳', sub: '동쪽 장작 마당 · 통나무 앞에서 E' }),
      npc: makeBeacon(scene, { x: NPC.x + NPC.front.x, z: NPC.z + NPC.front.z, color: '#b38cff', icon: '✨', title: '루미의 가루 공방', sub: '장작 패는 곳 길 건너 · 마법 가루 · 루미의 부탁' }),
      keeper: makeBeacon(scene, { x: KEEPER.x, z: KEEPER.z + 1.6, color: '#8fc46a', icon: '📦', title: '보리의 장작 창고', sub: '장작 패는 곳 북서쪽 · 장작 맡기기 · 찾기' }),
    };

    // 미니맵
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio, 2);
    this.cw = 230; this.ch = Math.round(230 * (BOUNDS.maxZ - BOUNDS.minZ) / (BOUNDS.maxX - BOUNDS.minX)); // 숲길까지 (가로세로 비율 그대로)
    this.canvas.width = this.cw * dpr;
    this.canvas.height = this.ch * dpr;
    this.ctx.scale(dpr, dpr);
    this.time = 0;
  }

  /** target: {x, z, kind:'wood'|'npc'|'keeper'|'pit', label} | null */
  update(dt, { me, target, pits, remotes, camYaw }) {
    this.time += dt;
    for (const [k, b] of Object.entries(this.beacons)) {
      const on = target?.kind === k ? 1 : 0;
      b.mat.uniforms.uTime.value = this.time;
      b.mat.uniforms.uOn.value += (on - b.mat.uniforms.uOn.value) * Math.min(1, dt * 4);
      b.ring.material.opacity = 0.15 + 0.22 * on + Math.sin(this.time * 3) * 0.06 * on;
      b.ring.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.05 * on);
      b.el.classList.toggle('on', !!on);
      // 지금 할 일이 아닌 길잡이는 가까울 때(20m 안)만 보인다
      if (me) b.el.classList.toggle('far', !on && Math.hypot(me.x - b.x, me.z - b.z) > 20);
      if (me) {
        const d = Math.round(Math.hypot(me.x - b.x, me.z - b.z));
        if (b._d !== d) {
          b._d = d; b.distEl.textContent = `${d}m`;
          b.el.dataset.d = d;
          // 멀수록 작게 (12m 안 1배 → 60m 밖 0.7배), 도착하면(8m 안) 숨긴다 — 실제 장소가 보이니까
          b.el.style.setProperty('--s', (d <= 12 ? 1 : Math.max(0.7, 1 - ((d - 12) / 48) * 0.3)).toFixed(2));
          b.el.classList.toggle('here', d < 8);
        }
      }
    }

    this.#drawMap(me, target, pits, remotes, camYaw);
    if (document.body.classList.contains('map-auto') && !document.body.classList.contains('map-open')) this.#drawRadar(me, target, pits, remotes, camYaw);
  }

  // ---------------------------------------------------------------- 원형 레이더 (걸을 때)
  // 위쪽 = 내가 바라보는(카메라) 방향. 반경 RANGE m 안만 그리고, 갈 곳이 밖이면 테두리에 화살표 + 거리
  #drawRadar(me, target, pits, remotes, camYaw) {
    if (!me) return;
    const cv = this.radar || (this.radar = document.getElementById('radar'));
    if (!cv) return;
    const S = 92, dpr = Math.min(devicePixelRatio, 2);
    if (cv.width !== S * dpr) { cv.width = cv.height = S * dpr; this.rctx = cv.getContext('2d'); }
    const g = this.rctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    const C = S / 2, R = S / 2 - 3, RANGE = 24, k = R / RANGE;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // 앞
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);    // 오른쪽
    const P = (x, z) => { const dx = x - me.x, dz = z - me.z; return [C + (dx * rx + dz * rz) * k, C - (dx * fx + dz * fz) * k]; };
    g.save();
    g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(28, 52, 34, 0.62)'; g.fillRect(0, 0, S, S);
    // 길
    g.strokeStyle = 'rgba(214, 186, 140, 0.75)'; g.lineCap = 'round';
    const line = (x1, z1, x2, z2, w) => { const a = P(x1, z1), b = P(x2, z2); g.lineWidth = w * k; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
    // 들판
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const z of ZONE_PTS) {
      g.strokeStyle = ZONE_COLOR[z.kind]; g.lineWidth = 15 * k;
      g.beginPath(); z.pts.forEach((pt, i) => { const [x, y] = P(pt[0], pt[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    }
    // 숲 쉼터: 호수 · 연못 · 개울 · 언덕
    g.fillStyle = 'rgba(70, 120, 170, 0.75)';
    { const [lx, lz] = P(LAKE.x, LAKE.z); g.save(); g.translate(lx, lz); g.rotate(Math.atan2(-fx, rx)); g.beginPath(); g.ellipse(0, 0, LAKE.rx * k, LAKE.rz * k, 0, 0, Math.PI * 2); g.restore(); g.fill(); }
    { const [px, pz] = P(POND.x, POND.z); g.beginPath(); g.arc(px, pz, POND.r * k, 0, Math.PI * 2); g.fill(); }
    const poly = (pts, w, closed) => { g.lineWidth = w * k; g.beginPath(); pts.forEach((pt, i) => { const [x, y] = P(pt[0], pt[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); if (closed) g.closePath(); g.stroke(); };
    g.strokeStyle = 'rgba(70, 120, 170, 0.75)'; poly(STREAM_PTS, 1.8, false);
    g.fillStyle = 'rgba(120, 170, 100, 0.45)';
    { const [hx, hz] = P(HILL.x, HILL.z); g.beginPath(); g.arc(hx, hz, HILL.r * k, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(214, 186, 140, 0.75)';
    poly(TRAIL_PTS, TRAIL.width, true);
    for (const sp of SPUR_PTS) poly(sp, TRAIL.width - 0.3, false);
    line(FENCE.minX - 2, 0, FENCE.maxX + 2, 0, 3.4);
    for (const t of TENTS) line(t.x, 0, t.x, Math.sign(t.z) * 23, 2.2);
    for (const gt of GATES) if (gt.inner) line(gt.inner[0], gt.inner[1], gt.inner[0], gt.inner[2], 2.4); // 모서리 출입구 안쪽 길
    g.fillStyle = 'rgba(214, 186, 140, 0.75)';
    { const [px, pz] = P(0, 0); g.beginPath(); g.arc(px, pz, 11.5 * k, 0, Math.PI * 2); g.fill(); }
    // 텐트 · 화로
    g.fillStyle = 'rgba(242, 230, 207, 0.9)';
    for (const t of TENTS) { const [x, y] = P(t.x, t.z); g.beginPath(); g.arc(x, y, CFG.TENT_R * k, 0, Math.PI * 2); g.fill(); }
    for (const p of pits) {
      const [x, y] = P(p.pos.x, p.pos.z);
      g.fillStyle = p.state === 'lit' ? '#ff8a2a' : p.state === 'stacked' ? '#c98a4a' : 'rgba(110, 104, 118, 0.9)';
      g.beginPath(); g.arc(x, y, p.state === 'lit' ? 3.2 : 2.2, 0, Math.PI * 2); g.fill();
    }
    // 장소 아이콘
    g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [x, z, ic] of [[WOODYARD.x, WOODYARD.z, '🪓'], [NPC.x + NPC.front.x, NPC.z + NPC.front.z, '✨'], [KEEPER.x, KEEPER.z, '📦'], [GUESTBOOK.x, GUESTBOOK.z, '📖'], ...SPOTS.map((sp) => [sp.x, sp.z, sp.icon])]) {
      const [px, py] = P(x, z); g.fillText(ic, px, py);
    }
    // 다른 사람
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const r of remotes) { const [x, y] = P(r.x, r.z); g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // 갈 곳: 안이면 깜빡이는 동그라미, 밖이면 테두리 화살표 + 거리
    if (target) {
      const [tx, ty] = P(target.x, target.z);
      const dx = tx - C, dy = ty - C, dd = Math.hypot(dx, dy);
      const pulse = 1 + Math.sin(this.time * 5) * 0.2;
      g.strokeStyle = '#ffc46b'; g.fillStyle = '#ffc46b';
      if (dd < R - 6) {
        g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, 5 * pulse, 0, Math.PI * 2); g.stroke();
      } else {
        const ux = dx / dd, uy = dy / dd, ax = C + ux * (R - 7), ay = C + uy * (R - 7);
        g.save(); g.translate(ax, ay); g.rotate(Math.atan2(uy, ux));
        g.beginPath(); g.moveTo(6 * pulse, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill();
        g.restore();
        const m = Math.round(Math.hypot(target.x - me.x, target.z - me.z));
        g.font = '9px Moneygraphy, sans-serif'; g.fillStyle = '#fff3dc';
        g.fillText(`${m}m`, C + ux * (R - 19), C + uy * (R - 19));
      }
    }
    // 나 (가운데, 캐릭터가 향한 쪽)
    const hx = Math.sin(me.ry), hz = Math.cos(me.ry);
    const ang = Math.atan2(-(hx * fx + hz * fz), hx * rx + hz * rz);
    g.save(); g.translate(C, C); g.rotate(ang);
    g.fillStyle = '#ffe9b0'; g.strokeStyle = 'rgba(60, 40, 20, .8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-2, 0); g.lineTo(-4, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // 북쪽 표시
    { const nx = -rz, ny = fz; const nd = Math.hypot(nx, ny) || 1; g.font = '9px Moneygraphy, sans-serif'; g.fillStyle = 'rgba(255, 243, 220, .85)'; g.fillText('N', C + (nx / nd) * (R - 6), C - (-ny / nd) * (R - 6)); }
    // 테두리
    g.strokeStyle = 'rgba(255, 248, 232, .55)'; g.lineWidth = 2; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.stroke();
  }

  #drawMap(me, target, pits, remotes, camYaw) {
    const g = this.ctx;
    const W = this.cw, H = this.ch, pad = 8;
    const sx = Math.min((W - pad * 2) / (BOUNDS.maxX - BOUNDS.minX), (H - pad * 2) / (BOUNDS.maxZ - BOUNDS.minZ));
    const sz = sx;
    const X = (x) => pad + (x - BOUNDS.minX) * sx;
    const Z = (z) => pad + (z - BOUNDS.minZ) * sz;
    g.clearRect(0, 0, W, H);
    // 바탕
    g.fillStyle = '#2f5a35';
    g.beginPath(); g.roundRect(0, 0, W, H, 14); g.fill();
    // 캠핑장(울타리 안)은 조금 밝게, 바깥은 숲
    g.fillStyle = '#3d6f42';
    g.fillRect(X(FENCE.minX - 1), Z(FENCE.minZ - 1), (FENCE.maxX - FENCE.minX + 2) * sx, (FENCE.maxZ - FENCE.minZ + 2) * sz);
    // 들판: 핑크뮬리 · 갈대
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const z of ZONE_PTS) {
      g.strokeStyle = ZONE_COLOR[z.kind]; g.lineWidth = 15 * sx;
      g.beginPath(); z.pts.forEach((pt, i) => (i ? g.lineTo(X(pt[0]), Z(pt[1])) : g.moveTo(X(pt[0]), Z(pt[1])))); g.stroke();
    }
    // 숲 쉼터: 언덕 · 호수 · 연못 · 개울
    g.fillStyle = '#4f8a4a';
    g.beginPath(); g.arc(X(HILL.x), Z(HILL.z), HILL.r * sx, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4f86b8';
    g.beginPath(); g.ellipse(X(LAKE.x), Z(LAKE.z), LAKE.rx * sx, LAKE.rz * sz, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(X(POND.x), Z(POND.z), POND.r * sx, 0, Math.PI * 2); g.fill();
    const poly = (pts, closed) => { g.beginPath(); pts.forEach((pt, i) => (i ? g.lineTo(X(pt[0]), Z(pt[1])) : g.moveTo(X(pt[0]), Z(pt[1])))); if (closed) g.closePath(); g.stroke(); };
    g.strokeStyle = '#4f86b8'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2; poly(STREAM_PTS, false);
    // 숲길 (점선 느낌의 흙길)
    g.strokeStyle = '#b89668'; g.lineWidth = 2.6; poly(TRAIL_PTS, true);
    g.lineWidth = 2; for (const sp of SPUR_PTS) poly(sp, false);
    // 길
    g.strokeStyle = '#a98a5e'; g.lineCap = 'round';
    g.lineWidth = 4; g.beginPath(); g.moveTo(X(FENCE.minX - 1), Z(0)); g.lineTo(X(FENCE.maxX + 1), Z(0)); g.stroke();
    g.lineWidth = 2.5;
    for (const t of TENTS) { g.beginPath(); g.moveTo(X(t.x), Z(0)); g.lineTo(X(t.x), Z(Math.sign(t.z) * 22)); g.stroke(); }
    g.fillStyle = '#a98a5e';
    g.beginPath(); g.arc(X(0), Z(0), 11.5 * sx, 0, Math.PI * 2); g.fill();
    // 텐트
    g.fillStyle = '#f2e6cf';
    for (const t of TENTS) { g.beginPath(); g.arc(X(t.x), Z(t.z), CFG.TENT_R * sx, 0, Math.PI * 2); g.fill(); }
    // 화로
    for (const p of pits) {
      const lit = p.state === 'lit', st = p.state === 'stacked';
      g.fillStyle = lit ? '#ff8a2a' : st ? '#c98a4a' : '#55505a';
      g.beginPath(); g.arc(X(p.pos.x), Z(p.pos.z), lit ? 3.2 : 2.2, 0, Math.PI * 2); g.fill();
      if (lit) { g.fillStyle = 'rgba(255,150,60,0.3)'; g.beginPath(); g.arc(X(p.pos.x), Z(p.pos.z), 6, 0, Math.PI * 2); g.fill(); }
    }
    // 장소 아이콘
    g.font = '15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const pulse = 1 + Math.sin(this.time * 4) * 0.25;
    const place = (x, z, icon, label, on, color) => {
      if (on) {
        g.strokeStyle = color; g.lineWidth = 2;
        g.beginPath(); g.arc(X(x), Z(z), 11 * pulse, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(255,248,232,0.95)';
      g.beginPath(); g.arc(X(x), Z(z), 9, 0, Math.PI * 2); g.fill();
      g.fillText(icon, X(x), Z(z) + 1);
      g.font = '11px Moneygraphy, sans-serif';
      g.fillStyle = '#fff3dc';
      g.fillText(label, X(x), Z(z) + 18);
      g.font = '15px sans-serif';
    };
    place(WOODYARD.x, WOODYARD.z, '🪓', '장작', target?.kind === 'wood', '#ffa040');
    place(NPC.x + NPC.front.x, NPC.z + NPC.front.z, '✨', '루미', target?.kind === 'npc', '#b38cff');
    place(KEEPER.x, KEEPER.z, '📦', '', target?.kind === 'keeper', '#8fc46a'); // 장작 아이콘과 가까워 글자는 생략
    place(GUESTBOOK.x, GUESTBOOK.z, '📖', '방명록', false, '#ffc46b');
    place(BOARD.x, BOARD.z, '📌', '', false, '#ffc46b'); // 방명록과 가까워 글자는 생략
    place(BALLOON.camp.x, BALLOON.camp.z, '🎈', '아레나', false, '#ff9ad8'); // 🎤 불멍 아레나행 열기구 승강장
    for (const sp of SPOTS) place(sp.x, sp.z, sp.icon, sp.name, target?.kind === 'spot' && target.id === sp.id, '#9fd0ff');
    if (target?.kind === 'pit') {
      g.strokeStyle = '#ffc46b'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(target.x), Z(target.z), 7 * pulse, 0, Math.PI * 2); g.stroke();
    }
    // 다른 플레이어
    g.fillStyle = '#ffffff';
    for (const r of remotes) { g.beginPath(); g.arc(X(r.x), Z(r.z), 2.2, 0, Math.PI * 2); g.fill(); }
    // 나
    if (me) {
      // 목적지 점선
      if (target) {
        g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,196,107,0.8)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(me.x), Z(me.z)); g.lineTo(X(target.x), Z(target.z)); g.stroke();
        g.setLineDash([]);
      }
      // 시야 방향 (카메라가 보는 쪽)
      const va = Math.atan2(-Math.cos(camYaw), -Math.sin(camYaw));
      g.fillStyle = 'rgba(255,220,150,0.18)';
      g.beginPath(); g.moveTo(X(me.x), Z(me.z));
      g.arc(X(me.x), Z(me.z), 22, va - 0.5, va + 0.5);
      g.closePath(); g.fill();
      g.save();
      g.translate(X(me.x), Z(me.z));
      g.rotate(-me.ry + Math.PI);
      g.fillStyle = '#ff9d3c'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 4.5); g.lineTo(0, 2.5); g.lineTo(-4.5, 4.5); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    // 방위
    g.fillStyle = 'rgba(255,243,220,0.7)'; g.font = '10px Moneygraphy, sans-serif';
    g.fillText('N', W / 2, 7);
  }
}

/** 현재 진행 단계에 맞는 목적지 */
export function pickTarget({ me, inv, sitting, pitList, myId, CFG }) {
  if (!me || sitting) return null;
  const W = CFG.WOOD_PER_FIRE;
  const near = (list) => list.reduce((b, p) => {
    const d = Math.hypot(me.x - p.pos.x, me.z - p.pos.z);
    return !b || d < b.d ? { p, d } : b;
  }, null)?.p;
  const mine = pitList.find((p) => p.owner === myId && p.state === 'stacked');
  if (mine) return { x: mine.pos.x, z: mine.pos.z, kind: 'pit', label: '쌓아둔 장작' };
  const lumi = { x: NPC.x + NPC.front.x, z: NPC.z + NPC.front.z, kind: 'npc', label: '루미' };
  if (inv.quest?.done) return lumi; // 루미의 부탁을 마쳤으면 선물 받으러
  // 손이 가득 차면 창고로 (창고도 가득이면 화로로)
  if (inv.wood >= CFG.MAX_WOOD && (inv.stored || 0) < CFG.MAX_STORED) return { x: KEEPER.x, z: KEEPER.z + 1.6, kind: 'keeper', label: '보리의 장작 창고' };
  if (inv.wood >= W) {
    const p = near(pitList.filter((q) => q.state === 'empty'));
    if (p) return { x: p.pos.x, z: p.pos.z, kind: 'pit', label: '빈 화로' };
  }
  if (!inv.powders.length) return lumi; // 가루가 없으면 루미에게 (장작 없이 3개까지 채워 준다)
  if (inv.powders.length) {
    const p = near(pitList.filter((q) => q.state === 'lit' && q.freeSeats() > 0));
    if (p) return { x: p.pos.x, z: p.pos.z, kind: 'pit', label: '타오르는 모닥불' };
  }
  // 가장 가까운 통나무
  const s = STUMPS.reduce((b, q) => (!b || Math.hypot(me.x - q.x, me.z - q.z) < Math.hypot(me.x - b.x, me.z - b.z) ? q : b), null);
  return { x: s.x, z: s.z, kind: 'wood', label: '장작 패는 곳' };
}

