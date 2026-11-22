import { CFG, LEGEND_POWDERS } from '../shared/config.js';
import { pmClass, powderLabel } from './powderIcons.js';

const $ = (id) => document.getElementById(id);

/** 같은 가루끼리 한 칸으로 묶는다 (이름이 같으면 같은 종류). 가방에 들어온 순서대로. idxs = 가방 안 위치들 */
export function groupPowders(list) {
  const m = new Map();
  list.forEach((p, i) => {
    const k = (p.legend ? 'L:' : '') + p.name;
    let g = m.get(k);
    if (!g) m.set(k, (g = { key: k, p, idxs: [] }));
    g.idxs.push(i);
  });
  return [...m.values()];
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 가루 병 색: ✦ 특별한 가루는 저마다 정해진 무늬
function powderBg(p) {
  if (p.legend && LEGEND_POWDERS[p.effect]) return LEGEND_POWDERS[p.effect].bg;
  if (p.effect === 'rainbow') return 'conic-gradient(#ff5f6d, #ffc371, #5dff8f, #55c8ff, #b26bff, #ff5f6d)';
  const h = String(p.color).replace('#', ''), lum = (0.3 * parseInt(h.slice(0, 2), 16) + 0.59 * parseInt(h.slice(2, 4), 16) + 0.11 * parseInt(h.slice(4, 6), 16)) / 255;
  const edge = `color-mix(in srgb, ${p.color} ${lum > 0.8 ? 45 : 72}%, #4a2f6a)`; // 밝은 가루(새하얀)는 가장자리를 더 어둡게
  return `radial-gradient(circle at 35% 28%, #fff 0%, ${p.color} 42%, ${edge} 100%)`; // 가장자리를 살짝 어둡게: 새하얀 가루도 크림 칸 위에서 보이게
}

/** 가루 아이콘: 뒤에 옅게 흩뿌린 가루 알갱이 + 앞에 효과 문양 (tag/cls 는 바깥 칸) */
export function powderIco(p, cls = '', tag = 'span') {
  const bg = powderBg(p);
  return `<${tag} class="pico ${cls}"><span class="pile" style="background:${bg}"></span><span class="glyph ${pmClass(p.effect)}" style="background:${bg}"></span></${tag}>`;
}

const tipQueue = [];
function nextTip() {
  const t = tipQueue[0];
  if (!t) return;
  UI.toast(t[0], t[1]);
  setTimeout(() => { tipQueue.shift(); nextTip(); }, t[1] + 400);
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

  // 안내 팁(가로로 돌리기 · 밤하늘 보기 …)은 급하지 않으니 한 번에 하나씩: 앞 팁이 사라진 뒤에 다음 팁을 띄운다
  tip(text, ms = 5000) {
    tipQueue.push([text, ms]);
    if (tipQueue.length === 1) nextTip();
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
    const prevKeys = new Set([...box.children].map((c) => c.dataset.key));
    box.replaceChildren(...groupPowders(inv.powders).map((g, i) => {
      const p = g.p, n = g.idxs.length;
      const el = document.createElement('div');
      el.className = `powder${canThrow ? '' : ' disabled'}${prevKeys.has(g.key) ? '' : ' new'}${p.legend ? ' legend' : ''}`;
      el.dataset.key = g.key;
      const bg = powderBg(p);
      el.innerHTML = `${i < 9 ? `<span class="key">${i + 1}</span>` : ''}${powderIco(p, 'bag')}${n > 1 ? `<b class="inv-n">${n}</b>` : ''}<span class="tip">${esc(p.name)}${n > 1 ? ` × ${n}` : ''}</span>`;
      el.addEventListener('click', () => onThrow(g.idxs[0]));
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

  addChat(name, text, sys = false, { tag = null, tent = false } = {}) {
    const log = $('chatLog');
    const el = document.createElement('div');
    el.className = `msg${sys ? ' sys' : ''}${tent ? ' tent' : ''}`;
    if (tag) el.dataset.tag = tag;
    // 이름을 누르면 차단할 수 있다 (tag 가 있는 캠퍼 채팅만)
    const who = tag ? `<b class="who" data-tag="${esc(tag)}" data-name="${esc(name)}" title="눌러서 차단하기">${esc(name)}</b>` : `<b>${esc(name)}</b>`;
    el.innerHTML = sys ? esc(text) : `${tent ? '<i class="tent-mark" title="텐트 안 대화">🏕️</i>' : ''}${who}${esc(text)}`;
    log.appendChild(el);
    setTimeout(() => el.classList.add('faded'), 7000);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  },

  // ---------------- NPC 대화
  _dlg: null,
  dialogOpen() { return !!this._dlg; },
  /** 지금 대화창을 연 쪽 ('lumi' 또는 주민 id) — 멀어지면 그쪽 대화만 닫는다 */
  dialogOwner() { return this._dlg?.owner || null; },
  /** pages: 글(html) 또는 { html, choices: [버튼 글], pick(i) → 이어질 글 목록 }. opts.name: 말하는 사람 (기본 루미) */
  dialog(pages, onClose, opts = {}) {
    const box = $('dialog');
    box.classList.remove('hidden');
    box.querySelector('.dname').textContent = opts.name || '루미';
    const text = box.querySelector('.dtext');
    let ch = box.querySelector('.dchoices');
    if (!ch) { ch = document.createElement('div'); ch.className = 'dchoices'; text.after(ch); }
    pages = [...pages];
    let page = 0;
    let timer = null;
    const show = () => {
      const pg = pages[page];
      const html = typeof pg === 'string' ? pg : pg.html;
      clearInterval(timer);
      if (!this._dlg) return;
      ch.replaceChildren();
      box.classList.toggle('choosing', !!pg.choices);
      // 고르는 칸: 버튼을 누르면 그 대답이 다음 장으로 이어진다
      if (pg.choices) pg.choices.forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'dchoice'; b.textContent = label;
        b.onclick = (ev) => {
          ev.stopPropagation();
          const more = pg.pick(i) || [];
          pages.splice(page + 1, 0, ...more);
          box.classList.remove('choosing');
          if (!more.length) { pages[page] = ''; this._dlg.finish = () => false; next(); return; } // 이어질 글이 없으면 (서버 대답을 기다릴 때) 닫는다
          page++; show();
        };
        ch.appendChild(b);
      });
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
      if (pages[page]?.choices) return; // 고를 때까지 기다린다
      page++;
      if (page >= pages.length) {
        box.classList.add('hidden');
        box.classList.remove('choosing');
        box.onclick = null;
        ch.replaceChildren();
        this._dlg = null;
        onClose?.();
        return;
      }
      show();
    };
    this._dlg = { next, finish: () => false, owner: opts.owner || 'lumi' };
    box.onclick = next;
    show();
  },
  dialogNext() { this._dlg?.next(); },
  dialogClose() {
    if (!this._dlg) return;
    $('dialog').classList.add('hidden');
    $('dialog').classList.remove('choosing');
    $('dialog').onclick = null;
    this._dlg = null;
  },

  /** 인벤토리 칸: 같은 가루는 한 칸에, 오른쪽 아래에 개수 */
  powderGrid(list, cls = '') {
    return `<div class="inv-grid${cls ? ' ' + cls : ''}">${groupPowders(list).map((g) => {
      const p = g.p, n = g.idxs.length, L = powderLabel(p);
      return `<div class="inv-slot${p.legend ? ' legend' : ''}" title="${esc(p.name)}${n > 1 ? ` × ${n}` : ''}">${powderIco(p, 'inv-ico')}<span class="inv-name"><b>${esc(L.kind)}</b><small>${esc(L.sub)}</small></span>${n > 1 ? `<b class="inv-n">${n}</b>` : ''}</div>`;
    }).join('')}</div>`;
  },

  powderChip(p) {
    return `<span class="pw${p.legend ? ' legend' : ''}">${powderIco(p, '', 'i')}${esc(p.name)}</span>`;
  },
};
