// views/lobby/gamekeuze.mjs — UI2, uit lobby.mjs gesplitst (docs/openstaand/
// refactor/11-lobby.md). De carrousel: kaart, pijlen, vegen, de BINNENKORT-
// staat.
//
// VASTLIGGENDE REGEL #1 (11-lobby.md): wat speelbaar is bepaalt dit scherm
// NIET zelf. `shared/content/game-catalog.mjs` is de enige bron. Op 4 augustus
// zette een lokale lijst hier zelf een game op speelbaar terwijl de
// contentbron hem niet kon bouwen — starten liet de room stil in COUNTDOWN
// staan. `game-catalog.mjs` is nu de enige bron, gedeeld met de
// protocolvalidatie. Draaien naar een speelbare game stuurt game:update-
// config; de serverstand (config.gameTypes) blijft de waarheid (regel #2).
//
// Geen eigen root/mount: `gameRow`/`gameCardSub` zijn DIRECTE kinderen van
// `.lobby-settings-body` (CSS-gap-ritme) — de aanroeper (instellingen.mjs)
// plakt ze op hun plek vóór zijn eigen rijen.

import { GAME_CATALOG, isPlayableGameType } from '../../../../shared/content/game-catalog.mjs';

export function createGamekeuzeView({ t, onConfigChange }) {
  async function pushConfig(patch) {
    try {
      await onConfigChange?.(patch);
    } catch {
      // room:config-changed blijft uit → de volgende update() zet de knoppen
      // gewoon terug naar de serverstand; geen eigen foutkanaal nodig.
    }
  }

  const GAMES = GAME_CATALOG.map((game) => ({
    key: game.key,
    gameType: game.gameType,
    speelbaar: isPlayableGameType(game.gameType),
  }));
  let gameIndex = 0;
  /** De laatst van de server ontvangen gameType — zie update(). */
  let renderedServerGameType = null;

  const gameRow = document.createElement('div');
  gameRow.className = 'lobby-gamerow';
  const gamePrev = document.createElement('button');
  gamePrev.type = 'button';
  gamePrev.className = 'lobby-gamearrow';
  gamePrev.textContent = '‹';
  const gameNext = document.createElement('button');
  gameNext.type = 'button';
  gameNext.className = 'lobby-gamearrow';
  gameNext.textContent = '›';
  const gameCard = document.createElement('div');
  gameCard.className = 'lobby-gamecard';
  const gameCardTitle = document.createElement('b');
  gameCardTitle.className = 'lobby-gamecard-title';
  gameCard.appendChild(gameCardTitle);
  gameRow.append(gamePrev, gameCard, gameNext);
  const gameCardSub = document.createElement('div');
  gameCardSub.className = 'lobby-gamecard-sub';
  const gameCardDesc = document.createElement('span');
  gameCardDesc.className = 'lobby-gamecard-desc';
  const gameCardSoon = document.createElement('span');
  gameCardSoon.className = 'lobby-gamecard-soon';
  gameCardSub.append(gameCardDesc, gameCardSoon);

  function renderGameCard() {
    const game = GAMES[gameIndex];
    gameCardTitle.textContent = t(`lobby.game_${game.key}`);
    gameCardDesc.textContent = t(`lobby.game_${game.key}_desc`);
    gameCard.classList.toggle('is-soon', !game.speelbaar);
    gameCardSoon.textContent = game.speelbaar ? '' : t('lobby.gameSoonStart');
  }
  function turnGame(step) {
    gameIndex = (gameIndex + step + GAMES.length) % GAMES.length;
    renderGameCard();
    const game = GAMES[gameIndex];
    if (game.speelbaar && game.gameType !== null) {
      pushConfig({ gameTypes: [game.gameType] });
    }
  }
  gamePrev.addEventListener('click', () => turnGame(-1));
  gameNext.addEventListener('click', () => turnGame(1));

  // Punt 23: met de duim over de kaart vegen draait dezelfde carrousel als de
  // pijlen. Pointer-events en geen `scroll-snap`-strip: de kaart toont bewust
  // één game — de serverstand is de waarheid (§A5) — en een strip zou vier
  // kaarten tonen waarvan er drie niet gekozen zijn. `touch-action: pan-y`
  // (CSS) laat verticaal scrollen ongemoeid.
  const VEEG_DREMPEL = 40; // px; hieronder is het een tik, geen veeg
  let veegStartX = null;
  gameCard.addEventListener('pointerdown', (event) => {
    veegStartX = typeof event?.clientX === 'number' ? event.clientX : null;
  });
  gameCard.addEventListener('pointerup', (event) => {
    if (veegStartX === null) return;
    const verschil = (typeof event?.clientX === 'number' ? event.clientX : veegStartX) - veegStartX;
    veegStartX = null;
    if (Math.abs(verschil) < VEEG_DREMPEL) return;
    // Naar links vegen brengt de vólgende kaart in beeld, zoals elke carrousel.
    turnGame(verschil < 0 ? 1 : -1);
  });
  gameCard.addEventListener('pointercancel', () => { veegStartX = null; });

  function render() {
    renderGameCard();
    gamePrev.setAttribute('aria-label', t('lobby.gameTurn'));
    gameNext.setAttribute('aria-label', t('lobby.gameTurn'));
  }

  render();

  /**
   * Alleen aangeroepen door lobby.mjs als `isHost` — precies zoals in het
   * ongesplitste bestand, waar deze synchronisatie binnen `if (isHost) {...}`
   * stond (dezelfde host-only-instellingenblok als instellingen.mjs).
   * @param {{ config?: { gameTypes?: string[] } }} model
   */
  function update(model) {
    const config = model.config ?? {};
    // De serverstand is de waarheid, maar mag de host niet uit een
    // BINNENKORT-kaart wegtrekken bij élke update() (die draait ook als er
    // gewoon iemand binnenkomt). Daarom alleen bijsturen als de SERVER iets
    // anders zegt dan de vorige keer — dan is er echt een keuze gewijzigd,
    // hier of op een ander apparaat.
    const serverGameType = Array.isArray(config.gameTypes) ? config.gameTypes[0] : null;
    if (serverGameType !== null && serverGameType !== renderedServerGameType) {
      renderedServerGameType = serverGameType;
      const idx = GAMES.findIndex((game) => game.gameType === serverGameType);
      if (idx >= 0 && idx !== gameIndex) {
        gameIndex = idx;
        renderGameCard();
      }
    }
  }

  return { gameRow, gameCardSub, update, render };
}
