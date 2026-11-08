// 캠핑장 관리실: 방명록 답글 · 삭제, UTM 링크와 채널별 안내 문구 만들기
const $ = (id) => document.getElementById(id);
const BASE = 'https://campfire-game.onrender.com/';
const TOKEN_KEY = 'campfire-admin-token';

// ---------------------------------------------------------------- 공통
function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function setToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* 저장 못 해도 이번 화면에서는 동작 */ } memToken = t; }
let memToken = getToken();

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`/api/admin/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(memToken ? { Authorization: `Bearer ${memToken}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { setToken(''); showLogin('로그인이 만료됐어요. 다시 들어와 주세요.'); throw new Error('unauthorized'); }
  if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
  return j;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- 로그인
function showLogin(msg = '') {
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('loginErr').textContent = msg;
  $('pw').focus();
}
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginBtn').disabled = true;
  $('loginErr').textContent = '';
  try {
    const { token } = await api('login', { method: 'POST', body: { password: $('pw').value } });
    setToken(token);
    $('pw').value = '';
    await start();
  } catch (err) {
    $('loginErr').textContent = err.message;
  } finally {
    $('loginBtn').disabled = false;
  }
});
$('logout').onclick = () => { setToken(''); showLogin(); };

let stats = null;
async function start() {
  stats = await api('stats');
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  renderStats();
  initGenerator();
  loadGuestbook();
}
function renderStats() {
  $('stats').innerHTML = [
    `v${esc(stats.version)}`,
    `지금 접속 ${stats.players}명`,
    stats.notion ? '노션 연결됨' : '⚠️ 노션 미연결 (메모리 저장)',
  ].map((s) => `<span class="stat">${s}</span>`).join('');
}

// ---------------------------------------------------------------- 탭
document.querySelectorAll('.tab').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    $('tab-gb').classList.toggle('hidden', b.dataset.tab !== 'gb');
    $('tab-gen').classList.toggle('hidden', b.dataset.tab !== 'gen');
  };
});

// ---------------------------------------------------------------- 방명록
const gb = { items: [], filter: 'all', q: '' };
const fmtDate = (t) => new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

async function loadGuestbook() {
  $('gbHint').textContent = '노션에서 불러오는 중…';
  try {
    const { items, notion } = await api('guestbook');
    gb.items = items;
    $('gbHint').textContent = notion
      ? '답글과 삭제는 노션과 게임에 바로 반영돼요. 지운 글은 노션 휴지통에서 30일 안에 되살릴 수 있어요.'
      : '노션이 연결되지 않아 서버 메모리의 방명록만 보여요. 서버를 다시 켜면 사라져요.';
    renderGuestbook();
  } catch (e) {
    if (e.message !== 'unauthorized') $('gbHint').textContent = `불러오지 못했어요: ${e.message}`;
  }
}

function renderGuestbook() {
  const todo = gb.items.filter((e) => !e.reply).length;
  $('cAll').textContent = gb.items.length;
  $('cTodo').textContent = todo;
  $('cDone').textContent = gb.items.length - todo;
  const q = gb.q.trim().toLowerCase();
  const list = gb.items.filter((e) =>
    (gb.filter === 'all' || (gb.filter === 'todo' ? !e.reply : !!e.reply))
    && (!q || e.name.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)));
  if (!list.length) {
    $('gbList').innerHTML = `<div class="empty">${gb.items.length ? '조건에 맞는 방명록이 없어요.' : '아직 방명록이 없어요. 🏕️'}</div>`;
    return;
  }
  $('gbList').innerHTML = list.map((e) => `
    <article class="gb ${e.reply ? '' : 'todo'}" data-id="${esc(e.id)}">
      <div class="gb-head">
        <span class="gb-name">${esc(e.name)}</span>
        <span class="gb-date">${esc(fmtDate(e.at))}</span>
        <span class="badge ${e.reply ? 'done' : 'todo'}">${e.reply ? '답글 완료' : '답글 대기'}</span>
      </div>
      <div class="gb-text">${esc(e.text)}</div>
      <div class="gb-reply">
        <textarea maxlength="1000" placeholder="🔥 캠핑장 주인장으로 답글 달기">${esc(e.reply || '')}</textarea>
        <div class="gb-actions">
          <button class="btn small" data-act="save">${e.reply ? '답글 고치기' : '답글 달기'}</button>
          ${e.reply ? '<button class="btn ghost small" data-act="clear">답글 지우기</button>' : ''}
          <span class="spacer"></span>
          <span class="gb-count">${(e.reply || '').length} / 1000</span>
          <button class="btn danger small" data-act="delete">방명록 삭제</button>
        </div>
      </div>
    </article>`).join('');
}

$('gbList').addEventListener('input', (ev) => {
  if (ev.target.tagName !== 'TEXTAREA') return;
  ev.target.closest('.gb').querySelector('.gb-count').textContent = `${ev.target.value.length} / 1000`;
});
$('gbList').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const card = btn.closest('.gb');
  const id = card.dataset.id;
  const entry = gb.items.find((e) => e.id === id);
  const act = btn.dataset.act;
  if (act === 'delete' && !confirm(`「${entry.name}」님의 방명록을 지울까요?\n\n${entry.text.slice(0, 80)}`)) return;
  if (act === 'clear' && !confirm('답글을 지울까요?')) return;
  card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    if (act === 'delete') {
      await api(`guestbook/${encodeURIComponent(id)}`, { method: 'DELETE' });
      gb.items = gb.items.filter((e) => e.id !== id);
      toast('방명록을 지웠어요');
    } else {
      const reply = act === 'clear' ? '' : card.querySelector('textarea').value.trim();
      if (act === 'save' && !reply) { toast('답글 내용을 적어 주세요'); card.querySelectorAll('button').forEach((b) => { b.disabled = false; }); return; }
      await api(`guestbook/${encodeURIComponent(id)}/reply`, { method: 'POST', body: { reply } });
      entry.reply = reply;
      toast(reply ? '답글을 달았어요 🔥' : '답글을 지웠어요');
    }
    renderGuestbook();
  } catch (e) {
    if (e.message !== 'unauthorized') toast(e.message);
    card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
  }
});
document.querySelectorAll('#gbFilter button').forEach((b) => {
  b.onclick = () => {
    gb.filter = b.dataset.f;
    document.querySelectorAll('#gbFilter button').forEach((x) => x.classList.toggle('on', x === b));
    renderGuestbook();
  };
});
$('gbSearch').addEventListener('input', (e) => { gb.q = e.target.value; renderGuestbook(); });
$('gbReload').onclick = loadGuestbook;

// ---------------------------------------------------------------- 안내 문구 만들기
// 노션 「UTM 링크 규칙 · 채널별 안내 문구」와 같은 규칙
const CHANNELS = [
  { key: 'kakao_notice', label: '카톡 공지', source: 'kakao', medium: 'message', campaign: 'version', content: '', tpl: 'kakaoNotice' },
  { key: 'kakao_share', label: '카톡 친구 초대', source: 'kakao', medium: 'share', campaign: 'always_on', content: '', tpl: 'kakaoShare' },
  { key: 'ig_bio', label: '인스타 프로필', source: 'instagram', medium: 'profile', campaign: 'always_on', content: 'bio', tpl: 'igBio' },
  { key: 'ig_story', label: '인스타 스토리', source: 'instagram', medium: 'social', campaign: 'version', content: 'story', tpl: 'igStory' },
  { key: 'ig_feed', label: '인스타 게시물', source: 'instagram', medium: 'profile', campaign: 'always_on', content: 'bio', tpl: 'igFeed' },
  { key: 'threads', label: '스레드', source: 'threads', medium: 'social', campaign: 'version', content: '', tpl: 'threads' },
  { key: 'blog', label: '블로그', source: 'blog', medium: 'post', campaign: 'always_on', content: '', tpl: 'post' },
  { key: 'community', label: '커뮤니티', source: 'community', medium: 'post', campaign: 'version', content: 'naver_cafe', tpl: 'post' },
  { key: 'qr', label: 'QR 코드', source: 'qr', medium: 'offline', campaign: 'version', content: 'place', tpl: 'qr' },
];

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

// 게임 소개에 공통으로 쓰는 문장
const PITCH = '밤의 글램핑장에서 장작 패고, 모닥불 피우고, 별 보면서 다 같이 불멍하는 3D 힐링 게임이에요.';
const FEATURE_LIST = [
  '🪓 장작을 패서 모닥불을 피우고',
  '✨ 루미에게 받은 마법 가루로 불 색을 바꾸고',
  '🎶 같은 모닥불에 앉은 사람과 노래를 듣고',
  '🌌 고개를 들면 은하수와 별똥별이 보여요',
  '📖 광장 방명록에 한마디 남기고 가요',
];
const HASHTAGS = '#불멍 #불멍캠핑장 #힐링게임 #캠핑 #모닥불 #웹게임 #ASMR';

// 문구 종류(첫 소개 / 업데이트 소식) × 채널
const TEMPLATES = {
  intro: {
    kakaoNotice: (f, link) => [
      '🔥 불멍 캠핑장에 놀러 오세요 🔥',
      '',
      PITCH,
      '설치 없이 링크만 누르면 바로 들어와요.',
      '',
      ...FEATURE_LIST,
      '',
      'PC · 모바일 모두 돼요. 오늘 밤 같이 불멍해요 🏕️',
      `👉 ${link}`,
    ].join('\n'),
    kakaoShare: (f, link) => [
      '요즘 자기 전에 하는 거 있는데 같이 해 볼래? 🔥',
      '밤 캠핑장에서 장작 패고 모닥불 피워서 불멍하는 게임이야.',
      '설치 없이 링크로 바로 들어가져!',
      '',
      `👉 ${link}`,
      '같은 모닥불에 앉으면 노래도 같이 들을 수 있어 🎶',
    ].join('\n'),
    igBio: () => [
      '🔥 밤의 글램핑장에서 함께 불멍하는 3D 힐링 게임',
      '🪵 장작 패기 · ✨ 마법 가루 · 🌌 별 보기',
      '👇 설치 없이 바로 입장',
    ].join('\n'),
    igStory: () => ['설치 없이 바로 하는 불멍 게임 🔥', '오늘 밤 같이 모닥불 앞에 앉아요'].join('\n'),
    igFeed: () => [
      '타닥타닥… 오늘 하루도 고생했어요 🔥',
      '',
      PITCH,
      '',
      ...FEATURE_LIST,
      '',
      '🔗 프로필 링크에서 설치 없이 바로 입장',
      '',
      HASHTAGS,
    ].join('\n'),
    threads: (f, link) => [
      '잠 안 오는 밤에 만든 게임이 있어요 🔥',
      '',
      PITCH,
      '설치 없이 링크로 바로 들어와요. 같은 모닥불에 앉으면 노래도 같이 들어요.',
      '',
      `👉 ${link}`,
    ].join('\n'),
    post: (f, link) => [
      '제목: 설치 없이 하는 불멍 게임, 「불멍 캠핑장」을 만들었어요 🔥',
      '',
      '밤의 글램핑장에서 다른 사람들과 함께 모닥불을 피우고 쉬어 가는 3D 웹 게임이에요.',
      '',
      '- 🪓 동쪽 장작 패는 곳에서 장작을 모아요',
      '- 🔥 화로에 장작을 쌓고 불을 붙여요',
      '- ✨ 루미에게 받은 마법 가루로 불 색을 바꿔요',
      '- 🎶 모닥불 TV로 같이 노래를 들어요',
      '- 🌌 고개를 들면 은하수와 별똥별이 보여요',
      '- 📖 광장 방명록에 한마디 남겨요',
      '',
      'PC · 모바일 모두 브라우저로 바로 들어갈 수 있어요.',
      `👉 ${link}`,
    ].join('\n'),
    qr: () => ['🔥 불멍 캠핑장', '휴대폰 카메라로 QR을 찍으면 바로 입장해요', '밤의 캠핑장에서 함께 불멍해요'].join('\n'),
  },
  update: {
    kakaoNotice: (f, link) => [
      `🔥 불멍 캠핑장 ${f.version} 업데이트 🔥`,
      '',
      f.headline,
      '',
      ...lines(f.features),
      '',
      '오늘 밤엔 모닥불 앞에서 쉬어 가요 🏕️',
      `👉 ${link}`,
    ].join('\n'),
    kakaoShare: (f, link) => [
      `내가 하는 불멍 게임에 새로운 게 생겼어 🔥 ${f.headline}`,
      '',
      ...lines(f.features),
      '',
      '설치 없이 링크로 바로 들어가져! 같이 불멍하자',
      `👉 ${link}`,
    ].join('\n'),
    igBio: () => TEMPLATES.intro.igBio(),
    igStory: (f) => [`${f.headline} 🔥`, `불멍 캠핑장 ${f.version}`, '오늘 밤 같이 불멍해요'].join('\n'),
    igFeed: (f) => [
      '타닥타닥… 오늘 하루도 고생했어요 🔥',
      '',
      `불멍 캠핑장 ${f.version} — ${f.headline}`,
      ...lines(f.features),
      '',
      '장작을 패고, 모닥불을 피우고, 별을 보며 쉬어 가요.',
      '🔗 프로필 링크에서 바로 입장',
      '',
      HASHTAGS,
    ].join('\n'),
    threads: (f, link) => [
      `불멍 캠핑장 ${f.version} 업데이트 🔥`,
      '',
      f.headline,
      ...lines(f.features),
      '',
      '밤의 글램핑장에서 다 같이 불멍하는 3D 게임이에요. 설치 없이 바로 들어와요.',
      `👉 ${link}`,
    ].join('\n'),
    post: (f, link) => [
      `제목: 불멍 캠핑장 ${f.version} 업데이트 — ${f.headline} 🔥`,
      '',
      '밤의 글램핑장에서 함께 모닥불을 피우고 쉬어 가는 3D 웹 게임 「불멍 캠핑장」이 업데이트됐어요.',
      '',
      ...lines(f.features).map((x) => `- ${x}`),
      '',
      'PC · 모바일 모두 브라우저로 바로 들어갈 수 있어요.',
      `👉 ${link}`,
    ].join('\n'),
    qr: () => TEMPLATES.intro.qr(),
  },
};

const MODE_HINT = {
  intro: '게임을 처음 알리는 문구예요. 버전과 상관없이 언제든 쓸 수 있어요. 고친 문구는 채널마다 기본으로 저장해 둘 수 있어요.',
  update: '새 버전을 알리는 문구예요. 릴리즈 노트 맨 위 버전의 새 기능으로 채워져요.',
};

const slug = (s) => String(s).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
let channel = CHANNELS[0];
let mode = 'intro';

// 첫 소개 문구는 운영자가 고쳐서 채널마다 저장해 둘 수 있다 (이 브라우저에만 저장)
const SAVE_PREFIX = 'campfire-admin-intro:';
const LINK_TOKEN = '{링크}';
function savedIntro(key) { try { return localStorage.getItem(SAVE_PREFIX + key); } catch { return null; } }
function storeIntro(key, text) { try { text == null ? localStorage.removeItem(SAVE_PREFIX + key) : localStorage.setItem(SAVE_PREFIX + key, text); return true; } catch { return false; } }

function initGenerator() {
  if ($('channels').childElementCount) return;
  $('channels').innerHTML = CHANNELS.map((c) => `<button type="button" class="chip" data-key="${c.key}">${c.label}</button>`).join('');
  $('channels').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) pickChannel(CHANNELS.find((c) => c.key === b.dataset.key));
  });
  document.querySelectorAll('#genMode button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  fillLatest();
  setMode('intro');
  ['fVersion', 'fHeadline', 'fFeatures', 'uCampaign', 'uContent'].forEach((id) => $(id).addEventListener('input', () => {
    if (id === 'fVersion' && mode === 'update' && channel.campaign === 'version') $('uCampaign').value = slug($('fVersion').value);
    render();
  }));
  ['uCampaign', 'uContent'].forEach((id) => $(id).addEventListener('blur', () => { $(id).value = slug($(id).value); render(); }));
  $('fillLatest').onclick = () => { fillLatest(); render(); toast('릴리즈 노트 맨 위 버전을 불러왔어요'); };
  $('saveIntro').onclick = () => {
    const text = $('outMsg').value.split(buildLink()).join(LINK_TOKEN);
    if (storeIntro(channel.key, text)) { toast(`「${channel.label}」 첫 소개 문구를 저장했어요`); render(); } else toast('이 브라우저에서는 저장할 수 없어요');
  };
  $('resetIntro').onclick = () => {
    if (!confirm(`「${channel.label}」 첫 소개 문구를 기본 문구로 되돌릴까요?`)) return;
    storeIntro(channel.key, null);
    render();
    toast('기본 문구로 되돌렸어요');
  };
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('#genMode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('modeHint').textContent = MODE_HINT[m];
  $('updateFields').classList.toggle('hidden', m !== 'update');
  pickChannel(channel);
}

function fillLatest() {
  const l = stats?.latest;
  $('fVersion').value = l?.version || `v${stats?.version || ''}`;
  const feats = l?.features || [];
  // 새 기능이 하나면 그 설명 첫 문장, 여러 개면 「첫 기능 외 N가지」
  const firstSentence = (t) => (t.match(/^.*?[.!?요](?=\s|$)/) || [t])[0];
  $('fHeadline').value = !feats.length ? ''
    : feats.length === 1 ? (feats[0].desc ? firstSentence(feats[0].desc) : stripEmoji(feats[0].title))
      : `${stripEmoji(feats[0].title)} 외 ${feats.length - 1}가지`;
  $('fFeatures').value = feats.map((x) => {
    const t = x.title;
    return /^\p{Extended_Pictographic}/u.test(t) ? t : `✨ ${t}`;
  }).join('\n');
}
const stripEmoji = (s) => s.replace(/^[\p{Extended_Pictographic}️\s]+/u, '').trim();

function defaultCampaign(c) {
  if (c.campaign !== 'version') return c.campaign;
  return mode === 'intro' ? 'intro' : slug($('fVersion').value);
}

function pickChannel(c) {
  channel = c;
  document.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.key === c.key));
  $('uSource').value = c.source;
  $('uMedium').value = c.medium;
  $('uCampaign').value = defaultCampaign(c);
  $('uContent').value = c.content;
  render();
}

function buildLink() {
  const p = new URLSearchParams({ utm_source: $('uSource').value, utm_medium: $('uMedium').value, utm_campaign: slug($('uCampaign').value) || 'always_on' });
  const content = slug($('uContent').value);
  if (content) p.set('utm_content', content);
  return `${BASE}?${p.toString()}`;
}

function render() {
  const link = buildLink();
  const f = { version: $('fVersion').value.trim() || '{버전}', headline: $('fHeadline').value.trim() || '{한 줄 요약}', features: $('fFeatures').value };
  $('outLink').textContent = link;
  const saved = mode === 'intro' ? savedIntro(channel.key) : null;
  $('outMsg').value = saved != null ? saved.split(LINK_TOKEN).join(link) : TEMPLATES[mode][channel.tpl](f, link);
  $('introSave').classList.toggle('hidden', mode !== 'intro');
  $('resetIntro').classList.toggle('hidden', saved == null);
  $('msgHint').textContent = mode === 'intro'
    ? (saved != null ? '💾 저장해 둔 문구를 쓰고 있어요. 링크는 현재 UTM 값으로 자동으로 바뀌어요.' : '미리보기를 고친 뒤 「기본으로 저장」하면 다음부터 이 문구로 시작해요. 저장은 이 브라우저에만 돼요.')
    : '미리보기를 직접 고쳐도 돼요. 복사하면 고친 내용이 그대로 복사돼요.';
  const notes = {
    ig_bio: '인스타 프로필의 「링크」 칸에 넣어요. 소개 문구는 아래를 프로필 소개에 붙여 넣어요.',
    ig_story: '스토리의 「링크 스티커」에 이 링크를 넣어요.',
    ig_feed: '게시물 캡션의 링크는 눌리지 않아요. 프로필 링크(이 링크)로 유도해요.',
    qr: 'QR 코드 생성기에 이 링크를 넣어요. utm_content에 장소 이름을 영어로 적어 주세요.',
  };
  $('outLinkNote').textContent = notes[channel.key] || '';
}

// 복사 버튼
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const el = $(b.dataset.copy);
  const text = el.value ?? el.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('복사했어요');
});

// ---------------------------------------------------------------- 시작
if (memToken) start().catch(() => showLogin()); else showLogin();
