// 서버와 클라이언트가 함께 쓰는 게임 설정 / 맵 레이아웃

export const CFG = {
  WOOD_PER_FIRE: 5,        // 모닥불 하나에 필요한 장작 수 (= 루미에게 가루를 받기 위한 장작 수)
  CHOPS_PER_WOOD: 3,       // 도끼질 몇 번에 장작 1개
  MAX_WOOD: 30,
  FIRE_DURATION: 600_000,  // 모닥불 지속 시간 (ms)
  POWDERS_PER_VISIT: 3,    // 한 번에 받는 가루 수
  MAX_POWDERS: 9,
  SEATS_PER_PIT: 4,
  SEAT_RADIUS: 2.4,
  EFFECT_DURATION: 12_000, // 가루 효과 지속 시간 (ms)
  CHOP_COOLDOWN: 450,
};

export const BOUNDS = { minX: -55, maxX: 55, minZ: -35, maxZ: 35 };

// 글램핑 텐트 10동: 북쪽 5동, 남쪽 5동. 각 텐트 앞에는 화로가 있다.
export const TENT_XS = [-28, -14, 0, 14, 28];
export const TENTS = [];
export const PITS = [];
TENT_XS.forEach((x, i) => {
  TENTS.push({ id: `n${i}`, x, z: -27, facing: 0 });        // 문이 +z(가운데)를 향함
  PITS.push({ id: `tn${i}`, x, z: -18.5, kind: 'tent', label: `북쪽 ${i + 1}번 글램핑` });
  TENTS.push({ id: `s${i}`, x, z: 27, facing: Math.PI });   // 문이 -z를 향함
  PITS.push({ id: `ts${i}`, x, z: 18.5, kind: 'tent', label: `남쪽 ${i + 1}번 글램핑` });
});
// 가운데 공터 화로 3개
PITS.push(
  { id: 'c0', x: -5.5, z: -3, kind: 'clearing', label: '공터 화로' },
  { id: 'c1', x: 5.5, z: -3, kind: 'clearing', label: '공터 화로' },
  { id: 'c2', x: 0, z: 5, kind: 'clearing', label: '공터 화로' },
);

// 장작 패는 곳 (동쪽)
export const WOODYARD = { x: 45, z: 0 };
export const STUMPS = [
  { x: 41, z: -3 },
  { x: 44.5, z: 3.5 },
  { x: 47.5, z: -2.5 },
];

// 가루 상인 NPC (서쪽)
export const NPC = { x: -48, z: 0, ry: Math.PI / 2, name: '루미' };

export const SPAWN = { x: 0, z: 10.5 };

// 방명록 (처음 들어오는 곳 바로 앞 왼쪽 — 들어오자마자 보이게)
export const GUESTBOOK = { x: -3.8, z: 8.4 };
// 캠핑장 소식 게시판 (방명록 맞은편)
export const BOARD = { x: 6.2, z: 8.2 };

export const RANGE = { stump: 2.0, npc: 3.6, pit: 3.2, guestbook: 2.8, board: 2.8 };

export function seatPos(pit, i) {
  const a = Math.PI / 4 + i * (Math.PI * 2 / CFG.SEATS_PER_PIT);
  const x = pit.x + Math.cos(a) * CFG.SEAT_RADIUS;
  const z = pit.z + Math.sin(a) * CFG.SEAT_RADIUS;
  const ry = Math.atan2(pit.x - x, pit.z - z);
  return { x, z, ry };
}

// 캐릭터 꾸미기 팔레트
export const LOOKS = {
  skin: ['#ffe0c7', '#f6c9a0', '#dba377', '#a8714a'],
  hair: ['#5a3825', '#2b2220', '#c9772f', '#e8c35c', '#e0605a', '#8a63d8', '#4a86d8', '#f2a6c6'],
  shirt: ['#e65a45', '#f2a93b', '#5aa36b', '#3f8fd1', '#8b5cc7', '#f07fa8', '#f4efe1', '#3a3f4b'],
  pants: ['#3d4a6b', '#6b5a45', '#2f3b2f', '#e8e0cc'],
  hat: [
    { id: 'none', name: '없음' },
    { id: 'straw', name: '밀짚모자' },
    { id: 'beanie', name: '비니' },
    { id: 'cap', name: '캡모자' },
  ],
};

// 마법 가루
export const POWDER_COLORS = [
  { name: '보랏빛', hex: '#b26bff' },
  { name: '하늘빛', hex: '#55c8ff' },
  { name: '초록빛', hex: '#5dff8f' },
  { name: '분홍빛', hex: '#ff6fb8' },
  { name: '황금빛', hex: '#ffd447' },
  { name: '청록빛', hex: '#38ffd6' },
  { name: '새하얀', hex: '#eef4ff' },
  { name: '진홍빛', hex: '#ff4058' },
];
export const POWDER_EFFECTS = [
  { id: 'sparkle', name: '반짝이' },
  { id: 'spiral', name: '소용돌이' },
  { id: 'pillar', name: '불기둥' },
  { id: 'rings', name: '연기고리' },
  { id: 'fireflies', name: '반딧불' },
  { id: 'stars', name: '별가루' },
  { id: 'hearts', name: '하트' },
  { id: 'rainbow', name: '무지개' },
];

export function randomPowder() {
  const c = POWDER_COLORS[Math.floor(Math.random() * POWDER_COLORS.length)];
  const e = POWDER_EFFECTS[Math.floor(Math.random() * POWDER_EFFECTS.length)];
  return {
    id: Math.random().toString(36).slice(2, 10),
    color: c.hex,
    effect: e.id,
    name: e.id === 'rainbow' ? '오색 무지개 가루' : `${c.name} ${e.name} 가루`,
  };
}
