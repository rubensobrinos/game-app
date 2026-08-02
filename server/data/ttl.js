'use strict';

// TTL-constante uit docs/multiplayer/DATA-MODEL.md ("TTL"). Zie
// docs/data-model-plan/prompts/DDM1-keys-and-ttl.md voor wat hier bewust NIET wordt
// opgelost en waarom.
//
// OPEN, NIET HIER OPGELOST (docs/data-model-plan/REVIEW.md bevinding 3; plan
// secties 2 en 6):
// 1. De refreshmatrix: welke sleutels (roomkern, indexes, matchkeys) bij welke
//    activiteit ververst worden. DATA-MODEL.md zegt alleen "roomkern, indexes en
//    relevante matchkeys" zonder dat te specificeren — een pure functie kan dat
//    niet zonder ontwerpbesluit invullen.
// 2. De periodieke cleanup van achtergebleven indexes na verlopen room-TTL: welk
//    proces, welke frequentie.
// 3. Of bestaande matchkeys bij een rematch dezelfde TTL behouden of resetten.
// Alle drie horen bij de repository-laag (DM6) of een apart voorstel, niet bij deze
// module.

/** Standaard room-TTL in seconden na laatste activiteit (DATA-MODEL.md, "TTL"). */
const ROOM_TTL_SECONDS = 14400;

module.exports = {
  ROOM_TTL_SECONDS,
};
