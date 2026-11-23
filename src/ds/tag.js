// 디자인 시스템 이름표: 물체에 userData.ds = '요소 id' 를 단다. 화면 · 성능에는 영향이 없다
// 실험실(/lab.html)이 이 이름표로 요소를 골라 따로 보여 준다. 요소 목록은 src/ds/catalog.js

/** 물체 하나에 이름표 (이미 달린 이름표는 덮어쓴다) */
export function tag(obj, id) {
  obj.userData.ds = id;
  return obj;
}

/**
 * parent.add 로 들어오는 물체에 「지금 이름표」를 단다 (이미 이름표가 있는 물체는 그대로).
 * 월드를 만드는 코드 중간중간 set('lamp') 처럼 바꿔 가며 쓴다. 함수 안에서 잠깐 바꿀 때는 with()
 */
export function tagAdds(parent) {
  const add = parent.add;
  let cur = null;
  parent.add = function (...objs) {
    if (cur) for (const o of objs) if (o?.userData && o.userData.ds == null) o.userData.ds = cur;
    return add.apply(this, objs);
  };
  return {
    set(id) { cur = id; },
    with(id, fn) { const prev = cur; cur = id; try { return fn(); } finally { cur = prev; } },
  };
}

/** 물체의 이름표: 자기 것이 없으면 가장 가까운 부모의 것 */
export function tagOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData?.ds != null) return o.userData.ds;
  return null;
}
