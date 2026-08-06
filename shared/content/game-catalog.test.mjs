// Tests voor de gedeelde spelcatalogus (PLAN-CONVERGENTIE §A0).
//
// De belangrijkste test in dit bestand is de KETENTEST onderaan: elke gameType
// die de catalogus speelbaar noemt, moet door de échte contentbron gebouwd
// kunnen worden. Precies die controle ontbrak op 4 aug 2026, toen de
// lobbycarrousel `real_or_fake_flag` speelbaar zette terwijl
// `content-source.mjs` er nog op wierp — de suite bleef groen en een
// spelavond zou stil in COUNTDOWN zijn blijven staan.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CATALOG, PLAYABLE_GAME_TYPES, isPlayableGameType } from './game-catalog.mjs';
import { GOLF_1_GAME_TYPES } from '../../server/data/types/game-types.js';
import { createContentSource } from '../../server/composition/content-source.mjs';
import { CONTENT_VERSION } from './index.mjs';

/** Deterministische PRNG (mulberry32) — geen Math.random in de tests. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('#1 de catalogus bevat de vier wereldgames uit DOELBEELD-v2 §1, plus de twee van besluit 49', () => {
  // De eerste vier zijn doelbeeld v2 en staan bewust vooraan in de carrousel.
  // `capitals` en `higher_lower` bestonden al in de regellaag maar stonden
  // nergens aan; besluit 49 (6 aug 2026) zet ze alsnog aan, achteraan.
  assert.deepEqual(
    GAME_CATALOG.map((game) => game.key),
    ['flag', 'realfake', 'odd', 'outline', 'capitals', 'higherlower'],
  );
});

test('#2 elke gameType in de catalogus is een bestaande Golf-1-gameType (of null)', () => {
  for (const game of GAME_CATALOG) {
    if (game.gameType === null) continue;
    assert.ok(
      GOLF_1_GAME_TYPES.includes(game.gameType),
      `"${game.gameType}" (${game.key}) staat niet in GOLF_1_GAME_TYPES`,
    );
  }
});

test('#3 "Raad het land" heeft bewust nog geen gameType — de contourdata zit nog in de solo-app', () => {
  const outline = GAME_CATALOG.find((game) => game.key === 'outline');
  assert.equal(outline.gameType, null);
  assert.equal(isPlayableGameType(outline.gameType), false);
});

test('#4 isPlayableGameType is streng: alleen strings uit PLAYABLE_GAME_TYPES', () => {
  for (const gameType of PLAYABLE_GAME_TYPES) {
    assert.equal(isPlayableGameType(gameType), true);
  }
  for (const value of [null, undefined, '', 'flags', 'FLAGS_MC', 0, {}, ['flags_mc']]) {
    assert.equal(isPlayableGameType(value), false, `${JSON.stringify(value)} mag niet speelbaar heten`);
  }
});

test('#5 speelbaar is een deelverzameling van de catalogus (geen weesregels)', () => {
  const known = new Set(GAME_CATALOG.map((game) => game.gameType));
  for (const gameType of PLAYABLE_GAME_TYPES) {
    assert.ok(known.has(gameType), `"${gameType}" is speelbaar maar staat niet in de catalogus`);
  }
});

test('#6 KETENCONTRACT: elke speelbare gameType levert een echte vraag uit de echte contentbron', () => {
  assert.ok(PLAYABLE_GAME_TYPES.length > 0, 'er moet minstens één speelbare game zijn');

  for (const gameType of PLAYABLE_GAME_TYPES) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const source = createContentSource({
        contentVersion: CONTENT_VERSION,
        language: 'nl',
        difficulty,
        random: seededRandom(7),
      });

      assert.ok(
        source.poolSize(gameType) > 0,
        `poolSize("${gameType}") is 0 op difficulty "${difficulty}" — de catalogus belooft meer dan de contentbron waarmaakt`,
      );

      // Werpt deze aanroep, dan zou een echte spelavond stil blijven staan.
      const built = source.buildQuestion({ gameType });
      assert.equal(typeof built.questionKey, 'string');
      assert.ok(built.questionKey.length > 0);
      assert.ok(built.publicQuestionPayload !== null && typeof built.publicQuestionPayload === 'object');
      assert.ok(built.correctAnswer !== null && typeof built.correctAnswer === 'object');
    }
  }
});
