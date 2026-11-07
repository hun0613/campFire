// 광장의 방명록: 나무 독서대 위에 펼쳐진 책 + 깃펜 + 작은 랜턴 + 표지판
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toon, glow, textTexture, radialTexture } from './toon.js';

export class GuestbookStand {
  /** @param {{x:number,z:number}} pos */
  constructor(scene, pos) {
    this.pos = new THREE.Vector3(pos.x, 0, pos.z);
    const root = new THREE.Group();
    root.position.copy(this.pos);
    // 처음 들어오는 쪽(남쪽, 카메라 쪽)을 바라본다
    root.rotation.y = Math.atan2(-pos.x * 0.4, 6);
    root.scale.setScalar(1.45);
    this.root = root;

    const wood = toon('#8a5a36'), dark = toon('#6b4a2b');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 10), dark);
    base.position.y = 0.06;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 8), wood);
    post.position.y = 0.6;
    // 비스듬한 책 받침
    const top = new THREE.Group();
    top.position.set(0, 1.12, 0);
    top.rotation.x = -0.42;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.66), wood);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.05), dark);
    lip.position.set(0, 0.05, 0.31);
    top.add(board, lip);

    // 펼친 책: 표지 + 두 장의 살짝 휜 페이지
    const book = new THREE.Group();
    book.position.y = 0.04;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.025, 0.56), toon('#a33b2e'));
    book.add(cover);
    const pageTex = textTexture('', { w: 256, h: 180, bg: '#fff6e2', border: '#fff6e2' });
    this.pageMat = toon('#ffffff', { map: pageTex, emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0.12 });
    for (const s of [-1, 1]) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.52), this.pageMat);
      pg.position.set(s * 0.205, 0.022, 0);
      pg.rotation.z = s * -0.07;
      book.add(pg);
      // 글씨 줄
      for (let i = 0; i < 5; i++) {
        const ln = new THREE.Mesh(new THREE.BoxGeometry(0.28 - (i === 4 ? 0.12 : 0), 0.002, 0.012), toon('#b59b7a'));
        ln.position.set(s * 0.2 - (i === 4 ? s * 0.06 : 0), 0.04 + (s > 0 ? 0.014 : 0.014), -0.17 + i * 0.075);
        ln.rotation.z = s * -0.07;
        book.add(ln);
      }
    }
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.22), toon('#e8b13c'));
    ribbon.position.set(0, 0.03, 0.34);
    book.add(ribbon);
    top.add(book);

    // 깃펜 + 잉크병
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 10), toon('#2e2a3d'));
    ink.position.set(0.42, 0.08, -0.22);
    const quill = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 5), toon('#f3e7c9'));
    const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 6), toon('#fff8ee'));
    vane.scale.z = 0.35;
    vane.position.y = 0.08;
    quill.add(shaft, vane);
    quill.position.set(0.42, 0.26, -0.22);
    quill.rotation.set(0.15, 0, -0.35);
    top.add(ink, quill);
    root.add(base, post, top);

    // 작은 랜턴 (받침 옆 말뚝 위)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.5, 6), dark);
    pole.position.set(-0.7, 0.75, -0.1);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), glow('#ffc674', 2.2));
    lantern.position.set(-0.7, 1.4, -0.1);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 4), dark);
    cap.position.set(-0.7, 1.55, -0.1);
    cap.rotation.y = Math.PI / 4;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb766', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.3);
    halo.position.copy(lantern.position);
    this.halo = halo;
    root.add(pole, lantern, cap, halo);

    // 표지판
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 0.05), [
      dark, dark, dark, dark,
      toon('#ffffff', { map: textTexture('📖 방명록', { w: 384, h: 126, size: 58 }), emissive: new THREE.Color('#3a2a1a'), emissiveIntensity: 0.15 }),
      dark,
    ]);
    sign.position.set(0.05, 1.95, -0.05);
    // 표지판은 독서대 기둥이 아니라 랜턴 말뚝과 이어진 가로대에 매단다
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 0.05), dark);
    bar.position.set(-0.05, 1.88, -0.1);
    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.9, 6), dark);
    post2.position.set(0.62, 0.95, -0.1);
    pole.scale.y = 1.9 / 1.5; pole.position.y = 0.95;
    lantern.position.y = 1.3; cap.position.y = 1.45; halo.position.y = 1.3;
    lantern.position.x = cap.position.x = halo.position.x = -0.78;
    sign.position.set(-0.05, 2.12, -0.1);
    root.add(bar, post2, sign);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    scene.add(root);

    // 바닥에 따뜻한 빛 웅덩이
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffb766', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(pos.x, 0.03, pos.z);
    scene.add(pool);
    this.pool = pool;
    // 실제 조명 (독서대와 주변을 비춘다)
    // 실제 조명은 LightPool 이 가까이 있을 때만 켠다
    this.lightSpot = {
      pos: new THREE.Vector3(pos.x + 0.3, 1.0, pos.z + 1.4), color: new THREE.Color('#ffbf73'), distance: 6,
      intensity: () => 2.2 + Math.sin(this.t * 2.3) * 0.25 + this.pulse * 4,
    };

    // 멀리서도 보이는 떠 있는 표시
    const wrap = document.createElement('div');
    const el = document.createElement('div');
    el.className = 'gb-tag';
    el.innerHTML = '<span class="gb-tag-icon">📖</span><b>방명록</b><small>한마디 남기고 가요</small>';
    wrap.appendChild(el);
    this.tagEl = el;
    this.tag = new CSS2DObject(wrap);
    this.tag.position.set(pos.x, 4.2, pos.z);
    scene.add(this.tag);

    this.t = 0;
    this.pulse = 0;
  }

  /** 새 방명록이 남겨지면 랜턴이 잠깐 밝아진다 */
  ping() { this.pulse = 1; }

  /** @param {THREE.Vector3} [mePos] 가까이 오면 떠 있는 표시는 숨긴다 (안내 문구가 대신 뜸) */
  update(dt, mePos) {
    this.t += dt;
    this.pulse = Math.max(0, this.pulse - dt * 0.6);
    const near = mePos ? Math.hypot(mePos.x - this.pos.x, mePos.z - this.pos.z) < 1.9 : false;
    if (this._near !== near) { this._near = near; this.tagEl.classList.toggle('near', near); }
    this.pool.material.opacity = 0.3 + this.pulse * 0.3;
    this.halo.material.opacity = 0.42 + Math.sin(this.t * 2.3) * 0.06 + this.pulse * 0.5;
    this.halo.scale.setScalar(1.3 + this.pulse * 1.2);
  }
}
