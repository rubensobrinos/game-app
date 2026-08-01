/* ════════════════════════════════════════════
   PROVINCES & STATES — self-contained game add-on
   Click-to-identify: pick one or more countries (Europe + Americas), then a
   country map is shown and you CLICK the named state/province.
   Self-contained: injects its own menu card, screens and CSS, lazy-loads the
   ~1.6 MB data on first open, reuses globals (state.lang, shuffle, getScorePhrase).
   Never edits app.js.
════════════════════════════════════════════ */
(function () {
  'use strict';

  var HOME = 'nl';   // order the country picker outward from here

  // ── i18n ──
  var L = {
    nl: { title:'Provincies & Staten', pick:'Kies één of meer landen', europe:'Europa', americas:"Amerika's",
          count:'Aantal vragen', start:'Starten', clickThe:'Klik op de', next:'Volgende →', results:'Resultaten',
          again:'Opnieuw', selAll:'Alles', of:'van', loading:'Laden…' },
    en: { title:'Provinces & States', pick:'Pick one or more countries', europe:'Europe', americas:'Americas',
          count:'Number of questions', start:'Start', clickThe:'Click the', next:'Next →', results:'Results',
          again:'Again', selAll:'All', of:'of', loading:'Loading…' },
    es: { title:'Provincias y Estados', pick:'Elige uno o más países', europe:'Europa', americas:'Américas',
          count:'Número de preguntas', start:'Iniciar', clickThe:'Haz clic en', next:'Siguiente →', results:'Resultados',
          again:'Otra vez', selAll:'Todo', of:'de', loading:'Cargando…' },
  };
  function lang() { return (typeof state !== 'undefined' && state.lang) || 'nl'; }
  function L_(k) { return (L[lang()] || L.nl)[k]; }
  function countryName(c) { return c['name_' + lang()] || c.name || c.name_en; }

  // Admin-1 type → localized word.
  function typeLabel(ty) {
    var t = (ty || '').toLowerCase(), l = lang();
    function p(nl, en, es) { return l === 'en' ? en : l === 'es' ? es : nl; }
    if (t.indexOf('state') >= 0)        return p('staat', 'state', 'estado');
    if (t.indexOf('province') >= 0)     return p('provincie', 'province', 'provincia');
    if (t.indexOf('department') >= 0)   return p('departement', 'department', 'departamento');
    if (t.indexOf('canton') >= 0)       return p('kanton', 'canton', 'cantón');
    if (t.indexOf('autonomous') >= 0 || t.indexOf('community') >= 0) return p('autonome regio', 'autonomous community', 'comunidad autónoma');
    if (t.indexOf('region') >= 0)       return p('regio', 'region', 'región');
    if (t.indexOf('county') >= 0)       return p('graafschap', 'county', 'condado');
    if (t.indexOf('district') >= 0)     return p('district', 'district', 'distrito');
    if (t.indexOf('governorate') >= 0)  return p('gouvernement', 'governorate', 'gobernación');
    if (t.indexOf('prefecture') >= 0)   return p('prefectuur', 'prefecture', 'prefectura');
    if (t.indexOf('municipality') >= 0) return p('gemeente', 'municipality', 'municipio');
    if (t.indexOf('territory') >= 0)    return p('territorium', 'territory', 'territorio');
    if (t.indexOf('republic') >= 0)     return p('republiek', 'republic', 'república');
    return p('regio', 'region', 'región');
  }

  if (typeof T !== 'undefined') {
    if (T.nl) T.nl.provGame = 'Provincies & Staten';
    if (T.en) T.en.provGame = 'Provinces & States';
    if (T.es) T.es.provGame = 'Provincias y Estados';
  }

  // ── Styles ──
  var css = [
    '#prov-app{position:fixed;inset:0;z-index:80;background:var(--bg,#0d0d1a);color:var(--text,#f1f5f9);',
    "display:none;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:'Segoe UI',system-ui,sans-serif;}",
    '#prov-app.open{display:flex;}',
    '.prov-wrap{max-width:620px;width:100%;margin:0 auto;padding:1rem 1.1rem 2rem;display:flex;flex-direction:column;gap:.85rem;flex:1;}',
    '.prov-head{display:flex;align-items:center;gap:.7rem;padding-top:.4rem;}',
    '.prov-title{font-size:1.25rem;font-weight:800;}',
    '.prov-sub{font-size:.75rem;font-weight:700;color:var(--text-muted,#8b92b0);text-transform:uppercase;letter-spacing:.06em;}',
    '.prov-back{background:var(--surface,#16162a);border:1.5px solid var(--border,#2a2a4a);border-radius:10px;color:var(--text,#f1f5f9);width:40px;height:40px;min-width:40px;font-size:1.1rem;cursor:pointer;flex-shrink:0;}',
    '.prov-grp{display:flex;align-items:center;justify-content:space-between;margin-top:.3rem;}',
    '.prov-mini{background:transparent;border:1.5px solid var(--border,#2a2a4a);color:var(--accent-light,#a855f7);border-radius:8px;padding:.25rem .6rem;font-size:.72rem;font-weight:700;cursor:pointer;}',
    '.prov-chips{display:flex;flex-wrap:wrap;gap:.45rem;}',
    '.prov-chip{background:var(--surface,#16162a);border:1.5px solid var(--border,#2a2a4a);border-radius:20px;padding:.35rem .7rem;font-size:.8rem;font-weight:600;color:var(--text-muted,#8b92b0);cursor:pointer;user-select:none;}',
    '.prov-chip .c{opacity:.6;font-weight:700;margin-left:.25rem;}',
    '.prov-chip.on{border-color:var(--accent-light,#a855f7);background:rgba(168,85,247,.15);color:var(--accent-light,#a855f7);}',
    '.prov-slider{display:flex;align-items:center;gap:.7rem;}.prov-slider input{flex:1;accent-color:var(--accent-light,#a855f7);}',
    '.prov-badge{background:var(--accent,#7c3aed);color:#fff;border-radius:6px;padding:.1rem .45rem;font-size:.8rem;font-weight:700;}',
    '.prov-start{background:linear-gradient(135deg,var(--accent,#7c3aed),var(--accent-light,#a855f7));border:none;border-radius:12px;color:#fff;padding:1rem;font-size:1.05rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;margin-top:.3rem;}',
    '.prov-start:disabled{opacity:.4;cursor:not-allowed;}',
    '.prov-gamebar{display:flex;align-items:center;gap:.5rem;}',
    '.prov-progress{font-size:.9rem;font-weight:700;color:var(--text-muted,#8b92b0);flex:1;}',
    '.prov-scorechip{background:var(--surface,#16162a);border:1.5px solid var(--border,#2a2a4a);border-radius:20px;padding:.25rem .75rem;font-size:.8rem;font-weight:700;}',
    '.prov-ask{text-align:center;font-size:.78rem;color:var(--text-muted,#8b92b0);text-transform:uppercase;letter-spacing:.06em;font-weight:700;}',
    '.prov-target{text-align:center;font-size:1.55rem;font-weight:900;color:var(--accent-light,#a855f7);line-height:1.1;}',
    '.prov-c2{text-align:center;font-size:.8rem;color:var(--text-muted,#8b92b0);}',
    '.prov-figure{background:var(--surface,#16162a);border:2px solid var(--border,#2a2a4a);border-radius:14px;display:flex;align-items:center;justify-content:center;padding:.8rem;min-height:300px;}',
    '.prov-figure svg{width:98%;max-width:460px;height:auto;}',
    '.prov-base{fill:#3a3d5c;stroke:#565a80;stroke-width:.4;cursor:pointer;transition:fill .1s;}',
    '#prov-svg:not(.locked) .prov-base:hover{fill:#5b5f8f;}',
    '#prov-svg.locked .prov-base{cursor:default;}',
    '.prov-correct{fill:#22c55e;stroke:#fff;stroke-width:.6;stroke-linejoin:round;paint-order:stroke;}',
    '.prov-wrong{fill:#ef4444;stroke:#fff;stroke-width:.6;stroke-linejoin:round;paint-order:stroke;}',
    '.prov-btn{width:100%;padding:.85rem;border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer;border:2px solid var(--accent,#7c3aed);background:rgba(124,58,237,.1);color:var(--accent-light,#a855f7);}',
    '.prov-next{background:linear-gradient(135deg,var(--accent,#7c3aed),var(--accent-light,#a855f7));border-color:transparent;color:#fff;display:none;}',
    '.prov-results{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1rem;text-align:center;}',
    '.prov-trophy{font-size:3.2rem;}.prov-rscore{font-size:2.2rem;font-weight:900;color:var(--accent-light,#a855f7);}',
    '.prov-phrase{font-size:1.05rem;font-style:italic;color:var(--text-muted,#8b92b0);}',
  ].join('');
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function elm(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var selected = {}, rounds = [], idx = 0, score = 0, phase = 'q', count = 12, root;

  // ── Menu card ──
  function injectCard() {
    var grid = document.querySelector('.game-grid');
    if (!grid || document.getElementById('btn-provinces')) return;
    var btn = elm('button', 'game-card');
    btn.id = 'btn-provinces';
    btn.innerHTML = '<span class="game-icon">🧭</span><span class="game-name" data-i18n="provGame">' + L_('title') + '</span>';
    grid.appendChild(btn);
    btn.addEventListener('click', open);
  }

  function ensureData(cb) {
    if (typeof PROVINCES !== 'undefined') { cb(); return; }
    var s = document.createElement('script');
    s.src = 'data/provinces.js'; s.onload = cb;
    s.onerror = function () { alert('Kon provinciedata niet laden.'); };
    document.body.appendChild(s);
  }

  function build() { if (!root) { root = elm('div'); root.id = 'prov-app'; document.body.appendChild(root); } }
  function open() { build(); root.classList.add('open'); root.innerHTML = '<div class="prov-wrap"><div class="prov-sub">' + L_('loading') + '</div></div>'; ensureData(renderPicker); }
  function close() { if (root) root.classList.remove('open'); }

  // ── Picker (sorted outward from HOME) ──
  function homeC() { return (typeof PROVINCES !== 'undefined' && PROVINCES[HOME]) || null; }
  function dist(c) { var h = homeC(); if (!h) return 0; var dlat = c.lat - h.lat, dlon = (c.lon - h.lon) * Math.cos(h.lat * Math.PI / 180); return dlat * dlat + dlon * dlon; }
  function sortedCountries(region) {
    return Object.keys(PROVINCES).filter(function (k) { return PROVINCES[k].region === region; })
      .map(function (k) { return { iso2: k, c: PROVINCES[k] }; })
      .sort(function (a, b) { return dist(a.c) - dist(b.c); });
  }
  function selectedIso() { return Object.keys(selected).filter(function (k) { return selected[k]; }); }
  function updateStart() { var b = document.getElementById('prov-start'); if (b) b.disabled = selectedIso().length === 0; }

  function renderPicker() {
    var wrap = elm('div', 'prov-wrap');
    var head = elm('div', 'prov-head');
    var back = elm('button', 'prov-back', '✕'); back.addEventListener('click', close);
    head.appendChild(back); head.appendChild(elm('div', 'prov-title', L_('title')));
    wrap.appendChild(head);
    wrap.appendChild(elm('div', 'prov-sub', L_('pick')));

    ['Europe', 'Americas'].forEach(function (region) {
      var grp = elm('div', 'prov-grp');
      grp.appendChild(elm('span', 'prov-sub', region === 'Europe' ? L_('europe') : L_('americas')));
      var all = elm('button', 'prov-mini', L_('selAll'));
      all.addEventListener('click', function () { sortedCountries(region).forEach(function (o) { selected[o.iso2] = true; }); refresh(); });
      grp.appendChild(all);
      wrap.appendChild(grp);
      var chips = elm('div', 'prov-chips');
      sortedCountries(region).forEach(function (o) {
        var chip = elm('button', 'prov-chip' + (selected[o.iso2] ? ' on' : ''), countryName(o.c) + '<span class="c">' + o.c.units.length + '</span>');
        chip.dataset.iso2 = o.iso2;
        chip.addEventListener('click', function () { selected[o.iso2] = !selected[o.iso2]; chip.classList.toggle('on', !!selected[o.iso2]); updateStart(); });
        chips.appendChild(chip);
      });
      wrap.appendChild(chips);
    });

    var srow = elm('div');
    srow.appendChild(elm('div', 'prov-sub', L_('count') + ' : <span id="prov-count" class="prov-badge">' + count + '</span>'));
    var slider = elm('div', 'prov-slider'); slider.innerHTML = '<span>5</span><input type="range" id="prov-slider" min="5" max="30" value="' + count + '"><span>30</span>';
    srow.appendChild(slider); wrap.appendChild(srow);
    var start = elm('button', 'prov-start', L_('start')); start.id = 'prov-start'; start.addEventListener('click', startGame);
    wrap.appendChild(start);

    root.innerHTML = ''; root.appendChild(wrap);
    document.getElementById('prov-slider').addEventListener('input', function (e) { count = +e.target.value; document.getElementById('prov-count').textContent = count; });
    updateStart();
    function refresh() { document.querySelectorAll('.prov-chip').forEach(function (ch) { ch.classList.toggle('on', !!selected[ch.dataset.iso2]); }); updateStart(); }
  }

  // ── Game (click to identify) ──
  function startGame() {
    var picks = selectedIso(); if (!picks.length) return;
    var all = [];
    picks.forEach(function (iso2) { PROVINCES[iso2].units.forEach(function (u, i) { all.push({ iso2: iso2, ui: i }); }); });
    rounds = shuffle(all).slice(0, Math.min(count, all.length));
    idx = 0; score = 0;
    renderGame(); renderRound();
  }

  function renderGame() {
    var wrap = elm('div', 'prov-wrap');
    var bar = elm('div', 'prov-gamebar');
    var back = elm('button', 'prov-back', '✕'); back.addEventListener('click', close);
    bar.appendChild(back);
    bar.appendChild(elm('div', 'prov-progress', '<span id="prov-cur">1</span> ' + L_('of') + ' <span id="prov-tot">' + rounds.length + '</span>'));
    bar.appendChild(elm('div', 'prov-scorechip', '⭐ <span id="prov-score">0</span>'));
    wrap.appendChild(bar);
    wrap.appendChild(elm('div', 'prov-ask', '<span id="prov-ask"></span>'));
    wrap.appendChild(elm('div', 'prov-target', '<span id="prov-target"></span>'));
    wrap.appendChild(elm('div', 'prov-c2', '<span id="prov-c2"></span>'));
    wrap.appendChild(elm('div', 'prov-figure', '<svg id="prov-svg" viewBox="0 0 100 100" role="img"></svg>'));
    var next = elm('button', 'prov-btn prov-next', L_('next')); next.id = 'prov-next';
    wrap.appendChild(next);
    root.innerHTML = ''; root.appendChild(wrap);

    document.getElementById('prov-next').addEventListener('click', nextRound);
    document.getElementById('prov-svg').addEventListener('click', function (e) {
      var p = e.target && e.target.closest ? e.target.closest('path') : null;
      if (p && p.hasAttribute('data-i')) onPick(+p.getAttribute('data-i'));
    });
  }

  function renderRound() {
    var r = rounds[idx], c = PROVINCES[r.iso2], target = c.units[r.ui];
    phase = 'q';
    document.getElementById('prov-cur').textContent = idx + 1;
    document.getElementById('prov-tot').textContent = rounds.length;
    document.getElementById('prov-score').textContent = score;
    document.getElementById('prov-ask').textContent = L_('clickThe') + ' ' + typeLabel(c.type) + ':';
    document.getElementById('prov-target').textContent = target.n;
    document.getElementById('prov-c2').textContent = countryName(c);
    var svg = '';
    c.units.forEach(function (u, i) { svg += '<path d="' + u.d + '" data-i="' + i + '" class="prov-base"/>'; });
    var svgEl = document.getElementById('prov-svg');
    svgEl.innerHTML = svg; svgEl.classList.remove('locked');
    document.getElementById('prov-next').style.display = 'none';
  }

  function onPick(i) {
    if (phase !== 'q') return;
    phase = 'a';
    var r = rounds[idx], svg = document.getElementById('prov-svg');
    svg.classList.add('locked');
    var correct = (i === r.ui);
    if (correct) { score++; document.getElementById('prov-score').textContent = score; }
    var tp = svg.querySelector('path[data-i="' + r.ui + '"]'); if (tp) tp.setAttribute('class', 'prov-correct');
    if (!correct) { var cp = svg.querySelector('path[data-i="' + i + '"]'); if (cp) cp.setAttribute('class', 'prov-wrong'); }
    document.getElementById('prov-next').style.display = '';
  }

  function nextRound() { if (idx >= rounds.length - 1) { showResults(); return; } idx++; renderRound(); }

  function showResults() {
    var phrase = (typeof getScorePhrase === 'function') ? getScorePhrase(score, rounds.length) : { emoji: '🏁', text: '' };
    var wrap = elm('div', 'prov-wrap'), res = elm('div', 'prov-results');
    res.appendChild(elm('div', 'prov-trophy', phrase.emoji));
    res.appendChild(elm('div', 'prov-title', L_('results')));
    res.appendChild(elm('div', 'prov-rscore', score + ' / ' + rounds.length));
    res.appendChild(elm('div', 'prov-phrase', phrase.text || ''));
    var again = elm('button', 'prov-btn', L_('again')); again.addEventListener('click', startGame);
    var toPick = elm('button', 'prov-btn prov-next', L_('title')); toPick.addEventListener('click', renderPicker);
    res.appendChild(again); res.appendChild(toPick);
    wrap.appendChild(res); root.innerHTML = ''; root.appendChild(wrap);
  }

  function init() {
    injectCard();
    var grid = document.querySelector('.game-grid');
    if (grid && 'MutationObserver' in window) new MutationObserver(injectCard).observe(grid, { childList: true });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
