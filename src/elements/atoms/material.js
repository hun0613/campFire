// 원자: 재질. 팔레트 이름으로 색을 찾아 칠한다
// 규칙: 재질은 toon()(셀 셰이딩) · glow()(빛나는 것)만. 같은 색 재질은 하나를 나눠 쓴다 (src/toon.js 가 색별로 캐시)
import { toon, glow } from '../../toon.js';
import { PALETTE } from './palette.js';

/** 팔레트 이름 → 색 ('wood.base' → '#8b5a35'). '#rrggbb' 는 그대로 (팔레트에 없는 색은 쓰지 않는 게 원칙) */
export function color(key) {
  if (key.startsWith('#')) return key;
  const c = key.split('.').reduce((o, k) => o?.[k], PALETTE);
  if (!c) throw new Error(`팔레트에 없는 색: ${key}`);
  return c;
}
/** 팔레트 이름으로 칠한 셀 셰이딩 재질 */
export const paint = (key, opts) => toon(color(key), opts);
/** 팔레트 이름으로 칠한 빛나는 재질 (블룸). strength 빛 세기 */
export const shine = (key, strength = 3) => glow(color(key), strength);
