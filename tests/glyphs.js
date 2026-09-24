
const { chromium } = require('playwright-core');const path=require('path'),fs=require('fs');
(async()=>{
  const dirs=fs.readdirSync('/home/user/.cache/ms-playwright/').filter(d=>d.indexOf('headless')>=0);
  const exe=dirs.map(d=>'/home/user/.cache/ms-playwright/'+d+'/chrome-headless-shell-linux64/chrome-headless-shell').filter(fs.existsSync)[0];
  const b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:420,height:900}});
  await p.goto('file:///home/user/jee-tracker.html'); await p.waitForTimeout(600);
  await p.evaluate(()=>{window.App.sample.load();});
  const routes=['#/home','#/syllabus','#/syllabus/chem','#/syllabus/math','#/tasks','#/tasks/week','#/tasks/backlog','#/topics-left','#/lectures','#/revision','#/questions','#/errors','#/tests','#/timer','#/analytics','#/analytics/subjects','#/analytics/chapters','#/analytics/topics','#/analytics/questions','#/analytics/lectures','#/analytics/revision','#/analytics/errors','#/analytics/tests','#/gemini','#/profile','#/profile/provenance','#/search?q=moment','#/chapter/phy.c4','#/topic/phy.c4.t1'];
  let found=[];
  for (const r of routes){
    await p.evaluate(h=>{location.hash=h;},r); await p.waitForTimeout(160);
    const txt = await p.textContent('#screen');
    const bad = txt.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu);
    if (bad) found.push(r+' -> '+[...new Set(bad)].join(''));
  }
  console.log(found.length? 'EMOJI/TOFU FOUND:\n'+found.join('\n') : 'no emoji or tofu glyphs on any screen');
  await b.close();
})();
