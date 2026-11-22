// 캠핑장 주민 (NPC): 숲길 · 캠핑장 곳곳에서 저마다 할 일을 하는 사람들 (v1.22.0)
// - always: 늘 있는 주민 12명. 말을 걸면 하루 한 번 그 주민의 가루 1개, 주민 도장 1칸
// - weather: 날씨 테마일 때만 (우중 · 설산/크리스마스). 만나면 「숨은 도장」
// - night: 밤 11시 ~ 새벽 3시(한국 시각)에만. 만나면 「숨은 도장」
// - comfort: 찻집 할머니. 가루 대신 위로의 말과 따뜻한 차 한 잔 (몇 번이든)
// 서버(보상 · 거리 확인)와 화면(모습 · 대사)이 같은 목록을 쓴다. 걸어 다니는 주민의 위치도 시각으로 똑같이 계산한다
import { curveAt, TRAIL, PITS, TENTS, HILL_BENCH, LAKE, POND, POWDER_COLORS, POWDER_EFFECTS, kstDay } from './config.js';

export const RESIDENT_RANGE = 3.4;   // 이 안에서 말을 걸 수 있다
export const STAMP_GOALS = [6, 12];  // 하루에 늘 있는 주민을 이만큼 만나면 ✦ 특별한 가루
export const NIGHT_HOURS = [23, 3];  // 밤 주민이 나오는 시간 (한국 시각, 23시 ~ 새벽 3시 전)

/** 숲길 위 u 지점에서 길 바깥쪽(캠핑장 반대쪽)으로 off m 떨어진 곳 */
function onTrail(u, off = 0) {
  const [x, z] = curveAt(TRAIL.loop, u), [x2, z2] = curveAt(TRAIL.loop, u + 0.01);
  const l = Math.hypot(x2 - x, z2 - z), nx = -(z2 - z) / l, nz = (x2 - x) / l;
  const s = x * nx + z * nz > 0 ? 1 : -1;
  return { x: x + s * nx * off, z: z + s * nz * off, ox: s * nx, oz: s * nz, tx: (x2 - x) / l, tz: (z2 - z) / l };
}
const face = (p, tx, tz) => Math.atan2(tx - p.x, tz - p.z);
const pitOf = (id) => PITS.find((p) => p.id === id);
const color = (name) => POWDER_COLORS.find((c) => c.name === name)?.hex || '#ffd447';

function spot(u, off, ry) { const p = onTrail(u, off); return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: ry ?? Math.atan2(-p.ox, -p.oz) }; }

// ---------------------------------------------------------------- 자리 계산
const reed = spot(1.0, 2.1, null); reed.ry = Math.atan2(1, 0.1); // 갈대밭 쪽(바깥)을 향해 카메라를 든다
const kochia = spot(7.2, 2.7); kochia.ry = face(kochia, -12, -104); // 숲 너머 풍차를 올려다본다
const daisy = spot(12.8, 2.5); daisy.ry = Math.atan2(-1, 0.2); // 꽃밭(바깥) 쪽으로 쪼그려 앉는다
const muhly = spot(19.2, 2.6); muhly.ry = Math.atan2(-0.13, -0.99); // 길을 보며 벤치에서 책
const bridge = { x: 76.6, z: -23.6 }; bridge.ry = face(bridge, POND.x, POND.z); // 다리 옆에서 연못 풍경을 그린다
const lakeA = Math.atan2(-0.75, 0.66); // 호수 가운데에서 북서쪽 물가 (숲길 쪽 데크 서쪽 옆)
const lake = { x: +(LAKE.x + Math.sin(lakeA) * (LAKE.rx + 0.9)).toFixed(2), z: +(LAKE.z + Math.cos(lakeA) * (LAKE.rz + 0.9)).toFixed(2) };
lake.ry = face(lake, LAKE.x, LAKE.z);
const hill = { x: +(HILL_BENCH.x + 2.4).toFixed(2), z: +(HILL_BENCH.z - 1.6).toFixed(2) }; hill.ry = 1.9; // 언덕 위, 달이 뜬 쪽 하늘
const g = pitOf('ts3'), m = pitOf('tn2');
const guitar = { x: g.x + 4.4, z: g.z, ry: -Math.PI / 2 };        // 남쪽 4번 모닥불 동쪽 통나무
const marsh = { x: m.x - 4.4, z: m.z, ry: Math.PI / 2 };          // 북쪽 3번 모닥불 서쪽 통나무
const tent = TENTS.find((t) => t.id === 's5');
const coffee = { x: tent.x + 7, z: tent.z - 8.5, ry: -2.4 };    // 남쪽 6번 글램핑과 모닥불 사이 잔디 (큰길 쪽을 본다)
// 관리인 순찰 길: 큰길 한가운데(흙길)를 걷다가 광장은 가운데 기둥 · 크리스마스 트리를 피해 북쪽으로 둥글게 돈다 (풀 · 덤불 · 가로등을 밟지 않게)
const ROUND = [180, 150, 120, 90, 60, 30, 0].map((d) => { const a = (d * Math.PI) / 180; return [+(Math.cos(a) * 5.6).toFixed(2), +(-Math.sin(a) * 5.6).toFixed(2)]; });
const rangerPath = [[-44, 0.6], [-11, 0.6], ...ROUND.map(([x, z]) => [x, Math.min(z, 0.6)]), [11, 0.6], [40, 0.6]];
const night = pitOf('ts1'); const nightSpot = { x: night.x + 4.4, z: night.z, ry: -Math.PI / 2 }; // 남쪽 2번 모닥불 동쪽 통나무 (서쪽엔 TV)

// ---------------------------------------------------------------- 주민 목록
// look: 캐릭터 모습 · pose: 몸짓 (src/residents.js) · powder: 주는 가루 (효과 id, 색 이름) · lines: 대사 (매번 하나씩)
export const RESIDENTS = [
  // ---------- 🌲 숲길 (8)
  {
    id: 'photo', kind: 'always', area: 'trail', name: '하루', title: '갈대밭 사진가', icon: '📷', ...reed, pose: 'photo', clear: 2.6,
    look: { skin: '#f3cfae', hair: '#3a2a22', shirt: '#4f6d8f', pants: '#2f3545', hat: 'cap' },
    powder: ['sparkle', '하늘빛'],
    lines: {
      base: ['갈대는 바람이 불 때 제일 예뻐요. 지금처럼요.', '사진은 핑계예요. 사실 이 소리 들으러 와요. 사락사락…', '한 장 찍어 줄까요? 하하, 농담이에요. 마음에 담아 가요.'],
      rain: ['비 오는 갈대밭은 색이 더 깊어요. 렌즈는 젖어도 괜찮아요.'],
      snow: ['눈 쌓인 갈대, 오늘만 찍을 수 있는 사진이에요.'],
    },
    gift: '오늘 찍은 하늘 색을 가루로 담아 봤어요',
  },
  {
    id: 'farmer', kind: 'always', area: 'trail', name: '바람 할아버지', title: '풍차지기', icon: '🌾', ...kochia, pose: 'farmer', clear: 2.4,
    look: { skin: '#e8b98f', hair: '#d8d2c8', shirt: '#7a5a3a', pants: '#4a4a3a', hat: 'straw' },
    powder: ['spiral', '초록빛'],
    lines: {
      base: ['저 풍차는 쉰 해째 돌고 있어. 서두르지 않고, 멈추지도 않고.', '댑싸리가 빨갛게 물들면 가을이 깊었다는 거야.', '바람 따라 천천히 걸어 봐. 길이 알아서 데려다줄 거야.'],
      rain: ['비 오는 날엔 풍차도 쉬어 가. 사람도 그래야지.'],
      snow: ['눈 오는 날 들판은 조용하지. 이런 날이 좋아.'],
    },
    gift: '바람에 실려 온 거야. 가져가',
  },
  {
    id: 'daisy', kind: 'always', area: 'trail', name: '봄이', title: '꽃 따는 아이', icon: '🌼', ...daisy, pose: 'crouch',
    look: { skin: '#ffe0c7', hair: '#8a4f2a', shirt: '#ffd36b', pants: '#6b8ec9', hat: 'none' },
    powder: ['hearts', '분홍빛'],
    lines: {
      base: ['데이지 화관 만들고 있어! 너도 하나 줄까?', '꽃은 꺾으면 금방 시들어서, 딱 하나만 딸 거야.', '여기 꽃이 몇 송이인지 세다가 까먹었어. 헤헤.'],
      rain: ['꽃들이 물 마시는 중이야! 쉿.'],
      snow: ['꽃이 눈 이불 덮고 자고 있어.'],
    },
    gift: '꽃 대신 이거 줄게! 하트 가루야',
  },
  {
    id: 'walker', kind: 'always', area: 'trail', name: '솔', title: '강아지와 산책하는 사람', icon: '🐕', pose: 'walker', walk: { from: 14.75, to: 16.25, off: 0.55, speed: 0.85 },
    look: { skin: '#f6d2b5', hair: '#5a3a2a', shirt: '#e98fa6', pants: '#3d4a6b', hat: 'beanie' },
    powder: ['hearts', '진홍빛'],
    lines: {
      base: ['얘는 콩이예요. 벚꽃길만 오면 꼬리가 멈추질 않아요.', '하루 한 번은 꼭 걸어요. 콩이 덕분에요.', '천천히 걸으면 꽃잎이 어깨에 내려앉아요.'],
      rain: ['콩이가 웅덩이를 그냥 못 지나가요. 하하.'],
      snow: ['콩이가 눈밭에서 신났어요. 저는 춥고요.'],
    },
    gift: '콩이가 주래요. 꼬리 흔드는 거 보이죠?',
  },
  {
    id: 'reader', kind: 'always', area: 'trail', name: '서연', title: '책 읽는 사람', icon: '📖', ...muhly, pose: 'read', clear: 2.9,
    look: { skin: '#f7d9c4', hair: '#2a1f1c', shirt: '#9a7bc9', pants: '#3a3550', hat: 'none' },
    powder: ['rings', '보랏빛'],
    lines: {
      base: ['핑크뮬리 사이에선 글자가 더 천천히 읽혀요.', '같은 문장을 세 번째 읽고 있어요. 좋아서요.', '오늘은 몇 쪽 못 읽어도 괜찮은 날이에요.'],
      rain: ['빗소리 들으며 읽는 책은 두 배로 좋아요.'],
      snow: ['눈 내리는 날엔 따뜻한 문장만 골라 읽어요.'],
    },
    gift: '책갈피에 끼워 뒀던 가루예요',
  },
  {
    id: 'painter', kind: 'always', area: 'trail', name: '노을', title: '그림 그리는 여행자', icon: '🎨', ...bridge, pose: 'paint',
    look: { skin: '#f0c9a6', hair: '#b05a3a', shirt: '#e0d6c2', pants: '#5a6a7a', hat: 'beanie' },
    powder: ['rainbow', '하늘빛'],
    lines: {
      base: ['다리랑 연못을 그리는 중이에요. 물빛이 자꾸 바뀌어서 큰일이에요.', '여행하면서 모닥불 그림만 백 장 넘게 그렸어요.', '잘 그리려고 안 해요. 오래 보려고 그려요.'],
      rain: ['물감이 번져요. 그래도 비 오는 날 그림이 제일 좋아요.'],
      snow: ['하얀 물감이 모자라요. 세상이 다 하얘서.'],
    },
    gift: '팔레트에 남은 색을 다 모았어요. 무지개가 됐네요',
  },
  {
    id: 'fisher', kind: 'always', area: 'trail', name: '물결 할아버지', title: '호숫가 낚시꾼', icon: '🎣', ...lake, pose: 'fish',
    look: { skin: '#e6b48a', hair: '#cfcac0', shirt: '#3f6b5a', pants: '#4a3f35', hat: 'straw' },
    powder: ['fireflies', '청록빛'],
    lines: {
      base: ['…응? 아, 졸았네. 고기는 오늘도 안 물어.', '낚시는 고기 잡으러 오는 게 아니야. 기다리러 오는 거지.', '달이 물에 비치면 찌가 두 개로 보여. 허허.'],
      rain: ['비 오는 날이 입질이 좋다던데… 오늘은 아닌가 봐.'],
      snow: ['호수가 얼기 전에 한 번만 더 앉아 있고 싶었어.'],
    },
    gift: '고기 대신 반딧불을 낚았지 뭐야',
  },
  {
    id: 'star', kind: 'always', area: 'trail', name: '별지기', title: '언덕의 별지기', icon: '🔭', ...hill, pose: 'scope',
    look: { skin: '#f2d3bb', hair: '#2b2f45', shirt: '#2f3a66', pants: '#22263a', hat: 'wizard' },
    powder: ['stars', '황금빛'],
    lines: {
      base: ['오늘은 별이 잘 보이는 밤이에요. 고개를 들어 봐요.', '저 반짝이는 별빛, 사실 아주 오래전에 떠난 빛이에요.', '고양이도 매일 밤 여기 와요. 별 보러 오는 건지, 저 보러 오는 건지.'],
      rain: ['구름 뒤에도 별은 그대로 있어요. 안 보일 뿐이에요.'],
      snow: ['눈구름이 걷히면 제일 맑은 하늘이 와요. 기다려 봐요.'],
    },
    gift: '망원경으로 주운 별가루예요',
  },
  // ---------- 🏕️ 캠핑장 (4)
  {
    id: 'guitar', kind: 'always', area: 'camp', name: '태오', title: '기타 치는 캠퍼', icon: '🎸', ...guitar, pose: 'guitar', seat: 'log',
    look: { skin: '#f1c7a2', hair: '#2a1f1c', shirt: '#c25a3a', pants: '#2f3545', hat: 'none' },
    powder: ['pillar', '진홍빛'],
    lines: {
      base: ['신청곡 받아요. 근데 세 곡밖에 못 쳐요.', '불 앞에서 치면 틀려도 아무도 몰라요. 장작 소리가 덮어 줘요.', '노래는 몰라도 돼요. 같이 흥얼거리면 돼요.'],
      rain: ['천막 위 빗소리가 드럼이에요. 오늘 합주 좋다.'],
      snow: ['손이 곱아서 코드가 자꾸 미끄러져요. 하하.'],
    },
    gift: '불꽃처럼 솟는 가루예요. 후렴에 뿌려요',
  },
  {
    id: 'marsh', kind: 'always', area: 'camp', name: '도토리', title: '마시멜로 굽는 꼬마', icon: '🍡', ...marsh, pose: 'roast', seat: 'log',
    look: { skin: '#ffe3cc', hair: '#6b4a2b', shirt: '#7fc4a8', pants: '#4a5a8a', hat: 'beanie' },
    powder: ['sparkle', '황금빛'],
    lines: {
      base: ['노릇노릇하게가 제일 어려워. 맨날 까맣게 돼.', '마시멜로 하나 줄까? 아, 방금 떨어뜨렸다…', '불 너무 가까이 가면 안 돼! 엄마가 그랬어.'],
      rain: ['비 와도 마시멜로는 구워야 해!'],
      snow: ['눈 오는 날 마시멜로가 제일 맛있어.'],
    },
    gift: '반짝반짝 금가루! 마시멜로 색이야',
  },
  {
    id: 'coffee', kind: 'always', area: 'camp', name: '윤', title: '커피 내리는 캠퍼', icon: '☕', ...coffee, pose: 'pour',
    look: { skin: '#f5d0b0', hair: '#4a3324', shirt: '#d9c3a3', pants: '#5a4330', hat: 'none' },
    powder: ['rings', '새하얀'],
    lines: {
      base: ['물은 천천히, 원을 그리면서. 그게 다예요.', '캠핑 오면 커피가 더 맛있는 이유요? 기다리는 시간 때문이에요.', '향 좋죠? 맡는 건 공짜예요.'],
      rain: ['비 오는 날 커피 향은 더 멀리 가요.'],
      snow: ['손 시리죠? 김이라도 쬐고 가요.'],
    },
    gift: '김처럼 피어오르는 가루예요',
  },
  {
    id: 'ranger', kind: 'always', area: 'camp', name: '김 반장', title: '캠핑장 관리인', icon: '🔦', pose: 'ranger', patrol: { pts: rangerPath, speed: 1.0 },
    look: { skin: '#e9be98', hair: '#3a3a3a', shirt: '#5f7a4a', pants: '#3d3a30', hat: 'cap' },
    powder: null, // 무작위 가루
    lines: {
      base: ['장작은 동쪽 통나무에서 패요. 꾹 누르면 계속 패져요.', '숲길 한 바퀴 돌아봤어요? 주민들이 다들 반가워할 거예요.', '불 앞에선 아무 말 안 해도 괜찮아요. 다들 그러러 와요.', '모닥불에 앉아서 숫자키를 누르면 가루를 뿌려요. 색이 바뀌어요.'],
      rain: ['비 오는 날엔 천막 있는 모닥불이 좋아요. 다 덮어 놨어요.'],
      snow: ['길 미끄러워요. 천천히 다녀요.'],
    },
    gift: '순찰하다 주운 가루예요. 뭐가 나올지 몰라요',
  },
  // ---------- 🌧️❄️ 날씨 주민
  {
    id: 'raincoat', kind: 'weather', themes: ['rain'], area: 'camp', name: '방울이', title: '우비 입은 아이', icon: '🐌', x: -8.5, z: 13.5, ry: 2.4, pose: 'crouch', outfit: 'raincoat',
    look: { skin: '#ffe0c7', hair: '#3a2a22', shirt: '#f2c230', pants: '#3d4a6b', hat: 'none' },
    powder: ['fireflies', '초록빛'],
    lines: { base: ['쉿, 달팽이가 산책 중이야. 엄청 느려!', '비 오는 날에만 나오는 친구들이 있어. 나도 그래!', '웅덩이에 하늘이 들어 있어. 봐 봐!'] },
    gift: '비 오는 날 만난 기념이야!',
  },
  {
    id: 'snowman', kind: 'weather', themes: ['snow', 'christmas'], area: 'camp', name: '눈송이', title: '눈사람 만드는 아이', icon: '⛄', x: 8.5, z: 13.5, ry: -2.3, pose: 'snowman',
    look: { skin: '#ffe6d2', hair: '#6b4a2b', shirt: '#e0566a', pants: '#3d4a6b', hat: 'beanie' },
    powder: ['stars', '새하얀'],
    lines: { base: ['눈사람 머리가 자꾸 굴러떨어져!', '코는 당근 대신 솔방울이야. 귀엽지?', '눈 오는 날은 일 년에 몇 번 없어. 놓치면 안 돼!'] },
    gift: '눈 결정 모양 가루! 녹지 않는 눈이야',
  },
  // ---------- 🌌 밤 주민
  {
    id: 'night', kind: 'night', area: 'camp', name: '새벽', title: '잠 못 드는 밤의 친구', icon: '🌙', ...nightSpot, pose: 'blanket', seat: 'log',
    look: { skin: '#f3d6c2', hair: '#2a2a3a', shirt: '#6a7aa8', pants: '#3a3a52', hat: 'none' },
    powder: ['fireflies', '황금빛'],
    lines: { base: ['이 시간까지 깨어 있구나. 나도 그래요.', '밤이 길 땐 불을 보면 좀 짧아져요.', '잠은 안 와도 괜찮아요. 눈만 감고 있어도 쉬는 거래요.'] },
    gift: '밤에만 빛나는 가루예요. 같이 깨어 있어 줘서 고마워요',
  },
  // ---------- 🫖 위로해 주는 주민
  {
    id: 'grandma', kind: 'comfort', area: 'camp', name: '찻집 할머니', title: '따뜻한 차 한 잔', icon: '🫖', x: -22, z: 9, ry: 0, pose: 'rock', seat: 'rocker',
    look: { skin: '#f0cfb5', hair: '#e8e4dc', shirt: '#b5654a', pants: '#5a4a40', hat: 'none' },
    powder: null,
    lines: { base: ['어서 와요. 오늘 하루 어땠어요?'] },
  },
];

// 찻집 할머니에게 고르는 마음과 대답 (매번 하나씩)
export const MOODS = [
  { id: 'tired', icon: '😮‍💨', label: '지쳤어요', replies: ['오늘도 버텼네. 그거면 충분해요. 여기선 아무것도 안 해도 돼요.', '애썼어요, 정말. 잠깐 불 앞에 앉아서 숨 좀 돌리고 가요.', '쉬는 것도 일이에요. 오늘은 그 일만 해요.'] },
  { id: 'upset', icon: '😔', label: '속상한 일이 있었어요', replies: ['그랬구나. 불 앞에 잠깐 털어놓고 가요. 불은 다 태워 주니까.', '속상할 만했네. 마음이 그렇다는 건, 그만큼 진심이었다는 거예요.', '오늘 일은 오늘 장작이랑 같이 태워 버려요.'] },
  { id: 'lonely', icon: '🫥', label: '외로워요', replies: ['저기 모닥불 보이죠? 다들 말없이 앉아 있어도, 같이 있는 거예요.', '나도 여기 매일 있어요. 또 와요. 차 끓여 놓을게요.', '혼자 온 사람도 불 앞에선 혼자가 아니에요.'] },
  { id: 'sleep', icon: '🌙', label: '잠이 안 와요', replies: ['장작 타는 소리 들으면서 숨 천천히 쉬어 봐요. 하나, 둘…', '잠은 쫓아가면 도망가요. 그냥 불만 보고 있어요.', '따뜻한 차 마시고, 눈만 감고 있어도 쉬는 거예요.'] },
  { id: 'fine', icon: '🙂', label: '그냥 괜찮아요', replies: ['좋네. 그 마음 오래 가게 따뜻한 차 한 잔 줄게요.', '괜찮은 날도 소중해요. 천천히 쉬다 가요.', '그 얼굴 보니 나도 좋네요. 차 식기 전에 마셔요.'] },
];

// ---------------------------------------------------------------- 걸어 다니는 주민의 위치 (서버 · 화면이 같은 시각이면 같은 자리)
const walkLen = new Map();
function pathLen(w) {
  if (walkLen.has(w)) return walkLen.get(w);
  let L = 0, prev = onTrail(w.from, -w.off);
  for (let u = w.from + 0.02; u <= w.to + 1e-6; u += 0.02) { const p = onTrail(u, -w.off); L += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
  walkLen.set(w, L);
  return L;
}
/** 지금 위치 { x, z, ry, moving } (서 있는 주민은 늘 같은 자리) */
export function residentPos(r, now = Date.now()) {
  if (r.walk) { // 벚꽃길을 왔다 갔다 (끝에서 4초 쉬었다 돌아선다)
    const w = r.walk, L = pathLen(w), T = L / w.speed, cyc = 2 * (T + 4), t = (now / 1000) % cyc;
    let k, back = false, moving = true;
    if (t < T) k = t / T; else if (t < T + 4) { k = 1; moving = false; } else if (t < 2 * T + 4) { k = 1 - (t - T - 4) / T; back = true; } else { k = 0; moving = false; back = true; }
    const u = w.from + (w.to - w.from) * k, p = onTrail(u, -w.off);
    const dir = back ? -1 : 1;
    const ry = moving ? Math.atan2(p.tx * dir, p.tz * dir) : Math.atan2(p.tx * (back ? 1 : -1), p.tz * (back ? 1 : -1));
    return { x: p.x, z: p.z, ry, moving, tx: p.tx * dir, tz: p.tz * dir };
  }
  if (r.patrol) { // 정해진 길(점들을 이은 선)을 따라 천천히 순찰하고, 끝에서 5초 쉬었다 돌아선다
    const P = r.patrol, pts = P.pts;
    if (!P.len) { P.seg = []; P.len = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); P.seg.push(l); P.len += l; } }
    const T = P.len / P.speed, cyc = 2 * (T + 5), t = (now / 1000) % cyc;
    let s, back = false, moving = true;
    if (t < T) s = t * P.speed; else if (t < T + 5) { s = P.len; moving = false; } else if (t < 2 * T + 5) { s = P.len - (t - T - 5) * P.speed; back = true; } else { s = 0; moving = false; back = true; }
    let i = 0; while (i < P.seg.length - 1 && s > P.seg[i]) { s -= P.seg[i]; i++; }
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], k = Math.min(1, s / P.seg[i]);
    const dir = back ? -1 : 1, tx = (bx - ax) / P.seg[i] * dir, tz = (bz - az) / P.seg[i] * dir;
    return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, ry: Math.atan2(moving ? tx : -tx, moving ? tz : -tz), moving };
  }
  return { x: r.x, z: r.z, ry: r.ry, moving: false };
}

/** 한국 시각 시(0~23) */
export const kstHour = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).getUTCHours();
/** 지금 이 주민이 캠핑장에 나와 있는지 */
export function residentActive(r, theme, now = Date.now()) {
  if (r.kind === 'weather') return r.themes.includes(theme);
  if (r.kind === 'night') { const h = kstHour(now); return h >= NIGHT_HOURS[0] || h < NIGHT_HOURS[1]; }
  return true;
}
export const ALWAYS = RESIDENTS.filter((r) => r.kind === 'always');

/** 주민이 주는 가루 (효과 · 색이 정해져 있다) */
export function residentPowder(r, rnd) {
  if (!r.powder) return rnd();
  const [effect, cname] = r.powder;
  const e = POWDER_EFFECTS.find((x) => x.id === effect), hex = color(cname);
  return { id: Math.random().toString(36).slice(2, 10), color: hex, effect, name: effect === 'rainbow' ? '오색 무지개 가루' : e.name.endsWith('가루') ? `${cname} ${e.name}` : `${cname} ${e.name} 가루` };
}

export { kstDay };
