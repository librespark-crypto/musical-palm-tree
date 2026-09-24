/* Headless smoke test: boots the built app in jsdom, walks every route,
   performs real mutations, and fails loudly on any runtime error. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'jee-tracker.html'), 'utf8');
const errors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/',
  virtualConsole: new (require('jsdom').VirtualConsole)()
    .on('jsdomError', e => { const m = String(e && e.message || e); if (m.indexOf('Not implemented') < 0) errors.push('jsdomError: ' + (e.stack || m)); })
    .on('error', (...a) => errors.push('console.error: ' + a.join(' ')))
});
const { window } = dom;
window.addEventListener('error', e => errors.push('window error: ' + e.message));

function run(label, fn) {
  try { fn(); } catch (e) { errors.push(label + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
const go = (hash) => { window.location.hash = hash; run('route ' + hash, () => window.App.router.render()); };

let App;
function startTests() {
App = window.App;
if (!App || !App.syl.data) { console.log('FATAL: App not booted', !!App); process.exit(1); }

console.log('syllabus:', Object.keys(App.syl.index).length, 'indexed nodes');
console.log('meta:', App.syl.data.meta.mainYear, App.syl.data.meta.advancedYear, App.syl.data.meta.retrieved);

/* ---- empty-state routes ---- */
['#/home', '#/syllabus', '#/syllabus/chem', '#/syllabus/math', '#/tasks', '#/tasks/week', '#/tasks/backlog',
 '#/topics-left', '#/lectures', '#/revision', '#/questions', '#/errors', '#/tests', '#/timer',
 '#/analytics', '#/analytics/subjects', '#/analytics/chapters', '#/analytics/topics', '#/analytics/questions',
 '#/analytics/lectures', '#/analytics/revision', '#/analytics/errors', '#/analytics/tests',
 '#/gemini', '#/profile', '#/profile/provenance', '#/search',
 '#/topic/phy.c4.t1', '#/topic/phy.c4.t1.s1', '#/chapter/phy.c4', '#/search?q=integration'
].forEach(go);

/* ---- real mutations on an empty tracker ---- */
run('quick status jm', () => App.mut.quickStatus('phy.c1.t0', 'jm', 'completed'));
run('quick status ja (independence)', () => App.mut.quickStatus('phy.c1.t0', 'ja', 'learning'));
const jmPct = App.prog.agg('phy.c1.t0', 'jm').pct, jaPct = App.prog.agg('phy.c1.t0', 'ja').pct;
console.log('independence check -> JM', jmPct + '%', 'JA', jaPct + '%');
if (!(jmPct === 100 && jaPct < 100)) errors.push('JM/JA independence failed: JM=' + jmPct + ' JA=' + jaPct);

run('add task', () => window.App.store.update(st => st.tasks.push({
  id: 't1', title: 'Test task', type: 'PYQ', subject: 'Physics', chapterId: 'phy.c1', topicId: 'phy.c1.t0',
  nodeId: 'phy.c1.t0.s0', exam: 'jm', estMin: 60, priority: 'High', plannedFor: window.App.util.todayISO(),
  status: 'pending', completedAt: null, inBacklog: false, createdAt: new Date().toISOString()
})));
run('complete task', () => App.mut.taskDone('t1'));

run('log questions', () => window.App.store.update(st => st.questions.push({
  id: 'q1', date: window.App.util.todayISO(), source: 'PYQ', subject: 'Physics', chapterId: 'phy.c2',
  topicId: 'phy.c2.t0', nodeId: 'phy.c2.t0.s0', exam: 'ja', difficulty: 'Hard',
  attempted: 20, correct: 13, wrong: 7, unattempted: 1, timeMin: 40, accuracy: 65, ts: new Date().toISOString()
})));
run('add lecture', () => window.App.store.update(st => st.lectures.push({
  id: 'l1', subject: 'Physics', chapterId: 'phy.c4', topicId: 'phy.c4.t0', title: 'Rotational lecture 1',
  number: 1, duration: 70, source: 'Test', status: 'Completed', watchedMin: 70, exam: 'jm', date: window.App.util.todayISO()
})));
run('add revision + complete', () => {
  window.App.store.update(st => st.revisions.push({
    id: 'r1', nodeId: 'phy.c1.t0.s0', topicId: 'phy.c1.t0', topicName: 'Units and Systems of Units',
    chapterName: 'Units and Measurements', subject: 'Physics', exam: 'jm', index: 1,
    scheduledFor: window.App.util.todayISO(), completedAt: null, auto: true, createdAt: new Date().toISOString()
  }));
  App.mut.revisionDone('r1');
});
run('add error', () => window.App.store.update(st => st.errors.push({
  id: 'e1', date: window.App.util.todayISO(), questionText: 'Wrong sign in torque', subject: 'Physics',
  chapterId: 'phy.c4', topicId: 'phy.c4.t1', nodeId: 'phy.c4.t1.s0', exam: 'ja', mistakeType: 'Silly mistake',
  correctConcept: 'Choose sign convention first', note: 'note', status: 'open', revisions: 0, createdAt: new Date().toISOString()
})));
run('add test', () => window.App.store.update(st => st.tests.push({
  id: 'x1', name: 'Smoke Test', date: window.App.util.todayISO(), exam: 'jm', score: 180, maxMarks: 300,
  attempted: 60, correct: 45, wrong: 15, unattempted: 15, timeMin: 180, accuracy: 75,
  subjects: { phy: { score: 60, max: 100 }, chem: { score: 62, max: 100 }, math: { score: 58, max: 100 } },
  notes: '', createdAt: new Date().toISOString()
})));
run('add session', () => window.App.store.update(st => st.sessions.push({
  id: 's1', mode: 'Practice', subject: 'Chemistry', chapterId: 'chem.c1', topicId: 'chem.c1.t0',
  start: new Date(Date.now() - 3600000).toISOString(), end: new Date().toISOString(), minutes: 60
})));
run('ensure revisions auto', () => window.App.ensureRevisions([{ id: 'phy.c2.t0.s0' }], 'ja'));

/* ---- re-render everything with data present ---- */
['#/home', '#/syllabus', '#/tasks', '#/tasks/week', '#/tasks/backlog', '#/topics-left', '#/lectures', '#/revision',
 '#/questions', '#/errors', '#/tests', '#/timer', '#/analytics/overview', '#/analytics/subjects', '#/analytics/chapters',
 '#/analytics/topics', '#/analytics/questions', '#/analytics/lectures', '#/analytics/revision', '#/analytics/errors',
 '#/analytics/tests', '#/profile', '#/profile/provenance', '#/gemini', '#/chapter/phy.c4', '#/topic/phy.c4.t1'
].forEach(go);

/* ---- analytics math sanity ---- */
run('overall', () => {
  const o = App.calc.overall();
  console.log('overall ->', JSON.stringify({
    jm: o.main.pct, ja: o.advanced.pct, questions: o.questions.attempted, acc: o.questions.accuracy,
    lectures: o.lectures.done + '/' + o.lectures.total, streak: o.streak.current, backlog: o.tasks.backlogCount
  }));
  if (o.questions.attempted !== 20) errors.push('question aggregate wrong: ' + o.questions.attempted);
  if (o.questions.accuracy !== 65) errors.push('accuracy wrong: ' + o.questions.accuracy);
});
run('insights', () => { const i = App.calc.insights(); console.log('insights:', i.length); i.forEach(x => console.log('  -', x.text)); });
run('chapter stats', () => { const c = App.calc.chapterStats('phy.c4'); console.log('chapter phy.c4 topics:', c.topics.length, 'mastery', c.agg.mastery); });
run('local recommend', () => {
  const r = App.gemini.localRecommend({});
  console.log('local recommender items:', r.items.length, '| used', r.usedMinutes, 'min');
  r.items.forEach(i => console.log('  >', i.priority, i.title, '-', i.reason.slice(0, 70)));
});
run('tracker context size', () => { const c = App.gemini.trackerContext(); console.log('ai context keys:', Object.keys(c).length, '| json KB', (JSON.stringify(c).length / 1024).toFixed(1)); });
run('search integration', () => { const s = App.syl.search('integration'); console.log('search integration ->', s.chapters.length, 'chapters,', s.topics.length, 'topics,', s.subs.length, 'subtopics'); });
run('badges present', () => {
  const rec = App.syl.rec('phy.c19.t0'); // Electronic devices = JM only
  console.log('Electronic Devices badges -> jm:', rec.chapter.jm, 'ja:', rec.chapter.ja);
  if (!(rec.chapter.jm && !rec.chapter.ja)) errors.push('expected Electronic Devices to be JM only');
  const solid = App.syl.rec('chem.c9'); // Solid State = JA only
  console.log('Solid State badges -> jm:', solid.chapter.jm, 'ja:', solid.chapter.ja);
  if (!(solid.chapter.ja && !solid.chapter.jm)) errors.push('expected Solid State to be JA only');
});
run('sample data load', () => { App.sample.load(); App.router.render(); const o = App.calc.overall(); console.log('sample -> JM', o.main.pct + '%', 'JA', o.advanced.pct + '%', 'tasks', window.App.store.state.tasks.length, 'errors', o.errors.total); });
['#/home', '#/syllabus', '#/tasks/backlog', '#/analytics/overview', '#/analytics/tests', '#/topics-left'].forEach(go);
run('sample clear', () => App.sample.clear());

run('export/import roundtrip', () => {
  const json = App.store.exportJSON();
  App.store.importJSON(json);
  console.log('export KB', (json.length / 1024).toFixed(1));
});

  
/* ---- DOM integrity: no leaked markup as visible text, no orphan blocks ---- */
run('dom integrity', () => {
  const routes = ['#/home','#/syllabus','#/syllabus/chem','#/syllabus/math','#/tasks','#/tasks/week','#/tasks/backlog',
    '#/topics-left','#/lectures','#/revision','#/questions','#/errors','#/tests','#/timer','#/analytics','#/analytics/topics',
    '#/analytics/chapters','#/analytics/lectures','#/analytics/revision','#/analytics/errors','#/analytics/tests',
    '#/gemini','#/profile','#/profile/provenance','#/search?q=moment','#/chapter/phy.c4','#/topic/phy.c4.t1','#/topic/phy.c4.t1.s1'];
  const bad = [];
  routes.forEach(r => {
    window.location.hash = r;
    window.App.router.render();
    const scr = window.document.getElementById('screen');
    const txt = scr.textContent || '';
    ['"></span>', '">', '</div>', 'undefined', 'NaN', '[object Object]', '&middot;', '&amp;', '&rsaquo;', '&mdash;', '&bull;', '&ldquo;'].forEach(pat => {
      if (txt.indexOf(pat) >= 0) bad.push(r + ' leaks "' + pat + '"');
    });
    // orphaned topic rows must live inside a chapter accordion body
    scr.querySelectorAll('.topicrow').forEach(tr => { if (!tr.closest('.acc-b')) bad.push(r + ': topicrow outside .acc-b'); });
    scr.querySelectorAll('.subrow').forEach(sr => { if (!sr.closest('.acc-b, .card')) bad.push(r + ': subrow orphan'); });
  });
  if (bad.length) bad.slice(0, 10).forEach(b => errors.push('DOM: ' + b));
  else console.log('dom integrity ok across ' + routes.length + ' routes');
});


run('no undefined exam buckets in progress', () => {
  window.App.sample.load();
  App.calc.chapterStats('phy.c4');           // called without an exam scope
  App.prog.agg('phy.c4');
  App.prog.get('phy.c0.t0.s0');
  const bad = Object.keys(window.App.store.state.progress).filter(id => {
    const rec = window.App.store.state.progress[id];
    return Object.keys(rec).some(k => k !== 'jm' && k !== 'ja');
  });
  if (bad.length) errors.push('progress stored under invalid exam keys: ' + bad.slice(0, 3).join(', '));
  else console.log('scope keys clean; phy.c4 JM pct =', App.prog.agg('phy.c4', 'jm').pct + '%');
});

  setTimeout(finish, 600);
}

function finish() {
  if (errors.length) {
    console.log('\n=== ' + errors.length + ' ERRORS ===');
    errors.slice(0, 25).forEach(e => console.log('* ' + e));
    process.exit(1);
  } else {
    console.log('\nAll smoke checks passed.');
    process.exit(0);
  }
}

if (window.document.readyState === 'complete') setTimeout(startTests, 50);
else window.addEventListener('load', () => setTimeout(startTests, 50));
