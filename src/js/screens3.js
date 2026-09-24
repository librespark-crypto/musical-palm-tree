/* ==========================================================================
   screens3.js - Error Book, Mock Tests, Study Timer, Analytics, Gemini, Profile, Search
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc, B = App.ui, I = App.icons, G = App.gemini;
  const Sc = App.screens;

  /* ========================================================= ERROR BOOK */
  Sc.errors = function () {
    const ep = Calc.errorPatterns();
    const f = B.filters.err = B.filters.err || { subject: '', type: '', status: 'all' };
    const list = S.state.errors.filter(e => (!f.subject || e.subject === f.subject) && (!f.type || e.mistakeType === f.type) && (f.status === 'all' || e.status === f.status))
      .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
    let html = '<div class="grid3">' + B.kpi('Total errors', ep.total, '') + B.kpi('Open', ep.open, 'not revised yet') + B.kpi('Repeats', ep.repeats.length, 'topic patterns') + '</div>';
    html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>' + I.cross + ' Error Book</h3><button class="btn sm" data-act="fab-error">+ Error</button></div>' +
      (ep.total ? App.charts.hbars(Object.keys(ep.byType).map(k => ({ label: k, value: ep.byType[k].length, color: ['Conceptual', 'Wrong approach'].indexOf(k) >= 0 ? '#F8A79F' : ['Calculation', 'Formula'].indexOf(k) >= 0 ? '#FFD873' : '#C3D8FA' }))) : B.empty('No errors logged. Add mistakes with text, image, screenshot or a voice note.', '&#128221;')) +
      '<div class="hr"></div>' +
      '<div class="small bold" style="margin-bottom:6px">Repeated mistake patterns</div>' +
      (ep.repeats.length ? ep.repeats.slice(0, 8).map(r => '<div class="row between" style="margin-bottom:6px"><span class="small"><b>' + U.esc(r.name) + '</b> <span class="muted">' + U.esc(r.subject) + '</span><br><span class="xsmall muted">' + U.esc(r.types.join(', ')) + '</span></span><span class="st st-weak">' + r.count + 'x</span></div>').join('')
        : '<div class="small muted">No repeats detected yet (a topic needs 2+ errors).</div>') +
      '</div>';
    html += '<div class="chips">' + [['', 'All subjects']].concat(Syl.subjects.map(s => [s.name, B.shortSub(s.name)])).map(([v, l]) => '<button class="pill tap ' + (f.subject === v ? 'on' : '') + '" data-act="err-filter" data-k="subject" data-v="' + U.esc(v) + '">' + l + '</button>').join('') + '</div>';
    html += '<div class="chips">' + [['', 'All types']].concat(Prog.MISTAKE_TYPES.map(t => [t, t])).map(([v, l]) => '<button class="pill tap ' + (f.type === v ? 'on' : '') + '" data-act="err-filter" data-k="type" data-v="' + U.esc(v) + '">' + l + '</button>').join('') + '</div>';
    html += '<div class="chips">' + [['all', 'All'], ['open', 'Open'], ['revised', 'Revised'], ['mastered', 'Mastered']].map(([v, l]) => '<button class="pill tap ' + (f.status === v ? 'on' : '') + '" data-act="err-filter" data-k="status" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
    html += list.length ? list.slice(0, 40).map(e => {
      const rec = e.nodeId ? Syl.rec(e.nodeId) : null;
      return '<div class="card"><div class="between"><div class="row" style="gap:6px">' + B.badgeFor(e.exam || 'jm') +
        '<span class="st ' + (e.status === 'mastered' ? 'st-completed' : e.status === 'revised' ? 'st-learning' : 'st-weak') + '">' + U.esc(e.status || 'open') + '</span>' +
        '<span class="pill soft">' + U.esc(e.mistakeType || '') + '</span></div>' +
        '<div class="xsmall muted">' + U.fmtDate(e.date, 'short') + (e.revisions ? ' &middot; revised ' + e.revisions + 'x' : '') + '</div></div>' +
        '<div class="small bold" style="margin-top:6px">' + U.esc(rec ? rec.name : (e.subject || '')) + '</div>' +
        '<div class="xsmall muted">' + U.esc(rec ? rec.subject.name + ' &middot; ' + rec.chapter.name : '') + '</div>' +
        (e.questionText ? '<div class="small" style="margin-top:6px">' + U.esc(e.questionText) + '</div>' : '') +
        (e.image ? '<img class="err-img" src="' + e.image + '" alt="error screenshot">' : '') +
        (e.voiceNote ? '<audio class="voice" controls src="' + e.voiceNote + '"></audio>' : '') +
        (e.correctConcept ? '<div class="note" style="margin-top:8px"><b>Correct concept:</b> ' + U.esc(e.correctConcept) + '</div>' : '') +
        (e.note ? '<div class="xsmall muted" style="margin-top:6px">' + U.esc(e.note) + '</div>' : '') +
        '<div class="btnrow" style="margin-top:9px">' +
        '<button class="btn sm" data-act="err-status" data-id="' + e.id + '" data-v="revised">Revised</button>' +
        '<button class="btn sm" data-act="err-status" data-id="' + e.id + '" data-v="mastered">Mastered</button>' +
        '<button class="btn sm ghost" data-act="err-ask" data-id="' + e.id + '">' + I.spark + ' Explain this mistake</button>' +
        '<button class="btn sm ghost" data-act="err-edit" data-id="' + e.id + '">Edit</button>' +
        '<button class="btn sm ghost" data-act="err-del" data-id="' + e.id + '">Delete</button></div></div>';
    }).join('') : '<div class="card">' + B.empty('No error entries match these filters.', '&#128221;') + '</div>';
    return { title: 'Error Book', sub: 'mistakes, patterns, fixes', back: true, html };
  };
  B.action('err-filter', el => { B.filters.err[el.getAttribute('data-k')] = el.getAttribute('data-v'); App.refresh(); });
  B.action('err-status', el => App.mut.errorStatus(el.getAttribute('data-id'), el.getAttribute('data-v')));
  B.action('err-edit', el => { const e = S.state.errors.find(x => x.id === el.getAttribute('data-id')); if (e) App.forms.error(e); });
  B.action('err-del', el => App.mut.errorDelete(el.getAttribute('data-id')));
  B.action('err-ask', el => {
    const e = S.state.errors.find(x => x.id === el.getAttribute('data-id'));
    if (!e) return;
    location.hash = '#/gemini?q=' + encodeURIComponent('Explain my mistake. Question: ' + (e.questionText || '') + ' | Mistake type: ' + e.mistakeType + ' | My note: ' + (e.note || '') + ' | Correct concept I recorded: ' + (e.correctConcept || ''));
  });

  /* =============================================================== TESTS */
  Sc.tests = function () {
    const ts = Calc.testStats();
    let html = '<div class="card"><div class="card-h"><h3>' + I.chart + ' Mock test tracker</h3><button class="btn sm" data-act="fab-test">+ Test</button></div>' +
      (ts.tests.length ? '<div class="grid3">' + B.kpi('Tests', ts.tests.length, '') + B.kpi('Latest', ts.latest ? ts.latest.pct + '%' : '-', ts.latest ? ts.latest.score + '/' + ts.latest.maxMarks : '') +
        B.kpi('Best', ts.best ? ts.best.pct + '%' : '-', ts.best ? ts.best.name.slice(0, 18) : '') + '</div>' +
        (ts.delta != null ? '<div class="banner ' + (ts.delta >= 0 ? 'info' : 'err') + '" style="margin-top:10px">' +
          (ts.delta >= 0 ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l5-6 4 3 6-8"/><path d="M15 6h4v4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 6 4-3 6 8"/><path d="M15 18h4v-4"/></svg>') +
          '<div>Latest test is <b>' + (ts.delta >= 0 ? '+' : '') + ts.delta + ' percentage points</b> compared with the previous test.</div></div>' : '')
        : B.empty('No mock tests logged yet.', '&#128203;')) + '</div>';
    if (ts.tests.length) {
      html += '<div class="card"><div class="card-h"><h3>Score trend</h3><span class="mini">% of max marks</span></div>' +
        App.charts.line(ts.tests.slice(-8).map(t => ({ label: U.fmtDate(t.date, 'short'), value: t.pct })), { max: 100, color: '#6E9BE0' }) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Subject-wise performance</h3></div>' +
        App.charts.hbars(Object.keys(ts.bySubject).map(k => ({ label: k === 'phy' ? 'Physics' : k === 'chem' ? 'Chemistry' : 'Mathematics', value: ts.bySubject[k].pct, valueText: ts.bySubject[k].score + '/' + ts.bySubject[k].max + ' (' + ts.bySubject[k].pct + '%)', color: k === 'phy' ? '#C3D8FA' : k === 'chem' ? '#BFE9CD' : '#FBD2A9' }))) + '</div>';
      html += ts.tests.slice().reverse().map(t => '<div class="card"><div class="between"><div><div class="bold">' + U.esc(t.name) + '</div>' +
        '<div class="xsmall muted">' + U.fmtDate(t.date, 'long') + ' &middot; ' + (t.exam === 'ja' ? 'JEE Advanced' : 'JEE Main') + ' pattern</div></div>' +
        '<div class="center"><div class="count" style="font-size:18px">' + t.score + '/' + t.maxMarks + '</div><div class="xsmall muted">' + t.pct + '%</div></div></div>' +
        '<div class="grid3" style="margin-top:9px">' + B.kpi('Attempted', t.attempted, '') + B.kpi('Correct', t.correct, t.accuracy + '% acc') + B.kpi('Wrong', t.wrong, '') + '</div>' +
        '<div class="grid3" style="margin-top:8px">' + B.kpi('Unattempted', t.unattempted, '') + B.kpi('Time', U.minsToHM(t.timeMin), '') + B.kpi('Score %', t.pct + '%', '') + '</div>' +
        (t.notes ? '<div class="note" style="margin-top:9px">' + U.esc(t.notes) + '</div>' : '') +
        (function () {
          // chapter/topic-wise performance for this test, from questions logged with source = Mock Test on the same date
          const logs = S.state.questions.filter(x => x.source === 'Mock Test' && x.date === t.date);
          if (!logs.length) return '<div class="xsmall muted" style="margin-top:9px">Chapter/topic-wise breakdown: log this test\'s questions in the Question tracker with source &ldquo;Mock Test&rdquo; and date ' + U.fmtDate(t.date, 'short') + ' to see per-chapter accuracy here.</div>';
          const byCh = {};
          logs.forEach(x => {
            const rec = x.chapterId ? Syl.rec(x.chapterId) : null;
            const k = rec ? rec.chapter.name : (x.subject || 'Unassigned');
            byCh[k] = byCh[k] || { a: 0, c: 0 };
            byCh[k].a += x.attempted || 0; byCh[k].c += x.correct || 0;
          });
          return '<div class="hr"></div><div class="small bold" style="margin-bottom:5px">Chapter-wise performance (from ' + logs.length + ' logged logs)</div>' +
            App.charts.hbars(Object.keys(byCh).map(k => ({ label: k, value: byCh[k].a ? Math.round(byCh[k].c / byCh[k].a * 100) : 0, valueText: byCh[k].c + '/' + byCh[k].a + ' correct (' + (byCh[k].a ? Math.round(byCh[k].c / byCh[k].a * 100) : 0) + '%)', color: (byCh[k].a && byCh[k].c / byCh[k].a < .5) ? '#F8A79F' : '#9FDFB1' })));
        })() +
        '<div class="btnrow" style="margin-top:9px"><button class="btn sm" data-act="fab-question">Log this test\'s questions</button><button class="btn sm" data-act="test-edit" data-id="' + t.id + '">Edit</button>' +
        '<button class="btn sm primary" data-act="test-analyse" data-id="' + t.id + '">' + I.spark + ' Analyze with Gemini</button>' +
        '<button class="btn sm ghost" data-act="test-del" data-id="' + t.id + '">Delete</button></div></div>').join('');
    }
    return { title: 'Mock Tests', sub: 'scores, accuracy, analysis', back: true, html };
  };
  B.action('test-edit', el => { const t = S.state.tests.find(x => x.id === el.getAttribute('data-id')); if (t) App.forms.test(t); });
  B.action('test-del', el => App.mut.deleteEntity('tests', el.getAttribute('data-id')));
  B.action('test-analyse', el => {
    const t = S.state.tests.find(x => x.id === el.getAttribute('data-id'));
    location.hash = '#/gemini?q=' + encodeURIComponent('Analyze this mock test: ' + t.name + ' (' + U.fmtDate(t.date) + ', score ' + t.score + '/' + t.maxMarks + ', accuracy ' + t.accuracy + '%). Subject-wise: ' + JSON.stringify(t.subjects) + '. Use my stored tracker data and tell me exactly what to fix.');
  });

  /* ============================================================== TIMER */
  App.timer = {
    start(opts) {
      S.update(st => {
        st.timer.running = true;
        st.timer.startedAt = new Date().toISOString();
        Object.assign(st.timer, opts || {});
      }, { now: true });
      App.refresh(); App.toast('Timer started');
    },
    stop() {
      const t = S.state.timer;
      if (!t.running || !t.startedAt) return;
      const mins = Math.max(1, Math.round((Date.now() - new Date(t.startedAt).getTime()) / 60000));
      S.update(st => {
        st.sessions.push({
          id: U.uid('ses'), mode: t.mode, subject: t.subject, chapterId: t.chapterId, topicId: t.topicId,
          start: t.startedAt, end: new Date().toISOString(), minutes: mins
        });
        st.timer.running = false; st.timer.startedAt = null;
      }, { now: true });
      if (t.topicId) App.logTimeFor(t.topicId, 'jm', mins);
      App.refresh(); App.toast('Session saved: ' + U.minsToHM(mins));
    },
    cancel() {
      S.update(st => { st.timer.running = false; st.timer.startedAt = null; }, { now: true });
      App.refresh(); App.toast('Timer cancelled');
    },
    elapsedMin() {
      const t = S.state.timer;
      if (!t.running || !t.startedAt) return 0;
      return (Date.now() - new Date(t.startedAt).getTime()) / 60000;
    }
  };

  Sc.timer = function () {
    const t = S.state.timer;
    const elapsed = App.timer.elapsedMin();
    const today = S.state.sessions.filter(s => U.iso(new Date(s.start)) === U.todayISO());
    let html = '<div class="card center" style="padding:22px 16px">' +
      '<div class="xsmall bold muted">STUDY TIMER</div>' +
      '<div id="bigclock" class="count" style="font-size:46px;letter-spacing:-.03em">' + U.minsToClock(t.running ? elapsed : 0) + '</div>' +
      '<div class="small muted" id="clockmeta">' + (t.running ? U.esc(t.mode) + ' &middot; ' + U.esc(t.subject || '') + ' &middot; started ' + new Date(t.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Idle - start when you begin') + '</div>' +
      '<div class="btnrow center" style="justify-content:center;margin-top:14px">' +
      (t.running ? '<button class="btn primary" data-act="timer-stop">' + I.stop + ' Stop &amp; save</button><button class="btn ghost" data-act="timer-cancel">Cancel</button>'
        : '<button class="btn primary" data-act="timer-start">' + I.play + ' Start</button>') +
      '</div></div>';
    html += '<div class="card"><div class="card-h"><h3>Session setup</h3></div>' +
      '<div class="two">' + B.field('Mode', B.seg('tmode', ['Lecture', 'Practice', 'Revision', 'PYQ', 'Mock Test', 'Other'].map(m => ({ value: m, label: m })), t.mode)) + '</div>' +
      '<div class="two">' + B.field('Subject', B.seg('tsub', Syl.subjects.map(s => ({ value: s.name, label: B.shortSub(s.name) })), t.subject || 'Physics')) + '</div>' +
      B.field('Chapter', B.select('tchap', [{ value: '', label: '- none -' }].concat(Syl.byCode[(Syl.subjects.find(s => s.name === (t.subject || 'Physics')) || {}).code] ? Syl.byCode[Syl.subjects.find(s => s.name === (t.subject || 'Physics')).code].chapters.map(c => ({ value: c.id, label: c.name })) : []), t.chapterId || '')) +
      B.field('Topic', '<select name="ttopic"><option value="">- none -</option></select>') +
      '<button class="btn sm primary" data-act="timer-apply">Apply setup</button></div>';
    html += '<div class="card"><div class="card-h"><h3>Today&rsquo;s sessions</h3><span class="mini">' + U.minsToHM(U.sum(today, s => s.minutes)) + '</span></div>' +
      (today.length ? today.map(s => '<div class="li" style="margin-bottom:7px"><div class="ico">' + I.clock + '</div><div class="bd"><div class="t">' + U.esc(s.mode) + ' &middot; ' + U.esc(s.subject || '') + '</div>' +
        '<div class="s">' + new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' &middot; ' + U.minsToHM(s.minutes) + (s.topicId && Syl.rec(s.topicId) ? ' &middot; ' + U.esc(Syl.rec(s.topicId).name) : '') + '</div></div></div>').join('')
        : B.empty('No sessions logged today.', '&#9201;')) +
      '<div class="btnrow" style="margin-top:10px"><button class="btn sm" data-act="fab-session">+ Log time manually</button><a class="btn sm" href="#/analytics/overview">See time analytics</a></div></div>';
    return {
      title: 'Study Timer', sub: 'lecture / practice / revision / PYQ', back: true, html,
      after: function (root) {
        const chapSel = root.querySelector('[name="tchap"]');
        const topSel = root.querySelector('[name="ttopic"]');
        const fillTopics = (keep) => {
          const rec = t.chapterId ? Syl.rec(t.chapterId) : null;
          topSel.innerHTML = '<option value="">- none -</option>' + (rec ? rec.chapter.topics.map(x => '<option value="' + x.id + '">' + U.esc(x.name) + '</option>').join('') : '');
          if (keep) topSel.value = keep;
        };
        fillTopics(t.topicId);
        root.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
          const b = e.target.closest('[data-segval]'); if (!b) return;
          seg.querySelectorAll('.pill').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          const h = seg.parentElement.querySelector('input[type="hidden"][name="' + seg.getAttribute('data-seg') + '"]');
          if (h) h.value = b.getAttribute('data-segval');
        }));
        chapSel.addEventListener('change', () => fillTopics(''));
      }
    };
  };
  B.action('timer-start', () => {
    const card = document.querySelector('.screen');
    const mode = card.querySelector('[name="tmode"]').value, subject = card.querySelector('[name="tsub"]').value;
    const chapterId = card.querySelector('[name="tchap"]').value;
    App.timer.start({ mode, subject, chapterId, topicId: card.querySelector('[name="ttopic"]').value });
  });
  B.action('timer-stop', () => App.timer.stop());
  B.action('timer-cancel', () => App.timer.cancel());
  B.action('timer-apply', () => {
    const card = document.querySelector('.screen');
    S.update(st => {
      st.timer.mode = card.querySelector('[name="tmode"]').value;
      st.timer.subject = card.querySelector('[name="tsub"]').value;
      st.timer.chapterId = card.querySelector('[name="tchap"]').value;
      st.timer.topicId = card.querySelector('[name="ttopic"]').value;
    }, { now: true });
    App.refresh(); App.toast('Timer setup saved');
  });

  /* ========================================================== ANALYTICS */
  Sc.analytics = function (parts) {
    const tab = parts[0] || 'overview';
    const tabs = ['overview', 'subjects', 'chapters', 'topics', 'questions', 'lectures', 'revision', 'errors', 'tests'];
    const o = Calc.overall();
    let html = '<div class="chips">' + tabs.map(t2 => '<a class="pill ' + (tab === t2 ? 'on' : '') + '" href="#/analytics/' + t2 + '">' + t2.charAt(0).toUpperCase() + t2.slice(1) + '</a>').join('') + '</div>';
    const daily = Calc.activityByDay(14);
    const heat = Calc.activityByDay(84);

    if (tab === 'overview') {
      html += '<div class="grid3">' + B.kpi('Today', U.minsToHM(o.time.today), '') + B.kpi('This week', U.minsToHM(o.time.week), '') + B.kpi('This month', U.minsToHM(o.time.month), '') + '</div>';
      html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Daily study time</h3><span class="mini">last 14 days</span></div>' +
        App.charts.bars(daily.map(d => ({ label: U.weekday(d.date).charAt(0), value: Math.round(d.minutes), color: '#6E9BE0' }))) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Consistency heatmap</h3><span class="mini">12 weeks</span></div>' + App.charts.heatmap(heat) +
        '<div class="xsmall muted" style="margin-top:8px">Each square is one day of tracked activity (sessions, tasks, questions, revisions, tests). Streak: ' + o.streak.current + ' days (best ' + o.streak.best + ').</div></div>';
      html += '<div class="card"><div class="card-h"><h3>Key numbers</h3></div><div class="grid3">' +
        B.kpi('Syllabus JM', o.main.pct + '%', o.main.done + '/' + o.main.total) + B.kpi('Syllabus JA', o.advanced.pct + '%', o.advanced.done + '/' + o.advanced.total) +
        B.kpi('Mastery avg', Math.round((o.main.mastery + o.advanced.mastery) / 2) + '%', 'JM + JA') + '</div><div class="grid3" style="margin-top:8px">' +
        B.kpi('Questions', o.questions.attempted, o.questions.accuracy + '% accuracy') + B.kpi('Lectures', o.lectures.done + '/' + o.lectures.total, U.minsToHM(o.lectures.watched) + ' watched') +
        B.kpi('Revision rate', Calc.revisionConsistency().rate + '%', 'last 28 days') + '</div><div class="grid3" style="margin-top:8px">' +
        B.kpi('Backlog', o.tasks.backlogCount, U.minsToHM(o.tasks.backlogMin)) + B.kpi('Open errors', o.errors.open, o.errors.total + ' total') +
        B.kpi('Weak subtopics', o.main.weak + o.advanced.weak, 'JM + JA') + '</div></div>';
      html += '<div class="card"><div class="card-h"><h3>JM vs JA progress</h3><span class="mini">independent scopes</span></div>' +
        App.charts.hbars([
          { label: 'JEE Main - completed subtopics', value: o.main.pct, valueText: o.main.pct + '%  (' + o.main.done + '/' + o.main.total + ')', color: '#6E9BE0' },
          { label: 'JEE Advanced - completed subtopics', value: o.advanced.pct, valueText: o.advanced.pct + '%  (' + o.advanced.done + '/' + o.advanced.total + ')', color: '#E48BA8' },
          { label: 'JEE Main - average mastery', value: o.main.mastery, valueText: o.main.mastery + '%', color: '#B9D2FB' },
          { label: 'JEE Advanced - average mastery', value: o.advanced.mastery, valueText: o.advanced.mastery + '%', color: '#F9BDD2' }
        ]) +
        '<div class="xsmall muted">Completing a subtopic for Main never marks it complete for Advanced; each exam keeps its own dimension status, revisions and mastery.</div></div>';
      html += '<div class="card"><div class="card-h"><h3>Subject distribution of study time</h3></div>' +
        App.charts.stacked(Syl.subjects.map(s => ({ label: s.name, value: Calc.subjectTime(30)[s.name] || 0, color: s.code === 'phy' ? '#C3D8FA' : s.code === 'chem' ? '#BFE9CD' : '#FBD2A9' })).concat([{ label: 'Other', value: Calc.subjectTime(30).Other || 0, color: '#EFE7DA' }])) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Backlog trend</h3><span class="mini">open items per day</span></div>' +
        App.charts.line(Calc.backlogTrend(14).map(b => ({ label: U.weekday(b.date).charAt(0), value: b.count })), { color: '#F8A79F' }) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Facts from your data</h3></div>' + Calc.insights(12).map(x => '<div class="row" style="gap:8px;margin-bottom:6px"><span>' + (x.tone === 'warn' ? I.alert : '&bull;') + '</span><div class="small">' + U.esc(x.text) + '</div></div>').join('') + '</div>';
    }
    if (tab === 'subjects') {
      html += o.subjects.map(s => '<div class="card ' + B.subjectTint(s.code) + '"><div class="between"><div class="bold" style="font-size:16px">' + U.esc(s.name) + '</div>' + B.ring(s.mastery, { size: 54, stroke: 7, color: s.code === 'phy' ? '#7FA8E8' : s.code === 'chem' ? '#6FC894' : '#EE9E52' }) + '</div>' +
        '<div class="grid3" style="margin-top:8px">' + B.kpi('JM', s.jmPct + '%', s.leaves ? '' : '') + B.kpi('JA', s.jaPct + '%', '') + B.kpi('Mastery', s.mastery + '%', '') + '</div>' +
        '<div class="grid3" style="margin-top:8px">' + B.kpi('Weak', s.weak, 'subtopics') + B.kpi('Rev due', s.revDue, '') + B.kpi('Questions', s.questions.attempted, s.questions.accuracy + '% acc') + '</div>' +
        '<div style="margin-top:8px">' + App.charts.hbars([{ label: 'Lectures completed', value: s.lectures.done, valueText: s.lectures.done + '/' + s.lectures.total }], {}) + '</div>' +
        '<div class="xsmall muted">Study time (30d): ' + U.minsToHM(Calc.subjectTime(30)[s.name] || 0) + '</div></div>').join('');
    }
    if (tab === 'chapters') {
      const rows = [];
      Syl.subjects.forEach(s => s.chapters.forEach(ch => {
        const cs = Calc.chapterStats(ch.id, B.scope);
        rows.push({ id: ch.id, name: ch.name, subject: s.name, code: s.code, mastery: cs.agg.mastery, pct: cs.agg.pct, q: cs.agg.questions, lec: cs.agg.lectures, rev: cs.agg.revisionCount, err: cs.errors.total, time: cs.timeMin, revDue: cs.agg.revDue });
      }));
      const sorted = rows.sort((a, b) => a.mastery - b.mastery);
      html += '<div class="card"><div class="card-h"><h3>Chapters ranked by mastery (' + (B.scope === 'jm' ? 'JM' : 'JA') + ')</h3></div>' +
        App.charts.hbars(sorted.slice(0, 30).map(r => ({ label: r.name + ' - ' + B.shortSub(r.subject), value: r.mastery, valueText: r.mastery + '%', color: r.mastery >= 70 ? '#6FC894' : r.mastery >= 40 ? '#FFD873' : '#F8A79F' }))) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Chapter table</h3></div><div class="scrollx"><table class="tbl"><tr><th>Chapter</th><th>Done</th><th>Qs</th><th>Acc</th><th>Lec</th><th>Rev</th><th>Err</th><th>Time</th></tr>' +
        sorted.map(r => '<tr><td><a href="#/chapter/' + r.id + '"><b>' + U.esc(r.name) + '</b></a><br><span class="xsmall muted">' + U.esc(r.subject) + '</span></td>' +
          '<td>' + r.pct + '%</td><td>' + r.q.attempted + '</td><td>' + r.q.accuracy + '%</td><td>' + r.lec.done + '/' + r.lec.total + '</td><td>' + r.rev + '</td><td>' + r.err + '</td><td>' + U.minsToHM(r.time) + '</td></tr>').join('') + '</table></div></div>';
    }
    if (tab === 'topics') {
      const weak = Calc.weakTopics(null, 12), strong = Calc.strongTopics(null, 8);
      html += '<div class="card"><div class="card-h"><h3>Weak / low-accuracy topics</h3></div>' +
        (weak.length ? weak.map(w => '<div class="li" style="margin-bottom:7px"><div class="bd"><div class="t">' + U.esc(w.name) + ' ' + B.badgeFor(w.exam || 'jm') + '</div>' +
          '<div class="s">' + U.esc(w.chapter) + ' &middot; ' + U.esc(w.subject) + ' &middot; ' + U.esc(w.reason) + (w.attempted ? ' &middot; ' + w.acc + '% over ' + w.attempted + ' qs' : '') + '</div>' +
          '<div class="pbar thin" style="margin-top:5px;max-width:160px"><i style="width:' + w.mastery + '%;background:#F8A79F"></i></div></div>' +
          '<button class="btn sm" data-act="open-topic" data-id="' + w.id + '">Open</button></div>').join('') : B.empty('No weak topics detected from your data.', '&#128170;')) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Strongest topics</h3></div>' +
        (strong.length ? strong.map(s => '<div class="row between" style="margin-bottom:7px"><div><div class="small bold">' + U.esc(s.name) + '</div><div class="xsmall muted">' + U.esc(s.chapter) + ' &middot; ' + s.attempted + ' questions</div></div><span class="st st-completed">' + s.accuracy + '%</span></div>').join('') : B.empty('Not enough question data yet (needs 10+ questions at 65%+).', '&#128200;')) + '</div>';
      const cov = Calc.practiceCoverage();
      html += '<div class="card"><div class="card-h"><h3>Insufficient practice</h3><span class="mini">dimension coverage</span></div>' +
        App.charts.hbars([
          { label: 'Theory coverage', value: Math.round(cov.theory * 100), color: '#C3D8FA' },
          { label: 'Lecture coverage', value: Math.round(cov.lecture * 100), color: '#D3BDF8' },
          { label: 'DPP coverage', value: Math.round(cov.dpp * 100), color: '#FFD873' },
          { label: 'PYQ coverage', value: Math.round(cov.pyq * 100), color: '#F9BDD2' },
          { label: 'Practice coverage', value: Math.round(cov.practice * 100), color: '#9FDFB1' }
        ]) + '<div class="xsmall muted">Lecture completion is tracked separately from practice: a finished lecture never marks a topic mastered.</div></div>';
    }
    if (tab === 'questions') {
      const q = Calc.qOverall(null, null, null, null);
      const trend = Calc.accuracyTrend(15);
      const dail = Calc.activityByDay(14);
      html += '<div class="grid3">' + B.kpi('Attempted', q.attempted, 'all time') + B.kpi('Accuracy', q.accuracy + '%', q.correct + ' correct') + B.kpi('Time/question', q.perQ + ' min', U.minsToHM(q.timeMin)) + '</div>';
      html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Questions per day</h3><span class="mini">14 days</span></div>' +
        App.charts.bars(dail.map(d => ({ label: U.weekday(d.date).charAt(0), value: Math.round(d.questions), color: '#D3BDF8' }))) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Accuracy trend</h3><span class="mini">logged sets</span></div>' +
        (trend.length ? App.charts.line(trend.map(t2 => ({ label: U.fmtDate(t2.date, 'short'), value: t2.acc })), { max: 100, color: '#6E9BE0' }) : B.empty('Log some questions to see the trend.', '&#128200;')) + '</div>';
      const byDiff = {};
      S.state.questions.forEach(x => { const k = x.difficulty || 'Unspecified'; byDiff[k] = byDiff[k] || { a: 0, c: 0 }; byDiff[k].a += x.attempted || 0; byDiff[k].c += x.correct || 0; });
      html += '<div class="card"><div class="card-h"><h3>By difficulty</h3></div>' + App.charts.hbars(Object.keys(byDiff).map(k => ({ label: k, value: byDiff[k].a, valueText: byDiff[k].a + ' qs \u00b7 ' + (byDiff[k].a ? Math.round(byDiff[k].c / byDiff[k].a * 100) : 0) + '%' }))) + '</div>';
    }
    if (tab === 'lectures') {
      const l = Calc.lectureStats();
      html += '<div class="grid3">' + B.kpi('Total', l.total, '') + B.kpi('Completed', l.done, '') + B.kpi('Remaining', l.remaining, '') + '</div>' +
        '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Hours</h3></div>' + App.charts.hbars([
          { label: 'Total library', value: l.minutes, valueText: U.minsToHM(l.minutes), color: '#C3D8FA' },
          { label: 'Watched', value: l.watched, valueText: U.minsToHM(l.watched), color: '#9FDFB1' },
          { label: 'Remaining', value: Math.max(0, l.minutes - l.watched), valueText: U.minsToHM(Math.max(0, l.minutes - l.watched)), color: '#F8A79F' }
        ]) + '</div>' +
        '<div class="card"><div class="card-h"><h3>By subject</h3></div>' + App.charts.hbars(Object.keys(l.bySubject).map(k => ({ label: k, value: l.bySubject[k].done, valueText: l.bySubject[k].done + '/' + l.bySubject[k].total + ' \u00b7 ' + U.minsToHM(l.bySubject[k].watched) }))) + '</div>' +
        '<div class="card"><div class="card-h"><h3>Lecture vs practice</h3></div>' + (function () {
          const cov = Calc.practiceCoverage();
          return '<div class="row between"><span class="small">Lecture coverage</span><b>' + Math.round(cov.lecture * 100) + '%</b></div>' + B.pbar(Math.round(cov.lecture * 100), 'grad-phy') +
            '<div class="row between" style="margin-top:8px"><span class="small">Practice coverage</span><b>' + Math.round(cov.practice * 100) + '%</b></div>' + B.pbar(Math.round(cov.practice * 100), 'grad-math') +
            (cov.lecture - cov.practice > .2 ? '<div class="note" style="margin-top:9px">' + I.alert + ' Lecture completion is ahead of practice completion by ' + Math.round((cov.lecture - cov.practice) * 100) + ' percentage points.</div>' : '');
        })() + '</div>';
    }
    if (tab === 'revision') {
      const cons = Calc.revisionConsistency(), r = Calc.revisionBuckets();
      html += '<div class="grid3">' + B.kpi('Due today', r.dueToday.length, '') + B.kpi('Overdue', r.overdue.length, '') + B.kpi('Completed', r.done.length, 'all time') + '</div>';
      html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Consistency (28 days)</h3><span class="mini">' + cons.rate + '%</span></div>' + B.pbar(cons.rate, 'grad-phy') +
        '<div class="xsmall muted" style="margin-top:8px">' + cons.scheduled + ' scheduled &middot; ' + cons.done + ' completed &middot; ' + cons.late + ' late &middot; ' + cons.overdue + ' overdue.</div>' +
        '<div class="hr"></div>' + App.charts.hbars([
          { label: 'Revision 1', value: r.done.filter(x => x.index === 1).length + r.overdue.filter(x => x.index === 1).length, valueText: r.done.filter(x => x.index === 1).length + ' done', color: '#C3D8FA' },
          { label: 'Revision 2', value: r.done.filter(x => x.index === 2).length, valueText: r.done.filter(x => x.index === 2).length + ' done', color: '#D3BDF8' },
          { label: 'Revision 3', value: r.done.filter(x => x.index === 3).length, valueText: r.done.filter(x => x.index === 3).length + ' done', color: '#FFD873' },
          { label: 'Revision 4', value: r.done.filter(x => x.index === 4).length, valueText: r.done.filter(x => x.index === 4).length + ' done', color: '#F9BDD2' },
          { label: 'Revision 5', value: r.done.filter(x => x.index === 5).length, valueText: r.done.filter(x => x.index === 5).length + ' done', color: '#9FDFB1' }
        ]) + '</div>';
    }
    if (tab === 'errors') {
      const ep = Calc.errorPatterns();
      html += '<div class="grid3">' + B.kpi('Total', ep.total, '') + B.kpi('Open', ep.open, '') + B.kpi('Repeat topics', ep.repeats.length, '') + '</div>';
      html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Mistake types</h3></div>' + App.charts.hbars(Object.keys(ep.byType).map(k => ({ label: k, value: ep.byType[k].length, color: '#F8A79F' }))) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>By subject</h3></div>' + App.charts.hbars(Object.keys(ep.bySubject).map(k => ({ label: k, value: ep.bySubject[k].length }))) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>Repeated patterns</h3></div>' + (ep.repeats.length ? ep.repeats.map(r => '<div class="row between" style="margin-bottom:6px"><span class="small">' + U.esc(r.name) + ' <span class="muted">(' + U.esc(r.subject) + ')</span></span><span class="st st-weak">' + r.count + 'x</span></div>').join('') : '<div class="small muted">No repeats yet.</div>') + '</div>';
    }
    if (tab === 'tests') {
      const ts = Calc.testStats();
      html += ts.tests.length ? '<div class="card"><div class="card-h"><h3>Score % over time</h3></div>' +
        App.charts.line(ts.tests.map(t2 => ({ label: U.fmtDate(t2.date, 'short'), value: t2.pct })), { max: 100, color: '#6E9BE0' }) + '</div>' +
        '<div class="card"><div class="card-h"><h3>Subject averages</h3></div>' + App.charts.hbars(Object.keys(ts.bySubject).map(k => ({ label: k, value: ts.bySubject[k].pct, valueText: ts.bySubject[k].pct + '% over ' + ts.bySubject[k].n + ' tests' }))) +
        '<div class="hr"></div><div class="scrollx"><table class="tbl"><tr><th>Test</th><th>Date</th><th>Score</th><th>%</th><th>Acc</th></tr>' +
        ts.tests.slice().reverse().map(t2 => '<tr><td>' + U.esc(t2.name) + '</td><td>' + U.fmtDate(t2.date, 'short') + '</td><td>' + t2.score + '/' + t2.maxMarks + '</td><td>' + t2.pct + '%</td><td>' + t2.accuracy + '%</td></tr>').join('') + '</table></div></div>'
        : '<div class="card">' + B.empty('No mock tests yet.', '&#128203;') + '</div>';
    }
    return { title: 'Analytics', sub: tab, html };
  };

  /* ============================================================= GEMINI */
  Sc.gemini = function (parts, query) {
    const chat = G.activeChat();
    const key = G.hasKey();
    let html = '';
    if (!key) html += '<div class="banner info">' + I.spark + '<div><b>Gemini key needed.</b> AI answers, performance analysis and study recommendations need a Google AI Studio API key. Add it in <a href="#/profile"><b>Profile &rsaquo; Gemini</b></a>. The tracker itself works fully offline - the recommendation engine falls back to a rule-based plan built from your data.</div></div>';
    html += '<div class="card"><div class="card-h"><h3>' + I.spark + ' JEE AI assistant</h3>' +
      '<button class="btn sm" data-act="new-chat">New chat</button></div>' +
      '<div class="small muted">Answers user questions and analyses your tracker. It never generates lessons or study material on its own.</div>' +
      '<div class="btnrow" style="margin-top:10px">' +
      '<button class="btn sm primary" data-act="ai-analyze">Analyze My Performance</button>' +
      '<button class="btn sm sun" data-act="ai-recommend">What should I study now?</button>' +
      '</div></div>';
    html += '<div class="chips">' + G.QUICK.map((q, i) => '<button class="pill tap" data-act="ai-quick" data-v="' + i + '">' + U.esc(q.label) + '</button>').join('') + '</div>';
    html += '<div id="ai-rec">' + Sc._recCard() + '</div>';
    html += '<div id="ai-thread" class="list">' + (chat.messages.length ? chat.messages.map(m =>
      '<div class="ai-bubble ' + (m.role === 'user' ? 'me' : 'bot') + '">' + (m.role === 'user' ? U.esc(m.text) : G.md(m.text)) + '</div>').join('')
      : '<div class="empty"><span class="em">' + I.spark + '</span>Ask about a problem, a mistake, a formula, or your performance.</div>') + '</div>';
    html += '<div class="card"><textarea id="ai-input" class="field" style="width:100%;min-height:70px;border:1.5px solid var(--line);border-radius:14px;padding:11px" placeholder="Ask Gemini anything JEE - or paste a problem">' + U.esc(query.q || '') + '</textarea>' +
      '<div class="btnrow" style="margin-top:9px"><button class="btn primary" data-act="ai-send">Send</button>' +
      '<button class="btn sm" data-act="ai-hint">Hint only</button><button class="btn sm" data-act="ai-solve">Full solution</button>' +
      '<button class="btn sm ghost" data-act="ai-share">Attach tracker context</button></div>' +
      '<div class="xsmall muted" style="margin-top:8px">Every request already includes your actual tracker + syllabus data for the topic you are viewing.</div></div>';
    if (chat.messages.length) html += '<div class="btnrow"><button class="btn sm ghost" data-act="clear-chat">Clear this conversation</button></div>';
    return {
      title: 'Gemini', sub: 'JEE-level AI on your data', back: true, html,
      after: function (root) {
        const input = root.querySelector('#ai-input');
        if (query.q) { input.value = query.q; }
        App.ui._aiSend = async function (prefill, mode, extra) {
          const text = (prefill != null ? prefill : input.value || '').trim();
          if (!text) { App.toast('Type a question first'); return; }
          input.value = '';
          G.push(chat.id, 'user', text);
          const thread = document.getElementById('ai-thread');
          const t0 = document.createElement('div');
          t0.className = 'ai-bubble bot'; t0.innerHTML = '<span class="spin dark"></span> thinking...';
          thread.appendChild(t0);
          thread.scrollIntoView({ block: 'end' });
          try {
            const answer = await G.ask({ prompt: text, nodeId: App.ui.ctxNodeId || null, history: chat.messages.slice(0, -1), mode: mode || 'chat' });
            G.push(chat.id, 'model', answer);
            App.refresh();
          } catch (e) {
            const msg = String(e.message || e);
            t0.innerHTML = '<b>Could not get an answer.</b><br>' + U.esc(msg.indexOf('NO_KEY') === 0 ? 'Add your Gemini API key in Profile > Gemini.' : msg);
          }
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) App.ui._aiSend(); });
      }
    };
  };
  /* ---- recommendation card: accept / edit / reject every item ---- */
  Sc._recCard = function () {
    const rec = S.state.ai.lastRec;
    if (!rec) return '';
    const src = rec.source === 'gemini' ? 'Gemini' : 'built-in planner (Gemini not used)';
    const budget = S.state.profile.dailyTargetMin || 420;
    let h = '<div class="card"><div class="card-h"><h3>' + I.spark + ' Recommended plan</h3><span class="mini">' + U.esc(src) + '</span></div>' +
      '<div class="small">' + U.esc(rec.summary || '') + '</div>' +
      '<div class="xsmall muted" style="margin-top:4px">Available study time: ' + U.minsToHM(rec.availableMinutes || budget) + ' &middot; planned ' + U.minsToHM(rec.usedMinutes || 0) + '</div>';
    if (!rec.items.length) {
      h += '<div class="hr"></div><div class="small muted">Every recommendation has been accepted, edited or rejected. Generate a fresh plan any time.</div>';
    } else {
      h += '<div class="hr"></div><div class="list">' + rec.items.map((it, i) => {
        const node = it.topicId && Syl.rec(it.topicId);
        return '<div class="li" style="flex-direction:column;align-items:stretch"><div class="row between" style="gap:8px">' +
          '<div class="bold small" style="flex:1">' + (i + 1) + '. ' + U.esc(it.title) + '</div>' + B.badgeFor(it.exam || 'jm') + '</div>' +
          '<div class="s">' + U.esc(it.type || 'Task') + ' &middot; ' + U.esc(it.subject || '') + (node ? ' &middot; ' + U.esc(node.chapter.name) : '') + ' &middot; ' + (it.estMin || 45) + ' min &middot; ' + U.esc(it.priority || 'Medium') + ' priority</div>' +
          '<div class="xsmall muted" style="margin-top:5px">' + U.esc(it.reason || '') + '</div>' +
          '<div class="btnrow" style="margin-top:8px">' +
          '<button class="btn sm primary" data-act="ai-accept" data-i="' + i + '">Accept</button>' +
          '<button class="btn sm" data-act="ai-edit" data-i="' + i + '">Edit</button>' +
          '<button class="btn sm ghost" data-act="ai-reject" data-i="' + i + '">Reject</button>' +
          (node ? '<button class="btn sm ghost" data-act="nav" data-href="#/topic/' + it.topicId + '">Open topic</button>' : '') +
          '</div></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  };

  B.action('ai-send', () => App.ui._aiSend && App.ui._aiSend());
  B.action('ai-hint', () => App.ui._aiSend && App.ui._aiSend(null, 'chat'));
  B.action('ai-quick', el => {
    const q = G.QUICK[+el.getAttribute('data-v')];
    location.hash = '#/gemini?q=' + encodeURIComponent(q.prompt);
    setTimeout(() => App.ui._aiSend && App.ui._aiSend(q.prompt, q.mode), 120);
  });
  B.action('new-chat', () => { G.newChat(); location.hash = '#/gemini'; App.refresh(); });
  B.action('clear-chat', () => { const c = G.activeChat(); c.messages = []; c.title = 'New chat'; S.save(true); App.refresh(); });
  B.action('ai-solve', () => App.ui._aiSend && App.ui._aiSend(null, 'chat'));
  B.action('ai-share', () => { const c = G.activeChat(); const ctx = JSON.stringify(G.trackerContext(), null, 1); location.hash = '#/gemini?q=' + encodeURIComponent('Here is my full tracker data:\n' + ctx + '\n\nUse it to answer my questions.'); App.toast('Tracker context attached to the next message'); });
  B.action('ai-analyze', async () => {
    if (!G.hasKey()) { App.toast('Add a Gemini API key first (rule-based insights are on Analytics)'); location.hash = '#/profile'; return; }
    const c = G.activeChat();
    G.push(c.id, 'user', 'Analyze my performance using my tracked data.');
    App.refresh();
    const thread = document.getElementById('ai-thread');
    const t0 = document.createElement('div'); t0.className = 'ai-bubble bot'; t0.innerHTML = '<span class="spin dark"></span> analysing your tracker data...';
    thread.appendChild(t0);
    try {
      const text = await G.ask({ prompt: 'Analyze my current JEE preparation performance.', mode: 'analyze' });
      G.push(c.id, 'model', text, { kind: 'analysis' });
      S.update(st => { st.ai.lastAnalysis = { at: U.nowISO(), text }; }, { now: true });
      App.refresh();
    } catch (e) { t0.innerHTML = '<b>Analysis failed.</b><br>' + U.esc(String(e.message || e)); }
  });
  B.action('ai-recommend', async () => {
    const box = document.getElementById('ai-rec');
    box.innerHTML = '<div class="card"><div class="row" style="gap:9px"><span class="spin dark"></span><div class="small">Building a plan from your backlog, revisions, weak topics and accuracy...</div></div></div>';
    let rec;
    try {
      rec = G.hasKey() ? await G.recommend({ availableMinutes: S.state.profile.dailyTargetMin }) : G.localRecommend({ availableMinutes: S.state.profile.dailyTargetMin });
    } catch (e) {
      App.toast('Gemini unavailable - using the rule-based planner');
      rec = G.localRecommend({ availableMinutes: S.state.profile.dailyTargetMin });
    }
    S.update(st => { st.ai.lastRec = rec; }, { now: true });
    App.refresh();
  });
  B.action('ai-accept', el => {
    const i = +el.getAttribute('data-i');
    const rec = S.state.ai.lastRec; if (!rec || !rec.items[i]) return;
    const it = rec.items[i];
    S.update(st => st.tasks.push({
      id: U.uid('task'), title: it.title, type: it.type || 'Topic study', subject: it.subject || '',
      chapterId: '', topicId: it.topicId || '', nodeId: it.topicId || '', exam: it.exam || 'jm',
      estMin: it.estMin || 45, priority: it.priority || 'Medium', plannedFor: U.todayISO(), status: 'pending',
      completedAt: null, inBacklog: false, createdAt: U.nowISO(), notes: 'Accepted from AI recommendation: ' + (it.reason || '')
    }));
    rec.items.splice(i, 1);
    S.save(true);
    App.refresh(); App.toast('Added to today\'s tasks');
  });
  B.action('ai-reject', el => {
    const i = +el.getAttribute('data-i');
    const rec = S.state.ai.lastRec; if (!rec) return;
    rec.items.splice(i, 1); S.save(true); App.refresh();
  });
  B.action('ai-edit', el => {
    const i = +el.getAttribute('data-i');
    const it = S.state.ai.lastRec.items[i];
    App.forms.task({ title: it.title, type: it.type, subject: it.subject, exam: it.exam, estMin: it.estMin, notes: it.reason });
  });

  /* ============================================================ PROFILE */
  Sc.profile = function (parts) {
    const sub = parts[0] || '';
    const p = S.state.profile, st = S.state.settings;
    if (sub === 'provenance') return Sc.provenance();
    const backups = S.backups();
    const counts = { ch: 0, tp: 0, sb: 0 };
    Syl.subjects.forEach(s => s.chapters.forEach(c => { counts.ch++; c.topics.forEach(t2 => { counts.tp++; counts.sb += t2.subs.length; }); }));
    let html = '<div class="card"><div class="card-h"><h3>' + I.user + ' Profile &amp; exam dates</h3></div>' +
      B.field('Your name', '<input id="pf-name" value="' + U.esc(p.name) + '" placeholder="Optional">') +
      B.field('Exam label', '<input id="pf-label" value="' + U.esc(p.examLabel) + '">') +
      '<div class="two">' + B.field('JEE Main date', '<input type="date" id="pf-main" value="' + U.esc(p.mainDate) + '">') + B.field('JEE Advanced date', '<input type="date" id="pf-adv" value="' + U.esc(p.advancedDate) + '">') + '</div>' +
      B.field('Daily study target (minutes)', '<input type="number" id="pf-target" value="' + (p.dailyTargetMin || 420) + '" step="15">') +
      B.field('Auto-schedule spaced-repetition revisions', B.seg('autoRev', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], st.autoRevision === false ? 'off' : 'on')) +
      '<button class="btn primary block" data-act="save-profile">Save profile</button></div>';
    html += '<div class="card"><div class="card-h"><h3>' + I.spark + ' Gemini</h3></div>' +
      B.field('API key', '<input id="g-key" type="password" value="' + U.esc(st.apiKey || '') + '" placeholder="Paste your Google AI Studio key">', 'Stored only in this browser (localStorage). Never sent anywhere except Google&rsquo;s API.') +
      B.field('Model', B.select('g-model', G.MODELS.map(m => ({ value: m, label: m })), st.model)) +
      '<div class="btnrow"><button class="btn primary" data-act="save-gemini">Save</button><button class="btn" data-act="test-gemini">Test connection</button><button class="btn ghost" data-act="clear-gemini">Remove key</button></div>' +
      '<div class="xsmall muted" style="margin-top:8px">The tracker works fully without a key: analytics, insights and the rule-based study planner all run locally.</div></div>';
    html += '<div class="card"><div class="card-h"><h3>' + I.book + ' Syllabus database</h3></div>' +
      '<div class="grid3">' + B.kpi('Chapters', counts.ch, '') + B.kpi('Topics', counts.tp, '') + B.kpi('Subtopics', counts.sb, '') + '</div>' +
      '<div class="xsmall muted" style="margin-top:8px">JEE Main 2026 and JEE Advanced 2026 official syllabi, stored with source, URL and retrieval date. <a href="#/profile/provenance"><b>View provenance &rsaquo;</b></a></div></div>';
    html += '<div class="card"><div class="card-h"><h3>Data, backup &amp; restore</h3></div>' +
      '<div class="btnrow"><button class="btn" data-act="export">Export data (JSON)</button><button class="btn" data-act="import">Import data</button>' +
      '<button class="btn ghost" data-act="paste-import">Paste JSON</button></div>' +
      '<div class="hr"></div><div class="small bold">Backup slots (in-browser)</div>' +
      backups.map(b => '<div class="row between" style="margin-bottom:7px"><div class="small">Slot ' + b.slot + ': ' + (b.at ? U.fmtDate(U.iso(new Date(b.at))) + ' ' + new Date(b.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' &middot; ' + Math.round((b.size || 0) / 1024) + ' KB' : '<span class="muted">empty</span>') + '</div>' +
        '<div class="btnrow"><button class="btn sm" data-act="backup" data-slot="' + b.slot + '">Backup now</button>' + (b.at ? '<button class="btn sm primary" data-act="restore" data-slot="' + b.slot + '">Restore</button>' : '') + '</div></div>').join('') +
      '<div class="hr"></div>' +
      '<div class="btnrow"><button class="btn sun" data-act="load-sample">Load sample data</button><button class="btn ghost" data-act="clear-sample">Clear sample data</button>' +
      '<button class="btn ghost" data-act="wipe">Reset tracker (keep settings)</button></div>' +
      '<div class="xsmall muted" style="margin-top:8px">Storage: ' + (S.available ? 'browser localStorage' : '<b>temporary memory (sandboxed preview)</b> - export to keep data') + '. Data snapshot: ' + Math.round(JSON.stringify(S.state).length / 1024) + ' KB.</div></div>';
    html += '<div class="card"><div class="card-h"><h3>How progress is scored</h3></div>' +
      '<div class="small">Each subtopic keeps six independent dimensions - <b>theory, lecture, DPP, PYQ, practice, revision</b> - tracked separately for JM and JA.</div>' +
      '<div class="small" style="margin-top:6px"><b>Coverage</b> = weighted mean of the dimensions (theory 22%, lecture 24%, DPP 20%, PYQ 18%, practice 16%) plus up to 12% for completed revisions.</div>' +
      '<div class="small" style="margin-top:6px"><b>Mastery</b> = coverage &times; accuracy factor. Accuracy only counts once 5+ questions are logged for that subtopic; weak flags cap mastery at 45%.</div>' +
      '<div class="note" style="margin-top:9px">Watching a lecture never marks a topic mastered on its own.</div></div>';
    html += '<div class="btnrow" style="margin-bottom:20px"><a class="btn sm" href="#/timer">Study timer</a><a class="btn sm" href="#/search">Search</a><a class="btn sm" href="#/topics-left">Topics left</a><a class="btn sm" href="#/lectures">Lectures</a><a class="btn sm" href="#/tests">Mock tests</a><a class="btn sm" href="#/errors">Error book</a></div>';
    return {
      title: 'Profile', sub: 'settings, data, sources', html,
      after: function (root) {
        root.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
          const b = e.target.closest('[data-segval]'); if (!b) return;
          seg.querySelectorAll('.pill').forEach(x => x.classList.remove('on')); b.classList.add('on');
          const h = seg.parentElement.querySelector('input[type="hidden"][name="' + seg.getAttribute('data-seg') + '"]');
          if (h) h.value = b.getAttribute('data-segval');
        }));
      }
    };
  };
  B.action('save-profile', () => {
    S.update(st => {
      st.profile.name = document.getElementById('pf-name').value;
      st.profile.examLabel = document.getElementById('pf-label').value;
      st.profile.mainDate = document.getElementById('pf-main').value;
      st.profile.advancedDate = document.getElementById('pf-adv').value;
      st.profile.dailyTargetMin = +document.getElementById('pf-target').value || 420;
      const hidden = document.querySelector('input[name="autoRev"]');
      st.settings.autoRevision = hidden ? hidden.value !== 'off' : true;
    }, { now: true });
    App.refresh(); App.toast('Profile saved');
  });
  B.action('save-gemini', () => {
    S.update(st => {
      st.settings.apiKey = document.getElementById('g-key').value.trim();
      const m = document.querySelector('[name="g-model"]');
      st.settings.model = m ? m.value : st.settings.model;
    }, { now: true });
    App.refresh(); App.toast('Gemini settings saved');
  });
  B.action('clear-gemini', () => { S.update(st => { st.settings.apiKey = ''; }, { now: true }); App.refresh(); App.toast('Key removed'); });
  B.action('test-gemini', async () => {
    try {
      const t2 = await G.call({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: connection ok' }] }], maxTokens: 30 });
      App.toast('Gemini replied: ' + t2.slice(0, 40));
    } catch (e) { App.toast(String(e.message || e).slice(0, 120)); }
  });
  B.action('export', () => {
    const ok = U.download('jee-tracker-backup-' + U.todayISO() + '.json', S.exportJSON());
    App.toast(ok ? 'Export started' : 'Export blocked in this context - use Paste/Backup slots');
  });
  B.action('import', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      try { const text = await U.readFile(f); S.importJSON(text); App.refresh(); App.toast('Data imported'); }
      catch (e) { App.toast('Import failed: ' + e.message); }
    });
    inp.click();
  });
  B.action('paste-import', () => B.sheet({
    title: 'Import from JSON',
    html: B.field('Paste exported JSON', '<textarea id="imp" style="min-height:160px" placeholder="{...}"></textarea>'),
    footer: '<button class="btn primary block" data-act="do-import">Import and replace current data</button>',
    onMount: (body, sc) => sc.querySelector('[data-act="do-import"]').addEventListener('click', () => {
      try { S.importJSON(body.querySelector('#imp').value); B.closeSheet(); App.refresh(); App.toast('Data imported'); }
      catch (e) { App.toast('Import failed: ' + e.message); }
    })
  }));
  B.action('backup', el => { const r = S.backup(el.getAttribute('data-slot')); App.refresh(); App.toast(r.ok ? 'Backup saved to slot ' + r.slot : 'Backup stored in memory only (preview)'); });
  B.action('restore', el => B.confirm('Replace current data with this backup?', () => { try { S.restore(el.getAttribute('data-slot')); App.refresh(); App.toast('Backup restored'); } catch (e) { App.toast(e.message); } }));
  B.action('wipe', () => B.confirm('Reset all tracked progress, tasks, lectures, questions, errors, tests and sessions? This cannot be undone.', () => { S.wipe(true); App.refresh(); App.toast('Tracker reset'); }));
  B.action('load-sample', () => B.confirm('Load clearly-labelled sample data to explore the analytics screens? Your current data will be replaced (back it up first if needed).', () => { App.sample.load(); App.refresh(); App.toast('Sample data loaded - badges show it is sample'); }));
  B.action('clear-sample', () => B.confirm('Remove all sample data?', () => { App.sample.clear(); App.refresh(); App.toast('Sample data cleared'); }));

  Sc.provenance = function () {
    const m = Syl.data.meta;
    let jm = 0, ja = 0, both = 0, noneN = 0, total = 0;
    Syl.subjects.forEach(s => s.chapters.forEach(c => c.topics.forEach(t => t.subs.forEach(x => {
      total++;
      if (x.jm && x.ja) both++; else if (x.jm) jm++; else if (x.ja) ja++; else noneN++;
    }))));
    let html = '<div class="card"><div class="card-h"><h3>' + I.refresh + ' How this database was retrieved</h3></div>' +
      '<table class="tbl">' +
      '<tr><td><b>1. JEE Main 2026 Paper 1 syllabus (NTA)</b><br><span class="xsmall muted">priority 1</span></td><td style="text-align:right"><span class="st st-completed">retrieved</span><br><span class="xsmall muted">' + U.esc(m.retrieved) + '</span></td></tr>' +
      '<tr><td><b>2. JEE Advanced 2026 syllabus (IIT Roorkee / JAB)</b><br><span class="xsmall muted">priority 2</span></td><td style="text-align:right"><span class="st st-completed">retrieved</span><br><span class="xsmall muted">' + U.esc(m.retrieved) + '</span></td></tr>' +
      '<tr><td><b>3. Fallback to the official 2025 syllabus</b></td><td style="text-align:right"><span class="st st-not_started">not needed</span></td></tr>' +
      '</table>' +
      '<div class="note" style="margin-top:10px">Because both 2026 documents were retrieved, no fallback was used. The JEE Advanced 2026 document itself states that the 2026 syllabus "remains the same as JEE Advanced 2025".</div>' +
      '<div class="small" style="margin-top:9px">Every subtopic string in this database is taken from the official text of those two documents - nothing is invented, inferred from coaching material, or borrowed from previous years. Where the two documents overlap, a subtopic carries both badges but keeps <b>separate JM and JA progress</b>.</div>' +
      '<div class="grid3" style="margin-top:10px">' +
      B.kpi('JM only', jm, 'subtopics') + B.kpi('Both JM + JA', both, 'subtopics') + B.kpi('JA only', ja, 'subtopics') +
      '</div>' +
      '<div class="xsmall muted" style="margin-top:6px">' + total + ' subtopics total' + (noneN ? ' (' + noneN + ' unmarked)' : '') + ' - the Advanced-only and Main-only chapters are why the two counts differ.</div>' +
      '</div>';
    html += '<div class="card"><div class="card-h"><h3>Official syllabus sources</h3></div>' +
      '<div class="srcbox"><b>JEE Main (JM) - syllabus year ' + m.mainYear + '</b><br>' + U.esc(m.mainSource) + '<br><a href="' + m.mainUrl + '" target="_blank" rel="noopener">' + m.mainUrl + '</a></div>' +
      '<div class="srcbox" style="margin-top:9px"><b>JEE Advanced (JA) - syllabus year ' + m.advancedYear + '</b><br>' + U.esc(m.advancedSource) + '<br><a href="' + m.advancedUrl + '" target="_blank" rel="noopener">' + m.advancedUrl + '</a></div>' +
      '<div class="grid2" style="margin-top:10px">' + B.kpi('Retrieved on', U.fmtDate(m.retrieved), 'app build date') + B.kpi('Structure', 'Subject &rarr; Chapter &rarr; Topic &rarr; Subtopic', 'as required') + '</div>' +
      '<div class="note" style="margin-top:10px">' + U.esc(m.note) + '</div>' +
      '<div class="small muted" style="margin-top:8px">The JEE Advanced 2026 syllabus document itself states that it "remains the same as JEE Advanced 2025".</div></div>';
    html += Syl.subjects.map(s => '<div class="card ' + B.subjectTint(s.code) + '"><div class="bold">' + U.esc(s.name) + '</div>' +
      '<div class="grid3" style="margin:8px 0">' + B.kpi('Chapters', s.chapters.length, '') + B.kpi('Topics', s.chapters.reduce((a, c) => a + c.topics.length, 0), '') + B.kpi('Subtopics', s.chapters.reduce((a, c) => a + c.topics.reduce((d, t2) => d + t2.subs.length, 0), 0), '') + '</div>' +
      s.chapters.map(c => '<div style="margin-bottom:7px"><div class="small bold">' + U.esc(c.name) + ' ' + B.badges(c) + (c.unit ? ' <span class="xsmall muted">' + U.esc(c.unit) + '</span>' : '') + '</div>' +
        '<div class="xsmall muted">JM: ' + U.esc(c.srcJM || '-') + '<br>JA: ' + U.esc(c.srcJA || '-') + '</div></div>').join('') + '</div>').join('');
    html += '<div class="card"><div class="card-h"><h3>Marker rules</h3></div>' +
      '<div class="small"><b>JM</b> = the subtopic appears in the official JEE Main 2026 Paper 1 syllabus. <b>JA</b> = it appears in the official JEE Advanced 2026 syllabus. Both badges = appears in both documents.</div>' +
      '<div class="small" style="margin-top:7px">Where the two documents overlap, the app marks a subtopic with both badges but never merges progress: JM and JA completion are stored separately.</div></div>';
    return { title: 'Syllabus provenance', sub: 'source, URL, retrieval date', back: true, html };
  };

  /* ============================================================= SEARCH */
  Sc.search = function (parts, query) {
    const q = query.q || '';
    const s = Syl.search(q);
    const lower = q.toLowerCase();
    let html = '<div class="card"><input id="search-in" value="' + U.esc(q) + '" placeholder="Search topics, subtopics, tasks, lectures, errors, tests..." style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:14px">' +
      '<div class="xsmall muted" style="margin-top:8px">Try &ldquo;Integration&rdquo;, &ldquo;Moment of Inertia&rdquo;, &ldquo;Equilibrium&rdquo; or a task title.</div></div>';
    if (q) {
      const hl = t2 => U.esc(t2).replace(new RegExp('(' + lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<span class="mark">$1</span>');
      if (s.chapters.length) html += '<div class="card"><div class="card-h"><h3>Chapters (' + s.chapters.length + ')</h3></div>' +
        s.chapters.map(c => '<div class="li tap" data-act="nav" data-href="#/chapter/' + c.id + '"><div class="bd"><div class="t">' + hl(c.name) + '</div><div class="s">' + U.esc(c.subject) + '</div></div><span class="chev">' + I.chev + '</span></div>').join('') + '</div>';
      if (s.topics.length) html += '<div class="card"><div class="card-h"><h3>Topics (' + s.topics.length + ')</h3></div>' +
        s.topics.map(t2 => { const a = Prog.agg(t2.id, B.scope); return '<div class="li tap" data-act="nav" data-href="#/topic/' + t2.id + '"><div class="bd"><div class="t">' + hl(t2.name) + ' ' + B.badges(Syl.rec(t2.id).node) + '</div>' +
          '<div class="s">' + U.esc(t2.subject) + ' &middot; ' + U.esc(t2.chapter) + ' &middot; ' + a.pct + '% done (' + (B.scope === 'jm' ? 'JM' : 'JA') + ')</div>' +
          '<div class="pbar thin" style="margin-top:5px;max-width:160px"><i style="width:' + a.pct + '%"></i></div></div><span class="chev">' + I.chev + '</span></div>'; }).join('') + '</div>';
      if (s.subs.length) html += '<div class="card"><div class="card-h"><h3>Subtopics (' + s.subs.length + ')</h3></div>' +
        s.subs.slice(0, 40).map(x => '<div class="li tap" data-act="nav" data-href="#/topic/' + x.topicId + '"><div class="bd"><div class="t">' + hl(x.name) + ' ' + B.badges(Syl.rec(x.id).node) + '</div>' +
          '<div class="s">' + U.esc(x.subject) + ' &middot; ' + U.esc(x.chapter) + ' &middot; ' + U.esc(x.topic) + ' &middot; ' + Prog.displayStatus(x.id, B.scope).replace('_', ' ') + '</div></div><span class="chev">' + I.chev + '</span></div>').join('') + '</div>';
      const tasks = S.state.tasks.filter(x => (x.title || '').toLowerCase().indexOf(lower) >= 0);
      const lecs = S.state.lectures.filter(x => (x.title || '').toLowerCase().indexOf(lower) >= 0);
      const errs = S.state.errors.filter(x => ((x.questionText || '') + (x.correctConcept || '') + (x.note || '')).toLowerCase().indexOf(lower) >= 0);
      const tests = S.state.tests.filter(x => (x.name || '').toLowerCase().indexOf(lower) >= 0);
      const qs = S.state.questions.filter(x => (x.nodeId && Syl.rec(x.nodeId) && Syl.rec(x.nodeId).name.toLowerCase().indexOf(lower) >= 0));
      if (tasks.length) html += '<div class="card"><div class="card-h"><h3>Tasks (' + tasks.length + ')</h3></div>' + tasks.map(x => '<div class="li"><div class="bd"><div class="t">' + U.esc(x.title) + '</div><div class="s">' + U.esc(x.type) + ' &middot; ' + U.esc(x.plannedFor) + ' &middot; ' + x.status + '</div></div></div>').join('') + '</div>';
      if (lecs.length) html += '<div class="card"><div class="card-h"><h3>Lectures (' + lecs.length + ')</h3></div>' + lecs.map(x => '<div class="li tap" data-act="lec-open" data-id="' + x.id + '"><div class="bd"><div class="t">' + U.esc(x.title) + '</div><div class="s">' + U.esc(x.subject) + ' &middot; ' + U.esc(x.status) + '</div></div></div>').join('') + '</div>';
      if (errs.length) html += '<div class="card"><div class="card-h"><h3>Error book (' + errs.length + ')</h3></div>' + errs.map(x => '<div class="li"><div class="bd"><div class="t">' + U.esc(x.mistakeType) + '</div><div class="s">' + U.esc((x.questionText || '').slice(0, 90)) + '</div></div></div>').join('') + '</div>';
      if (tests.length) html += '<div class="card"><div class="card-h"><h3>Tests (' + tests.length + ')</h3></div>' + tests.map(x => '<div class="li"><div class="bd"><div class="t">' + U.esc(x.name) + '</div><div class="s">' + x.score + '/' + x.maxMarks + ' &middot; ' + U.fmtDate(x.date) + '</div></div></div>').join('') + '</div>';
      if (qs.length) html += '<div class="card"><div class="card-h"><h3>Question logs (' + qs.length + ')</h3></div>' + qs.slice(0, 15).map(x => '<div class="li"><div class="bd"><div class="t">' + U.esc(Syl.rec(x.nodeId).name) + '</div><div class="s">' + x.attempted + ' attempted &middot; ' + x.accuracy + '% &middot; ' + U.fmtDate(x.date, 'short') + '</div></div></div>').join('') + '</div>';
      if (!s.chapters.length && !s.topics.length && !s.subs.length && !tasks.length && !lecs.length && !errs.length && !tests.length && !qs.length) html += '<div class="card">' + B.empty('Nothing matched "' + q + '".', '&#128269;') + '</div>';
    }
    return {
      title: 'Search', sub: 'syllabus + everything you track', back: true, html,
      after: function (root) {
        const inp = root.querySelector('#search-in');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        let t2;
        inp.addEventListener('input', () => { clearTimeout(t2); t2 = setTimeout(() => { location.hash = '#/search?q=' + encodeURIComponent(inp.value); }, 320); });
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
