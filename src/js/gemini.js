/* ==========================================================================
   gemini.js - AI layer. Gemini answers user-requested questions and analyses
   ONLY the data actually stored in the tracker (no lessons are auto-generated).
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc;

  const SYSTEM_PROMPT = [
    'You are an expert JEE Main and JEE Advanced Physics, Chemistry and Mathematics tutor.',
    '',
    'Answer at genuine JEE level.',
    '',
    "Use the student's syllabus and tracked academic data when available.",
    '',
    'Never invent syllabus topics or claim that a topic belongs to JEE Main/Advanced without reliable syllabus data.',
    '',
    'For numerical problems:',
    '- identify given data',
    '- identify what is required',
    '- select the correct concept',
    '- solve systematically',
    '- verify units/signs where relevant',
    '- provide the final answer',
    '',
    'For Physics:',
    'maintain correct physical assumptions, equations, units and sign conventions.',
    '',
    'For Chemistry:',
    'maintain accurate chemical equations, mechanisms, trends and conditions.',
    '',
    'For Mathematics:',
    'show logically valid mathematical steps and do not skip essential reasoning.',
    '',
    'When the user asks for a hint, do not immediately reveal the complete solution.',
    '',
    'When analyzing performance, use only actual tracker data.',
    '',
    'Distinguish JEE Main level from JEE Advanced level when relevant.',
    '',
    'Do not give motivational filler.',
    '',
    'Prioritize accuracy, conceptual understanding and JEE-relevant problem solving.'
  ].join('\n');

  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'];

  const QUICK = [
    { label: 'Analyze my performance', mode: 'analyze', prompt: 'Analyze my JEE preparation performance using only my stored tracker data.' },
    { label: 'What should I study now?', mode: 'plan', prompt: 'Based on my tracker data, what should I study right now?' },
    { label: 'Explain a problem', mode: 'chat', prompt: 'Explain this JEE problem step by step: ' },
    { label: 'Solve a JEE problem', mode: 'chat', prompt: 'Solve this JEE problem at exam level: ' },
    { label: 'Give me a hint only', mode: 'chat', prompt: 'Give me a hint only (do not reveal the full solution) for: ' },
    { label: 'Explain my mistake', mode: 'chat', prompt: 'Explain why this answer is wrong and what concept I missed: ' },
    { label: 'Explain a formula', mode: 'chat', prompt: 'Explain this formula, when to use it and its JEE-level conditions: ' },
    { label: 'Compare two concepts', mode: 'chat', prompt: 'Compare these two concepts and tell me how JEE tests them: ' },
    { label: 'Analyze a chapter', mode: 'chat', prompt: 'Analyze my chapter performance for: ' },
    { label: 'Analyze my mock test', mode: 'chat', prompt: 'Analyze my latest mock test using my stored data and tell me what to fix.' },
    { label: 'Generate practice questions', mode: 'chat', prompt: 'Generate 5 JEE-level practice questions on: ' },
    { label: 'Create revision questions', mode: 'chat', prompt: 'Create 5 quick revision questions on: ' },
    { label: 'Suggest what to revise', mode: 'chat', prompt: 'Which topics should I revise today? Use my revision and accuracy data.' }
  ];

  const Gemini = (App.gemini = {
    SYSTEM_PROMPT, QUICK, MODELS,
    hasKey() { return !!(S.state.settings.apiKey || '').trim(); },
    model() { return (S.state.settings.model || 'gemini-2.5-flash').trim(); },

    /* ------------------------------------------------------- data context */
    syllabusContext(nodeId) {
      if (!nodeId) return null;
      const r = Syl.rec(nodeId);
      if (!r) return null;
      const ch = r.chapter, tp = r.topic;
      const mark = n => (n.jm && n.ja) ? '[JM][JA]' : n.jm ? '[JM]' : '[JA]';
      const out = {
        subject: r.subject.name,
        chapter: ch.name + ' ' + mark(ch) + (ch.unit ? ' (' + ch.unit + ')' : ''),
        chapterSourceJM: ch.srcJM || null,
        chapterSourceJA: ch.srcJA || null,
        syllabusMeta: Syl.data.meta,
        topics: ch.topics.map(t => ({
          topic: t.name + ' ' + mark(t),
          subtopics: t.subs.map(s => s.name + ' ' + mark(s))
        }))
      };
      if (tp) { out.openedTopic = tp.name; out.openedSubtopic = r.kind === 'sub' ? r.name : null; }
      return out;
    },
    progressContext(nodeId) {
      if (!nodeId) return null;
      const r = Syl.rec(nodeId);
      if (!r) return null;
      const out = { node: r.name, kind: r.kind, jm: null, ja: null };
      ['jm', 'ja'].forEach(ex => {
        if (!Syl.inScope(r.node, ex) && r.kind !== 'chapter' && r.kind !== 'topic') return;
        const a = Prog.agg(nodeId, ex);
        out[ex] = {
          scopeLeaves: a.total, completed: a.completed, learning: a.learning, weak: a.weak, notStarted: a.notStarted,
          syllabusPct: a.pct, coveragePct: a.coverage, mastery: a.mastery,
          dimensions: a.dims, lectures: { total: a.lectures.total, done: a.lectures.done, minutes: a.lectures.minutes },
          questions: a.questions, revisionsDue: a.revDue
        };
      });
      return out;
    },
    /* compact but complete snapshot of the user's actual stored data */
    trackerContext() {
      const o = Calc.overall(), cov = Calc.practiceCoverage(), t = U.todayISO();
      const recentSessions = S.state.sessions.slice(-12).map(s => ({
        date: U.iso(new Date(s.start)), mode: s.mode, subject: s.subject,
        chapter: s.chapterId && Syl.rec(s.chapterId) ? Syl.rec(s.chapterId).name : null, minutes: s.minutes
      }));
      const ctx = {
        today: t,
        examCountdown: {
          label: S.state.profile.examLabel,
          jeeMainInDays: U.diffDays(t, S.state.profile.mainDate),
          jeeMainDate: S.state.profile.mainDate,
          jeeAdvancedInDays: U.diffDays(t, S.state.profile.advancedDate),
          jeeAdvancedDate: S.state.profile.advancedDate
        },
        syllabus: {
          source: { main: Syl.data.meta.mainSource, mainUrl: Syl.data.meta.mainUrl, advanced: Syl.data.meta.advancedSource, advancedUrl: Syl.data.meta.advancedUrl, retrieved: Syl.data.meta.retrieved },
          counts: { chapters: Syl.subjects.reduce((a, s) => a + s.chapters.length, 0), topics: Syl.subjects.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.topics.length, 0), 0), subtopics: Syl.subjects.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.topics.reduce((d, tp) => d + tp.subs.length, 0), 0), 0) }
        },
        progress: {
          jeeMain: { totalSubtopics: o.main.total, completed: o.main.done, remaining: o.main.remaining, completionPct: o.main.pct, avgMastery: o.main.mastery, weakCount: o.main.weak },
          jeeAdvanced: { totalSubtopics: o.advanced.total, completed: o.advanced.done, remaining: o.advanced.remaining, completionPct: o.advanced.pct, avgMastery: o.advanced.mastery, weakCount: o.advanced.weak },
          subjects: o.subjects.map(s => ({ subject: s.name, jmPct: s.jmPct, jaPct: s.jaPct, masteryPct: s.mastery, weakTopics: s.weak, revisionsDue: s.revDue, questions: s.questions, lectures: s.lectures }))
        },
        practiceCoverage: { theory: Math.round(cov.theory * 100), lecture: Math.round(cov.lecture * 100), dpp: Math.round(cov.dpp * 100), pyq: Math.round(cov.pyq * 100), practice: Math.round(cov.practice * 100) },
        lectures: o.lectures,
        questions: Object.assign({}, o.questions, { last5Sessions: Calc.accuracyTrend(5) }),
        revision: { dueToday: o.revision.dueToday.length, overdue: o.revision.overdue.length, upcoming: o.revision.upcoming.length, consistency: Calc.revisionConsistency(), overdueList: o.revision.overdue.slice(0, 10).map(r => ({ topic: r.topicName, exam: r.exam, due: r.scheduledFor })), dueTodayList: o.revision.dueToday.slice(0, 10).map(r => ({ topic: r.topicName, exam: r.exam, due: r.scheduledFor })) },
        tasks: {
          today: o.tasks.today.map(x => ({ title: x.title, type: x.type, subject: x.subject, exam: x.exam, estMin: x.estMin, priority: x.priority })),
          backlogCount: o.tasks.backlogCount, backlog: o.tasks.backlog.slice(0, 12).map(x => ({ title: x.title, type: x.type, subject: x.subject, plannedFor: x.plannedFor, estMin: x.estMin })),
          next7DaysMinutes: o.tasks.planned7
        },
        weakTopics: Calc.weakTopics(null, 10),
        strongestTopics: Calc.strongTopics(null, 6),
        errors: { total: Calc.errorPatterns().total, open: Calc.errorPatterns().open, byType: Object.keys(Calc.errorPatterns().byType).map(k => ({ type: k, count: Calc.errorPatterns().byType[k].length })), repeatedTopics: Calc.errorPatterns().repeats.slice(0, 6) },
        tests: Calc.testStats().tests.slice(-6).map(t => ({ name: t.name, date: t.date, exam: t.exam, score: t.score, max: t.maxMarks, pct: t.pct, accuracy: t.accuracy })),
        studyTime: o.time,
        streak: o.streak,
        recentSessions
      };
      return ctx;
    },

    /* ----------------------------------------------------------- transport */
    async call({ system, contents, temperature, maxTokens, expectJSON }) {
      const key = (S.state.settings.apiKey || '').trim();
      if (!key) throw new Error('NO_KEY');
      const body = {
        systemInstruction: { parts: [{ text: system || SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: temperature == null ? 0.35 : temperature,
          maxOutputTokens: maxTokens || 2048,
          topP: 0.95
        }
      };
      if (expectJSON) body.generationConfig.responseMimeType = 'application/json';
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(Gemini.model()) + ':generateContent';
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      } catch (e) {
        throw new Error('NETWORK: Could not reach the Gemini API from this context. ' + (e && e.message ? e.message : ''));
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data && data.error && data.error.message ? data.error.message : ('HTTP ' + res.status);
        throw new Error('API: ' + msg);
      }
      const cand = data && data.candidates && data.candidates[0];
      const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
      const text = parts.map(p => p.text || '').join('').trim();
      if (!text) throw new Error('EMPTY: Gemini returned no text (finishReason: ' + ((cand && cand.finishReason) || 'unknown') + ').');
      return text;
    },

    async ask({ prompt, nodeId, history, mode, temperature }) {
      const ctx = Gemini.trackerContext();
      const node = nodeId ? { syllabus: Gemini.syllabusContext(nodeId), progress: Gemini.progressContext(nodeId) } : null;
      const taskLine = mode === 'analyze'
        ? 'TASK: Produce a performance analysis. Use ONLY the tracker data provided. Structure it as: Strongest areas / Weakest areas / Low accuracy topics / Insufficient practice / Overdue revisions / Lecture backlog / Repeated mistakes / Consistency / Recent improvement or decline / What needs attention next. Quote the actual numbers from the data. If some data is missing, say so plainly instead of inventing it.'
        : mode === 'plan'
          ? 'TASK: Recommend what to study next as a short prioritized list (maximum 5 items). For each item give: the exact topic/subtopic, the reason grounded in the data (backlog, due revision, weak mastery, low accuracy, lecture backlog), and a suggested duration. Do not add motivational filler.'
          : 'TASK: Answer the student question using the syllabus and tracker context above where relevant.';
      const sys = SYSTEM_PROMPT + '\n\n--- STUDENT TRACKER DATA (actual stored data - do not invent anything beyond this) ---\n' +
        JSON.stringify(ctx) + (node ? '\n\n--- CURRENT SYLLABUS NODE ---\n' + JSON.stringify(node) : '') +
        '\n\n--- END OF DATA ---\n' + taskLine;
      const contents = [];
      (history || []).slice(-8).forEach(m => contents.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });
      return Gemini.call({ system: sys, contents, temperature: temperature == null ? (mode === 'analyze' ? 0.25 : 0.4) : temperature, maxTokens: mode === 'analyze' ? 2600 : 2048 });
    },

    async recommend({ availableMinutes } = {}) {
      const ctx = Gemini.trackerContext();
      const prompt = 'Produce a prioritized study recommendation for right now. Available study time: ' + (availableMinutes || S.state.profile.dailyTargetMin || 420) + ' minutes today. ' +
        'Return STRICT JSON only, with this shape: {"summary":"one line","items":[{"title":"...","type":"Lecture|Topic study|PYQ|DPP|Practice|Revision|Mock test|Error-book revision","subject":"Physics|Chemistry|Mathematics","topicId":"<id or empty>","exam":"jm|ja","estMin":45,"priority":"High|Medium|Low","reason":"short data-grounded reason"}]} ' +
        'Use topicId values that exist in the data (chapter/topic/subtopic ids like phy.c4.t2.s1) when the item targets a specific syllabus node. Maximum 5 items. Base every item on the actual data.';
      const sys = SYSTEM_PROMPT + '\n\nTRACKER DATA:\n' + JSON.stringify(ctx) + '\n\nYou must ground every recommendation in this data. Return JSON only, no prose outside JSON.';
      const text = await Gemini.call({ system: sys, contents: [{ role: 'user', parts: [{ text: prompt }] }], temperature: 0.25, maxTokens: 1600, expectJSON: true });
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('PARSE: Gemini did not return usable JSON.'); parsed = JSON.parse(m[0]); }
      parsed.source = 'gemini';
      return parsed;
    },

    /* Offline, rule-based recommendation. Used when Gemini is unavailable and
       as a fallback. Every item is derived from stored data only. */
    localRecommend({ availableMinutes } = {}) {
      const o = Calc.overall(), budget = availableMinutes || S.state.profile.dailyTargetMin || 420;
      const items = [];
      const push = (title, type, subject, topicId, exam, estMin, priority, reason) => items.push({ title, type, subject, topicId, exam, estMin, priority, reason });
      o.revision.overdue.slice(0, 2).forEach(r => {
        push('Revise: ' + (r.topicName || 'topic'), 'Revision', r.subject || '', r.nodeId || r.topicId || '', r.exam || 'jm', 30, 'High',
          'Revision #' + (r.index || 1) + ' was due on ' + U.fmtDate(r.scheduledFor, 'short') + ' (' + Math.abs(U.daysFromToday(r.scheduledFor)) + ' days overdue).');
      });
      o.revision.dueToday.slice(0, 1).forEach(r => {
        push('Revise: ' + (r.topicName || 'topic'), 'Revision', r.subject || '', r.nodeId || r.topicId || '', r.exam || 'jm', 30, 'High', 'Revision #' + (r.index || 1) + ' is scheduled for today.');
      });
      o.tasks.today.filter(t => !t.done).slice(0, 3).forEach(t => {
        push(t.title, t.type || 'Topic study', t.subject || '', t.topicId || '', t.exam || 'jm', t.estMin || 45, t.priority || 'Medium', "Already planned for today (" + (t.type || 'task') + ').');
      });
      o.tasks.backlog.slice(0, 2).forEach(t => {
        push(t.title, t.type || 'Topic study', t.subject || '', t.topicId || '', t.exam || 'jm', t.estMin || 45, 'High', 'Sitting in backlog since ' + U.fmtDate(t.plannedFor, 'short') + '.');
      });
      Calc.weakTopics(null, 3).forEach(w => {
        push('Study ' + w.name, 'Topic study', w.subject, w.id, w.exam || 'jm', 50, 'High', w.reason + ' - mastery ' + w.mastery + '%' + (w.attempted ? ', accuracy ' + w.acc + '%' : ''));
      });
      const lecLeft = S.state.lectures.filter(l => l.status !== 'Completed').slice(0, 2);
      lecLeft.forEach(l => push('Lecture: ' + l.title, 'Lecture', l.subject, l.topicId || l.nodeId || '', l.exam || 'jm', l.duration || 60, 'Medium', 'Lecture is ' + l.status + ' (' + (l.completed || 0) + '/' + (l.total || 1) + ' watched).'));
      // pending syllabus in low-coverage subject
      const subjSorted = o.subjects.slice().sort((a, b) => a.jmPct - b.jmPct);
      const weakest = subjSorted[0];
      const pendingTopic = (function () {
        const sub = Syl.byCode[weakest.code];
        for (const ch of sub.chapters) for (const tp of ch.topics) { const a = Prog.agg(tp.id, 'jm'); if (a.total && a.completed < a.total && a.learning > 0) return { tp, a }; }
        for (const ch of sub.chapters) for (const tp of ch.topics) { const a = Prog.agg(tp.id, 'jm'); if (a.total && a.completed < a.total) return { tp, a }; }
        return null;
      })();
      if (pendingTopic) push('Continue ' + pendingTopic.tp.name, 'Topic study', weakest.name, pendingTopic.tp.id, 'jm', 50, 'Medium', weakest.name + ' is at ' + weakest.jmPct + '% JEE Main coverage and this topic is ' + pendingTopic.a.completed + '/' + pendingTopic.a.total + ' subtopics done.');
      if (!items.length) push('Start a chapter', 'Topic study', 'Physics', 'phy.c1', 'jm', 45, 'Medium', 'No tracked activity yet, so nothing can be prioritized from data. Pick any chapter and log the first subtopic.');
      // budget the day
      let used = 0;
      const fitted = [];
      items.forEach(it => { if (used + it.estMin <= budget + 30 || !fitted.length) { fitted.push(it); used += it.estMin; } });
      return { source: 'local', availableMinutes: budget, usedMinutes: used, summary: fitted.length + ' prioritized items built from your tracked backlog, due revisions and weak topics (' + U.minsToHM(used) + ' of work).', items: fitted.slice(0, 6) };
    },

    /* --------------------------------------------------------- chat store */
    chat(id) { return S.state.ai.chats.find(c => c.id === id) || null; },
    activeChat() {
      let c = Gemini.chat(S.state.ai.activeChat);
      if (!c) {
        c = { id: U.uid('chat'), title: 'New chat', created: U.nowISO(), messages: [] };
        S.state.ai.chats.unshift(c);
        S.state.ai.activeChat = c.id;
        S.save();
      }
      return c;
    },
    newChat() {
      const c = { id: U.uid('chat'), title: 'New chat', created: U.nowISO(), messages: [] };
      S.state.ai.chats.unshift(c);
      S.state.ai.activeChat = c.id;
      S.save(true);
      return c;
    },
    push(chatId, role, text, meta) {
      const c = Gemini.chat(chatId) || Gemini.activeChat();
      c.messages.push({ role, text, ts: U.nowISO(), meta: meta || null });
      if (role === 'user' && (!c.title || c.title === 'New chat')) c.title = text.slice(0, 42);
      S.save();
      return c;
    },
    /* ---- tiny markdown renderer for AI replies ---- */
    md(text) {
      let s = U.esc(text || '');
      s = s.replace(/```([\s\S]*?)```/g, (m, c) => '<pre>' + c.replace(/^\n+/, '') + '</pre>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h4>$1</h4>').replace(/^# (.*)$/gm, '<h4>$1</h4>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      s = s.replace(/(^|\n)\s*[-*]\s+(.*)/g, '$1&bull; $2');
      s = s.replace(/\n{2,}/g, '\n');
      return s;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
