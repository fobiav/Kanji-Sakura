/* Вкладка «Статистика»: стрик-цветок сакуры, календарь, итоги, прогресс по уровням, сложные кандзи */
(function () {
  'use strict';
  const { h, S, LEVELS, LOGO } = App;

  const MODE_NAMES = { on: 'Чтение: онное', kun: 'Чтение: кунное', write: 'Письмо', card: 'Карточки' };
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const pl = (n, a, b, c) => App.plural(n, a, b, c);

  /* Цветок сакуры: full — расцвёл (сегодня занимались), pale — ждёт (серия жива, но сегодня ещё нет), none — бутона нет. */
  const PETALS = [0, 72, 144, 216, 288].map(a => `<ellipse cx="20" cy="10" rx="6.2" ry="9.4" transform="rotate(${a} 20 20)"/>`).join('');
  function flowerSvg(state) {
    if (state === 'full') {
      return `<svg viewBox="0 0 40 40" aria-hidden="true"><g style="fill:var(--pink)">${PETALS}</g>
        <g style="fill:var(--pink-soft);opacity:.85" transform="translate(20 20) scale(.5) translate(-20 -20)">${PETALS}</g>
        <circle cx="20" cy="20" r="4.4" style="fill:var(--pink-d)"/>
        <g style="fill:var(--green-d)"><circle cx="20" cy="13.6" r="1.1"/><circle cx="26.1" cy="18" r="1.1"/><circle cx="23.8" cy="25.2" r="1.1"/><circle cx="16.2" cy="25.2" r="1.1"/><circle cx="13.9" cy="18" r="1.1"/></g></svg>`;
    }
    if (state === 'pale') {
      return `<svg viewBox="0 0 40 40" aria-hidden="true"><g style="fill:var(--pink-soft);stroke:var(--pink);stroke-width:.9;stroke-dasharray:2.2 1.6">${PETALS}</g>
        <circle cx="20" cy="20" r="3.4" style="fill:var(--bg2);stroke:var(--pink);stroke-width:.8"/></svg>`;
    }
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><g style="fill:none;stroke:var(--line);stroke-width:1.1;stroke-dasharray:2 2">${PETALS}</g></svg>`;
  }
  App.flowerSvg = flowerSvg;

  const fmtDay = key => { const [y, m, d] = key.split('-').map(Number); return d + ' ' + MONTHS[m - 1]; };
  const wdOf = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

  App.buildStats = function (main) {
    const days = S.stats.days || {};
    const today = Core.dayKey();
    const st = Core.streak(days, today);
    const best = Math.max(Core.bestStreak(days), st.current);
    const dayN = k => (days[k] && days[k].n) || 0;
    const dayOk = k => (days[k] && days[k].ok) || 0;

    main.append(h('header', { class: 'top' }, h('div', { class: 'brand', html: LOGO }, h('div', {}, h('h1', {}, 'Статистика'), h('small', {}, 'ваша серия и прогресс')))));

    /* --- Серия --- */
    const state = st.doneToday ? 'full' : (st.current > 0 ? 'pale' : 'none');
    const week = h('div', { class: 'week' });
    for (let i = 6; i >= 0; i--) {
      const k = Core.shiftDay(today, -i);
      const on = dayN(k) > 0;
      week.append(h('div', { title: fmtDay(k) + (on ? ': занимались' : ': без занятий') },
        h('div', { class: 'd' + (i === 0 ? ' today' : '') }, i === 0 ? 'сегодня' : WD[wdOf(k)]),
        h('span', { html: flowerSvg(on ? 'full' : (i === 0 && st.current > 0 ? 'pale' : 'none')), style: 'display:block' })));
    }
    main.append(h('div', { class: 'card' },
      h('div', { class: 'streak' },
        h('div', { class: 'flower', html: flowerSvg(state), role: 'img', 'aria-label': 'Цветок сакуры: ' + (state === 'full' ? 'расцвёл' : state === 'pale' ? 'ждёт занятия' : 'серии пока нет') }),
        h('div', {},
          h('div', { class: 'num' }, st.current),
          h('div', { class: 'lbl' }, pl(st.current, 'день', 'дня', 'дней') + ' подряд'),
          h('div', { class: 'sub' }, st.doneToday ? 'Сегодня уже занимались: цветок расцвёл.'
            : st.current > 0 ? 'Позанимайтесь сегодня, чтобы серия продолжилась. Цветок ждёт.'
              : 'Начните серию: достаточно одного занятия в день.'),
          h('div', { class: 'sub', style: 'margin-top:2px' }, 'Лучшая серия: ' + best + ' ' + pl(best, 'день', 'дня', 'дней')))),
      week));

    /* --- Итоги --- */
    let all = 0, allOk = 0, week7 = 0;
    Object.keys(days).forEach(k => { all += days[k].n; allOk += days[k].ok; });
    for (let i = 0; i < 7; i++) week7 += dayN(Core.shiftDay(today, -i));
    const pct = (ok, n) => n ? Math.round(100 * ok / n) + '%' : '—';
    const tile = (v, label) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, label));
    main.append(h('div', { class: 'card' }, h('h3', {}, 'Итоги'),
      h('div', { class: 'stat-grid' },
        tile(dayN(today), 'ответов сегодня' + (dayN(today) ? ', верных ' + pct(dayOk(today), dayN(today)) : '')),
        tile(week7, 'ответов за 7 дней'),
        tile(all, 'ответов за всё время'),
        tile(pct(allOk, all), 'доля верных ответов'))));

    /* --- Ответы по дням (14 дней) --- */
    const span = 14, vals = [];
    for (let i = span - 1; i >= 0; i--) { const k = Core.shiftDay(today, -i); vals.push([k, dayN(k)]); }
    const max = Math.max(1, ...vals.map(v => v[1]));
    main.append(h('div', { class: 'card' }, h('h3', {}, 'Ответы по дням'),
      all ? h('div', { class: 'bars', role: 'img', 'aria-label': 'Ответов в день за последние две недели' }, vals.map(([k, n], i) =>
        h('div', { class: 'b' + (i === span - 1 ? ' today' : ''), title: fmtDay(k) + ': ' + n },
          h('em', {}, n || ''), h('i', { style: 'height:' + Math.max(3, Math.round(n / max * 100)) + '%' }), h('span', {}, k.slice(8)))))
        : h('p', { class: 'muted', style: 'margin:0' }, 'Здесь появится график, когда вы позанимаетесь.')));

    /* --- Календарь: 5 недель --- */
    const dow = (wdOf(today) + 6) % 7;
    const start = Core.shiftDay(today, -(dow + 28));
    const cal = h('div', { class: 'cal' });
    for (let i = 0; i < 35; i++) {
      const k = Core.shiftDay(start, i);
      const future = k > today, on = dayN(k) > 0;
      cal.append(h('div', { class: 'c' + (on ? ' on' : '') + (k === today ? ' today' : '') + (future ? ' future' : ''), title: fmtDay(k) + (on ? ': ответов ' + dayN(k) : '') },
        on ? h('span', { html: flowerSvg('full'), style: 'display:contents' }) : k.slice(8).replace(/^0/, '')));
    }
    main.append(h('div', { class: 'card' }, h('h3', {}, 'Календарь занятий'),
      h('div', { class: 'cal-head' }, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => h('span', {}, d))), cal,
      h('p', { class: 'muted', style: 'font-size:12.5px;margin:10px 0 0' }, 'Цветок — день, в который вы занимались.')));

    /* --- Режимы --- */
    const byMode = {};
    Object.keys(days).forEach(k => { const m = days[k].m || {}; Object.keys(m).forEach(mk => { const o = byMode[mk] || (byMode[mk] = { n: 0, ok: 0 }); o.n += m[mk].n; o.ok += m[mk].ok; }); });
    const modeRows = Object.keys(MODE_NAMES).filter(m => byMode[m]);
    if (modeRows.length) {
      main.append(h('div', { class: 'card' }, h('h3', {}, 'По режимам'),
        modeRows.map(m => h('div', { class: 'row' }, h('span', { class: 't' }, MODE_NAMES[m], h('small', {}, byMode[m].n + ' ' + pl(byMode[m].n, 'ответ', 'ответа', 'ответов'))),
          h('b', {}, pct(byMode[m].ok, byMode[m].n))))));
    }

    /* --- Кандзи и прогресс по уровням --- */
    const cards = Array.from(S.cards.values());
    const nStudy = cards.filter(c => c.study).length, nLearned = cards.filter(c => c.learned).length;
    const now = Date.now();
    const nDue = cards.filter(c => c.study && ['on', 'kun', 'write'].some(m => c.srs[m] && c.srs[m].due <= now)).length;
    const levelRows = LEVELS.concat(['']).map(l => {
      const list = cards.filter(c => (c.level || '') === l);
      return { l, total: list.length, learned: list.filter(c => c.learned).length, study: list.filter(c => c.study && !c.learned).length };
    }).filter(r => r.total);
    main.append(h('div', { class: 'card' }, h('h3', {}, 'Кандзи'),
      h('div', { class: 'stat-grid' }, tile(cards.length, 'в справочнике'), tile(nStudy, 'в заучивании'), tile(nLearned, 'выучено'), tile(nDue, 'ждут повторения')),
      levelRows.length ? h('div', { style: 'margin-top:14px' },
        levelRows.map(r => h('div', { class: 'lv-row' }, h('b', {}, r.l || 'Без ур.'),
          h('div', { class: 'lvbar', role: 'img', 'aria-label': `${r.learned} выучено, ${r.study} в заучивании, из ${r.total}` },
            h('i', { class: 'l', style: 'width:' + (100 * r.learned / r.total) + '%' }), h('i', { class: 'k', style: 'width:' + (100 * r.study / r.total) + '%' })),
          h('span', { class: 'muted' }, `${r.learned} / ${r.total}`))),
        h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:var(--green-d)' }), 'выучено'), h('span', {}, h('i', { style: 'background:var(--pink)' }), 'в заучивании')))
        : null));

    /* --- Сложные кандзи --- */
    const hard = cards.map(c => {
      let n = 0, right = 0;
      ['on', 'kun', 'write', 'card'].forEach(m => { const s = c.srs[m]; if (s && s.n) { n += s.n; right += s.right || 0; } });
      return { c, n, wrong: n - right };
    }).filter(x => x.n >= 2 && x.wrong >= 2).sort((a, b) => (b.wrong - a.wrong) || (a.c.order - b.c.order)).slice(0, 8);
    main.append(h('div', { class: 'card' }, h('h3', {}, 'Сложные кандзи'),
      hard.length ? h('div', { class: 'hard' }, hard.map(x => h('button', { class: 'tile', onclick: () => App.openDetail(x.c.ch) },
        h('div', { class: 'ch', lang: 'ja' }, x.c.ch), h('div', { class: 'mn' }, 'ошибок: ' + x.wrong))))
        : h('p', { class: 'muted', style: 'margin:0' }, 'Здесь будут кандзи, в которых вы чаще всего ошибаетесь. Пока данных мало.')));
  };
})();
