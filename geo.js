/* ════════════════════════════════════════════
   GEO QUIZ — self-contained add-on
   "Guess the country from its silhouette." Reuses app.js's whole quiz
   engine (input modes, scoring, reveal) but swaps the flag image for an
   inline silhouette. Reads globals (state, COUNTRIES, COUNTRY_SHAPES,
   GAME_CONFIG, shuffle, show, renderRound, openSettings, closeQuickMenu)
   and never edits app.js — so it can't clash with concurrent edits.
════════════════════════════════════════════ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  var G = 'geo';

  // 1) Register the game in the shared config (const object → mutable). This makes
  //    openSettings('geo') and the standard settings/quick-menu work generically.
  if (typeof GAME_CONFIG !== 'undefined' && !GAME_CONFIG.geo) {
    GAME_CONFIG.geo = { title: 'geoGame', nextLabel: 'settingNext', countLabel: 'settingCountCountry', placeholder: 'guessPlaceholder' };
  }

  // 2) Styles (injected, not style.css).
  var css = [
    '.geo-holder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}',
    '.geo-svg{width:70%;max-width:240px;height:auto;}',
    '.geo-svg path,.geo-svg ellipse{fill:var(--accent-light,#a855f7);fill-opacity:.92;stroke:#fff;stroke-width:.7;stroke-linejoin:round;paint-order:stroke;}',
    '.choice-geo{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:8px;}',
    '.choice-geo-svg{width:100%;height:100%;max-height:90px;}',
    '.choice-geo-svg path,.choice-geo-svg ellipse{fill:var(--accent-light,#a855f7);fill-opacity:.92;stroke:#fff;stroke-width:.9;stroke-linejoin:round;paint-order:stroke;}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function hasShapes() { return typeof COUNTRY_SHAPES !== 'undefined'; }
  function shapeFor(iso2) { return hasShapes() ? (COUNTRY_SHAPES[iso2] || '') : ''; }

  // ── Silhouette rendering (single-image modes) ──
  function geoHolder() {
    var wrap = el('flag-wrap');
    var h = el('geo-holder');
    if (!h && wrap) { h = document.createElement('div'); h.id = 'geo-holder'; h.className = 'geo-holder'; wrap.appendChild(h); }
    return h;
  }
  function showGeoSilhouette() {
    var it = state.game.items[state.game.index];
    if (!it) return;
    var shape = shapeFor(it.iso2);
    var h = geoHolder();
    if (!h) return;
    if (!shape) { h.style.display = 'none'; return; }   // fallback: leave flag visible
    h.innerHTML = '<svg class="geo-svg" viewBox="0 0 100 100" role="img" aria-label="silhouet">' + shape + '</svg>';
    h.style.display = '';
    var img = el('flag-img');           if (img) img.style.display = 'none';
    var cv  = el('fake-flag-canvas');   if (cv)  cv.style.display  = 'none';
  }
  function hideGeoSilhouette() { var h = el('geo-holder'); if (h) h.style.display = 'none'; }

  // ── Start a Geo round set (silhouette-only pool) ──
  function geoStart() {
    var diff  = state.settings.difficulty;
    var count = state.settings.flagCount;
    var ok    = function (c) { return shapeFor(c.iso2); };
    var pool  = COUNTRIES.filter(function (c) { return c.difficulty === diff && ok(c); });
    if (!pool.length) pool = COUNTRIES.filter(ok);   // fall back to all countries that have a silhouette
    var g = state.game;
    g.items       = shuffle(pool).slice(0, Math.min(count, pool.length));
    g.choicesPool = pool;
    g.index       = 0;
    g.scores      = [0, 0];
    g.currentTeam = 0;
    if ('streak' in g) g.streak = 0;
    show('screen-game');
    renderRound();
  }

  // Intercept the three Start entry points (their handlers hold app.js's original
  // startGame reference, so capture-phase + stopImmediatePropagation is needed).
  function intercept(id, extra) {
    var b = el(id);
    if (!b) return;
    b.addEventListener('click', function (e) {
      if (state.currentGame === G) {
        e.stopImmediatePropagation();
        if (extra) extra();
        geoStart();
      }
    }, true);
  }

  // ── Menu card ──
  function enableGeoCard() {
    var span = document.querySelector('.game-card [data-i18n="geoGame"]');
    var card = span && span.closest ? span.closest('.game-card') : null;
    if (card) {
      card.classList.remove('disabled');
      card.removeAttribute('disabled');
      var badge = card.querySelector('.badge-soon');
      if (badge) badge.remove();
    }
  }

  function init() {
    enableGeoCard();

    // Open Geo settings when its card is clicked (delegated → survives menu rebuilds).
    document.addEventListener('click', function (e) {
      var card = e.target && e.target.closest ? e.target.closest('.game-card') : null;
      if (card && card.querySelector('[data-i18n="geoGame"]') && typeof openSettings === 'function') {
        e.preventDefault();
        openSettings(G);
      }
    });

    // Keep the card enabled if the menu is rebuilt elsewhere.
    var grid = document.querySelector('.game-grid');
    if (grid && 'MutationObserver' in window) {
      new MutationObserver(enableGeoCard).observe(grid, { childList: true, subtree: true });
    }

    intercept('btn-start');
    intercept('btn-play-again');
    intercept('btn-qm-restart', function () { if (typeof closeQuickMenu === 'function') closeQuickMenu(); });

    // Swap the flag image for a silhouette in single-image modes (type/flashcard).
    var fimg = el('flag-img');
    if (fimg && 'MutationObserver' in window) {
      new MutationObserver(function () {
        var wrap = el('flag-wrap');
        if (state.currentGame === G && wrap && wrap.style.display !== 'none') showGeoSilhouette();
        else hideGeoSilhouette();
      }).observe(fimg, { attributes: true, attributeFilter: ['src'] });
    }

    // Choice mode: replace each flag option with the country's silhouette.
    var cgrid = el('choice-grid');
    if (cgrid && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (state.currentGame !== G) return;
        var imgs = cgrid.querySelectorAll('img');
        if (!imgs.length) return;
        imgs.forEach(function (img) {
          var card = img.closest('.choice-card');
          if (!card) return;
          var idx = +card.getAttribute('data-choice-index');
          var c = state.game.currentChoices && state.game.currentChoices[idx];
          if (!c || !c.iso2) return;
          var span = document.createElement('span');
          span.className = 'choice-geo';
          span.innerHTML = '<svg viewBox="0 0 100 100" class="choice-geo-svg">' + shapeFor(c.iso2) + '</svg>';
          img.replaceWith(span);
        });
      }).observe(cgrid, { childList: true, subtree: true });
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
