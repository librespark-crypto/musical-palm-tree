/* ==========================================================================
   ui.js - icons, components, sheets, router, app shell
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store;

  const I = (App.icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M9 7.5h7M9 11h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="m8 12.5 3 3 5.5-6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><rect x="6" y="11" width="3.4" height="6" rx="1.4"/><rect x="11.3" y="6.5" width="3.4" height="10.5" rx="1.4"/><rect x="16.6" y="13.5" width="3.4" height="3.5" rx="1.4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.2"/><path d="m16 16 4.5 4.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5 8 12l6.5 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s4.5 4 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5"/><path d="M12 21a5.6 5.6 0 0 0 5.6-5.6c0-4-3.4-6.4-3.4-6.4"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 5.5 18 12l-10.5 6.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="2.4"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6.5h16M7 12h10M10 17.5h4"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.2"/><path d="M12 9.6v3.9l2.6 1.6M9.5 3.5h5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 14.5s-4-2.3-4-5a2 2 0 0 1 4-1 2 2 0 0 1 4 1c0 2.7-4 5-4 5z"/><circle cx="12" cy="12" r="9"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"/><path d="M19.5 4.5V9H15"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>'
  });

  /* --------------------------------------------------------------- helpers */
  const B = (App.ui = {});
  B.icon = (n) => I[n] || '';
  B.esc = U.esc;
  B.statusChip = function (key, extra) {
    const map = { not_started: 'Not Started', learning: 'Learning', completed: 'Completed', weak: 'Weak', revision_due: 'Revision Due' };
    return '<span class="st st-' + (key || 'not_started') + '">' + (map[key] || key) + (extra ? ' ' + U.esc(extra) : '') + '</span>';
  };
  B.dot = function (status) { return '<span class="dot dot-' + (status || 'not_started') + '"></span>'; };
  B.badges = function (node, opts) {
    opts = opts || {};
    if (node.jm && node.ja) return '<span class="badge both" title="In both JEE Main and JEE Advanced syllabi">JM JA</span>';
    if (node.jm) return '<span class="badge jm" title="JEE Main syllabus">JM</span>';
    if (node.ja) return '<span class="badge ja" title="JEE Advanced syllabus">JA</span>';
    return '';
  };
  B.badgeFor = function (exam) { return '<span class="badge ' + exam + '">' + (exam === 'jm' ? 'JM' : 'JA') + '</span>'; };
  B.pbar = function (pct, cls) { return '<div class="pbar ' + (cls || '') + '"><i style="width:' + U.clamp(pct || 0, 0, 100) + '%"></i></div>'; };
  B.ring = function (pct, opts) { return App.charts.ring(pct, opts); };
  B.kpi = function (k, v, d) { return '<div class="kpi"><div class="k">' + U.esc(k) + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; };
  const EMOJI_ICON = {
    '\u2728': 'spark', '\uD83C\uDF1F': 'check', '\uD83D\uDC4D': 'check', '\uD83D\uDCC5': 'clock',
    '\uD83D\uDCDA': 'book', '\uD83D\uDCDD': 'book', '\uD83D\uDCC8': 'chart', '\uD83D\uDCC9': 'chart',
    '\uD83D\uDCCB': 'check', '\uD83C\uDFAC': 'play', '\u270F': 'cross', '\u23F1': 'clock',
    '\uD83C\uDF89': 'check', '\uD83D\uDD0D': 'search', '\uD83D\uDCAA': 'check', '\uD83C\uDF3F': 'check', '\uD83D\uDCCE': 'check'
  };
  /* empty states use inline SVG icons so they render identically everywhere */
  B.empty = function (msg, icon) {
    let key = icon || 'spark';
    if (key && (key.indexOf('&#') === 0 || /[^\x00-\x7F]/.test(key))) {
      const txt = key.replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(+n));
      const cp = Array.from(txt)[0];
      key = EMOJI_ICON[cp] || EMOJI_ICON[String.fromCodePoint(cp.codePointAt(0))] || 'spark';
      if (EMOJI_ICON[cp] === undefined) {
        // try matching on the base code point (strips variation selectors)
        const base = cp.codePointAt(0);
        const found = Object.keys(EMOJI_ICON).find(k => k.codePointAt(0) === base);
        key = found ? EMOJI_ICON[found] : 'spark';
      }
    }
    return '<div class="empty"><span class="em">' + (I[key] || I.spark) + '</span>' + U.esc(msg) + '</div>';
  };
  B.subjectColor = function (code) { return code === 'phy' ? 'var(--phy)' : code === 'chem' ? 'var(--chem)' : 'var(--math)'; };
  B.subjectTint = function (code) { return code === 'phy' ? 'tint-phy' : code === 'chem' ? 'tint-chem' : 'tint-math'; };
  B.shortSub = function (name) { return name === 'Physics' ? 'PHY' : name === 'Chemistry' ? 'CHEM' : 'MATH'; };

  /* ------------------------------------------------------------------ shell */
  B.header = function (opts) {
    opts = opts || {};
    const right = opts.right || '';
    return '<div class="topbar">' +
      (opts.back ? '<button class="iconbtn" data-act="nav-back" aria-label="Back">' + I.back + '</button>' : '') +
      '<div class="tl"><h1>' + (opts.title || '') + '</h1>' + (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '') + '</div>' +
      right + '</div>';
  };
  B.nav = function (route) {
    const items = [
      { key: 'home', href: '#/home', label: 'Home', icon: 'home' },
      { key: 'syllabus', href: '#/syllabus', label: 'Syllabus', icon: 'book' },
      { key: 'tasks', href: '#/tasks', label: 'Tasks', icon: 'check' },
      { key: 'analytics', href: '#/analytics', label: 'Analytics', icon: 'chart' },
      { key: 'profile', href: '#/profile', label: 'Profile', icon: 'user' }
    ];
    const current = (route || '').split('/')[1] || 'home';
    return '<nav class="nav">' + items.map(it => {
      const on = current === it.key || (it.key === 'syllabus' && ['topic', 'chapter', 'topics-left'].indexOf(current) >= 0);
      return '<a href="' + it.href + '" class="' + (on ? 'on' : '') + '"><span class="nico">' + I[it.icon] + '</span>' + it.label + '</a>';
    }).join('') + '</nav>';
  };
  B.fab = function () {
    return '<button class="fab" data-act="fab" aria-label="Quick add">' + I.plus + '</button>';
  };
  B.timerPill = function () {
    const t = S.state.timer;
    if (!t.running) return '';
    const mins = Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 60000);
    return '<div class="timerpill" data-act="nav" data-href="#/timer"><span class="rec"></span>' + U.esc(t.mode || 'Study') + ' &middot; ' + U.minsToClock(mins) + ' &middot; stop</div>';
  };

  /* ---------------------------------------------------------------- sheets */
  B.closeSheet = function () {
    const sc = document.querySelector('.scrim');
    if (sc) sc.remove();
    B._onSheetClose && B._onSheetClose();
    B._onSheetClose = null;
  };
  B.sheet = function (opts) {
    B.closeSheet();
    opts = opts || {};
    const sc = document.createElement('div');
    sc.className = 'scrim';
    sc.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div><div class="sheet-h"><h3>' + (opts.title || '') + '</h3>' +
      '<button class="iconbtn" data-act="close-sheet" aria-label="Close">' + I.close + '</button></div>' +
      '<div class="sheet-body">' + (opts.html || '') + '</div>' +
      (opts.footer ? '<div style="margin-top:12px">' + opts.footer + '</div>' : '') + '</div>';
    sc.addEventListener('click', e => { if (e.target === sc) B.closeSheet(); });
    document.body.appendChild(sc);
    B._onSheetClose = opts.onClose || null;
    if (opts.onMount) opts.onMount(sc.querySelector('.sheet-body'), sc);
    return sc;
  };
  B.confirm = function (message, onYes, yesLabel) {
    B.sheet({
      title: 'Please confirm',
      html: '<p style="margin:4px 0 0">' + U.esc(message) + '</p>',
      footer: '<div class="btnrow"><button class="btn primary" data-act="confirm-yes">' + U.esc(yesLabel || 'Yes, do it') + '</button>' +
        '<button class="btn" data-act="close-sheet">Cancel</button></div>',
      onMount: function (body, sc) {
        sc.querySelector('[data-act="confirm-yes"]').addEventListener('click', function () { B.closeSheet(); onYes(); });
      }
    });
  };
  B.formValues = function (root) {
    const out = {};
    root.querySelectorAll('[name]').forEach(el => { out[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return out;
  };
  B.select = function (name, options, value, opts) {
    opts = opts || {};
    return '<select name="' + name + '"' + (opts.multiple ? ' multiple size="4"' : '') + '>' +
      options.map(o => '<option value="' + U.esc(o.value) + '"' + (String(o.value) === String(value) ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('') + '</select>';
  };
  B.field = function (label, inner, hint) {
    return '<div class="field"><label>' + U.esc(label) + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  };
  B.seg = function (name, options, value, opts) {
    opts = opts || {};
    return '<div class="seg" data-seg="' + name + '">' + options.map(o =>
      '<button type="button" class="pill ' + (String(o.value) === String(value) ? 'on' : '') + '" data-segval="' + U.esc(o.value) + '">' + U.esc(o.label) + '</button>').join('') + '</div>' +
      '<input type="hidden" name="' + name + '" value="' + U.esc(value == null ? '' : value) + '">';
  };
  B.subjectOptions = function (includeAll) { return (includeAll ? [{ value: '', label: 'All subjects' }] : []).concat(Syl.subjects ? App.syl.subjects.map(s => ({ value: s.name, label: s.name })) : []); };
  B.chapterOptions = function () {
    const out = [{ value: '', label: '- none -' }];
    App.syl.subjects.forEach(s => s.chapters.forEach(c => out.push({ value: c.id, label: s.name + ' / ' + c.name })));
    return out;
  };
  B.topicOptions = function (chapterId) {
    const out = [{ value: '', label: '- none -' }];
    const ch = chapterId ? App.syl.chapter(chapterId) : null;
    const chapters = ch ? [ch] : App.syl.subjects.reduce((a, s) => a.concat(s.chapters), []);
    chapters.forEach(c => c.topics.forEach(t => out.push({ value: t.id, label: c.name + ' / ' + t.name })));
    return out;
  };
  B.subtopicOptions = function (topicId) {
    const out = [{ value: '', label: 'Whole topic' }];
    const rec = topicId ? App.syl.rec(topicId) : null;
    if (rec && rec.kind === 'topic') rec.topic.subs.forEach(s => out.push({ value: s.id, label: s.name }));
    return out;
  };

  /* ---- chapter / topic picker chain used by every add-form ---- */
  B.bindPicker = function (root, initial) {
    const sSub = root.querySelector('[name="subject"]');
    if (!sSub) return;
    const chSel = root.querySelector('[name="chapterId"]');
    const tpSel = root.querySelector('[name="topicId"]');
    const sbSel = root.querySelector('[name="nodeId"]');
    const fillChapters = (keep) => {
      const sub = App.syl.subjects.find(x => x.name === sSub.value);
      if (!chSel) return;
      chSel.innerHTML = '<option value="">- none -</option>' + (sub ? sub.chapters.map(c => '<option value="' + c.id + '">' + U.esc(c.name) + '</option>').join('') : '');
      if (keep) chSel.value = keep;
      fillTopics(keep ? chSel.value : '');
    };
    const fillTopics = (keep) => {
      if (!tpSel) return;
      const ch = chSel && chSel.value ? App.syl.chapter(chSel.value) : null;
      const chs = ch ? [ch] : App.syl.subjects.reduce((a, s) => a.concat(s.chapters), []);
      tpSel.innerHTML = '<option value="">- none -</option>' + chs.map(c => c.topics.map(t => '<option value="' + t.id + '">' + U.esc((ch ? '' : c.name + ' / ') + t.name) + '</option>').join('')).join('');
      if (keep) tpSel.value = keep;
      fillSubs(keep ? tpSel.value : '');
    };
    const fillSubs = (keep) => {
      if (!sbSel) return;
      const rec = tpSel && tpSel.value ? App.syl.rec(tpSel.value) : null;
      sbSel.innerHTML = '<option value="">Whole topic</option>' + (rec && rec.topic ? rec.topic.subs.map(s => '<option value="' + s.id + '">' + U.esc(s.name) + '</option>').join('') : '');
      if (keep) sbSel.value = keep;
    };
    sSub.addEventListener('change', () => fillChapters(''));
    chSel && chSel.addEventListener('change', () => fillTopics(''));
    tpSel && tpSel.addEventListener('change', () => fillSubs(''));
    if (initial && initial.subject) { sSub.value = initial.subject; }
    fillChapters(initial && initial.chapterId);
    if (initial && initial.topicId) { tpSel.value = initial.topicId; fillSubs(initial.nodeId); }
  };

  /* ---------------------------------------------------------------- actions */
  const actions = {};
  B.action = function (name, fn) { actions[name] = fn; };
  B.run = function (name, el, ev) { if (actions[name]) { actions[name](el, ev); return true; } return false; };
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const name = el.getAttribute('data-act');
    if (actions[name]) { e.preventDefault(); e.stopPropagation(); actions[name](el, e); }
  });
  B.action('nav', (el) => { location.hash = el.getAttribute('data-href') || '#/home'; });
  B.action('nav-back', () => { if (history.length > 1) history.back(); else location.hash = '#/home'; });
  B.action('close-sheet', () => B.closeSheet());

  /* ----------------------------------------------------------------- router */
  const Router = (App.router = {
    routes: [],
    add(pattern, fn) { Router.routes.push({ pattern, fn, keys: [] }); return Router; },
    parse(hash) {
      const h = (hash || '').replace(/^#\/?/, '');
      const [path, query] = h.split('?');
      const parts = path.split('/').filter(Boolean);
      const q = {};
      (query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
      return { parts, query: q, path };
    },
    render() {
      const { parts, query, path } = Router.parse(location.hash);
      const key = parts[0] || 'home';
      const view = (App.screens[key] || App.screens.home)(parts.slice(1), query);
      const app = document.getElementById('app');
      app.innerHTML = B.header(view) + '<div class="screen" id="screen">' + view.html + '</div>' + B.nav(path) + B.fab() + B.timerPill();
      if (view.after) view.after(document.getElementById('screen'));
      if (!B._keepScroll) window.scrollTo({ top: 0 });
      B.currentRoute = path || 'home';
    },
    start() {
      window.addEventListener('hashchange', () => { Router.render(); });
      Router.render();
    }
  });

  /* ------------------------------------------------------------- fab menu */
  B.action('fab', () => {
    const node = App.ui.ctxNode || '';
    B.sheet({
      title: 'Quick add',
      html: '<div class="grid2">' +
        '<button class="btn block" data-act="fab-task">+ Task</button>' +
        '<button class="btn block" data-act="fab-lecture">+ Lecture</button>' +
        '<button class="btn block" data-act="fab-question">+ Questions</button>' +
        '<button class="btn block" data-act="fab-error">+ Error</button>' +
        '<button class="btn block" data-act="fab-revision">+ Revision</button>' +
        '<button class="btn block" data-act="fab-session">+ Study time</button>' +
        '<button class="btn block" data-act="fab-test">+ Mock test</button>' +
        '<button class="btn block" data-act="fab-timer">Study timer</button>' +
        '</div>' + (node ? '<div class="note" style="margin-top:10px">Opened from: ' + U.esc(node) + '</div>' : ''),
      onMount: function () { }
    });
  });
  B.action('fab-task', () => { B.closeSheet(); App.forms.task({}); });
  B.action('fab-lecture', () => { B.closeSheet(); App.forms.lecture({}); });
  B.action('fab-question', () => { B.closeSheet(); App.forms.question({}); });
  B.action('fab-error', () => { B.closeSheet(); App.forms.error({}); });
  B.action('fab-revision', () => { B.closeSheet(); App.forms.revision({}); });
  B.action('fab-session', () => { B.closeSheet(); App.forms.session({}); });
  B.action('fab-test', () => { B.closeSheet(); App.forms.test({}); });
  B.action('fab-timer', () => { B.closeSheet(); location.hash = '#/timer'; });

  /* -------------------------------------------------------- global handlers */
  B.action('open-search', () => { location.hash = '#/search'; });
  B.action('open-timer', () => { location.hash = '#/timer'; });
  B.action('open-gemini', () => { location.hash = '#/gemini'; });
  B.action('stop-timer', () => { App.timer.stop(); });
})(typeof window !== 'undefined' ? window : globalThis);
