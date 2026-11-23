// 원자: 다리 — 세로로 선 각재 (벤치 다리 · 버팀대 · 옆판). 모양은 판자와 같은 상자, 기본 색이 짙은 나무
import { plank } from './plank.js';

export function leg(w, h, d, key = 'wood.dark', at) {
  return plank(w, h, d, key, at);
}
export const info = { id: 'part-leg', name: '다리', desc: '세로 각재. 벤치 다리 · 버팀대 · 옆판', api: "leg(w, h, d, 'wood.dark', at)", sample: () => leg(0.08, 0.45, 0.08) };
