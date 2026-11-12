// 서버와 클라이언트가 함께 쓰는 게임 설정 / 맵 레이아웃

export const CFG = {
  WOOD_PER_FIRE: 5,        // 모닥불 하나에 필요한 장작 수
  CHOPS_PER_WOOD: 3,       // 도끼질 몇 번에 장작 1개
  MAX_WOOD: 30,            // 손에 들 수 있는 장작 수 (패는 횟수에는 제한이 없고, 가득 차면 창고에 맡긴다)
  MAX_STORED: 300,         // 장작 창고에 맡길 수 있는 수 (기기마다 하나)
  FIRE_DURATION: 600_000,  // 모닥불 지속 시간 (ms): 장작 5개로 처음 붙였을 때
  FEED_MS: 120_000,        // 타는 중에 장작 1개를 더 넣으면 늘어나는 시간 (ms): 언제든 넣으면 10 → 12 → 14분…
  FIRE_MAX: 1_800_000,     // 장작을 더 넣어도 남은 시간은 30분까지 (한 화로를 끝없이 붙잡아 두지 않게)
  BASE_POWDERS: 3,         // 루미가 장작 없이 늘 채워 주는 기본 가루 수 (가방에 이보다 적으면 여기까지 채운다)
  MAX_POWDERS: 99,         // 가루는 사실상 제한 없음. 저장 데이터가 끝없이 커지지 않게 막는 안전장치만 둔다
  SEATS_PER_PIT: 4,
  SEAT_RADIUS: 2.4,
  EFFECT_DURATION: 12_000, // 가루 효과 지속 시간 (ms)
  CHOP_COOLDOWN: 450,
  DAILY_COINS: 30,         // 매일 00시(한국 시간)에 코인을 이 수로 다시 맞춘다 (남은 코인은 이어지지 않음)
  SHARE_BONUS: 10,         // 💌 공유 보너스 (하루 한 번)
  LEGEND_PRICE: 10,        // 루미 상점: ✦ 특별한 가루 한 개 값
  MAX_COINS: 99,
  TENT_CAP: 5,             // 글램핑 텐트 한 동에 들어갈 수 있는 사람 수
  TENT_R: 6.2,             // 글램핑 텐트 둥근 벽의 반지름 (v1.15: 안에 들어가 쉴 수 있게 3 → 6.2로 넓힘)
  TENT_INNER: 6.1,         // 텐트 중심에서 이 거리 안이면 「텐트 안」
};

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) — 코인 충전 · 공유 보너스 기준 */
export function kstDay(now = Date.now()) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const BOUNDS = { minX: -55, maxX: 55, minZ: -35, maxZ: 35 };

// 글램핑 텐트 12동: 북쪽 6동, 남쪽 6동. 각 텐트 앞에는 화로가 있다. (모닥불은 글램핑 화로에서만 피운다)
export const TENT_XS = [-42, -28, -14, 0, 14, 28];
export const TENTS = [];
export const PITS = [];
TENT_XS.forEach((x, i) => {
  TENTS.push({ id: `n${i}`, x, z: -29.5, facing: 0, label: `북쪽 ${i + 1}번 글램핑` });        // 문이 +z(가운데)를 향함
  PITS.push({ id: `tn${i}`, x, z: -18.5, kind: 'tent', label: `북쪽 ${i + 1}번 글램핑` });
  TENTS.push({ id: `s${i}`, x, z: 29.5, facing: Math.PI, label: `남쪽 ${i + 1}번 글램핑` });   // 문이 -z를 향함
  PITS.push({ id: `ts${i}`, x, z: 18.5, kind: 'tent', label: `남쪽 ${i + 1}번 글램핑` });
});
// 동쪽 끝 「장작 마당」: 큰길 북쪽에 장작 패는 곳, 길 건너 남쪽에 루미의 가루 공방. 둘 다 서쪽(광장 쪽)을 바라본다
// (광장에서 큰길 따라 오면 두 곳의 정면이 보이고, 장작을 패고 바로 길 건너 루미에게 갈 수 있게)
export const WOODYARD = { x: 44, z: -8.5 };
export const STUMPS = [
  { x: 40, z: -11.5 },
  { x: 43.5, z: -5 },
  { x: 46.5, z: -11 },
];

// 가루 상인 NPC: face 는 공방 모형의 회전(모형은 +x 쪽이 앞), front 는 손님이 서는 방향, ry 는 루미가 바라보는 방향
export const NPC = { x: 46, z: 9, ry: -Math.PI / 2, face: Math.PI, front: { x: -1, z: 0 }, name: '루미' };
// 숨겨진 가루병 (이스터에그): 루미 공방 뒤 선반 너머 바닥. 안내 · 지도에는 나오지 않는다. 기기마다 하루 한 번 ✦ 특별한 가루
export const EGG = { x: NPC.x + 2.3, z: NPC.z - 1.0, range: 1.6 };

// 장작 창고지기 NPC: 장작 패는 곳 바로 북서쪽(광장 쪽). 창고 오두막을 등지고 남쪽(장작 마당 · 큰길 쪽)을 본다
export const KEEPER = { x: 38, z: -16.5, ry: 0, name: '보리' };

/** (x, z)가 들어가 있는 텐트 (없으면 null) */
export function tentAt(x, z) {
  for (const t of TENTS) if ((x - t.x) ** 2 + (z - t.z) ** 2 < CFG.TENT_INNER ** 2) return t;
  return null;
}
/** 텐트 안 좌표 → 월드 좌표 (텐트 모형의 회전을 따른다. 문은 안쪽 +z) */
export function tentLocal(t, lx, lz) {
  const c = Math.cos(t.facing), s = Math.sin(t.facing);
  return { x: t.x + lx * c + lz * s, z: t.z - lx * s + lz * c };
}
// 텐트 안 화로 (v1.15: 가운데 둥근 화로 + 그 위 후드 · 연통이 지붕 꼭대기로 나간다. 불을 피우면 지붕 위로 연기)
// 화로도 바깥 모닥불처럼 장작 5개를 쌓고 불을 붙여 10분 동안 탄다 (같은 규칙). 둘레에 화로를 바라보는 둥근 소파, 자리 5개
export const TENT_WH = 2.6, TENT_RH = 3.8; // 텐트 벽 높이 · 지붕 높이 (층고를 높였다)
export const STOVE_LOCAL = { x: 0, z: 0 };
export const STOVE_SEAT_R = 2.4; // 화로 가운데에서 소파 자리까지
export const STOVE_SEAT_DEG = [108, 144, 180, 216, 252]; // 문(+z)에서 잰 각도: 문 쪽은 비워 둔 C자 소파
export const STOVES = TENTS.map((t) => {
  const p = tentLocal(t, STOVE_LOCAL.x, STOVE_LOCAL.z);
  return { id: `f${t.id}`, x: p.x, z: p.z, kind: 'stove', tent: t.id, facing: t.facing, label: `${t.label} 화로` };
});
/** 모든 불 피우는 자리: 바깥 화로 + 텐트 안 화로 (서버 · 클라이언트의 pits 는 이것으로 만든다) */
export const FIRES = [...PITS, ...STOVES];
export const seatsOf = (def) => (def.kind === 'stove' ? CFG.TENT_CAP : CFG.SEATS_PER_PIT);

export const SPAWN = { x: 0, z: 10.5 };

// 광장 가운데: 왼쪽 방명록, 오른쪽 캠핑장 소식 게시판. 나란히 서서 둘 다 입구(남쪽)를 본다
export const GUESTBOOK = { x: -3.4, z: 4.4 };
export const BOARD = { x: 3.4, z: 4.4 };

export const RANGE = { stump: 2.0, npc: 3.6, keeper: 3.4, pit: 3.2, guestbook: 2.8, board: 2.8 };

export function seatPos(pit, i) {
  if (pit.kind === 'stove') { // 텐트 화로: 둘레 C자 소파 (문 쪽은 비어 있다)
    const a = (STOVE_SEAT_DEG[i] * Math.PI) / 180 + pit.facing;
    const x = pit.x + Math.sin(a) * STOVE_SEAT_R;
    const z = pit.z + Math.cos(a) * STOVE_SEAT_R;
    return { x, z, ry: Math.atan2(pit.x - x, pit.z - z) };
  }
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
    name: e.id === 'rainbow' ? '오색 무지개 가루' : e.name.endsWith('가루') ? `${c.name} ${e.name}` : `${c.name} ${e.name} 가루`, // 별가루 → 「황금빛 별가루」
  };
}

// ---------------------------------------------------------------- 루미의 부탁 (퀘스트)
// 하나씩 차례로. 마치고 루미에게 가면 ✦ 특별한 가루를 받고 다음 부탁을 듣는다. 끝까지 하면 처음부터 다시
// type: 서버가 세는 행동 / goal: 목표 수 / reward: 받는 특별한 가루
export const QUESTS = [
  { id: 'light', type: 'light', goal: 1, title: '첫 모닥불', desc: '글램핑장 앞 화로에 장작을 쌓고 불을 붙여 줘', reward: 'aurora' },
  { id: 'sit3', type: 'sitSec', goal: 180, title: '3분 불멍', desc: '타오르는 모닥불에 앉아 3분 동안 불멍해 봐', reward: 'petals' },
  { id: 'chop20', type: 'wood', goal: 20, title: '장작 20개', desc: '장작을 손에 20개 모아 와 줘 (지금 든 장작도 세어 줄게)', reward: 'fireworks' },
  { id: 'sky', type: 'stargaze', goal: 1, title: '밤하늘 올려다보기', desc: '화면을 위로 끌어 올려 별이 가득한 밤하늘을 올려다봐', reward: 'galaxy' },
  { id: 'store', type: 'store', goal: 10, title: '장작 맡기기', desc: '창고지기 보리에게 장작을 10개 맡겨 봐', reward: 'butterflies' },
  { id: 'music', type: 'music', goal: 1, title: '모닥불 음악', desc: '모닥불에 앉아 좋아하는 노래를 한 곡 틀어 봐', reward: 'aurora' },
  { id: 'guestbook', type: 'guestbook', goal: 1, title: '오늘의 한마디', desc: '광장 방명록에 오늘 밤 이야기를 남겨 줘', reward: 'petals' },
  { id: 'share', type: 'share', goal: 1, title: '친구 초대', desc: '화면 위 💌 버튼으로 친구에게 캠핑장 링크를 보내 봐', reward: 'galaxy' },
  { id: 'together', type: 'together', goal: 1, title: '함께 불멍', desc: '다른 캠퍼와 같은 모닥불에 나란히 앉아 봐', reward: 'fireworks' },
  { id: 'sit10', type: 'sitSec', goal: 600, title: '10분 불멍', desc: '모닥불 앞에서 10분 동안 푹 쉬어 봐', reward: 'butterflies' },
];

// ✦ 특별한 가루: 루미의 부탁을 들어주면 받는다. 기본 가루에 없는 새 효과
export const LEGEND_POWDERS = {
  aurora: { name: '✦ 오로라 가루', desc: '모닥불 뒤로 오로라 빛의 띠가 물결쳐요', color: '#5dffc0', bg: 'linear-gradient(160deg, #5dffc0, #55c8ff 50%, #b26bff)' },
  fireworks: { name: '✦ 불꽃놀이 가루', desc: '불꽃을 쏘아 올려 하늘에서 터져요', color: '#ffd447', bg: 'conic-gradient(#ff4058, #ffd447, #5dff8f, #55c8ff, #ff6fb8, #ff4058)' },
  petals: { name: '✦ 꽃잎 회오리 가루', desc: '분홍 꽃잎이 휘돌며 올라가 흩날려요', color: '#ff8fc8', bg: 'radial-gradient(circle at 35% 30%, #fff, #ffc2dd 40%, #ff6fb8)' },
  galaxy: { name: '✦ 은하수 가루', desc: '모닥불 위에 별 원반이 천천히 돌아요', color: '#8f9bff', bg: 'radial-gradient(circle at 40% 40%, #fff 0%, #b9c4ff 18%, #5b4bd6 55%, #1b1650)' },
  butterflies: { name: '✦ 나비 떼 가루', desc: '알록달록한 나비들이 모닥불 주위를 날아요', color: '#ffb35c', bg: 'linear-gradient(135deg, #ffd447, #ff8f3a 50%, #ff6fb8)' },
};
export function legendPowder(effect) {
  const L = LEGEND_POWDERS[effect];
  return { id: Math.random().toString(36).slice(2, 10), color: L.color, effect, name: L.name, legend: true };
}
