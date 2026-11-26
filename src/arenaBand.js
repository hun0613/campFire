// 🎸 아레나 무대 밴드 (v1.23): 보컬 · 드럼 · 일렉기타 · 베이스 · 키보드 5인조
// - 곡이 나오면 연주하는 몸짓 (박자는 느긋하게, 휙휙 움직이지 않게), 곡이 없으면 무대에서 대기
// - 캐릭터는 게임 캐릭터(character.js) + 악기는 도형으로. 무대 위라 사람 크기를 키운다
import * as THREE from 'three';
import { Character } from './character.js';
import { toon, glow } from './toon.js';
import { ARENA } from '../shared/config.js';
import { DECK } from './elements/organisms/arena-stage.js';

const S = 1.7; // 무대 위 사람 크기 (객석에서 잘 보이게)
const Y = DECK.h;

function guitar(bodyCol, neckLen = 0.62) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 14), toon(bodyCol));
  body.rotation.x = Math.PI / 2;
  const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.075, 10), toon('#f4efe1'));
  pick.rotation.x = Math.PI / 2; pick.position.set(0.04, -0.04, 0.005);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, neckLen, 0.03), toon('#5c3b22'));
  neck.position.y = 0.18 + neckLen / 2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.035), toon('#2a1f1c'));
  head.position.y = 0.2 + neckLen + 0.05;
  g.add(body, pick, neck, head);
  return g;
}
function keyboardTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const c = cv.getContext('2d');
  c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, 256, 32);
  for (let i = 0; i <= 28; i++) { c.fillStyle = '#9a9488'; c.fillRect(i * (256 / 28), 0, 1, 32); }
  for (let i = 0; i < 28; i++) if (![2, 6].includes(i % 7)) { c.fillStyle = '#1d1b22'; c.fillRect((i + 0.65) * (256 / 28), 0, 256 / 28 * 0.6, 19); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createArenaBand(parent) {
  const st = ARENA.stage;
  const at = (x, z) => ({ x: st.x + x, z: st.z + z });
  const mk = (look, name, x, z) => {
    const ch = new Character(look, { name, kind: 'npc' });
    const p = at(x, z);
    ch.root.position.set(p.x, Y, p.z);
    ch.root.scale.setScalar(S);
    ch.root.userData.ds = 'arena-band';
    ch.nameEl.style.display = 'none'; // 무대 위 이름표는 숨긴다 (전광판이 주인공)
    ch.root.traverse((o) => { o.castShadow = false; }); // 그림자는 발밑 동그라미로 충분 (그리기 횟수 절반)
    parent.add(ch.root);
    return ch;
  };
  const band = {
    vocal: mk({ skin: '#ffe0c7', hair: '#2b2220', shirt: '#f4efe1', pants: '#2a2a33', hat: 'none' }, '보컬', 0, 3.6),
    guitar: mk({ skin: '#f6c9a0', hair: '#c9772f', shirt: '#e65a45', pants: '#3d4a6b', hat: 'none' }, '기타', -5.2, 2.6),
    bass: mk({ skin: '#dba377', hair: '#5a3825', shirt: '#3a3f4b', pants: '#6b5a45', hat: 'beanie' }, '베이스', 5.2, 2.6),
    keys: mk({ skin: '#ffe0c7', hair: '#f2a6c6', shirt: '#8b5cc7', pants: '#3d4a6b', hat: 'none' }, '키보드', -9.6, 0.6),
    drums: mk({ skin: '#a8714a', hair: '#2b2220', shirt: '#3f8fd1', pants: '#2f3b2f', hat: 'cap' }, '드럼', 0, -1.0),
  };
  // 기타 · 베이스: 쉴 땐 무대 위 스탠드에 세워 두고, 연주자가 자리에 오면 몸 앞에 비스듬히 멘다
  const gt = guitar('#d8283b'), bs = guitar('#2f4a7a', 0.82);
  const stands = [];
  const standAt = (inst, x, z) => { // 기타 스탠드 (무대 바닥, 연주자 자리 옆)
    const g = new THREE.Group(), p = at(x, z);
    g.position.set(p.x, Y, p.z); g.scale.setScalar(S);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 5), toon('#2a2a33'));
    leg.position.y = 0.25; leg.rotation.x = -0.25; g.add(leg);
    g.userData.ds = 'arena-band';
    parent.add(g);
    stands.push(g);
    return g;
  };
  const gtStand = standAt(gt, -6.6, 2.2), bsStand = standAt(bs, 6.6, 2.2);
  const hold = (inst, ch, on) => { // 메기 · 내려놓기
    if (on) { ch.body.add(inst); inst.position.set(0.02, inst === bs ? 0.48 : 0.5, 0.2); inst.rotation.set(0, 0, inst === bs ? 1.0 : 0.95); }
    else { (inst === gt ? gtStand : bsStand).add(inst); inst.position.set(0, 0.05, 0.08); inst.rotation.set(-0.25, 0, 0); }
  };
  hold(gt, band.guitar, false); hold(bs, band.bass, false);

  // 🎟️ 대기 부스 (BACKSTAGE): 무대 오른쪽 옆 땅 위 천막 · 의자. 곡이 없을 땐 여기서 쉰다
  const BK = at(23.5, 6.5); // 무대 가운데 기준 오른쪽 · 앞 (객석 울타리 밖)
  {
    const g = new THREE.Group();
    g.position.set(BK.x, 0, BK.z);
    const pole = toon('#3b3229'), cloth = toon('#2f4a7a'), cream = toon('#fff1d8');
    for (const [x, z] of [[-2.6, -2], [2.6, -2], [-2.6, 2], [2.6, 2]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), pole); m.position.set(x, 1.3, z); g.add(m); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 1.3, 4), cloth); roof.rotation.y = Math.PI / 4; roof.position.y = 3.25; g.add(roof);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), cloth); back.position.set(0, 1.3, -2); back.material.side = THREE.DoubleSide; g.add(back);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), toon('#8a2f2b')); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.02; g.add(rug);
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.8), cream); sofa.position.set(0, 0.25, -1.4); g.add(sofa);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d'); c.fillStyle = '#1d1b22'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#ffcf8a'; c.font = '36px Moneygraphy, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BACKSTAGE', 128, 34);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    sign.position.set(0, 2.75, 2.05); g.add(sign);
    g.userData.ds = 'arena-backstage';
    parent.add(g);
  }
  // 무대 오른쪽 계단 (땅 → 무대 바닥)
  const STAIR = { x0: st.x + DECK.w / 2 + 2.6, x1: st.x + DECK.w / 2 - 0.6, z: st.z + 3.4 };
  {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const h = (Y * (i + 1)) / 5, w = 2.6 - i * 0.52; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6), toon('#2e2731')); m.position.set(STAIR.x0 - 2.6 + w / 2 + 0.6, h / 2, STAIR.z); g.add(m); }
    g.userData.ds = 'arena-band';
    parent.add(g);
  }
  // 보컬 마이크 스탠드 (무대 바닥)
  {
    const g = new THREE.Group(), p = at(0, 4.3);
    g.position.set(p.x, Y, p.z);
    const at3 = (m, x, y, z) => { m.position.set(x, y, z); return m; };
    g.add(at3(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), toon('#2a2a33')), 0, 1.15, 0));
    g.add(at3(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), toon('#2a2a33')), 0, 0.02, 0));
    g.add(at3(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon('#8a8f99')), 0, 2.33, -0.05));
    g.userData.ds = 'arena-band';
    parent.add(g);
  }
  // 키보드: X 스탠드 + 건반
  {
    const g = new THREE.Group(), p = at(-9.6, 1.6);
    g.position.set(p.x, Y, p.z);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), toon('#2a2a33'));
      leg.position.set(s * 0.9, 0.75, 0); leg.rotation.z = s * 0.35; g.add(leg);
    }
    const kb = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.62), [toon('#1d1b22'), toon('#1d1b22'), new THREE.MeshToonMaterial({ map: keyboardTex() }), toon('#1d1b22'), toon('#1d1b22'), toon('#1d1b22')]);
    kb.position.y = 1.55; kb.rotation.y = Math.PI; g.add(kb);
    g.rotation.y = 0;
    g.userData.ds = 'arena-band';
    parent.add(g);
  }
  // 드럼: 받침대 위 킥 · 스네어 · 탐 · 플로어탐 · 심벌 · 하이햇 + 의자
  const cymbals = [];
  {
    const g = new THREE.Group(), p = at(0, -1.0);
    g.position.set(p.x, Y, p.z);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 4.2), toon('#1d1b22'));
    riser.position.set(0, 0.25, -0.5); g.add(riser);
    const shell = toon('#b4523d'), head = toon('#f4efe1'), metal = toon('#2a2a33');
    const drum = (r, h, x, y, z, rx = 0) => { const d = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), shell); const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.02, 16), head); t.position.y = h / 2; d.add(s, t); d.position.set(x, y, z); d.rotation.x = rx; g.add(d); };
    drum(0.62, 0.55, 0, 0.5 + 0.62, 1.15, Math.PI / 2); // 킥 (앞을 본다)
    drum(0.36, 0.22, -0.95, 1.55, 1.2, 0.25);           // 스네어
    drum(0.3, 0.3, -0.35, 1.95, 1.0, 0.35);              // 탐
    drum(0.32, 0.3, 0.35, 1.95, 1.0, 0.35);              // 탐
    drum(0.45, 0.55, 1.05, 1.0, 1.1, 0.1);               // 플로어탐
    for (const [x, y, z, r] of [[-1.55, 2.6, 0.9, 0.55], [1.5, 2.75, 0.7, 0.62], [-1.25, 1.95, 1.45, 0.4]]) { // 심벌 · 하이햇
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, y - 0.5, 6), metal); stand.position.set(x, 0.5 + (y - 0.5) / 2, z); g.add(stand);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.03, 18), toon('#d9b844')); c.position.set(x, y, z); c.rotation.x = 0.15; g.add(c); cymbals.push(c);
    }
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.75, 12), metal); stool.position.set(0, 0.5 + 0.37, -0.25); g.add(stool);
    g.userData.ds = 'arena-band';
    parent.add(g);
    band.drums.root.position.z = p.z - 0.2;
  }

  // 자리: 무대 위 연주 자리 · 대기 부스 자리 · 다니는 길 (대기 부스 → 계단 아래 → 계단 위 → 자리)
  const order = ['vocal', 'guitar', 'bass', 'keys', 'drums'];
  const members = order.map((id, i) => {
    const ch = band[id];
    const spot = { x: ch.root.position.x, y: id === 'drums' ? Y + 0.7 : Y, z: ch.root.position.z };
    const wait = { x: BK.x - 1.8 + i * 0.9, y: 0, z: BK.z - 0.5 + (i % 2) * 0.6 };
    const path = [wait, { x: STAIR.x0 + 0.6, y: 0, z: STAIR.z }, { x: STAIR.x1, y: Y, z: STAIR.z },
      ...(id === 'drums' ? [{ x: spot.x + 3.2, y: Y, z: STAIR.z }, { x: spot.x + 3.2, y: Y, z: spot.z }] : [{ x: spot.x, y: Y, z: STAIR.z }]), // 드러머는 드럼 세트 옆으로 돌아 뒤로
      spot];
    ch.root.position.set(wait.x, wait.y, wait.z);
    ch.root.rotation.y = Math.PI;
    return { id, ch, spot, path, pos: 0, state: 'back', delay: i * 1.3, wait: 0 }; // pos: 길 위 자리 (0 = 대기 부스 ~ path.length-1 = 연주 자리)
  });
  const SPEED = 2.6; // m/s (사람 크기를 키워서 조금 빠르게)
  /** 길을 따라 걷기: dir +1 무대로 · -1 대기 부스로. 끝에 닿으면 true */
  function stepPath(m, dir, dt) {
    const P = m.path, ch = m.ch, end = P.length - 1;
    let left = SPEED * dt;
    while (left > 1e-6) {
      const i = dir > 0 ? Math.floor(m.pos) : Math.ceil(m.pos) - 1; // 지금 걷는 구간 [i, i+1]
      if ((dir > 0 && m.pos >= end) || (dir < 0 && m.pos <= 0)) break;
      const a = P[i], b = P[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.001;
      const target = dir > 0 ? i + 1 : i;
      const room = Math.abs(target - m.pos) * len;
      const go = Math.min(left, room);
      m.pos += (dir * go) / len; left -= go;
      if (go >= room) m.pos = target;
    }
    const i = Math.min(end - 1, Math.floor(m.pos)), u = m.pos - i, a = P[i], b = P[i + 1];
    ch.root.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
    const want = dir > 0 ? Math.atan2(b.x - a.x, b.z - a.z) : Math.atan2(a.x - b.x, a.z - b.z);
    let d = want - ch.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    ch.root.rotation.y += d * Math.min(1, dt * 8);
    return dir > 0 ? m.pos >= end : m.pos <= 0;
  }

  let k = 0;
  const set = (ch, aL, zL, aR, zR) => { ch.arms[0].rotation.x = aL; ch.arms[0].rotation.z = zL; ch.arms[1].rotation.x = aR; ch.arms[1].rotation.z = zR; };
  return {
    /** 🌦️ 테마 옷 (패딩 · 산타 모자 · 우비) */
    setTheme(th) { for (const ch of Object.values(band)) ch.setOutfit(th.outfit); },
    /** playing: 지금 곡이 나온다 · onStage: 무대에 있어야 한다 (곡 시작 30초 전 ~ 곡이 끝날 때) */
    update(dt, t, playing, onStage) {
      if (!parent.visible) { // 아레나에 없을 땐 걷는 모습 없이 바로 제자리로 (도착했을 때 이미 무대 · 대기 부스에 있게)
        for (const m of members) {
          const want = onStage ? 'stage' : 'back';
          if (m.state === want) continue;
          m.state = want; m.wait = 0; m.pos = want === 'stage' ? m.path.length - 1 : 0;
          const p = want === 'stage' ? m.spot : m.path[0];
          m.ch.root.position.set(p.x, p.y, p.z); m.ch.root.rotation.y = want === 'stage' ? 0 : Math.PI;
          m.ch.setAnim(want === 'stage' && m.id === 'drums' ? 'sit' : 'idle');
          if (m.id === 'guitar') hold(gt, m.ch, want === 'stage'); if (m.id === 'bass') hold(bs, m.ch, want === 'stage');
        }
        return;
      }
      for (const m of members) {
        const ch = m.ch;
        if (onStage && (m.state === 'back' || m.state === 'toBack')) { // 무대로 (쉬던 사람은 차례로 조금씩 늦게)
          m.wait = m.state === 'back' ? m.delay : 0; m.state = 'toStage';
        }
        if (!onStage && (m.state === 'stage' || m.state === 'toStage')) { // 대기 부스로 (악기는 무대에 두고)
          if (m.state === 'stage') {
            if (m.id === 'guitar') hold(gt, ch, false); if (m.id === 'bass') hold(bs, ch, false);
            if (m.id === 'drums') ch.root.position.y = Y;
            m.wait = m.delay * 0.5;
          } else m.wait = 0;
          m.state = 'toBack';
        }
        if (m.wait > 0) { m.wait -= dt; continue; }
        if (m.state === 'toStage') {
          ch.setAnim('walk');
          if (stepPath(m, 1, dt)) { // 자리에 도착: 관객을 보고, 기타 · 베이스는 멘다, 드러머는 의자에 앉는다
            m.state = 'stage'; ch.root.position.set(m.spot.x, m.spot.y, m.spot.z); ch.root.rotation.y = 0;
            ch.setAnim(m.id === 'drums' ? 'sit' : 'idle');
            if (m.id === 'guitar') hold(gt, ch, true); if (m.id === 'bass') hold(bs, ch, true);
          }
        } else if (m.state === 'toBack') {
          ch.setAnim('walk');
          if (stepPath(m, -1, dt)) { m.state = 'back'; ch.root.rotation.y = Math.PI; ch.setAnim('idle'); }
        }
      }
      const ready = members.every((m) => m.state === 'stage');
      k += ((playing && ready ? 1 : playing ? 0.6 : 0) - k) * Math.min(1, dt * 1.2);
      for (const ch of Object.values(band)) ch.update(dt);
      if (k < 0.02) return; // 대기: 기본 몸짓
      const onStageNow = (id) => members.find((m) => m.id === id).state === 'stage';
      const b = t * Math.PI * 2 * 0.9; // 박자 (1초에 한 번 조금 안 되게 — 느긋하게)
      // 보컬: 오른손 마이크 · 왼손은 가끔 관객 쪽으로, 몸을 살랑
      const V = band.vocal;
      if (onStageNow('vocal')) {
      V.body.rotation.z = Math.sin(b * 0.5) * 0.08 * k;
      set(V, -k * (0.6 + 0.9 * Math.max(0, Math.sin(b * 0.25))), -0.2 - k * 0.5 * Math.max(0, Math.sin(b * 0.25)), -k * 2.1, -0.2 * k);
      V.head.rotation.x = Math.sin(b) * 0.06 * k;
      }
      // 기타 · 베이스: 왼손 넥, 오른손 줄 튕기기 + 몸 들썩
      for (const [ch, sp, amp] of [[band.guitar, 2, 0.28], [band.bass, 1, 0.2]]) {
        if (!onStageNow(ch === band.guitar ? 'guitar' : 'bass')) continue;
        ch.body.position.y = Math.abs(Math.sin(b)) * 0.04 * k;
        ch.body.rotation.x = 0.06 * k;
        set(ch, -k * 1.15, -0.55 * k, -k * (0.75 + Math.sin(b * sp) * amp), -0.35 * k);
        ch.head.rotation.x = (0.1 + Math.sin(b) * 0.08) * k;
      }
      // 키보드: 두 손을 앞으로, 번갈아 누르기
      const K = band.keys;
      if (onStageNow('keys')) set(K, -k * (1.25 + Math.max(0, Math.sin(b)) * 0.12), -0.1 * k, -k * (1.25 + Math.max(0, Math.sin(b + Math.PI)) * 0.12), 0.1 * k);
      if (onStageNow('keys')) K.head.rotation.x = 0.15 * k;
      // 드럼: 두 팔을 번갈아 내리치기
      const D = band.drums;
      if (onStageNow('drums')) set(D, -k * (1.0 + Math.max(0, Math.sin(b * 2)) * 0.45), -0.35 * k, -k * (1.0 + Math.max(0, Math.sin(b * 2 + Math.PI)) * 0.45), 0.35 * k);
      if (onStageNow('drums')) D.body.position.y = Math.abs(Math.sin(b)) * 0.025 * k;
      cymbals.forEach((c, i) => { c.rotation.z = Math.sin(b * 2 + i) * 0.05 * k; });
    },
  };
}
