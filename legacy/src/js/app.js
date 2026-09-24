/* ==========================================================================
   app.js - bootstrap: storage, backlog sweep, router start, live timer, shortcuts
   ========================================================================== */
(function (global) {
  'use strict';
  const App = global.App;
  const U = App.util, S = App.store, B = App.ui;

  /* re-render the current screen without losing scroll position */
  App.refresh = function () {
    const y = global.scrollY || document.documentElement.scrollTop || 0;
    B._keepScroll = true;
    App.router.render();
    B._keepScroll = false;
    global.scrollTo({ top: y });
  };

  function sweep() {
    const moved = App.calc.sweepBacklog();
    if (moved) { S.save(true); App.toast(moved + ' unfinished task' + (moved > 1 ? 's' : '') + ' moved to backlog'); }
  }

  App.boot = function () {
    App.initCore(global.__SYLLABUS__);
    // daily backlog sweep at load, then when the day flips
    if (S.state.meta.lastSweep !== U.todayISO()) sweep();
    setInterval(() => { if (S.state.meta.lastSweep !== U.todayISO()) sweep(); }, 60000);

    /* default route */
    if (!location.hash) location.hash = '#/home';
    App.router.start();

    /* live timer pill + big clock */
    setInterval(() => {
      const pill = document.querySelector('.timerpill');
      if (S.state.timer.running) {
        const mins = App.timer.elapsedMin();
        if (pill) pill.innerHTML = '<span class="rec"></span>' + U.esc(S.state.timer.mode || 'Study') + ' &middot; ' + U.minsToClock(mins) + ' &middot; stop';
        const big = document.getElementById('bigclock');
        if (big) big.textContent = U.minsToClock(mins);
      } else if (pill) { pill.remove(); }
    }, 1000);

    /* keyboard: / focuses search, Esc closes sheet */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') B.closeSheet();
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); location.hash = '#/search'; }
    });

    console.log('%cJEE PCM Tracker ready', 'font-weight:bold', '- syllabus:', App.syl.data.meta.retrieved);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.boot);
  else App.boot();
})(typeof window !== 'undefined' ? window : globalThis);
