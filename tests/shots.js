/* Screenshot the app's main screens at mobile size so the UI can be reviewed. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const dirs = fs.readdirSync('/home/user/.cache/ms-playwright/').filter(d => d.indexOf('headless') >= 0);
  const cand = dirs.map(d => '/home/user/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell').filter(fs.existsSync);
  const browser = await chromium.launch({ executablePath: cand[0], args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'jee-tracker.html'));
  await page.waitForTimeout(700);
  // seed sample data so every screen has content
  await page.evaluate(() => { window.App.sample.load(); window.App.router.render(); });
  await page.waitForTimeout(400);
  const out = path.join(__dirname, '..', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  const shots = [
    ['home', '#/home', 1000],
    ['syllabus', '#/syllabus/phy', 1000],
    ['chapter', '#/chapter/phy.c4', 900],
    ['topic', '#/topic/phy.c4.t1', 1100],
    ['tasks-today', '#/tasks', 900],
    ['tasks-week', '#/tasks/week', 900],
    ['backlog', '#/tasks/backlog', 900],
    ['topics-left', '#/topics-left', 900],
    ['lectures', '#/lectures', 900],
    ['revision', '#/revision', 900],
    ['questions', '#/questions', 900],
    ['errors', '#/errors', 900],
    ['tests', '#/tests', 900],
    ['analytics', '#/analytics/overview', 1000],
    ['analytics-topics', '#/analytics/topics', 900],
    ['gemini', '#/gemini', 800],
    ['profile', '#/profile', 900],
    ['search', '#/search?q=moment', 800],
    ['timer', '#/timer', 800]
  ];
  for (const [name, hash, h] of shots) {
    await page.setViewportSize({ width: 420, height: h });
    await page.evaluate(hh => { location.hash = hh; }, hash);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, name + '.png') });
  }
  // full-width desktop view of home
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'desktop-home.png') });
  await browser.close();
  console.log('screenshots written:', fs.readdirSync(out).length);
  if (errors.length) { console.log('PAGE ERRORS:'); errors.slice(0, 15).forEach(e => console.log(' *', e)); process.exit(1); }
  console.log('no page errors');
})();
