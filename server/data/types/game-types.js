'use strict';

// Golf 1-gameType-enum, gedeeld tussen GameConfiguration.gameTypes (DM2a) en
// Round.gameType (DM3), zodat niet elk bestand zijn eigen lijst bijhoudt. Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md
// (stap 0) en DM2a voor de herkomst: letterlijk uit DATA-MODEL.md's
// GameConfiguration-voorbeeld, cross-bevestigd door PRODUCT.md §Spelvormen
// "Golf 1" en GAME-RULES.md §Spelvormen.
//
// `country_shape_mc` erbij (docs/openstaand/raad-het-land.md, stap 2): "Raad
// het land", de vierde wereldgame (besluit C-2). Alleen de enum-waarde — de
// keten (vraagselectie/contentbron/spelscherm/mock) volgt in latere stappen;
// staat daarom nog niet in `shared/content/game-catalog.mjs`'s
// PLAYABLE_GAME_TYPES.

const GOLF_1_GAME_TYPES = Object.freeze([
  'flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out', 'country_shape_mc',
]);

module.exports = { GOLF_1_GAME_TYPES };
