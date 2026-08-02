// public-mode.js — add-on voor de publieke build op play.aseso.nl.
// Hint.js-patroon: los bestand, raakt app.js niet aan, kan zonder gevolgen
// worden weggelaten.
//
// Doet twee dingen:
//  1. MERKENRECHT-FLAG: verbergt de drie merk-/clublogo-spellen wanneer de
//     app op een publiek domein draait (PRODUCT.md: logospellen niet publiek
//     zonder expliciete juridische vrijgave; runbook-punt 1). Lokaal en op
//     localhost blijft alles gewoon zichtbaar — geen build-stap nodig, het
//     domein bepaalt het gedrag.
//  2. DEELKNOP: native share (of kopieer-fallback) zodat spelers de quiz
//     kunnen doorsturen — de start van de 90-dagenmeting uit de
//     groeistrategie. Bezoekcijfers zelf komen uit Cloudflare Analytics
//     (staat automatisch aan voor het domein); dit bestand verzamelt en
//     verstuurt zelf níéts.

(function () {
  'use strict';

  /** Domeinen waarop de merkspellen verborgen worden. */
  var PUBLIC_HOSTNAMES = ['play.aseso.nl'];

  /** De drie spellen achter de juridische flag (PRODUCT.md §Juridische productgrens). */
  var BRAND_GAME_BUTTON_IDS = ['btn-logos', 'btn-football', 'btn-logo-real-or-fake'];

  var isPublicHost = PUBLIC_HOSTNAMES.indexOf(window.location.hostname) !== -1;

  /**
   * Multiplayer-ingang. Op false tot de multiplayer live is (keten-test groen
   * + tegencontrole + Caddy-routering actief) — dan is dit ÉÉN regel omzetten.
   * Route: /samen → multiplayer-home (HANDOFF-UI-6).
   */
  var SHOW_MULTIPLAYER = false;

  function addMultiplayerCard() {
    if (!SHOW_MULTIPLAYER) return;
    var grid = document.querySelector('#screen-menu .game-grid');
    if (!grid || document.getElementById('btn-multiplayer')) return;

    var card = document.createElement('button');
    card.id = 'btn-multiplayer';
    card.className = 'game-card';
    var icon = document.createElement('span');
    icon.className = 'game-icon';
    icon.textContent = '🎉';
    var name = document.createElement('span');
    name.className = 'game-name';
    name.textContent = 'Samen spelen';
    card.appendChild(icon);
    card.appendChild(name);
    card.addEventListener('click', function () {
      window.location.href = '/samen';
    });
    grid.insertBefore(card, grid.firstChild);
  }

  function hideBrandGames() {
    if (!isPublicHost) return;
    BRAND_GAME_BUTTON_IDS.forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.style.display = 'none';
    });
  }

  function shareUrl() {
    return window.location.origin + '/';
  }

  function addShareButton() {
    var container = document.querySelector('#screen-menu .menu-container');
    var grid = document.querySelector('#screen-menu .game-grid');
    if (!container || !grid) return;

    var btn = document.createElement('button');
    btn.id = 'btn-share-app';
    btn.type = 'button';
    btn.textContent = '📤 Deel deze quiz';
    btn.style.cssText =
      'display:block;margin:14px auto 0;padding:10px 22px;border-radius:999px;' +
      'border:1px solid rgba(255,255,255,0.35);background:transparent;color:inherit;' +
      'font:inherit;font-size:0.95em;cursor:pointer;';

    btn.addEventListener('click', function () {
      var url = shareUrl();
      if (navigator.share) {
        navigator.share({ title: 'Vlaggenquiz', text: 'Speel mee!', url: url }).catch(function () {
          /* geannuleerd door gebruiker — geen actie */
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          var original = btn.textContent;
          btn.textContent = '✅ Link gekopieerd!';
          setTimeout(function () { btn.textContent = original; }, 2000);
        });
      }
    });

    // Onder het spelrooster, boven eventuele voettekst.
    grid.parentNode.insertBefore(btn, grid.nextSibling);
  }

  function init() {
    hideBrandGames();
    addMultiplayerCard();
    addShareButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
