// 원자들이 같이 쓰는 도우미: 같은 크기 도형 나눠 쓰기 · 자리 놓기
const geos = new Map();
/** 같은 열쇠의 도형은 한 번만 만든다 (휴대폰 부담) */
export const shared = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };

/** 놓기: 자리 · 기울기 · 그림자. 부품 안에서 조명 · 그림자를 정하지 않고, 조립하는 요소가 at 으로 넘긴다 */
export function place(m, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = false, receive = false } = {}) {
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  if (shadow) m.castShadow = true;
  if (receive) m.receiveShadow = true;
  return m;
}
