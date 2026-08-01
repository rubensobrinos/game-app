/* ════════════════════════════════════════════
   GEO-RECORD INFO PANEL — self-contained add-on
   In the "Higher or Lower" game (geo-records categories), when the answer is
   revealed, show an info panel with a short fact about each of the two items
   (where it is + something notable). Reads globals (state, GEO_RECORDS,
   GEO_FACTS, formatNumber) and injects its own DOM/CSS — never edits app.js.
════════════════════════════════════════════ */
(function () {
  'use strict';

  var css = [
    '#geo-facts-panel{display:none;flex-direction:column;gap:.5rem;margin-top:.6rem;}',
    '.gf-row{background:var(--surface,#16162a);border:1.5px solid var(--border,#2a2a4a);border-radius:12px;padding:.6rem .8rem;}',
    '.gf-top{display:flex;align-items:center;gap:.5rem;font-weight:800;}',
    '.gf-emoji{font-size:1.1rem;}',
    '.gf-name{flex:1;min-width:0;}',
    '.gf-val{color:var(--accent-light,#a855f7);font-weight:800;white-space:nowrap;}',
    '.gf-fact{font-size:.85rem;color:var(--text-muted,#8b92b0);margin-top:.3rem;line-height:1.45;}',
  ].join('');
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function ensurePanel() {
    var panel = el('geo-facts-panel');
    if (!panel) {
      var hl = el('hl-area');
      if (!hl) return null;
      panel = document.createElement('div');
      panel.id = 'geo-facts-panel';
      hl.appendChild(panel);
    }
    return panel;
  }

  function row(it, unit, emoji) {
    var f = (typeof GEO_FACTS !== 'undefined') ? GEO_FACTS[it.name_en] : null;
    var fact = f ? (f[state.lang] || f.en || '') : '';
    var val = (typeof formatNumber === 'function') ? formatNumber(it.value) : it.value;
    return '<div class="gf-row"><div class="gf-top">' +
      '<span class="gf-emoji">' + emoji + '</span>' +
      '<span class="gf-name">' + esc(it['name_' + state.lang]) + '</span>' +
      '<span class="gf-val">' + val + ' ' + unit + '</span></div>' +
      (fact ? '<div class="gf-fact">' + esc(fact) + '</div>' : '') + '</div>';
  }

  function hide() { var p = el('geo-facts-panel'); if (p) p.style.display = 'none'; }

  function maybeShow() {
    if (typeof state === 'undefined') return hide();
    var item = state.game.items[state.game.index];
    if (state.currentGame !== 'higher-lower' || !item || item.kind !== 'geo') return hide();
    if (typeof GEO_FACTS === 'undefined') return hide();
    var cat = (typeof GEO_RECORDS !== 'undefined') ? GEO_RECORDS[item.cat] : null;
    if (!cat) return hide();
    var panel = ensurePanel(); if (!panel) return;
    panel.innerHTML = row(item.a, cat.unit, cat.emoji || '') + row(item.b, cat.unit, cat.emoji || '');
    panel.style.display = 'flex';
  }

  function init() {
    ensurePanel();
    // Reveal happened → the shared reveal box becomes visible.
    var rb = el('reveal-box');
    if (rb && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (rb.style.display !== 'none') maybeShow(); else hide();
      }).observe(rb, { attributes: true, attributeFilter: ['style'] });
    }
    // New round → hide.
    var rc = el('round-current');
    if (rc && 'MutationObserver' in window) {
      new MutationObserver(hide).observe(rc, { childList: true, characterData: true, subtree: true });
    }
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
