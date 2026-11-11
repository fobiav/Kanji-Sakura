/* Кандзи · сакура — основное приложение: справочник, карточка, добавление, правка, категории, настройки */
const App = (function () {
  'use strict';
  const { esc, furigana, wordRuby } = Core;
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const VERSION = '1.0';

  const S = {
    cards: new Map(),
    cats: [],
    settings: { furigana: true, strict: 'medium', view: 'brush', font: 'mincho', session: 20, onlyDue: true, lastBackup: 0 },
    tab: 'ref',
    filter: { q: '', level: '', cat: '', study: false },
    sel: null,
    limit: 300,
    nextOrder: 1
  };
  const $ = s => document.querySelector(s);

  /* ---------- DOM-помощник ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in (props || {})) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const ICON = {
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/><path d="M8 13l2 2 4-4"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l6 6-6 6"/></svg>',
    first: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6l-6 6 6 6M7 6v12"/></svg>',
    last: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6l6 6-6 6M17 6v12"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const icon = (n) => { const s = h('span', { html: ICON[n], style: 'display:contents' }); return s; };
  const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#f2b8c6"><ellipse cx="20" cy="10" rx="6.2" ry="9.4"/><ellipse cx="20" cy="10" rx="6.2" ry="9.4" transform="rotate(72 20 20)"/><ellipse cx="20" cy="10" rx="6.2" ry="9.4" transform="rotate(144 20 20)"/><ellipse cx="20" cy="10" rx="6.2" ry="9.4" transform="rotate(216 20 20)"/><ellipse cx="20" cy="10" rx="6.2" ry="9.4" transform="rotate(288 20 20)"/></g><circle cx="20" cy="20" r="4.4" fill="#c9647f"/><g fill="#8fbf9f"><circle cx="20" cy="13.6" r="1.1"/><circle cx="26.1" cy="18" r="1.1"/><circle cx="23.8" cy="25.2" r="1.1"/><circle cx="16.2" cy="25.2" r="1.1"/><circle cx="13.9" cy="18" r="1.1"/></g></svg>';

  /* ---------- Тост, шторки, экраны ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function sheet(title, content, actions) {
    actions = actions || [];
    const close = () => wrap.remove();
    const wrap = h('div', { class: 'sheet-wrap' },
      h('div', { class: 'sheet-bg', onclick: close }),
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        title ? h('h3', {}, title) : null,
        content,
        actions.length ? h('div', { class: 'sheet-actions' }, actions.map(a =>
          h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { if (a.keepOpen) { a.onClick(close); return; } close(); if (a.onClick) a.onClick(); } }, a.label))) : null));
    document.body.append(wrap);
    return { close, el: wrap };
  }

  function confirmSheet(msg, okLabel, danger) {
    return new Promise(res => {
      const s = sheet(null, h('p', { style: 'margin:4px 0' }, msg), [
        { label: 'Отмена', kind: 'ghost', onClick: () => res(false) },
        { label: okLabel || 'Да', kind: 'primary', onClick: () => res(true) }
      ]);
      s.el.querySelector('.sheet-bg').addEventListener('click', () => res(false));
    });
  }

  function pickSheet(title, options) { // options: [{label, onClick}]
    const s = sheet(title, h('div', { class: 'opt-list' }, options.map(o =>
      h('button', { class: 'btn ' + (o.kind || ''), onclick: () => { s.close(); o.onClick(); } }, o.label))), [{ label: 'Закрыть', kind: 'ghost' }]);
    return s;
  }

  const stack = [];
  function openScreen(build) {
    const wrap = h('div', { class: 'wrap' });
    const el = h('div', { class: 'screen' }, wrap);
    const entry = { el, wrap, onClose: null };
    stack.push(entry);
    $('#overlay-root').append(el);
    history.pushState({ s: stack.length }, '');
    el.scrollTop = 0;
    build(wrap, entry);
    return entry;
  }
  function closeScreen() { if (stack.length) history.back(); }
  window.addEventListener('popstate', () => {
    document.querySelectorAll('.sheet-wrap').forEach(e => e.remove());
    if (stack.length) {
      const e = stack.pop();
      e.el.remove();
      if (e.onClose) e.onClose();
    }
  });

  function bar(title, left, right) {
    return h('div', { class: 'bar' },
      left || h('button', { class: 'icon-btn', 'aria-label': 'Назад', onclick: closeScreen, html: ICON.back }),
      h('h2', {}, title), right || null);
  }

  /* ---------- Данные ---------- */
  const saveCard = c => { S.cards.set(c.ch, c); return DB.putCard(c).catch(e => toast('Не удалось сохранить: ' + (e && e.message || e))); };
  const saveCats = () => DB.kvSet('cats', S.cats);
  const saveSettings = () => DB.kvSet('settings', S.settings);
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const catName = id => { const c = S.cats.find(x => x.id === id); return c ? c.name : null; };
  const catCount = id => { let n = 0; S.cards.forEach(c => { if (c.cats.includes(id)) n++; }); return n; };
  const meaning = c => c.ru ? c.ru : (c.en || []).slice(0, 3).join(', ');
  const levelRank = l => { const i = LEVELS.indexOf(l); return i < 0 ? 9 : i; };

  const SAFE_D = /^[MmLlHhVvCcSsQqTtZz0-9eE.,\s+-]+$/;
  function cleanStrokes(arr) {
    if (!Array.isArray(arr)) return null;
    const out = arr.filter(s => s && typeof s.d === 'string' && SAFE_D.test(s.d)).map(s => ({ d: s.d.trim(), t: String(s.t || '').slice(0, 8) }));
    return out.length ? out : null;
  }
  const strList = a => Array.isArray(a) ? a.map(x => String(x).trim()).filter(Boolean) : [];

  function normalizeCard(c) {
    const out = {
      ch: String(c.ch || '').trim(),
      level: LEVELS.includes(c.level) ? c.level : '',
      cats: strList(c.cats),
      study: !!c.study,
      strokes: cleanStrokes(c.strokes),
      ru: String(c.ru || ''),
      en: strList(c.en),
      on: strList(c.on),
      kun: strList(c.kun),
      words: (Array.isArray(c.words) ? c.words : []).map(w => ({ w: String(w.w || ''), r: String(w.r || ''), ru: String(w.ru || ''), en: String(w.en || '') })).filter(w => w.w),
      sentences: (Array.isArray(c.sentences) ? c.sentences : []).map(s => ({ ja: String(s.ja || ''), ru: String(s.ru || '') })).filter(s => s.ja),
      notes: String(c.notes || ''),
      grade: c.grade || null,
      infoMissing: !!c.infoMissing,
      order: Number.isFinite(c.order) ? c.order : 0,
      added: c.added || Date.now(),
      srs: (c.srs && typeof c.srs === 'object') ? c.srs : {}
    };
    return out.ch ? out : null;
  }

  function newCard(ch, extra) {
    return normalizeCard(Object.assign({ ch, order: S.nextOrder++, added: Date.now() }, extra || {}));
  }

  /* ---------- Загрузка начертаний и сведений ---------- */
  async function fetchT(url, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 15000);
    try { return await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }
  }
  async function loadStrokes(ch) {
    const hex = ch.codePointAt(0).toString(16).padStart(5, '0');
    const urls = [
      `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`,
      `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`
    ];
    let notFound = 0, netErr = null;
    for (const u of urls) {
      try {
        const r = await fetchT(u);
        if (r.ok) {
          const strokes = Core.parseKanjiVG(await r.text());
          if (strokes.length) return { strokes };
          notFound++;
        } else if (r.status === 404) notFound++;
        else netErr = new Error('HTTP ' + r.status);
      } catch (e) { netErr = e; }
    }
    if (notFound > 0 && !netErr) return { strokes: null, missing: true };
    throw netErr || new Error('нет данных');
  }
  async function loadInfo(ch) {
    try {
      const enc = encodeURIComponent(ch);
      const [kr, wr] = await Promise.all([
        fetchT('https://kanjiapi.dev/v1/kanji/' + enc).catch(() => null),
        fetchT('https://kanjiapi.dev/v1/words/' + enc).catch(() => null)
      ]);
      if (!kr || !kr.ok) return null;
      const k = await kr.json();
      let words = [];
      if (wr && wr.ok) {
        const list = await wr.json();
        const scored = [];
        for (const e of list) {
          const v = (e.variants || []).find(x => (x.written || '').includes(ch));
          if (!v || !v.pronounced) continue;
          const gl = ((e.meanings || [])[0] || {}).glosses || [];
          scored.push({ w: v.written, r: v.pronounced, en: gl.slice(0, 3).join('; '), p: (v.priorities || []).length });
        }
        scored.sort((a, b) => (b.p - a.p) || (a.w.length - b.w.length));
        words = scored.slice(0, 6).map(x => ({ w: x.w, r: x.r, ru: '', en: x.en }));
      }
      return { on: k.on_readings || [], kun: k.kun_readings || [], en: k.meanings || [], grade: k.grade || null, words };
    } catch (e) { return null; }
  }
  async function pool(items, limit, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const k = i++; await fn(items[k], k); }
    }));
  }

  /* ---------- Начертание: SVG ---------- */
  function strokeSvg(strokes, upTo, o) {
    o = o || {};
    const cur = o.cur == null ? -1 : o.cur;
    let s = '<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    if (!o.mini) s += '<path class="grid-line" d="M54.5 2v105M2 54.5h105"/>';
    if (o.ghost) strokes.forEach(st => { s += `<path class="s-ghost" d="${esc(st.d)}"/>`; });
    for (let i = 0; i < upTo; i++) {
      const isCur = i === cur;
      s += `<path class="${isCur ? 's-cur' + (o.anim ? ' anim' : '') : (o.ink ? 's-ink' : 's-done')}"${isCur && o.anim ? ' pathLength="1"' : ''} d="${esc(strokes[i].d)}"/>`;
    }
    if (o.numbers) {
      for (let i = 0; i < upTo; i++) {
        const p = Core.strokeStart(strokes[i].d);
        s += `<text class="s-num" x="${(p.x - 5.6).toFixed(1)}" y="${(p.y - 1.2).toFixed(1)}">${i + 1}</text>`;
      }
    }
    return s + '</svg>';
  }

  /* ---------- Чтения ---------- */
  function splitNote(r) {
    const m = /^([^（(]*)(?:[（(]([^）)]*)[）)])?\s*$/.exec(r);
    return m ? { main: m[1].trim(), note: (m[2] || '').trim() } : { main: r, note: '' };
  }
  function readingChip(r, kind) {
    const { main, note } = splitNote(r);
    let inner;
    if (kind === 'kun' && main.includes('.')) {
      const i = main.indexOf('.');
      inner = `${esc(main.slice(0, i))}<span class="ok">${esc(main.slice(i + 1).replace(/\./g, ''))}</span>`;
    } else inner = esc(main);
    return h('span', { class: 'rchip', lang: 'ja', html: inner + (note ? `<span class="note">${esc(note)}</span>` : '') });
  }

  /* ---------- Навигация и вкладки ---------- */
  const TABS = [['ref', 'Справочник', 'book'], ['study', 'Учить', 'cards'], ['cats', 'Категории', 'tag'], ['settings', 'Настройки', 'gear']];
  function buildNav() {
    const nav = $('#nav');
    nav.replaceChildren(...TABS.map(([id, label, ic]) =>
      h('button', { class: S.tab === id ? 'on' : '', 'data-tab': id, onclick: () => showTab(id), html: ICON[ic] + '<span>' + label + '</span>' })));
  }
  function showTab(id) {
    if (S.tab !== id) S.sel = null;
    S.tab = id;
    buildNav();
    updateSelBar();
    const main = $('#main');
    main.replaceChildren();
    window.scrollTo(0, 0);
    ({ ref: buildRef, study: () => App.buildStudy(main), cats: buildCats, settings: buildSettings })[id](main);
  }
  function refresh() { showTab(S.tab); }

  /* ---------- Справочник ---------- */
  function matchQuery(c, q) {
    q = q.trim();
    if (!q) return true;
    const ql = q.toLowerCase();
    const kj = Core.kanjiList(q);
    if (kj.length && kj.includes(c.ch)) return true;
    const hay = [c.ru, (c.en || []).join(' '), c.notes, c.level, (c.words || []).map(w => [w.w, w.r, w.ru, w.en].join(' ')).join(' '),
      (c.sentences || []).map(s => s.ru).join(' ')].join(' ').toLowerCase();
    if (hay.includes(ql)) return true;
    const kana = Core.normReading(Core.romajiToHira(ql, true));
    if (kana && /[぀-ヿ]/.test(kana)) {
      const reads = [].concat(c.on || [], c.kun || []).map(Core.normReading);
      if (reads.some(r => r && (r === kana || r.startsWith(kana)))) return true;
      if ((c.words || []).some(w => Core.normReading(w.r || '').includes(kana))) return true;
    }
    if (kj.length && (c.words || []).some(w => kj.every(k => (w.w || '').includes(k)))) return true;
    return false;
  }
  function filteredCards() {
    const f = S.filter;
    const arr = [];
    S.cards.forEach(c => {
      if (f.level === 'none' ? c.level : (f.level && c.level !== f.level)) return;
      if (f.cat && !c.cats.includes(f.cat)) return;
      if (f.study && !c.study) return;
      if (!matchQuery(c, f.q)) return;
      arr.push(c);
    });
    arr.sort((a, b) => (levelRank(a.level) - levelRank(b.level)) || (a.order - b.order));
    return arr;
  }

  let refBits = null;
  function buildRef(main) {
    const search = h('input', {
      type: 'search', class: 'search', placeholder: 'Поиск: кандзи, значение, чтение…', value: S.filter.q,
      'aria-label': 'Поиск', autocomplete: 'off',
      oninput: e => { S.filter.q = e.target.value; S.limit = 300; renderGrid(); }
    });
    const chips = h('div', { class: 'chips' });
    const catChips = h('div', { class: 'chips' });
    const info = h('div', { class: 'listinfo' });
    const grid = h('div', { class: 'grid' });
    const more = h('div', { style: 'text-align:center;margin:16px 0' });
    refBits = { chips, catChips, info, grid, more };
    main.append(
      h('header', { class: 'top' },
        h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Кандзи'), h('small', {}, 'справочник и тренировка'))),
        h('div', { class: 'top-actions' },
          h('button', { class: 'icon-btn green', 'aria-label': 'Выбрать несколько', onclick: toggleSelect, html: ICON.select }),
          h('button', { class: 'icon-btn', style: 'background:var(--pink-d);color:#fff', 'aria-label': 'Добавить кандзи', onclick: openAdd, html: ICON.plus }))),
      search, chips, catChips, info, grid, more);
    renderChips(); renderGrid();
  }

  function renderChips() {
    const { chips, catChips } = refBits;
    const f = S.filter;
    const counts = {}; let none = 0;
    S.cards.forEach(c => { if (c.level) counts[c.level] = (counts[c.level] || 0) + 1; else none++; });
    const mk = (label, active, n, fn, cls) => h('button', { class: 'chip ' + (cls || '') + (active ? ' on' : ''), onclick: fn }, label, n != null ? h('span', { class: 'n' }, n) : null);
    const setLevel = v => { f.level = v; S.limit = 300; renderChips(); renderGrid(); };
    chips.replaceChildren(
      mk('Все', !f.level, S.cards.size, () => setLevel('')),
      ...LEVELS.map(l => mk(l, f.level === l, counts[l] || 0, () => setLevel(f.level === l ? '' : l))),
      none ? mk('Без уровня', f.level === 'none', none, () => setLevel(f.level === 'none' ? '' : 'none')) : null,
      mk('В заучивании', f.study, null, () => { f.study = !f.study; renderChips(); renderGrid(); }, 'g'));
    catChips.replaceChildren(...S.cats.map(c => mk(c.name, f.cat === c.id, catCount(c.id), () => { f.cat = f.cat === c.id ? '' : c.id; S.limit = 300; renderChips(); renderGrid(); }, 'g')));
    catChips.style.display = S.cats.length ? '' : 'none';
  }

  function renderGrid() {
    if (!refBits || S.tab !== 'ref') return;
    const { grid, info, more } = refBits;
    const list = filteredCards();
    const shown = list.slice(0, S.limit);
    info.textContent = S.cards.size ? `Показано: ${list.length} из ${S.cards.size}` : '';
    grid.replaceChildren(...shown.map(tile));
    more.replaceChildren();
    if (list.length > shown.length) more.append(h('button', { class: 'btn', onclick: () => { S.limit += 300; renderGrid(); } }, `Показать ещё (${list.length - shown.length})`));
    if (!list.length) {
      grid.replaceChildren();
      grid.style.display = 'block';
      grid.append(S.cards.size ? h('div', { class: 'empty' }, h('div', { class: 'big jp', lang: 'ja' }, '探'), h('h3', {}, 'Ничего не найдено'), h('p', {}, 'Попробуйте другой запрос или сбросьте фильтры.'),
        h('button', { class: 'btn', onclick: () => { S.filter = { q: '', level: '', cat: '', study: false }; showTab('ref'); } }, 'Сбросить фильтры'))
        : h('div', { class: 'empty' }, h('div', { class: 'big jp', lang: 'ja' }, '桜'), h('h3', {}, 'Пока пусто'),
          h('p', {}, 'Добавьте первые кандзи: можно один или сразу списком.'),
          h('button', { class: 'btn primary', onclick: openAdd }, 'Добавить кандзи')));
    } else grid.style.display = '';
  }

  function tile(c) {
    const selected = S.sel && S.sel.has(c.ch);
    const t = h('button', { class: 'tile' + (selected ? ' sel' : ''), 'aria-label': 'Кандзи ' + c.ch, onclick: () => {
      if (S.sel) {
        S.sel.has(c.ch) ? S.sel.delete(c.ch) : S.sel.add(c.ch);
        t.classList.toggle('sel', S.sel.has(c.ch));
        t.querySelector('.check').innerHTML = S.sel.has(c.ch) ? ICON.check : '';
        updateSelBar();
      } else openDetail(c.ch);
    } },
      c.level ? h('span', { class: 'lv' }, c.level) : null,
      S.sel ? h('span', { class: 'check', html: selected ? ICON.check : '' }) : (c.study ? h('span', { class: 'dot', title: 'В заучивании' }) : null),
      h('div', { class: 'ch', lang: 'ja' }, c.ch),
      h('div', { class: 'mn' }, meaning(c) || '—'),
      !c.strokes ? h('span', { class: 'warn', title: 'Нет начертания' }, '⚠') : null);
    if (S.sel) t.querySelector('.check').innerHTML = selected ? ICON.check : '';
    return t;
  }

  /* ---------- Режим выбора и массовые действия ---------- */
  function toggleSelect() {
    S.sel = S.sel ? null : new Set();
    updateSelBar(); renderGrid();
  }
  function updateSelBar() {
    const bar = $('#selbar');
    if (!S.sel || S.tab !== 'ref') { bar.hidden = true; bar.replaceChildren(); return; }
    bar.hidden = false;
    const n = S.sel.size;
    bar.replaceChildren(
      h('span', { class: 'cnt' }, n ? `Выбрано: ${n}` : 'Отметьте кандзи'),
      h('button', { class: 'btn small', onclick: () => { filteredCards().forEach(c => S.sel.add(c.ch)); renderGrid(); updateSelBar(); } }, 'Все'),
      h('button', { class: 'btn small primary', disabled: n ? null : true, onclick: bulkMenu }, 'Действия'),
      h('button', { class: 'icon-btn', style: 'width:36px;height:36px', 'aria-label': 'Отмена', onclick: toggleSelect, html: ICON.close }));
    if (!n) bar.querySelector('.btn.primary').setAttribute('disabled', '');
  }
  function bulkApply(fn, msg) {
    const list = Array.from(S.sel).map(ch => S.cards.get(ch)).filter(Boolean);
    list.forEach(fn);
    DB.putCards(list).then(() => toast(msg + ': ' + list.length)).catch(e => toast('Ошибка сохранения'));
    renderChips(); renderGrid(); updateSelBar();
  }
  function bulkMenu() {
    const catOpts = (add) => S.cats.map(c => ({ label: c.name, onClick: () => bulkApply(card => {
      if (add && !card.cats.includes(c.id)) card.cats.push(c.id);
      if (!add) card.cats = card.cats.filter(x => x !== c.id);
    }, add ? 'Добавлено в «' + c.name + '»' : 'Убрано из «' + c.name + '»') }));
    pickSheet('Что сделать с выбранными?', [
      { label: '＋ В заучивание (сделать флэш-картами)', kind: 'green', onClick: () => bulkApply(c => { c.study = true; }, 'В заучивании') },
      { label: 'Убрать из заучивания', onClick: () => bulkApply(c => { c.study = false; }, 'Убрано из заучивания') },
      { label: 'Назначить уровень…', onClick: () => pickSheet('Уровень', [...LEVELS.map(l => ({ label: l, onClick: () => bulkApply(c => { c.level = l; }, 'Уровень ' + l) })), { label: 'Без уровня', onClick: () => bulkApply(c => { c.level = ''; }, 'Уровень снят') }]) },
      { label: 'Добавить в категорию…', onClick: () => S.cats.length ? pickSheet('Добавить в категорию', catOpts(true)) : toast('Сначала создайте категорию во вкладке «Категории»') },
      { label: 'Убрать из категории…', onClick: () => S.cats.length ? pickSheet('Убрать из категории', catOpts(false)) : toast('Категорий пока нет') },
      { label: 'Удалить выбранные', kind: 'danger', onClick: async () => {
        if (!(await confirmSheet(`Удалить выбранные кандзи (${S.sel.size}) вместе с вашими правками?`, 'Удалить', true))) return;
        const arr = Array.from(S.sel);
        for (const ch of arr) { S.cards.delete(ch); await DB.deleteCard(ch); }
        S.sel = new Set(); toast('Удалено: ' + arr.length); renderChips(); renderGrid(); updateSelBar();
      } }
    ]);
  }

  /* ---------- Карточка кандзи ---------- */
  function openDetail(ch) {
    const entry = openScreen((outer, entry) => {
      const wrap = h('div');
      let c = S.cards.get(ch);
      let view = S.settings.view;           // 'brush' | 'print'
      let step = c.strokes ? c.strokes.length : 0;
      let hl = false, anim = false, timer = null;
      const stopPlay = () => { if (timer) { clearTimeout(timer); timer = null; } };
      entry.onClose = stopPlay;

      function render() {
        c = S.cards.get(ch);
        if (!c) { closeScreen(); return; }
        const N = c.strokes ? c.strokes.length : 0;
        step = Math.min(Math.max(step, N ? 1 : 0), N);
        wrap.replaceChildren();

        const stage = h('div', { class: 'stage' });
        if (view === 'brush' && N) stage.innerHTML = strokeSvg(c.strokes, step, { ghost: true, cur: hl ? step - 1 : -1, anim, numbers: true });
        else stage.append(h('div', { class: 'glyph', lang: 'ja', style: 'font-family:var(--' + S.settings.font + ')' }, c.ch));
        anim = false;

        const viewer = h('div', { class: 'card viewer' },
          h('div', { class: 'seg', role: 'tablist' },
            h('button', { class: view === 'brush' ? 'on' : '', onclick: () => { view = 'brush'; render(); } }, 'Кисть · порядок черт'),
            h('button', { class: view === 'print' ? 'on' : '', onclick: () => { view = 'print'; stopPlay(); render(); } }, 'Печатный')),
          stage);

        if (view === 'brush' && N) {
          const lbl = h('div', { class: 'lbl' }, hl ? `Черта ${step} из ${N}` : `Все черты: ${N}`);
          const b = (ic, label, fn, dis) => h('button', { class: 'icon-btn' + (ic === 'play' ? '' : ' green'), 'aria-label': label, disabled: dis ? true : null, onclick: fn, html: ICON[ic] });
          viewer.append(
            h('div', { class: 'stepbar' },
              b('first', 'К первой черте', () => { stopPlay(); step = 1; hl = true; anim = true; render(); }),
              b('prev', 'Предыдущая черта', () => { stopPlay(); step = Math.max(1, step - 1); hl = true; anim = true; render(); }, step <= 1 && hl),
              lbl,
              b('next', 'Следующая черта', () => { stopPlay(); if (!hl) { step = 1; } else step = Math.min(N, step + 1); hl = true; anim = true; render(); }, hl && step >= N),
              b('last', 'Показать все', () => { stopPlay(); step = N; hl = false; render(); })),
            h('div', { class: 'stepbar' }, h('button', { class: 'btn primary small', onclick: play, html: ICON.play.replace('<svg', '<svg width="16" height="16" style="vertical-align:-2px;margin-right:6px"') + 'Показать написание' })),
            h('div', { class: 'thumbs', 'aria-label': 'Шаги' }, c.strokes.map((_, i) =>
              h('button', { class: (hl && step === i + 1) ? 'on' : '', 'aria-label': 'Шаг ' + (i + 1), onclick: () => { stopPlay(); step = i + 1; hl = true; anim = true; render(); },
                html: strokeSvg(c.strokes, i + 1, { cur: i, mini: true, ghost: true }) }))));
        } else if (view === 'brush' && !N) {
          viewer.append(h('p', { class: 'muted', style: 'margin:6px 0' }, 'Начертание пока не загружено.'),
            h('button', { class: 'btn primary small', onclick: async (e) => { e.target.disabled = true; await refetchStrokes(c); render(); } }, 'Загрузить начертание'));
        }

        viewer.append(h('div', { class: 'meta' },
          c.level ? h('span', { class: 'badge' }, c.level) : null,
          N ? h('span', { class: 'badge n' }, N + ' ' + plural(N, 'черта', 'черты', 'черт')) : null,
          c.cats.map(id => catName(id)).filter(Boolean).map(n => h('span', { class: 'badge p' }, n))));
        wrap.append(viewer);

        // заучивание
        wrap.append(h('div', { class: 'card' }, h('label', { class: 'row', style: 'padding:0;border:0' },
          h('span', { class: 't' }, 'Флэш-карта для заучивания', h('small', {}, 'Кандзи попадёт в режимы «Чтение» и «Письмо»')),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: c.study, onchange: e => { c.study = e.target.checked; saveCard(c); toast(c.study ? 'Добавлено в заучивание' : 'Убрано из заучивания'); } })))));

        // значения
        const mean = c.ru || (c.en || []).join(', ');
        wrap.append(h('div', { class: 'card' }, h('h3', {}, 'Значение'),
          mean ? h('div', { style: 'font-size:18px' }, mean) : h('span', { class: 'muted' }, 'Не заполнено: нажмите «Править» и впишите значение по-русски.'),
          (c.ru && c.en.length) ? h('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' }, 'EN: ' + c.en.join(', ')) : (!c.ru && c.en.length ? h('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' }, 'Перевод с английского. Впишите русский вариант в «Править».') : null)));

        // чтения
        wrap.append(h('div', { class: 'card' }, h('h3', {}, 'Чтения'),
          h('div', { class: 'readings' },
            h('div', {}, h('h4', {}, 'Онные чтения *'), h('div', { class: 'rlist' }, c.on.length ? c.on.map(r => readingChip(r, 'on')) : h('span', { class: 'muted' }, '—'))),
            h('div', {}, h('h4', {}, 'Кунные чтения **'), h('div', { class: 'rlist' }, c.kun.length ? c.kun.map(r => readingChip(r, 'kun')) : h('span', { class: 'muted' }, '—')))),
          h('div', { class: 'footnote' },
            h('p', {}, h('b', {}, '* Онное чтение'), ' (音読み, он) — «китайское» чтение: пришло из Китая вместе с иероглифом. Чаще всего встречается в словах из нескольких кандзи (学校, 先生). Записывается катаканой.'),
            h('p', {}, h('b', {}, '** Кунное чтение'), ' (訓読み, кун) — исконно японское слово, которому соответствует иероглиф. Обычно звучит, когда кандзи стоит отдельно или с окончанием (食べる). Записывается хираганой; светлая часть после точки — окуригана, она пишется хираганой после кандзи.')),
          c.infoMissing ? h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn small', onclick: async (e) => { e.target.disabled = true; await refetchInfo(c); render(); } }, 'Подтянуть чтения и слова из интернета')) : null));

        // слова
        wrap.append(h('div', { class: 'card' }, h('h3', {}, 'Слова'),
          c.words.length ? h('ul', { class: 'words' }, c.words.map(w => h('li', {},
            h('span', { class: 'w', html: wordRuby(w.w, w.r) }),
            h('span', { class: 'tr' }, w.ru ? w.ru : h('span', { class: 'en' }, w.en || '')))))
            : h('span', { class: 'muted' }, 'Пока нет слов. Добавьте их через «Править».')));

        // предложения
        wrap.append(h('div', { class: 'card' }, h('h3', {}, 'Примеры предложений'),
          c.sentences.length ? c.sentences.map(s => h('div', { class: 'sent' }, h('div', { class: 'ja', html: furigana(s.ja) }), s.ru ? h('div', { class: 'ru' }, s.ru) : null))
            : h('span', { class: 'muted' }, 'Пока нет предложений. Добавьте их через «Править» (фуригана: 私[わたし]).')));

        if (c.notes) wrap.append(h('div', { class: 'card' }, h('h3', {}, 'Заметки'), h('div', { style: 'white-space:pre-wrap' }, c.notes)));

        wrap.append(h('div', { class: 'actions' },
          h('button', { class: 'btn danger', onclick: async () => {
            if (!(await confirmSheet(`Удалить кандзи ${c.ch} вместе с вашими правками?`, 'Удалить', true))) return;
            S.cards.delete(ch); await DB.deleteCard(ch); toast('Удалено'); closeScreen(); }
          }, 'Удалить кандзи')));
      }

      function play() {
        stopPlay();
        const N = c.strokes.length;
        let i = 1;
        view = 'brush'; hl = true; step = 1; anim = true; render();
        const tick = () => {
          i++;
          if (i > N) { timer = null; hl = false; step = N; render(); return; }
          step = i; hl = true; anim = true; render();
          timer = setTimeout(tick, 900);
        };
        timer = setTimeout(tick, 900);
      }

      const head = bar(ch, null, h('button', { class: 'btn small', onclick: () => openEdit(ch, render), html: ICON.edit.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:6px"') + 'Править' }));
      outer.append(head, wrap);
      render();
    });
    return entry;
  }

  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c; };

  async function refetchStrokes(c) {
    try {
      const r = await loadStrokes(c.ch);
      if (r.strokes) { c.strokes = r.strokes; await saveCard(c); toast('Начертание загружено'); }
      else toast('В базе KanjiVG нет такого иероглифа');
    } catch (e) { toast('Нет связи с сервером. Проверьте интернет.'); }
  }
  async function refetchInfo(c) {
    const info = await loadInfo(c.ch);
    if (!info) { toast('Не удалось получить данные. Проверьте интернет.'); return null; }
    if (!c.en.length) c.en = info.en;
    if (!c.on.length) c.on = info.on;
    if (!c.kun.length) c.kun = info.kun;
    if (!c.words.length) c.words = info.words;
    c.grade = info.grade; c.infoMissing = false;
    await saveCard(c); toast('Данные подтянуты');
    return info;
  }

  /* ---------- Правка карточки ---------- */
  function openEdit(ch, onDone) {
    const entry = openScreen((wrap, entry) => {
      const c = S.cards.get(ch);
      const ruIn = h('input', { class: 'field', value: c.ru, placeholder: 'например: солнце, день', autocomplete: 'off' });
      const onIn = h('input', { class: 'field', value: c.on.join(', '), placeholder: 'コウ, ク', autocomplete: 'off', lang: 'ja' });
      const kunIn = h('input', { class: 'field', value: c.kun.join(', '), placeholder: 'た.べる, く.う', autocomplete: 'off', lang: 'ja' });
      const notes = h('textarea', { class: 'field', placeholder: 'Что поможет запомнить: ассоциации, составные части…', value: c.notes });
      const levelSel = h('select', { class: 'field' }, h('option', { value: '' }, 'Без уровня'), LEVELS.map(l => h('option', { value: l }, l)));
      levelSel.value = c.level;
      const catSet = new Set(c.cats);
      const catBox = h('div', { class: 'checks' }, S.cats.length ? S.cats.map(k => h('button', { class: 'chip g' + (catSet.has(k.id) ? ' on' : ''), type: 'button', onclick: e => { catSet.has(k.id) ? catSet.delete(k.id) : catSet.add(k.id); e.currentTarget.classList.toggle('on'); } }, k.name))
        : h('span', { class: 'muted' }, 'Категорий пока нет. Их можно создать во вкладке «Категории».'));
      const studyIn = h('input', { type: 'checkbox', checked: c.study });

      const wordsBox = h('div'), sentBox = h('div');
      const addWord = (w) => {
        w = w || { w: '', r: '', ru: '' };
        const row = h('div', { class: 'form-row' },
          h('input', { class: 'field', placeholder: 'Слово', value: w.w, lang: 'ja', 'data-k': 'w' }),
          h('input', { class: 'field', placeholder: 'Чтение', value: w.r, lang: 'ja', 'data-k': 'r' }),
          h('input', { class: 'field', placeholder: w.en ? 'EN: ' + w.en : 'Перевод', value: w.ru, 'data-k': 'ru', 'data-en': w.en || '' }),
          h('button', { class: 'x-btn', type: 'button', 'aria-label': 'Удалить', onclick: () => row.remove() }, '×'));
        wordsBox.append(row);
      };
      const addSent = (s) => {
        s = s || { ja: '', ru: '' };
        const row = h('div', { class: 'form-row s' },
          h('input', { class: 'field', placeholder: '私[わたし]は学生[がくせい]です', value: s.ja, lang: 'ja', 'data-k': 'ja' }),
          h('input', { class: 'field', placeholder: 'Перевод', value: s.ru, 'data-k': 'ru' }),
          h('button', { class: 'x-btn', type: 'button', 'aria-label': 'Удалить', onclick: () => row.remove() }, '×'));
        sentBox.append(row);
      };
      c.words.forEach(addWord); c.sentences.forEach(addSent);
      if (!c.words.length) addWord(); if (!c.sentences.length) addSent();

      const strokeInfo = h('div', { class: 'muted', style: 'font-size:14px' });
      const updStroke = () => { strokeInfo.textContent = c.strokes ? `Начертание загружено: ${c.strokes.length} ${plural(c.strokes.length, 'черта', 'черты', 'черт')}.` : 'Начертание не загружено: режим письма для этого кандзи недоступен.'; };
      updStroke();
      const fileIn = h('input', { type: 'file', accept: '.svg,image/svg+xml', hidden: true, onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        const strokes = Core.parseKanjiVG(await f.text());
        if (!strokes.length) { toast('В файле не найдены черты в формате KanjiVG'); return; }
        c.strokes = strokes; await saveCard(c); updStroke(); toast('Начертание из файла загружено');
      } });

      const list = s => s.split(/[,、，;；\n]+/).map(x => x.trim()).filter(Boolean);
      const collect = () => {
        c.ru = ruIn.value.trim();
        c.on = list(onIn.value); c.kun = list(kunIn.value);
        c.notes = notes.value.trim();
        c.level = levelSel.value;
        c.cats = Array.from(catSet).filter(id => catName(id));
        c.study = studyIn.checked;
        c.words = Array.from(wordsBox.children).map(r => ({
          w: r.querySelector('[data-k=w]').value.trim(), r: r.querySelector('[data-k=r]').value.trim(),
          ru: r.querySelector('[data-k=ru]').value.trim(), en: r.querySelector('[data-k=ru]').dataset.en || ''
        })).filter(w => w.w);
        c.sentences = Array.from(sentBox.children).map(r => ({ ja: r.querySelector('[data-k=ja]').value.trim(), ru: r.querySelector('[data-k=ru]').value.trim() })).filter(s => s.ja);
      };

      wrap.append(
        bar('Правка ' + ch, null, h('button', { class: 'btn primary small', onclick: async () => { collect(); await saveCard(c); toast('Сохранено'); closeScreen(); } }, 'Сохранить')),
        h('div', { class: 'card' },
          h('label', { class: 'lab', style: 'margin-top:0' }, 'Значения по-русски (через запятую)'), ruIn,
          c.en.length ? h('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' }, 'Подсказка (EN): ' + c.en.join(', ')) : null,
          h('label', { class: 'lab' }, 'Онные чтения (катаканой, через запятую)'), onIn,
          h('label', { class: 'lab' }, 'Кунные чтения (хираганой; точка отделяет окуригану)'), kunIn,
          h('div', { class: 'muted', style: 'font-size:12.5px;margin-top:4px' }, 'К чтению можно дописать пояснение в скобках: コウ（в словах из двух кандзи）. На проверку чтения оно не влияет.')),
        h('div', { class: 'card' }, h('h3', {}, 'Слова'), wordsBox, h('button', { class: 'btn small', type: 'button', onclick: () => addWord() }, '+ слово'),
          h('div', { class: 'muted', style: 'font-size:12.5px;margin-top:8px' }, 'Фуригана над словом строится из поля «Чтение».')),
        h('div', { class: 'card' }, h('h3', {}, 'Предложения'), sentBox, h('button', { class: 'btn small', type: 'button', onclick: () => addSent() }, '+ предложение'),
          h('div', { class: 'muted', style: 'font-size:12.5px;margin-top:8px' }, 'Фуригана: после кандзи в квадратных скобках, например 学生[がくせい]. Включить и выключить её можно в настройках.')),
        h('div', { class: 'card' }, h('h3', {}, 'Уровень и категории'),
          h('label', { class: 'lab', style: 'margin-top:0' }, 'Уровень JLPT'), levelSel,
          h('label', { class: 'lab' }, 'Категории (можно несколько)'), catBox,
          h('label', { class: 'row', style: 'margin-top:8px;border:0' }, h('span', { class: 't' }, 'Флэш-карта для заучивания'), h('span', { class: 'switch' }, studyIn))),
        h('div', { class: 'card' }, h('h3', {}, 'Заметки'), notes),
        h('div', { class: 'card' }, h('h3', {}, 'Данные кандзи'), strokeInfo,
          h('div', { class: 'actions', style: 'justify-content:flex-start' },
            h('button', { class: 'btn small', type: 'button', onclick: async e => { e.target.disabled = true; await refetchStrokes(c); updStroke(); e.target.disabled = false; } }, 'Загрузить начертание заново'),
            h('button', { class: 'btn small', type: 'button', onclick: async e => {
              e.target.disabled = true;
              const info = await loadInfo(c.ch);
              e.target.disabled = false;
              if (!info) { toast('Не удалось получить данные. Проверьте интернет.'); return; }
              if (!onIn.value.trim()) onIn.value = info.on.join(', ');
              if (!kunIn.value.trim()) kunIn.value = info.kun.join(', ');
              if (!c.en.length) c.en = info.en;
              if (!wordsBox.querySelector('[data-k=w]').value) { wordsBox.replaceChildren(); info.words.forEach(addWord); }
              toast('Подставлено в пустые поля. Не забудьте сохранить.');
            } }, 'Подтянуть чтения и слова'),
            h('button', { class: 'btn small', type: 'button', onclick: () => fileIn.click() }, 'Свой SVG (KanjiVG)'), fileIn)));
      entry.onClose = () => { if (onDone) onDone(); };
    });
    return entry;
  }

  /* ---------- Добавление кандзи ---------- */
  function openAdd() {
    openScreen((wrap, entry) => {
      const ta = h('textarea', { class: 'field', placeholder: 'Например: 日 月 火 水 木 金 土\nМожно вставить сразу весь список: лишние символы будут проигнорированы.', lang: 'ja', style: 'min-height:120px;font-size:20px' });
      const levelSel = h('select', { class: 'field' }, h('option', { value: '' }, 'Без уровня'), LEVELS.map(l => h('option', { value: l }, l)));
      if (LEVELS.includes(S.filter.level)) levelSel.value = S.filter.level;
      const catSet = new Set(S.filter.cat ? [S.filter.cat] : []);
      const catBox = h('div', { class: 'checks' }, S.cats.length ? S.cats.map(k => h('button', { class: 'chip g' + (catSet.has(k.id) ? ' on' : ''), type: 'button', onclick: e => { catSet.has(k.id) ? catSet.delete(k.id) : catSet.add(k.id); e.currentTarget.classList.toggle('on'); } }, k.name))
        : h('span', { class: 'muted' }, 'Категорий пока нет.'));
      const studyIn = h('input', { type: 'checkbox', checked: true });
      const infoIn = h('input', { type: 'checkbox', checked: true });
      const count = h('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' });
      const upd = () => { const n = Core.kanjiList(ta.value).length; count.textContent = n ? `Найдено кандзи: ${n}` : ''; };
      ta.addEventListener('input', upd);
      const prog = h('div', { class: 'progress', hidden: true }, h('i'));
      const log = h('div', { class: 'log' });
      const goBtn = h('button', { class: 'btn primary', onclick: run }, 'Добавить');

      async function run() {
        const chars = Core.kanjiList(ta.value);
        if (!chars.length) { toast('Введите хотя бы один иероглиф'); return; }
        goBtn.disabled = true; ta.disabled = true; prog.hidden = false; log.textContent = '';
        const bar = prog.firstChild;
        const todo = chars.filter(ch => !S.cards.has(ch));
        const skipped = chars.length - todo.length;
        const base = S.nextOrder; S.nextOrder += chars.length;
        const opts = { level: levelSel.value, cats: Array.from(catSet), study: studyIn.checked, info: infoIn.checked };
        let done = 0, added = 0; const failed = [], noStroke = [];
        await pool(todo, 4, async (ch) => {
          let strokes = null;
          try { const r = await loadStrokes(ch); strokes = r.strokes; if (r.missing) noStroke.push(ch); }
          catch (e) { failed.push(ch); done++; bar.style.width = (100 * done / todo.length) + '%'; return; }
          const info = opts.info ? await loadInfo(ch) : null;
          const card = newCard(ch, { level: opts.level, cats: opts.cats.slice(), study: opts.study, strokes, order: base + chars.indexOf(ch),
            en: info ? info.en : [], on: info ? info.on : [], kun: info ? info.kun : [], words: info ? info.words : [], grade: info ? info.grade : null, infoMissing: opts.info && !info });
          await saveCard(card);
          added++; done++;
          bar.style.width = (100 * done / todo.length) + '%';
        });
        S.nextOrder = Math.max(S.nextOrder, base + chars.length);
        const lines = [`Добавлено: ${added}`];
        if (skipped) lines.push(`Уже были в справочнике: ${skipped}`);
        if (noStroke.length) lines.push(`Нет начертания в базе: ${noStroke.join(' ')}`);
        if (failed.length) lines.push(`Не удалось скачать (нет связи?): ${failed.join(' ')}. Нажмите «Добавить» ещё раз.`);
        const infoMiss = opts.info ? Array.from(S.cards.values()).filter(c => c.infoMissing && chars.includes(c.ch)).length : 0;
        if (infoMiss) lines.push(`Чтения и слова не подтянулись у ${infoMiss}: их можно подтянуть в карточке кнопкой.`);
        log.replaceChildren(...lines.map(l => h('div', {}, l)));
        ta.value = failed.join(''); ta.disabled = false; upd();
        goBtn.disabled = false;
        if (added) { S.limit = Math.max(S.limit, 300); }
        if (!failed.length) { goBtn.textContent = 'Готово'; goBtn.onclick = closeScreen; }
      }

      entry.onClose = () => { if (S.tab === 'ref') { renderChips(); renderGrid(); } };
      wrap.append(
        bar('Добавить кандзи'),
        h('div', { class: 'card' },
          h('label', { class: 'lab', style: 'margin-top:0' }, 'Иероглифы'), ta, count,
          h('label', { class: 'lab' }, 'Уровень JLPT'), levelSel,
          h('label', { class: 'lab' }, 'Категории'), catBox,
          h('label', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 't' }, 'Сразу в заучивание', h('small', {}, 'Сделать флэш-картами')), h('span', { class: 'switch' }, studyIn)),
          h('label', { class: 'row', style: 'border:0' }, h('span', { class: 't' }, 'Подтянуть чтения и слова', h('small', {}, 'Значения придут на английском: русские впишете сами')), h('span', { class: 'switch' }, infoIn)),
          h('div', { class: 'actions' }, goBtn), prog, log));
    });
  }

  /* ---------- Категории ---------- */
  function buildCats(main) {
    const nameIn = h('input', { class: 'field', placeholder: 'Новая категория, например «Природа»', autocomplete: 'off', onkeydown: e => { if (e.key === 'Enter') add(); } });
    const listBox = h('div');
    function add() {
      const name = nameIn.value.trim();
      if (!name) return;
      if (S.cats.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('Такая категория уже есть'); return; }
      S.cats.push({ id: uid(), name }); saveCats(); nameIn.value = ''; draw();
    }
    function draw() {
      listBox.replaceChildren(...(S.cats.length ? S.cats.map(k => h('div', { class: 'cat-row' },
        h('button', { class: 'nm', onclick: () => { S.filter = { q: '', level: '', cat: k.id, study: false }; showTab('ref'); } }, k.name),
        h('span', { class: 'ct' }, catCount(k.id) + ' ' + plural(catCount(k.id), 'кандзи', 'кандзи', 'кандзи')),
        h('button', { class: 'icon-btn', style: 'width:36px;height:36px', 'aria-label': 'Переименовать', html: ICON.edit, onclick: () => rename(k) }),
        h('button', { class: 'x-btn', 'aria-label': 'Удалить', onclick: async () => {
          if (!(await confirmSheet(`Удалить категорию «${k.name}»? Сами кандзи останутся.`, 'Удалить', true))) return;
          S.cats = S.cats.filter(x => x.id !== k.id);
          const changed = [];
          S.cards.forEach(c => { if (c.cats.includes(k.id)) { c.cats = c.cats.filter(x => x !== k.id); changed.push(c); } });
          await DB.putCards(changed); saveCats(); if (S.filter.cat === k.id) S.filter.cat = ''; draw();
        } }, '×')))
        : [h('div', { class: 'empty' }, h('div', { class: 'big jp', lang: 'ja' }, '類'), h('h3', {}, 'Категорий пока нет'), h('p', {}, 'Создайте, например, «Природа», «Числа» или «Глаголы». Один кандзи может входить в несколько категорий сразу.'))]));
    }
    function rename(k) {
      const inp = h('input', { class: 'field', value: k.name });
      sheet('Переименовать категорию', inp, [{ label: 'Отмена', kind: 'ghost' }, { label: 'Сохранить', kind: 'primary', onClick: () => {
        const n = inp.value.trim(); if (!n) return; k.name = n; saveCats(); draw(); } }]);
    }
    main.append(
      h('header', { class: 'top' }, h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Категории'), h('small', {}, 'один кандзи — в любом числе категорий')))),
      h('div', { class: 'inline-form' }, nameIn, h('button', { class: 'btn primary', onclick: add }, 'Создать')),
      listBox,
      h('p', { class: 'muted', style: 'font-size:13px' }, 'Уровни N5–N1 задаются отдельно и не считаются категориями. Назначать категории удобно списком: в справочнике нажмите значок выбора, отметьте кандзи и выберите «Добавить в категорию».'));
    draw();
  }

  /* ---------- Настройки, резервные копии ---------- */
  function applySettings() {
    document.body.classList.toggle('no-furi', !S.settings.furigana);
    document.body.classList.toggle('f-gothic', S.settings.font === 'gothic');
  }
  const fmtDate = ts => new Date(ts).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

  function exportBackup() {
    const data = { app: 'kanji-sakura', version: 1, exported: new Date().toISOString(), settings: S.settings, cats: S.cats, cards: Array.from(S.cards.values()) };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'kanji-sakura-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.append(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
    S.settings.lastBackup = Date.now(); saveSettings();
    toast('Копия сохранена в загрузки');
    if (S.tab === 'settings') refresh();
  }
  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast('Файл не похож на резервную копию'); return; }
    if (!data || data.app !== 'kanji-sakura' || !Array.isArray(data.cards)) { toast('Это не резервная копия приложения'); return; }
    const cards = data.cards.map(normalizeCard).filter(Boolean);
    if (!(await confirmSheet(`Заменить текущие данные копией? В копии кандзи: ${cards.length}. Всё, что есть сейчас, будет заменено.`, 'Заменить', true))) return;
    await DB.clearAll();
    S.cards = new Map(cards.map(c => [c.ch, c]));
    S.cats = Array.isArray(data.cats) ? data.cats.filter(k => k && k.id && k.name).map(k => ({ id: String(k.id), name: String(k.name) })) : [];
    Object.assign(S.settings, data.settings || {});
    S.nextOrder = cards.reduce((m, c) => Math.max(m, c.order), 0) + 1;
    await DB.putCards(cards); await saveCats(); await saveSettings();
    applySettings(); S.filter = { q: '', level: '', cat: '', study: false };
    toast('Данные восстановлены: ' + cards.length); refresh();
  }

  function buildSettings(main) {
    const st = S.settings;
    const sel = (key, opts, cb) => { const s = h('select', { class: 'field', style: 'width:auto;min-width:130px', onchange: e => { st[key] = isNaN(+e.target.value) ? e.target.value : +e.target.value; saveSettings(); applySettings(); if (cb) cb(); } }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = st[key]; return s; };
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; } });
    const noStroke = Array.from(S.cards.values()).filter(c => !c.strokes);
    main.append(
      h('header', { class: 'top' }, h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Настройки'), h('small', {}, 'версия ' + VERSION)))),
      h('div', { class: 'card' }, h('h3', {}, 'Вид'),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Фуригана', h('small', {}, 'Чтение маленькой кана над кандзи в словах и предложениях')),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: st.furigana, onchange: e => { st.furigana = e.target.checked; saveSettings(); applySettings(); } }))),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Кандзи в карточке'), sel('view', [['brush', 'Кисть'], ['print', 'Печатный']])),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Печатный шрифт'), sel('font', [['mincho', 'Мин-тё (с засечками)'], ['gothic', 'Готик (без засечек)']]))),
      h('div', { class: 'card' }, h('h3', {}, 'Заучивание'),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Проверка письма', h('small', {}, 'Насколько точно должны совпасть черты')), sel('strict', [['soft', 'Мягкая'], ['medium', 'Средняя'], ['strict', 'Строгая']])),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Карточек за занятие'), sel('session', [[10, '10'], [20, '20'], [30, '30'], [50, '50']])),
        h('div', { class: 'row' }, h('span', { class: 't' }, 'Только к повторению', h('small', {}, 'Показывать то, что пора повторить')),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: st.onlyDue, onchange: e => { st.onlyDue = e.target.checked; saveSettings(); } })))),
      h('div', { class: 'card' }, h('h3', {}, 'Резервная копия'),
        h('p', { class: 'muted', style: 'margin:0 0 10px;font-size:14px' }, 'Все кандзи, ваши правки, категории и прогресс хранятся на этом устройстве. Сохраняйте копию время от времени. Файл можно загрузить на другое устройство.'),
        h('p', { style: 'margin:0 0 12px;font-size:14px' }, 'Последняя копия: ', st.lastBackup ? fmtDate(st.lastBackup) : h('b', {}, 'ещё не делалась')),
        h('div', { class: 'actions', style: 'justify-content:flex-start;margin:0' },
          h('button', { class: 'btn primary', onclick: exportBackup }, 'Сохранить копию'),
          h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Восстановить из копии'), fileIn)),
      h('div', { class: 'card' }, h('h3', {}, 'Данные'),
        h('p', { style: 'margin:0 0 10px;font-size:14px' }, `Кандзи в справочнике: ${S.cards.size}. Без начертания: ${noStroke.length}.`),
        noStroke.length ? h('button', { class: 'btn small', onclick: async e => {
          e.target.disabled = true; let ok = 0;
          await pool(noStroke, 4, async c => { try { const r = await loadStrokes(c.ch); if (r.strokes) { c.strokes = r.strokes; await saveCard(c); ok++; } } catch (_) {} });
          toast(`Загружено начертаний: ${ok} из ${noStroke.length}`); refresh();
        } }, 'Догрузить недостающие начертания') : null,
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn danger small', onclick: async () => {
          if (!(await confirmSheet('Стереть все кандзи, категории и прогресс на этом устройстве? Это нельзя отменить. Сначала сохраните копию.', 'Стереть всё', true))) return;
          await DB.clearAll(); S.cards = new Map(); S.cats = []; S.nextOrder = 1; S.filter = { q: '', level: '', cat: '', study: false };
          S.settings = Object.assign({}, { furigana: true, strict: 'medium', view: 'brush', font: 'mincho', session: 20, onlyDue: true, lastBackup: 0 });
          await saveSettings(); applySettings(); toast('Всё стёрто'); refresh();
        } }, 'Стереть все данные'))),
      h('div', { class: 'card' }, h('h3', {}, 'О приложении'),
        h('p', { style: 'margin:0 0 8px;font-size:14px' }, 'Начертания и порядок черт загружаются из проекта KanjiVG (Ulrich Apel и участники), лицензия CC BY-SA 3.0. Чтения и слова подсказывает сервис kanjiapi.dev на основе словарей KANJIDIC2 и JMdict (EDRDG), лицензия CC BY-SA 4.0.'),
        h('p', { class: 'muted', style: 'margin:0;font-size:13px' }, 'После первой загрузки кандзи работает без интернета.')));
  }

  /* ---------- Запуск ---------- */
  async function init() {
    await DB.open();
    try {
      const [cards, cats, settings] = await Promise.all([DB.allCards(), DB.kvGet('cats'), DB.kvGet('settings')]);
      (cards || []).map(normalizeCard).filter(Boolean).forEach(c => S.cards.set(c.ch, c));
      S.cats = Array.isArray(cats) ? cats : [];
      Object.assign(S.settings, settings || {});
    } catch (e) { toast('Не удалось прочитать данные'); }
    S.nextOrder = Array.from(S.cards.values()).reduce((m, c) => Math.max(m, c.order), 0) + 1;
    applySettings();
    history.replaceState({ s: 0 }, '');
    showTab('ref');
    if (DB.isMemory()) toast('Хранилище недоступно: данные не сохранятся после закрытия');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  return {
    S, h, ICON, LOGO, LEVELS, init, toast, sheet, confirmSheet, pickSheet, openScreen, closeScreen, bar, saveCard, meaning,
    strokeSvg, readingChip, openDetail, showTab, refresh, catName, plural, pool
  };
})();
