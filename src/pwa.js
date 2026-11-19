// PWA: 서비스워커 등록 + "앱으로 설치" 버튼
import { UI } from './ui.js';
import { icon } from './icons.js';

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
// 맥 Safari(17+)는 「파일 → Dock에 추가」로 앱처럼 설치할 수 있다
const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);
// 카톡 · 인스타 · 스레드 · 페북 · 라인 · 네이버 같은 앱 안 브라우저는 홈 화면 설치가 안 된다 → 바깥 브라우저로 열도록 안내
const inApp = /KAKAOTALK/i.test(ua) ? 'kakao'
  : /Instagram|Barcelona|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Whale\/.*inapp|; wv\)/i.test(ua) ? 'app' : '';
export const isStandalone = matchMedia('(display-mode: standalone)').matches
  || matchMedia('(display-mode: fullscreen)').matches
  || navigator.standalone === true;

let deferred = null;

export function initPWA() {
  if (isStandalone) document.body.classList.add('standalone');

  // 서비스워커는 보안 컨텍스트(HTTPS/localhost)의 빌드 버전에서만 등록된다
  if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const buttons = document.querySelectorAll('.install-btn');
  const show = (on) => buttons.forEach((b) => b.classList.toggle('hidden', !on));
  // 이미 앱으로 실행 중이면 숨김. 그 외에는 설치 안내를 항상 제공
  show(!isStandalone && (isIOS || isAndroid || isMacSafari || !!deferred));

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    show(true);
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    show(false);
    UI.toast('앱이 설치됐어요! 홈 화면에서 불멍 캠핑장을 열어 보세요 🔥');
  });

  // 버튼 글: 기기마다 실제로 하는 일에 맞춘다 (폰은 홈 화면, 맥 Safari는 Dock, PC는 앱 설치)
  const label = isIOS || isAndroid ? '홈 화면에 앱으로 설치하기' : isMacSafari ? 'Dock에 앱으로 추가하기' : '앱으로 설치하기';
  buttons.forEach((b) => {
    const t = b.classList.contains('link-btn') && [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (t) t.textContent = label + ' ';
    b.addEventListener('click', install);
  });
}

async function install() {
  if (deferred && !inApp) {
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    return;
  }
  const box = document.getElementById('installGuide');
  const body = box.querySelector('.ig-body');
  const chip = (name) => `<span class="ico-chip">${icon(name)}</span>`;
  const step = (n, html) => `<li><span class="ig-n">${n}</span><span>${html}</span></li>`;
  const perks = '<p class="ig-perks">주소창 없이 <b>전체 화면</b>으로, 홈 화면 아이콘 하나로 바로 캠핑장에 와요</p>';
  let html = '';
  if (inApp) {
    const name = inApp === 'kakao' ? '카카오톡' : '앱';
    html = `<p class="ig-lead">${name} 안에서 열린 화면이라 여기서는 설치할 수 없어요.<br>${isIOS ? 'Safari' : 'Chrome'}에서 열면 설치할 수 있어요.</p>
      <div class="ig-actions">
        <button class="btn" data-ig="open">${icon('compass')} ${isIOS ? 'Safari' : 'Chrome'}로 열기</button>
        <button class="btn ghost" data-ig="copy">${icon('copy')} 주소 복사</button>
      </div>
      <p class="ig-note">버튼이 안 되면 오른쪽 위(또는 아래) ${chip('dots')} 메뉴에서 <b>「다른 브라우저로 열기」</b>를 눌러요</p>`;
  } else if (isIOS) {
    html = `<ol class="ig-steps">
      ${step(1, `주소창 옆(또는 아래)의 <b>공유</b> ${chip('share')} 를 눌러요`)}
      ${step(2, `목록을 내려 <b>「홈 화면에 추가」</b> ${chip('plusbox')} 를 눌러요`)}
      ${step(3, '오른쪽 위 <b>「추가」</b>를 누르면 끝!')}
    </ol>${perks}`;
  } else if (isAndroid) {
    html = `<ol class="ig-steps">
      ${step(1, `Chrome 오른쪽 위 ${chip('dots')} <b>메뉴</b>를 눌러요`)}
      ${step(2, '<b>「홈 화면에 추가」</b> 또는 <b>「앱 설치」</b>를 눌러요')}
      ${step(3, '<b>「설치」</b>를 누르면 끝!')}
    </ol>${perks}
    ${window.isSecureContext ? '' : '<p class="ig-note">지금은 https 가 아닌 주소라서 바로가기로 추가돼요.</p>'}`;
  } else if (isMacSafari) {
    html = `<ol class="ig-steps">
      ${step(1, '위 메뉴 막대에서 <b>파일</b>을 눌러요')}
      ${step(2, `<b>「Dock에 추가」</b> ${chip('dock')} 를 누르면 끝!`)}
    </ol><p class="ig-perks">Dock 아이콘으로 열면 창 하나로 캠핑장만 띄워요</p>`;
  } else {
    html = `<ol class="ig-steps">
      ${step(1, `Chrome · Edge 주소창 오른쪽의 <b>설치</b> ${chip('install')} 를 눌러요`)}
      ${step(2, `없으면 ${chip('dots')} 메뉴 → <b>「앱 설치」</b>`)}
    </ol>
    ${window.isSecureContext ? '' : '<p class="ig-note">앱 설치는 https 주소나 localhost 에서만 지원돼요.</p>'}`;
  }
  body.innerHTML = html;
  body.querySelector('[data-ig="open"]')?.addEventListener('click', openExternal);
  body.querySelector('[data-ig="copy"]')?.addEventListener('click', copyUrl);
  box.classList.remove('hidden');
}

// 앱 안 브라우저 → 바깥 브라우저로 열기 (카톡은 전용 주소, 안드로이드는 Chrome 인텐트, 아이폰 다른 앱은 직접 안내)
function openExternal() {
  const url = location.href;
  if (inApp === 'kakao') { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return; }
  if (isAndroid) { location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=${location.protocol.replace(':', '')};package=com.android.chrome;end`; return; }
  copyUrl();
  UI.toast('주소를 복사했어요. Safari를 열고 주소창에 붙여 넣어 주세요', 4000);
}
async function copyUrl() {
  const url = location.origin + location.pathname;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {
    const t = Object.assign(document.createElement('textarea'), { value: url });
    document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch { /* 무시 */ }
    t.remove();
  }
  UI.toast(ok ? '주소를 복사했어요. 브라우저 주소창에 붙여 넣어 주세요' : url, 4000);
}

/**
 * 안드로이드 앱(홈 화면 설치)에서 가로로 들면 위 상태 표시줄과 아래 내비게이션 바(뒤로·홈)를 숨긴다.
 * - 전체 화면은 사용자가 화면을 눌러야만 켤 수 있어서, 가로 상태에서 첫 터치 때 켠다
 * - 키보드를 쓸 때(채팅·방명록·곡 검색)는 입력창이 가려지지 않게 잠깐 풀었다가, 다시 누르면 돌아온다
 * - 아이폰은 가로 모드에서 위 상태 표시줄이 저절로 숨고, 아래 홈 막대는 시스템이 숨길 수 없게 막아 둔다
 */
export function initFullscreen() {
  const el = document.documentElement;
  if (!isStandalone || !isAndroid || !el.requestFullscreen) return;
  const landscape = () => innerWidth > innerHeight;
  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  const enter = () => {
    if (document.fullscreenElement || !landscape() || typing()) return;
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  };
  const leave = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  addEventListener('pointerup', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
    enter();
  }, true);
  addEventListener('focusin', (e) => { if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) leave(); });
  addEventListener('resize', () => { if (!landscape()) leave(); });
}
