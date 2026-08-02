// quick-start-preset.mjs
//
// Groepsbattle-preset, default gameTypes (PRODUCT.md §Standaard quick-start
// preset). Dit is NIET de volledige lijst van alle Golf 1-spelvormen (dat wordt
// ooit GOLF_1_GAME_TYPES in feature-gate.mjs, PD3, nog geblokkeerd) — dit is de
// kleinere, specifiek voor déze preset bevestigde standaardselectie (4 van de 5
// Golf 1-spelvormen; Hoofdsteden Quiz zit er bewust niet in).
//
// "Vier, niet vijf" is bevestigd door de gebruiker na een echte tegenstrijdigheid
// tussen PRODUCT.md (vier) en DATA-MODEL.md's voorbeeldconfiguratie (vijf, incl.
// capitals_mc). DATA-MODEL.md's voorbeeld is daarmee nog niet gecorrigeerd — dat
// bestand valt niet onder dit plan.
export const GROUP_BATTLE_DEFAULT_GAME_TYPES = Object.freeze([
  'flags_mc',
  'real_or_fake_flag',
  'higher_lower',
  'odd_one_out',
]);
