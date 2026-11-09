import { CFG, LEGEND_POWDERS } from '../shared/config.js';

const $ = (id) => document.getElementById(id);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 가루 병 색: ✦ 특별한 가루는 저마다 정해진 무늬
function powderBg(p) {
  if (p.legend && LEGEND_POWDERS[p.effect]) return LEGEND_POWDERS[p.effect].bg;
  if (p.effect === 'rainbow') return 'conic-gradient(#ff5f6d, #ffc371, #5dff8f, #55c8ff, #b26bff, #ff5f6d)';
  return `radial-gradient(circle at 35% 30%, #fff 0%, ${p.color} 45%, ${p.color} 100%)`;
}

export const UI = {
  toast(text, ms = 3300) {
    // 같은 문구가 이미 떠 있으면 또 띄우지 않는다 (연타 · 꾹 누르기 · 서버 안내가 겹칠 때)
    if ([...$('toasts').children].some((t) => t.textContent === text)) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    if (ms !== 3300) el.style.animation = `toastIn .35s cubic-bezier(.2, 1.4, .4, 1), toastOut .4s ease ${ms - 500}ms forwards`;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  },

  setOnline(n) { $('online').textContent = n; $('online').title = `지금 ${n}명 캠핑 중`; },

  setInventory(inv, { onThrow, canThrow }) {
    $('woodCount').textContent = inv.wood;
    const dots = $('chopDots');
    dots.replaceChildren(...Array.from({ length: CFG.CHOPS_PER_WOOD }, (_, i) => {
      const d = document.createElement('i');
      if (i < inv.chops) d.className = 'on';
      return d;
    }));
    const box = $('powders');
    const prevIds = new Set([...box.children].map((c) => c.dataset.id));
    box.replaceChildren(...inv.powders.map((p, i) => {
      const el = document.createElement('div');
      el.className = `powder${canThrow ? '' : ' disabled'}${prevIds.has(p.id) ? '' : ' new'}${p.legend ? ' legend' : ''}`;
      el.dataset.id = p.id;
      const bg = powderBg(p);
      el.innerHTML = `<span class="key">${i + 1}</span><span class="bag" style="background:${bg};box-shadow:0 0 12px ${p.color}"></span><span class="tip">${esc(p.name)}</span>`;
      el.addEventListener('click', () => onThrow(i));
      return el;
    }));
  },

  setPowderEnabled(on) {
    for (const el of $('powders').children) el.classList.toggle('disabled', !on);
  },

  setQuest(html) {
    const q = $('quest');
    if (q._html !== html) { q.innerHTML = html; q._html = html; }
  },

  setPrompt(html, dim = false) {
    const p = $('prompt');
    if (!html) { p.classList.add('hidden'); p._html = ''; return; }
    p.classList.remove('hidden');
    p.classList.toggle('dim', dim);
    if (p._html !== html) { p.innerHTML = html; p._html = html; }
  },

  setFireTimer(text) {
    const el = $('fireTimer');
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.textContent = text;
  },

  addChat(name, text, sys = false) {
    const log = $('chatLog');
    const el = document.createElement('div');
    el.className = `msg${sys ? ' sys' : ''}`;
    el.innerHTML = sys ? esc(text) : `<b>${esc(name)}</b>${esc(text)}`;
    log.appendChild(el);
    setTimeout(() => el.classList.add('faded'), 7000);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  },

  // ---------------- NPC 대화
  _dlg: null,
  dialogOpen() { return !!this._dlg; },
  dialog(pages, onClose) {
    const box = $('dialog');
    box.classList.remove('hidden');
    const text = box.querySelector('.dtext');
    let page = 0;
    let timer = null;
    const show = () => {
      const html = pages[page];
      clearInterval(timer);
      // 타자기 효과 (태그는 한 번에)
      const tokens = html.match(/<[^>]+>[^<]*<\/[^>]+>|<[^>]+>|[^<]/g) || [];
      let i = 0;
      text.innerHTML = '';
      timer = setInterval(() => {
        i++;
        text.innerHTML = tokens.slice(0, i).join('');
        if (i >= tokens.length) { clearInterval(timer); timer = null; }
      }, 28);
      this._dlg.finish = () => {
        if (timer) { clearInterval(timer); timer = null; text.innerHTML = html; return true; }
        return false;
      };
    };
    const next = () => {
      if (this._dlg.finish()) return;
      page++;
      if (page >= pages.length) {
        box.classList.add('hidden');
        box.onclick = null;
        this._dlg = null;
        onClose?.();
        return;
      }
      show();
    };
    this._dlg = { next, finish: () => false };
    box.onclick = next;
    show();
  },
  dialogNext() { this._dlg?.next(); },
  dialogClose() {
    if (!this._dlg) return;
    $('dialog').classList.add('hidden');
    $('dialog').onclick = null;
    this._dlg = null;
  },

  powderChip(p) {
    return `<span class="pw${p.legend ? ' legend' : ''}"><i style="background:${powderBg(p)}"></i>${esc(p.name)}</span>`;
  },
};
