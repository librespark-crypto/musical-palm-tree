/* ==========================================================================
   screens2.js - Tasks (today / next 7 days / backlog), Lectures, Revision, Questions
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc, B = App.ui, I = App.icons;
  const Sc = App.screens;

  const hours = m => U.round1((m || 0) / 60) + ' h';
  const CHK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';

  /* ============================================================= TASKS */
  Sc.tasks = function (parts) {
    const tab = parts[0] || 'today';
    const t = U.todayISO();
    const o = Calc.overall();
    const target = S.state.profile.dailyTargetMin || 420;
    let html = '<div class="chips">' +
      [['today', "Today"], ['week', 'Next 7 days'], ['backlog', 'Backlog']].map(([k, l]) =>
        '<a class="pill ' + (tab === k ? 'on' : '') + '" href="#/tasks' + (k === 'today' ? '' : '/' + k) + '">' + l +
        (k === 'backlog' && o.tasks.backlogCount ? ' (' + o.tasks.backlogCount + ')' : '') + '</a>').join('') + '</div>';

    const taskLi = (x, opts) => {
      opts = opts || {};
      const done = x.status === 'done';
      const late = !done && x.plannedFor < t;
      return '<div class="li ' + (done ? 'done' : '') + ' ' + (late || x.inBacklog ? 'overdue' : '') + '">' +
        '<div class="chk ' + (done ? 'on' : '') + '" data-act="task-toggle" data-id="' + x.id + '">' + (done ? CHK : '') + '</div>' +
        '<div class="bd"><div class="t">' + U.esc(x.title) + (x.priority === 'High' ? ' <span class="pill soft" style="font-size:9.5px">High</span>' : '') + '</div>' +
        '<div class="s">' + U.esc(x.type || '') + ' &middot; ' + U.esc(x.subject || '') + ' ' + B.badgeFor(x.exam || 'jm') +
        ' &middot; ' + (x.estMin || 45) + ' min &middot; ' + U.esc(x.plannedFor === t ? 'today' : U.relDay(x.plannedFor)) + '</div>' +
        (opts.actions ? '<div class="btnrow" style="margin-top:7px">' +
          '<button class="btn sm" data-act="task-done-b" data-id="' + x.id + '">Complete</button>' +
          '<button class="btn sm" data-act="task-resched" data-id="' + x.id + '">Reschedule</button>' +
          '<button class="btn sm" data-act="task-split" data-id="' + x.id + '">Split</button>' +
          '<button class="btn sm ghost" data-act="task-del" data-id="' + x.id + '">Delete</button></div>' : '') +
        '</div>' +
        '<span class="chev" data-act="task-edit" data-id="' + x.id + '">' + I.chev + '</span></div>';
    };

    if (tab === 'today') {
      const todayTasks = S.state.tasks.filter(x => x.plannedFor === t && !x.inBacklog).sort((a, b) => (a.status === 'done') - (b.status === 'done'));
      const doneMin = U.sum(todayTasks.filter(x => x.status === 'done'), x => x.estMin || 0);
      const planMin = U.sum(todayTasks, x => x.estMin || 0);
      html += '<div class="grid3">' + B.kpi('Planned', todayTasks.length, U.minsToHM(planMin)) + B.kpi('Done', todayTasks.filter(x => x.status === 'done').length, U.minsToHM(doneMin)) +
        B.kpi('Logged time', U.minsToHM(o.time.today), 'target ' + hours(target)) + '</div>';
      if (planMin > target * 1.4) html += '<div class="banner" style="margin-top:12px">' + I.alert + '<div><b>Heavy day:</b> you planned ' + U.minsToHM(planMin) + ' but your daily target is ' + U.minsToHM(target) + '. Consider moving something to tomorrow.</div></div>';
      html += '<div class="card"><div class="card-h"><h3>' + I.check + ' Today&rsquo;s to-do</h3><button class="btn sm" data-act="fab-task">+ Task</button></div>' +
        (todayTasks.length ? '<div class="list">' + todayTasks.map(x => taskLi(x)).join('') + '</div>' : B.empty('Nothing planned today. Add lecture, PYQ, DPP, revision or mock-test tasks.', '&#127775;')) + '</div>';
      html += '<div class="card"><div class="card-h"><h3>' + I.refresh + ' Revisions to clear today</h3></div>' +
        (o.revision.dueToday.length + o.revision.overdue.length ? '<div class="list">' + o.revision.overdue.concat(o.revision.dueToday).slice(0, 6).map(r =>
          '<div class="li ' + (U.daysFromToday(r.scheduledFor) < 0 ? 'overdue' : '') + '"><div class="ico">R' + r.index + '</div>' +
          '<div class="bd"><div class="t">' + U.esc(r.topicName) + ' ' + B.badgeFor(r.exam) + '</div><div class="s">' + U.esc(r.chapterName) + ' &middot; ' + U.relDay(r.scheduledFor) + '</div></div>' +
          '<button class="btn sm" data-act="rev-done" data-id="' + r.id + '">Done</button></div>').join('') + '</div>'
          : B.empty('No revision pending.', '&#127807;')) + '</div>';
    }

    if (tab === 'week') {
      const days = [];
      for (let i = 0; i < 7; i++) { const d = U.addDays(t, i); days.push({ date: d, tasks: S.state.tasks.filter(x => x.plannedFor === d && !x.inBacklog) }); }
      html += '<div class="card"><div class="card-h"><h3>Next 7 days plan</h3><span class="mini">cap ' + hours(target) + '/day</span></div>' +
        days.map(d => {
          const mins = U.sum(d.tasks, x => x.estMin || 0);
          const over = mins > target * 1.25;
          const isToday = d.date === t;
          return '<div style="margin-bottom:12px">' +
            '<div class="row between"><div class="bold small">' + U.weekdayLong(d.date) + (isToday ? ' (today)' : '') + '<span class="muted"> &middot; ' + U.fmtDate(d.date, 'short') + '</span></div>' +
            '<div class="small bold" style="color:' + (over ? '#C0503F' : '#4A4038') + '">' + (mins ? U.minsToHM(mins) : 'free') + '</div></div>' +
            '<div class="pbar thin" style="margin:5px 0"><i style="width:' + Math.min(100, Math.round(mins / target * 100)) + '%;background:' + (over ? '#F8A79F' : '#9FDFB1') + '"></i></div>' +
            (d.tasks.length ? d.tasks.map(x => taskLi(x)).join('') : '<div class="xsmall muted" style="padding:4px 0">No tasks planned.</div>') +
            (over ? '<div class="note" style="margin-top:6px">' + I.alert + ' Planned workload looks unusually high for one day (' + U.minsToHM(mins) + ').</div>' : '') +
            '</div>';
        }).join('') + '</div>';
      const weekMin = U.sum(days, d => U.sum(d.tasks, x => x.estMin || 0));
      html += '<div class="card"><div class="row between"><div class="bold">Total planned this week</div><div class="bold">' + U.minsToHM(weekMin) + '</div></div>' +
        '<div class="xsmall muted" style="margin-top:4px">Logged in the last 7 days: ' + U.minsToHM(o.time.week) + '</div></div>';
    }

    if (tab === 'backlog') {
      const backlog = S.state.tasks.filter(x => x.status !== 'done' && (x.inBacklog || x.plannedFor < t)).sort((a, b) => a.plannedFor < b.plannedFor ? -1 : 1);
      const overdue = backlog.filter(x => x.inBacklog);
      const missedToday = backlog.filter(x => !x.inBacklog);
      html += '<div class="grid3">' + B.kpi('Today&rsquo;s carry-over', missedToday.length, U.minsToHM(U.sum(missedToday, x => x.estMin || 0))) +
        B.kpi('Overdue backlog', overdue.length, 'auto-moved') + B.kpi('Total backlog', backlog.length, U.minsToHM(U.sum(backlog, x => x.estMin || 0))) + '</div>';
      html += '<div class="banner info" style="margin-top:12px">' + I.alert + '<div>Unfinished tasks are moved here automatically at the start of a new day. Nothing is ever deleted - complete, reschedule, split or delete explicitly.</div></div>';
      html += '<div class="card"><div class="card-h"><h3>Backlog items</h3><span class="mini">' + backlog.length + '</span></div>' +
        (backlog.length ? '<div class="list">' + backlog.map(x => taskLi(x, { actions: true })).join('') + '</div>' : B.empty('Backlog is empty. Excellent.', '&#128077;')) + '</div>';
    }
    return { title: 'Tasks', sub: 'plan, execute, clear backlog', html };
  };
  B.action('task-done-b', el => App.mut.taskDone(el.getAttribute('data-id')));
  B.action('task-resched', el => App.mut.taskReschedule(el.getAttribute('data-id')));
  B.action('task-split', el => App.mut.taskSplit(el.getAttribute('data-id')));
  B.action('task-del', el => App.mut.taskDelete(el.getAttribute('data-id')));
  B.action('task-edit', el => { const x = S.state.tasks.find(y => y.id === el.getAttribute('data-id')); if (x) App.forms.task(x); });

  /* =========================================================== LECTURES */
  Sc.lectures = function () {
    const l = Calc.lectureStats();
    const f = B.filters.lec = B.filters.lec || { subject: '', status: 'all' };
    const list = S.state.lectures.filter(x => (!f.subject || x.subject === f.subject) && (f.status === 'all' || (f.status === 'pending' ? x.status !== 'Completed' : x.status === f.status)));
    const byChapter = U.groupBy(list, x => x.chapterId || 'none');
    let html = '<div class="card"><div class="card-h"><h3>' + I.play + ' Lecture tracker</h3><button class="btn sm" data-act="fab-lecture">+ Lecture</button></div>' +
      '<div class="grid3">' + B.kpi('Total lectures', l.total, '') + B.kpi('Completed', l.done, l.inProgress + ' in progress') + B.kpi('Remaining', l.remaining, '') + '</div>' +
      '<div class="grid3" style="margin-top:8px">' + B.kpi('Total hours', hours(l.minutes), 'all lectures') + B.kpi('Watched', hours(l.watched), Math.round(l.watched / Math.max(1, l.minutes) * 100) + '% of library') + B.kpi('Remaining', hours(Math.max(0, l.minutes - l.watched)), '') + '</div>' +
      '<div class="pbar" style="margin-top:10px"><i style="width:' + (l.total ? Math.round(l.done / l.total * 100) : 0) + '%"></i></div>' +
      '</div>';
    html += '<div class="card"><div class="xsmall bold muted">SUBJECT</div><div class="chips">' +
      [['', 'All']].concat(Syl.subjects.map(s => [s.name, B.shortSub(s.name)])).map(([v, lb]) =>
        '<button class="pill tap ' + (f.subject === v ? 'on' : '') + '" data-act="lec-filter" data-k="subject" data-v="' + U.esc(v) + '">' + lb + '</button>').join('') + '</div>' +
      '<div class="xsmall bold muted">STATUS</div><div class="chips">' +
      [['all', 'All'], ['pending', 'Pending'], ['Not Started', 'Not started'], ['In Progress', 'In progress'], ['Completed', 'Completed']].map(([v, lb]) =>
        '<button class="pill tap ' + (f.status === v ? 'on' : '') + '" data-act="lec-filter" data-k="status" data-v="' + U.esc(v) + '">' + lb + '</button>').join('') + '</div>' +
      '<div class="hr"></div>' + App.charts.hbars(Object.keys(l.bySubject).map(k => ({ label: k, value: l.bySubject[k].done, valueText: l.bySubject[k].done + '/' + l.bySubject[k].total + ' (' + hours(l.bySubject[k].watched) + ' watched)', color: l.bySubject[k].subject === 'Physics' ? '#C3D8FA' : l.bySubject[k].subject === 'Chemistry' ? '#BFE9CD' : '#FBD2A9' }))) +
      '</div>';
    html += '<div class="sect-title">Lectures by chapter <span class="ln"></span><span class="mini">' + list.length + ' shown</span></div>';
    const groups = Object.keys(byChapter);
    html += groups.length ? groups.map(gid => {
      const rec = Syl.rec(gid);
      const items = byChapter[gid].slice().sort((a, b) => (a.number || 0) - (b.number || 0));
      const done = items.filter(x => x.status === 'Completed').length;
      return '<div class="card"><div class="between"><div class="bold small">' + U.esc(rec ? rec.chapter.name : 'Unassigned') + '</div>' +
        '<div class="xsmall muted">' + done + '/' + items.length + ' done</div></div>' +
        '<div class="pbar thin" style="margin:6px 0 8px"><i style="width:' + Math.round(done / items.length * 100) + '%"></i></div>' +
        items.map(x => '<div class="li tap" style="margin-bottom:7px" data-act="lec-open" data-id="' + x.id + '">' +
          '<div class="ico">' + (x.status === 'Completed' ? CHK : x.status === 'In Progress' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4.5 19 12 7 19.5z"/></svg>' : (x.number || 1)) + '</div>' +
          '<div class="bd"><div class="t">' + U.esc(x.title) + ' ' + B.badgeFor(x.exam === 'both' ? 'jm' : x.exam) + '</div>' +
          '<div class="s">' + U.esc(rec ? (rec.topic ? rec.topic.name : '') : '') + ' &middot; ' + (x.duration || 0) + ' min &middot; ' + U.esc(x.status) + (x.watchedMin ? ' (' + x.watchedMin + ' min watched)' : '') + '</div></div>' +
          '<div class="btnrow">' + (x.status !== 'Completed' ? '<button class="btn sm" data-act="lec-next" data-id="' + x.id + '">' + (x.status === 'Not Started' ? 'Start' : 'Complete') + '</button>' : '<button class="btn sm ghost" data-act="lec-next" data-id="' + x.id + '">Undo</button>') + '</div></div>').join('') + '</div>';
    }).join('') : B.empty('No lectures added yet. Add them manually with subject, chapter, topic, number, duration and source.', '&#127916;');
    return { title: 'Lectures', sub: 'manual lecture library', back: true, html };
  };
  B.action('lec-filter', el => { B.filters.lec[el.getAttribute('data-k')] = el.getAttribute('data-v'); App.refresh(); });
  B.action('lec-open', el => { const x = S.state.lectures.find(y => y.id === el.getAttribute('data-id')); if (x) App.forms.lecture(x); });

  /* =========================================================== REVISION */
  Sc.revision = function () {
    const f = B.filters.rev = B.filters.rev || { exam: '' };
    const r = Calc.revisionBuckets(f.exam || null);
    const cons = Calc.revisionConsistency();
    const row = (x, kind) => '<div class="li ' + (kind === 'overdue' ? 'overdue' : '') + '" style="flex-direction:column;align-items:stretch">' +
      '<div class="row" style="gap:10px;align-items:flex-start">' +
      '<div class="ico">R' + (x.index || 1) + '</div>' +
      '<div class="bd"><div class="t">' + U.esc(x.topicName || '') + ' ' + B.badgeFor(x.exam) + '</div>' +
      '<div class="s">' + U.esc(x.chapterName || '') + ' &middot; ' + U.fmtDate(x.scheduledFor, 'short') + ' &middot; ' + (kind === 'done' ? 'completed ' + U.relDay(U.iso(new Date(x.completedAt))) : U.relDay(x.scheduledFor)) + '</div></div>' +
      (kind === 'done' ? '<span class="st st-completed">Done</span>' : '') + '</div>' +
      (kind === 'done' ? '' : '<div class="btnrow" style="margin-top:8px">' +
        '<button class="btn sm primary" data-act="rev-done" data-id="' + x.id + '">Mark revised</button>' +
        '<button class="btn sm" data-act="rev-date" data-id="' + x.id + '">Change date</button>' +
        '<button class="btn sm ghost" data-act="rev-del" data-id="' + x.id + '" title="Remove this revision">Remove</button></div>') +
      '</div>';
    let html = '<div class="grid3">' + B.kpi('Due today', r.dueToday.length, '') + B.kpi('Overdue', r.overdue.length, '') + B.kpi('Upcoming', r.upcoming.length, '') + '</div>';
    html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Revision consistency (28 days)</h3><span class="mini">' + cons.rate + '%</span></div>' +
      B.pbar(cons.rate, 'grad-phy') +
      '<div class="xsmall muted" style="margin-top:8px">' + cons.done + ' of ' + cons.scheduled + ' scheduled revisions completed &middot; ' + cons.late + ' done late &middot; ' + cons.overdue + ' still overdue. Spaced repetition: ' + Calc.SR_INTERVALS.join(', ') + ' days.</div>' +
      '<div class="btnrow" style="margin-top:10px"><button class="btn sm" data-act="fab-revision">+ Schedule revision</button>' +
      '<button class="btn sm" data-act="auto-rev-rules">How scheduling works</button></div></div>';
    html += '<div class="chips">' + [['', 'All exams'], ['jm', 'JEE Main'], ['ja', 'JEE Advanced']].map(([v, l]) =>
      '<button class="pill tap ' + (f.exam === v ? 'on' : '') + '" data-act="rev-filter" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Due today</h3><span class="mini">' + r.dueToday.length + '</span></div>' + (r.dueToday.length ? '<div class="list">' + r.dueToday.map(x => row(x, 'due')).join('') + '</div>' : B.empty('Nothing due today.', '&#127807;')) + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Overdue</h3><span class="mini">' + r.overdue.length + '</span></div>' + (r.overdue.length ? '<div class="list">' + r.overdue.map(x => row(x, 'overdue')).join('') + '</div>' : B.empty('No overdue revisions.', '&#128077;')) + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Upcoming</h3><span class="mini">' + r.upcoming.length + '</span></div>' + (r.upcoming.length ? '<div class="list">' + r.upcoming.slice(0, 25).map(x => row(x, 'up')).join('') + '</div>' : B.empty('No upcoming revisions scheduled.', '&#128197;')) + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Completed</h3><span class="mini">' + r.done.length + '</span></div>' +
      (r.done.length ? '<div class="list">' + r.done.slice(-12).reverse().map(x => row(x, 'done')).join('') + '</div>' : B.empty('No completed revisions yet.', '&#128218;')) + '</div>';
    return { title: 'Revision', sub: 'spaced repetition, editable dates', back: true, html };
  };
  B.action('rev-filter', el => { B.filters.rev.exam = el.getAttribute('data-v'); App.refresh(); });
  B.action('rev-date', el => App.mut.revisionReschedule(el.getAttribute('data-id')));
  B.action('rev-del', el => App.mut.revisionDelete(el.getAttribute('data-id')));
  B.action('auto-rev-rules', () => B.sheet({
    title: 'How revisions are scheduled',
    html: '<p class="small">When you mark a topic/subtopic <b>completed</b> for an exam, a Revision 1 is auto-scheduled the next day. Completing a revision schedules the next one at the spaced-repetition interval (' + Calc.SR_INTERVALS.join(' / ') + ' days for revisions 1-5).</p>' +
      '<p class="small">Every date is editable: use <b>Date</b> on any revision row. Revisions are tracked separately per exam (JM / JA).</p>' +
      '<p class="small muted">You can switch auto-scheduling off in Profile &rarr; Preferences; manual scheduling always remains available.</p>'
  }));

  /* ========================================================== QUESTIONS */
  Sc.questions = function () {
    const f = B.filters.qq = B.filters.qq || { subject: '', exam: '', source: '', days: 30 };
    const from = U.addDays(U.todayISO(), -(f.days - 1));
    const logs = S.state.questions.filter(q => (q.date >= from) && (!f.subject || q.subject === f.subject) && (!f.exam || q.exam === f.exam) && (!f.source || q.source === f.source))
      .sort((a, b) => (a.date + (a.ts || '')) < (b.date + (b.ts || '')) ? 1 : -1);
    const a = U.sum(logs, q => q.attempted || 0), c = U.sum(logs, q => q.correct || 0), w = U.sum(logs, q => q.wrong || 0), u = U.sum(logs, q => q.unattempted || 0), tm = U.sum(logs, q => q.timeMin || 0);
    const bySource = {}, bySubject = {}, byExam = {};
    logs.forEach(q => {
      bySource[q.source] = (bySource[q.source] || 0) + (q.attempted || 0);
      bySubject[q.subject] = bySubject[q.subject] || { a: 0, c: 0 }; bySubject[q.subject].a += q.attempted || 0; bySubject[q.subject].c += q.correct || 0;
      byExam[q.exam] = byExam[q.exam] || { a: 0, c: 0 }; byExam[q.exam].a += q.attempted || 0; byExam[q.exam].c += q.correct || 0;
    });
    const arrAvg = (el, f2) => (el.days === 0 ? 0 : U.round1(el.total / el.days));
    const daysWithQ = U.uniq(logs.map(q => q.date)).length || 1;
    let html = '<div class="grid3">' + B.kpi('Attempted', a, f.days + '-day window') + B.kpi('Correct', c, a ? Math.round(c / a * 100) + '% accuracy' : '-') + B.kpi('Wrong', w, '') + '</div>' +
      '<div class="grid3" style="margin-top:8px">' + B.kpi('Unattempted', u, '') + B.kpi('Questions/day', U.round1(a / daysWithQ), daysWithQ + ' active days') + B.kpi('Time/question', a ? U.round1(tm / a) + ' min' : '-', U.minsToHM(tm) + ' total') + '</div>';
    html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Distribution</h3><button class="btn sm" data-act="fab-question">+ Log</button></div>' +
      App.charts.hbars(Object.keys(bySource).map(k => ({ label: k, value: bySource[k], color: k === 'PYQ' ? '#D3BDF8' : k === 'DPP' ? '#FFD873' : k === 'Mock Test' ? '#F8A79F' : '#C3D8FA' }))) +
      '<div class="hr"></div>' +
      App.charts.hbars(Object.keys(bySubject).map(k => ({ label: k, value: bySubject[k].a, valueText: bySubject[k].a + ' qs \u00b7 ' + (bySubject[k].a ? Math.round(bySubject[k].c / bySubject[k].a * 100) : 0) + '% acc', color: k === 'Physics' ? '#C3D8FA' : k === 'Chemistry' ? '#BFE9CD' : '#FBD2A9' }))) +
      '<div class="hr"></div>' +
      App.charts.hbars([{ label: 'JEE Main (JM)', value: (byExam.jm || { a: 0 }).a, valueText: ((byExam.jm || { a: 0, c: 0 }).a) + ' qs', color: '#C3D8FA' }, { label: 'JEE Advanced (JA)', value: (byExam.ja || { a: 0 }).a, valueText: ((byExam.ja || { a: 0, c: 0 }).a) + ' qs', color: '#F9BDD2' }]) +
      '</div>';
    html += '<div class="chips">' +
      [['', 'All subjects']].concat(Syl.subjects.map(s => [s.name, B.shortSub(s.name)])).map(([v, l]) => '<button class="pill tap ' + (f.subject === v ? 'on' : '') + '" data-act="q-filter" data-k="subject" data-v="' + U.esc(v) + '">' + l + '</button>').join('') +
      '</div><div class="chips">' + [['', 'Both exams'], ['jm', 'JM'], ['ja', 'JA']].map(([v, l]) => '<button class="pill tap ' + (f.exam === v ? 'on' : '') + '" data-act="q-filter" data-k="exam" data-v="' + v + '">' + l + '</button>').join('') +
      [['', 'All sources']].concat(App.prog.SOURCES.map(s => [s, s])).map(([v, l]) => '<button class="pill tap ' + (f.source === v ? 'on' : '') + '" data-act="q-filter" data-k="source" data-v="' + v + '">' + l + '</button>').join('') +
      '</div><div class="chips">' + [[7, '7 days'], [30, '30 days'], [90, '90 days'], [3650, 'All time']].map(([v, l]) => '<button class="pill tap ' + (+f.days === +v ? 'on' : '') + '" data-act="q-filter" data-k="days" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
    html += '<div class="card"><div class="card-h"><h3>Question logs</h3><span class="mini">' + logs.length + ' entries</span></div>' +
      (logs.length ? '<div class="list">' + logs.slice(0, 60).map(q => {
        const rec = q.nodeId ? Syl.rec(q.nodeId) : null;
        return '<div class="li tap" data-act="q-edit" data-id="' + q.id + '"><div class="ico ' + B.subjectTint(q.subject === 'Physics' ? 'phy' : q.subject === 'Chemistry' ? 'chem' : 'math') + '" style="font-size:10px">' + (q.source || '').slice(0, 4).toUpperCase() + '</div>' +
          '<div class="bd"><div class="t">' + U.esc(rec ? rec.name : (q.subject || 'Unassigned')) + ' ' + B.badgeFor(q.exam) + '</div>' +
          '<div class="s">' + U.esc(rec ? rec.chapter.name : '') + ' &middot; ' + q.attempted + ' attempted &middot; ' + q.correct + ' correct &middot; ' + q.wrong + ' wrong &middot; ' + q.accuracy + '% &middot; ' + U.fmtDate(q.date, 'short') + '</div></div>' +
          '<div class="small bold">' + q.accuracy + '%</div></div>';
      }).join('') + '</div>' : B.empty('No question logs in this window. Log DPP, PYQ, practice and mock-test questions to build accuracy data.', '&#9999;&#65039;')) + '</div>';
    return { title: 'Questions', sub: 'DPP, PYQ, practice, mocks', back: true, html };
  };
  B.action('q-filter', el => { B.filters.qq[el.getAttribute('data-k')] = el.getAttribute('data-k') === 'days' ? +el.getAttribute('data-v') : el.getAttribute('data-v'); App.refresh(); });
  B.action('q-edit', el => { const q = S.state.questions.find(x => x.id === el.getAttribute('data-id')); if (q) App.forms.question(q); });
})(typeof window !== 'undefined' ? window : globalThis);
