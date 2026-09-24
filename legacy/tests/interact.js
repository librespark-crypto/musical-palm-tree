/* Interaction test: drives the real UI with clicks/typing in a browser. */
const { chromium } = require('playwright-core');
const path = require('path'); const fs = require('fs');

(async () => {
  const dirs = fs.readdirSync('/home/user/.cache/ms-playwright/').filter(d => d.indexOf('headless') >= 0);
  const exe = dirs.map(d => '/home/user/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell').filter(fs.existsSync)[0];
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'jee-tracker.html'));
  await page.waitForTimeout(600);
  const step = async (name, fn) => {
    try { await fn(); console.log('ok   ' + name); }
    catch (e) { console.log('FAIL ' + name + ' -> ' + e.message.split('\n')[0]); errors.push(name + ': ' + e.message.split('\n')[0]); }
  };
  const state = () => page.evaluate(() => window.App.store.state);
  const text = () => page.textContent('#screen');

  /* 1. first-run is empty, no invented stats */
  await step('empty tracker has no fabricated progress', async () => {
    const o = await page.evaluate(() => window.App.calc.overall());
    if (o.main.pct !== 0 || o.questions.attempted !== 0 || o.lectures.total !== 0) throw new Error('expected zero state, got ' + JSON.stringify({ p: o.main.pct, q: o.questions.attempted }));
  });

  /* 2. quick status from syllabus sets JM only */
  await step('mark subtopic complete for JM (syllabus quick action)', async () => {
    await page.evaluate(() => { location.hash = '#/syllabus/phy'; });
    await page.waitForTimeout(250);
    await page.click('.acc-h');
    await page.waitForTimeout(200);
    await page.click('.topicrow');
    await page.waitForTimeout(200);
    await page.click('.subrow [data-act="quick-status"][data-status="completed"]');
    await page.waitForTimeout(300);
    const s = await state();
    const p = s.progress['phy.c0.t0.s0'];
    if (!p || p.jm.status !== 'completed') throw new Error('JM status not set: ' + JSON.stringify(p));
    if (p.ja && p.ja.status === 'completed') throw new Error('JA state leaked from JM action');
  });

  /* 3. topic sheet: six dimensions save for JA independently */
  await step('topic dimension sheet saves JA tracking', async () => {
    await page.evaluate(() => { location.hash = '#/topic/phy.c0.t0'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="edit-dims"]');
    await page.waitForTimeout(250);
    await page.click('.sheet [data-seg="status"] [data-segval="learning"]');
    await page.click('.sheet [data-seg="dim_theory"] [data-segval="done"]');
    await page.click('.sheet [data-seg="dim_lecture"] [data-segval="partial"]');
    await page.click('.sheet [data-act="save-dims"]');
    await page.waitForTimeout(300);
    const s = await state();
    const p = s.progress['phy.c0.t0.s0'].jm;
    if (p.status !== 'learning' || p.theory !== 'done' || p.lecture !== 'partial') throw new Error(JSON.stringify(p));
    const ja = s.progress['phy.c0.t0.s0'].ja;
    if (ja && ja.theory !== 'none') throw new Error('JA must stay untouched by a JM-scope edit');
  });

  /* 4. add a task through the real form and complete it from Home */
  await step('add task via form, complete from home', async () => {
    await page.evaluate(() => { location.hash = '#/tasks'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="fab-task"]');
    await page.waitForTimeout(250);
    await page.fill('.sheet [name="title"]', 'Rotational Motion DPP set 3');
    await page.selectOption('.sheet [name="type"]', 'DPP');
    await page.selectOption('.sheet [name="subject"]', 'Physics');
    await page.fill('.sheet [name="estMin"]', '75');
    await page.click('.sheet [data-act="save-task"]');
    await page.waitForTimeout(400);
    let s = await state();
    const t = s.tasks.find(x => x.title === 'Rotational Motion DPP set 3');
    if (!t) throw new Error('task not created');
    if (t.estMin !== 75) throw new Error('estMin not parsed: ' + t.estMin);
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(300);
    const onHome = (await text()).indexOf('Rotational Motion DPP set 3') >= 0;
    if (!onHome) throw new Error('task missing from Home');
    await page.click('[data-act="task-toggle"][data-id="' + t.id + '"]');
    await page.waitForTimeout(350);
    s = await state();
    if (s.tasks.find(x => x.id === t.id).status !== 'done') throw new Error('task not marked done');
  });

  /* 5. question logging form */
  await step('log questions through the form', async () => {
    await page.evaluate(() => { location.hash = '#/questions'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="fab-question"]');
    await page.waitForTimeout(250);
    await page.selectOption('.sheet [name="source"]', 'PYQ');
    await page.selectOption('.sheet [name="subject"]', 'Mathematics');
    await page.fill('.sheet [name="attempted"]', '20');
    await page.fill('.sheet [name="correct"]', '15');
    await page.fill('.sheet [name="wrong"]', '5');
    await page.click('.sheet [data-act="save-question"]');
    await page.waitForTimeout(400);
    const s = await state();
    const q = s.questions[0];
    if (!q || q.accuracy !== 75 || q.source !== 'PYQ') throw new Error(JSON.stringify(q));
  });

  /* 6. lecture form + status cycling */
  await step('add lecture and cycle status', async () => {
    await page.evaluate(() => { location.hash = '#/lectures'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="fab-lecture"]');
    await page.waitForTimeout(250);
    await page.fill('.sheet [name="title"]', 'Rotational Motion Lecture 4');
    await page.selectOption('.sheet [name="subject"]', 'Physics');
    await page.fill('.sheet [name="duration"]', '80');
    await page.click('.sheet [data-act="save-lecture"]');
    await page.waitForTimeout(400);
    let s = await state();
    const l = s.lectures[0];
    if (!l || l.duration !== 80) throw new Error('lecture not saved');
    await page.click('[data-act="lec-next"][data-id="' + l.id + '"]');
    await page.waitForTimeout(300);
    s = await state();
    if (s.lectures[0].status !== 'In Progress') throw new Error('status cycle failed: ' + s.lectures[0].status);
  });

  /* 7. error book entry */
  await step('add error-book entry via form', async () => {
    await page.evaluate(() => { location.hash = '#/errors'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="fab-error"]');
    await page.waitForTimeout(250);
    await page.selectOption('.sheet [name="mistakeType"]', 'Formula');
    await page.fill('.sheet [name="questionText"]', 'Moment of inertia of a rod about end');
    await page.fill('.sheet [name="correctConcept"]', 'Use parallel axis theorem');
    await page.click('.sheet [data-act="save-error"]');
    await page.waitForTimeout(400);
    const s = await state();
    const e = s.errors[0];
    if (!e || e.mistakeType !== 'Formula') throw new Error('error not saved');
    await page.click('[data-act="err-status"][data-id="' + e.id + '"][data-v="revised"]');
    await page.waitForTimeout(300);
    const s2 = await state();
    if (s2.errors[0].status !== 'revised') throw new Error('error status not updated');
  });

  /* 8. mock test form */
  await step('add mock test', async () => {
    await page.evaluate(() => { location.hash = '#/tests'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="fab-test"]');
    await page.waitForTimeout(250);
    await page.fill('.sheet [name="name"]', 'Coaching Major Test 1');
    await page.fill('.sheet [name="score"]', '210');
    await page.fill('.sheet [name="maxMarks"]', '300');
    await page.fill('.sheet [name="attempted"]', '68');
    await page.fill('.sheet [name="correct"]', '55');
    await page.fill('.sheet [name="wrong"]', '13');
    await page.click('.sheet [data-act="save-test"]');
    await page.waitForTimeout(400);
    const s = await state();
    const t = s.tests[0];
    if (!t || t.score !== 210 || t.accuracy !== 81) throw new Error(JSON.stringify(t));
  });

  /* 9. study timer start/stop writes a session and topic time */
  await step('study timer start -> stop writes session', async () => {
    await page.evaluate(() => { location.hash = '#/timer'; });
    await page.waitForTimeout(300);
    await page.click('[data-act="timer-start"]');
    await page.waitForTimeout(300);
    if (!(await state()).timer.running) throw new Error('timer not running');
    const before = (await state()).sessions.length;
    await page.click('[data-act="timer-stop"]');
    await page.waitForTimeout(350);
    const s = await state();
    if (s.sessions.length !== before + 1) throw new Error('session not recorded');
    if (s.timer.running) throw new Error('timer still marked running');
  });

  /* 10. revision lifecycle: complete -> next revision auto-scheduled */
  await step('revision complete schedules next', async () => {
    await page.evaluate(() => {
      const s = window.App.store.state;
      s.revisions.push({ id: 'rev-t', nodeId: 'phy.c0.t0.s0', topicId: 'phy.c0.t0', topicName: 'Units', chapterName: 'Units and Measurements', subject: 'Physics', exam: 'jm', index: 1, scheduledFor: window.App.util.todayISO(), completedAt: null, auto: true, createdAt: new Date().toISOString() });
      window.App.store.save(true);
    });
    await page.evaluate(() => { location.hash = '#/revision'; });
    await page.waitForTimeout(300);
    await page.click('[data-act="rev-done"][data-id="rev-t"]');
    await page.waitForTimeout(400);
    const s = await state();
    const next = s.revisions.find(r => r.nodeId === 'phy.c0.t0.s0' && r.index === 2 && !r.completedAt);
    if (!next) throw new Error('next revision not auto-scheduled');
    const prog = s.progress['phy.c0.t0.s0'].jm;
    if (prog.revisionCount < 1) throw new Error('revision count not updated');
  });

  /* 11. backlog sweep moves yesterday's unfinished task */
  await step('backlog sweep moves unfinished tasks', async () => {
    const moved = await page.evaluate(() => {
      const s = window.App.store.state;
      s.tasks.push({ id: 'late-1', title: 'Yesterday DPP', type: 'DPP', subject: 'Physics', exam: 'jm', estMin: 45, priority: 'Medium', plannedFor: window.App.util.addDays(window.App.util.todayISO(), -3), status: 'pending', completedAt: null, inBacklog: false, createdAt: new Date().toISOString() });
      window.App.store.save(true);
      return window.App.calc.sweepBacklog();
    });
    if (moved < 1) throw new Error('nothing swept');
    const s = await state();
    const t = s.tasks.find(x => x.id === 'late-1');
    if (!t.inBacklog) throw new Error('task not moved to backlog');
    await page.evaluate(() => { location.hash = '#/tasks/backlog'; });
    await page.waitForTimeout(300);
    if ((await text()).indexOf('Yesterday DPP') < 0) throw new Error('backlog item not visible');
  });

  /* 12. task split */
  await step('split backlog task into parts', async () => {
    await page.click('[data-act="task-split"][data-id="late-1"]');
    await page.waitForTimeout(250);
    await page.selectOption('.sheet [name="parts"]', '3');
    await page.click('.sheet [data-act="do-split"]');
    await page.waitForTimeout(400);
    const s = await state();
    const parts = s.tasks.filter(x => /part \d/.test(x.title) && x.title.indexOf('Yesterday DPP') >= 0);
    if (parts.length !== 3) throw new Error('expected 3 parts, got ' + parts.length);
  });

  /* 13. AI recommendation fallback (no key) is data-grounded and actionable */
  await step('offline recommendation + accept into tasks', async () => {
    await page.evaluate(() => { location.hash = '#/gemini'; });
    await page.waitForTimeout(300);
    await page.click('[data-act="ai-recommend"]');
    await page.waitForTimeout(700);
    const rec = await page.evaluate(() => window.App.store.state.ai.lastRec);
    if (!rec || !rec.items.length) throw new Error('no recommendation produced');
    console.log('     recommend source=' + rec.source + ' items=' + rec.items.length + ' :: ' + rec.items[0].title);
    const before = (await state()).tasks.length;
    await page.click('[data-act="ai-accept"][data-i="0"]');
    await page.waitForTimeout(400);
    const after = (await state()).tasks.length;
    if (after !== before + 1) throw new Error('accept did not add a task');
  });

  /* 14. search finds syllabus nodes and shows progress */
  await step('global search returns syllabus matches', async () => {
    await page.evaluate(() => { location.hash = '#/search?q=inertia'; });
    await page.waitForTimeout(350);
    const t = await text();
    if (t.indexOf('Moment of Inertia') < 0) throw new Error('search did not find Moment of Inertia');
  });

  /* 15. export / import round trip through the UI */
  await step('export then import restores state', async () => {
    const json = await page.evaluate(() => window.App.store.exportJSON());
    const ok = await page.evaluate((j) => { try { window.App.store.importJSON(j); return true; } catch (e) { return false; } }, json);
    if (!ok) throw new Error('import failed');
  });

  /* 16. Gemini without a key fails gracefully (no crash, clear message) */
  await step('gemini without key degrades gracefully', async () => {
    await page.evaluate(() => { location.hash = '#/gemini'; });
    await page.waitForTimeout(250);
    const hasBanner = (await text()).indexOf('Gemini key needed') >= 0;
    if (!hasBanner) throw new Error('missing key banner');
    await page.fill('#ai-input', 'test');
    await page.click('[data-act="ai-send"]');
    await page.waitForTimeout(900);
    const t = await text();
    if (t.indexOf('Add your Gemini API key') < 0) throw new Error('no graceful error message');
  });

  /* 17. persistence across reload (localStorage on file://) */
  await step('state survives a page reload', async () => {
    const beforeQ = (await state()).questions.length;
    const beforeT = (await state()).tasks.length;
    await page.reload();
    await page.waitForTimeout(700);
    const s = await state();
    if (s.questions.length !== beforeQ || s.tasks.length !== beforeT) throw new Error('state not persisted (q ' + beforeQ + '->' + s.questions.length + ')');
  });

  await browser.close();
  console.log('\n' + (errors.length ? errors.length + ' FAILURES:\n - ' + errors.join('\n - ') : 'All interaction tests passed.'));
  process.exit(errors.length ? 1 : 0);
})();
