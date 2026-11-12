/* Вкладка «Учить»: чтение (он / кун), письмо на холсте, классические флэш-карты, интервальное повторение */
(function () {
  'use strict';
  const { h, S, ICON, LEVELS, LOGO } = App;

  const MODES = [
    { id: 'on', title: 'Чтение: онное', sub: 'Вспомнить онные (китайские) чтения', ic: '音', cls: '' },
    { id: 'kun', title: 'Чтение: кунное', sub: 'Вспомнить кунные (японские) чтения', ic: '訓', cls: 'g' },
    { id: 'write', title: 'Письмо', sub: 'Написать кандзи на холсте по значению и чтению', ic: '書', cls: '' },
    { id: 'card', title: 'Карточки', sub: 'Классические флэш-карты: перевернуть и отметить «выучено» или «не знаю»', ic: '札', cls: 'g' }
  ];
  const TOL = { soft: 22, medium: 15, strict: 10 };
  const filt = { level: '', cat: '' };

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hasData = (c, mode) => mode === 'write' ? !!c.strokes : Core.acceptedReadings(mode === 'on' ? c.on : c.kun, mode).size > 0;
  const passesFilter = c => c.study && (!filt.level || c.level === filt.level) && (!filt.cat || c.cats.includes(filt.cat));
  function pool(mode) {
    const out = [];
    S.cards.forEach(c => { if (passesFilter(c) && hasData(c, mode)) out.push(c); });
    return out;
  }
  const dueOf = (list, mode) => list.filter(c => Core.isDue(c.srs[mode], Date.now()));

  /* Классические карточки: колода и направление */
  const hasContent = c => c.on.length || c.kun.length || c.ru || c.en.length;
  const isUnknown = c => !c.learned && !!(c.srs.card && c.srs.card.ok === 0);
  function cardPool(deck, side) {
    const out = [];
    S.cards.forEach(c => {
      if (!passesFilter(c) || !hasContent(c)) return;
      if (deck === 'fresh' && c.learned) return;
      if (deck === 'unknown' && !isUnknown(c)) return;
      if (side === 'reading' && !c.strokes) return;
      out.push(c);
    });
    return out;
  }

  /* ---------- Горячие клавиши ---------- */
  function keyBinder() {
    let fn = null;
    const on = e => { if (fn) fn(e); };
    document.addEventListener('keydown', on);
    return { set(f) { fn = f; }, clear() { fn = null; }, destroy() { fn = null; document.removeEventListener('keydown', on); } };
  }
  const typing = e => !!(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  const onButton = e => !!(e.target && e.target.closest && e.target.closest('button'));
  const KBD_HINT = '<kbd>Ctrl</kbd>+<kbd>Z</kbd> отменить черту · <kbd>Ctrl</kbd>+<kbd>Y</kbd> вернуть · <kbd>Backspace</kbd> тоже отменяет';

  /* ---------- Объяснение результата письма ---------- */
  function describeResult(res) {
    const lines = [];
    if (!res.countOk) lines.push(`Черт нарисовано: ${res.userCount}, а в этом кандзи их ${res.refCount}. Одна непрерывная линия пальцем (или мышью) — одна черта.`);
    else res.strokes.forEach((s, i) => {
      if (s.status === 'reversed') lines.push(`Черта ${i + 1}: проведена в обратную сторону.`);
      else if (s.status === 'order') lines.push(`Черта ${i + 1}: здесь нарисована черта, которая идёт под номером ${s.other + 1}. Проверьте порядок.`);
      else if (s.status === 'shape') lines.push(`Черта ${i + 1}: форма или положение заметно отличаются от образца.`);
    });
    const title = res.ok ? `Отлично! Все черты верны (точность ${res.score}%).` : (res.countOk ? `Есть неточности (точность ${res.score}%).` : 'Число черт не совпало.');
    return { ok: res.ok, title, lines };
  }
  const resultBox = d => h('div', { class: 'result ' + (d.ok ? 'good' : 'bad') },
    h('b', {}, d.title),
    d.lines.length ? h('ul', { class: 'fb' }, d.lines.map(l => h('li', {}, l))) : null,
    h('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Зелёное — образец, ваши черты наложены на него: розовые — неверные.'));

  /* ---------- Кандзи дня ---------- */
  const KIND_NAMES = { write: 'письмо', kun: 'кунное чтение', on: 'онное чтение' };
  const KIND_SHORT = { write: 'письмо', kun: 'кун', on: 'он' };
  function dailySteps(c) {
    const st = [];
    if (c.strokes) st.push('write');
    if (Core.acceptedReadings(c.kun, 'kun').size) st.push('kun');
    if (Core.acceptedReadings(c.on, 'on').size) st.push('on');
    return st;
  }
  const dailyPool = () => { const out = []; S.cards.forEach(c => { if (c.study && dailySteps(c).length) out.push(c); }); return out; };
  /* Набор на сегодня: выбирается один раз за день и хранится, чтобы не менялся при каждом заходе. */
  function ensureDaily(force) {
    const today = Core.dayKey(), d = S.daily;
    if (!force && d && d.day === today) {
      const ids = d.ids.filter(ch => { const c = S.cards.get(ch); return c && dailySteps(c).length; });
      if (ids.length) { if (ids.length !== d.ids.length) { d.ids = ids; App.saveDaily(); } return d; }
    }
    const pool = dailyPool();
    if (!pool.length) { S.daily = null; return null; }
    const ids = Core.pickDaily(pool, S.settings.dailyCount || 5, Math.random, force && d ? d.ids : []);
    S.daily = { day: today, ids, done: {} };
    App.saveDaily();
    return S.daily;
  }
  function dailyPending(d) {
    const plan = [];
    d.ids.forEach(ch => {
      const c = S.cards.get(ch); if (!c) return;
      dailySteps(c).forEach(k => { if (((d.done[ch] || {})[k]) === undefined) plan.push({ ch, kind: k }); });
    });
    return plan;
  }
  function dailyTotals(d) {
    let total = 0, done = 0, ok = 0;
    d.ids.forEach(ch => {
      const c = S.cards.get(ch); if (!c) return;
      dailySteps(c).forEach(k => { total++; const v = (d.done[ch] || {})[k]; if (v !== undefined) { done++; if (v) ok++; } });
    });
    return { total, done, ok };
  }
  function startDaily(d, restart) {
    if (restart) d.done = {};
    const plan = dailyPending(d);
    if (!plan.length) return;
    App.saveDaily();
    runSession('write', [], { plan, order: d.ids, onItem: (ch, kind, ok) => { (d.done[ch] = d.done[ch] || {})[kind] = ok; App.saveDaily(); } });
  }
  function dailySummary() {
    const d = S.daily, t = dailyTotals(d);
    const rows = d.ids.map(ch => {
      const c = S.cards.get(ch); if (!c) return null;
      const st = d.done[ch] || {};
      const steps = dailySteps(c);
      const wrongRead = steps.filter(k => k !== 'write' && st[k] === false);
      return h('div', { class: 'dsum-row' },
        h('button', { class: 'tr-ch jp', lang: 'ja', 'aria-label': 'Открыть карточку ' + ch, onclick: () => App.openDetail(ch) }, ch),
        h('div', { class: 'tr-body' },
          h('div', { class: 'tr-en' }, App.meaning(c) || '—'),
          h('div', { class: 'dchips' }, steps.map(k => h('span', { class: 'dchip ' + (st[k] === true ? 'good' : st[k] === false ? 'bad' : '') }, (st[k] === true ? '✓ ' : st[k] === false ? '✗ ' : '· ') + KIND_SHORT[k]))),
          wrongRead.length ? h('div', { class: 'dfix', lang: 'ja' }, wrongRead.map(k => h('div', {}, h('span', { class: 'muted', lang: 'ru' }, KIND_SHORT[k] + ': '), (k === 'on' ? c.on : c.kun).map(r => r.replace(/[（(][^）)]*[）)]/g, '').replace(/\./g, '')).join(' · ')))) : null));
    });
    return h('div', {},
      h('div', { class: 'score' }, `${t.ok} из ${t.total}`),
      h('div', { class: 'q-hint' }, t.ok === t.total ? 'Кандзи дня пройдены без единой ошибки' : 'Кандзи дня пройдены · верных заданий'),
      streakLine(),
      h('div', { class: 'card' }, h('h3', {}, 'Итоги по кандзи'), rows),
      h('p', { class: 'muted', style: 'font-size:13px;text-align:center' }, 'Ошибки учтены: такие кандзи будут чаще попадаться в следующие дни.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: App.closeScreen }, 'Готово')));
  }

  /* ---------- Вкладка ---------- */
  App.buildStudy = function (main) {
    const box = h('div');
    main.append(
      h('header', { class: 'top' }, h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Учить'), h('small', {}, 'флэш-карты из вашего справочника')))),
      box);
    draw();

    function explainDue() {
      App.sheet('Что значит «Только то, что пора повторить»?', h('div', {},
        h('p', {}, 'Приложение запоминает, как хорошо вы знаете каждую карточку, и само назначает следующий повтор. После верного ответа карточка вернётся через 1, затем 3, 7, 14, 30 и 60 дней. После ошибки — снова сегодня.'),
        h('h4', {}, 'Включено'),
        h('p', {}, 'В занятие попадают новые карточки и те, у которых срок повтора уже пришёл. Время не тратится на то, что вы и так хорошо знаете.'),
        h('h4', {}, 'Выключено'),
        h('p', {}, 'В занятие попадают все карточки подряд, как бы хорошо вы их ни знали. Удобно перед экзаменом или просто потренироваться.'),
        h('h4', {}, 'Режим «Карточки»'),
        h('p', {}, 'Он этой настройкой не управляется: там вы сами выбираете, какие карточки показывать («не выученные», «не знаю» или все).')),
        [{ label: 'Понятно', kind: 'primary' }]);
    }

    function draw() {
      box.replaceChildren();
      let total = 0; S.cards.forEach(c => { if (c.study) total++; });
      if (!total) {
        box.append(h('div', { class: 'empty' }, h('div', { class: 'big jp', lang: 'ja' }, '学'), h('h3', {}, 'Нет флэш-карт'),
          h('p', {}, 'Выберите кандзи для заучивания: в справочнике нажмите значок выбора, отметьте нужные и выберите «В заучивание». Или включите переключатель «Флэш-карта» в самой карточке.'),
          h('button', { class: 'btn primary', onclick: () => App.showTab('ref') }, 'Перейти в справочник')));
        return;
      }
      const mk = (label, on, fn, cls) => h('button', { class: 'chip ' + (cls || '') + (on ? ' on' : ''), onclick: fn }, label);
      box.append(
        dailyCard(),
        h('div', { class: 'chips' }, mk('Все уровни', !filt.level, () => { filt.level = ''; draw(); }), ...LEVELS.map(l => mk(l, filt.level === l, () => { filt.level = filt.level === l ? '' : l; draw(); }))),
        S.cats.length ? h('div', { class: 'chips' }, ...S.cats.map(k => mk(k.name, filt.cat === k.id, () => { filt.cat = filt.cat === k.id ? '' : k.id; draw(); }, 'g'))) : null,
        h('div', { class: 'row', style: 'margin:4px 0 8px;border:0' },
          h('span', { class: 't' }, h('span', {}, 'Только то, что пора повторить', h('button', { class: 'help-btn', 'aria-label': 'Что это значит?', onclick: explainDue }, '?')),
            h('small', {}, 'Новые карточки и те, у которых подошёл срок. Относится к режимам чтения и письма')),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: S.settings.onlyDue, onchange: e => { S.settings.onlyDue = e.target.checked; DB.kvSet('settings', S.settings); draw(); } }))),
        h('div', { class: 'modes' }, MODES.map(m => {
          if (m.id === 'card') {
            const all = cardPool('all', 'kanji'), learned = all.filter(c => c.learned).length;
            return h('button', { class: 'mode ' + m.cls, disabled: all.length ? null : true, onclick: setupCards },
              h('span', { class: 'ic jp', lang: 'ja' }, m.ic),
              h('span', { class: 'tx' }, h('b', {}, m.title), h('span', {}, `${m.sub}. Выучено: ${learned} из ${all.length}`)),
              all.length ? h('span', { class: 'due' + (all.length - learned ? '' : ' zero') }, all.length - learned ? (all.length - learned) + ' осталось' : 'всё выучено') : null);
          }
          const all = pool(m.id), due = dueOf(all, m.id).length;
          return h('button', { class: 'mode ' + m.cls, disabled: all.length ? null : true, onclick: () => start(m.id) },
            h('span', { class: 'ic jp', lang: 'ja' }, m.ic),
            h('span', { class: 'tx' }, h('b', {}, m.title), h('span', {}, all.length ? `${m.sub}. Карточек: ${all.length}` : 'Нет подходящих карточек (нужны ' + (m.id === 'write' ? 'начертания' : 'чтения') + ')')),
            all.length ? h('span', { class: 'due' + (due ? '' : ' zero') }, due ? due + ' к повтору' : 'всё повторено') : null);
        })),
        h('p', { class: 'muted', style: 'font-size:13px' }, `В заучивании: ${total}. Правильные ответы отодвигают повтор (1, 3, 7, 14, 30, 60 дней), ошибка возвращает карточку в начало.`));
    }

    function dailyCard() {
      const d = ensureDaily(false);
      if (!d) return h('div', { class: 'card daily' }, h('h3', {}, 'Кандзи дня'),
        h('p', { class: 'muted', style: 'margin:0' }, 'Каждый день здесь будут выбираться несколько кандзи из заучивания, с упором на трудные: нужно написать их и ответить про кунное и онное чтения. Добавьте в заучивание кандзи с чтениями или начертанием.'));
      const t = dailyTotals(d);
      const label = t.done === 0 ? 'Начать' : t.done < t.total ? 'Продолжить' : 'Повторить';
      return h('div', { class: 'card daily' },
        h('div', { class: 'daily-head' }, h('h3', { style: 'margin:0' }, 'Кандзи дня'), h('span', { class: 'muted' }, t.done >= t.total ? `верно ${t.ok} из ${t.total}` : `выполнено ${t.done} из ${t.total}`)),
        h('div', { class: 'dtiles' }, d.ids.map(ch => {
          const c = S.cards.get(ch); if (!c) return null;
          const st = d.done[ch] || {}, steps = dailySteps(c);
          const fin = steps.every(k => st[k] !== undefined), allOk = steps.every(k => st[k] === true);
          const hard = Core.difficulty(c).wrong >= Core.HARD_WRONG;
          return h('button', { class: 'dtile' + (fin ? (allOk ? ' ok' : ' bad') : ''), 'aria-label': 'Открыть карточку ' + ch, onclick: () => App.openDetail(ch) },
            h('span', { class: 'ch', lang: 'ja' }, ch),
            h('small', {}, fin ? (allOk ? '✓ верно' : 'есть ошибки') : (hard ? 'трудный' : '\u00a0')));
        })),
        h('p', { class: 'muted', style: 'font-size:13px;margin:8px 0 0' }, 'По каждому: написать кандзи, затем кунное и онное чтения. Чаще выпадают те, где вы ошибались или нажимали «не знаю».'),
        h('div', { class: 'actions', style: 'justify-content:flex-start;margin:12px 0 0' },
          h('button', { class: 'btn primary', onclick: () => startDaily(d, t.done >= t.total) }, label),
          h('button', { class: 'btn ghost small', onclick: reroll }, 'Другие кандзи')));
    }
    async function reroll() {
      const d = S.daily;
      if (dailyPool().length <= (S.settings.dailyCount || 5)) { App.toast('Других кандзи пока нет: в заучивании их немного'); return; }
      if (d && dailyTotals(d).done > 0 && !(await App.confirmSheet('Сменить набор? Результаты за сегодня в этом наборе сбросятся (в статистике они останутся).', 'Сменить'))) return;
      ensureDaily(true); draw();
    }

    function start(mode) {
      const all = pool(mode);
      const list = S.settings.onlyDue ? dueOf(all, mode) : all;
      if (!list.length) {
        App.sheet('Всё повторено', h('p', { style: 'margin:4px 0' }, 'Сейчас нет карточек, срок которых подошёл. Позаниматься всё равно?'),
          [{ label: 'Не сейчас', kind: 'ghost' }, { label: 'Позаниматься', kind: 'primary', onClick: () => runSession(mode, shuffle(all).slice(0, S.settings.session).map(c => c.ch)) }]);
        return;
      }
      runSession(mode, shuffle(list).slice(0, S.settings.session).map(c => c.ch));
    }

    /* Настройка классических карточек: с какой стороны и какая колода */
    function setupCards() {
      let side = ['kanji', 'reading', 'mix'].includes(S.settings.flashSide) ? S.settings.flashSide : 'kanji';
      let deck = ['fresh', 'unknown', 'all'].includes(S.settings.flashDeck) ? S.settings.flashDeck : 'fresh';
      const info = h('p', { class: 'muted', style: 'margin:10px 0 0;font-size:14px' });
      const sides = [
        ['kanji', 'Кандзи → чтения', 'На лицевой стороне иероглиф. Вспоминаете чтения и значение, переворачиваете и проверяете себя.'],
        ['reading', 'Чтения → написание', 'На лицевой стороне чтения и значение. Пишете иероглиф на холсте, он проверяется, затем карточка переворачивается и показывает порядок черт.'],
        ['mix', 'Вперемешку', 'Каждая карточка выпадает случайной стороной.']
      ];
      const decks = [
        ['fresh', 'Не выученные', 'Всё, что ещё не отмечено «выучено».'],
        ['unknown', 'Только «не знаю»', 'То, что в прошлый раз отметили «не знаю».'],
        ['all', 'Все карточки', 'Вместе с выученными, чтобы закрепить.']
      ];
      const sideBox = h('div', { class: 'opt-list' }), deckBox = h('div', { class: 'opt-list' });
      let go;
      const choice = (arr, cur, set) => arr.map(([v, t, d]) => h('button', { class: 'choice' + (cur() === v ? ' on' : ''), type: 'button', onclick: () => { set(v); paint(); } },
        h('span', { class: 'rd' }), h('span', {}, h('b', {}, t), h('small', {}, d))));
      function count() { return cardPool(deck, side === 'reading' ? 'reading' : 'kanji').length; }
      function paint() {
        sideBox.replaceChildren(...choice(sides, () => side, v => { side = v; }));
        deckBox.replaceChildren(...choice(decks, () => deck, v => { deck = v; }));
        const n = count();
        info.textContent = n ? `Карточек в колоде: ${n}. За одно занятие: не больше ${S.settings.session} (меняется в настройках).` + (side === 'reading' ? ' Для этой стороны нужны карточки с начертанием.' : '') : 'В такой колоде карточек нет. Выберите другую сторону или колоду.';
        if (go) go.disabled = !n;
      }
      const s = App.sheet('Классические флэш-карты', h('div', {}, h('h4', { style: 'margin-top:4px' }, 'С какой стороны начинаем'), sideBox, h('h4', {}, 'Какие карточки'), deckBox, info),
        [{ label: 'Отмена', kind: 'ghost' }, { label: 'Начать', kind: 'primary', keepOpen: true, onClick: close => {
          S.settings.flashSide = side; S.settings.flashDeck = deck; DB.kvSet('settings', S.settings);
          const list = shuffle(cardPool(deck, side === 'reading' ? 'reading' : 'kanji')).slice(0, S.settings.session).map(c => c.ch);
          close();
          if (list.length) runCards(list, side);
        } }]);
      go = s.el.querySelector('.sheet-actions .btn.primary');
      paint();
    }
    App.refreshStudy = draw;
  };

  /* ---------- Сессия: чтение и письмо ---------- */
  function runSession(mode, ids, opts) {
    const daily = !!(opts && opts.plan);        // «Кандзи дня»: план шагов [{ch, kind}], без повторов после ошибки
    const meta = daily ? { title: 'Кандзи дня' } : MODES.find(m => m.id === mode);
    App.openScreen((wrap, entry) => {
      const queue = daily ? opts.plan.map(p => p.kind + '|' + p.ch) : ids.slice();
      const first = {};           // результат с первой попытки: ключ шага -> bool
      const retried = new Set();
      const itemOf = k => daily ? { kind: k.slice(0, k.indexOf('|')), ch: k.slice(k.indexOf('|') + 1) } : { kind: mode, ch: k };
      let curMode = mode, curKey = '';
      let idx = 0;
      const keys = keyBinder();
      const progI = h('i');
      const cnt = h('span', { class: 'muted', style: 'font-size:14px;min-width:54px;text-align:right' });
      const body = h('div', { class: 'session' });
      wrap.append(h('div', { class: 'bar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Закончить', onclick: App.closeScreen, html: ICON.close }),
        h('div', { class: 'progress pg', style: 'margin:0;flex:1' }, progI), cnt), body);
      entry.onClose = () => { keys.destroy(); if (App.refreshStudy && S.tab === 'study') App.refreshStudy(); };

      function record(c, ok, prev) {
        c.srs[curMode] = Core.review(prev, ok, Date.now());
        App.saveCard(c);
        App.logActivity(curMode, ok);
        if (daily) opts.onItem(c.ch, curMode, ok);
      }
      function advance() { idx++; next(); }
      function next() {
        keys.clear();
        progI.style.width = (100 * Math.min(idx, queue.length) / Math.max(queue.length, 1)) + '%';
        cnt.textContent = Math.min(idx + 1, queue.length) + ' / ' + queue.length;
        if (idx >= queue.length) return summary();
        const item = itemOf(queue[idx]);
        curKey = queue[idx]; curMode = item.kind;
        const c = S.cards.get(item.ch);
        if (!c) return advance();
        body.replaceChildren();
        window.scrollTo(0, 0); entry.el.scrollTop = 0;
        if (curMode === 'write') writeCard(c); else readCard(c);
        if (daily) body.prepend(h('div', { class: 'daily-tag' }, `Кандзи дня · ${opts.order.indexOf(c.ch) + 1} из ${opts.order.length} · ${KIND_NAMES[curMode]}`));
      }
      function onResult(c, ok, prev) {
        const key = curKey;
        if (!(key in first)) first[key] = ok;
        if (!retried.has(key)) record(c, ok, prev);
        if (!daily && !ok && !retried.has(key)) { retried.add(key); queue.push(key); }
      }

      /* ----- Чтение ----- */
      function readCard(c) {
        const kind = curMode, key = curKey;
        const prev = c.srs[kind];
        const accepted = Core.acceptedReadings(kind === 'on' ? c.on : c.kun, kind);
        const inp = h('input', { class: 'field ans-input', type: 'text', lang: 'ja', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'ответ (кана или ромадзи)', enterkeyhint: 'done' });
        const prevKana = h('div', { class: 'kana-prev', lang: 'ja' });
        const resBox = h('div');
        const actions = h('div', { class: 'actions' });
        let answered = false;
        const firstTry = !(key in first);

        inp.addEventListener('input', () => { const v = inp.value; prevKana.textContent = /[a-zA-Z'-]/.test(v) ? Core.romajiToHira(v, false) : ''; });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); answered ? advance() : check(); } });

        function showAnswer(ok, shown) {
          answered = true; inp.disabled = true;
          const list = (kind === 'on' ? c.on : c.kun);
          resBox.replaceChildren(h('div', { class: 'result ' + (ok ? 'good' : 'bad') },
            h('b', {}, ok ? 'Верно!' : (shown ? 'Вот ответ' : 'Не совпало')),
            ok && inp.value.trim() ? h('div', { class: 'jp', lang: 'ja', style: 'font-size:20px;color:var(--ink)' }, Core.romajiToHira(inp.value.trim(), true)) : null,
            h('div', { class: 'ans' }, h('div', { class: 'rlist' }, list.map(r => App.readingChip(r, kind))))));
          actions.replaceChildren(
            !ok ? h('button', { class: 'btn green', onclick: override }, 'Засчитать как верно') : null,
            h('button', { class: 'btn primary', onclick: advance }, 'Дальше'));
          actions.querySelector('.btn.primary').focus();
        }
        function override() {
          if (firstTry) {
            first[key] = true;
            c.srs[kind] = Core.review(prev, true, Date.now()); App.saveCard(c);
            App.fixActivity(kind);
            const k = queue.lastIndexOf(key); if (k > idx) queue.splice(k, 1);
            retried.delete(key);
            if (daily) opts.onItem(c.ch, kind, true);
          }
          App.toast('Засчитано'); advance();
        }
        function check() {
          const typed = Core.normReading(Core.romajiToHira(inp.value.trim(), true));
          if (!typed) { inp.focus(); return; }
          const ok = accepted.has(typed);
          if (firstTry) onResult(c, ok, prev);
          showAnswer(ok, false);
        }
        function giveUp() {
          if (firstTry) onResult(c, false, prev);
          showAnswer(false, true);
        }
        actions.append(h('button', { class: 'btn primary', onclick: check }, 'Проверить'), h('button', { class: 'btn ghost', onclick: giveUp }, 'Не помню'));
        body.append(
          h('div', { class: 'q-label' }, kind === 'on' ? 'Онное чтение (он)' : 'Кунное чтение (кун)'),
          h('div', { class: 'big-ch', lang: 'ja', style: 'font-family:var(--' + S.settings.font + ')' }, c.ch),
          h('div', { class: 'q-hint' }, App.meaning(c) || ''),
          inp, prevKana, resBox, actions,
          h('p', { class: 'muted', style: 'text-align:center;font-size:13px' }, kind === 'kun' ? 'Достаточно основы (до точки) или чтения целиком, как вы привыкли. Если чтений несколько, подойдёт любое.' : 'Если онных чтений несколько, подойдёт любое. Можно набирать ромадзи: kou → こう.'));
        setTimeout(() => inp.focus(), 60);
      }

      /* ----- Письмо ----- */
      function writeCard(c) {
        const prev = c.srs.write;
        const refD = c.strokes.map(s => s.d);
        const key = curKey;
        const firstTry = !(key in first);
        let recorded = false, checked = false, lastOk = false;
        const pad = makePad(refD);
        const fb = h('div');
        const actions = h('div', { class: 'actions' });
        const btnCheck = h('button', { class: 'btn primary', onclick: check }, 'Проверить');

        function renderActions() {
          actions.replaceChildren(
            h('button', { class: 'btn ghost small', title: 'Ctrl+Z', onclick: () => pad.undo() }, '↶ Отменить черту'),
            h('button', { class: 'btn ghost small', title: 'Ctrl+Y', onclick: () => pad.redo() }, '↷ Вернуть'),
            h('button', { class: 'btn ghost small', onclick: () => pad.clear() }, 'Очистить'),
            h('button', { class: 'btn green small', onclick: () => pad.hint() }, 'Подсказка'),
            btnCheck);
        }
        function retry() { checked = false; fb.replaceChildren(); pad.unlock(); renderActions(); }
        function check() {
          const strokes = pad.strokes();
          if (!strokes.length) { App.toast('Сначала напишите кандзи на холсте'); return; }
          const res = Core.compare(strokes, refD, TOL[S.settings.strict] || 15);
          checked = true; pad.showResult(res);
          const d = describeResult(res);
          lastOk = d.ok;
          if (firstTry && !recorded) { recorded = true; onResult(c, d.ok, prev); }
          fb.replaceChildren(resultBox(d));
          actions.replaceChildren(
            !d.ok ? h('button', { class: 'btn', onclick: retry }, 'Попробовать ещё раз') : null,
            !d.ok ? h('button', { class: 'btn ghost', onclick: () => App.openDetail(c.ch) }, 'Смотреть порядок черт') : null,
            !d.ok && firstTry && recorded ? h('button', { class: 'btn green', onclick: () => {
              first[key] = true; c.srs.write = Core.review(prev, true, Date.now()); App.saveCard(c); App.fixActivity('write');
              const k = queue.lastIndexOf(key); if (k > idx) queue.splice(k, 1);
              retried.delete(key); if (daily) opts.onItem(c.ch, 'write', true);
              App.toast('Засчитано'); advance(); } }, 'Засчитать как верно') : null,
            h('button', { class: 'btn primary', onclick: advance }, 'Дальше'));
        }
        renderActions();
        keys.set(e => {
          if (typing(e)) return;
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); if (!checked) pad.undo(); }
          else if (mod && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); if (!checked) pad.redo(); }
          else if (!mod && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); if (!checked) pad.undo(); }
          else if (e.key === 'Enter' && !onButton(e)) { e.preventDefault(); if (!checked) check(); else if (lastOk) advance(); else retry(); }
        });

        // в «Кандзи дня» чтения не подсказываем: про них спросят следующими вопросами
        const readings = daily ? [] : [].concat(c.on, c.kun).map(r => r.replace(/[（(][^）)]*[）)]/g, '').replace(/[.\-]/g, '')).filter(Boolean);
        body.append(
          h('div', { class: 'q-label' }, 'Напишите кандзи'),
          h('div', { class: 'q-hint', style: 'font-size:18px;color:var(--ink)' }, App.meaning(c) || '—'),
          readings.length ? h('div', { class: 'q-hint', lang: 'ja', style: 'margin-top:-6px' }, readings.slice(0, 6).join(' · ')) : null,
          h('div', { class: 'q-hint', style: 'margin-top:-6px;font-size:13px' }, c.strokes.length + ' ' + App.plural(c.strokes.length, 'черта', 'черты', 'черт')),
          h('div', { class: 'pad-wrap' }, pad.el), fb, actions,
          h('div', { class: 'kbd-hint', html: KBD_HINT + ' · <kbd>Enter</kbd> проверить / дальше' }));
        pad.mount();
      }

      next();
      /* ----- Итоги ----- */
      function summary() {
        keys.clear();
        body.replaceChildren();
        cnt.textContent = '';
        if (daily) { body.append(dailySummary()); return; }
        const keysArr = Object.keys(first);
        const good = keysArr.filter(k => first[k]).length;
        const bad = keysArr.filter(k => !first[k]);
        const pct = keysArr.length ? Math.round(100 * good / keysArr.length) : 0;
        cnt.textContent = '';
        body.append(
          h('div', { class: 'score' }, `${good} из ${keysArr.length}`),
          h('div', { class: 'q-hint' }, meta.title + ' · с первого раза ' + pct + '%'),
          streakLine(),
          bad.length ? h('div', { class: 'card' }, h('h3', {}, 'Стоит повторить'),
            h('div', { class: 'sum-list' }, bad.map(ch => h('button', { class: 'tile', onclick: () => App.openDetail(ch) }, h('div', { class: 'ch', lang: 'ja' }, ch)))))
            : h('div', { class: 'result good', style: 'text-align:center' }, 'Без ошибок. Так держать!'),
          h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: App.closeScreen }, 'Готово')));
      }
    });
  }

  /* Строка со стриком-цветком в конце занятия */
  function streakLine() {
    const st = Core.streak(S.stats.days);
    if (!App.flowerSvg) return null;
    return h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:10px;margin:2px 0 12px' },
      h('span', { style: 'width:44px;height:44px;display:inline-block', html: App.flowerSvg(st.doneToday ? 'full' : 'pale') }),
      h('span', { style: 'font-weight:600' }, st.current + ' ' + App.plural(st.current, 'день', 'дня', 'дней') + ' подряд'));
  }

  /* ---------- Мини-плеер порядка черт для карточек ---------- */
  function miniPlayer(c) {
    const box = h('div');
    if (!c.strokes) return box;
    const N = c.strokes.length;
    const st = h('div', { class: 'mini-stage' });
    let timer = null;
    const paint = (n, cur) => { st.innerHTML = App.strokeSvg(c.strokes, n, { ghost: true, cur, anim: cur >= 0, numbers: true }); };
    function play() {
      clearTimeout(timer);
      let n = 1; paint(1, 0);
      const tick = () => {
        if (!st.isConnected) return;
        n++;
        if (n > N) { paint(N, -1); return; }
        paint(n, n - 1); timer = setTimeout(tick, 800);
      };
      timer = setTimeout(tick, 800);
    }
    paint(N, -1);
    box.append(st, h('div', { style: 'text-align:center;margin-bottom:4px' }, h('button', { class: 'btn small green', onclick: play }, '▶ Порядок черт')));
    setTimeout(play, 350);
    return box;
  }

  /* ---------- Сессия: классические флэш-карты ---------- */
  function runCards(ids, sideMode) {
    App.openScreen((wrap, entry) => {
      const queue = ids.slice();
      const first = {};
      const retried = new Set();
      let idx = 0;
      const keys = keyBinder();
      const progI = h('i');
      const cnt = h('span', { class: 'muted', style: 'font-size:14px;min-width:54px;text-align:right' });
      const body = h('div', { class: 'session' });
      wrap.append(h('div', { class: 'bar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Закончить', onclick: App.closeScreen, html: ICON.close }),
        h('div', { class: 'progress pg', style: 'margin:0;flex:1' }, progI), cnt), body);
      entry.onClose = () => { keys.destroy(); if (App.refreshStudy && S.tab === 'study') App.refreshStudy(); };

      const dirOf = c => sideMode === 'mix' ? (c.strokes && Math.random() < 0.5 ? 'reading' : 'kanji') : sideMode;

      function grade(c, learned) {
        const ch = c.ch;
        c.srs.card = Core.review(c.srs.card, learned, Date.now());
        c.learned = learned;
        App.saveCard(c);
        if (!(ch in first)) { first[ch] = learned; App.logActivity('card', learned); }
        if (!learned && !retried.has(ch)) { retried.add(ch); queue.push(ch); }
        idx++; next();
      }
      function next() {
        keys.clear();
        progI.style.width = (100 * Math.min(idx, queue.length) / Math.max(queue.length, 1)) + '%';
        cnt.textContent = Math.min(idx + 1, queue.length) + ' / ' + queue.length;
        if (idx >= queue.length) return summary();
        const c = S.cards.get(queue[idx]);
        if (!c) { idx++; return next(); }
        body.replaceChildren();
        window.scrollTo(0, 0); entry.el.scrollTop = 0;
        (dirOf(c) === 'reading' && c.strokes) ? showReading(c) : showKanji(c);
      }

      const gradeButtons = c => h('div', {},
        h('div', { class: 'grade' },
          h('button', { class: 'btn danger', onclick: () => grade(c, false) }, 'Не знаю'),
          h('button', { class: 'btn green', onclick: () => grade(c, true) }, 'Выучено')),
        h('div', { class: 'kbd-hint', html: '<kbd>1</kbd> или <kbd>←</kbd> не знаю · <kbd>2</kbd> или <kbd>→</kbd> выучено' }));
      const gradeKeys = c => e => {
        if (typing(e) || e.ctrlKey || e.metaKey) return;
        if (e.key === '1' || e.key === 'ArrowLeft') { e.preventDefault(); grade(c, false); }
        else if (e.key === '2' || e.key === 'ArrowRight') { e.preventDefault(); grade(c, true); }
      };
      const readingsBlock = c => h('div', { class: 'fc-info' },
        c.on.length ? h('div', { style: 'margin:6px 0' }, h('h4', { style: 'margin:0 0 4px;font-size:13px;color:var(--pink-d)' }, 'Онные чтения *'), h('div', { class: 'rlist' }, c.on.map(r => App.readingChip(r, 'on')))) : null,
        c.kun.length ? h('div', { style: 'margin:6px 0' }, h('h4', { style: 'margin:0 0 4px;font-size:13px;color:var(--pink-d)' }, 'Кунные чтения **'), h('div', { class: 'rlist' }, c.kun.map(r => App.readingChip(r, 'kun')))) : null);

      /* Лицо: кандзи → оборот: чтения, значение, порядок черт */
      function showKanji(c) {
        const stage = h('div'), actions = h('div');
        function front() {
          stage.replaceChildren(h('div', { class: 'fcard tap', onclick: back },
            h('div', { class: 'side' }, 'Лицевая сторона'),
            h('div', { class: 'face-ch', lang: 'ja', style: 'font-family:var(--' + S.settings.font + ')' }, c.ch),
            h('div', { class: 'muted' }, 'Вспомните чтения и значение')));
          actions.replaceChildren(h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: back }, 'Перевернуть')),
            h('div', { class: 'kbd-hint', html: '<kbd>Пробел</kbd> или <kbd>Enter</kbd> перевернуть' }));
          keys.set(e => { if (typing(e) || onButton(e)) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); } });
        }
        function back() {
          stage.replaceChildren(h('div', { class: 'fcard' },
            h('div', { class: 'side' }, 'Оборотная сторона'),
            h('div', { class: 'jp', lang: 'ja', style: 'font-size:54px;line-height:1.1;font-family:var(--' + S.settings.font + ')' }, c.ch),
            h('div', { style: 'font-size:19px' }, App.meaning(c) || ''),
            readingsBlock(c), miniPlayer(c)));
          actions.replaceChildren(gradeButtons(c));
          keys.set(gradeKeys(c));
        }
        body.append(stage, actions);
        front();
      }

      /* Лицо: чтения и значение → нужно написать кандзи, проверить, перевернуть */
      function showReading(c) {
        const refD = c.strokes.map(s => s.d);
        const pad = makePad(refD);
        const fb = h('div'), answer = h('div'), actions = h('div', { class: 'actions' });
        let checked = false, revealed = false;
        const front = h('div', { class: 'fcard', style: 'min-height:0;padding:16px' },
          h('div', { class: 'side' }, 'Лицевая сторона'),
          h('div', { style: 'font-size:20px' }, App.meaning(c) || '—'),
          readingsBlock(c),
          h('div', { class: 'muted', style: 'font-size:13px' }, c.strokes.length + ' ' + App.plural(c.strokes.length, 'черта', 'черты', 'черт') + '. Напишите кандзи на холсте.'));

        function toolbar() {
          actions.replaceChildren(
            h('div', { class: 'actions', style: 'margin:0 0 8px' },
              h('button', { class: 'btn ghost small', title: 'Ctrl+Z', onclick: () => pad.undo() }, '↶ Отменить черту'),
              h('button', { class: 'btn ghost small', title: 'Ctrl+Y', onclick: () => pad.redo() }, '↷ Вернуть'),
              h('button', { class: 'btn ghost small', onclick: () => pad.clear() }, 'Очистить'),
              h('button', { class: 'btn green small', onclick: () => pad.hint() }, 'Подсказка')),
            h('div', { class: 'actions', style: 'margin:0' },
              h('button', { class: 'btn primary', onclick: () => reveal(true) }, 'Проверить и перевернуть'),
              h('button', { class: 'btn ghost', onclick: () => reveal(false) }, 'Показать ответ')));
        }
        function reveal(withCheck) {
          if (revealed) return;
          if (withCheck) {
            const strokes = pad.strokes();
            if (!strokes.length) { App.toast('Сначала напишите кандзи или нажмите «Показать ответ»'); return; }
            const res = Core.compare(strokes, refD, TOL[S.settings.strict] || 15);
            pad.showResult(res); checked = true;
            fb.replaceChildren(resultBox(describeResult(res)));
          }
          revealed = true;
          answer.replaceChildren(h('div', { class: 'fcard' },
            h('div', { class: 'side' }, 'Оборотная сторона'),
            h('div', { class: 'face-ch', lang: 'ja', style: 'font-family:var(--' + S.settings.font + ')' }, c.ch),
            miniPlayer(c)));
          actions.replaceChildren(gradeButtons(c));
          keys.set(gradeKeys(c));
          setTimeout(() => answer.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
        }
        toolbar();
        keys.set(e => {
          if (typing(e)) return;
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); pad.undo(); }
          else if (mod && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); pad.redo(); }
          else if (!mod && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); pad.undo(); }
          else if (e.key === 'Enter' && !onButton(e)) { e.preventDefault(); reveal(pad.strokes().length > 0); }
        });
        body.append(front, h('div', { class: 'pad-wrap' }, pad.el), fb, answer, actions,
          h('div', { class: 'kbd-hint', html: KBD_HINT + ' · <kbd>Enter</kbd> проверить и перевернуть' }));
        pad.mount();
      }

      next();
      function summary() {
        keys.clear();
        body.replaceChildren();
        cnt.textContent = '';
        const all = Object.keys(first);
        const learned = all.filter(k => first[k]).length;
        const unknown = all.filter(k => !first[k]);
        body.append(
          h('div', { class: 'score' }, `${learned} из ${all.length}`),
          h('div', { class: 'q-hint' }, 'выучено с первого раза'),
          streakLine(),
          unknown.length ? h('div', { class: 'card' }, h('h3', {}, 'Отмечено «не знаю»'),
            h('div', { class: 'sum-list' }, unknown.map(ch => h('button', { class: 'tile', onclick: () => App.openDetail(ch) }, h('div', { class: 'ch', lang: 'ja' }, ch)))),
            h('p', { class: 'muted', style: 'font-size:13px;margin:10px 0 0' }, 'Эти карточки можно позже повторить отдельно: колода «Только «не знаю»».'))
            : h('div', { class: 'result good', style: 'text-align:center' }, 'Все карточки выучены. Так держать!'),
          h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: App.closeScreen }, 'Готово')));
      }
    });
  }

  /* ---------- Холст для письма ---------- */
  function makePad(refD) {
    const cv = h('canvas', { class: 'pad', 'aria-label': 'Холст для письма' });
    const ctx = cv.getContext('2d');
    let size = 300, dpr = 1, strokes = [], redoStack = [], cur = null, locked = false, hintIdx = -1, hintTimer = null, result = null;
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const paths = refD.map(d => new Path2D(d));

    function layout() {
      const w = cv.clientWidth || 300;
      dpr = window.devicePixelRatio || 1;
      size = w;
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
      redraw();
    }
    function line(a, b, c2, d) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); }
    function poly(pts, color, width, alpha) {
      if (!pts.length) return;
      ctx.save(); ctx.scale(size / 109, size / 109);
      ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, width / 2, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); }
      ctx.restore();
    }
    function refStroke(i, color, width, alpha, dash) {
      ctx.save(); ctx.scale(size / 109, size / 109);
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash([3, 3]);
      ctx.stroke(paths[i]); ctx.restore();
    }
    function redraw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      line(size / 2, 0, size / 2, size); line(0, size / 2, size, size / 2);
      ctx.setLineDash([]);
      const ink = css('--ink'), good = css('--green-d'), bad = css('--pink-d');
      if (result) {
        paths.forEach((_, i) => refStroke(i, good, 3.6, .38));
        result.norm.forEach((st, i) => {
          const s = result.strokes[i];
          poly(st, !s || s.status === 'ok' ? good : bad, 2.4, 1);
        });
        return;
      }
      if (hintIdx >= 0 && hintIdx < paths.length) refStroke(hintIdx, good, 3.6, .75, true);
      strokes.forEach(s => poly(s, ink, 3.2, 1));
    }
    function pt(e) {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 109, y: (e.clientY - r.top) / r.height * 109 };
    }
    cv.addEventListener('pointerdown', e => {
      if (locked) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      cur = [pt(e)]; strokes.push(cur); redoStack = []; hintIdx = -1; redraw();
    });
    cv.addEventListener('pointermove', e => {
      if (!cur) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (evs.length ? evs : [e]).forEach(ev => cur.push(pt(ev)));
      redraw();
    });
    const end = () => {
      if (!cur) return;
      if (Core.pathLength(cur) < 2.5 && cur.length < 3) strokes.pop();
      cur = null; redraw();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', e => e.preventDefault());

    return {
      el: cv,
      mount() {
        requestAnimationFrame(layout);
        if (window.ResizeObserver) new ResizeObserver(() => { if (cv.clientWidth && cv.clientWidth !== size) layout(); }).observe(cv);
      },
      strokes: () => strokes.filter(s => s.length),
      undo() { if (!locked && strokes.length) { redoStack.push(strokes.pop()); redraw(); } },
      redo() { if (!locked && redoStack.length) { strokes.push(redoStack.pop()); redraw(); } },
      clear() { if (!locked) { strokes = []; redoStack = []; hintIdx = -1; redraw(); } },
      hint() {
        if (locked) return;
        hintIdx = Math.min(strokes.length, paths.length - 1);
        redraw();
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => { hintIdx = -1; redraw(); }, 2200);
      },
      showResult(res) { locked = true; result = res; redraw(); },
      unlock() { locked = false; result = null; strokes = []; redoStack = []; hintIdx = -1; redraw(); },
      _debug: () => ({ strokes, size })
    };
  }
  App.makePad = makePad;
})();
