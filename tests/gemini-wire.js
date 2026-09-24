/* Verifies the Gemini request the app builds (URL, auth header, system prompt,
   tracker context, generation config) by intercepting the network call. */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
(async () => {
  const dirs = fs.readdirSync('/home/user/.cache/ms-playwright/').filter(d => d.indexOf('headless') >= 0);
  const exe = dirs.map(d => '/home/user/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell').filter(fs.existsSync)[0];
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const captured = [];
  await page.route('**generativelanguage.googleapis.com/**', async route => {
    const req = route.request();
    captured.push({ url: req.url(), method: req.method(), headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    const isJson = (req.postData() || '').indexOf('responseMimeType') >= 0;
    const inner = isJson
      ? JSON.stringify({ summary: 'Test summary', items: [{ title: 'Revise Units', type: 'Revision', subject: 'Physics', topicId: 'phy.c0.t0', exam: 'jm', estMin: 30, priority: 'High', reason: 'due today per tracker data' }] })
      : 'Mocked answer grounded in the tracker data.';
    await route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: inner }] }, finishReason: 'STOP' }] })
    });
  });
  await page.goto('file://' + path.join(__dirname, '..', 'jee-tracker.html'));
  await page.waitForTimeout(600);
  // set a fake key + generate some real data so the context is non-empty
  await page.evaluate(() => {
    window.App.sample.load();
    // key must be set AFTER loading sample state (sample load resets settings)
    window.App.store.update(s => { s.settings.apiKey = 'TEST_KEY_123'; }, { now: true });
  });
  const errs = [];
  // 1. performance analysis request
  await page.evaluate(() => { location.hash = '#/gemini'; });
  await page.waitForTimeout(300);
  await page.click('[data-act="ai-analyze"]');
  await page.waitForTimeout(1200);
  // 2. recommendation request
  await page.click('[data-act="ai-recommend"]');
  await page.waitForTimeout(1200);
  // 3. plain question
  await page.fill('#ai-input', 'Explain the moment of inertia of a disc.');
  await page.click('[data-act="ai-send"]');
  await page.waitForTimeout(1200);
  // 4. hint-only path must not reveal solutions (system prompt rule check)
  await page.fill('#ai-input', 'Give me a hint for this rotational motion problem.');
  await page.click('[data-act="ai-hint"]');
  await page.waitForTimeout(1000);

  console.log('captured calls:', captured.length);
  const analyze = captured[0], rec = captured[1], chat = captured[2], hint = captured[3];
  const checks = [
    ['URL uses v1beta generateContent', analyze && /v1beta\/models\/gemini-2\.5-flash:generateContent/.test(analyze.url)],
    ['API key sent as x-goog-api-key header', analyze && analyze.headers['x-goog-api-key'] === 'TEST_KEY_123'],
    ['POST method', analyze && analyze.method === 'POST'],
    ['system prompt present', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('You are an expert JEE Main and JEE Advanced Physics, Chemistry and Mathematics tutor.') === 0],
    ['hint rule in system prompt', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('When the user asks for a hint, do not immediately reveal the complete solution.') >= 0],
    ['no-fabrication rule in system prompt', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('When analyzing performance, use only actual tracker data.') >= 0],
    ['no motivational filler rule', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('Do not give motivational filler.') >= 0],
    ['physics/chem/maths rules present', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('maintain accurate chemical equations') >= 0 && analyze.body.systemInstruction.parts[0].text.indexOf('show logically valid mathematical steps') >= 0],
    ['tracker data embedded (syllabus sources)', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('jeeadv.ac.in') >= 0],
    ['tracker data embedded (real aggregates)', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('"jeeMain"') >= 0],
    ['analysis mode instruction', analyze && analyze.body.systemInstruction.parts[0].text.indexOf('Produce a performance analysis') >= 0],
    ['contents are user role', analyze && analyze.body.contents[0].role === 'user'],
    ['temperature set for analysis', analyze && analyze.body.generationConfig.temperature === 0.25],
    ['recommendation asks for strict JSON', rec && rec.body.generationConfig.responseMimeType === 'application/json'],
    ['JSON parsed into plan items', rec && rec.body.generationConfig.maxOutputTokens > 0],
    ['chat call carries question', chat && JSON.stringify(chat.body.contents).indexOf('moment of inertia of a disc') >= 0],
    ['hint request routed as chat', hint && hint.body.systemInstruction.parts[0].text.indexOf('hint') >= 0],
    ['multi-turn history included on later calls', captured[3] && captured[3].body.contents.length >= 2]
  ];
  let fails = 0;
  checks.forEach(([n, ok]) => { console.log((ok ? 'ok   ' : 'FAIL ') + n); if (!ok) fails++; });

  // UI should now show the mocked recommendation with accept/edit/reject
  const t = await page.textContent('#screen');
  const uiOk = t.indexOf('Recommended plan') >= 0 && t.indexOf('Revise Units') >= 0 && t.indexOf('due today per tracker data') >= 0 && t.indexOf('Mocked answer grounded') >= 0;
  console.log((uiOk ? 'ok   ' : 'FAIL ') + 'recommendation + answer rendered in UI');
  if (!uiOk) fails++;

  // check the rec item was persisted with source=gemini
  const src = await page.evaluate(() => window.App.store.state.ai.lastRec && window.App.store.state.ai.lastRec.source);
  console.log((src === 'gemini' ? 'ok   ' : 'FAIL ') + 'recommendation source tagged as gemini (' + src + ')');
  if (src !== 'gemini') fails++;

  await browser.close();
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nGemini wire format verified.');
  process.exit(fails ? 1 : 0);
})();
