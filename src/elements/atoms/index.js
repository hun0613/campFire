// 원자 모음: 분자(src/elements/molecules)는 여기서 가져다 조립한다
//   import { plank, leg } from '../atoms/index.js';
// 원자 하나 = 파일 하나. 디자이너가 원자 하나를 고쳐 보내면 그 파일만 바꿔 끼운다
export { PALETTE } from './palette.js';
export { color, paint, shine } from './material.js';
import { plank, info as plankInfo } from './plank.js';
import { leg, info as legInfo } from './leg.js';
import { pole, info as poleInfo } from './pole.js';
import { log, info as logInfo } from './log.js';
import { stone, info as stoneInfo } from './stone.js';
import { bulb, info as bulbInfo } from './bulb.js';
import { cloth, info as clothInfo } from './cloth.js';
export { plank, leg, pole, log, stone, bulb, cloth };

/** 부품 원자 목록 (실험실 · 디자이너 키트) — file: 바꿔 끼울 파일 */
export const PARTS = [
  [plankInfo, 'plank'], [legInfo, 'leg'], [poleInfo, 'pole'], [logInfo, 'log'], [stoneInfo, 'stone'], [bulbInfo, 'bulb'], [clothInfo, 'cloth'],
].map(([i, f]) => ({ ...i, file: `src/elements/atoms/${f}.js`, make: i.sample }));
