/* ==========================================================================
   screens1.js - Home, Syllabus tracker, Chapter performance, Topic detail, Topics Left
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc, B = App.ui, I = App.icons;
  const Sc = (App.screens = App.screens || {});
  B.exp = B.exp || {};
  B.scope = B.scope || 'jm';
  B.filters = B.filters || {};

  const CHK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
  const scopeSeg = () =>
    '<div class="seg" data-act="none" style="margin-bottom:10px">' +
    '<button class="pill ' + (B.scope === 'jm' ? 'on' : '') + '" data-act="set-scope" data-scope="jm">JEE Main (JM)</button>' +
    '<button class="pill ' + (B.scope === 'ja' ? 'on' : '') + '" data-act="set-scope" data-scope="ja">JEE Advanced (JA)</button>' +
    '</div>';
  B.action('set-scope', el => { B.scope = el.getAttribute('data-scope'); App.refresh(); });

  /* ================================================================ HOME */
  Sc.home = function () {
    const o = Calc.overall();
    const name = U.firstName(S.state.profile.name);
    const t = U.todayISO();
    const dMain = U.diffDays(t, S.state.profile.mainDate);
    const dAdv = U.diffDays(t, S.state.profile.advancedDate);
    const cov = Calc.practiceCoverage();
    const insights = Calc.insights(5);
    const taskRow = t2 => '<div class="li tap" data-act="nav" data-href="#/tasks">' +
      '<div class="chk ' + (t2.status === 'done' ? 'on' : '') + '" data-act="task-toggle" data-id="' + t2.id + '">' + (t2.status === 'done' ? CHK : '') + '</div>' +
      '<div class="bd"><div class="t">' + U.esc(t2.title) + '</div><div class="s">' + U.esc(t2.type || '') + ' &middot; ' + U.esc(t2.subject || '') +
      ' &middot; ' + (t2.estMin || 45) + ' min ' + B.badgeFor(t2.exam || 'jm') + (t2.priority === 'High' ? ' <span class="pill soft">High</span>' : '') + '</div></div></div>';

    let html = '';
    if (S.state.settings.sample) html += '<div class="banner"><b>SAMPLE DATA</b> &nbsp;This tracker currently holds clearly-labelled demo entries so you can explore every analytics screen. Clear it in Profile &rarr; Data, then track your own work - every number in the app comes from what you log.</div>';
    if (!S.available) html += '<div class="banner err"><b>Preview mode:</b> this page is running in a sandboxed frame, so browser storage is blocked. Everything works, but data will not persist here - download the file and open it in your browser (or use Export) to keep your progress.</div>';
    html += '<div class="hero">' +
      '<div class="between"><div><div class="xsmall bold" style="letter-spacing:.1em;opacity:.7">JEE COUNTDOWN</div>' +
      '<div class="big">' + (dMain >= 0 ? dMain : 0) + '</div><div class="small bold">days to ' + U.esc(S.state.profile.examLabel || 'JEE Main') + ' Main</div></div>' +
      '<div class="center"><div class="xsmall bold" style="letter-spacing:.1em;opacity:.7">ADVANCED</div><div class="count" style="font-size:26px">' + (dAdv >= 0 ? dAdv : 0) + '</div><div class="xsmall bold">days</div></div></div>' +
      '<div class="row wrap" style="margin-top:12px;gap:7px">' +
      '<span class="streak">' + I.fire + ' ' + o.streak.current + '-day streak</span>' +
      '<span class="streak">' + I.clock + ' ' + U.minsToHM(o.time.today) + ' today</span>' +
      '<span class="streak">' + U.minsToHM(o.time.week) + ' / 7d</span>' +
      '</div>' +
      '<div class="small muted" style="margin-top:8px">' + U.fmtDate(t, 'long') + (name ? ' &middot; ' + U.esc(name) : '') + '</div>' +
      '</div>';

    /* overall + subject cards */
    const subjCard = st => {
      const code = st.code;
      return '<div class="card ' + B.subjectTint(code) + '" style="margin-bottom:0;padding:12px">' +
        '<div class="between"><div class="row" style="gap:8px">' + B.ring(st.jmPct, { size: 52, stroke: 7, color: code === 'phy' ? '#7FA8E8' : code === 'chem' ? '#6FC894' : '#EE9E52' }) +
        '<div><div class="bold" style="font-size:14px">' + U.esc(st.name) + '</div><div class="xsmall muted">' + st.chapters + ' chapters</div></div></div>' +
        '<div class="center"><div class="count" style="font-size:16px">' + st.mastery + '%</div><div class="xsmall muted">mastery</div></div></div>' +
        '<div class="hr" style="margin:9px 0"></div>' +
        '<div class="xsmall row between"><span>JM ' + st.jmPct + '%</span><span>JA ' + st.jaPct + '%</span></div>' +
        '<div class="pbar thin grad-jm" style="margin-top:4px"><i style="width:' + st.jmPct + '%"></i></div>' +
        '<div class="pbar thin grad-ja" style="margin-top:4px"><i style="width:' + st.jaPct + '%"></i></div>' +
        '<div class="xsmall muted" style="margin-top:6px">' + (st.leaves - st.done) + ' subtopics left of ' + st.leaves + ' &middot; ' + st.weak + ' weak</div>' +
        '</div>';
    };
    html += '<div class="card">' +
      '<div class="card-h"><h3>' + I.chart + ' Overall PCM progress</h3><span class="mini">' + U.esc(S.state.profile.examLabel || 'JEE 2027') + '</span></div>' +
      '<div class="row" style="gap:14px">' +
      '<div class="center">' + B.ring(o.main.pct, { size: 84, stroke: 10, color: '#6E9BE0' }) + '<div class="xsmall bold" style="margin-top:4px">JEE MAIN</div><div class="xsmall muted">' + o.main.done + '/' + o.main.total + ' subtopics</div></div>' +
      '<div class="center">' + B.ring(o.advanced.pct, { size: 84, stroke: 10, color: '#E48BA8' }) + '<div class="xsmall bold" style="margin-top:4px">ADVANCED</div><div class="xsmall muted">' + o.advanced.done + '/' + o.advanced.total + ' subtopics</div></div>' +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="xsmall muted">Practice coverage - theory <b>' + Math.round(cov.theory * 100) + '%</b>, lectures <b>' + Math.round(cov.lecture * 100) + '%</b>, DPP <b>' + Math.round(cov.dpp * 100) + '%</b>, PYQ <b>' + Math.round(cov.pyq * 100) + '%</b>, practice <b>' + Math.round(cov.practice * 100) + '%</b></div>' +
      '</div>';
    html += '<div class="grid3">' +
      B.kpi('Topics left', (o.main.remaining + o.advanced.remaining), 'JM + JA subtopics') +
      B.kpi('Lectures left', o.lectures.remaining, o.lectures.done + '/' + o.lectures.total + ' done') +
      B.kpi('Revisions due', o.revision.dueToday.length + o.revision.overdue.length, o.revision.overdue.length + ' overdue') +
      '</div><div class="grid3" style="margin-top:8px">' +
      B.kpi('Questions solved', o.questions.attempted, o.questions.accuracy + '% accuracy') +
      B.kpi('Study time', U.minsToHM(o.time.week), 'last 7 days') +
      B.kpi('Backlog', o.tasks.backlogCount, U.minsToHM(o.tasks.backlogMin)) +
      '</div>';
    html += '<div class="grid3" style="margin-top:8px">' + o.subjects.map(s => '<div class="card ' + B.subjectTint(s.code) + '" style="padding:10px;margin:0">' +
      '<div class="center">' + B.ring(s.jmPct, { size: 56, stroke: 7, color: s.code === 'phy' ? '#7FA8E8' : s.code === 'chem' ? '#6FC894' : '#EE9E52' }) + '</div>' +
      '<div class="center bold xsmall" style="margin-top:5px">' + B.shortSub(s.name) + '</div>' +
      '<div class="center xsmall muted">JM ' + s.jmPct + '% &middot; JA ' + s.jaPct + '%</div>' +
      '<div class="center xsmall muted" style="margin-top:3px">' + (s.leaves - s.done) + ' left</div></div>').join('') + '</div>';

    html += '<div class="sect-title">Today <span class="ln"></span><a class="mini" href="#/tasks">All tasks &rsaquo;</a></div>';
    html += '<div class="card">' +
      '<div class="card-h"><h3>' + I.check + " Today's tasks</h3><span class=\"mini\">" + o.tasks.today.length + ' planned &middot; ' + U.minsToHM(o.tasks.todayMin) + '</span></div>' +
      (o.tasks.today.length ? '<div class="list">' + o.tasks.today.slice(0, 4).map(taskRow).join('') + '</div>' : B.empty('No tasks planned for today. Add one from the + button.', '&#127775;')) +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-h"><h3>' + I.refresh + ' Revisions due</h3><span class="mini">' + o.revision.dueToday.length + ' today &middot; ' + o.revision.overdue.length + ' overdue</span></div>' +
      (o.revision.dueToday.length + o.revision.overdue.length ? '<div class="list">' + o.revision.overdue.concat(o.revision.dueToday).slice(0, 4).map(r =>
        '<div class="li ' + (U.daysFromToday(r.scheduledFor) < 0 ? 'overdue' : '') + '"><div class="ico">' + I.refresh + '</div>' +
        '<div class="bd"><div class="t">' + U.esc((r.topicName || '') + ' - Revision ' + (r.index || 1)) + ' ' + B.badgeFor(r.exam) + '</div>' +
        '<div class="s">' + U.esc(r.chapterName || '') + ' &middot; ' + U.relDay(r.scheduledFor) + '</div></div>' +
        '<button class="btn sm" data-act="rev-done" data-id="' + r.id + '">Done</button></div>').join('') + '</div>'
        : B.empty('No revisions due. Great shape.', '&#127807;')) +
      '<div style="margin-top:10px"><a class="btn sm" href="#/revision">Open revision tracker</a></div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-h"><h3>' + I.alert + ' Backlog</h3><span class="mini">' + o.tasks.backlogCount + ' items &middot; ' + U.minsToHM(o.tasks.backlogMin) + '</span></div>' +
      (o.tasks.backlog.length ? '<div class="list">' + o.tasks.backlog.slice(0, 2).map(x => '<div class="li warn"><div class="bd"><div class="t">' + U.esc(x.title) + '</div>' +
        '<div class="s">was due ' + U.relDay(x.plannedFor) + ' &middot; ' + (x.estMin || 45) + ' min</div></div>' +
        '<button class="btn sm" data-act="task-toggle" data-id="' + x.id + '">Done</button></div>').join('') + '</div>' +
        '<div style="margin-top:10px"><a class="btn sm" href="#/tasks/backlog">Open backlog</a></div>'
        : B.empty('Nothing in backlog.', '&#128077;')) +
      '</div>';

    html += '<div class="sect-title">Quick actions <span class="ln"></span></div>' +
      '<div class="card"><div class="btnrow">' +
      '<button class="btn sm" data-act="fab-task">' + I.plus + ' Task</button>' +
      '<button class="btn sm" data-act="fab-lecture">' + I.plus + ' Lecture</button>' +
      '<button class="btn sm" data-act="fab-question">' + I.plus + ' Questions</button>' +
      '<button class="btn sm" data-act="fab-error">' + I.plus + ' Error</button>' +
      '<button class="btn sm" data-act="fab-revision">' + I.plus + ' Revision</button>' +
      '<button class="btn sm" data-act="fab-session">' + I.plus + ' Study time</button>' +
      '</div></div>';

    html += '<div class="sect-title">More tools <span class="ln"></span></div>' +
      '<div class="chips">' +
      [['#/topics-left', 'Topics Left'], ['#/lectures', 'Lectures'], ['#/revision', 'Revision'], ['#/questions', 'Questions'],
       ['#/errors', 'Error Book'], ['#/tests', 'Mock Tests'], ['#/timer', 'Study Timer'], ['#/gemini', 'Gemini AI'],
       ['#/search', 'Search'], ['#/analytics', 'Analytics'], ['#/profile/provenance', 'Syllabus source']]
        .map(([h, l]) => '<a class="pill" href="' + h + '">' + l + ' &rsaquo;</a>').join('') + '</div>';

    html += '<div class="card"><div class="card-h"><h3>' + I.spark + ' Smart insights</h3><span class="mini">from your data</span></div>' +
      (insights.length ? insights.map(x => '<div class="row" style="gap:8px;margin-bottom:6px;align-items:flex-start"><span style="color:' + (x.tone === 'warn' ? '#C0503F' : '#8A7E70') + '">' + (x.tone === 'warn' ? I.alert : '&bull;') + '</span><div class="small">' + U.esc(x.text) + '</div></div>').join('')
        : '<div class="small muted">Log activity (tasks, questions, lectures, sessions) and factual insights will appear here automatically.</div>') +
      '<div class="btnrow" style="margin-top:10px"><a class="btn sm primary" href="#/gemini">' + I.spark + ' What should I study now?</a>' +
      '<a class="btn sm" href="#/analytics">Full analytics</a></div></div>';

    html += '<div class="srcbox">Syllabus source: <b>' + U.esc(Syl.data.meta.mainSource) + '</b> (JM) and <b>' + U.esc(Syl.data.meta.advancedSource) + '</b> (JA). Retrieved ' + U.esc(Syl.data.meta.retrieved) + '. <a href="#/profile/provenance"><b>Syllabus provenance &rsaquo;</b></a></div>';
    return { title: (name ? 'Hi ' + U.esc(name) + '!' : 'JEE PCM Tracker'), sub: 'tracker &middot; not lessons', html };
  };
  B.action('task-toggle', el => { const id = el.getAttribute('data-id'); const t = S.state.tasks.find(x => x.id === id); if (t && t.status === 'done') App.mut.taskUndone(id); else App.mut.taskDone(id); });
  B.action('rev-done', el => App.mut.revisionDone(el.getAttribute('data-id')));

  /* ============================================================ SYLLABUS */
  Sc.syllabus = function (parts) {
    const code = parts[0] || 'phy';
    const sub = Syl.byCode[code] || Syl.subjects[0];
    const exam = B.scope;
    const f = B.filters.syllabus = B.filters.syllabus || { status: 'all', q: '' };
    let html = '<div class="chips">' + Syl.subjects.map(s =>
      '<a class="pill ' + (s.code === code ? 'on' : '') + '" href="#/syllabus/' + s.code + '">' + U.esc(s.name) + '</a>').join('') + '</div>';
    html += scopeSeg();
    const st = Calc.subjectStats(code, exam);
    html += '<div class="card ' + B.subjectTint(code) + '">' +
      '<div class="between"><div>' +
      '<div class="bold" style="font-size:16px">' + U.esc(sub.name) + ' syllabus</div>' +
      '<div class="xsmall muted">' + st.leaves + ' subtopics in scope &middot; ' + st.chapters + ' chapters</div></div>' +
      B.ring(st.pct, { size: 66, stroke: 9, color: code === 'phy' ? '#7FA8E8' : code === 'chem' ? '#6FC894' : '#EE9E52' }) + '</div>' +
      '<div class="hr"></div>' +
      '<div class="grid3">' + B.kpi('JM', st.jmPct + '%', 'Main coverage') + B.kpi('JA', st.jaPct + '%', 'Advanced coverage') + B.kpi('Mastery', st.mastery + '%', 'accuracy-adjusted') + '</div>' +
      '<div class="xsmall muted" style="margin-top:8px">' + st.done + ' completed &middot; ' + (st.leaves - st.done) + ' remaining &middot; ' + st.weak + ' weak &middot; ' + st.revDue + ' revision due</div>' +
      '</div>';

    html += '<div class="chips">' +
      ['all', 'remaining', 'weak', 'revision_due', 'completed'].map(k => '<button class="pill tap ' + (f.status === k ? 'on' : '') + '" data-act="syl-filter" data-v="' + k + '">' +
        ({ all: 'All chapters', remaining: 'Remaining', weak: 'Weak', revision_due: 'Revision due', completed: 'Completed' })[k] + '</button>').join('') +
      '<a class="pill" href="#/topics-left">Topics Left &rsaquo;</a></div>';

    html += sub.chapters.map(ch => {
      const a = Prog.agg(ch.id, exam);
      const jma = Prog.agg(ch.id, 'jm'), jaa = Prog.agg(ch.id, 'ja');
      const status = Prog.statusOfAgg(ch.id, exam);
      if (f.status === 'remaining' && a.remaining === 0) return '';
      if (f.status === 'completed' && a.pct < 100) return '';
      if (f.status === 'weak' && a.weak === 0) return '';
      if (f.status === 'revision_due' && a.revDue === 0) return '';
      const open = !!B.exp[ch.id];
      return '<div class="acc ' + (open ? 'open' : '') + '">' +
        '<div class="acc-h" data-act="toggle-exp" data-id="' + ch.id + '">' +
        '<div style="flex:0 0 auto">' + B.ring(a.pct, { size: 44, stroke: 6, color: code === 'phy' ? '#7FA8E8' : code === 'chem' ? '#6FC894' : '#EE9E52' }) + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div class="t bold" style="font-size:14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + U.esc(ch.name) + B.badges(ch) + '</div>' +
        '<div class="xsmall muted">' + (ch.unit ? U.esc(ch.unit) + ' &middot; ' : '') + a.completed + '/' + a.total + ' done &middot; ' + a.remaining + ' left &middot; mastery ' + a.mastery + '%</div>' +
        '<div class="row" style="gap:6px;margin-top:5px"><span class="xsmall bold" style="color:#6E9BE0">JM ' + jma.pct + '%</span><span class="xsmall bold" style="color:#E48BA8">JA ' + jaa.pct + '%</span>' +
        (a.weak ? '<span class="xsmall bold" style="color:#C0503F">' + a.weak + ' weak</span>' : '') +
        (a.revDue ? '<span class="xsmall bold" style="color:#7A5BC7">' + a.revDue + ' rev due</span>' : '') + '</div>' +
        '<div class="pbar thin" style="margin-top:5px"><i style="width:' + a.pct + '%"></i></div>' +
        '</div>' +
        '<span class="chev">' + I.chev + '</span></div>' +
        '<div class="acc-b">' +
        '<div class="grid3" style="margin-top:9px">' +
        B.kpi('Questions', a.questions.attempted, a.questions.accuracy + '% accuracy') +
        B.kpi('Lectures', a.lectures.done + '/' + a.lectures.total, U.minsToHM(a.lectures.watched) + ' watched') +
        B.kpi('Revisions', a.revisionCount, a.revDue + ' due now') +
        '</div>' +
        '<div class="row between" style="margin:12px 0 4px"><span class="xsmall bold">Topics</span><a class="xsmall bold" href="#/chapter/' + ch.id + '">Chapter performance &rsaquo;</a></div>' +
        ch.topics.map(tp => {
          const ta = Prog.agg(tp.id, exam);
          const subOpen = !!B.exp[tp.id];
          return '<div class="topicrow" data-act="toggle-exp" data-id="' + tp.id + '" style="flex-direction:column;align-items:stretch">' +
            '<div class="row" style="gap:8px;align-items:center">' +
            B.dot(ta.pct === 100 ? 'completed' : 'learning') +
            '<div style="flex:1;min-width:0"><div class="bold small">' + U.esc(tp.name) + ' ' + B.badges(tp) + '</div>' +
            '<div class="xsmall muted">' + ta.completed + '/' + ta.total + ' done &middot; ' + ta.mastery + '% mastery' + (ta.questions.attempted ? ' &middot; ' + ta.questions.accuracy + '% acc' : '') + '</div></div>' +
            '<div class="mini-bar"><i style="width:' + ta.pct + '%"></i></div>' +
            '<span class="chev" style="transform:' + (subOpen ? 'rotate(90deg)' : 'none') + '">' + I.chev + '</span></div>' +
            (subOpen ? '<div style="margin-top:6px">' + tp.subs.map(sb => {
              const status = Prog.displayStatus(sb.id, exam);
              return '<div class="subrow">' + B.dot(status) +
                '<div class="nm">' + U.esc(sb.name) + ' ' + B.badges(sb) + '</div>' +
                '<div class="row" style="gap:4px">' + Prog.STATUSES.map(s => '<button class="pill ' + (status === s.key ? 'on' : '') + '" style="padding:2px 6px;font-size:10px" data-act="quick-status" data-id="' + sb.id + '" data-status="' + s.key + '" title="' + s.label + '">' + s.label.slice(0, 3) + '</button>').join('') + '</div></div>';
            }).join('') +
              '<div class="btnrow" style="margin-top:8px"><button class="btn sm" data-act="open-topic" data-id="' + tp.id + '">Track topic (JM/JA)</button>' +
              '<button class="btn sm" data-act="nav" data-href="#/chapter/' + ch.id + '">Chapter dashboard</button></div>' : '') +
            '</div>';
        }).join('') +
        '</div></div>';
    }).join('');

    html += '<div class="srcbox">Sources &mdash; JM: ' + U.esc(sub.chapters.find(c => c.srcJM) ? '' : '') + ' <b>' + U.esc(Syl.data.meta.mainSource) + '</b>. JA: <b>' + U.esc(Syl.data.meta.advancedSource) + '</b>. <a href="#/profile/provenance"><b>Details &rsaquo;</b></a></div>';
    return { title: 'Syllabus', sub: 'official JEE Main &amp; Advanced topics', html };
  };
  B.action('toggle-exp', el => { const id = el.getAttribute('data-id'); B.exp[id] = !B.exp[id]; App.refresh(); });
  B.action('syl-filter', el => { B.filters.syllabus.status = el.getAttribute('data-v'); App.refresh(); });
  B.action('quick-status', el => App.mut.quickStatus(el.getAttribute('data-id'), B.scope, el.getAttribute('data-status')));
  B.action('open-topic', el => { location.hash = '#/topic/' + el.getAttribute('data-id'); });

  /* =========================================================== CHAPTER */
  Sc.chapter = function (parts) {
    const id = parts[0];
    const cs = Calc.chapterStats(id, B.scope);
    if (!cs) return { title: 'Chapter', html: B.empty('Chapter not found') };
    const ch = cs.chapter, a = cs.agg, exam = B.scope;
    const trend = Calc.accuracyTrend(12).slice(-6);
    let html = '<div class="card ' + B.subjectTint(cs.chapter.id.indexOf('phy') === 0 ? 'phy' : cs.chapter.id.indexOf('chem') === 0 ? 'chem' : 'math') + '">' +
      '<div class="between"><div><div class="xsmall bold muted">' + U.esc(cs.chapter.unit || '') + '</div>' +
      '<div class="bold" style="font-size:17px">' + U.esc(ch.name) + ' ' + B.badges(ch) + '</div></div>' +
      B.ring(a.pct, { size: 68, stroke: 9 }) + '</div>' +
      '<div class="hr"></div>' +
      '<div class="grid3">' +
      B.kpi('In scope', a.pct + '%', a.completed + '/' + a.total + ' ' + (exam === 'jm' ? 'JM' : 'JA')) +
      B.kpi('JM coverage', cs.jmPct + '%', 'Main syllabus') +
      B.kpi('JA coverage', cs.jaPct + '%', 'Advanced syllabus') +
      '</div><div class="grid3" style="margin-top:8px">' +
      B.kpi('Mastery', a.mastery + '%', 'accuracy-adjusted') +
      B.kpi('Remaining', a.remaining, 'subtopics left') +
      B.kpi('Weak', a.weak, 'flagged') + '</div>' +
      '</div>';
    const cov = Calc.practiceCoverage();
    html += '<div class="card"><div class="card-h"><h3>' + I.chart + ' Chapter performance</h3><span class="mini">' + (exam === 'jm' ? 'JM' : 'JA') + ' scope</span></div>' +
      '<div class="row wrap" style="gap:9px">' +
      B.kpi('Lecture completion', a.lectures.total ? Math.round(a.lectures.done / a.lectures.total * 100) + '%' : '-', a.lectures.done + '/' + a.lectures.total + ' lectures') +
      B.kpi('Questions solved', a.questions.attempted, a.questions.sessions + ' logs') +
      B.kpi('PYQs solved', a.questions.bySource.PYQ || 0, 'PYQ source') +
      B.kpi('Accuracy', a.questions.accuracy + '%', a.questions.wrong + ' wrong') +
      B.kpi('Revisions', a.revisionCount, a.revDue + ' due now') +
      B.kpi('Errors logged', cs.errors.total, cs.errors.open + ' open') +
      B.kpi('Study time', U.minsToHM(cs.timeMin), 'from timer/sessions') +
      B.kpi('DPP solved', a.questions.bySource.DPP || 0, 'DPP source') +
      '</div></div>';
    html += '<div class="card"><div class="card-h"><h3>Topic breakdown</h3><span class="mini">mastery %</span></div>' +
      App.charts.hbars(cs.topics.map(t => ({
        label: t.name, value: t.mastery, valueText: t.mastery + '%  (' + t.completed + '/' + t.total + ')',
        color: t.mastery >= 70 ? '#6FC894' : t.mastery >= 40 ? '#FFD873' : '#F8A79F'
      }))) +
      '<div class="xsmall muted">Each row is that topic\'s accuracy-adjusted mastery, not just lecture completion.</div></div>';
    const dimRows = Prog.DIMS.map(d => {
      const dd = a.dims[d];
      return { label: Prog.DIM_LABEL[d], value: dd.done, valueText: dd.done + ' done / ' + dd.partial + ' partial / ' + dd.none + ' not started', color: d === 'dpp' ? '#FFD873' : d === 'pyq' ? '#D3BDF8' : '#C3D8FA' };
    });
    html += '<div class="card"><div class="card-h"><h3>Dimension coverage</h3></div>' + App.charts.hbars(dimRows) + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Mistake patterns</h3></div>' +
      (cs.errors.total ? App.charts.hbars(Object.keys(cs.errors.byType).map(k => ({ label: k, value: cs.errors.byType[k].length, color: '#F8A79F' }))) : B.empty('No errors logged for this chapter yet.', '&#128221;')) +
      '</div>';
    html += '<div class="card"><div class="card-h"><h3>Subtopic detail</h3></div>' +
      ch.topics.map(tp => '<div style="margin-bottom:10px"><div class="small bold" style="margin-bottom:4px">' + U.esc(tp.name) + ' ' + B.badges(tp) + '</div>' +
        tp.subs.map(sb => '<div class="subrow">' + B.dot(Prog.displayStatus(sb.id, exam)) + '<div class="nm">' + U.esc(sb.name) + ' ' + B.badges(sb) + '</div>' +
          '<div class="xsmall muted">' + Prog.mastery(sb.id, exam) + '%</div></div>').join('') + '</div>').join('') + '</div>';
    html += '<div class="btnrow"><button class="btn sm" data-act="fab-question">Log questions</button><button class="btn sm" data-act="fab-error">Log error</button>' +
      '<button class="btn sm primary" data-act="analyse-chapter" data-id="' + ch.id + '">' + I.spark + ' Analyze chapter with Gemini</button></div>';
    return { title: ch.name, sub: 'chapter performance', back: true, html };
  };
  B.action('analyse-chapter', el => {
    const rec = Syl.rec(el.getAttribute('data-id'));
    location.hash = '#/gemini?q=' + encodeURIComponent('Analyze my chapter performance for ' + (rec ? rec.name : '') + ' (' + (rec ? rec.subject.name : '') + ') using only my stored tracker data.');
  });

  /* ============================================================= TOPIC */
  Sc.topic = function (parts) {
    const id = parts[0];
    const rec = Syl.rec(id);
    if (!rec) return { title: 'Topic', html: B.empty('Topic not found') };
    const exam = B.scope;
    const a = Prog.agg(id, exam);
    const p = Prog.get(id, exam);
    const rawStatus = Prog.displayStatus(id, exam);
    const status = (rawStatus === 'not_started' && (a.completed + a.learning + a.weak) > 0) ? Prog.statusOfAgg(id, exam) : rawStatus;
    const rev = Prog.revState(id, exam);
    const theTopic = rec.topic ? rec.topic : (rec.kind === 'sub' ? rec.topic : null);
    App.ui.ctxNode = rec.name;
    const src = rec.chapter;
    let html = '<div class="card ' + B.subjectTint(rec.subject.code) + '">' +
      '<div class="xsmall bold muted">' + U.esc(rec.subject.name) + ' &middot; <a href="#/chapter/' + src.id + '">' + U.esc(src.name) + ' &rsaquo;</a></div>' +
      '<div class="between" style="margin-top:4px">' +
      '<div style="flex:1"><div class="bold" style="font-size:18px">' + U.esc(rec.name) + '</div>' +
      '<div style="margin-top:5px">' + B.badges(rec.node) + ' ' + B.statusChip(status) + '</div></div>' +
      B.ring(a.mastery, { size: 72, stroke: 9, color: a.mastery >= 70 ? '#6FC894' : a.mastery >= 40 ? '#FFD873' : '#F8A79F' }) + '</div>' +
      '<div class="hr"></div>' +
      '<div class="grid3">' +
      B.kpi('Completed', a.pct + '%', a.completed + '/' + a.total + ' subtopics') +
      B.kpi('Coverage', a.coverage + '%', 'dimension weighted') +
      B.kpi('Mastery', a.mastery + '%', 'coverage x accuracy') +
      '</div><div class="grid3" style="margin-top:8px">' +
      B.kpi('Accuracy', (a.questions.attempted ? a.questions.accuracy + '%' : '-'), a.questions.attempted + ' attempted') +
      B.kpi('Weak', a.weak, 'subtopics flagged') +
      B.kpi('Revisions', a.revisionCount, a.revDue + ' due now') +
      '</div>' +
      (theTopic ? '<div class="xsmall muted" style="margin-top:8px">Lectures watched are not mastery - all six dimensions below feed the number above.</div>' : '') +
      '</div>';
    html += scopeSeg();
    html += '<div class="card"><div class="card-h"><h3>' + I.check + ' Independent JM / JA tracking</h3>' +
      '<button class="btn sm" data-act="edit-dims" data-id="' + id + '">Edit tracking</button></div>' +
      ['jm', 'ja'].map(ex => {
        const aa = Prog.agg(id, ex);
        const inScope = ex === exam || Prog.scope(id, ex).length > 0;
        return '<div class="row between" style="margin-bottom:6px"><div>' + B.badgeFor(ex) + ' <span class="small bold">' + (ex === 'jm' ? 'JEE Main' : 'JEE Advanced') + '</span></div>' +
          '<div class="small bold">' + aa.pct + '% <span class="muted">(' + aa.completed + '/' + aa.total + ')</span></div></div>' +
          '<div class="pbar thin ' + (ex === 'jm' ? 'grad-jm' : 'grad-ja') + '" style="margin-bottom:10px"><i style="width:' + aa.pct + '%"></i></div>';
      }).join('') +
      '<div class="note">Completing a subtopic for JEE Main does not mark it complete for JEE Advanced - the two scopes are tracked separately.</div></div>';
    /* dimensions */
    html += '<div class="card"><div class="card-h"><h3>Dimension status</h3><span class="mini">' + (exam === 'jm' ? 'JM' : 'JA') + '</span></div>' +
      '<table class="tbl">' + Prog.DIMS.concat(['revision']).map(d => {
        const val = d === 'revision' ? (p.revisionCount || 0) + ' completed' : (p[d] === 'done' ? 'Done' : p[d] === 'partial' ? 'Partial' : 'Not done');
        const tone = d === 'revision' ? (rev.overdue || rev.dueToday ? '#C0503F' : '#8A7E70') : (p[d] === 'done' ? '#2E7D4F' : p[d] === 'partial' ? '#B98A00' : '#8A7E70');
        return '<tr><td class="bold">' + Prog.DIM_LABEL[d] + '</td><td style="text-align:right;color:' + tone + ';font-weight:800">' + val + '</td></tr>';
      }).join('') +
      '<tr><td class="bold">Last studied</td><td style="text-align:right">' + (p.lastStudied ? U.relDay(p.lastStudied) : '-') + '</td></tr>' +
      '<tr><td class="bold">Time logged</td><td style="text-align:right">' + U.minsToHM(p.timeMin) + '</td></tr>' +
      '</table>' +
      '<div class="btnrow" style="margin-top:10px">' + Prog.DIMS.map(d => '<button class="btn sm ' + (p[d] === 'done' ? 'primary' : '') + '" data-act="toggle-dim" data-id="' + id + '" data-dim="' + d + '">' + Prog.DIM_LABEL[d] + (p[d] === 'done' ? ' \u2713' : '') + '</button>').join('') + '</div></div>';
    /* questions */
    const q = a.questions;
    html += '<div class="card"><div class="card-h"><h3>Questions</h3><button class="btn sm" data-act="log-q" data-id="' + id + '">Log</button></div>' +
      (q.attempted ? '<div class="grid3">' + B.kpi('Attempted', q.attempted, '') + B.kpi('Correct', q.correct, q.accuracy + '% acc') + B.kpi('Wrong', q.wrong, '') + '</div>' +
        '<div class="grid3" style="margin-top:8px">' + B.kpi('Unattempted', q.unattempted, '') + B.kpi('Time / question', q.perQ != null ? q.perQ : (q.attempted ? U.round1(q.timeMin / q.attempted) : 0) + ' min', '') + B.kpi('PYQ / DPP', (q.bySource.PYQ || 0) + ' / ' + (q.bySource.DPP || 0), 'questions') + '</div>'
        : B.empty('No questions logged for this topic yet. Lecture watched does not mean mastered - log some DPP/PYQ.', '&#9999;&#65039;')) +
      '</div>';
    /* lectures */
    const lec = a.lectures;
    html += '<div class="card"><div class="card-h"><h3>Lectures</h3><button class="btn sm" data-act="add-lec" data-id="' + id + '">Add</button></div>' +
      (lec.total ? '<div class="row between"><div class="small"><b>' + lec.done + '/' + lec.total + '</b> completed &middot; ' + lec.inProgress + ' in progress</div>' +
        '<div class="small muted">' + U.minsToHM(lec.watched) + ' watched of ' + U.minsToHM(lec.minutes) + '</div></div>' +
        '<div class="pbar thin" style="margin:8px 0"><i style="width:' + Math.round(lec.done / lec.total * 100) + '%"></i></div>' +
        lec.list.map((l, i) => '<div class="li" style="margin-bottom:7px"><div class="ico">' + (i + 1) + '</div>' +
          '<div class="bd"><div class="t">' + U.esc(l.title) + '</div><div class="s">' + (l.duration || 0) + ' min &middot; ' + U.esc(l.source || 'source n/a') + ' &middot; ' + U.esc(l.status) + '</div></div>' +
          '<button class="btn sm" data-act="lec-next" data-id="' + l.id + '">' + (l.status === 'Completed' ? 'Undo' : 'Next') + '</button></div>').join('')
        : B.empty('No lectures added for this topic.', '&#127916;')) +
      '</div>';
    /* revision */
    html += '<div class="card"><div class="card-h"><h3>Revision</h3><button class="btn sm" data-act="add-rev" data-id="' + id + '">Schedule</button></div>' +
      '<div class="grid3">' + B.kpi('Revisions done', p.revisionCount || 0, 'target 5') + B.kpi('Last revision', p.lastRevision ? U.relDay(p.lastRevision) : '-', '') + B.kpi('Next', rev.next ? U.relDay(rev.next.scheduledFor) : 'not scheduled', rev.next ? 'Rev ' + rev.next.index : '') + '</div>' +
      (rev.over.concat(rev.due, rev.up, rev.done).length ? '<div style="margin-top:10px">' + rev.over.concat(rev.due, rev.up, rev.done).map(r =>
        '<div class="li ' + (!r.completedAt && U.daysFromToday(r.scheduledFor) < 0 ? 'overdue' : '') + '" style="margin-bottom:7px"><div class="ico">R' + r.index + '</div>' +
        '<div class="bd"><div class="t">' + U.fmtDate(r.scheduledFor, 'short') + (r.completedAt ? ' - done' : ' - ' + U.relDay(r.scheduledFor)) + '</div>' +
        '<div class="s">' + (r.auto ? 'auto-scheduled (spaced repetition)' : 'manually scheduled') + '</div></div>' +
        (!r.completedAt ? '<button class="btn sm" data-act="rev-done" data-id="' + r.id + '">Done</button><button class="btn sm" data-act="rev-edit" data-id="' + r.id + '">Date</button>' : '') +
        '</div>').join('') + '</div>' : '') +
      '<div class="xsmall muted" style="margin-top:8px">Spaced repetition intervals: ' + Calc.SR_INTERVALS.join(', ') + ' days. Every date is editable.</div></div>';
    /* performance */
    const errs = S.state.errors.filter(e => e.topicId === id || e.nodeId === id || e.chapterId === (rec.chapter ? rec.chapter.id : ''));
    const trend = (function () {
      const ids = {};
      if (rec.kind === 'sub') ids[id] = 1;
      else if (rec.kind === 'topic') { ids[id] = 1; rec.topic.subs.forEach(s => ids[s.id] = 1); }
      else { ids[id] = 1; rec.chapter.topics.forEach(t2 => { ids[t2.id] = 1; t2.subs.forEach(s => ids[s.id] = 1); }); }
      return S.state.questions.filter(q => ids[q.nodeId] && q.exam === exam)
        .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-10)
        .map(q => ({ date: q.date, acc: q.attempted ? Math.round(q.correct / q.attempted * 100) : 0 }));
    })();
    html += '<div class="card"><div class="card-h"><h3>Performance</h3><span class="mini">mastery ' + a.mastery + '%</span></div>' +
      (trend.length ? '<div class="small bold">Accuracy trend (recent logged sets)</div>' + App.charts.line(trend.map(t => ({ label: U.fmtDate(t.date, 'short'), value: t.acc })), { max: 100, color: '#6E9BE0' }) : '<div class="small muted">No accuracy history yet for this topic.</div>') +
      '<div class="hr"></div>' +
      '<div class="small bold" style="margin-bottom:6px">Mistakes in this chapter (' + errs.length + ')</div>' +
      (errs.length ? errs.slice(0, 5).map(e => '<div class="row between" style="margin-bottom:5px"><span class="small">' + U.esc((e.mistakeType || '') + ' - ' + (e.questionText || '').slice(0, 46)) + '</span>' + B.statusChip(e.status === 'revised' ? 'completed' : 'weak', e.status) + '</div>').join('') : '<div class="small muted">No errors logged here.</div>') +
      '<div class="btnrow" style="margin-top:10px"><button class="btn sm" data-act="fab-error">Add error</button>' +
      '<button class="btn sm primary" data-act="ask-topic" data-id="' + id + '">' + I.spark + ' Ask Gemini about this topic</button></div></div>';
    /* subtopic breakdown */
    if (theTopic) {
      html += '<div class="card"><div class="card-h"><h3>Subtopics</h3><span class="mini">' + exam === 'jm' ? 'JM scope' : 'JA scope' + '</span></div>' +
        theTopic.subs.map(sb => '<div class="li" style="margin-bottom:7px"><div class="bd"><div class="t">' + U.esc(sb.name) + ' ' + B.badges(sb) + '</div>' +
          '<div class="s">' + Prog.STATUSES.map(s => '<button class="pill ' + (Prog.displayStatus(sb.id, exam) === s.key ? 'on' : '') + '" style="padding:2px 7px;font-size:10px" data-act="quick-status" data-id="' + sb.id + '" data-status="' + s.key + '">' + s.label + '</button>').join('') + '</div>' +
          '<div class="s"><span class="muted">mastery ' + Prog.mastery(sb.id, exam) + '%</span></div></div></div>').join('') + '</div>';
    }
    html += '<div class="srcbox"><b>Official syllabus basis</b><br>JM: ' + U.esc(rec.chapter.srcJM || 'JEE Main 2026 Paper 1') + '<br>JA: ' + U.esc(rec.chapter.srcJA || 'JEE Advanced 2026') + (rec.chapter.note ? '<br><i>' + U.esc(rec.chapter.note) + '</i>' : '') +
      '<br><a href="#/profile/provenance"><b>Source documents &rsaquo;</b></a></div>';
    return { title: rec.name, sub: rec.subject.name + ' &middot; ' + src.name, back: true, html };
  };
  B.action('edit-dims', el => App.forms.topicDimensions(el.getAttribute('data-id'), B.scope));
  B.action('toggle-dim', el => {
    const id = el.getAttribute('data-id'), dim = el.getAttribute('data-dim');
    const cur = Prog.get(id, B.scope)[dim];
    const next = cur === 'done' ? 'none' : 'done';
    const leaves = Prog.scope(id, B.scope);
    S.update(st => leaves.forEach(l => { const r = st.progress[l.id] = st.progress[l.id] || {}; const pp = r[B.scope] = r[B.scope] || Prog.blank(); pp[dim] = next; pp.lastStudied = U.todayISO(); }));
    App.refresh();
  });
  B.action('log-q', el => { const rec = Syl.rec(el.getAttribute('data-id')); App.forms.question({ subject: rec.subject.name, chapterId: rec.chapter.id, topicId: rec.topic ? rec.topic.id : '', nodeId: rec.kind === 'sub' ? rec.node.id : '' }); });
  B.action('add-lec', el => { const rec = Syl.rec(el.getAttribute('data-id')); App.forms.lecture({ subject: rec.subject.name, chapterId: rec.chapter.id, topicId: rec.topic ? rec.topic.id : '', exam: rec.node.ja && !rec.node.jm ? 'ja' : 'jm' }); });
  B.action('add-rev', el => {
    const rec = Syl.rec(el.getAttribute('data-id'));
    const idx = (Prog.get(rec.kind === 'sub' ? rec.node.id : (rec.topic ? rec.topic.id : rec.chapter.id), B.scope).revisionCount || 0) + 1;
    App.forms.revision({ subject: rec.subject.name, chapterId: rec.chapter.id, topicId: rec.topic ? rec.topic.id : '', nodeId: rec.kind === 'sub' ? rec.node.id : '', index: idx, exam: B.scope, scheduledFor: Calc.nextRevisionDate(rec.node.id, B.scope, idx - 1) });
  });
  B.action('rev-edit', el => { const r = S.state.revisions.find(x => x.id === el.getAttribute('data-id')); if (r) App.forms.revision(r); });
  B.action('lec-next', el => {
    const id = el.getAttribute('data-id');
    const l = S.state.lectures.find(x => x.id === id); if (!l) return;
    const next = l.status === 'Completed' ? 'In Progress' : l.status === 'In Progress' ? 'Completed' : 'In Progress';
    App.mut.lectureStatus(id, next);
  });
  B.action('ask-topic', el => {
    const rec = Syl.rec(el.getAttribute('data-id'));
    location.hash = '#/gemini?q=' + encodeURIComponent('Explain ' + rec.name + ' at JEE level and tell me what my tracker data says about it.');
  });

  /* ======================================================== TOPICS LEFT */
  Sc['topics-left'] = function (parts, query) {
    const f = B.filters.tl = B.filters.tl || { subject: query.subject || '', exam: query.exam || '', status: 'remaining', sort: 'chapter' };
    const rows = [];
    Syl.subjects.forEach(s => {
      if (f.subject && s.name !== f.subject) return;
      s.chapters.forEach(ch => ch.topics.forEach(tp => {
        ['jm', 'ja'].forEach(ex => {
          if (f.exam && f.exam !== ex) return;
          const a = Prog.agg(tp.id, ex);
          const pend = a.total - a.completed;
          if (f.status === 'remaining' && pend === 0) return;
          if (f.status === 'weak' && a.weak === 0) return;
          if (f.status === 'revision_due' && a.revDue === 0) return;
          if (f.status === 'not_started' && a.notStarted < a.total) return;
          if (f.status === 'in_progress' && !(a.learning > 0)) return;
          if (f.status === 'completed' && pend > 0) return;
          const p = Prog.peek(tp.id, ex);
          rows.push({
            id: tp.id, name: tp.name, chapter: ch.name, chapterId: ch.id, subject: s.name, code: s.code, exam: ex,
            remaining: pend, total: a.total, mastery: a.mastery, status: Prog.statusOfAgg(tp.id, ex), weak: a.weak,
            revDue: a.revDue, lastStudied: p ? p.lastStudied : null, priority: (a.weak * 3) + a.revDue * 2 + (a.learning ? 1 : 0) + (pend > 0 && a.completed > 0 ? 1 : 0),
            jm: tp.jm, ja: tp.ja
          });
        });
      }));
    });
    const sorters = {
      chapter: (a, b) => (a.subject + a.chapter).localeCompare(b.subject + b.chapter),
      priority: (a, b) => b.priority - a.priority,
      progress: (a, b) => b.mastery - a.mastery,
      last: (a, b) => String(b.lastStudied || '').localeCompare(String(a.lastStudied || '')),
      exam: (a, b) => a.exam.localeCompare(b.exam)
    };
    const sorted = rows.slice().sort(sorters[f.sort] || sorters.chapter);
    let mainLeft = 0, advLeft = 0;
    Syl.subjects.forEach(s => s.chapters.forEach(ch => ch.topics.forEach(tp => {
      const m = Prog.agg(tp.id, 'jm'), j = Prog.agg(tp.id, 'ja');
      mainLeft += m.total - m.completed; advLeft += j.total - j.completed;
    })));
    let html = '<div class="grid3">' + B.kpi('Total left', mainLeft + advLeft, 'JM + JA subtopics') + B.kpi('Main left', mainLeft, 'JEE Main') + B.kpi('Advanced left', advLeft, 'JEE Advanced') + '</div>';
    html += '<div class="card" style="margin-top:12px">' +
      '<div class="xsmall bold muted">SUBJECT</div><div class="chips">' + [''].concat(Syl.subjects.map(s => s.name)).map(v =>
        '<button class="pill tap ' + (f.subject === v ? 'on' : '') + '" data-act="tl-filter" data-k="subject" data-v="' + U.esc(v) + '">' + (v || 'All') + '</button>').join('') + '</div>' +
      '<div class="xsmall bold muted">EXAM</div><div class="chips">' + [['', 'Both'], ['jm', 'JM'], ['ja', 'JA']].map(([v, l]) =>
        '<button class="pill tap ' + (f.exam === v ? 'on' : '') + '" data-act="tl-filter" data-k="exam" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
      '<div class="xsmall bold muted">STATUS</div><div class="chips">' + [['remaining', 'Remaining'], ['not_started', 'Not started'], ['in_progress', 'In progress'], ['weak', 'Weak'], ['revision_due', 'Revision due'], ['completed', 'Completed']].map(([v, l]) =>
        '<button class="pill tap ' + (f.status === v ? 'on' : '') + '" data-act="tl-filter" data-k="status" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
      '<div class="xsmall bold muted">SORT BY</div><div class="chips">' + [['chapter', 'Chapter'], ['priority', 'Priority'], ['progress', 'Progress'], ['last', 'Last studied'], ['exam', 'Exam']].map(([v, l]) =>
        '<button class="pill tap ' + (f.sort === v ? 'on' : '') + '" data-act="tl-filter" data-k="sort" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
      '</div>';
    html += '<div class="sect-title">' + sorted.length + ' topic-entries match <span class="ln"></span></div>';
    html += sorted.length ? '<div class="list">' + sorted.slice(0, 120).map(r =>
      '<div class="li tap" data-act="open-topic" data-id="' + r.id + '"><div class="ico ' + B.subjectTint(r.code) + '" style="font-size:11px;font-weight:800">' + B.shortSub(r.subject) + '</div>' +
      '<div class="bd"><div class="t">' + U.esc(r.name) + ' ' + B.badgeFor(r.exam) + '</div>' +
      '<div class="s">' + U.esc(r.chapter) + ' &middot; ' + r.remaining + ' left of ' + r.total + ' &middot; ' + r.mastery + '% mastery' + (r.weak ? ' &middot; <b style="color:#C0503F">weak</b>' : '') + (r.revDue ? ' &middot; ' + r.revDue + ' rev due' : '') + '</div>' +
      '<div class="pbar thin" style="margin-top:5px;max-width:150px"><i style="width:' + (r.total ? Math.round((r.total - r.remaining) / r.total * 100) : 0) + '%"></i></div></div>' +
      '<span class="chev">' + I.chev + '</span></div>').join('') + '</div>' : B.empty('Nothing matches these filters.', '&#127881;');
    return { title: 'Topics Left', sub: 'what is still pending', back: true, html };
  };
  B.action('tl-filter', el => { B.filters.tl[el.getAttribute('data-k')] = el.getAttribute('data-v'); App.refresh(); });
})(typeof window !== 'undefined' ? window : globalThis);
