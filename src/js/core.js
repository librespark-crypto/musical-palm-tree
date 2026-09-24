/* ==========================================================================
   core.js - utilities, storage, state, syllabus engine, analytics, insights, charts
   ========================================================================== */
(function (global) {
  'use strict';
  const App = (global.App = global.App || {});

  /* ------------------------------------------------------------------ util */
  const MS_DAY = 86400000;
  const util = (App.util = {
    uid(prefix) {
      return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    },
    todayISO() { return util.iso(new Date()); },
    iso(d) {
      const x = d instanceof Date ? d : new Date(d);
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    },
    isoTime(d) {
      const x = d instanceof Date ? d : new Date(d);
      return util.iso(x) + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
    },
    parse(iso) {
      if (!iso) return null;
      const p = String(iso).split('-').map(Number);
      return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
    },
    addDays(iso, n) { const d = util.parse(iso) || new Date(); d.setDate(d.getDate() + n); return util.iso(d); },
    diffDays(a, b) { const x = util.parse(a), y = util.parse(b); if (!x || !y) return 0; return Math.round((y - x) / MS_DAY); },
    daysFromToday(iso) { return util.diffDays(util.todayISO(), iso); },
    weekday(iso) { const d = util.parse(iso); return d ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] : ''; },
    weekdayLong(iso) { const d = util.parse(iso); return d ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] : ''; },
    fmtDate(iso, style) {
      const d = util.parse(iso); if (!d) return '';
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      if (style === 'long') return util.weekdayLong(iso) + ', ' + d.getDate() + ' ' + mon + ' ' + d.getFullYear();
      if (style === 'short') return d.getDate() + ' ' + mon;
      return d.getDate() + ' ' + mon + ' ' + d.getFullYear();
    },
    relDay(iso) {
      if (!iso) return '';
      const n = util.daysFromToday(iso);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n === -1) return 'Yesterday';
      if (n < 0) return Math.abs(n) + 'd overdue';
      if (n <= 7) return 'in ' + n + 'd (' + util.weekday(iso) + ')';
      return util.fmtDate(iso, 'short');
    },
    minsToHM(m) {
      m = Math.max(0, Math.round(m || 0));
      const h = Math.floor(m / 60), mm = m % 60;
      if (!h) return mm + 'm';
      if (!mm) return h + 'h';
      return h + 'h ' + mm + 'm';
    },
    minsToClock(m) {
      m = Math.max(0, Math.round(m || 0));
      const h = Math.floor(m / 60), mm = m % 60, s = Math.floor((m * 60) % 60);
      return (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(s).padStart(2, '0');
    },
    pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; },
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    sum(arr, f) { return (arr || []).reduce((s, x) => s + (f ? f(x) : x), 0); },
    avg(arr, f) { return arr && arr.length ? util.sum(arr, f) / arr.length : 0; },
    round1(v) { return Math.round(v * 10) / 10; },
    groupBy(arr, f) { const o = {}; (arr || []).forEach(x => { const k = f(x); (o[k] = o[k] || []).push(x); }); return o; },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    clone(o) { try { return structuredClone(o); } catch (e) { return JSON.parse(JSON.stringify(o)); } },
    debounce(fn, ms) { let t; return function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms || 200); }; },
    sortBy(arr, f, dir) { const d = dir === 'desc' ? -1 : 1; return (arr || []).slice().sort((a, b) => { const x = f(a), y = f(b); return x < y ? -d : x > y ? d : 0; }); },
    uniq(arr) { return Array.from(new Set(arr || [])); },
    download(name, text, mime) {
      try {
        const blob = new Blob([text], { type: mime || 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
        return true;
      } catch (e) { return false; }
    },
    readFile(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ''));
        r.onerror = () => rej(r.error);
        r.readAsText(file);
      });
    },
    readDataURL(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ''));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
    },
    nowISO() { return new Date().toISOString(); },
    idFromHash() { return (location.hash || '').replace(/^#\/?/, ''); },
    firstName(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }
  });

  /* --------------------------------------------------------------- storage */
  const Store = (App.store = {
    KEY: 'jee-tracker-v1',
    BK: 'jee-tracker-backup-',
    available: false,
    memory: {},
    _subs: [],
    _saveT: null,
    probe() {
      try {
        const k = '__jt_probe';
        global.localStorage.setItem(k, '1');
        global.localStorage.removeItem(k);
        Store.available = true;
      } catch (e) { Store.available = false; }
      return Store.available;
    },
    rawGet(k) {
      try { return Store.available ? global.localStorage.getItem(k) : (Store.memory[k] || null); }
      catch (e) { return Store.memory[k] || null; }
    },
    rawSet(k, v) {
      try { if (Store.available) { global.localStorage.setItem(k, v); return true; } } catch (e) { Store.available = false; }
      Store.memory[k] = v; return false;
    },
    rawRemove(k) {
      try { if (Store.available) global.localStorage.removeItem(k); } catch (e) { }
      delete Store.memory[k];
    },
    defaultState() {
      return {
        v: 1,
        created: util.nowISO(),
        updated: util.nowISO(),
        profile: {
          name: '',
          examLabel: 'JEE 2027',
          mainDate: '2027-01-22',
          advancedDate: '2027-05-17',
          dailyTargetMin: 420
        },
        settings: { apiKey: '', model: 'gemini-2.5-flash', sample: false, showCoachTips: true },
        progress: {},
        lectures: [], revisions: [], tasks: [], questions: [], errors: [], tests: [], sessions: [],
        ai: { chats: [], activeChat: null, lastAnalysis: null },
        timer: { running: false, startedAt: null, mode: 'Lecture', subject: 'Physics', chapterId: '', topicId: '', exam: 'jm' },
        meta: { lastSweep: null, onboarded: false }
      };
    },
    state: null,
    load() {
      Store.probe();
      let s = null;
      const raw = Store.rawGet(Store.KEY);
      if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
      const def = Store.defaultState();
      if (!s || typeof s !== 'object') s = def;
      // shallow-merge new top-level keys
      Object.keys(def).forEach(k => { if (s[k] === undefined || s[k] === null) s[k] = def[k]; });
      s.profile = Object.assign({}, def.profile, s.profile || {});
      s.settings = Object.assign({}, def.settings, s.settings || {});
      s.ai = Object.assign({}, def.ai, s.ai || {});
      s.timer = Object.assign({}, def.timer, s.timer || {});
      s.meta = Object.assign({}, def.meta, s.meta || {});
      ['progress', 'lectures', 'revisions', 'tasks', 'questions', 'errors', 'tests', 'sessions'].forEach(k => {
        if (!s[k] || typeof s[k] !== 'object') s[k] = def[k];
      });
      Store.state = s;
      return s;
    },
    save(now) {
      Store.state.updated = util.nowISO();
      const write = () => { Store.rawSet(Store.KEY, JSON.stringify(Store.state)); };
      if (now) { clearTimeout(Store._saveT); write(); return; }
      clearTimeout(Store._saveT);
      Store._saveT = setTimeout(write, 250);
    },
    update(fn, opts) {
      const r = fn(Store.state);
      Store.save(opts && opts.now);
      Store.emit();
      return r;
    },
    subscribe(fn) { Store._subs.push(fn); return () => { Store._subs = Store._subs.filter(f => f !== fn); }; },
    emit() { Store._subs.forEach(f => { try { f(Store.state); } catch (e) { } }); },
    exportJSON() {
      return JSON.stringify({ app: 'jee-pcm-tracker', exportedAt: util.nowISO(), state: Store.state }, null, 1);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      const st = parsed && parsed.state ? parsed.state : parsed;
      if (!st || typeof st !== 'object' || !st.profile) throw new Error('Not a valid tracker backup file.');
      const def = Store.defaultState();
      Object.keys(def).forEach(k => { if (st[k] === undefined) st[k] = def[k]; });
      Store.state = st;
      Store.save(true);
      Store.emit();
      return true;
    },
    backup(slot) {
      const key = Store.BK + slot;
      const payload = JSON.stringify({ at: util.nowISO(), state: Store.state });
      const ok = Store.rawSet(key, payload);
      return { slot, at: util.nowISO(), ok, size: payload.length };
    },
    backups() {
      const out = [];
      for (let i = 1; i <= 3; i++) {
        const raw = Store.rawGet(Store.BK + i);
        if (raw) { try { const p = JSON.parse(raw); out.push({ slot: i, at: p.at, size: raw.length }); } catch (e) { out.push({ slot: i, at: null, size: raw.length, broken: true }); } }
        else out.push({ slot: i, at: null, size: 0 });
      }
      return out;
    },
    restore(slot) {
      const raw = Store.rawGet(Store.BK + slot);
      if (!raw) throw new Error('That backup slot is empty.');
      return Store.importJSON(raw);
    },
    wipe(keepSettings) {
      const keep = keepSettings ? { profile: Store.state.profile, settings: Store.state.settings } : null;
      Store.state = Store.defaultState();
      if (keep) { Store.state.profile = keep.profile; Store.state.settings = keep.settings; }
      Store.save(true);
      Store.emit();
    }
  });

  /* ------------------------------------------------------- syllabus engine */
  const EXAM = (App.EXAM = { jm: { key: 'jm', label: 'JEE Main', short: 'JM', long: 'JEE Main' }, ja: { key: 'ja', label: 'JEE Advanced', short: 'JA', long: 'JEE Advanced' } });

  const Syl = (App.syl = {
    data: null,
    subjects: [],
    byCode: {},
    index: {},
    init(data) {
      Syl.data = data;
      Syl.subjects = data.subjects;
      Syl.index = {};
      data.subjects.forEach(sub => {
        data.subjects.forEach(() => { });
        sub.chapters.forEach(ch => {
          const chRec = { kind: 'chapter', node: ch, chapter: ch, topic: null, subject: sub, name: ch.name };
          Syl.index[ch.id] = chRec;
          ch.topics.forEach(tp => {
            const tpRec = { kind: 'topic', node: tp, chapter: ch, topic: tp, subject: sub, name: tp.name };
            Syl.index[tp.id] = tpRec;
            tp.subs.forEach(sb => {
              Syl.index[sb.id] = { kind: 'sub', node: sb, chapter: ch, topic: tp, subject: sub, name: sb.name };
            });
          });
        });
      });
      data.subjects.forEach(s => { Syl.byCode[s.code] = s; });
      return Syl;
    },
    rec(id) { return Syl.index[id] || null; },
    subjectOf(id) { const r = Syl.index[id]; return r ? r.subject : null; },
    chapterOf(id) { const r = Syl.index[id]; return r ? r.chapter : null; },
    topicOf(id) { const r = Syl.index[id]; if (!r) return null; return r.topic || null; },
    chapter(id) { const r = Syl.index[id]; return r ? r.chapter : null; },
    leaves(nodeId, exam) {
      const r = Syl.index[nodeId];
      if (!r) return [];
      let arr = [];
      if (r.kind === 'sub') arr = [r.node];
      else if (r.kind === 'topic') arr = r.topic.subs;
      else arr = r.chapter.topics.reduce((a, t) => a.concat(t.subs), []);
      if (exam) arr = arr.filter(x => x[exam]);
      return arr;
    },
    topicLeaves(topicId, exam) { return Syl.leaves(topicId, exam); },
    inScope(node, exam) { return !exam ? true : !!node[exam]; },
    // search over syllabus
    search(q) {
      const s = String(q || '').toLowerCase().trim();
      if (!s) return { chapters: [], topics: [], subs: [] };
      const hit = t => String(t).toLowerCase().indexOf(s) >= 0;
      const res = { chapters: [], topics: [], subs: [] };
      Syl.subjects.forEach(sub => sub.chapters.forEach(ch => {
        if (hit(ch.name)) res.chapters.push({ id: ch.id, name: ch.name, subject: sub.name, code: sub.code });
        ch.topics.forEach(tp => {
          if (hit(tp.name)) res.topics.push({ id: tp.id, name: tp.name, chapter: ch.name, subject: sub.name, code: sub.code, chapterId: ch.id });
          tp.subs.forEach(sb => { if (hit(sb.name)) res.subs.push({ id: sb.id, name: sb.name, topic: tp.name, chapter: ch.name, subject: sub.name, code: sub.code, topicId: tp.id, chapterId: ch.id }); });
        });
      }));
      return res;
    },
    counts(exam) {
      let chapters = 0, topics = 0, subs = 0, leavesPerSubject = {};
      Syl.subjects.forEach(sub => {
        let n = 0;
        sub.chapters.forEach(ch => { chapters++; ch.topics.forEach(tp => { topics++; tp.subs.forEach(sb => { subs++; if (Syl.inScope(sb, exam)) n++; }); }); });
        if (exam) {
          // chapter counts only where chapter has at least one leaf in scope
          chapters = chapters;
        }
        leavesPerSubject[sub.code] = n;
      });
      return { chapters, topics, subs, leavesPerSubject };
    }
  });

  /* --------------------------------------------------- progress + metrics */
  const DIMS = ['theory', 'lecture', 'dpp', 'pyq', 'practice'];
  const DIM_LABEL = { theory: 'Theory', lecture: 'Lecture', dpp: 'DPP', pyq: 'PYQ', practice: 'Practice', revision: 'Revision' };
  const STATUSES = [
    { key: 'not_started', label: 'Not Started' },
    { key: 'learning', label: 'Learning' },
    { key: 'completed', label: 'Completed' },
    { key: 'weak', label: 'Weak' },
    { key: 'revision_due', label: 'Revision Due' }
  ];
  const MISTAKE_TYPES = ['Conceptual', 'Calculation', 'Formula', 'Silly mistake', 'Misread question', 'Wrong approach', 'Time pressure', 'Guess'];
  const SOURCES = ['DPP', 'PYQ', 'Practice', 'Mock Test'];
  const TASK_TYPES = ['Lecture', 'Topic study', 'PYQ', 'DPP', 'Practice', 'Revision', 'Mock test', 'Error-book revision'];

  const Prog = (App.prog = {
    DIMS, DIM_LABEL, STATUSES, MISTAKE_TYPES, SOURCES, TASK_TYPES,
    norm(exam) { return exam === 'ja' ? 'ja' : 'jm'; },
    blank() { return { status: 'not_started', weak: false, theory: 'none', lecture: 'none', dpp: 'none', pyq: 'none', practice: 'none', revisionCount: 0, lastStudied: null, timeMin: 0, note: '' }; },
    get(nodeId, exam) {
      const S = Store.state;
      exam = Prog.norm(exam);
      const rec = S.progress[nodeId] || (S.progress[nodeId] = {});
      let p = rec[exam];
      if (!p) { p = rec[exam] = Prog.blank(); }
      else {
        const b = Prog.blank();
        Object.keys(b).forEach(k => { if (p[k] === undefined) p[k] = b[k]; });
      }
      return p;
    },
    peek(nodeId, exam) {
      const S = Store.state;
      return (S.progress[nodeId] && S.progress[nodeId][Prog.norm(exam)]) || null;
    },
    set(nodeId, exam, patch, silent) {
      const p = Prog.get(nodeId, exam);
      Object.assign(p, patch);
      if (!silent) Store.save();
      return p;
    },
    /* leaves under a node (chapter/topic/sub) that exist in the given exam scope */
    scope(nodeId, exam) { return exam ? Syl.leaves(nodeId, exam) : Syl.leaves(nodeId, 'jm'); },
    /* is a revision scheduled/overdue for this leaf+exam? */
    revState(nodeId, exam) {
      exam = Prog.norm(exam);
      const due = [], over = [], up = [], done = [];
      Store.state.revisions.forEach(r => {
        if (r.nodeId !== nodeId || r.exam !== exam) return;
        if (r.completedAt) { done.push(r); return; }
        const d = util.daysFromToday(r.scheduledFor);
        if (d < 0) over.push(r); else if (d === 0) due.push(r); else up.push(r);
      });
      return {
        due, over, up, done,
        dueToday: due.length, overdue: over.length, upcoming: up.length, completed: done.length,
        next: (due[0] || up[0] || null)
      };
    },
    /* status shown to the user: stored status, upgraded to revision_due when a revision is pending */
    displayStatus(nodeId, exam) {
      const p = Prog.peek(nodeId, exam);
      const st = p ? p.status : 'not_started';
      const rv = Prog.revState(nodeId, exam);
      if (st !== 'not_started' && (rv.dueToday > 0 || rv.overdue > 0)) return 'revision_due';
      if (p && p.weak) return 'weak';
      return st;
    },
    /* aggregated coverage of one leaf, 0..1 */
    leafCoverage(nodeId, exam) {
      exam = Prog.norm(exam);
      const p = Prog.get(nodeId, exam);
      const w = { theory: .22, lecture: .24, dpp: .2, pyq: .18, practice: .16 };
      let s = 0;
      DIMS.forEach(d => { const v = p[d] === 'done' ? 1 : p[d] === 'partial' ? .5 : 0; s += v * w[d]; });
      const rev = util.clamp(p.revisionCount / 3, 0, 1) * .12;
      return util.clamp(s * (1 - .12) + rev, 0, 1);
    },
    /* questions logged against a node or its children */
    qstats(nodeId, exam) {
      exam = exam === 'ja' ? 'ja' : exam === 'jm' ? 'jm' : null;
      const ids = {};
      const r = Syl.index[nodeId];
      if (!r) return { attempted: 0, correct: 0, wrong: 0, unattempted: 0, accuracy: 0, timeMin: 0, count: 0, bySource: {} };
      if (r.kind === 'sub') ids[nodeId] = 1;
      else if (r.kind === 'topic') { ids[nodeId] = 1; r.topic.subs.forEach(s => ids[s.id] = 1); }
      else { ids[nodeId] = 1; r.chapter.topics.forEach(t => { ids[t.id] = 1; t.subs.forEach(s => ids[s.id] = 1); }); }
      let a = 0, c = 0, w = 0, u = 0, t = 0, n = 0, pyq = 0, dpp = 0, adv = 0;
      const bySource = {};
      Store.state.questions.forEach(q => {
        if (!ids[q.nodeId]) return;
        if (exam && q.exam !== exam) return;
        a += q.attempted || 0; c += q.correct || 0; w += q.wrong || 0; u += q.unattempted || 0;
        t += q.timeMin || 0; n++;
        if (q.source === 'PYQ') pyq += q.attempted || 0;
        if (q.source === 'DPP') dpp += q.attempted || 0;
        if (q.exam === 'ja') adv += q.attempted || 0;
        bySource[q.source] = (bySource[q.source] || 0) + (q.attempted || 0);
      });
      return {
        attempted: a, correct: c, wrong: w, unattempted: u, timeMin: t,
        count: n, sessions: n, accuracy: a ? Math.round((c / a) * 100) : 0,
        perQ: a ? util.round1(t / a) : 0, bySource, pyq, dpp, adv
      };
    },
    lstats(nodeId, exam) {
      exam = exam === 'ja' ? 'ja' : exam === 'jm' ? 'jm' : null;
      const r = Syl.index[nodeId];
      const ids = {};
      if (!r) return { total: 0, done: 0, inProgress: 0, notStarted: 0, minutes: 0, watched: 0, list: [] };
      if (r.kind === 'sub') ids[nodeId] = 1;
      else if (r.kind === 'topic') { ids[nodeId] = 1; r.topic.subs.forEach(s => ids[s.id] = 1); }
      else { ids[nodeId] = 1; r.chapter.topics.forEach(t => { ids[t.id] = 1; t.subs.forEach(s => ids[s.id] = 1); }); }
      const list = Store.state.lectures.filter(l => ids[l.topicId] || ids[l.nodeId]);
      const scoped = exam ? list.filter(l => !l.exam || l.exam === exam || l.exam === 'both') : list;
      const done = scoped.filter(l => l.status === 'Completed');
      const inProg = scoped.filter(l => l.status === 'In Progress');
      const watched = util.sum(scoped, l => (l.status === 'Completed' ? (l.duration || 0) : (l.watchedMin || 0)));
      return {
        total: scoped.length, done: done.length, inProgress: inProg.length,
        notStarted: scoped.length - done.length - inProg.length,
        minutes: util.sum(scoped, l => l.duration || 0), watched,
        list: scoped.slice().sort((a, b) => (a.number || 0) - (b.number || 0))
      };
    },
    /* full aggregate report for a chapter / topic / sub */
    agg(nodeId, exam) {
      exam = Prog.norm(exam);
      const leaves = Prog.scope(nodeId, exam);
      const total = leaves.length;
      let completed = 0, learning = 0, weak = 0, notStarted = 0, revDue = 0, masterySum = 0;
      const dims = {}; DIMS.forEach(d => dims[d] = { done: 0, partial: 0, none: 0 });
      leaves.forEach(l => {
        const p = Prog.get(l.id, exam);
        const st = p.status;
        if (st === 'completed') completed++; else if (st === 'learning' || st === 'revision_due') learning++; else if (st === 'weak') weak++; else notStarted++;
        if (p.weak && st !== 'weak') weak++;
        DIMS.forEach(d => { dims[d][p[d] === 'done' ? 'done' : p[d] === 'partial' ? 'partial' : 'none']++; });
        const rv = Prog.revState(l.id, exam);
        if (rv.dueToday || rv.overdue) revDue++;
        masterySum += Prog.mastery(l.id, exam);
      });
      const q = Prog.qstats(nodeId, exam);
      const lec = Prog.lstats(nodeId, exam);
      const coverage = total ? util.sum(leaves, l => Prog.leafCoverage(l.id, exam)) / total : 0;
      const mastery = total ? masterySum / total : 0;
      const pct = total ? Math.round((completed / total) * 100) : 0;
      const remaining = total - completed;
      return {
        nodeId, exam, total, completed, learning, weak, notStarted, revDue,
        pct, remaining, coverage: Math.round(coverage * 100), mastery: Math.round(mastery),
        dims, questions: q, lectures: lec, revisionCount: util.sum(leaves, l => Prog.get(l.id, exam).revisionCount || 0)
      };
    },
    /* mastery: weighted coverage x accuracy factor (documented in the UI) */
    mastery(nodeId, exam) {
      exam = Prog.norm(exam);
      const cov = Prog.leafCoverage(nodeId, exam);
      const p = Prog.get(nodeId, exam);
      const q = (function () {
        let a = 0, c = 0;
        Store.state.questions.forEach(x => { if (x.nodeId === nodeId && x.exam === exam) { a += x.attempted || 0; c += x.correct || 0; } });
        return { a, c, acc: a ? c / a : null };
      })();
      let factor = 1;
      if (q.acc !== null && q.a >= 5) factor = util.clamp(0.55 + (q.acc - 0.4) * 0.75, 0.45, 1.05);
      let m = cov * factor * 100;
      if (p.status === 'weak') m = Math.min(m, 45);
      if (p.status === 'completed' && cov > .75) m = Math.max(m, 70);
      return util.clamp(Math.round(m), 0, 100);
    },
    /* effective status string for list rendering when node may be chapter/topic */
    statusOfAgg(nodeId, exam) {
      const leaves = Prog.scope(nodeId, exam);
      const agg = Prog.agg(nodeId, exam);
      if (agg.completed === agg.total && agg.total > 0) return 'completed';
      if (agg.weak > 0 && agg.completed + agg.weak >= agg.total * .5) return 'weak';
      if (agg.completed + agg.learning + agg.weak === 0) return 'not_started';
      return 'learning';
    },
    /* ask the engine what to suggest */
    suggestion(nodeId, exam) {
      const p = Prog.get(nodeId, exam);
      const cov = Prog.leafCoverage(nodeId, exam);
      if (p.status === 'not_started' && cov > 0) return 'learning';
      if (p.status === 'learning' && cov >= .8) return 'completed';
      return null;
    }
  });

  /* ------------------------------------------------------------- analytics */
  const Calc = (App.calc = {
    /* activity = any logged action on a day */
    activityByDay(days) {
      const S = Store.state;
      const map = {};
      const add = (iso, patch) => {
        if (!iso) return;
        const d = map[iso] = map[iso] || { date: iso, minutes: 0, questions: 0, correct: 0, tasksDone: 0, revisionsDone: 0, tests: 0, activities: 0, subjects: {} };
        Object.keys(patch).forEach(k => { if (k === 'subjects') { Object.keys(patch.subjects).forEach(c => d.subjects[c] = (d.subjects[c] || 0) + patch.subjects[c]); } else d[k] += patch[k]; });
      };
      S.sessions.forEach(s => { const d = util.iso(new Date(s.start)); add(d, { minutes: s.minutes || 0, activities: 1, subjects: s.subject ? { [s.subject]: s.minutes || 0 } : {} }); });
      S.questions.forEach(q => add(q.date, { questions: q.attempted || 0, correct: q.correct || 0, activities: 1 }));
      S.tasks.forEach(t => { if (t.status === 'done' && t.completedAt) add(t.completedAt.slice(0, 10), { tasksDone: 1, activities: 1 }); });
      S.revisions.forEach(r => { if (r.completedAt) add(r.completedAt.slice(0, 10), { revisionsDone: 1, activities: 1 }); });
      S.tests.forEach(t => add(t.date, { tests: 1, activities: 1 }));
      S.errors.forEach(e => { if (e.date) add(e.date, { activities: .4 }); });
      const out = [];
      for (let i = days - 1; i >= 0; i--) { const iso = util.addDays(util.todayISO(), -i); out.push(map[iso] || { date: iso, minutes: 0, questions: 0, correct: 0, tasksDone: 0, revisionsDone: 0, tests: 0, activities: 0, subjects: {} }); }
      return out;
    },
    streak() {
      const days = Calc.activityByDay(400);
      let cur = 0, best = 0, run = 0;
      days.forEach(d => { if (d.activities >= 1) { run++; best = Math.max(best, run); } else run = 0; });
      for (let i = days.length - 1; i >= 0; i--) { if (days[i].activities >= 1) cur++; else break; }
      return { current: cur, best: Math.max(best, cur) };
    },
    rangeMinutes(fromISO, toISO) {
      return util.sum(Store.state.sessions.filter(s => { const d = util.iso(new Date(s.start)); return d >= fromISO && d <= toISO; }), s => s.minutes || 0);
    },
    studyTime() {
      const t = util.todayISO();
      const weekStart = util.addDays(t, -6);
      return {
        today: Calc.rangeMinutes(t, t),
        week: Calc.rangeMinutes(weekStart, t),
        month: Calc.rangeMinutes(util.addDays(t, -29), t),
        total: util.sum(Store.state.sessions, s => s.minutes || 0)
      };
    },
    qOverall(exam, fromISO, toISO, subject) {
      const qs = Store.state.questions.filter(q => (!exam || q.exam === exam) && (!subject || q.subject === subject) && (!fromISO || q.date >= fromISO) && (!toISO || q.date <= toISO));
      const a = util.sum(qs, q => q.attempted || 0), c = util.sum(qs, q => q.correct || 0), w = util.sum(qs, q => q.wrong || 0), u = util.sum(qs, q => q.unattempted || 0), t = util.sum(qs, q => q.timeMin || 0);
      return {
        attempted: a, correct: c, wrong: w, unattempted: u, timeMin: t, sessions: qs.length,
        accuracy: a ? Math.round((c / a) * 100) : 0,
        perQ: a ? util.round1(t / a) : 0
      };
    },
    subjectStats(code, exam) {
      const sub = Syl.byCode[code];
      let leaves = 0, done = 0, jaLeaves = 0, jaDone = 0, jmLeaves = 0, jmDone = 0, masterySum = 0, revDue = 0, weak = 0;
      sub.chapters.forEach(ch => ch.topics.forEach(tp => tp.subs.forEach(sb => {
        leaves++;
        const pJm = Prog.get(sb.id, 'jm'), pJa = Prog.get(sb.id, 'ja');
        if (pJm.status === 'completed') jmDone++;
        if (pJa.status === 'completed') jaDone++;
        if (sb.jm) jmLeaves++;
        if (sb.ja) jaLeaves++;
        const ex = exam || 'jm';
        if (Prog.get(sb.id, ex).status === 'completed') done++;
        if (Prog.get(sb.id, ex).status === 'weak' || Prog.get(sb.id, ex).weak) weak++;
        masterySum += Prog.mastery(sb.id, ex);
        const rv = Prog.revState(sb.id, ex);
        if (rv.dueToday || rv.overdue) revDue++;
      })));
      const scope = exam || 'jm';
      const denom = scope === 'jm' ? jmLeaves : jaLeaves;
      const numer = scope === 'jm' ? jmDone : jaDone;
      const q = Calc.qOverall(scope, null, null, sub.name);
      const lec = Prog.lstats(sub.chapters[0].id, scope);
      const allLec = Store.state.lectures.filter(l => l.subject === sub.name);
      const scopedLec = exam ? allLec.filter(l => !l.exam || l.exam === exam || l.exam === 'both') : allLec;
      return {
        code, name: sub.name, chapters: sub.chapters.length, leaves: denom, done: numer,
        pct: denom ? Math.round((numer / denom) * 100) : 0,
        jmPct: jmLeaves ? Math.round((jmDone / jmLeaves) * 100) : 0,
        jaPct: jaLeaves ? Math.round((jaDone / jaLeaves) * 100) : 0,
        mastery: leaves ? Math.round(masterySum / leaves) : 0,
        weak, revDue, questions: q,
        lectures: {
          total: scopedLec.length,
          done: scopedLec.filter(l => l.status === 'Completed').length,
          minutes: util.sum(scopedLec, l => l.duration || 0),
          watched: util.sum(scopedLec, l => l.status === 'Completed' ? (l.duration || 0) : (l.watchedMin || 0))
        }
      };
    },
    overall() {
      const subjects = Syl.subjects.map(s => Calc.subjectStats(s.code, null));
      const per = exam => {
        let tot = 0, done = 0, mastery = 0, weak = 0, revDue = 0;
        Syl.subjects.forEach(s => s.chapters.forEach(ch => ch.topics.forEach(tp => tp.subs.forEach(sb => {
          if (!sb[exam]) return;
          tot++;
          if (Prog.get(sb.id, exam).status === 'completed') done++;
          if (Prog.get(sb.id, exam).status === 'weak' || Prog.get(sb.id, exam).weak) weak++;
          mastery += Prog.mastery(sb.id, exam);
          const rv = Prog.revState(sb.id, exam);
          if (rv.dueToday || rv.overdue) revDue++;
        }))));
        return { total: tot, done, remaining: tot - done, pct: tot ? Math.round((done / tot) * 100) : 0, mastery: tot ? Math.round(mastery / tot) : 0, weak, revDue };
      };
      const main = per('jm'), adv = per('ja');
      const q = Calc.qOverall(null, null, null, null);
      const allLec = Store.state.lectures;
      const tasks = Calc.taskBuckets();
      const rev = Calc.revisionBuckets();
      return {
        subjects, main, advanced: adv, questions: q,
        total: { total: main.total + adv.total, done: main.done + adv.done, pct: (main.total + adv.total) ? Math.round(((main.done + adv.done) / (main.total + adv.total)) * 100) : 0 },
        lectures: {
          total: allLec.length, done: allLec.filter(l => l.status === 'Completed').length,
          inProgress: allLec.filter(l => l.status === 'In Progress').length,
          remaining: allLec.filter(l => l.status !== 'Completed').length,
          minutes: util.sum(allLec, l => l.duration || 0),
          watched: util.sum(allLec, l => l.status === 'Completed' ? (l.duration || 0) : (l.watchedMin || 0))
        },
        tasks, revision: rev,
        time: Calc.studyTime(), streak: Calc.streak(),
        errors: { total: Store.state.errors.length, open: Store.state.errors.filter(e => e.status !== 'revised').length }
      };
    },
    taskBuckets() {
      const t = util.todayISO();
      const tasks = Store.state.tasks;
      const pending = tasks.filter(x => x.status !== 'done');
      const today = pending.filter(x => x.plannedFor === t && !x.inBacklog);
      const doneToday = tasks.filter(x => x.status === 'done' && x.completedAt && x.completedAt.slice(0, 10) === t);
      const backlog = pending.filter(x => x.inBacklog || x.plannedFor < t);
      const overdue = backlog.filter(x => x.inBacklog);
      const future = pending.filter(x => x.plannedFor > t);
      return {
        today, upcoming: future, backlog, overdue, doneToday,
        todayCount: today.length, backlogCount: backlog.length, overdueCount: overdue.length,
        todayMin: util.sum(today, x => x.estMin || 0), backlogMin: util.sum(backlog, x => x.estMin || 0),
        planned7: (function () { const m = {}; for (let i = 0; i < 7; i++) { const d = util.addDays(t, i); m[d] = util.sum(pending.filter(x => x.plannedFor === d), x => x.estMin || 0); } return m; })()
      };
    },
    /* auto-move unfinished tasks of previous days into backlog */
    sweepBacklog() {
      const t = util.todayISO();
      let moved = 0;
      Store.state.tasks.forEach(x => {
        if (x.status !== 'done' && !x.inBacklog && x.plannedFor && x.plannedFor < t) { x.inBacklog = true; x.backlogSince = t; moved++; }
      });
      Store.state.meta.lastSweep = t;
      return moved;
    },
    revisionBuckets(exam) {
      const out = { dueToday: [], overdue: [], upcoming: [], done: [] };
      Store.state.revisions.forEach(r => {
        if (exam && r.exam !== exam) return;
        if (r.completedAt) { out.done.push(r); return; }
        const d = util.daysFromToday(r.scheduledFor);
        if (d < 0) out.overdue.push(r); else if (d === 0) out.dueToday.push(r); else out.upcoming.push(r);
      });
      out.overdue.sort((a, b) => a.scheduledFor < b.scheduledFor ? -1 : 1);
      out.upcoming.sort((a, b) => a.scheduledFor < b.scheduledFor ? -1 : 1);
      out.dueToday.sort((a, b) => a.scheduledFor < b.scheduledFor ? -1 : 1);
      return out;
    },
    /* spaced repetition intervals (days) - user editable in the UI */
    SR_INTERVALS: [1, 3, 7, 16, 35],
    nextRevisionDate(nodeId, exam, count) {
      const iv = Calc.SR_INTERVALS[Math.min(Math.max(count, 0), Calc.SR_INTERVALS.length - 1)];
      return util.addDays(util.todayISO(), iv);
    },
    chapterStats(chapterId, exam) {
      exam = exam === 'ja' ? 'ja' : 'jm';
      const rec = Syl.rec(chapterId);
      if (!rec) return null;
      const ch = rec.chapter;
      const agg = Prog.agg(ch.id, exam);
      const jm = Prog.agg(ch.id, 'jm'), ja = Prog.agg(ch.id, 'ja');
      const topicRows = ch.topics.map(tp => {
        const a = Prog.agg(tp.id, exam);
        return { id: tp.id, name: tp.name, jm: tp.jm, ja: tp.ja, pct: a.pct, mastery: a.mastery, questions: a.questions, total: a.total, completed: a.completed, weak: a.weak, revDue: a.revDue, coverage: a.coverage };
      });
      const errs = Store.state.errors.filter(e => e.chapterId === ch.id);
      const sessions = Store.state.sessions.filter(s => s.chapterId === ch.id);
      return {
        chapter: ch, agg, jm, ja, topics: topicRows,
        jmPct: jm.pct, jaPct: ja.pct,
        errors: { total: errs.length, open: errs.filter(e => e.status !== 'revised').length, byType: util.groupBy(errs, e => e.mistakeType || 'Other') },
        timeMin: util.sum(sessions, s => s.minutes || 0),
        pyq: (function () { const q = agg.questions; return q.bySource.PYQ || 0; })()
      };
    },
    weakTopics(exam, limit) {
      const rows = [];
      Syl.subjects.forEach(s => s.chapters.forEach(ch => ch.topics.forEach(tp => {
        const a = Prog.agg(tp.id, exam);
        if (!a.total) return;
        const p = Prog.peek(tp.id, exam);
        const flagged = (p && p.weak) || a.weak > 0;
        const lowAcc = a.questions.attempted >= 8 && a.questions.accuracy < 60;
        const lowMastery = a.mastery < 45 && (a.completed > 0 || a.learning > 0);
        if (flagged || lowAcc || lowMastery) {
          rows.push({ id: tp.id, name: tp.name, chapter: ch.name, subject: s.name, code: s.code, acc: a.questions.accuracy, attempted: a.questions.attempted, mastery: a.mastery, reason: flagged ? 'Flagged weak' : lowAcc ? 'Low accuracy' : 'Low mastery' });
        }
      })));
      return util.sortBy(rows, r => r.mastery, 'asc').slice(0, limit || 8);
    },
    strongTopics(exam, limit) {
      const rows = [];
      Syl.subjects.forEach(s => s.chapters.forEach(ch => ch.topics.forEach(tp => {
        const a = Prog.agg(tp.id, exam);
        if (a.questions.attempted < 10 || a.questions.accuracy < 65) return;
        rows.push({ id: tp.id, name: tp.name, chapter: ch.name, subject: s.name, accuracy: a.questions.accuracy, attempted: a.questions.attempted, mastery: a.mastery });
      })));
      return util.sortBy(rows, r => r.accuracy, 'desc').slice(0, limit || 6);
    },
    errorPatterns() {
      const errs = Store.state.errors;
      const byType = util.groupBy(errs, e => e.mistakeType || 'Unspecified');
      const byTopic = util.groupBy(errs, e => e.topicId || 'none');
      const repeats = Object.keys(byTopic).filter(k => k !== 'none' && byTopic[k].length >= 2).map(k => {
        const rec = Syl.rec(k);
        return { topicId: k, name: rec ? rec.name : k, subject: rec ? rec.subject.name : '', count: byTopic[k].length, types: util.uniq(byTopic[k].map(e => e.mistakeType)) };
      }).sort((a, b) => b.count - a.count);
      const bySubject = util.groupBy(errs, e => e.subject || 'Unspecified');
      return { total: errs.length, byType, bySubject, repeats, open: errs.filter(e => e.status !== 'revised').length };
    },
    lectureStats(exam) {
      const all = Store.state.lectures.filter(l => !exam || !l.exam || l.exam === exam || l.exam === 'both');
      const bySubject = {};
      all.forEach(l => {
        const b = bySubject[l.subject] = bySubject[l.subject] || { subject: l.subject, total: 0, done: 0, minutes: 0, watched: 0 };
        b.total++; b.minutes += l.duration || 0;
        if (l.status === 'Completed') { b.done++; b.watched += l.duration || 0; } else b.watched += l.watchedMin || 0;
      });
      return {
        total: all.length, done: all.filter(l => l.status === 'Completed').length,
        inProgress: all.filter(l => l.status === 'In Progress').length,
        remaining: all.filter(l => l.status !== 'Completed').length,
        minutes: util.sum(all, l => l.duration || 0),
        watched: util.sum(all, l => l.status === 'Completed' ? (l.duration || 0) : (l.watchedMin || 0)),
        bySubject
      };
    },
    revisionConsistency() {
      // share of scheduled revisions (last 28 days) that were completed
      const from = util.addDays(util.todayISO(), -28);
      const rel = Store.state.revisions.filter(r => r.scheduledFor >= from);
      const done = rel.filter(r => r.completedAt);
      const late = done.filter(r => util.iso(new Date(r.completedAt)) > r.scheduledFor);
      const overdue = rel.filter(r => !r.completedAt && r.scheduledFor < util.todayISO());
      return { scheduled: rel.length, done: done.length, late: late.length, overdue: overdue.length, rate: rel.length ? Math.round((done.length / rel.length) * 100) : 0 };
    },
    testStats() {
      const tests = Store.state.tests.slice().sort((a, b) => a.date < b.date ? -1 : 1);
      const withPct = tests.map(t => Object.assign({}, t, { pct: t.maxMarks ? Math.round((t.score / t.maxMarks) * 100) : 0 }));
      const bySubject = {};
      tests.forEach(t => Object.keys(t.subjects || {}).forEach(k => {
        const s = t.subjects[k]; if (!s || !s.max) return;
        const b = bySubject[k] = bySubject[k] || { score: 0, max: 0, n: 0 };
        b.score += s.score || 0; b.max += s.max || 0; b.n++;
      }));
      Object.keys(bySubject).forEach(k => bySubject[k].pct = bySubject[k].max ? Math.round(bySubject[k].score / bySubject[k].max * 100) : 0);
      const diff = withPct.length >= 2 ? withPct[withPct.length - 1].pct - withPct[withPct.length - 2].pct : null;
      return { tests: withPct, bySubject, best: util.sortBy(withPct, t => t.pct, 'desc')[0] || null, latest: withPct[withPct.length - 1] || null, delta: diff };
    },
    /* subject distribution of study time */
    subjectTime(days) {
      const from = days ? util.addDays(util.todayISO(), -(days - 1)) : null;
      const out = {};
      Store.state.sessions.forEach(s => {
        const d = util.iso(new Date(s.start));
        if (from && d < from) return;
        out[s.subject || 'Other'] = (out[s.subject || 'Other'] || 0) + (s.minutes || 0);
      });
      return out;
    },
    /* recent accuracy trend (per logged question session) */
    accuracyTrend(n) {
      const qs = Store.state.questions.slice().sort((a, b) => (a.date + (a.ts || '')) < (b.date + (b.ts || '')) ? -1 : 1);
      const tail = qs.slice(-1 * (n || 10));
      return tail.map(q => ({ date: q.date, acc: q.attempted ? Math.round((q.correct / q.attempted) * 100) : 0, attempted: q.attempted || 0 }));
    },
    backlogTrend(n) {
      const t = util.todayISO();
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = util.addDays(t, -i);
        const openAtD = Store.state.tasks.filter(x => x.plannedFor <= d && !(x.status === 'done' && x.completedAt && x.completedAt.slice(0, 10) <= d)).length;
        out.push({ date: d, count: openAtD });
      }
      return out;
    },
    /* -------------------------------------------------- factual insights */
    insights(limit) {
      const out = [];
      const o = Calc.overall();
      const t = util.todayISO();
      Syl.subjects.forEach(s => {
        const st = Calc.subjectStats(s.code, 'jm');
        if (st.leaves - st.done > 0) out.push({ text: st.leaves - st.done + ' subtopics remain in ' + s.name + ' (JEE Main).', sub: true });
      });
      const rev = o.revision;
      const overdue = rev.overdue.length;
      if (overdue > 0) out.push({ text: overdue + ' revision' + (overdue > 1 ? 's are' : ' is') + ' overdue right now.', tone: 'warn' });
      const dueToday = rev.dueToday.length;
      if (dueToday > 0) out.push({ text: dueToday + ' revision' + (dueToday > 1 ? 's are' : ' is') + ' scheduled for today.' });
      if (o.tasks.backlogCount > 0) out.push({ text: o.tasks.backlogCount + ' task' + (o.tasks.backlogCount > 1 ? 's are' : ' is') + ' sitting in the backlog (' + util.minsToHM(o.tasks.backlogMin) + ' of planned work).', tone: 'warn' });
      // last 5 question sessions accuracy by subject
      Syl.subjects.forEach(s => {
        const qs = Store.state.questions.filter(q => q.subject === s.name).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-5);
        if (qs.length >= 3) {
          const a = util.sum(qs, q => q.attempted || 0), c = util.sum(qs, q => q.correct || 0);
          if (a > 0) out.push({ text: 'Your ' + s.name + ' accuracy over the last ' + qs.length + ' sessions is ' + Math.round(c / a * 100) + '%.' });
        }
      });
      // lecture vs practice gap
      const lec = o.lectures, dims = Calc.practiceCoverage();
      if (lec.total >= 5 && lec.done / lec.total > 0.65 && dims.practice < 0.35) out.push({ text: 'Lecture completion is ' + Math.round(lec.done / lec.total * 100) + '% but practice coverage is only ' + Math.round(dims.practice * 100) + '% - watching is ahead of solving.', tone: 'warn' });
      // advanced pending for strongest pending chapter
      const advLeft = o.advanced.remaining;
      if (advLeft > 0) out.push({ text: advLeft + ' subtopics of the JEE Advanced scope are still pending.' });
      // study time
      const time = o.time;
      if (time.today > 0) out.push({ text: 'You have logged ' + util.minsToHM(time.today) + ' today and ' + util.minsToHM(time.week) + ' in the last 7 days.' });
      const streak = o.streak;
      if (streak.current >= 2) out.push({ text: 'Current streak: ' + streak.current + ' day' + (streak.current > 1 ? 's' : '') + ' (best ' + streak.best + ').' });
      const weak = Calc.weakTopics(null, 1);
      if (weak.length) out.push({ text: 'Weakest area by mastery: ' + weak[0].name + ' (' + weak[0].chapter + ', ' + weak[0].subject + ') at ' + weak[0].mastery + '% mastery.' });
      const ep = Calc.errorPatterns();
      if (ep.repeats.length) out.push({ text: 'Repeated mistakes: ' + ep.repeats[0].count + ' errors logged in ' + ep.repeats[0].name + ' (' + ep.repeats[0].types.join(', ') + ').', tone: 'warn' });
      if (Object.keys(ep.byType).length) {
        const top = util.sortBy(Object.keys(ep.byType).map(k => ({ k, n: ep.byType[k].length })), x => x.n, 'desc')[0];
        out.push({ text: 'Most common mistake type: ' + top.k + ' (' + top.n + ' of ' + ep.total + ' logged errors).' });
      }
      const q = o.questions;
      if (q.attempted > 0) out.push({ text: 'Total questions attempted: ' + q.attempted + ' with ' + q.accuracy + '% accuracy (' + q.perQ + ' min/question).' });
      return limit ? out.slice(0, limit) : out;
    },
    practiceCoverage() {
      let dpp = 0, pyq = 0, practice = 0, theory = 0, lecture = 0, subj = { phy: 0, chem: 0, math: 0 };
      let total = 0;
      Syl.subjects.forEach(s => s.chapters.forEach(ch => ch.topics.forEach(tp => tp.subs.forEach(sb => {
        const p = Prog.get(sb.id, 'jm');
        total++;
        if (p.dpp === 'done') dpp++; else if (p.dpp === 'partial') dpp += .5;
        if (p.pyq === 'done') pyq++; else if (p.pyq === 'partial') pyq += .5;
        if (p.practice === 'done') practice++; else if (p.practice === 'partial') practice += .5;
        if (p.theory === 'done') theory++; else if (p.theory === 'partial') theory += .5;
        if (p.lecture === 'done') lecture++; else if (p.lecture === 'partial') lecture += .5;
      }))));
      const d = total || 1;
      return { dpp: dpp / d, pyq: pyq / d, practice: practice / d, theory: theory / d, lecture: lecture / d, total };
    }
  });

  /* ---------------------------------------------------------------- charts */
  const C = (App.charts = {
    ring(pct, opts) {
      opts = opts || {};
      const size = opts.size || 74, sw = opts.stroke || 9, r = (size - sw) / 2, c = 2 * Math.PI * r;
      const p = util.clamp(pct || 0, 0, 100);
      const col = opts.color || '#221C17';
      const track = opts.track || '#EFE7DA';
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" class="illus" role="img" aria-label="' + p + ' percent">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + track + '" stroke-width="' + sw + '"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + (c * p / 100) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
        '<text x="50%" y="50%" text-anchor="middle" dy="5" font-family="Trebuchet MS, sans-serif" font-size="' + (size / 4.1) + '" font-weight="800" fill="#221C17">' + (opts.label != null ? opts.label : p + '%') + '</text>' +
        '</svg>';
    },
    bars(items, opts) {
      // items: [{label, value, color}]
      opts = opts || {};
      const h = opts.height || 110, max = Math.max(1, ...items.map(i => i.value));
      const bw = 100 / Math.max(1, items.length);
      let s = '<svg viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">';
      items.forEach((it, i) => {
        const bh = (it.value / max) * (h - 18);
        s += '<rect x="' + (i * bw + bw * .18) + '" y="' + (h - 14 - bh) + '" width="' + (bw * .64) + '" height="' + Math.max(1.5, bh) + '" rx="1.6" fill="' + (it.color || '#221C17') + '" opacity="' + (it.value ? 1 : .25) + '"/>';
      });
      s += '</svg><div class="row" style="gap:0;justify-content:space-between">' +
        items.map(it => '<div class="xsmall muted center" style="flex:1;white-space:nowrap;overflow:hidden;font-size:10px">' + util.esc(it.label) + '</div>').join('') + '</div>';
      return s;
    },
    hbars(items, opts) {
      opts = opts || {};
      const max = Math.max(1, ...items.map(i => i.value));
      return items.map(it => '<div style="margin-bottom:7px">' +
        '<div class="row" style="gap:8px"><div class="small bold" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + util.esc(it.label) + '</div>' +
        '<div class="small bold">' + String(it.valueText != null ? it.valueText : it.value).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;') + '</div></div>' +
        '<div class="pbar thin" style="margin-top:3px"><i style="width:' + ((it.value / max) * 100) + '%;background:' + (it.color || '#221C17') + '"></i></div></div>').join('');
    },
    line(points, opts) {
      // points: [{label, value}]
      opts = opts || {};
      const h = opts.height || 120, w = 300, n = points.length;
      if (!n) return '<div class="empty small">No data yet</div>';
      const max = Math.max(opts.max || 0, ...points.map(p => p.value), 1);
      const px = i => n === 1 ? w / 2 : (i / (n - 1)) * (w - 8) + 4;
      const py = v => h - 22 - (v / max) * (h - 34);
      const d = points.map((p, i) => (i ? 'L' : 'M') + px(i) + ' ' + py(p.value)).join(' ');
      let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px">';
      s += '<line x1="0" y1="' + (h - 22) + '" x2="' + w + '" y2="' + (h - 22) + '" stroke="#E4D9C6" stroke-width="1.5"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + (opts.color || '#221C17') + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      points.forEach((p, i) => { s += '<circle cx="' + px(i) + '" cy="' + py(p.value) + '" r="3.4" fill="#fff" stroke="' + (opts.color || '#221C17') + '" stroke-width="2"/>'; });
      s += '</svg><div class="row" style="justify-content:space-between"><div class="xsmall muted">' + util.esc(points[0].label) + '</div>' +
        (n > 2 ? '<div class="xsmall muted">' + util.esc(points[Math.floor(n / 2)].label) + '</div>' : '') +
        '<div class="xsmall muted">' + util.esc(points[n - 1].label) + '</div></div>';
      return s;
    },
    stacked(parts, opts) {
      const total = util.sum(parts, p => p.value) || 1;
      return '<div class="row" style="gap:3px;height:16px">' + parts.map(p =>
        '<div title="' + util.esc(p.label) + '" style="flex:' + (p.value / total) + ';background:' + p.color + ';border:1.5px solid #221C17;border-radius:8px;min-width:' + (p.value ? 6 : 0) + 'px"></div>').join('') + '</div>' +
        '<div class="row wrap" style="gap:10px;margin-top:8px">' + parts.map(p => '<div class="xsmall row" style="gap:5px"><span class="dot" style="background:' + p.color + '"></span>' + util.esc(p.label) + ' <b>' + Math.round(p.value / total * 100) + '%</b></div>').join('') + '</div>';
    },
    heatmap(days) {
      // days: [{date, activities}]
      const levels = d => d.activities >= 4 ? 4 : d.activities >= 2.5 ? 3 : d.activities >= 1 ? 2 : d.activities > 0 ? 1 : 0;
      return '<div class="heat scrollx">' + days.map(d => '<i data-l="' + levels(d) + '" title="' + d.date + ' - ' + d.activities.toFixed(1) + ' actions, ' + Math.round(d.minutes) + ' min"></i>').join('') + '</div>';
    }
  });

  /* ---------------------------------------------------------------- notify */
  App.toast = function (msg, ms) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms || 2200);
  };

  App.initCore = function (syllabusData) {
    Syl.init(syllabusData);
    Store.load();
  };
})(typeof window !== 'undefined' ? window : globalThis);
