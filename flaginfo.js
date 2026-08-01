/* ════════════════════════════════════════════
   FLAG STORY (ⓘ) — self-contained add-on
   When the answer is revealed in the Flag Quiz, an ⓘ button appears;
   tapping it opens a card explaining how that country got its flag.
   Reads globals from app.js (`state`) and flag-info.js (`FLAG_INFO`)
   and injects its own DOM + CSS, so it never touches app.js.
════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Styles ──
  var css = [
    '.reveal-box{position:relative;}',
    '.flag-info-btn{position:absolute;top:6px;right:8px;width:26px;height:26px;',
    'border-radius:50%;border:1.5px solid var(--accent-light,#a855f7);',
    'background:rgba(168,85,247,.15);color:var(--accent-light,#a855f7);',
    'font-weight:800;font-style:italic;font-family:Georgia,serif;font-size:15px;',
    'line-height:1;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;}',
    '.flag-info-btn:hover{background:rgba(168,85,247,.3);}',
    '.flag-info-modal{position:fixed;inset:0;z-index:60;display:flex;',
    'align-items:center;justify-content:center;padding:1.25rem;}',
    '.flag-info-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);}',
    '.flag-info-card{position:relative;z-index:1;width:min(420px,100%);',
    'background:var(--surface,#16162a);border:1.5px solid var(--border,#2a2a4a);',
    'border-radius:var(--r,14px);padding:1.25rem;box-shadow:0 16px 50px rgba(0,0,0,.55);',
    'animation:fi-pop .16s ease;}',
    '@keyframes fi-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}',
    '.flag-info-close{position:absolute;top:.6rem;right:.6rem;width:34px;height:34px;',
    'border-radius:8px;border:1.5px solid var(--border,#2a2a4a);background:var(--surface2,#1e1e38);',
    'color:var(--text,#f1f5f9);font-size:1rem;cursor:pointer;}',
    '.flag-info-head{display:flex;align-items:center;gap:.7rem;margin-bottom:.75rem;padding-right:2rem;}',
    '.flag-info-flag{width:46px;height:31px;object-fit:cover;border-radius:3px;',
    'box-shadow:0 2px 8px rgba(0,0,0,.5);flex-shrink:0;}',
    '.flag-info-title{font-size:1.15rem;font-weight:800;color:var(--text,#f1f5f9);}',
    '.flag-info-text{font-size:.95rem;line-height:1.5;color:var(--text,#f1f5f9);}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  function el(id) { return document.getElementById(id); }

  function currentItem() {
    if (typeof state === 'undefined') return null;
    if (state.currentGame !== 'flags') return null;
    return state.game.items[state.game.index] || null;
  }

  function currentInfo() {
    if (typeof FLAG_INFO === 'undefined') return null;
    var it = currentItem();
    if (!it || !it.iso2) return null;
    var entry = FLAG_INFO[it.iso2];
    if (!entry) return null;
    return entry[state.lang] || entry.en || null;
  }

  var infoBtn = null, modal = null;

  function buildUI() {
    var revealBox = el('reveal-box');
    if (revealBox && !infoBtn) {
      infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'flag-info-btn';
      infoBtn.textContent = 'i';
      infoBtn.setAttribute('aria-label', 'Info');
      infoBtn.style.display = 'none';
      infoBtn.addEventListener('click', openModal);
      revealBox.appendChild(infoBtn);
    }
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'flag-info-modal';
      modal.hidden = true;
      modal.innerHTML =
        '<div class="flag-info-backdrop"></div>' +
        '<div class="flag-info-card">' +
          '<button class="flag-info-close" aria-label="Sluiten">✕</button>' +
          '<div class="flag-info-head"><img class="flag-info-flag" alt=""><span class="flag-info-title"></span></div>' +
          '<p class="flag-info-text"></p>' +
        '</div>';
      document.body.appendChild(modal);
      modal.querySelector('.flag-info-backdrop').addEventListener('click', closeModal);
      modal.querySelector('.flag-info-close').addEventListener('click', closeModal);
    }
  }

  function openModal() {
    var info = currentInfo(), it = currentItem();
    if (!info || !it) return;
    buildUI();
    modal.querySelector('.flag-info-flag').src = 'flags/' + it.iso2 + '.png';
    modal.querySelector('.flag-info-title').textContent = it['name_' + state.lang] || it.name_en;
    modal.querySelector('.flag-info-text').textContent = info;
    modal.hidden = false;
  }

  function closeModal() { if (modal) modal.hidden = true; }

  function refreshInfoBtn() {
    buildUI();
    if (infoBtn) infoBtn.style.display = currentInfo() ? '' : 'none';
  }

  function init() {
    buildUI();

    // Show the ⓘ when the answer is revealed; hide it otherwise.
    var revealBox = el('reveal-box');
    if (revealBox && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (revealBox.style.display !== 'none') refreshInfoBtn();
        else if (infoBtn) infoBtn.style.display = 'none';
      }).observe(revealBox, { attributes: true, attributeFilter: ['style'] });
    }

    // New round → hide button + close any open card.
    var rc = el('round-current');
    if (rc && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (infoBtn) infoBtn.style.display = 'none';
        closeModal();
      }).observe(rc, { childList: true, characterData: true, subtree: true });
    }

    // ESC closes the card first (capture, so it beats app.js's Escape handler).
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) {
        e.stopPropagation();
        closeModal();
      }
    }, true);
  }

  // May be loaded after DOMContentLoaded (injected by hint.js), so run now if ready.
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
