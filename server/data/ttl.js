'use strict';

// TTL-constante uit docs/multiplayer/DATA-MODEL.md ("TTL"). Zie
// docs/data-model-plan/prompts/DDM1-keys-and-ttl.md voor wat hier bewust NIET wordt
// opgelost en waarom.
//
// DE REFRESHMATRIX (docs/data-model-plan/REVIEW.md bevinding 3; plan secties 2
// en 6, punt 1) is sinds fase 3 (agent 1, F1/F2 — "de room mag niet doodgaan
// tijdens het spelen") ingevuld: `room-lifecycle.mjs`'s `touchRoom()` is de ENE
// plek die de room-kern én de code-/invite-locators ververst, aangeroepen bij
// elke lobby-actie (join/leave/kick/lock/hernoemen/instellingen) ÉN — sinds
// fase 3 — bij elke fase-overgang tijdens het spelen (`match-lifecycle.mjs`'s
// `applyTransition`). Vóór fase 3 verlengde alleen de eerste categorie iets;
// een room die druk speelde maar geen lobby-actie meer zag, verloor zijn
// code-/invite-locator na exact `ROOM_TTL_SECONDS`, ook middenin een potje.
//
// OPEN, NOG NIET HIER OPGELOST (docs/data-model-plan/REVIEW.md bevinding 3;
// plan secties 2 en 6, punten 2-3):
// 1. De periodieke cleanup van achtergebleven indexes na verlopen room-TTL: welk
//    proces, welke frequentie.
// 2. Of bestaande matchkeys bij een rematch dezelfde TTL behouden of resetten.
// Beide horen bij de repository-laag (DM6) of een apart voorstel, niet bij deze
// module.

/** Standaard room-TTL in seconden na laatste activiteit (DATA-MODEL.md, "TTL"). */
const ROOM_TTL_SECONDS = 14400;

module.exports = {
  ROOM_TTL_SECONDS,
};
