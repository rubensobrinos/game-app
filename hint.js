/* ════════════════════════════════════════════
   CONTOUR HINT — self-contained add-on
   Shows a country's silhouette (from the Geo game) as a help
   when you don't recognise a flag. Reads the globals defined by
   app.js (`state`) and shapes.js (`COUNTRY_SHAPES`) without
   modifying app.js, so it can't clash with other edits.
════════════════════════════════════════════ */
(function () {
  'use strict';

  // Inject styles here (not style.css) so the whole feature stays in one file.
  var css = [
    '.hint-box{background:var(--surface);border:2px dashed var(--border);',
    'border-radius:var(--r,14px);padding:.75rem 1rem;display:flex;',
    'align-items:center;justify-content:center;}',
    '.hint-svg{width:150px;height:150px;max-width:55%;display:block;}',
    '.hint-svg path,.hint-svg ellipse{fill:var(--accent-light,#a855f7);fill-opacity:.9;',
    'stroke:#fff;stroke-width:.8;stroke-linejoin:round;paint-order:stroke;}',
    '.btn-hint{border-color:var(--gold,#f59e0b);color:var(--gold,#f59e0b);',
    'background:rgba(245,158,11,.08);}',
    '.btn-hint:hover{background:rgba(245,158,11,.16);}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // Register translations on the shared dictionary (T is a global const in app.js).
  if (typeof T !== 'undefined') {
    if (T.nl) T.nl.showHint = 'Toon contour';
    if (T.en) T.en.showHint = 'Show outline';
    if (T.es) T.es.showHint = 'Ver silueta';
  }

  function el(id) { return document.getElementById(id); }

  // The silhouette for the current round, or null when unavailable.
  function currentShape() {
    if (typeof state === 'undefined' || typeof COUNTRY_SHAPES === 'undefined') return null;
    // Flags quiz + Capitals quiz (both show a country; the silhouette helps).
    if (state.currentGame !== 'flags' && state.currentGame !== 'capitals') return null;
    // Skip in "choice" mode — a silhouette would give the answer away.
    const mode = state.settings && state.settings.inputMode;
    if (mode && mode === 'choice') return null;
    const item = state.game.items[state.game.index];
    if (!item || !item.iso2) return null;
    return COUNTRY_SHAPES[item.iso2] || null;
  }

  function resetHint() {
    const box = el('hint-box'), svg = el('hint-svg'), btn = el('btn-hint');
    if (!box || !svg || !btn) return;
    box.style.display = 'none';
    svg.innerHTML     = '';
    btn.style.display = currentShape() ? '' : 'none';
  }

  function showHint() {
    const shape = currentShape();
    const box = el('hint-box'), svg = el('hint-svg'), btn = el('btn-hint');
    if (!shape || !box || !svg || !btn) return;
    svg.innerHTML     = shape;
    box.style.display = '';
    btn.style.display = 'none';
  }

  // Load the flag-story (ⓘ) add-on here instead of via index.html, which is
  // being edited elsewhere. Chained so flag-info.js (data) runs before flaginfo.js.
  (function loadFlagStory() {
    function addScript(src, cb) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      if (cb) s.onload = cb;
      (document.body || document.documentElement).appendChild(s);
    }
    if (typeof FLAG_INFO === 'undefined') addScript('data/flag-info.js', function () { addScript('flaginfo.js'); });
    else addScript('flaginfo.js');
    addScript('geo.js');        // Geo Quiz — self-contained (no app.js edits)
    // Provinces & States valt buiten de lanceerscope (public-mode.js,
    // LAUNCH_GAME_BUTTON_IDS) en wordt daarom niet geladen. Bewust hier en
    // niet daar: provinces.js injecteert zijn menukaart via een eigen
    // MutationObserver die 'm terugzet zodra hij verdwijnt. Wie de kaart
    // achteraf weghaalt, belandt dus in een livelock met die observer. Het
    // script niet laden is de enige plek waar dat spel echt uit gaat.
    // Terug online: deze regel herstellen én het id aan LAUNCH_GAME_BUTTON_IDS
    // toevoegen.
    // addScript('provinces.js');
    addScript('data/geo-facts.js'); // record facts (may 404 until generated — harmless)
    addScript('geo-facts.js');  // Higher/Lower info panel — self-contained
  })();

  document.addEventListener('DOMContentLoaded', function () {
    const btn = el('btn-hint');
    if (btn) btn.addEventListener('click', showHint);

    // New round → the progress counter's text is replaced. Re-evaluate the hint.
    const rc = el('round-current');
    if (rc && 'MutationObserver' in window) {
      new MutationObserver(resetHint).observe(rc, { childList: true, characterData: true, subtree: true });
    }

    // Answer revealed → hide the hint button (the country is now shown).
    const revealBox = el('reveal-box');
    if (revealBox && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (revealBox.style.display !== 'none') {
          const b = el('btn-hint');
          if (b) b.style.display = 'none';
        }
      }).observe(revealBox, { attributes: true, attributeFilter: ['style'] });
    }
  });
})();
