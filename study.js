/* Вкладка «Учить»: чтение (он / кун), письмо на холсте, интервальное повторение */
(function () {
  'use strict';
  const { h, S, ICON, LEVELS, LOGO } = App;

  const MODES = [
    { id: 'on', title: 'Чтение: онное', sub: 'Вспомнить онные (китайские) чтения', ic: '音', cls: '' },
    { id: 'kun', title: 'Чтение: кунное', sub: 'Вспомнить кунные (японские) чтения', ic: '訓', cls: 'g' },
    { id: 'write', title: 'Письмо', sub: 'Написать кандзи на холсте по значению и чтению', ic: '書', cls: '' }
  ];
  const TOL = { soft: 22, medium: 15, strict: 10 };
  const filt = { level: '', cat: '' };

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hasData = (c, mode) => mode === 'write' ? !!c.strokes : Core.acceptedReadings(mode === 'on' ? c.on : c.kun, mode).size > 0;
  function pool(mode) {
    const out = [];
    S.cards.forEach(c => {
      if (!c.study) return;
      if (filt.level && c.level !== filt.level) return;
      if (filt.cat && !c.cats.includes(filt.cat)) return;
      if (hasData(c, mode)) out.push(c);
    });
    return out;
  }
  const dueOf = (list, mode) => list.filter(c => Core.isDue(c.srs[mode], Date.now()));

  /* ---------- Вкладка ---------- */
  App.buildStudy = function (main) {
    const box = h('div');
    main.append(
      h('header', { class: 'top' }, h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Учить'), h('small', {}, 'флэш-карты из вашего справочника')))),
      box);
    draw();

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
        h('div', { class: 'chips' }, mk('Все уровни', !filt.level, () => { filt.level = ''; draw(); }), ...LEVELS.map(l => mk(l, filt.level === l, () => { filt.level = filt.level === l ? '' : l; draw(); }))),
        S.cats.length ? h('div', { class: 'chips' }, ...S.cats.map(k => mk(k.name, filt.cat === k.id, () => { filt.cat = filt.cat === k.id ? '' : k.id; draw(); }, 'g'))) : null,
        h('div', { class: 'row', style: 'margin:4px 0 8px;border:0' }, h('span', { class: 't' }, 'Только к повторению', h('small', {}, 'Остальное подождёт своего срока')),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: S.settings.onlyDue, onchange: e => { S.settings.onlyDue = e.target.checked; DB.kvSet('settings', S.settings); draw(); } }))),
        h('div', { class: 'modes' }, MODES.map(m => {
          const all = pool(m.id), due = dueOf(all, m.id).length;
          return h('button', { class: 'mode ' + m.cls, disabled: all.length ? null : true, onclick: () => start(m.id) },
            h('span', { class: 'ic jp', lang: 'ja' }, m.ic),
            h('span', { class: 'tx' }, h('b', {}, m.title), h('span', {}, all.length ? `${m.sub}. Карточек: ${all.length}` : 'Нет подходящих карточек (нужны ' + (m.id === 'write' ? 'начертания' : 'чтения') + ')')),
            all.length ? h('span', { class: 'due' + (due ? '' : ' zero') }, due ? due + ' к повтору' : 'всё повторено') : null);
        })),
        h('p', { class: 'muted', style: 'font-size:13px' }, `В заучивании: ${total}. Правильные ответы отодвигают повтор (1, 3, 7, 14, 30, 60 дней), ошибка возвращает карточку в начало.`));
    }

    function start(mode) {
      const all = pool(mode);
      let list = S.settings.onlyDue ? dueOf(all, mode) : all;
      if (!list.length) {
        App.sheet('Всё повторено', h('p', { style: 'margin:4px 0' }, 'Сейчас нет карточек, срок которых подошёл. Позаниматься всё равно?'),
          [{ label: 'Не сейчас', kind: 'ghost' }, { label: 'Позаниматься', kind: 'primary', onClick: () => runSession(mode, shuffle(all).slice(0, S.settings.session).map(c => c.ch)) }]);
        return;
      }
      runSession(mode, shuffle(list).slice(0, S.settings.session).map(c => c.ch));
    }
    App.refreshStudy = draw;
  };

  /* ---------- Сессия ---------- */
  function runSession(mode, ids) {
    const meta = MODES.find(m => m.id === mode);
    App.openScreen((wrap, entry) => {
      const queue = ids.slice();
      const first = {};           // результат с первой попытки: ch -> bool
      const retried = new Set();
      let idx = 0;
      const progI = h('i');
      const cnt = h('span', { class: 'muted', style: 'font-size:14px;min-width:54px;text-align:right' });
      const body = h('div', { class: 'session' });
      wrap.append(h('div', { class: 'bar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Закончить', onclick: App.closeScreen, html: ICON.close }),
        h('div', { class: 'progress pg', style: 'margin:0;flex:1' }, progI), cnt), body);
      entry.onClose = () => { if (App.refreshStudy && S.tab === 'study') App.refreshStudy(); };

      function record(c, ok, prev) {
        c.srs[mode] = Core.review(prev, ok, Date.now());
        App.saveCard(c);
      }
      function advance() { idx++; next(); }
      function next() {
        progI.style.width = (100 * Math.min(idx, queue.length) / Math.max(queue.length, 1)) + '%';
        cnt.textContent = Math.min(idx + 1, queue.length) + ' / ' + queue.length;
        if (idx >= queue.length) return summary();
        const c = S.cards.get(queue[idx]);
        if (!c) return advance();
        body.replaceChildren();
        window.scrollTo(0, 0); entry.el.scrollTop = 0;
        if (mode === 'write') writeCard(c); else readCard(c);
      }
      function onResult(c, ok, prev) {
        const ch = c.ch;
        if (!(ch in first)) first[ch] = ok;
        if (!retried.has(ch)) record(c, ok, prev);
        if (!ok && !retried.has(ch)) { retried.add(ch); queue.push(ch); }
      }

      /* ----- Чтение ----- */
      function readCard(c) {
        const kind = mode;
        const prev = c.srs[mode];
        const accepted = Core.acceptedReadings(kind === 'on' ? c.on : c.kun, kind);
        const inp = h('input', { class: 'field ans-input', type: 'text', lang: 'ja', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'ответ (кана или ромадзи)', enterkeyhint: 'done' });
        const prevKana = h('div', { class: 'kana-prev', lang: 'ja' });
        const resBox = h('div');
        const actions = h('div', { class: 'actions' });
        let answered = false, firstTry = !(c.ch in first);

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
            !ok ? h('button', { class: 'btn green', onclick: () => { onResultOverride(); } }, 'Засчитать как верно') : null,
            h('button', { class: 'btn primary', onclick: advance }, 'Дальше'));
          actions.querySelector('.btn.primary').focus();
        }
        function onResultOverride() {
          // пересчитать как верный ответ, если это была первая попытка
          if (firstTry) {
            first[c.ch] = true;
            c.srs[mode] = Core.review(prev, true, Date.now()); App.saveCard(c);
            const k = queue.lastIndexOf(c.ch); if (k > idx) queue.splice(k, 1);
            retried.delete(c.ch);
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
        const firstTry = !(c.ch in first);
        let recorded = false, checked = false;
        const pad = makePad(refD);
        const fb = h('div');
        const actions = h('div', { class: 'actions' });
        const btnCheck = h('button', { class: 'btn primary', onclick: check }, 'Проверить');

        function renderActions() {
          actions.replaceChildren();
          if (!checked) {
            actions.append(
              h('button', { class: 'btn ghost small', onclick: () => pad.undo() }, '↶ Отменить черту'),
              h('button', { class: 'btn ghost small', onclick: () => pad.clear() }, 'Очистить'),
              h('button', { class: 'btn green small', onclick: () => pad.hint() }, 'Подсказка'),
              btnCheck);
          }
        }
        function check() {
          const strokes = pad.strokes();
          if (!strokes.length) { App.toast('Сначала напишите кандзи на холсте'); return; }
          const res = Core.compare(strokes, refD, TOL[S.settings.strict] || 15);
          checked = true; pad.showResult(res);
          const lines = [];
          if (!res.countOk) lines.push(`Черт нарисовано: ${res.userCount}, а в этом кандзи их ${res.refCount}. Одна непрерывная линия пальцем (или мышью) — одна черта.`);
          else res.strokes.forEach((s, i) => {
            if (s.status === 'reversed') lines.push(`Черта ${i + 1}: проведена в обратную сторону.`);
            else if (s.status === 'order') lines.push(`Черта ${i + 1}: здесь нарисована черта, которая идёт под номером ${s.other + 1}. Проверьте порядок.`);
            else if (s.status === 'shape') lines.push(`Черта ${i + 1}: форма или положение заметно отличаются от образца.`);
          });
          const ok = res.ok;
          if (firstTry && !recorded) { recorded = true; onResult(c, ok, prev); }
          fb.replaceChildren(h('div', { class: 'result ' + (ok ? 'good' : 'bad') },
            h('b', {}, ok ? `Отлично! Все черты верны (точность ${res.score}%).` : (res.countOk ? `Есть неточности (точность ${res.score}%).` : 'Число черт не совпало.')),
            lines.length ? h('ul', { class: 'fb' }, lines.map(l => h('li', {}, l))) : null,
            h('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Зелёное — образец, ваши черты наложены на него: розовые — неверные.')));
          actions.replaceChildren(
            !ok ? h('button', { class: 'btn', onclick: () => { checked = false; fb.replaceChildren(); pad.unlock(); renderActions(); } }, 'Попробовать ещё раз') : null,
            !ok ? h('button', { class: 'btn ghost', onclick: () => App.openDetail(c.ch) }, 'Смотреть порядок черт') : null,
            !ok && firstTry && recorded ? h('button', { class: 'btn green', onclick: () => {
              first[c.ch] = true; c.srs.write = Core.review(prev, true, Date.now()); App.saveCard(c);
              const k = queue.lastIndexOf(c.ch); if (k > idx) queue.splice(k, 1);
              retried.delete(c.ch); App.toast('Засчитано'); advance(); } }, 'Засчитать как верно') : null,
            h('button', { class: 'btn primary', onclick: advance }, 'Дальше'));
        }
        renderActions();

        const readings = [].concat(c.on.map(r => r), c.kun.map(r => r)).map(r => r.replace(/[（(][^）)]*[）)]/g, '').replace(/[.\-]/g, '')).filter(Boolean);
        body.append(
          h('div', { class: 'q-label' }, 'Напишите кандзи'),
          h('div', { class: 'q-hint', style: 'font-size:18px;color:var(--ink)' }, App.meaning(c) || '—'),
          readings.length ? h('div', { class: 'q-hint', lang: 'ja', style: 'margin-top:-6px' }, readings.slice(0, 6).join(' · ')) : null,
          h('div', { class: 'q-hint', style: 'margin-top:-6px;font-size:13px' }, c.strokes.length + ' ' + App.plural(c.strokes.length, 'черта', 'черты', 'черт')),
          h('div', { class: 'pad-wrap' }, pad.el), fb, actions);
        pad.mount();
      }

      next();
      /* ----- Итоги ----- */
      function summary() {
        body.replaceChildren();
        const keys = Object.keys(first);
        const good = keys.filter(k => first[k]).length;
        const bad = keys.filter(k => !first[k]);
        const pct = keys.length ? Math.round(100 * good / keys.length) : 0;
        cnt.textContent = '';
        body.append(
          h('div', { class: 'score' }, `${good} из ${keys.length}`),
          h('div', { class: 'q-hint' }, meta.title + ' · с первого раза ' + pct + '%'),
          bad.length ? h('div', { class: 'card' }, h('h3', {}, 'Стоит повторить'),
            h('div', { class: 'sum-list' }, bad.map(ch => h('button', { class: 'tile', onclick: () => App.openDetail(ch) }, h('div', { class: 'ch', lang: 'ja' }, ch)))))
            : h('div', { class: 'result good', style: 'text-align:center' }, 'Без ошибок. Так держать!'),
          h('div', { class: 'actions' },
            h('button', { class: 'btn primary', onclick: App.closeScreen }, 'Готово')));
      }
    });
  }

  /* ---------- Холст для письма ---------- */
  function makePad(refD) {
    const cv = h('canvas', { class: 'pad', 'aria-label': 'Холст для письма' });
    const ctx = cv.getContext('2d');
    let size = 300, dpr = 1, strokes = [], cur = null, locked = false, hintIdx = -1, hintTimer = null, result = null;
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
      cur = [pt(e)]; strokes.push(cur); hintIdx = -1; redraw();
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
      undo() { if (!locked) { strokes.pop(); redraw(); } },
      clear() { if (!locked) { strokes = []; hintIdx = -1; redraw(); } },
      hint() {
        if (locked) return;
        hintIdx = Math.min(strokes.length, paths.length - 1);
        redraw();
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => { hintIdx = -1; redraw(); }, 2200);
      },
      showResult(res) { locked = true; result = res; redraw(); },
      unlock() { locked = false; result = null; strokes = []; hintIdx = -1; redraw(); },
      _debug: () => ({ strokes, size })
    };
  }
  App.makePad = makePad;
})();
