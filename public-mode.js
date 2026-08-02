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
   * LANCEERSCOPE (besluit producteigenaar, 2 aug 2026): alleen deze drie
   * spellen gaan nu live. De rest is niet af genoeg om te tonen en volgt
   * later — dat is een productbesluit, geen juridisch (dat is de flag
   * hierboven, met een eigen levensduur: als deze lijst straks groeit, blijft
   * de merkenrechtflag alsnog gelden).
   *
   * Terug online zetten = een id aan deze lijst toevoegen. De spellen zelf
   * blijven volledig intact in app.js; er is niets verwijderd of uitgezet.
   *
   *   btn-flags         Vlaggen Quiz
   *   btn-real-or-fake  Echt of Nep? (vlaggen)
   *   btn-geo           Geo Quiz
   */
  var LAUNCH_GAME_BUTTON_IDS = ['btn-flags', 'btn-real-or-fake', 'btn-geo'];

  /**
   * De multiplayer-ingang is geen quizspel en valt buiten de lanceerscope
   * hierboven; die heeft zijn eigen vlag (SHOW_MULTIPLAYER). Expliciet
   * uitgezonderd zodat de volgorde van init() er niet toe doet.
   */
  var SCOPE_EXEMPT_BUTTON_IDS = ['btn-multiplayer'];

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

  /**
   * Verwijdert elke menukaart die buiten de lanceerscope valt uit het DOM —
   * bewust `remove()` en niet `display:none`: een verborgen kaart is nog
   * steeds vindbaar in de paginabron, en de vraag was om ze echt niet te
   * tonen.
   *
   * Veilig omdat app.js zijn kliklisteners op `DOMContentLoaded` bindt en
   * eerder wordt geladen dan dit bestand; die binding is dus al gebeurd
   * voordat hier iets verdwijnt. app.js blijft onaangeraakt — het houdt
   * listeners over op losgekoppelde knoppen, wat niets doet.
   */
  function pruneGrid(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll('.game-card'), function (card) {
      if (SCOPE_EXEMPT_BUTTON_IDS.indexOf(card.id) !== -1) return;
      if (LAUNCH_GAME_BUTTON_IDS.indexOf(card.id) !== -1) return;
      card.remove();
    });
  }

  /**
   * Eén pas, bewust geen MutationObserver. Een add-on die zijn kaart zelf
   * injecteert, doet dat namelijk vaak mét een eigen observer die 'm terugzet
   * zodra hij verdwijnt (`provinces.js` doet precies dat). Twee observers op
   * hetzelfde rooster die elkaars wijziging ongedaan maken lopen elkaar
   * eindeloos achterna en zetten de main thread vast — dat is hier gebeurd en
   * getest. Zo'n spel gaat daarom uit bij zijn eigen laadpunt (`hint.js`),
   * niet achteraf hier.
   */
  function applyLaunchScope() {
    var grid = document.querySelector('#screen-menu .game-grid');
    if (grid) pruneGrid(grid);
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

  /**
   * Naam: Play Aseso (besluit producteigenaar, 2 aug 2026). De titel zit in
   * app.js's i18n-tabel T (top-level const = globale binding, dus hier
   * bereikbaar); we overschrijven de waarde per taal zodat ook een
   * taalwissel de nieuwe naam toont. app.js zelf blijft onaangeraakt.
   */
  function applyBrandName() {
    document.title = 'Play Aseso — Vlaggenquiz';
    try {
      ['nl', 'en', 'es'].forEach(function (lang) {
        if (typeof T === 'object' && T[lang] && T[lang].appTitle) {
          T[lang].appTitle = 'Play Aseso';
        }
      });
      var titleEl = document.querySelector('.app-title');
      if (titleEl) titleEl.textContent = 'Play Aseso';
    } catch (e) {
      /* T niet beschikbaar — titel-tag is dan alsnog gezet */
    }
  }

  function init() {
    // Eerst de scope, dan de rest: hideBrandGames() vindt daarna niets meer
    // (de drie merkspellen vallen sowieso buiten de lanceerscope) en dat is
    // precies goed — de flag blijft staan voor als de scope later groeit.
    applyLaunchScope();
    hideBrandGames();
    applyBrandName();
    addMultiplayerCard();
    addShareButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
