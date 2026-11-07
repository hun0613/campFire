// PWA: 서비스워커 등록 + "앱으로 설치" 버튼
import { UI } from './ui.js';

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
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
  show(!isStandalone && (isIOS || isAndroid || !!deferred));

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

  buttons.forEach((b) => b.addEventListener('click', install));
}

async function install() {
  if (deferred) {
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    return;
  }
  const box = document.getElementById('installGuide');
  const body = box.querySelector('.ig-body');
  if (isIOS) {
    body.innerHTML = `<ol>
      <li><b>Safari</b>에서 이 페이지를 열어요</li>
      <li>아래(또는 위)의 <b>공유 버튼</b> <span class="ig-ico">⬆️</span> 을 눌러요</li>
      <li><b>"홈 화면에 추가"</b>를 누르면 끝!</li></ol>
      <p>홈 화면 아이콘으로 열면 주소창 없이 전체화면으로 즐길 수 있어요.</p>`;
  } else if (isAndroid) {
    body.innerHTML = `<ol>
      <li><b>Chrome</b> 오른쪽 위 <b>⋮ 메뉴</b>를 눌러요</li>
      <li><b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b>를 눌러요</li></ol>
      ${window.isSecureContext ? '' : '<p class="ig-note">지금은 https 가 아닌 주소라서 바로가기로 추가돼요.</p>'}`;
  } else {
    body.innerHTML = `<ol>
      <li>Chrome / Edge 주소창 오른쪽의 <b>설치 아이콘</b> <span class="ig-ico">⊕</span> 을 눌러요</li>
      <li>또는 메뉴 → <b>"앱 설치"</b></li></ol>
      ${window.isSecureContext ? '' : '<p class="ig-note">앱 설치는 https 주소나 localhost 에서만 지원돼요.</p>'}`;
  }
  box.classList.remove('hidden');
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
