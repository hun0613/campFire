// 🎤 아레나 사람들 (v1.23): 페스티벌 가루 판매원 · 무대 앞 팬 · 승강장 안내원 · 음향 감독 · 사진 찍는 사람 · 응원하는 아이
// - 아레나 묶음(arena.root)에 넣어 아레나와 함께 숨기고 보인다
// - 가끔 몸짓(박수 · 깡충 · 손 흔들기…)을 하고, 가까이 가면 이름표가 보이고 말을 걸 수 있다 (E → 한마디)
import * as THREE from 'three';
import { Character } from './character.js';
import { radialTexture } from './toon.js';
import { ARENA, BALLOON } from '../shared/config.js';

const D2R = Math.PI / 180;
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const STAGE = { x: ARENA.stage.x, z: ARENA.stage.z };

/** 아레나 사람들: id · 이름 · 자리 · 보는 곳 · 몸짓 · 한마디 */
const PEOPLE = [
  { id: 'seller', name: '민트', title: '페스티벌 가루 상인', icon: '✦', look: { skin: '#ffe0c7', hair: '#ff8fc8', shirt: '#7c5cff', pants: '#3a2f5a', hat: 'beanie' },
    at: (() => { const b = ARENA.booth; return { x: b.x - Math.sin(b.ry) * 0.35, z: b.z - Math.cos(b.ry) * 0.35, ry: b.ry }; })(), moves: ['wave', 'hop'], every: 9,
    lines: ['장작 10개면 ✦ 페스티벌 가루 하나! 무대가 들썩여요', '객석 모닥불에 앉아서 뿌려야 터져요 🔥', '오늘 밤 무대, 우리가 함께 만들어요 ✨'] },
  { id: 'fan1', name: '하나', title: '맨 앞줄 팬', icon: '🙌', look: { skin: '#f6c9a0', hair: '#2b2220', shirt: '#f2a93b', pants: '#3d4a6b', hat: 'cap' },
    at: { x: -6.5, z: 306.5 }, look_at: STAGE, moves: ['clap', 'hop', 'love'], every: 4.5,
    lines: ['이 노래 진짜 좋아요!', '다음 곡도 기대돼요 🎶', '같이 박수 쳐요 👏'] },
  { id: 'fan2', name: '두리', title: '응원봉 든 팬', icon: '💡', look: { skin: '#ffe0c7', hair: '#e8c35c', shirt: '#f07fa8', pants: '#e8e0cc', hat: 'none' },
    at: { x: 0.8, z: 306 }, look_at: STAGE, moves: ['hop', 'wow', 'clap'], every: 3.8, stick: true,
    lines: ['무대 조명 너무 예쁘죠?', '여기가 제일 잘 보이는 자리예요!', '꺄 — 시작한다!'] },
  { id: 'fan3', name: '세온', title: '처음 온 캠퍼', icon: '🎈', look: { skin: '#dba377', hair: '#5a3825', shirt: '#5aa36b', pants: '#2f3b2f', hat: 'straw' },
    at: { x: 7.2, z: 307 }, look_at: STAGE, moves: ['clap', 'love', 'wave'], every: 5.2,
    lines: ['열기구 타고 오는 길 정말 멋졌어요', '불멍하면서 공연이라니…', '친구도 데려올 걸 그랬어요'] },
  { id: 'guide', name: '나래', title: '승강장 안내원', icon: '🎈', look: { skin: '#f6c9a0', hair: '#c9772f', shirt: '#e65a45', pants: '#3a3f4b', hat: 'cap' },
    at: { x: BALLOON.arena.x + 5.6, z: BALLOON.arena.z - 2.2 }, look_at: { x: BALLOON.arena.x, z: BALLOON.arena.z - 6 }, moves: ['wave'], every: 7,
    lines: ['불멍 아레나에 오신 걸 환영해요! 🎤', '캠핑장행 열기구는 1분마다 떠나요', '장작은 왼쪽 창고지기 콩이에게 찾을 수 있어요'] },
  { id: 'sound', name: '쿵', title: '음향 감독', icon: '🎚️', look: { skin: '#a8714a', hair: '#2b2220', shirt: '#3a3f4b', pants: '#2f3b2f', hat: 'beanie' },
    at: { x: -9.5, z: 341.5 }, look_at: STAGE, moves: ['love', 'clap'], every: 8, desk: true,
    lines: ['소리 크기 딱 좋죠? 😎', '신청곡은 승강장 앞 부스에서 받아요', '조명은 은은하게, 소리는 따뜻하게'] },
  { id: 'photo', name: '찰칵', title: '무대 사진가', icon: '📷', look: { skin: '#ffe0c7', hair: '#4a86d8', shirt: '#f4efe1', pants: '#3d4a6b', hat: 'none' },
    at: { x: 30, z: 318 }, look_at: { x: 0, z: 298 }, moves: ['wow'], every: 10,
    lines: ['여기서 보면 무대가 한눈에 들어와요', '페스티벌 가루 터질 때가 사진 맛집이에요 📸'] },
  { id: 'kid', name: '콩콩', title: '응원하는 아이', icon: '⭐', look: { skin: '#f6c9a0', hair: '#f2a6c6', shirt: '#3f8fd1', pants: '#6b5a45', hat: 'none' },
    at: { x: -29, z: 322 }, look_at: STAGE, moves: ['hop', 'hop', 'wave'], every: 3.2, small: true,
    lines: ['나도 무대에 서 보고 싶어!', '불꽃 또 터졌으면 좋겠다!'] },
];

export function createArenaCrowd(parent) {
  const list = PEOPLE.map((p) => {
    const ch = new Character(p.look, { name: `${p.icon} ${p.name} · ${p.title}`, kind: 'npc' });
    const ry = p.at.ry ?? (p.look_at ? faceTo(p.at.x, p.at.z, p.look_at.x, p.look_at.z) : 0);
    ch.root.position.set(p.at.x, 0, p.at.z);
    ch.root.rotation.y = ry;
    if (p.small) ch.root.scale.setScalar(0.8);
    ch.root.traverse((o) => { o.castShadow = false; }); // 그림자는 발밑 동그라미로 충분 (그리기 횟수 절반)
    if (p.stick) { // 💡 응원봉: 오른손에 쥐고 팔을 따라 움직인다 (손끝에서 팔 방향으로 뻗는다)
      const g = new THREE.Group();
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), new THREE.MeshToonMaterial({ color: '#2a2a33' }));
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.34, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(2.6) }));
      light.position.y = -0.22;
      const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffcf8a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      tip.position.y = -0.3; tip.scale.setScalar(0.5);
      g.add(grip, light, tip);
      g.position.y = -0.36;
      ch.arms[1].add(g);
    }
    ch.root.userData.ds = `arena-npc-${p.id}`;
    parent.add(ch.root);
    if (p.desk) { // 음향 감독: 작은 콘솔 책상
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.7), new THREE.MeshToonMaterial({ color: '#2b2731' }));
      top.position.y = 0.9;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.5), new THREE.MeshToonMaterial({ color: '#3a3540' }));
      leg.position.y = 0.43;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.45), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(1.4) }));
      panel.rotation.x = -Math.PI / 2 + 0.35; panel.position.set(0, 0.96, 0);
      g.add(top, leg, panel);
      g.position.set(p.at.x + Math.sin(ry) * 0.75, 0, p.at.z + Math.cos(ry) * 0.75);
      g.rotation.y = ry;
      g.userData.ds = 'arena-npc-sound';
      parent.add(g);
    }
    return { p, ch, ry, t: Math.random() * p.every, x: p.at.x, z: p.at.z, line: 0 };
  });
  const colliders = list.map((n) => ({ x: n.x, z: n.z, r: 0.45 }));
  const tmp = new THREE.Vector3();
  return {
    list, colliders,
    /** 가까운 사람 (말 걸기) */
    nearest(me, range = 2.4) {
      let best = null;
      for (const n of list) { const d = Math.hypot(me.x - n.x, me.z - n.z); if (d < range && (!best || d < best.d)) best = { n, d }; }
      return best;
    },
    talk(n) {
      n.ch.say(n.p.lines[n.line++ % n.p.lines.length]);
      n.ch.play('wave');
    },
    update(dt, me, active, playing = false) {
      if (!active) return;
      for (const n of list) {
        n.t -= dt;
        if (n.t <= 0) { n.t = n.p.every * (0.8 + Math.random() * 0.5); if (!n.ch.busy()) n.ch.play(n.p.moves[Math.floor(Math.random() * n.p.moves.length)]); }
        // 가까이 오면 나를 보고, 이름표도 가까이에서만 (아레나가 이름표로 덮이지 않게)
        const d = me ? Math.hypot(me.x - n.x, me.z - n.z) : 99;
        const want = d < 4.5 ? faceTo(n.x, n.z, me.x, me.z) : n.ry;
        let diff = want - n.ch.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.ch.root.rotation.y += diff * Math.min(1, dt * 3);
        const show = d < 13;
        if (n._show !== show) { n._show = show; n.ch.nameEl.style.display = show ? '' : 'none'; }
        n.ch.update(dt);
        if (n.p.stick && playing && !n.ch.busy()) { // 노래가 나오면 응원봉을 높이 들고 천천히 흔든다
          const t = performance.now() / 1000;
          n.ch.arms[1].rotation.x = -0.3; n.ch.arms[1].rotation.z = 2.5 + Math.sin(t * 2.6) * 0.35;
        }
      }
    },
  };
}
