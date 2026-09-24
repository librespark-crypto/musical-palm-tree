/* ==========================================================================
   sample.js - optional, clearly-labelled SAMPLE data so the analytics screens
   can be explored. Real tracking starts empty; the app never invents stats.
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const Sample = (App.sample = {
    load() {
      const r = rng(20260924);
      const st = S.defaultState();
      st.profile = Object.assign(st.profile, {
        name: 'Sample Student', examLabel: 'JEE 2027', dailyTargetMin: 480,
        mainDate: U.addDays(U.todayISO(), 118), advancedDate: U.addDays(U.todayISO(), 236)
      });
      st.settings = Object.assign(st.settings, { sample: true, autoRevision: true });
      const pick = (n, fn, arr) => { let c = 0; for (const x of arr) { if (c >= n) break; if (fn(x, c)) { c++; } } return c; };
      const subjPlan = { phy: { chapters: 9, pct: .58 }, chem: { chapters: 11, pct: .48 }, math: { chapters: 9, pct: .42 } };
      const completedLeaves = [];

      Syl.subjects.forEach(sub => {
        const plan = subjPlan[sub.code];
        sub.chapters.slice(0, plan.chapters).forEach(ch => {
          ch.topics.forEach(tp => {
            const f = r();
            const mode = f < plan.pct ? 'done' : f < plan.pct + .2 ? 'learning' : 'none';
            tp.subs.forEach(sb => {
              ['jm', 'ja'].forEach(ex => {
                if (!sb[ex]) return;
                const rec = st.progress[sb.id] = st.progress[sb.id] || {};
                const p = rec[ex] = Prog.blank();
                if (mode === 'none') return;
                if (mode === 'learning') {
                  p.status = 'learning';
                  p.theory = r() < .7 ? 'done' : 'partial';
                  p.lecture = r() < .6 ? 'done' : 'partial';
                  p.dpp = r() < .3 ? 'partial' : 'none';
                  return;
                }
                p.status = r() < .12 ? 'weak' : 'completed';
                p.weak = p.status === 'weak';
                p.theory = 'done';
                p.lecture = r() < .9 ? 'done' : 'partial';
                p.dpp = r() < .8 ? 'done' : 'partial';
                p.pyq = r() < .6 ? 'done' : 'partial';
                p.practice = r() < .55 ? 'done' : 'partial';
                p.revisionCount = Math.floor(r() * 4);
                p.lastStudied = U.addDays(U.todayISO(), -Math.floor(r() * 22));
                p.timeMin = Math.round(20 + r() * 180);
                if (p.status === 'completed') completedLeaves.push({ id: sb.id, exam: ex, sub: sub.name });
              });
            });
          });
        });
      });

      /* lectures */
      let lecN = 0;
      Syl.subjects.forEach(sub => {
        sub.chapters.slice(0, 8).forEach(ch => {
          ch.topics.slice(0, 3).forEach(tp => {
            const count = 1 + Math.floor(r() * 4);
            for (let i = 1; i <= count; i++) {
              const status = r() < .62 ? 'Completed' : r() < .6 ? 'In Progress' : 'Not Started';
              const dur = 45 + Math.floor(r() * 50);
              st.lectures.push({
                id: 'sample-lec-' + (++lecN), subject: sub.name, chapterId: ch.id, topicId: tp.id,
                title: tp.name + ' - Lecture ' + i, number: i, duration: dur,
                source: r() < .5 ? 'Coaching batch' : 'Recorded course',
                status, watchedMin: status === 'Completed' ? dur : Math.floor(dur * (status === 'In Progress' ? r() : 0)),
                exam: tp.ja && !tp.jm ? 'ja' : (tp.jm && tp.ja ? 'both' : 'jm'),
                date: U.addDays(U.todayISO(), -Math.floor(r() * 40))
              });
            }
          });
        });
      });

      /* revisions: seeded from completed leaves */
      let revN = 0;
      completedLeaves.slice(0, 120).forEach((l, i) => {
        const rec = Syl.rec(l.id);
        const idx = (S.state.progress[l.id] && S.state.progress[l.id][l.exam] ? 0 : 0) + 1;
        const roll = r();
        const kind = roll < .45 ? 'done' : roll < .62 ? 'today' : roll < .78 ? 'upcoming' : 'overdue';
        const date = kind === 'done' ? U.addDays(U.todayISO(), -Math.floor(r() * 20) - 1)
          : kind === 'today' ? U.todayISO()
            : kind === 'upcoming' ? U.addDays(U.todayISO(), 1 + Math.floor(r() * 10))
              : U.addDays(U.todayISO(), -(1 + Math.floor(r() * 9)));
        st.revisions.push({
          id: 'sample-rev-' + (++revN), nodeId: l.id, topicId: rec.topic ? rec.topic.id : rec.chapter.id,
          topicName: rec.topic ? rec.topic.name : rec.chapter.name, chapterName: rec.chapter.name,
          subject: rec.subject.name, exam: l.exam, index: 1 + Math.floor(r() * 3), scheduledFor: date,
          completedAt: kind === 'done' ? new Date(date + 'T18:30:00').toISOString() : null,
          auto: true, createdAt: U.addDays(U.todayISO(), -30)
        });
      });

      /* questions */
      let qn = 0;
      for (let d = 29; d >= 0; d--) {
        const date = U.addDays(U.todayISO(), -d);
        const perDay = r() < .22 ? 0 : 1 + Math.floor(r() * 3);
        for (let k = 0; k < perDay; k++) {
          const sub = Syl.subjects[Math.floor(r() * 3)];
          const ch = sub.chapters[Math.floor(r() * Math.min(sub.chapters.length, 10))];
          const tp = ch.topics[Math.floor(r() * ch.topics.length)];
          const sb = tp.subs[Math.floor(r() * tp.subs.length)];
          const src = ['DPP', 'PYQ', 'Practice', 'Mock Test'][Math.floor(r() * 4)];
          const att = 5 + Math.floor(r() * 25);
          const acc = .42 + r() * .5;
          const corr = Math.round(att * acc);
          st.questions.push({
            id: 'sample-q-' + (++qn), date, source: src, subject: sub.name,
            chapterId: ch.id, topicId: tp.id, nodeId: sb.id,
            exam: sb.ja && !sb.jm ? 'ja' : (r() < .35 ? 'ja' : 'jm'),
            difficulty: ['Easy', 'Moderate', 'Hard'][Math.floor(r() * 3)],
            attempted: att, correct: corr, wrong: att - corr, unattempted: Math.floor(r() * 3),
            timeMin: att * (1 + Math.round(r() * 3)), ts: new Date(date + 'T17:00:00').toISOString(),
            accuracy: Math.round(corr / att * 100)
          });
        }
      }

      /* errors */
      const types = Prog.MISTAKE_TYPES;
      for (let i = 0; i < 22; i++) {
        const sub = Syl.subjects[Math.floor(r() * 3)];
        const ch = sub.chapters[Math.floor(r() * Math.min(sub.chapters.length, 10))];
        const tp = ch.topics[Math.floor(r() * ch.topics.length)];
        st.errors.push({
          id: 'sample-err-' + i, date: U.addDays(U.todayISO(), -Math.floor(r() * 28)),
          questionText: 'Sample error entry ' + (i + 1) + ' - ' + tp.name + ' (' + ch.name + ')',
          subject: sub.name, chapterId: ch.id, topicId: tp.id, nodeId: tp.subs[0].id,
          exam: r() < .5 ? 'ja' : 'jm', mistakeType: types[Math.floor(r() * types.length)],
          correctConcept: 'This is sample data: the concept note would go here.',
          note: 'Sample note: how to avoid repeating it.',
          status: r() < .4 ? 'open' : r() < .7 ? 'revised' : 'mastered',
          revisions: Math.floor(r() * 3), createdAt: U.nowISO()
        });
      }

      /* tests */
      const testNames = ['Coaching Minor Test 1', 'Coaching Minor Test 2', 'Self Mock - Main pattern', 'Coaching Major Test 1', 'Self Mock - Advanced pattern'];
      testNames.forEach((n, i) => {
        const date = U.addDays(U.todayISO(), -((testNames.length - i) * 7));
        const max = i % 2 ? 180 : 300;
        const score = Math.round(max * (.42 + i * .05 + r() * .06));
        const att = Math.round(max * .62);
        const corr = Math.round(att * (.55 + r() * .2));
        st.tests.push({
          id: 'sample-test-' + i, name: n, date, exam: i % 2 ? 'ja' : 'jm',
          score, maxMarks: max, attempted: att, correct: corr, wrong: att - corr,
          unattempted: Math.round(max * .1), timeMin: 180, accuracy: Math.round(corr / att * 100),
          subjects: { phy: { score: Math.round(score * .34), max: Math.round(max / 3) }, chem: { score: Math.round(score * .36), max: Math.round(max / 3) }, math: { score: Math.round(score * .3), max: Math.round(max / 3) } },
          notes: 'Sample test entry.', createdAt: U.nowISO()
        });
      });

      /* tasks */
      const today = U.todayISO();
      for (let d = 12; d >= -5; d--) {
        const date = U.addDays(today, -d);
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const sub = Syl.subjects[Math.floor(r() * 3)];
          const ch = sub.chapters[Math.floor(r() * Math.min(sub.chapters.length, 9))];
          const tp = ch.topics[Math.floor(r() * ch.topics.length)];
          const type = Prog.TASK_TYPES[Math.floor(r() * Prog.TASK_TYPES.length)];
          const doneRoll = d > 0 ? r() < .72 : r() < .3;
          st.tasks.push({
            id: 'sample-task-' + d + '-' + k, title: type + ': ' + tp.name, type,
            subject: sub.name, chapterId: ch.id, topicId: tp.id, nodeId: '', exam: tp.ja && !tp.jm ? 'ja' : 'jm',
            estMin: [30, 45, 60, 90][Math.floor(r() * 4)], priority: r() < .3 ? 'High' : r() < .7 ? 'Medium' : 'Low',
            plannedFor: date, status: doneRoll ? 'done' : 'pending',
            completedAt: doneRoll ? new Date(date + 'T20:00:00').toISOString() : null,
            inBacklog: !doneRoll && d > 0, backlogSince: !doneRoll && d > 0 ? today : null, createdAt: U.nowISO()
          });
        }
      }

      /* sessions */
      for (let d = 34; d >= 0; d--) {
        const date = U.addDays(today, -d);
        const n = r() < .15 ? 0 : 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const mins = [30, 45, 60, 75, 90, 120][Math.floor(r() * 6)];
          const start = new Date(date + 'T' + String(8 + Math.floor(r() * 10)).padStart(2, '0') + ':00:00');
          const sub = Syl.subjects[Math.floor(r() * 3)];
          const ch = sub.chapters[Math.floor(r() * Math.min(sub.chapters.length, 10))];
          st.sessions.push({
            id: 'sample-ses-' + d + '-' + k, mode: ['Lecture', 'Practice', 'Revision', 'PYQ', 'Mock Test', 'Other'][Math.floor(r() * 6)],
            subject: sub.name, chapterId: ch.id, topicId: ch.topics[0].id,
            start: start.toISOString(), end: new Date(start.getTime() + mins * 60000).toISOString(), minutes: mins
          });
        }
      }

      S.state = st;
      S.save(true);
      S.emit();
    },
    clear() {
      S.state.progress = {}; S.state.lectures = []; S.state.revisions = []; S.state.tasks = [];
      S.state.questions = []; S.state.errors = []; S.state.tests = []; S.state.sessions = [];
      S.state.settings.sample = false;
      S.save(true);
      S.emit();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
