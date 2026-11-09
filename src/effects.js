import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
const WHITE = new THREE.Color('#ffffff');

export class Effects {
  constructor(glowParticles, softParticles) {
    this.g = glowParticles;
    this.s = softParticles;
    this.emitters = [];
  }

  /** 가루를 뿌렸을 때의 연출. center: 화로 바닥 위치 */
  play(type, center, colorHex) {
    const color = new THREE.Color(colorHex);
    const hi = color.clone().multiplyScalar(1.8);
    const pale = color.clone().lerp(WHITE, 0.25).multiplyScalar(1.3);
    const c = center;
    // 공통: 펑!
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(1, 3.2);
      this.g.spawn({ x: c.x, y: c.y + 0.6, z: c.z, vx: Math.cos(a) * sp, vy: R(1.5, 4), vz: Math.sin(a) * sp, color: i % 3 ? hi : pale, size: R(0.15, 0.3), life: R(0.6, 1.2), drag: 2.2, grav: -0.5 });
    }
    const durations = { sparkle: 8, spiral: 10, pillar: 7, rings: 10, fireflies: 12, stars: 8, hearts: 10, rainbow: 12,
      aurora: 14, fireworks: 13, petals: 13, galaxy: 14, butterflies: 14 }; // 아래 줄은 ✦ 특별한 가루
    const e = { type, c: c.clone(), color, hi, pale, t: 0, dur: durations[type] || 8, acc: 0, n: 0 };
    this.emitters.push(e);
    if (type === 'sparkle') {
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2;
        const up = R(0.3, 1);
        const sp = R(2.5, 6);
        this.g.spawn({ x: c.x, y: c.y + 0.8, z: c.z, vx: Math.cos(a) * sp * (1 - up * 0.5), vy: up * sp * 1.2, vz: Math.sin(a) * sp * (1 - up * 0.5), color: Math.random() > 0.4 ? hi : pale, size: R(0.08, 0.16), life: R(1.4, 2.6), grav: 4, drag: 0.6 });
      }
    } else if (type === 'fireflies') {
      for (let i = 0; i < 60; i++) this.#firefly(e);
    } else if (type === 'butterflies') {
      for (let i = 0; i < 14; i++) this.#butterfly(e);
    } else if (type === 'galaxy') {
      // 은하수: 화로 위에 두 팔을 가진 별 원반이 천천히 돈다
      for (let i = 0; i < 420; i++) {
        const arm = i % 2, d = Math.pow(Math.random(), 0.7) * 3.4 + 0.2;
        const ang = arm * Math.PI + d * 1.25 + R(-0.35, 0.35);
        const tc = new THREE.Color().setHSL(R(0.62, 0.78), 0.8, R(0.6, 0.85)).multiplyScalar(d < 0.9 ? 1.8 : 1.5);
        this.g.spawn({ x: c.x, y: 3.0 + R(-0.12, 0.12), z: c.z, vy: 0, color: Math.random() > 0.88 ? WHITE.clone().multiplyScalar(1.6) : tc,
          size: R(0.06, 0.16) * (d < 0.9 ? 1.6 : 1), life: R(11, 13.5), shape: Math.random() > 0.9 ? 1 : 0,
          orbit: { cx: c.x, cz: c.z, ang, angVel: 0.55 / (0.6 + d * 0.35), rad: d, radVel: 0 } });
      }
    }
  }

  // 나비 한 마리: 하트 두 개를 옆으로 눕혀 날개처럼 붙이고, 같은 궤도로 함께 날게 한다
  #butterfly(e) {
    const tones = ['#ffd447', '#ff8f3a', '#ff6fb8', '#b26bff', '#55c8ff'];
    const col = new THREE.Color(tones[Math.floor(Math.random() * tones.length)]).multiplyScalar(1.3);
    const orbit = { cx: e.c.x, cz: e.c.z, ang: Math.random() * 6.28, angVel: R(0.35, 0.8) * (Math.random() > 0.5 ? 1 : -1), rad: R(1.0, 3.2), radVel: R(-0.03, 0.05) };
    const y = R(0.8, 2.8), vy = R(0.02, 0.12), life = R(8, 12);
    for (const side of [-1, 1]) {
      this.g.spawn({ x: e.c.x, y, z: e.c.z, vy, color: col, size: R(0.24, 0.3), life, shape: 2, rot: side * 1.35, spin: 0,
        orbit: { ...orbit, rad: orbit.rad + side * 0.07 }, bob: 0.6 });
    }
  }

  #firefly(e) {
    this.g.spawn({
      x: e.c.x, y: R(0.5, 2.6), z: e.c.z, vy: 0,
      color: Math.random() > 0.3 ? e.hi : e.pale, size: R(0.1, 0.18), life: R(6, 11),
      orbit: { cx: e.c.x, cz: e.c.z, ang: Math.random() * 6.28, angVel: R(0.25, 0.7) * (Math.random() > 0.5 ? 1 : -1), rad: R(1.0, 3.4), radVel: R(-0.05, 0.05) },
      bob: 0.5,
    });
  }

  /** 손에서 화로로 날아가는 가루 궤적 */
  arc(from, to, colorHex, T = 0.5) {
    const color = new THREE.Color(colorHex).multiplyScalar(2);
    const g = 9;
    for (let i = 0; i < 36; i++) {
      const tt = T * R(0.85, 1.1);
      const tx = to.x + R(-0.2, 0.2), ty = to.y + R(0, 0.3), tz = to.z + R(-0.2, 0.2);
      this.g.spawn({
        x: from.x, y: from.y, z: from.z,
        vx: (tx - from.x) / tt, vy: (ty - from.y) / tt + 0.5 * g * tt, vz: (tz - from.z) / tt,
        grav: g, color, size: R(0.06, 0.14), life: tt,
      });
    }
  }

  /** 장작 팰 때 나무 조각 */
  chips(pos) {
    const cols = [new THREE.Color('#e2b77d'), new THREE.Color('#b98455'), new THREE.Color('#f3d4a0')];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(1.2, 3);
      this.s.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * sp, vy: R(2, 4.5), vz: Math.sin(a) * sp, grav: 12, color: cols[i % 3], size: R(0.08, 0.16), life: R(0.6, 1.1), shape: 3, spin: R(-8, 8) });
    }
  }

  /** 장작이 생겼을 때: 반으로 쪼개진 조각이 튐 */
  split(pos) {
    const c = new THREE.Color('#d9a66b');
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        this.s.spawn({ x: pos.x + s * 0.1, y: pos.y + R(0, 0.2), z: pos.z, vx: s * R(1.5, 2.5), vy: R(2, 3), vz: R(-0.6, 0.6), grav: 12, color: c, size: R(0.18, 0.26), life: 0.9, shape: 3 });
      }
    }
  }

  /** 모닥불 연기 */
  smoke(pos, intensity) {
    const c = new THREE.Color('#5d5868');
    this.s.spawn({
      x: pos.x + R(-0.15, 0.15), y: pos.y + 1.4, z: pos.z + R(-0.15, 0.15),
      vx: R(-0.1, 0.25), vy: R(0.6, 1.0), vz: R(-0.1, 0.1),
      color: c, size: R(0.5, 0.8), grow: 0.9, life: R(3, 4.5), shape: 3, alpha: 0.18 * intensity,
    });
  }

  /** 불 붙일 때 확 */
  ignite(pos) {
    const c = new THREE.Color('#ffb24a').multiplyScalar(2);
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(0.5, 2.5);
      this.g.spawn({ x: pos.x, y: pos.y + 0.4, z: pos.z, vx: Math.cos(a) * sp, vy: R(1, 4), vz: Math.sin(a) * sp, color: c, size: R(0.1, 0.25), life: R(0.6, 1.4), drag: 1.5, grav: -1 });
    }
  }

  update(dt) {
    const tmp = new THREE.Color();
    for (const e of this.emitters) {
      e.t += dt;
      e.acc += dt;
      const c = e.c;
      const rate = (perSec) => {
        const n = Math.floor(e.acc * perSec);
        if (n > 0) e.acc -= n / perSec;
        return n;
      };
      switch (e.type) {
        case 'sparkle': {
          const n = rate(30);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, r = R(0.3, 2.4);
            this.g.spawn({ x: c.x + Math.cos(a) * r, y: R(0.4, 3.2), z: c.z + Math.sin(a) * r, color: Math.random() > 0.5 ? e.hi : e.pale, size: R(0.1, 0.22), life: R(0.4, 0.8), shape: 1, spin: 3 });
          }
          break;
        }
        case 'spiral': {
          const n = rate(70);
          for (let i = 0; i < n; i++) {
            e.n++;
            const arm = e.n % 3;
            this.g.spawn({ x: c.x, y: c.y + 0.4, z: c.z, vy: 1.5, color: arm ? e.hi : e.pale, size: R(0.14, 0.26), life: 3,
              orbit: { cx: c.x, cz: c.z, ang: e.t * 4 + (arm * Math.PI * 2) / 3, angVel: 2.6, rad: 0.45, radVel: 0.22 } });
          }
          break;
        }
        case 'pillar': {
          const n = rate(90);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, r = Math.random() * 0.35;
            this.g.spawn({ x: c.x + Math.cos(a) * r, y: c.y + 0.6, z: c.z + Math.sin(a) * r, vx: Math.cos(a) * 0.2, vy: R(6, 10), vz: Math.sin(a) * 0.2, color: Math.random() > 0.3 ? e.hi : e.pale, size: R(0.18, 0.35), life: R(0.7, 1.0), drag: 0.8 });
          }
          break;
        }
        case 'rings': {
          if (e.acc >= 1.1 || e.n === 0) {
            e.acc = 0;
            e.n++;
            for (let k = 0; k < 40; k++) {
              this.g.spawn({ x: c.x, y: c.y + 1.4, z: c.z, vy: 1.1, color: e.pale, size: 0.3, life: 3.6, alpha: 0.9,
                orbit: { cx: c.x, cz: c.z, ang: (k / 40) * 6.28, angVel: 0.5, rad: 0.25, radVel: 0.85 } });
            }
          }
          break;
        }
        case 'fireflies': {
          if (e.t < e.dur - 4 && rate(4)) this.#firefly(e);
          break;
        }
        case 'stars': {
          const n = rate(12);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, sp = R(1.2, 2.6);
            this.g.spawn({ x: c.x, y: c.y + 1, z: c.z, vx: Math.cos(a) * sp, vy: R(4.5, 7), vz: Math.sin(a) * sp, grav: 4.2, color: Math.random() > 0.4 ? e.hi : e.pale, size: R(0.35, 0.55), life: 2.3, shape: 1, spin: R(-4, 4) });
            this.g.spawn({ x: c.x, y: c.y + 1, z: c.z, vx: Math.cos(a) * sp * 0.9, vy: R(4, 6), vz: Math.sin(a) * sp * 0.9, grav: 4.2, color: e.pale, size: 0.08, life: 1.5 });
          }
          break;
        }
        case 'hearts': {
          const n = rate(7);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, r = R(0, 0.8);
            this.g.spawn({ x: c.x + Math.cos(a) * r, y: c.y + 1.2, z: c.z + Math.sin(a) * r, vx: R(-0.3, 0.3), vy: R(0.7, 1.2), vz: R(-0.3, 0.3), color: Math.random() > 0.3 ? e.hi : e.pale, size: R(0.45, 0.7), life: R(3, 4), shape: 2, rot: 0, bob: 0.0 });
          }
          break;
        }
        case 'rainbow': {
          const n = rate(60);
          for (let i = 0; i < n; i++) {
            e.n++;
            const ang = e.t * 2.2 + e.n * 0.7;
            tmp.setHSL((e.n * 0.013) % 1, 1, 0.6).multiplyScalar(2.2);
            this.g.spawn({ x: c.x, y: c.y + 0.5, z: c.z, vy: R(1.0, 1.6), color: tmp.clone(), size: R(0.14, 0.24), life: 3.2,
              orbit: { cx: c.x, cz: c.z, ang, angVel: 1.4, rad: R(0.4, 0.9), radVel: 0.35 } });
          }
          break;
        }
        // ---------------- ✦ 특별한 가루
        case 'aurora': { // 오로라 커튼: 화로 둘레 반원에 세로로 선 빛의 띠가 물결치며 색이 흐른다
          const n = rate(260);
          for (let i = 0; i < n; i++) {
            const col = Math.floor(Math.random() * 30);         // 띠 30줄
            const u = col / 29 * 2 - 1;
            const ang = Math.PI * 1.5 + u * 1.5 + Math.sin(e.t * 0.5) * 0.15; // 화로 뒤쪽 반원
            const r = 2.8 + Math.sin(u * 5 + e.t * 1.8) * 0.35;
            const hue = 0.36 + (Math.sin(u * 2.2 + e.t * 0.9) + 1) * 0.2; // 초록 ↔ 하늘 ↔ 보라
            tmp.setHSL(hue % 1, 0.95, 0.6).multiplyScalar(1.9);
            const base = 1.2 + Math.sin(u * 3 + e.t * 2.2) * 0.45;
            this.g.spawn({ x: c.x + Math.cos(ang) * r, y: base + R(0, 0.2), z: c.z + Math.sin(ang) * r, vy: R(1.3, 1.8), color: tmp.clone(),
              size: R(0.12, 0.18), life: R(1.2, 1.7), alpha: 0.7 });
          }
          break;
        }
        case 'fireworks': { // 불꽃놀이: 화로에서 쏘아 올려 하늘에서 터진다
          if (e.acc >= 1.05 || e.n === 0) {
            e.acc = 0;
            e.n++;
            const bx = c.x + R(-1.6, 1.6), bz = c.z + R(-1.6, 1.6), by = R(4.6, 6.2);
            tmp.setHSL(Math.random(), 1, 0.6).multiplyScalar(2.4);
            const col = tmp.clone(), col2 = col.clone().lerp(WHITE, 0.5);
            // 꼬리 (올라가는 불씨)
            for (let k = 0; k < 14; k++) {
              const tt = 0.55 + k * 0.012;
              this.g.spawn({ x: c.x, y: c.y + 0.8, z: c.z, vx: (bx - c.x) / tt, vy: (by - c.y - 0.8) / tt + 4.5 * tt, vz: (bz - c.z) / tt, grav: 9, color: col2, size: 0.1, life: tt });
            }
            e.bursts = e.bursts || [];
            e.bursts.push({ at: e.t + 0.55, x: bx, y: by, z: bz, col, col2 });
          }
          for (const b of e.bursts || []) {
            if (b.done || e.t < b.at) continue;
            b.done = true;
            for (let k = 0; k < 120; k++) {
              const th = Math.random() * 6.28, ph = Math.acos(R(-1, 1)), sp = R(3.2, 4.4);
              this.g.spawn({ x: b.x, y: b.y, z: b.z, vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp, vz: Math.sin(ph) * Math.sin(th) * sp,
                grav: 2.2, drag: 1.2, color: k % 4 ? b.col : b.col2, size: R(0.12, 0.22), life: R(1.4, 2.1), shape: k % 9 === 0 ? 1 : 0 });
            }
          }
          break;
        }
        case 'petals': { // 꽃잎 회오리: 분홍 꽃잎이 크게 휘돌며 올라갔다가 흩날려 내려온다
          const n = rate(45);
          for (let i = 0; i < n; i++) {
            e.n++;
            tmp.set(['#ffc2dd', '#ff8fc8', '#fff0f6', '#ffb0d0'][e.n % 4]).multiplyScalar(1.5);
            this.s.spawn({ x: c.x, y: c.y + 0.4, z: c.z, vy: R(0.7, 1.2), color: tmp.clone(), size: R(0.14, 0.22), life: R(4, 5.5), shape: 2, spin: R(-5, 5), alpha: 0.95,
              orbit: { cx: c.x, cz: c.z, ang: e.t * 2.4 + e.n * 0.9, angVel: R(1.6, 2.4), rad: 0.5, radVel: R(0.45, 0.75) } });
          }
          if (rate(8)) {
            const a = Math.random() * 6.28, r = R(1, 4);
            this.s.spawn({ x: c.x + Math.cos(a) * r, y: R(3.5, 5), z: c.z + Math.sin(a) * r, vx: R(-0.4, 0.4), vy: -0.5, vz: R(-0.4, 0.4), color: tmp.clone(), size: 0.18, life: 6, shape: 2, spin: R(-3, 3), bob: 0.8 });
          }
          break;
        }
        case 'galaxy': { // 은하수: 원반(처음에 뿌린 별) + 가운데에서 반짝이는 빛
          if (rate(20)) {
            const a = Math.random() * 6.28, r = R(0, 0.6);
            this.g.spawn({ x: c.x + Math.cos(a) * r, y: 3.0, z: c.z + Math.sin(a) * r, color: WHITE.clone().multiplyScalar(2.2), size: R(0.25, 0.45), life: R(0.5, 0.9), shape: 1, spin: 2 });
          }
          if (rate(10)) { // 원반에서 별가루가 화로로 떨어진다
            const a = Math.random() * 6.28, r = R(0.5, 3);
            this.g.spawn({ x: c.x + Math.cos(a) * r, y: 2.9, z: c.z + Math.sin(a) * r, vy: -1.2, color: e.pale, size: 0.08, life: 1.8 });
          }
          break;
        }
        case 'butterflies': {
          if (e.t < e.dur - 5 && rate(1.2)) this.#butterfly(e);
          break;
        }
        default:
      }
    }
    this.emitters = this.emitters.filter((e) => e.t < e.dur);
  }
}
