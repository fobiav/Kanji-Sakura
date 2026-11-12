/* Ядро приложения: геометрия черт, проверка письма, кана, фуригана, интервальное повторение.
   Не зависит от DOM, поэтому тестируется в node. */
(function (root) {
  'use strict';

  /* ---------- Утилиты ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const KANJI_RE = /[㐀-䶿一-鿿豈-﫿]/;
  function isKanji(ch) { return KANJI_RE.test(ch); }
  function kanjiList(text) {
    const seen = new Set(), out = [];
    for (const ch of Array.from(String(text || ''))) {
      if (isKanji(ch) && !seen.has(ch)) { seen.add(ch); out.push(ch); }
    }
    return out;
  }

  /* ---------- Геометрия путей SVG ---------- */
  const TOKENS = /[MmLlHhVvCcSsQqTtZzAa]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

  function flatten(d) {
    const t = String(d).match(TOKENS) || [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
    const pts = [];
    const num = () => parseFloat(t[i++]);
    const isCmd = s => /^[A-Za-z]$/.test(s);
    const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
      for (let k = 1; k <= 16; k++) {
        const u = k / 16, v = 1 - u;
        pts.push({
          x: v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
          y: v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3
        });
      }
    };
    const quad = (x0, y0, x1, y1, x2, y2) => {
      for (let k = 1; k <= 12; k++) {
        const u = k / 12, v = 1 - u;
        pts.push({ x: v * v * x0 + 2 * v * u * x1 + u * u * x2, y: v * v * y0 + 2 * v * u * y1 + u * u * y2 });
      }
    };
    while (i < t.length) {
      if (isCmd(t[i])) {
        cmd = t[i++];
        if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; pts.push({ x, y }); lc = lq = null; continue; }
      } else if (cmd === 'M') cmd = 'L';
      else if (cmd === 'm') cmd = 'l';
      if (!cmd) break;
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      let ok = true;
      switch (C) {
        case 'M': x = ox + num(); y = oy + num(); sx = x; sy = y; pts.push({ x, y }); lc = lq = null; break;
        case 'L': x = ox + num(); y = oy + num(); pts.push({ x, y }); lc = lq = null; break;
        case 'H': x = ox + num(); pts.push({ x, y }); lc = lq = null; break;
        case 'V': y = oy + num(); pts.push({ x, y }); lc = lq = null; break;
        case 'C': {
          const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
          cubic(x, y, x1, y1, x2, y2, ex, ey); lc = [x2, y2]; lq = null; x = ex; y = ey; break;
        }
        case 'S': {
          const x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
          const x1 = lc ? 2 * x - lc[0] : x, y1 = lc ? 2 * y - lc[1] : y;
          cubic(x, y, x1, y1, x2, y2, ex, ey); lc = [x2, y2]; lq = null; x = ex; y = ey; break;
        }
        case 'Q': {
          const x1 = ox + num(), y1 = oy + num(), ex = ox + num(), ey = oy + num();
          quad(x, y, x1, y1, ex, ey); lq = [x1, y1]; lc = null; x = ex; y = ey; break;
        }
        case 'T': {
          const ex = ox + num(), ey = oy + num();
          const x1 = lq ? 2 * x - lq[0] : x, y1 = lq ? 2 * y - lq[1] : y;
          quad(x, y, x1, y1, ex, ey); lq = [x1, y1]; lc = null; x = ex; y = ey; break;
        }
        case 'A': {
          i += 5; x = ox + num(); y = oy + num(); pts.push({ x, y }); lc = lq = null; break;
        }
        default: ok = false;
      }
      if (!ok || !isFinite(x) || !isFinite(y)) break;
    }
    return pts;
  }

  function strokeStart(d) {
    const m = /[Mm]\s*([-+]?(?:\d+\.?\d*|\.\d+))[\s,]*([-+]?(?:\d+\.?\d*|\.\d+))/.exec(d);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function pathLength(pts) {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return L;
  }

  function resample(pts, n) {
    if (!pts.length) return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
    const total = cum[cum.length - 1];
    if (total < 1e-9) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
    const out = [];
    let seg = 1;
    for (let k = 0; k < n; k++) {
      const target = total * k / (n - 1);
      while (seg < pts.length - 1 && cum[seg] < target) seg++;
      const a = pts[seg - 1], b = pts[seg];
      const span = cum[seg] - cum[seg - 1];
      const u = span < 1e-12 ? 0 : (target - cum[seg - 1]) / span;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
    return out;
  }

  /* ---------- KanjiVG ---------- */
  function parseKanjiVG(svg) {
    const out = [];
    const re = /<path\b[^>]*>/g;
    let m;
    while ((m = re.exec(String(svg)))) {
      const tag = m[0];
      const id = /\bid="([^"]*)"/.exec(tag);
      const d = /\sd="([^"]*)"/.exec(tag);
      if (!id || !d) continue;
      const sm = /-s(\d+)$/.exec(id[1]);
      if (!sm) continue;
      if (!/^[MmLlHhVvCcSsQqTtZz0-9eE.,\s+-]+$/.test(d[1])) continue;
      const ty = /kvg:type="([^"]*)"/.exec(tag);
      out.push({ n: +sm[1], d: d[1].trim().replace(/\s+/g, ' '), t: ty ? ty[1] : '' });
    }
    out.sort((a, b) => a.n - b.n);
    return out.map(s => ({ d: s.d, t: s.t }));
  }

  /* ---------- Проверка письма ---------- */
  const N = 32;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function meanDist(a, b, rev) {
    let s = 0;
    const n = a.length;
    for (let k = 0; k < n; k++) s += dist(a[k], b[rev ? n - 1 - k : k]);
    return s / n;
  }
  function bboxOf(strokes) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of strokes) for (const p of s) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1 };
  }
  function dedupe(pts) {
    const out = [];
    for (const p of pts) {
      const q = out[out.length - 1];
      if (!q || q.x !== p.x || q.y !== p.y) out.push(p);
    }
    return out;
  }

  /* userStrokes: массив массивов {x,y} в системе координат 109×109 (как у KanjiVG).
     refD: массив строк d эталонных черт. tol: допуск среднего расстояния в тех же единицах. */
  function compare(userStrokes, refD, tol) {
    tol = tol || 15;
    const ref = refD.map(d => resample(flatten(d), N));
    const res = { ok: false, countOk: false, userCount: userStrokes.length, refCount: ref.length, strokes: [], norm: [], score: 0 };
    if (!userStrokes.length) return res;
    const U = userStrokes.map(s => resample(dedupe(s), N));
    const rb = bboxOf(ref), ub = bboxOf(U);
    const rs = Math.max(rb.x1 - rb.x0, rb.y1 - rb.y0);
    const us = Math.max(ub.x1 - ub.x0, ub.y1 - ub.y0);
    const k = us > 1e-6 ? rs / us : 1;
    const rc = { x: (rb.x0 + rb.x1) / 2, y: (rb.y0 + rb.y1) / 2 };
    const uc = { x: (ub.x0 + ub.x1) / 2, y: (ub.y0 + ub.y1) / 2 };
    res.norm = U.map(st => st.map(p => ({ x: rc.x + (p.x - uc.x) * k, y: rc.y + (p.y - uc.y) * k })));
    res.scale = k;
    if (U.length !== ref.length) return res;
    res.countOk = true;
    let allOk = true, sum = 0;
    for (let i = 0; i < ref.length; i++) {
      const dF = meanDist(res.norm[i], ref[i], false);
      const dR = meanDist(res.norm[i], ref[i], true);
      let status = 'ok', other = -1;
      if (dF > tol) {
        if (dR <= tol) status = 'reversed';
        else {
          let bd = Infinity;
          for (let j = 0; j < ref.length; j++) {
            if (j === i) continue;
            const d = meanDist(res.norm[i], ref[j], false);
            if (d < bd) { bd = d; other = j; }
          }
          status = bd <= tol ? 'order' : 'shape';
        }
        allOk = false;
      }
      sum += Math.max(0, 1 - dF / (tol * 2.2));
      res.strokes.push({ status, dist: dF, other });
    }
    res.ok = allOk;
    res.score = Math.round(100 * sum / ref.length);
    return res;
  }

  /* ---------- Кана ---------- */
  function kata2hira(s) {
    return String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }
  function hira2kata(s) {
    return String(s).replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  }

  const R2K = {};
  (function build() {
    const add = (k, v) => { R2K[k] = v; };
    const V = 'aiueo';
    const rows = {
      '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの', h: 'はひふへほ',
      m: 'まみむめも', r: 'らりるれろ', g: 'がぎぐげご', z: 'ざじずぜぞ', d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ'
    };
    for (const c in rows) for (let i = 0; i < 5; i++) add(c + V[i], rows[c][i]);
    add('ya', 'や'); add('yu', 'ゆ'); add('yo', 'よ'); add('wa', 'わ'); add('wo', 'を'); add('nn', 'ん');
    add('shi', 'し'); add('chi', 'ち'); add('tsu', 'つ'); add('fu', 'ふ'); add('ji', 'じ'); add('ti', 'ち'); add('tu', 'つ'); add('hu', 'ふ'); add('zi', 'じ');
    add('si', 'し'); add('di', 'ぢ'); add('du', 'づ');
    const y = { ky: 'き', sh: 'し', sy: 'し', ch: 'ち', ty: 'ち', ny: 'に', hy: 'ひ', my: 'み', ry: 'り', gy: 'ぎ', j: 'じ', jy: 'じ', zy: 'じ', by: 'び', py: 'ぴ', dy: 'ぢ' };
    for (const c in y) {
      const base = y[c];
      add(c + 'a', base + 'ゃ'); add(c + 'u', base + 'ゅ'); add(c + 'o', base + 'ょ');
      if (c === 'sh' || c === 'ch' || c === 'j') add(c + 'e', base + 'ぇ');
    }
    add('fa', 'ふぁ'); add('fi', 'ふぃ'); add('fe', 'ふぇ'); add('fo', 'ふぉ');
    add('xa', 'ぁ'); add('xi', 'ぃ'); add('xu', 'ぅ'); add('xe', 'ぇ'); add('xo', 'ぉ');
    add('xya', 'ゃ'); add('xyu', 'ゅ'); add('xyo', 'ょ'); add('xtu', 'っ'); add('xtsu', 'っ'); add('ltu', 'っ'); add('ltsu', 'っ');
    add('la', 'ぁ'); add('li', 'ぃ'); add('lu', 'ぅ'); add('le', 'ぇ'); add('lo', 'ぉ');
  })();

  const VOW = 'aiueo';
  function romajiToHira(input, final) {
    const s = String(input).toLowerCase();
    let out = '', i = 0;
    while (i < s.length) {
      const c = s[i], c2 = s[i + 1];
      if (c === "'" ) { i++; continue; }
      if (c === '-') { out += 'ー'; i++; continue; }
      if (c === 'n') {
        if (c2 === "'" ) { out += 'ん'; i += 2; continue; }
        if (c2 === undefined) { if (final) out += 'ん'; else out += 'n'; i++; continue; }
        if (c2 === 'n') {
          // nn → ん (если дальше не гласная/y), иначе n + na…
          const c3 = s[i + 2];
          if (c3 && (VOW.includes(c3) || c3 === 'y')) { out += 'ん'; i++; continue; }
          out += 'ん'; i += 2; continue;
        }
        if (!VOW.includes(c2) && c2 !== 'y') { out += 'ん'; i++; continue; }
      }
      if (c2 && c === c2 && /[bcdfghjklmpqrstvwxyz]/.test(c) && c !== 'n') { out += 'っ'; i++; continue; }
      let matched = false;
      for (let len = 4; len >= 1; len--) {
        const part = s.substr(i, len);
        if (part.length === len && R2K[part]) { out += R2K[part]; i += len; matched = true; break; }
      }
      if (matched) continue;
      out += s[i]; i++;
    }
    return out;
  }

  function normReading(s) {
    return kata2hira(String(s).toLowerCase())
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/[.\-・･\s'’、,;；/]/g, '');
  }

  /* Допустимые ответы для чтения. kind: 'on' | 'kun' */
  function acceptedReadings(list, kind) {
    const set = new Set();
    for (const raw of list || []) {
      const r = String(raw).replace(/[（(][^）)]*[）)]/g, '').trim();
      if (!r) continue;
      set.add(normReading(r));
      if (kind === 'kun' && r.includes('.')) set.add(normReading(r.split('.')[0]));
    }
    set.delete('');
    return set;
  }

  /* ---------- Фуригана ---------- */
  const KJ = '㐀-䶿一-鿿豈-﫿々〆ヶ';
  function furigana(text) {
    const src = String(text == null ? '' : text);
    const re = new RegExp('([' + KJ + ']+)\\[([^\\]]+)\\]', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)) + '<ruby>' + esc(m[1]) + '<rt>' + esc(m[2]) + '</rt></ruby>';
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    return '<span lang="ja">' + out + '</span>';
  }
  function wordRuby(w, r) {
    const has = new RegExp('[' + KJ + ']').test(w || '');
    if (has && r) return '<span lang="ja"><ruby>' + esc(w) + '<rt>' + esc(r) + '</rt></ruby></span>';
    return '<span lang="ja">' + esc(w) + '</span>';
  }

  /* ---------- Интервальное повторение ---------- */
  const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30, 60];
  function isDue(state, now) { return !state || state.due <= now; }
  /* Счётчики ответов. У состояний из версии 1.1 их не было: последний результат (ok) считаем одним ответом. */
  function counts(state) {
    if (!state) return { n: 0, right: 0 };
    if (typeof state.n === 'number') return { n: state.n, right: Math.min(state.right || 0, state.n) };
    return state.last ? { n: 1, right: state.ok ? 1 : 0 } : { n: 0, right: 0 };
  }
  function review(state, correct, now) {
    const box = correct ? Math.min((state ? state.box : 0) + 1, INTERVALS_DAYS.length - 1) : 0;
    const c = counts(state);
    return {
      box, due: now + INTERVALS_DAYS[box] * 86400000, last: now, ok: correct ? 1 : 0,
      n: c.n + 1, right: c.right + (correct ? 1 : 0)
    };
  }

  /* ---------- Дни занятий и серия (стрик) ---------- */
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function shiftDay(key, delta) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + delta, 12));
  }
  const active = (days, k) => !!(days && days[k] && days[k].n > 0);
  /* current — длина серии; если сегодня ещё не занимались, серия не сгорает до конца дня. */
  function streak(days, today) {
    today = today || dayKey();
    const doneToday = active(days, today);
    let k = doneToday ? today : shiftDay(today, -1), n = 0;
    while (active(days, k)) { n++; k = shiftDay(k, -1); }
    return { current: n, doneToday };
  }
  function bestStreak(days) {
    const keys = Object.keys(days || {}).filter(k => active(days, k)).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      run = prev && shiftDay(prev, 1) === k ? run + 1 : 1;
      if (run > best) best = run;
      prev = k;
    }
    return best;
  }

  /* ---------- Кандзи дня: «трудность» и выбор набора ---------- */
  const DIFF_MODES = ['on', 'kun', 'write', 'card'];
  /* wrong — сколько раз за всё время ответили неверно или нажали «не знаю» (по всем режимам). */
  function difficulty(card) {
    let n = 0, right = 0;
    for (const m of DIFF_MODES) {
      const c = counts(card && card.srs && card.srs[m]);
      n += c.n; right += c.right;
    }
    return { n, wrong: n - right };
  }
  const HARD_WRONG = 2; // с этого числа ошибок кандзи считается трудным

  /* Взвешенный выбор без повторов. Трудные кандзи (ошибок >= 2) занимают не меньше ~60% набора, если их хватает;
     остальные места — случайно, но чем больше ошибок, тем выше шанс. rnd — функция 0..1 (для тестов). */
  function pickDaily(cards, count, rnd, exclude) {
    rnd = rnd || Math.random;
    const skip = new Set(exclude || []);
    let pool = cards.filter(c => !skip.has(c.ch));
    if (pool.length < count) pool = cards.slice();           // мало кандзи: берём, что есть, даже если выпадут повторно
    const info = new Map(pool.map(c => [c.ch, difficulty(c)]));
    const weight = c => {
      const d = info.get(c.ch);
      return (1 + 3 * Math.min(d.wrong, 8) + (d.n === 0 ? 1 : 0)) * (c.learned && d.wrong === 0 ? 0.5 : 1);
    };
    const draw = (list, k, out) => {
      const rest = list.slice();
      while (out.length < k && rest.length) {
        let total = 0; for (const c of rest) total += weight(c);
        let r = rnd() * total, i = 0;
        for (; i < rest.length - 1; i++) { r -= weight(rest[i]); if (r < 0) break; }
        out.push(rest.splice(i, 1)[0]);
      }
      return rest;
    };
    const take = Math.min(count, pool.length);
    const out = [];
    const hard = pool.filter(c => info.get(c.ch).wrong >= HARD_WRONG);
    const quota = Math.min(hard.length, Math.ceil(take * 0.6));
    draw(hard, quota, out);
    const chosen = new Set(out.map(c => c.ch));
    draw(pool.filter(c => !chosen.has(c.ch)), take, out);
    // порядок показа перемешиваем, чтобы трудные не шли всегда первыми
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out.map(c => c.ch);
  }

  const api = {
    difficulty, pickDaily, HARD_WRONG,
    dayKey, shiftDay, streak, bestStreak,
    esc, isKanji, kanjiList, flatten, strokeStart, pathLength, resample, parseKanjiVG, compare,
    kata2hira, hira2kata, romajiToHira, normReading, acceptedReadings, furigana, wordRuby,
    INTERVALS_DAYS, isDue, review
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof self !== 'undefined' ? self : this);
