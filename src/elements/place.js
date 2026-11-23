// 요소 놓기: 요소(src/elements/*.js)를 장면에 놓고, 부딪힘 원을 놓은 위치 · 회전에 맞춰 붙인다
// 놓은 요소는 list 에 모아 두고, 월드가 매 프레임 update · 테마가 바뀌면 setTheme 를 불러 준다
/**
 * @param {THREE.Object3D} parent 장면 (또는 그룹)
 * @param {{ group, colliders?, update?, setTheme? }} el 요소 (create() 결과)
 * @param {number} x @param {number} y @param {number} z @param {number} ry 놓을 자리와 방향
 * @param {{ addCol?: (x, z, r) => void, list?: object[] }} ctx
 */
export function placeElement(parent, el, x, y, z, ry, { addCol, list } = {}) {
  el.group.position.set(x, y, z);
  el.group.rotation.y = ry;
  parent.add(el.group);
  if (addCol) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const k of el.colliders || []) addCol(x + k.x * c + k.z * s, z - k.x * s + k.z * c, k.r);
  }
  list?.push(el);
  return el;
}
