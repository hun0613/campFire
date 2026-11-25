// 불멍 디자인 시스템 카탈로그: 게임을 이루는 요소를 아토믹 단계(원자 → 분자 → 유기체 → 템플릿 → 페이지)로 늘어놓은 목록
// 3D 요소는 게임 코드의 이름표(userData.ds, src/ds/tag.js)로 실제 월드에서 골라 보여 준다
//   tags: 보여 줄 이름표 (없으면 [id]) · parts: 이 요소를 이루는 아래 단계 요소 · extracted: 떼어 낸 요소 파일 (변형 · 바꿔 끼우기 가능)
//   view: 3D 가 아닌 화면 (palette · materials · tokens · icons · font · ui-*)
import { WOODYARD, NPC, KEEPER, LAKE_BENCH, HILL_BENCH, SPOTS, POND } from '../../shared/config.js';
import { RESIDENTS } from '../../shared/residents.js';
import { PARTS } from '../elements/atoms/index.js';

export const LEVELS = [
  { id: 'atom', name: '원자', en: 'Atoms', desc: '더 나눌 수 없는 가장 작은 단위: 색 · 재질 · 글꼴 · 아이콘' },
  { id: 'molecule', name: '분자', en: 'Molecules', desc: '원자를 묶은 작은 물건: 벤치 · 가로등 · 의자 · 버튼' },
  { id: 'organism', name: '유기체', en: 'Organisms', desc: '분자를 묶은 큰 덩어리: 모닥불 자리 · 공방 · 텐트 · 주민' },
  { id: 'template', name: '템플릿', en: 'Templates', desc: '덩어리를 놓은 구역 배치: 광장 · 장작 마당 · 숲길 쉼터' },
  { id: 'page', name: '페이지', en: 'Pages', desc: '실제 게임 장면: 캠핑장 전체 · 불멍 화면' },
];

const pond = POND;
const lake = SPOTS.find((s) => s.id === 'lake') || LAKE_BENCH;

/** @type {Array<{id:string,name:string,level:string,area:'3d'|'ui',group?:string,desc?:string,where?:string,tags?:string[],parts?:string[],extracted?:string,view?:string,region?:object,camera?:object,hidden?:boolean}>} */
export const CATALOG = [
  // ───────────── 원자 ─────────────
  { id: 'palette', name: '색', level: 'atom', area: '3d', group: '색 · 재질', view: 'palette', where: 'src/elements/atoms/palette.js · 각 파일에 직접 적힌 색', desc: '3D 요소가 쓰는 색. 공용 팔레트(palette.js)에 옮긴 색과, 아직 코드에 직접 적힌 색을 함께 본다' },
  { id: 'materials', name: '재질', level: 'atom', area: '3d', group: '색 · 재질', view: 'materials', where: 'src/elements/atoms/material.js · src/toon.js', desc: '셀 셰이딩(toon) · 빛나는(glow) · 투명 · 셰이더 재질이 어디에 얼마나 쓰이는지' },
  ...PARTS.map((p) => ({ id: p.id, name: p.name, level: 'atom', area: '3d', group: '기본 부품', where: p.file, extracted: p.file, api: p.api, desc: `${p.desc}. 요소(분자)는 이 부품으로 조립한다`, sample: true })),
  { id: 'tokens', name: 'UI 토큰', level: 'atom', area: 'ui', group: 'UI', view: 'tokens', where: 'src/tokens.css', desc: '카드 · 나무 버튼의 색 · 그림자 · 둥근 정도' },
  { id: 'icons', name: '아이콘', level: 'atom', area: 'ui', group: 'UI', view: 'icons', where: 'src/icons.js', desc: '버튼에 새긴 솔리드 아이콘 (크기 · 가운데 맞춤 표 NORM)' },
  { id: 'powder-icons', name: '가루 아이콘', level: 'atom', area: 'ui', group: 'UI', view: 'powder-icons', where: 'src/powderIcons.js', desc: '가루 효과마다 다른 그림' },
  { id: 'font', name: '글꼴', level: 'atom', area: 'ui', group: 'UI', view: 'font', where: 'public/fonts · src/style.css', desc: '머니그라피 Rounded (원본 그대로 제공, 수정 · 재배포 금지)' },

  // ───────────── 분자 ─────────────
  { id: 'bench', name: '벤치', level: 'molecule', area: '3d', group: '앉는 곳', parts: ['part-plank', 'part-leg'], where: 'src/elements/molecules/bench.js', extracted: 'src/elements/molecules/bench.js', desc: '광장 · 숲길(호숫가) · 노을 언덕 · 주민용 작은 벤치, 모양 4가지' },
  { id: 'camp-chair', name: '캠핑 의자', level: 'molecule', area: '3d', group: '앉는 곳', parts: ['part-plank', 'part-pole'], where: 'src/elements/molecules/camp-chair.js', extracted: 'src/elements/molecules/camp-chair.js', desc: '텐트 앞 화로 둘레 접이식 의자 (자리마다 색이 다름)' },
  { id: 'stump-seat', name: '그루터기 의자', level: 'molecule', area: '3d', group: '앉는 곳', where: 'src/fire.js #stump()', desc: '화로 둘레 그루터기 자리', hidden: true }, // 지금 게임에 없음 (모든 바깥 화로가 텐트 앞 캠핑 의자). 코드만 남아 있다
  { id: 'fire-ring', name: '화로 돌', level: 'molecule', area: '3d', group: '불', parts: ['part-stone'], where: 'src/elements/molecules/fire-ring.js', extracted: 'src/elements/molecules/fire-ring.js', desc: '화로 둘레 돌 11개와 재' },
  { id: 'log-pile', name: '장작더미', level: 'molecule', area: '3d', group: '불', fire: 'stacked', parts: ['part-pole', 'part-log'], where: 'src/elements/molecules/log-pile.js', extracted: 'src/elements/molecules/log-pile.js', desc: '화로에 쌓은 장작. 불 상태에 따라 줄어들고 타는 색이 된다' },
  { id: 'fire-flame', name: '불꽃', level: 'molecule', area: '3d', group: '불', fire: 'lit', where: 'src/fire.js flamePoints', desc: '불꽃 · 불씨 · 불티 입자, 빛무리, 바닥 불빛' },
  { id: 'split-log', name: '쪼갠 장작', level: 'molecule', area: '3d', group: '불', where: 'src/woodcut.js makeHalf()', desc: '도끼로 쪼갠 반쪽 통나무 (그루터기 · 품 · 손). 게임에서는 도끼질할 때만 나와서 실험실은 견본을 놓아 보여 준다' },
  { id: 'lamp', name: '가로등', level: 'molecule', area: '3d', group: '불빛', where: 'src/world.js lamp()', desc: '큰길 · 텐트 진입로 가로등 (기둥 · 갓 · 전구 · 빛 웅덩이)' },
  { id: 'trail-lantern', name: '숲길 랜턴', level: 'molecule', area: '3d', group: '불빛', where: 'src/trail.js', desc: '숲길을 따라 놓인 랜턴' },
  { id: 'string-lights', name: '광장 전구 줄', level: 'molecule', area: '3d', group: '불빛', tags: ['string-lights', 'bulb'], where: 'src/world.js', desc: '가운데 기둥에서 방사형으로 늘어진 전구 줄 (전구는 인스턴스)' },
  { id: 'firefly', name: '반딧불이', level: 'molecule', area: '3d', group: '불빛', theme: 'clear', where: 'src/world.js', desc: 'GPU 애니메이션 반딧불이 (맑은 밤에만)' },
  { id: 'flower-pot', name: '꽃 화분', level: 'molecule', area: '3d', group: '소품', where: 'src/world.js 광장 꾸미기', desc: '방명록 · 게시판 옆 꽃 화분' },
  { id: 'fingerpost', name: '원목 이정표', level: 'molecule', area: '3d', group: '표지', where: 'src/signs.js fingerpost()', desc: '화살표 판에 새긴 글씨 (머니그라피)' },
  { id: 'hanging-sign', name: '매달린 간판', level: 'molecule', area: '3d', group: '표지', where: 'src/signs.js hangingSign()', desc: '광장 입구 검은 간판' },
  { id: 'guestbook', name: '방명록', level: 'molecule', area: '3d', group: '표지', where: 'src/guestbook.js', desc: '광장 방명록 받침대' },
  { id: 'notice-board', name: '소식 게시판', level: 'molecule', area: '3d', group: '표지', where: 'src/board.js', desc: '「📌 캠핑장 소식」 게시판' },
  { id: 'tv-monitor', name: '모닥불 TV', level: 'molecule', area: '3d', group: '소품', where: 'src/monitor.js', desc: '모닥불 옆 TV · LP 플레이어 (유튜브 화면 구멍)' },
  { id: 'fence', name: '울타리', level: 'molecule', area: '3d', group: '경계', where: 'src/world.js · src/trail.js', desc: '캠핑장 울타리 · 숲 경계 울타리' },
  { id: 'trail-gate', name: '숲길 출입구 아치', level: 'molecule', area: '3d', group: '경계', where: 'src/trail.js', desc: '나무 아치 + 랜턴' },
  { id: 'tree', name: '나무', level: 'molecule', area: '3d', group: '자연', where: 'src/world.js · src/trail.js', desc: '바늘잎 · 둥근 나무 (인스턴스, 눈 테마에 눈이 쌓임)' },
  { id: 'cherry-tree', name: '벚나무', level: 'molecule', area: '3d', group: '자연', tags: ['cherry-tree', 'cherry-petal'], where: 'src/trail.js', desc: '길 위로 휜 벚나무, 종이 등불, 흩날리는 꽃잎' },
  { id: 'bush', cluster: 0.3, name: '덤불', level: 'molecule', area: '3d', group: '자연', where: 'src/world.js', desc: '인스턴스 덤불 (눈 테마에 눈이 쌓임)' },
  { id: 'grass', cluster: 0.3, name: '풀', level: 'molecule', area: '3d', group: '자연', where: 'src/world.js', desc: '풀 포기 (인스턴스)' },
  { id: 'flower', cluster: 0.3, name: '작은 꽃', level: 'molecule', area: '3d', group: '자연', where: 'src/world.js', desc: '바닥 작은 꽃 (인스턴스)' },
  { id: 'rock', cluster: 0.3, name: '바위', level: 'molecule', area: '3d', group: '자연', where: 'src/world.js', desc: '바위 (인스턴스)' },
  { id: 'field-muhly', name: '핑크뮬리', level: 'molecule', area: '3d', group: '들판', where: 'src/trail.js', desc: '바람에 흔들리는 핑크뮬리 (셰이더)' },
  { id: 'field-reed', name: '갈대', level: 'molecule', area: '3d', group: '들판', where: 'src/trail.js', desc: '갈대 · 억새' },
  { id: 'field-daisy', name: '데이지', level: 'molecule', area: '3d', group: '들판', where: 'src/trail.js', desc: '데이지 꽃밭' },
  { id: 'field-kochia', name: '댑싸리', level: 'molecule', area: '3d', group: '들판', where: 'src/trail.js', desc: '둥근 댑싸리 · 울타리 말뚝' },
  { id: 'field-cherry', name: '벚꽃길 바닥', level: 'molecule', area: '3d', group: '들판', where: 'src/trail.js', desc: '벚꽃길 꽃잎 깔개 · 작은 꽃' },
  { id: 'puddle', name: '물웅덩이', level: 'molecule', area: '3d', group: '날씨', theme: 'rain', where: 'src/trail.js', desc: '비 오는 날 랜턴 옆 물웅덩이' },
  { id: 'hill-cat', name: '언덕 고양이', level: 'molecule', area: '3d', group: '동물', where: 'src/trail.js', desc: '노을 언덕 벤치 끝에 앉은 고양이' },
  { id: 'character', name: '캐릭터', level: 'molecule', area: '3d', group: '사람', where: 'src/character.js', desc: '이용자 · 주민 · NPC 가 같이 쓰는 몸 (옷 · 모자 · 테마 옷). 이용자는 들어와야 생겨서 실험실은 견본 3명을 놓아 보여 준다 (테마를 바꾸면 테마 옷)' },
  { id: 'ui-button', name: '나무 버튼', level: 'molecule', area: 'ui', group: 'UI', view: 'ui-button', where: 'src/style.css 공통 나무판', desc: '아이콘 버튼 · 큰 행동 버튼 · 글자 버튼' },
  { id: 'ui-label', name: '이름표 · 말풍선', level: 'molecule', area: 'ui', group: 'UI', view: 'ui-label', where: 'src/style.css', desc: '캐릭터 머리 위 이름표 · 채팅 말풍선 · 장소 표시' },

  // ───────────── 유기체 ─────────────
  { id: 'campfire', name: '모닥불 자리', level: 'organism', area: '3d', group: '불멍', tags: ['campfire', 'fire-ring', 'log-pile', 'fire-flame', 'camp-chair', 'stump-seat', 'tv-monitor'], parts: ['fire-ring', 'log-pile', 'fire-flame', 'camp-chair', 'tv-monitor'], where: 'src/fire.js · src/monitor.js', desc: '텐트 앞 화로 + 의자 4 + 장작 + 불 + TV' },
  { id: 'tent', name: '글램핑 텐트', level: 'organism', area: '3d', group: '텐트', where: 'src/world.js', desc: '텐트 12동 (창문 · 문 · 지붕 전구 · 문 옆 랜턴 · 쿨러)' },
  { id: 'tent-interior', name: '텐트 안', level: 'organism', area: '3d', group: '텐트', tags: ['tent-interior', 'tent-stove'], where: 'src/tent.js · src/fire.js #buildStove', desc: '둥근 소파 · 가운데 화로 · TV장 · 러그' },
  { id: 'lumi-shop', name: '루미의 가루 공방', level: 'organism', area: '3d', group: 'NPC 가게', tags: ['lumi-shop', 'npc-lumi'], parts: ['character'], where: 'src/world.js', desc: '동쪽 장작 마당 공방 + 루미' },
  { id: 'wood-shed', name: '장작 창고', level: 'organism', area: '3d', group: 'NPC 가게', tags: ['wood-shed', 'npc-bori'], parts: ['character', 'lamp'], where: 'src/world.js', desc: '장작이 가득한 오두막 + 보리' },
  { id: 'woodyard', name: '장작 패는 곳', level: 'organism', area: '3d', group: 'NPC 가게', tags: ['woodyard', 'split-log'], parts: ['split-log'], where: 'src/world.js · src/woodcut.js', desc: '그루터기 · 통나무 더미 · 꽂힌 도끼' },
  { id: 'fountain', name: '분수', level: 'organism', area: '3d', group: '숲길 쉼터', where: 'src/trail.js', desc: '돌 수반 · 물줄기 · 물 밑 조명 (눈 오면 얼음 기둥)' },
  { id: 'garden-pond', name: '밤 정원 연못', level: 'organism', area: '3d', group: '숲길 쉼터', where: 'src/trail.js', desc: '바위 · 석등 · 연잎 · 비단잉어' },
  { id: 'deck', name: '나무다리 · 데크', level: 'organism', area: '3d', group: '숲길 쉼터', tags: ['deck', 'bench'], parts: ['bench'], where: 'src/trail.js', desc: '개울 다리 · 호숫가 데크' },
  { id: 'hill', name: '노을 지는 언덕', level: 'organism', area: '3d', group: '숲길 쉼터', tags: ['hill', 'bench', 'hill-cat'], parts: ['bench', 'hill-cat'], where: 'src/trail.js', desc: '언덕 · 등받이 없는 벤치 · 고양이' },
  { id: 'windmill', cluster: 40, name: '풍차', level: 'organism', area: '3d', group: '숲길 쉼터', where: 'src/trail.js', desc: '북쪽 숲 너머 노을 앞 풍차' },
  { id: 'rain-tarp', name: '우중 천막', level: 'organism', area: '3d', group: '테마', theme: 'rain', where: 'src/world.js', desc: '비 오는 날 바깥 모닥불 위 천막 (우중캠핑장 테마)' },
  { id: 'xmas-tree', name: '크리스마스 트리', level: 'organism', area: '3d', group: '테마', theme: 'christmas', tags: ['xmas-tree', 'xmas-small-tree', 'xmas-tree-lights', 'xmas-tent-deco'], where: 'src/world.js', desc: '광장 큰 트리 · 작은 트리 · 나무 전구 · 텐트 리스 (크리스마스 테마)' },
  { id: 'npc-lumi', name: '루미', level: 'organism', area: '3d', group: '사람', parts: ['character'], where: 'src/main.js', desc: '가루 상인 NPC' },
  { id: 'npc-bori', name: '보리', level: 'organism', area: '3d', group: '사람', parts: ['character'], where: 'src/main.js', desc: '장작 창고지기 NPC' },
  ...RESIDENTS.map((r) => ({ id: `resident-${r.id}`, name: `${r.icon} ${r.name}`, level: 'organism', area: '3d', group: r.kind === 'weather' ? '주민 (비 · 눈)' : r.kind === 'night' ? '주민 (밤)' : '캠핑장 주민', parts: ['character'], where: 'src/residents.js', desc: `${r.title} — 캐릭터 + 소품 + 몸짓` })),
  { id: 'ui-hud', name: '상단 HUD', level: 'organism', area: 'ui', group: 'UI', view: 'ui-page', where: 'index.html · src/style.css', desc: '장작 · 코인 · 할 일 · 오른쪽 위 버튼' },

  // ───────────── 템플릿 (구역 배치) ─────────────
  { id: 'zone-plaza', name: '광장', level: 'template', area: '3d', group: '캠핑장', region: { x: 0, z: 2, r: 13 }, camera: { yaw: 0.6, pitch: 0.75, dist: 26 }, desc: '전구 줄 · 벤치 4 · 방명록 · 게시판 · 화분 · 간판' },
  { id: 'zone-woodyard', name: '장작 마당', level: 'template', area: '3d', group: '캠핑장', region: { x: (WOODYARD.x + NPC.x + KEEPER.x) / 3, z: (WOODYARD.z + NPC.z + KEEPER.z) / 3, r: 15 }, camera: { yaw: -1.2, pitch: 0.7, dist: 30 }, desc: '장작 패는 곳 · 장작 창고 · 루미 공방' },
  { id: 'zone-tents-south', name: '남쪽 텐트 줄', level: 'template', area: '3d', group: '캠핑장', region: { x: 0, z: 18.5, r: 48, band: 9 }, camera: { yaw: 0.25, pitch: 0.55, dist: 46 }, desc: '글램핑 텐트 6동 + 모닥불 자리 6' },
  { id: 'zone-lake', name: '호숫가 쉼터', level: 'template', area: '3d', group: '숲길', region: { x: lake.x, z: lake.z, r: 16 }, camera: { yaw: 2.4, pitch: 0.55, dist: 24 }, desc: '호수 · 분수 · 데크 · 벤치' },
  { id: 'zone-pond', name: '밤 정원 연못', level: 'template', area: '3d', group: '숲길', region: { x: pond.x, z: pond.z, r: 10 }, camera: { yaw: 0.8, pitch: 0.6, dist: 16 }, desc: '연못 · 석등 · 개울 다리' },
  { id: 'zone-hill', name: '노을 지는 언덕', level: 'template', area: '3d', group: '숲길', region: { x: HILL_BENCH.x, z: HILL_BENCH.z, r: 14 }, camera: { yaw: HILL_BENCH.ry + Math.PI + 0.4, pitch: 0.35, dist: 18 }, desc: '언덕 · 벤치 · 고양이 · 노을 하늘' },

  // ───────────── 페이지 (실제 장면) ─────────────
  { id: 'page-camp', name: '캠핑장 전체', level: 'page', area: '3d', group: '장면', camera: { x: 0, z: 0, yaw: 0.5, pitch: 0.9, dist: 95 }, desc: '하늘에서 본 캠핑장 전체' },
  { id: 'page-bulmeong', name: '불멍 화면', level: 'page', area: '3d', group: '장면', camera: { fp: 'ts3', lit: true }, desc: '텐트 앞 모닥불에 앉은 1인칭 (불 붙음)' },
  { id: 'page-sunset', name: '언덕에서 본 노을', level: 'page', area: '3d', group: '장면', camera: { fpAt: 'hill' }, desc: '노을 언덕 벤치에 앉은 1인칭' },
  { id: 'page-game', name: '게임 화면 (UI 포함)', level: 'page', area: 'ui', group: '장면', view: 'ui-game', desc: '실제 게임을 PC · 휴대폰 크기로 (입장 화면부터)' },
];

export const byId = new Map(CATALOG.map((e) => [e.id, e]));
/** 이 요소가 보여 줄 이름표 */
export const tagsOf = (e) => new Set(e.tags || [e.id]);
/** 이 요소를 쓰는 위 단계 요소 */
export const usedBy = (id) => CATALOG.filter((e) => e.parts?.includes(id) || (e.tags || []).includes(id) && e.id !== id);
