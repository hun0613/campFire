import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TENTS, STUMPS, NPC, WOODYARD, BOUNDS } from '../shared/config.js';

// 목적지 안내: 멀리서 보이는 빛기둥 + 표지, 미니맵

const PILLAR_VS = `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PILLAR_FS = `uniform vec3 uColor; uniform float uTime; uniform float uOn; varying float vY;
void main(){
  float a = pow(1.0 - vY, 1.6) * (0.35 + 0.65 * uOn) * (0.8 + 0.2 * sin(uTime * 3.0 - vY * 12.0));
  gl_FragColor = vec4(uColor * (1.0 + uOn), a * 0.55);
}`;

function makeBeacon(scene, { x, z, color, icon, title, sub }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 26, 20, 1, true), mat);
  pillar.position.set(x, 13, z);
  scene.add(pillar);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.6, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  scene.add(ring);

  // 바깥 div 는 CSS2DRenderer 가 transform 으로 위치를 잡으므로, 애니메이션은 안쪽(.beacon)에만 건다
  const wrap = document.createElement('div');
  const el = document.createElement('div');
  el.className = 'beacon';
  el.style.setProperty('--c', color);
  el.innerHTML = `<div class="b-icon">${icon}</div><div class="b-title">${title}</div><div class="b-sub">${sub}</div><div class="b-dist"></div>`;
  wrap.appendChild(el);
  const label = new CSS2DObject(wrap);
  label.position.set(x, 3.8, z);
  scene.add(label);
  return { x, z, mat, ring, el, distEl: el.querySelector('.b-dist') };
}

export class Guide {
  constructor(scene) {
    this.beacons = {
      wood: makeBeacon(scene, { x: WOODYARD.x, z: WOODYARD.z, color: '#ffa040', icon: '🪓', title: '장작 패는 곳', sub: '동쪽 · 통나무 앞에서 E' }),
      npc: makeBeacon(scene, { x: NPC.x + 1, z: NPC.z, color: '#b38cff', icon: '✨', title: '루미의 가루 공방', sub: '서쪽 · 장작 5개 → 마법 가루' }),
    };

    // 미니맵
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio, 2);
    this.cw = 230; this.ch = 150;
    this.canvas.width = this.cw * dpr;
    this.canvas.height = this.ch * dpr;
    this.ctx.scale(dpr, dpr);
    this.time = 0;
  }

  /** target: {x, z, kind:'wood'|'npc'|'pit', label} | null */
  update(dt, { me, target, pits, remotes, camYaw }) {
    this.time += dt;
    for (const [k, b] of Object.entries(this.beacons)) {
      const on = target?.kind === k ? 1 : 0;
      b.mat.uniforms.uTime.value = this.time;
      b.mat.uniforms.uOn.value += (on - b.mat.uniforms.uOn.value) * Math.min(1, dt * 4);
      b.ring.material.opacity = 0.25 + 0.35 * on + Math.sin(this.time * 3) * 0.1 * on;
      b.ring.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.05 * on);
      b.el.classList.toggle('on', !!on);
      if (me) {
        const d = Math.round(Math.hypot(me.x - b.x, me.z - b.z));
        if (b._d !== d) { b._d = d; b.distEl.textContent = `${d}m`; }
      }
    }

    this.#drawMap(me, target, pits, remotes, camYaw);
  }

  #drawMap(me, target, pits, remotes, camYaw) {
    const g = this.ctx;
    const W = this.cw, H = this.ch, pad = 8;
    const sx = (W - pad * 2) / (BOUNDS.maxX - BOUNDS.minX);
    const sz = (H - pad * 2) / (BOUNDS.maxZ - BOUNDS.minZ);
    const X = (x) => pad + (x - BOUNDS.minX) * sx;
    const Z = (z) => pad + (z - BOUNDS.minZ) * sz;
    g.clearRect(0, 0, W, H);
    // 바탕
    g.fillStyle = '#2f5a35';
    g.beginPath(); g.roundRect(0, 0, W, H, 14); g.fill();
    // 길
    g.strokeStyle = '#a98a5e'; g.lineCap = 'round';
    g.lineWidth = 4; g.beginPath(); g.moveTo(X(-50), Z(0)); g.lineTo(X(50), Z(0)); g.stroke();
    g.lineWidth = 2.5;
    for (const t of TENTS) { g.beginPath(); g.moveTo(X(t.x), Z(0)); g.lineTo(X(t.x), Z(Math.sign(t.z) * 22)); g.stroke(); }
    g.fillStyle = '#a98a5e';
    g.beginPath(); g.arc(X(0), Z(0), 11.5 * sx, 0, Math.PI * 2); g.fill();
    // 텐트
    g.fillStyle = '#f2e6cf';
    for (const t of TENTS) { g.beginPath(); g.arc(X(t.x), Z(t.z), 3 * sx, 0, Math.PI * 2); g.fill(); }
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
      g.font = '11px Jua, sans-serif';
      g.fillStyle = '#fff3dc';
      g.fillText(label, X(x), Z(z) + 18);
      g.font = '15px sans-serif';
    };
    place(WOODYARD.x, WOODYARD.z, '🪓', '장작', target?.kind === 'wood', '#ffa040');
    place(NPC.x + 1, NPC.z, '✨', '루미', target?.kind === 'npc', '#b38cff');
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
    g.fillStyle = 'rgba(255,243,220,0.7)'; g.font = '10px Jua, sans-serif';
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
  if (inv.wood >= W && inv.canPowder && inv.powders.length < CFG.MAX_POWDERS) return { x: NPC.x + 1, z: NPC.z, kind: 'npc', label: '루미' };
  if (inv.wood >= W) {
    const p = near(pitList.filter((q) => q.state === 'empty'));
    if (p) return { x: p.pos.x, z: p.pos.z, kind: 'pit', label: '빈 화로' };
  }
  if (inv.powders.length) {
    const p = near(pitList.filter((q) => q.state === 'lit' && q.freeSeats() > 0));
    if (p) return { x: p.pos.x, z: p.pos.z, kind: 'pit', label: '타오르는 모닥불' };
  }
  // 가장 가까운 통나무
  const s = STUMPS.reduce((b, q) => (!b || Math.hypot(me.x - q.x, me.z - q.z) < Math.hypot(me.x - b.x, me.z - b.z) ? q : b), null);
  return { x: s.x, z: s.z, kind: 'wood', label: '장작 패는 곳' };
}

