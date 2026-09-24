/* ==========================================================================
   forms.js - add/edit sheets for every tracked entity + data mutations
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App || (global.App = {});
  const U = App.util, S = App.store, Syl = App.syl, Prog = App.prog, Calc = App.calc, B = App.ui, I = App.icons;

  const F = (App.forms = {});
  const subjOpts = () => Syl.subjects.map(s => ({ value: s.name, label: s.name }));

  /* ---------------------------------------------------------------- TASKS */
  F.task = function (pre) {
    pre = pre || {};
    const today = U.todayISO();
    const html =
      B.field('Task', '<input name="title" placeholder="e.g. Rotational Motion - DPP set 3" value="' + U.esc(pre.title || '') + '">') +
      '<div class="two">' +
      B.field('Type', B.select('type', App.prog.TASK_TYPES.map(t => ({ value: t, label: t })), pre.type || 'Topic study')) +
      B.field('Priority', B.select('priority', ['High', 'Medium', 'Low'].map(t => ({ value: t, label: t })), pre.priority || 'Medium')) +
      '</div>' +
      '<div class="two">' +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JEE Main (JM)' }, { value: 'ja', label: 'JEE Advanced (JA)' }], pre.exam || 'jm')) +
      B.field('Planned for', '<input type="date" name="plannedFor" value="' + U.esc(pre.plannedFor || pre.date || today) + '">') +
      '</div>' +
      '<div class="two">' +
      B.field('Estimated time (min)', '<input type="number" name="estMin" min="5" step="5" value="' + (pre.estMin || 45) + '">') +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      '</div>' +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>') +
      B.field('Subtopic (optional)', '<select name="nodeId"><option value="">Whole topic</option></select>') +
      B.field('Notes', '<textarea name="notes" placeholder="Optional">' + U.esc(pre.notes || '') + '</textarea>');
    B.sheet({
      title: pre.id ? 'Edit task' : 'Add task',
      html,
      footer: '<button class="btn primary block" data-act="save-task">' + (pre.id ? 'Save changes' : 'Add task') + '</button>',
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        sc.querySelector('[data-act="save-task"]').addEventListener('click', () => {
          const v = B.formValues(body);
          if (!v.title.trim()) { App.toast('Give the task a title'); return; }
          if (pre.id) {
            S.update(st => { const t = st.tasks.find(x => x.id === pre.id); if (t) Object.assign(t, v, { estMin: +v.estMin || 45 }); });
          } else {
            S.update(st => st.tasks.push(Object.assign({
              id: U.uid('task'), status: 'pending', createdAt: U.nowISO(), completedAt: null, inBacklog: false
            }, v, { estMin: +v.estMin || 45 })));
          }
          B.closeSheet(); App.refresh(); App.toast(pre.id ? 'Task updated' : 'Task added');
        });
      }
    });
  };

  /* ------------------------------------------------------------- LECTURES */
  F.lecture = function (pre) {
    pre = pre || {};
    const chapters = pre.subject ? [Syl.byCode[Object.keys(Syl.byCode).find(k => Syl.byCode[k].name === pre.subject)] ] : null;
    const html =
      B.field('Lecture title', '<input name="title" placeholder="e.g. Rigid body - torque basics" value="' + U.esc(pre.title || '') + '">') +
      '<div class="two">' +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JM' }, { value: 'ja', label: 'JA' }, { value: 'both', label: 'Both' }], pre.exam || 'jm')) +
      '</div>' +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>') +
      '<div class="two">' +
      B.field('Lecture number', '<input type="number" name="number" min="1" value="' + (pre.number || 1) + '">') +
      B.field('Duration (min)', '<input type="number" name="duration" min="1" step="5" value="' + (pre.duration || 60) + '">') +
      '</div>' +
      '<div class="two">' +
      B.field('Status', B.select('status', ['Not Started', 'In Progress', 'Completed'].map(s => ({ value: s, label: s })), pre.status || 'Not Started')) +
      B.field('Watched (min)', '<input type="number" name="watchedMin" min="0" step="5" value="' + (pre.watchedMin || 0) + '">') +
      '</div>' +
      '<div class="two">' +
      B.field('Source / teacher', '<input name="source" placeholder="e.g. Coaching batch, YouTube" value="' + U.esc(pre.source || '') + '">') +
      B.field('Date', '<input type="date" name="date" value="' + (pre.date || U.todayISO()) + '">') +
      '</div>';
    const footer = pre.id
      ? '<div class="btnrow"><button class="btn primary" style="flex:1" data-act="save-lecture">Save</button><button class="btn" data-act="del-lecture">Delete</button></div>'
      : '<button class="btn primary block" data-act="save-lecture">Add lecture</button>';
    B.sheet({
      title: pre.id ? 'Edit lecture' : 'Add lecture', html, footer,
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        sc.querySelector('[data-act="save-lecture"]').addEventListener('click', () => {
          const v = B.formValues(body);
          if (!v.title.trim()) { App.toast('Give the lecture a title'); return; }
          v.number = +v.number || 1; v.duration = +v.duration || 0; v.watchedMin = +v.watchedMin || 0;
          if (v.status === 'Completed') v.watchedMin = v.duration;
          if (pre.id) S.update(st => { const l = st.lectures.find(x => x.id === pre.id); if (l) Object.assign(l, v); });
          else S.update(st => st.lectures.push(Object.assign({ id: U.uid('lec'), createdAt: U.nowISO() }, v)));
          if (v.topicId) logTimeFor(v.topicId, v.exam === 'both' ? 'jm' : v.exam, v.status === 'Completed' ? v.duration : v.watchedMin);
          B.closeSheet(); App.refresh(); App.toast('Lecture saved');
        });
        const del = sc.querySelector('[data-act="del-lecture"]');
        del && del.addEventListener('click', () => {
          B.confirm('Delete this lecture?', () => { S.update(st => { st.lectures = st.lectures.filter(x => x.id !== pre.id); }); App.refresh(); App.toast('Lecture deleted'); });
        });
      }
    });
  };

  /* ------------------------------------------------------------ QUESTIONS */
  F.question = function (pre) {
    pre = pre || {};
    const html =
      '<div class="two">' +
      B.field('Date', '<input type="date" name="date" value="' + (pre.date || U.todayISO()) + '">') +
      B.field('Source', B.select('source', App.prog.SOURCES.map(s => ({ value: s, label: s })), pre.source || 'DPP')) +
      '</div>' +
      '<div class="two">' +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JEE Main (JM)' }, { value: 'ja', label: 'JEE Advanced (JA)' }], pre.exam || 'jm')) +
      '</div>' +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>') +
      B.field('Subtopic', '<select name="nodeId"><option value="">Whole topic</option></select>') +
      '<div class="two">' +
      B.field('Difficulty', B.select('difficulty', ['Easy', 'Moderate', 'Hard'].map(s => ({ value: s, label: s })), pre.difficulty || 'Moderate')) +
      B.field('Time spent (min)', '<input type="number" name="timeMin" min="0" step="1" value="' + (pre.timeMin || 0) + '">') +
      '</div>' +
      '<div class="grid3">' +
      B.field('Attempted', '<input type="number" name="attempted" min="0" value="' + (pre.attempted != null ? pre.attempted : 10) + '">') +
      B.field('Correct', '<input type="number" name="correct" min="0" value="' + (pre.correct != null ? pre.correct : 7) + '">') +
      B.field('Wrong', '<input type="number" name="wrong" min="0" value="' + (pre.wrong != null ? pre.wrong : 3) + '">') +
      '</div>' +
      B.field('Unattempted', '<input type="number" name="unattempted" min="0" value="' + (pre.unattempted || 0) + '">') +
      '<div class="hint" style="margin-top:-4px">Log a whole set, or a single question by setting Attempted = 1.</div>';
    B.sheet({
      title: pre.id ? 'Edit question log' : 'Log questions',
      html,
      footer: '<button class="btn primary block" data-act="save-question">Save question log</button>',
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        sc.querySelector('[data-act="save-question"]').addEventListener('click', () => {
          const v = B.formValues(body);
          ['attempted', 'correct', 'wrong', 'unattempted', 'timeMin'].forEach(k => v[k] = +v[k] || 0);
          if (v.correct + v.wrong > v.attempted) { App.toast('Correct + wrong cannot exceed attempted'); return; }
          v.ts = U.nowISO();
          v.accuracy = v.attempted ? Math.round(v.correct / v.attempted * 100) : 0;
          if (!v.nodeId) v.nodeId = v.topicId || v.chapterId || '';
          if (pre.id) S.update(st => { const q = st.questions.find(x => x.id === pre.id); if (q) Object.assign(q, v); });
          else S.update(st => st.questions.push(Object.assign({ id: U.uid('q') }, v)));
          if (v.nodeId) logTimeFor(v.nodeId, v.exam, v.timeMin);
          // auto-flag weak when accuracy collapses
          if (v.nodeId && v.attempted >= 8 && v.accuracy < 45) {
            S.update(st => { const key = v.exam; const rec = st.progress[v.nodeId] = st.progress[v.nodeId] || {}; const p = rec[key] = rec[key] || Prog.blank(); p.weak = true; });
          }
          B.closeSheet(); App.refresh(); App.toast('Questions logged');
        });
      }
    });
  };

  /* ---------------------------------------------------------------- ERRORS */
  F.error = function (pre) {
    pre = pre || {};
    const html =
      '<div class="two">' +
      B.field('Date', '<input type="date" name="date" value="' + (pre.date || U.todayISO()) + '">') +
      B.field('Mistake type', B.select('mistakeType', App.prog.MISTAKE_TYPES.map(s => ({ value: s, label: s })), pre.mistakeType || 'Conceptual')) +
      '</div>' +
      '<div class="two">' +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JM' }, { value: 'ja', label: 'JA' }], pre.exam || 'ja')) +
      '</div>' +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>') +
      B.field('Question / what went wrong', '<textarea name="questionText" placeholder="Paste the question or describe it">' + U.esc(pre.questionText || '') + '</textarea>') +
      B.field('Correct concept', '<textarea name="correctConcept" placeholder="The concept or formula that actually applies">' + U.esc(pre.correctConcept || '') + '</textarea>') +
      B.field('Personal note', '<textarea name="note" placeholder="How will you avoid repeating it?">' + U.esc(pre.note || '') + '</textarea>') +
      '<div class="two">' +
      B.field('Image / screenshot', '<input type="file" name="imgFile" accept="image/*">' + (pre.image ? '<img class="err-img" src="' + pre.image + '">' : '')) +
      B.field('Voice note', '<input type="file" name="voiceFile" accept="audio/*">' + (pre.voiceNote ? '<audio class="voice" controls src="' + pre.voiceNote + '"></audio>' : '')) +
      '</div>' +
      (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? '<button type="button" class="btn sm" data-act="rec-voice">' + I.timer + ' Record voice note</button><div id="recstat" class="small muted" style="margin-top:6px"></div>' : '') +
      B.field('Revision status', B.select('status', [{ value: 'open', label: 'Open' }, { value: 'revised', label: 'Revised' }, { value: 'mastered', label: 'Mastered' }], pre.status || 'open'));
    B.sheet({
      title: pre.id ? 'Edit error' : 'Add to error book',
      html,
      footer: '<button class="btn primary block" data-act="save-error">Save to error book</button>',
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        let img = pre.image || '', voice = pre.voiceNote || '';
        body.querySelector('[name="imgFile"]').addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          img = await U.readDataURL(f); App.toast('Image attached');
        });
        body.querySelector('[name="voiceFile"]').addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          if (f.size > 900000) App.toast('Audio file is large - it may not fit in local storage');
          voice = await U.readDataURL(f);
        });
        const recBtn = body.querySelector('[data-act="rec-voice"]');
        if (recBtn) recBtn.addEventListener('click', async () => {
          const stat = body.querySelector('#recstat');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            const chunks = [];
            mr.ondataavailable = e => chunks.push(e.data);
            mr.onstop = async () => {
              const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
              voice = await U.readDataURL(blob);
              stat.textContent = 'Voice note recorded (' + Math.round(blob.size / 1024) + ' KB).';
              stream.getTracks().forEach(t => t.stop());
            };
            mr.start();
            stat.textContent = 'Recording... tap again to stop (max ~60s)';
            recBtn.textContent = 'Stop recording';
            recBtn.onclick = () => { mr.stop(); recBtn.textContent = 'Record voice note'; };
            setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 61000);
          } catch (e) { stat.textContent = 'Microphone not available in this context.'; }
        });
        sc.querySelector('[data-act="save-error"]').addEventListener('click', () => {
          const v = B.formValues(body);
          delete v.imgFile; delete v.voiceFile;
          v.image = img; v.voiceNote = voice;
          if (!v.questionText.trim() && !img) { App.toast('Describe the question or attach an image'); return; }
          if (!v.nodeId) v.nodeId = v.topicId || v.chapterId || '';
          v.updatedAt = U.nowISO();
          if (pre.id) S.update(st => { const e0 = st.errors.find(x => x.id === pre.id); if (e0) Object.assign(e0, v); });
          else S.update(st => st.errors.push(Object.assign({ id: U.uid('err'), createdAt: U.nowISO(), revisions: 0 }, v)));
          B.closeSheet(); App.refresh(); App.toast('Saved to error book');
        });
      }
    });
  };

  /* -------------------------------------------------------------- REVISION */
  F.revision = function (pre) {
    pre = pre || {};
    const html =
      '<div class="two">' +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JM' }, { value: 'ja', label: 'JA' }], pre.exam || 'jm')) +
      '</div>' +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>') +
      B.field('Subtopic', '<select name="nodeId"><option value="">Whole topic</option></select>') +
      '<div class="two">' +
      B.field('Revision number', '<input type="number" name="index" min="1" max="10" value="' + (pre.index || 1) + '">') +
      B.field('Scheduled date', '<input type="date" name="scheduledFor" value="' + (pre.scheduledFor || U.todayISO()) + '">') +
      '</div>' +
      '<div class="hint">Spaced repetition intervals: ' + App.calc.SR_INTERVALS.join(', ') + ' days (Revision 1 to 5). You can set any date yourself.</div>' +
      B.field('Note', '<input name="note" placeholder="Optional">');
    B.sheet({
      title: pre.id ? 'Edit revision' : 'Schedule revision',
      html,
      footer: '<div class="btnrow"><button class="btn primary" style="flex:1" data-act="save-rev">Save revision</button>' + (pre.id ? '<button class="btn" data-act="del-rev">Delete</button>' : '') + '</div>',
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        sc.querySelector('[data-act="save-rev"]').addEventListener('click', () => {
          const v = B.formValues(body);
          v.index = +v.index || 1;
          const rec = App.syl.rec(v.nodeId || v.topicId || v.chapterId);
          if (!rec) { App.toast('Pick a topic for this revision'); return; }
          v.nodeId = v.nodeId || v.topicId || v.chapterId;
          v.topicId = v.topicId || rec.topic ? (rec.topic ? rec.topic.id : v.chapterId) : v.chapterId;
          v.topicName = rec.topic ? rec.topic.name : rec.chapter.name;
          v.chapterName = rec.chapter.name;
          v.subject = rec.subject.name;
          v.completedAt = pre.completedAt || null;
          if (pre.id) S.update(st => { const r = st.revisions.find(x => x.id === pre.id); if (r) Object.assign(r, v); });
          else S.update(st => st.revisions.push(Object.assign({ id: U.uid('rev'), createdAt: U.nowISO() }, v)));
          B.closeSheet(); App.refresh(); App.toast('Revision scheduled');
        });
        const del = sc.querySelector('[data-act="del-rev"]');
        del && del.addEventListener('click', () => { B.confirm('Delete this revision?', () => { S.update(st => { st.revisions = st.revisions.filter(x => x.id !== pre.id); }); App.refresh(); App.toast('Revision deleted'); }); });
      }
    });
  };

  /* ------------------------------------------------------- MANUAL SESSION */
  F.session = function (pre) {
    pre = pre || {};
    const now = new Date();
    const html =
      '<div class="two">' +
      B.field('Date', '<input type="date" name="date" value="' + (pre.date || U.todayISO()) + '">') +
      B.field('Start time', '<input type="time" name="time" value="' + (pre.time || String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')) + '">') +
      '</div>' +
      '<div class="two">' +
      B.field('Mode', B.select('mode', ['Lecture', 'Practice', 'Revision', 'PYQ', 'Mock Test', 'Other'].map(s => ({ value: s, label: s })), pre.mode || 'Practice')) +
      B.field('Duration (min)', '<input type="number" name="minutes" min="1" step="5" value="' + (pre.minutes || 60) + '">') +
      '</div>' +
      B.field('Subject', B.select('subject', subjOpts(), pre.subject || 'Physics')) +
      B.field('Chapter', B.select('chapterId', [{ value: '', label: '- none -' }], pre.chapterId || '')) +
      B.field('Topic', '<select name="topicId"><option value="">- none -</option></select>');
    B.sheet({
      title: 'Log study time',
      html,
      footer: '<button class="btn primary block" data-act="save-session">Save session</button>',
      onMount: function (body, sc) {
        B.bindPicker(body, pre);
        sc.querySelector('[data-act="save-session"]').addEventListener('click', () => {
          const v = B.formValues(body);
          const mins = +v.minutes || 0;
          const start = new Date((v.date || U.todayISO()) + 'T' + (v.time || '09:00') + ':00');
          const end = new Date(start.getTime() + mins * 60000);
          S.update(st => st.sessions.push({
            id: U.uid('ses'), mode: v.mode, subject: v.subject, chapterId: v.chapterId, topicId: v.topicId,
            start: start.toISOString(), end: end.toISOString(), minutes: mins
          }));
          if (v.topicId) logTimeFor(v.topicId, 'jm', mins);
          B.closeSheet(); App.refresh(); App.toast('Session logged');
        });
      }
    });
  };

  /* ------------------------------------------------------------ MOCK TEST */
  F.test = function (pre) {
    pre = pre || {};
    const ss = pre.subjects || {};
    const html =
      B.field('Test name', '<input name="name" placeholder="e.g. Allen Major Test 3" value="' + U.esc(pre.name || '') + '">') +
      '<div class="two">' +
      B.field('Date', '<input type="date" name="date" value="' + (pre.date || U.todayISO()) + '">') +
      B.field('Exam', B.select('exam', [{ value: 'jm', label: 'JEE Main (JM)' }, { value: 'ja', label: 'JEE Advanced (JA)' }], pre.exam || 'jm')) +
      '</div>' +
      '<div class="two">' +
      B.field('Score', '<input type="number" name="score" step="1" value="' + (pre.score != null ? pre.score : '') + '">') +
      B.field('Maximum marks', '<input type="number" name="maxMarks" step="1" value="' + (pre.maxMarks || 300) + '">') +
      '</div>' +
      '<div class="grid3">' +
      B.field('Attempted', '<input type="number" name="attempted" min="0" value="' + (pre.attempted != null ? pre.attempted : '') + '">') +
      B.field('Correct', '<input type="number" name="correct" min="0" value="' + (pre.correct != null ? pre.correct : '') + '">') +
      B.field('Wrong', '<input type="number" name="wrong" min="0" value="' + (pre.wrong != null ? pre.wrong : '') + '">') +
      '</div>' +
      '<div class="two">' +
      B.field('Unattempted', '<input type="number" name="unattempted" min="0" value="' + (pre.unattempted || 0) + '">') +
      B.field('Time taken (min)', '<input type="number" name="timeMin" min="0" value="' + (pre.timeMin || 180) + '">') +
      '</div>' +
      '<div class="hr"></div><div class="small bold" style="margin-bottom:6px">Subject-wise marks</div>' +
      '<div class="grid3">' +
      B.field('Physics', '<input type="number" name="sub_phy" step="1" value="' + ((ss.phy && ss.phy.score) != null ? ss.phy.score : '') + '">') +
      B.field('Chemistry', '<input type="number" name="sub_chem" step="1" value="' + ((ss.chem && ss.chem.score) != null ? ss.chem.score : '') + '">') +
      B.field('Maths', '<input type="number" name="sub_math" step="1" value="' + ((ss.math && ss.math.score) != null ? ss.math.score : '') + '">') +
      '</div>' +
      '<div class="grid3">' +
      B.field('Phy max', '<input type="number" name="max_phy" step="1" value="' + ((ss.phy && ss.phy.max) || 100) + '">') +
      B.field('Chem max', '<input type="number" name="max_chem" step="1" value="' + ((ss.chem && ss.chem.max) || 100) + '">') +
      B.field('Maths max', '<input type="number" name="max_math" step="1" value="' + ((ss.math && ss.math.max) || 100) + '">') +
      '</div>' +
      B.field('Notes / what went wrong', '<textarea name="notes">' + U.esc(pre.notes || '') + '</textarea>');
    B.sheet({
      title: pre.id ? 'Edit test' : 'Add mock test',
      html,
      footer: '<div class="btnrow"><button class="btn primary" style="flex:1" data-act="save-test">Save test</button><button class="btn ghost" data-act="analyse-test">' + I.spark + ' Analyze with Gemini</button></div>',
      onMount: function (body, sc) {
        sc.querySelector('[data-act="save-test"]').addEventListener('click', () => {
          const v = B.formValues(body);
          if (!v.name.trim()) { App.toast('Name the test'); return; }
          const t = {
            name: v.name, date: v.date, exam: v.exam,
            score: +v.score || 0, maxMarks: +v.maxMarks || 0,
            attempted: +v.attempted || 0, correct: +v.correct || 0, wrong: +v.wrong || 0, unattempted: +v.unattempted || 0,
            timeMin: +v.timeMin || 0,
            accuracy: (+v.attempted || 0) ? Math.round((+v.correct || 0) / (+v.attempted) * 100) : 0,
            subjects: {
              phy: { score: +v.sub_phy || 0, max: +v.max_phy || 0 },
              chem: { score: +v.sub_chem || 0, max: +v.max_chem || 0 },
              math: { score: +v.sub_math || 0, max: +v.max_math || 0 }
            },
            notes: v.notes
          };
          if (pre.id) S.update(st => { const x = st.tests.find(y => y.id === pre.id); if (x) Object.assign(x, t); });
          else S.update(st => st.tests.push(Object.assign({ id: U.uid('test'), createdAt: U.nowISO() }, t)));
          B.closeSheet(); App.refresh(); App.toast('Mock test saved');
        });
        sc.querySelector('[data-act="analyse-test"]').addEventListener('click', () => {
          const name = body.querySelector('[name="name"]').value || 'my latest test';
          B.closeSheet();
          location.hash = '#/gemini?q=' + encodeURIComponent('Analyze my mock test: ' + name + '. Use my stored test data and tell me subject-wise and topic-wise what to fix.');
        });
      }
    });
  };

  /* ------------------------------------------------------ topic dimension */
  F.topicDimensions = function (nodeId, exam) {
    const rec = Syl.rec(nodeId);
    if (!rec) return;
    const p = Prog.get(nodeId, exam);
    const scopeNote = rec.kind === 'sub' ? rec.name : rec.name + ' (applies to all ' + Prog.scope(nodeId, exam).length + ' subtopics in the ' + (exam === 'jm' ? 'Main' : 'Advanced') + ' scope)';
    const dim = (key, label, opts) => B.field(label, B.seg('dim_' + key, opts, p[key]));
    const html =
      '<div class="note" style="margin-bottom:10px">' + U.esc(scopeNote) + '</div>' +
      B.field('Overall status', B.seg('status', Prog.STATUSES.map(s => ({ value: s.key, label: s.label })), Prog.displayStatus(nodeId, exam))) +
      dim('theory', 'Theory', [{ value: 'none', label: 'Not done' }, { value: 'partial', label: 'Partial' }, { value: 'done', label: 'Done' }]) +
      dim('lecture', 'Lecture', [{ value: 'none', label: 'Not done' }, { value: 'partial', label: 'Partial' }, { value: 'done', label: 'Done' }]) +
      dim('dpp', 'DPP', [{ value: 'none', label: 'Not done' }, { value: 'partial', label: 'Partial' }, { value: 'done', label: 'Done' }]) +
      dim('pyq', 'PYQ', [{ value: 'none', label: 'Not done' }, { value: 'partial', label: 'Partial' }, { value: 'done', label: 'Done' }]) +
      dim('practice', 'Practice', [{ value: 'none', label: 'Not done' }, { value: 'partial', label: 'Partial' }, { value: 'done', label: 'Done' }]) +
      B.field('Revisions completed', '<input type="number" name="revisionCount" min="0" max="20" value="' + (p.revisionCount || 0) + '">') +
      B.field('Mark weak', B.seg('weak', [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], p.weak ? 'yes' : 'no')) +
      B.field('Personal note', '<textarea name="note">' + U.esc(p.note || '') + '</textarea>') +
      '<div class="grid2">' +
      B.kpi('Coverage', Prog.leafCoverage(nodeId, exam) * 100 >= 0 ? Math.round(Prog.leafCoverage(nodeId, exam) * 100) + '%' : '0%', 'weighted dimensions') +
      B.kpi('Mastery', Prog.mastery(nodeId, exam) + '%', 'coverage x accuracy') +
      '</div>';
    B.sheet({
      title: (exam === 'jm' ? 'JM' : 'JA') + ' tracking - ' + rec.name,
      html,
      footer: '<button class="btn primary block" data-act="save-dims">Save tracking</button>',
      onMount: function (body, sc) {
        body.querySelectorAll('[data-seg]').forEach(seg => {
          seg.addEventListener('click', e => {
            const b = e.target.closest('[data-segval]'); if (!b) return;
            seg.querySelectorAll('.pill').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            const hidden = seg.parentElement.querySelector('input[type="hidden"][name="' + seg.getAttribute('data-seg') + '"]');
            if (hidden) hidden.value = b.getAttribute('data-segval');
          });
        });
        sc.querySelector('[data-act="save-dims"]').addEventListener('click', () => {
          const v = B.formValues(body);
          const leaves = Prog.scope(nodeId, exam);
          const patch = {
            status: v.status, theory: v.dim_theory, lecture: v.dim_lecture, dpp: v.dim_dpp, pyq: v.dim_pyq,
            practice: v.dim_practice, weak: v.weak === 'yes', note: v.note || '',
            revisionCount: +v.revisionCount || 0, lastStudied: U.todayISO()
          };
          S.update(st => {
            leaves.forEach(l => {
              const rec2 = st.progress[l.id] = st.progress[l.id] || {};
              const target = rec2[exam] = rec2[exam] || Prog.blank();
              const merged = Object.assign({}, patch);
              if (leaves.length > 1) merged.revisionCount = Math.max(target.revisionCount || 0, patch.revisionCount);
              Object.assign(target, merged);
            });
          });
          if (v.status === 'completed' && S.state.settings.autoRevision !== false) ensureRevisions(leaves, exam);
          B.closeSheet(); App.refresh(); App.toast('Tracking saved for ' + (exam === 'jm' ? 'JEE Main' : 'JEE Advanced'));
        });
      }
    });
  };

  /* --------------------------------------------------------- revision flow */
  function ensureRevisions(leaves, exam) {
    const created = [];
    leaves.forEach(l => {
      const existing = S.state.revisions.filter(r => r.nodeId === l.id && r.exam === exam && !r.completedAt);
      if (existing.length) return;
      const rec = Syl.rec(l.id);
      const p = Prog.get(l.id, exam);
      const idx = (p.revisionCount || 0) + 1;
      const due = Calc.nextRevisionDate(l.id, exam, idx - 1);
      created.push({ l, idx, due, rec });
    });
    if (!created.length) return;
    S.update(st => created.forEach(c => st.revisions.push({
      id: U.uid('rev'), nodeId: c.l.id, topicId: c.rec.topic ? c.rec.topic.id : c.rec.chapter.id,
      topicName: c.rec.topic ? c.rec.topic.name : c.rec.chapter.name, chapterName: c.rec.chapter.name,
      subject: c.rec.subject.name, exam, index: c.idx, scheduledFor: c.due, completedAt: null, auto: true, createdAt: U.nowISO()
    })));
    App.toast('Revision ' + created[0].idx + ' scheduled for ' + U.fmtDate(created[0].due, 'short') + (created.length > 1 ? ' (+' + (created.length - 1) + ' more)' : ''));
  }
  App.ensureRevisions = ensureRevisions;

  function logTimeFor(nodeId, exam, minutes) {
    if (!minutes) return;
    const rec = Syl.rec(nodeId);
    if (!rec) return;
    const leaves = rec.kind === 'sub' ? [rec.node] : Prog.scope(nodeId, exam);
    S.update(st => {
      const per = Math.round(minutes / Math.max(1, leaves.length));
      leaves.forEach(l => {
        const r = st.progress[l.id] = st.progress[l.id] || {};
        const p = r[exam] = r[exam] || Prog.blank();
        p.timeMin = (p.timeMin || 0) + per;
        p.lastStudied = U.todayISO();
      });
    }, { now: false });
  }
  App.logTimeFor = logTimeFor;

  /* ------------------------------------------------------------- mutations */
  const M = (App.mut = {});
  M.taskDone = function (id) {
    S.update(st => { const t = st.tasks.find(x => x.id === id); if (t) { t.status = 'done'; t.completedAt = U.nowISO(); t.inBacklog = false; } });
    App.refresh(); App.toast('Task completed');
  };
  M.taskUndone = function (id) {
    S.update(st => { const t = st.tasks.find(x => x.id === id); if (t) { t.status = 'pending'; t.completedAt = null; } });
    App.refresh();
  };
  M.taskDelete = function (id) {
    B.confirm('Delete this task? Backlog items are normally rescheduled instead.', () => {
      S.update(st => { st.tasks = st.tasks.filter(x => x.id !== id); });
      App.refresh(); App.toast('Task deleted');
    });
  };
  M.taskReschedule = function (id) {
    const t = S.state.tasks.find(x => x.id === id); if (!t) return;
    B.sheet({
      title: 'Reschedule task',
      html: B.field('New date', '<input type="date" name="d" value="' + U.todayISO() + '">') + '<div class="note">' + U.esc(t.title) + '</div>',
      footer: '<button class="btn primary block" data-act="do-resched">Move task</button>',
      onMount: (body, sc) => sc.querySelector('[data-act="do-resched"]').addEventListener('click', () => {
        const d = body.querySelector('[name="d"]').value;
        S.update(st => { const x = st.tasks.find(y => y.id === id); if (x) { x.plannedFor = d; x.inBacklog = false; x.backlogSince = null; } });
        B.closeSheet(); App.refresh(); App.toast('Rescheduled to ' + U.fmtDate(d, 'short'));
      })
    });
  };
  M.taskSplit = function (id) {
    const t = S.state.tasks.find(x => x.id === id); if (!t) return;
    B.sheet({
      title: 'Split task',
      html: '<div class="note" style="margin-bottom:10px">' + U.esc(t.title) + ' &middot; ' + (t.estMin || 45) + ' min</div>' +
        B.field('Split into how many parts?', B.select('parts', [{ value: '2', label: '2 parts' }, { value: '3', label: '3 parts' }, { value: '4', label: '4 parts' }], '2')) +
        B.field('Schedule part 1 on', '<input type="date" name="from" value="' + U.todayISO() + '">') +
        '<div class="hint">Each part is scheduled on consecutive days, one after another.</div>',
      footer: '<button class="btn primary block" data-act="do-split">Split task</button>',
      onMount: (body, sc) => sc.querySelector('[data-act="do-split"]').addEventListener('click', () => {
        const parts = +body.querySelector('[name="parts"]').value || 2;
        const from = body.querySelector('[name="from"]').value;
        const each = Math.max(5, Math.round((t.estMin || 45) / parts));
        S.update(st => {
          const orig = st.tasks.find(x => x.id === id);
          if (orig) { orig.inBacklog = false; orig.estMin = each; orig.plannedFor = from; orig.title = orig.title.replace(/ \(part \d+\)$/, '') + ' (part 1)'; orig.splitFrom = id; }
          for (let i = 1; i < parts; i++) {
            st.tasks.push(Object.assign({}, t, {
              id: U.uid('task'), title: (t.title || '').replace(/ \(part \d+\)$/, '') + ' (part ' + (i + 1) + ')',
              plannedFor: U.addDays(from, i), estMin: each, inBacklog: false, status: 'pending', completedAt: null
            }));
          }
        });
        B.closeSheet(); App.refresh(); App.toast('Task split into ' + parts + ' parts');
      })
    });
  };
  M.revisionDone = function (id) {
    S.update(st => {
      const r = st.revisions.find(x => x.id === id); if (!r) return;
      r.completedAt = U.nowISO();
      const rec = Syl.rec(r.nodeId);
      const leaves = rec ? (rec.kind === 'sub' ? [rec.node] : Prog.scope(r.nodeId, r.exam)) : [];
      leaves.forEach(l => {
        const rr = st.progress[l.id] = st.progress[l.id] || {};
        const p = rr[r.exam] = rr[r.exam] || Prog.blank();
        p.revisionCount = Math.max(p.revisionCount || 0, r.index);
        p.lastStudied = U.todayISO();
        p.lastRevision = U.todayISO();
      });
    }, { now: true });
    // schedule the next revision in the sequence
    const r = S.state.revisions.find(x => x.id === id);
    if (r && r.index < 5) {
      const rec = Syl.rec(r.nodeId);
      S.update(st => st.revisions.push({
        id: U.uid('rev'), nodeId: r.nodeId, topicId: r.topicId, topicName: r.topicName, chapterName: r.chapterName,
        subject: r.subject, exam: r.exam, index: r.index + 1,
        scheduledFor: Calc.nextRevisionDate(r.nodeId, r.exam, r.index), completedAt: null, auto: true, createdAt: U.nowISO()
      }));
    }
    App.refresh(); App.toast('Revision ' + (r ? r.index : '') + ' completed' + (r && r.index < 5 ? ' - revision ' + (r.index + 1) + ' scheduled' : ''));
  };
  M.revisionReschedule = function (id) {
    const r = S.state.revisions.find(x => x.id === id); if (!r) return;
    B.sheet({
      title: 'Reschedule revision',
      html: B.field('New date', '<input type="date" name="d" value="' + U.todayISO() + '">') + '<div class="note">' + U.esc((r.topicName || '') + ' - Revision ' + r.index) + '</div>',
      footer: '<button class="btn primary block" data-act="do-resched-rev">Move revision</button>',
      onMount: (body, sc) => sc.querySelector('[data-act="do-resched-rev"]').addEventListener('click', () => {
        const d = body.querySelector('[name="d"]').value;
        S.update(st => { const x = st.revisions.find(y => y.id === id); if (x) x.scheduledFor = d; });
        B.closeSheet(); App.refresh(); App.toast('Revision moved to ' + U.fmtDate(d, 'short'));
      })
    });
  };
  M.revisionDelete = function (id) {
    S.update(st => { st.revisions = st.revisions.filter(x => x.id !== id); });
    App.refresh(); App.toast('Revision removed');
  };
  M.lectureStatus = function (id, status) {
    S.update(st => { const l = st.lectures.find(x => x.id === id); if (l) { l.status = status; if (status === 'Completed') l.watchedMin = l.duration || l.watchedMin; } });
    App.refresh();
  };
  M.errorStatus = function (id, status) {
    S.update(st => {
      const e0 = st.errors.find(x => x.id === id); if (!e0) return;
      e0.status = status;
      if (status !== 'open') { e0.revisions = (e0.revisions || 0) + 1; e0.lastRevised = U.todayISO(); }
    });
    App.refresh(); App.toast('Error book updated');
  };
  M.errorDelete = function (id) {
    B.confirm('Delete this error entry?', () => { S.update(st => { st.errors = st.errors.filter(x => x.id !== id); }); App.refresh(); });
  };
  M.quickStatus = function (nodeId, exam, status) {
    const leaves = Prog.scope(nodeId, exam);
    S.update(st => leaves.forEach(l => {
      const rec = st.progress[l.id] = st.progress[l.id] || {};
      const p = rec[exam] = rec[exam] || Prog.blank();
      p.status = status;
      if (status === 'completed' && p.theory === 'none') p.theory = 'done';
      if (status === 'not_started') { p.theory = 'none'; p.weak = false; }
    }));
    if (status === 'completed' && S.state.settings.autoRevision !== false) ensureRevisions(leaves, exam);
    App.refresh(); App.toast((Syl.rec(nodeId) ? Syl.rec(nodeId).name : 'Topic') + ' marked ' + status.replace('_', ' ') + ' (' + (exam === 'jm' ? 'JM' : 'JA') + ')');
  };
  M.deleteEntity = function (kind, id) {
    S.update(st => { if (st[kind]) st[kind] = st[kind].filter(x => x.id !== id); });
    App.refresh();
  };
})(typeof window !== 'undefined' ? window : globalThis);
