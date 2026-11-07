// 조명 풀: 캠핑장 곳곳의 조명 자리(가로등, 루미 공방, 방명록 랜턴) 중 카메라 근처 몇 곳에만 실제 조명을 켠다.
// - 실제 조명 수가 많으면 화면의 모든 픽셀이 매 프레임 그만큼 계산을 해서 폰이 뜨거워진다
// - 조명 수는 항상 같게 유지한다 (바뀌면 셰이더를 다시 만들어 끊김이 생김). 자리만 옮기고 밝기를 서서히 바꾼다
import * as THREE from 'three';

export class LightPool {
  /**
   * @param {THREE.Scene} scene
   * @param {number} count 실제로 켤 조명 수
   */
  constructor(scene, count) {
    this.slots = [];
    for (let i = 0; i < count; i++) {
      const L = new THREE.PointLight('#ffffff', 0, 10, 1.6);
      scene.add(L);
      this.slots.push({ L, spot: null, w: 0 });
    }
    this.t = 1;
  }

  /**
   * @param {{pos:THREE.Vector3,color:THREE.Color,intensity:number|(()=>number),distance:number}[]} spots
   */
  update(dt, focus, spots) {
    // 가까운 자리 고르기는 0.25초마다
    this.t += dt;
    if (this.t > 0.25) {
      this.t = 0;
      this.want = spots
        .map((s) => ({ s, d: s.pos.distanceTo(focus) }))
        .filter((o) => o.d < o.s.distance + 30)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.slots.length)
        .map((o) => o.s);
    }
    const want = this.want || [];
    for (const sl of this.slots) {
      const keep = sl.spot && want.includes(sl.spot);
      if (keep) sl.w = Math.min(1, sl.w + dt * 2.5);
      else {
        sl.w = Math.max(0, sl.w - dt * 2.5);
        if (sl.w === 0) {
          // 비었으면 아직 아무 조명도 안 받은 자리를 맡는다
          sl.spot = want.find((s) => !this.slots.some((o) => o.spot === s)) || null;
          if (sl.spot) {
            sl.L.position.copy(sl.spot.pos);
            sl.L.color.copy(sl.spot.color);
            sl.L.distance = sl.spot.distance;
          }
        }
      }
      const base = sl.spot ? (typeof sl.spot.intensity === 'function' ? sl.spot.intensity() : sl.spot.intensity) : 0;
      sl.L.intensity = base * sl.w;
    }
  }
}
