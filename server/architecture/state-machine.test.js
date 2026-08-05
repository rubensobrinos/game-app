'use strict';

// Tabelgedreven testsuite voor de fase-state-machine van één match.
// Spec: docs/architecture-plan/prompts/AR0-AR1-state-machine.md, sectie "## Prompt"
// (overgangstabel, pauze-/hervat-/finish-regels en de vijf invarianten).
//
// Alleen node:test + node:assert, geen externe dependencies. De suite is
// geschreven vanuit de spec, niet vanuit de implementatie.
//
// Geen enkele test raakt de systeemklok (testpunt 11): `now` is altijd een
// vaste literal, zodat `pausedAt` exact te asserten is.

const { test } = require('node:test');
const assert = require('node:assert');

const { transition } = require('./state-machine');

/** Vaste tijdstempels — nooit Date.now(). */
const NOW = 1_700_000_000_000;
const LATER = 1_700_000_123_456;
const ZERO_NOW = 0;
const PAUSED_AT = 1_699_999_995_000;
const FIXED_NOWS = [NOW, LATER, ZERO_NOW];

/**
 * Ongeldige `now`-waarden voor de now-validatie van HOST_PAUSE. Ook deze zijn
 * vaste literals — testpunt 11 blijft gelden, er wordt nergens een klok gelezen.
 */
const STRING_NOW = 'gisteren';
const OBJECT_NOW = { t: 1 };
const INVALID_NOWS = [undefined, NaN, Infinity, STRING_NOW, OBJECT_NOW];

/**
 * @typedef {{ phase: string, pausedState: (object|null) }} MatchState
 * @typedef {{ ok: true, state: MatchState } | { ok: false, code: string }} Outcome
 * @typedef {{ description: string, fromState: MatchState, pacing: ('auto'|'host'),
 *   event: object, now: number, expected: Outcome,
 *   invalidPacing?: boolean, invalidNow?: boolean }} Fixture
 *
 * `invalidPacing` / `invalidNow` markeren rijen die de invoervalidatie van
 * respectievelijk `pacing` en `now` zélf testen en dus bewust buiten het normale
 * waardenbereik vallen. De meta-test onderaan laat ze alleen zo gemarkeerd toe.
 */

/** Bronstate met phase PAUSED en een gevulde pausedState (verse objecten per rij). */
function pausedFrom(previousPhase = 'ROUND_ACTIVE') {
  return {
    phase: 'PAUSED',
    pausedState: { previousPhase, remainingMs: 12_000, reason: 'host-pauze', pausedAt: PAUSED_AT },
  };
}

/** Verwachte geslaagde uitkomst. pausedState default null (invariant 1). */
function ok(phase, pausedState = null) {
  return { ok: true, state: { phase, pausedState } };
}

/** Verwachte PAUSED-uitkomst na HOST_PAUSE. */
function okPaused(previousPhase, remainingMs, reason, pausedAt) {
  return ok('PAUSED', { previousPhase, remainingMs, reason, pausedAt });
}

/** Verwachte afwijzing. */
function err(code) {
  return { ok: false, code };
}

/**
 * Bouwt één fixture-rij. `from` is een fase-string (pausedState: null) of een
 * volledige MatchState.
 * @returns {Fixture}
 */
function row(description, from, pacing, event, expected, now = NOW) {
  return {
    description,
    fromState: typeof from === 'string' ? { phase: from, pausedState: null } : from,
    pacing,
    event,
    now,
    expected,
  };
}

/**
 * Zoals `row`, maar markeert expliciet dat `pacing` bewust buiten `'auto'|'host'`
 * valt omdat de rij de pacing-validatie zelf test.
 * @returns {Fixture}
 */
function invalidPacingRow(description, from, pacing, event, expected, now = NOW) {
  return { ...row(description, from, pacing, event, expected, now), invalidPacing: true };
}

/**
 * Zoals `row`, maar markeert expliciet dat `now` bewust geen geldige tijdstempel is
 * omdat de rij de now-validatie zelf test. `now` wordt na `row` gezet zodat een
 * expliciete `undefined` niet in de default van `row` valt.
 * @returns {Fixture}
 */
function invalidNowRow(description, from, pacing, event, expected, now) {
  return { ...row(description, from, pacing, event, expected), now, invalidNow: true };
}

/** @type {Fixture[]} */
const FIXTURES = [
  // [1] Overgangstabel, de pacing-onafhankelijke rijen: beide pacingwaarden.
  row('LOBBY + HOST_START (auto) → COUNTDOWN', 'LOBBY', 'auto', { type: 'HOST_START' }, ok('COUNTDOWN')),
  row('LOBBY + HOST_START (host) → COUNTDOWN', 'LOBBY', 'host', { type: 'HOST_START' }, ok('COUNTDOWN')),
  row('COUNTDOWN + TIMER_ELAPSED (auto) → ROUND_ACTIVE', 'COUNTDOWN', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('COUNTDOWN + TIMER_ELAPSED (host) → ROUND_ACTIVE', 'COUNTDOWN', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('ROUND_ACTIVE + TIMER_ELAPSED (auto) → ROUND_RESULT', 'ROUND_ACTIVE', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, ok('ROUND_RESULT')),
  row('ROUND_ACTIVE + TIMER_ELAPSED (host) → ROUND_RESULT', 'ROUND_ACTIVE', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, ok('ROUND_RESULT')),

  // [2] Overgangstabel, de pacing-gevoelige rijen: elke toegestane nextPhase.
  // Tegelijk de losse takken: volgende ronde, laatste ronde, scoreboard overslaan.
  row('ROUND_RESULT + TIMER_ELAPSED (auto) → SCOREBOARD (tussenstand tonen)', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, ok('SCOREBOARD')),
  row('ROUND_RESULT + TIMER_ELAPSED (auto) → COUNTDOWN (scoreboard overslaan, volgende ronde)',
    'ROUND_RESULT', 'auto', { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('ROUND_RESULT + TIMER_ELAPSED (auto) → ROUND_ACTIVE (scoreboard én countdown overslaan)',
    'ROUND_RESULT', 'auto', { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('ROUND_RESULT + TIMER_ELAPSED (auto) → FINISHED (laatste ronde)', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'FINISHED' }, ok('FINISHED')),
  // Besluit 1 (docs/multiplayer/DECISIONS.md): bij host-tempo loopt ROUND_RESULT op
  // zijn timer door naar SCOREBOARD. Dat is de enige timer-bestemming bij host.
  row('ROUND_RESULT + TIMER_ELAPSED (host) → SCOREBOARD (besluit 1: uitslag loopt op de timer door)',
    'ROUND_RESULT', 'host', { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, ok('SCOREBOARD')),
  row('SCOREBOARD + TIMER_ELAPSED (auto) → COUNTDOWN (volgende ronde)', 'SCOREBOARD', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('SCOREBOARD + TIMER_ELAPSED (auto) → ROUND_ACTIVE (volgende ronde zonder countdown)',
    'SCOREBOARD', 'auto', { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('SCOREBOARD + TIMER_ELAPSED (auto) → FINISHED (laatste ronde)', 'SCOREBOARD', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'FINISHED' }, ok('FINISHED')),
  row('SCOREBOARD + HOST_NEXT (host) → COUNTDOWN (volgende ronde)', 'SCOREBOARD', 'host',
    { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('SCOREBOARD + HOST_NEXT (host) → ROUND_ACTIVE (volgende ronde zonder countdown)',
    'SCOREBOARD', 'host', { type: 'HOST_NEXT', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('SCOREBOARD + HOST_NEXT (host) → FINISHED (laatste ronde)', 'SCOREBOARD', 'host',
    { type: 'HOST_NEXT', nextPhase: 'FINISHED' }, ok('FINISHED')),

  // [3] Pacing-mismatch: verkeerd event voor het ingestelde tempo. Bij
  // ROUND_RESULT hangt dat per bestemming samen (besluit 1): TIMER_ELAPSED mag
  // bij host uitsluitend naar SCOREBOARD, en HOST_NEXT is er helemaal niet
  // geldig — de hostactie zit altijd bij SCOREBOARD (INT-10).
  row('ROUND_RESULT + HOST_NEXT bij pacing auto → afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('SCOREBOARD + HOST_NEXT bij pacing auto → afgewezen', 'SCOREBOARD', 'auto',
    { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + HOST_NEXT (host) → SCOREBOARD afgewezen (besluit 1: dat pad loopt op de timer)',
    'ROUND_RESULT', 'host', { type: 'HOST_NEXT', nextPhase: 'SCOREBOARD' }, err('INVALID_PHASE')),
  // ROUND_RESULT kent bij host-tempo geen enkele HOST_NEXT-bestemming: de host
  // handelt pas bij SCOREBOARD. Zie de regressietest voor INT-10 onderaan.
  row('ROUND_RESULT + HOST_NEXT (host) → COUNTDOWN afgewezen (hostactie zit bij SCOREBOARD)',
    'ROUND_RESULT', 'host', { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + HOST_NEXT (host) → ROUND_ACTIVE afgewezen (hostactie zit bij SCOREBOARD)',
    'ROUND_RESULT', 'host', { type: 'HOST_NEXT', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + HOST_NEXT (host) → FINISHED afgewezen (hostactie zit bij SCOREBOARD)',
    'ROUND_RESULT', 'host', { type: 'HOST_NEXT', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED (host) → COUNTDOWN afgewezen (host beslist over de volgende ronde)',
    'ROUND_RESULT', 'host', { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED (host) → ROUND_ACTIVE afgewezen', 'ROUND_RESULT', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED (host) → FINISHED afgewezen', 'ROUND_RESULT', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),
  row('SCOREBOARD + TIMER_ELAPSED bij pacing host → afgewezen', 'SCOREBOARD', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('COUNTDOWN is altijd timer-gedreven: HOST_NEXT (host) → afgewezen', 'COUNTDOWN', 'host',
    { type: 'HOST_NEXT', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('ROUND_ACTIVE is altijd timer-gedreven: HOST_NEXT (host) → afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_NEXT', nextPhase: 'ROUND_RESULT' }, err('INVALID_PHASE')),

  // [4] nextPhase buiten de toegestane set voor de betreffende rij.
  row('COUNTDOWN + TIMER_ELAPSED → SCOREBOARD is geen geldige bestemming', 'COUNTDOWN', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, err('INVALID_PHASE')),
  row('COUNTDOWN + TIMER_ELAPSED → COUNTDOWN (zelflus) is geen geldige bestemming', 'COUNTDOWN', 'host',
    { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('ROUND_ACTIVE + TIMER_ELAPSED → FINISHED is geen geldige bestemming', 'ROUND_ACTIVE', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED → ROUND_RESULT (zelflus) afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED → LOBBY afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'LOBBY' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + HOST_NEXT → PAUSED afgewezen', 'ROUND_RESULT', 'host',
    { type: 'HOST_NEXT', nextPhase: 'PAUSED' }, err('INVALID_PHASE')),
  row('SCOREBOARD + TIMER_ELAPSED → SCOREBOARD (zelflus) afgewezen', 'SCOREBOARD', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, err('INVALID_PHASE')),
  row('SCOREBOARD + TIMER_ELAPSED → ROUND_RESULT (terug) afgewezen', 'SCOREBOARD', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, err('INVALID_PHASE')),
  row('SCOREBOARD + HOST_NEXT → LOBBY afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_NEXT', nextPhase: 'LOBBY' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED met onbekende nextPhase-string afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'BOGUS_PHASE' }, err('INVALID_PHASE')),
  row('ROUND_RESULT + TIMER_ELAPSED zonder nextPhase afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'TIMER_ELAPSED' }, err('INVALID_PHASE')),
  row('LOBBY kent geen timer-overgang → afgewezen', 'LOBBY', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('FINISHED is eindfase: TIMER_ELAPSED afgewezen', 'FINISHED', 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('PAUSED accepteert geen TIMER_ELAPSED (alleen HOST_RESUME/HOST_FINISH)', pausedFrom(), 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('PAUSED accepteert geen HOST_NEXT (alleen HOST_RESUME/HOST_FINISH)', pausedFrom(), 'host',
    { type: 'HOST_NEXT', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),

  // [5] HOST_PAUSE: vier toegestane bronfasen, drie verboden, plus veldvalidatie.
  row('HOST_PAUSE vanuit COUNTDOWN', 'COUNTDOWN', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 },
    okPaused('COUNTDOWN', 3_000, 'host-pauze', NOW)),
  row('HOST_PAUSE vanuit ROUND_ACTIVE', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 8_500 },
    okPaused('ROUND_ACTIVE', 8_500, 'host-pauze', NOW)),
  row('HOST_PAUSE vanuit ROUND_RESULT', 'ROUND_RESULT', 'auto',
    { type: 'HOST_PAUSE', reason: 'disconnect', remainingMs: 1 },
    okPaused('ROUND_RESULT', 1, 'disconnect', NOW)),
  row('HOST_PAUSE vanuit SCOREBOARD', 'SCOREBOARD', 'host',
    { type: 'HOST_PAUSE', reason: 'pauze door host', remainingMs: 20_000 },
    okPaused('SCOREBOARD', 20_000, 'pauze door host', NOW)),
  row('HOST_PAUSE met remainingMs 0 is geldig (alleen < 0 wordt afgewezen)', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 0 },
    okPaused('ROUND_ACTIVE', 0, 'host-pauze', NOW)),
  row('HOST_PAUSE zet pausedAt op de meegegeven now (LATER)', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 4_200 },
    okPaused('ROUND_ACTIVE', 4_200, 'host-pauze', LATER), LATER),
  row('HOST_PAUSE zet pausedAt op now = 0 (falsy maar geldig)', 'COUNTDOWN', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 500 },
    okPaused('COUNTDOWN', 500, 'host-pauze', ZERO_NOW), ZERO_NOW),
  row('HOST_PAUSE vanuit LOBBY afgewezen', 'LOBBY', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PHASE')),
  row('HOST_PAUSE vanuit PAUSED afgewezen (geen dubbele pauze)', pausedFrom(), 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PHASE')),
  row('HOST_PAUSE vanuit FINISHED afgewezen', 'FINISHED', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PHASE')),
  row('HOST_PAUSE met negatieve remainingMs afgewezen', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: -1 }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs Infinity afgewezen', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: Infinity }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs -Infinity afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: -Infinity }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs NaN afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: NaN }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE zonder remainingMs afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze' }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met lege reason afgewezen', 'COUNTDOWN', 'auto',
    { type: 'HOST_PAUSE', reason: '', remainingMs: 3_000 }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE zonder reason afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', remainingMs: 3_000 }, err('INVALID_PAUSE_STATE')),

  // [6] HOST_RESUME: alleen vanuit PAUSED, alleen naar de vier speelfasen.
  row('HOST_RESUME → COUNTDOWN (herstel na restart), pausedState wordt null', pausedFrom('ROUND_ACTIVE'),
    'auto', { type: 'HOST_RESUME', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('HOST_RESUME → ROUND_ACTIVE (terug naar previousPhase)', pausedFrom('ROUND_ACTIVE'), 'host',
    { type: 'HOST_RESUME', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),
  row('HOST_RESUME → ROUND_RESULT wijkt af van previousPhase en is toegestaan',
    pausedFrom('ROUND_ACTIVE'), 'auto', { type: 'HOST_RESUME', nextPhase: 'ROUND_RESULT' },
    ok('ROUND_RESULT')),
  row('HOST_RESUME → SCOREBOARD', pausedFrom('SCOREBOARD'), 'host',
    { type: 'HOST_RESUME', nextPhase: 'SCOREBOARD' }, ok('SCOREBOARD')),
  row('HOST_RESUME → LOBBY afgewezen', pausedFrom(), 'auto',
    { type: 'HOST_RESUME', nextPhase: 'LOBBY' }, err('INVALID_PHASE')),
  row('HOST_RESUME → PAUSED afgewezen', pausedFrom(), 'host',
    { type: 'HOST_RESUME', nextPhase: 'PAUSED' }, err('INVALID_PHASE')),
  row('HOST_RESUME → FINISHED afgewezen (gebruik HOST_FINISH)', pausedFrom(), 'auto',
    { type: 'HOST_RESUME', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),
  row('HOST_RESUME met onbekende nextPhase-string afgewezen', pausedFrom(), 'host',
    { type: 'HOST_RESUME', nextPhase: 'BOGUS_PHASE' }, err('INVALID_PHASE')),
  row('HOST_RESUME zonder nextPhase afgewezen', pausedFrom(), 'auto',
    { type: 'HOST_RESUME' }, err('INVALID_PHASE')),
  row('HOST_RESUME vanuit ROUND_ACTIVE afgewezen (niet gepauzeerd)', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_RESUME', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('HOST_RESUME vanuit LOBBY afgewezen (niet gepauzeerd)', 'LOBBY', 'host',
    { type: 'HOST_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),

  // [6b] RECOVERY_RESUME (INT-16): alleen vanuit PAUSED en, anders dan
  // HOST_RESUME, uitsluitend naar COUNTDOWN. ARCHITECTURE.md §10 eist dat herstel
  // na een serverherstart met een nieuwe korte countdown gebeurt; de drie andere
  // speelfasen zijn daarom geen geldige bestemming. Precies die beperking is de
  // bestaansreden van het aparte event — zonder haar was het een synoniem.
  row('RECOVERY_RESUME → COUNTDOWN (nieuwe korte countdown, ARCHITECTURE.md §10)',
    pausedFrom('ROUND_ACTIVE'), 'auto', { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' },
    ok('COUNTDOWN')),
  row('RECOVERY_RESUME → COUNTDOWN slaagt ook bij host-tempo (tempo speelt geen rol bij hervatten)',
    pausedFrom('SCOREBOARD'), 'host', { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' },
    ok('COUNTDOWN')),
  row('RECOVERY_RESUME → COUNTDOWN vanuit een pauze met reden server_recovery (besluit 11)',
    { phase: 'PAUSED', pausedState: { previousPhase: 'ROUND_RESULT', remainingMs: 0,
      reason: 'server_recovery', pausedAt: PAUSED_AT } }, 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('RECOVERY_RESUME → ROUND_ACTIVE afgewezen (geen terugval midden in een ronde)',
    pausedFrom('ROUND_ACTIVE'), 'auto', { type: 'RECOVERY_RESUME', nextPhase: 'ROUND_ACTIVE' },
    err('INVALID_PHASE')),
  row('RECOVERY_RESUME → ROUND_RESULT afgewezen (fases overslaan mag niet stilletjes)',
    pausedFrom('ROUND_RESULT'), 'host', { type: 'RECOVERY_RESUME', nextPhase: 'ROUND_RESULT' },
    err('INVALID_PHASE')),
  row('RECOVERY_RESUME → SCOREBOARD afgewezen', pausedFrom('SCOREBOARD'), 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'SCOREBOARD' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME → LOBBY afgewezen', pausedFrom(), 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'LOBBY' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME → PAUSED afgewezen (zelflus)', pausedFrom(), 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'PAUSED' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME → FINISHED afgewezen (gebruik HOST_FINISH)', pausedFrom(), 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME met onbekende nextPhase-string afgewezen', pausedFrom(), 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'BOGUS_PHASE' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME met nextPhase "countdown" (kleine letters) afgewezen', pausedFrom(), 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'countdown' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME met nextPhase null afgewezen', pausedFrom(), 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: null }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME zonder nextPhase afgewezen', pausedFrom(), 'host',
    { type: 'RECOVERY_RESUME' }, err('INVALID_PHASE')),
  // Elke niet-PAUSED bronfase: de fase-guard gaat vóór de payload, dus zelfs de
  // enige geldige bestemming (COUNTDOWN) helpt hier niet.
  row('RECOVERY_RESUME vanuit LOBBY afgewezen (niet gepauzeerd)', 'LOBBY', 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME vanuit COUNTDOWN afgewezen (niet gepauzeerd)', 'COUNTDOWN', 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME vanuit ROUND_ACTIVE afgewezen (niet gepauzeerd)', 'ROUND_ACTIVE', 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME vanuit ROUND_RESULT afgewezen (niet gepauzeerd)', 'ROUND_RESULT', 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME vanuit SCOREBOARD afgewezen (niet gepauzeerd)', 'SCOREBOARD', 'auto',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  row('RECOVERY_RESUME vanuit FINISHED afgewezen (eindfase)', 'FINISHED', 'host',
    { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),

  // [7] HOST_FINISH: geldig vanuit elke fase behalve FINISHED.
  row('HOST_FINISH vanuit LOBBY', 'LOBBY', 'auto', { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit COUNTDOWN', 'COUNTDOWN', 'host', { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit ROUND_ACTIVE', 'ROUND_ACTIVE', 'auto', { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit ROUND_RESULT', 'ROUND_RESULT', 'host', { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit SCOREBOARD', 'SCOREBOARD', 'auto', { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit PAUSED wist pausedState (invariant 1)', pausedFrom(), 'host',
    { type: 'HOST_FINISH' }, ok('FINISHED')),
  row('HOST_FINISH vanuit FINISHED afgewezen', 'FINISHED', 'auto',
    { type: 'HOST_FINISH' }, err('INVALID_PHASE')),

  // [8] HOST_START: alleen vanuit LOBBY (succes staat in blok [1]).
  row('HOST_START vanuit COUNTDOWN afgewezen', 'COUNTDOWN', 'auto',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('HOST_START vanuit ROUND_ACTIVE afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('HOST_START vanuit ROUND_RESULT afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('HOST_START vanuit SCOREBOARD afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('HOST_START vanuit PAUSED afgewezen', pausedFrom(), 'auto',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('HOST_START vanuit FINISHED afgewezen', 'FINISHED', 'host',
    { type: 'HOST_START' }, err('INVALID_PHASE')),

  // [9] Onbekend event-type → UNSUPPORTED_EVENT, ongeacht de bronfase.
  row('Onbekend type vanuit LOBBY', 'LOBBY', 'auto',
    { type: 'GAME_NEXT' }, err('UNSUPPORTED_EVENT')),
  row('Onbekend type vanuit ROUND_ACTIVE', 'ROUND_ACTIVE', 'host',
    { type: 'PLAYER_ANSWER', answer: 'a' }, err('UNSUPPORTED_EVENT')),
  row('Onbekend type vanuit PAUSED', pausedFrom(), 'auto',
    { type: 'HOST_RESUMED', nextPhase: 'COUNTDOWN' }, err('UNSUPPORTED_EVENT')),
  row('Type is hoofdlettergevoelig: recovery_resume vanuit PAUSED', pausedFrom(), 'host',
    { type: 'recovery_resume', nextPhase: 'COUNTDOWN' }, err('UNSUPPORTED_EVENT')),
  row('Lege type-string vanuit FINISHED', 'FINISHED', 'host', { type: '' }, err('UNSUPPORTED_EVENT')),
  row('Event zonder type vanuit SCOREBOARD', 'SCOREBOARD', 'auto', {}, err('UNSUPPORTED_EVENT')),
  row('Type is hoofdlettergevoelig: host_start vanuit COUNTDOWN', 'COUNTDOWN', 'host',
    { type: 'host_start' }, err('UNSUPPORTED_EVENT')),

  // [10] Ongeldige of onbekende bronfase — de fase-guard zelf. Er wordt niet
  // getrimd, niet genormaliseerd naar hoofdletters en niet geraden; een state die
  // helemaal geen bruikbare `phase` heeft levert eveneens INVALID_PHASE op
  // (invariant 3: nooit een throw).
  row('Onbekende bronfase BOGUS + HOST_START afgewezen', { phase: 'BOGUS', pausedState: null }, 'auto',
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  row('Bronfase is hoofdlettergevoelig: countdown + TIMER_ELAPSED afgewezen',
    { phase: 'countdown', pausedState: null }, 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  row('Bronfase "ROUND_RESULT " met trailing spatie wordt niet getrimd → afgewezen',
    { phase: 'ROUND_RESULT ', pausedState: null }, 'auto',
    { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, err('INVALID_PHASE')),
  row('Bronfase null + HOST_FINISH afgewezen', { phase: null, pausedState: null }, 'host',
    { type: 'HOST_FINISH' }, err('INVALID_PHASE')),
  row('Bronstate null + HOST_FINISH afgewezen zonder throw', null, 'auto',
    { type: 'HOST_FINISH' }, err('INVALID_PHASE')),
  row('Bronstate zonder phase-veld + HOST_PAUSE valt op de fase, niet op de payload', {}, 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PHASE')),
  row('Bronstate is een array + HOST_RESUME afgewezen', [], 'auto',
    { type: 'HOST_RESUME', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),

  // [11] Volgorde van de poorten: het event-alfabet gaat vóór de fasecheck, dus
  // een dubbel ongeldige invoer levert UNSUPPORTED_EVENT op, niet INVALID_PHASE.
  row('Onbekend type én onbekende fase → UNSUPPORTED_EVENT (event gaat vóór fase)',
    { phase: 'BOGUS', pausedState: null }, 'auto', { type: 'NIET_BESTAAND' },
    err('UNSUPPORTED_EVENT')),
  row('Onbekend type én bronstate null → UNSUPPORTED_EVENT (geen throw)', null, 'host',
    { type: 'host_pause', reason: 'host-pauze', remainingMs: 3_000 }, err('UNSUPPORTED_EVENT')),
  row('Event zonder type én bronfase null → UNSUPPORTED_EVENT',
    { phase: null, pausedState: null }, 'auto', {}, err('UNSUPPORTED_EVENT')),

  // [12] remainingMs met een niet-numeriek type — realistische socket-JSON.
  row('HOST_PAUSE met remainingMs als string "3000" afgewezen', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: '3000' }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs null afgewezen', 'COUNTDOWN', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: null }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs true afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: true }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs als object afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: {} }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met remainingMs als lege array afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: [] }, err('INVALID_PAUSE_STATE')),

  // [13] Dubbel ongeldige pauze: binnen HOST_PAUSE wint de verboden bronfase van
  // de ongeldige payload (eerst fase, dan pas de velden).
  row('HOST_PAUSE vanuit LOBBY met remainingMs -1 → INVALID_PHASE (fase vóór payload)', 'LOBBY', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: -1 }, err('INVALID_PHASE')),
  row('HOST_PAUSE vanuit PAUSED met lege reason → INVALID_PHASE (fase vóór payload)', pausedFrom(), 'host',
    { type: 'HOST_PAUSE', reason: '', remainingMs: 3_000 }, err('INVALID_PHASE')),
  row('HOST_PAUSE vanuit FINISHED met lege reason én remainingMs -1 → INVALID_PHASE', 'FINISHED', 'auto',
    { type: 'HOST_PAUSE', reason: '', remainingMs: -1 }, err('INVALID_PHASE')),

  // [14] HOST_START met een expliciete nextPhase in het event.
  row('HOST_START met expliciete nextPhase COUNTDOWN vanuit LOBBY slaagt', 'LOBBY', 'auto',
    { type: 'HOST_START', nextPhase: 'COUNTDOWN' }, ok('COUNTDOWN')),
  row('HOST_START met nextPhase FINISHED vanuit LOBBY afgewezen', 'LOBBY', 'host',
    { type: 'HOST_START', nextPhase: 'FINISHED' }, err('INVALID_PHASE')),

  // [15] Randgevallen van reason: witruimte telt niet als inhoud, maar een geldige
  // reason wordt letterlijk bewaard — de reducer trimt niet.
  row('HOST_PAUSE met reason van alleen witruimte afgewezen', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: '   ', remainingMs: 3_000 }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE bewaart reason letterlijk, inclusief omringende spaties', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', reason: ' host-pauze ', remainingMs: 3_000 },
    okPaused('ROUND_ACTIVE', 3_000, ' host-pauze ', NOW)),
  row('HOST_PAUSE met numerieke reason 42 afgewezen', 'COUNTDOWN', 'auto',
    { type: 'HOST_PAUSE', reason: 42, remainingMs: 3_000 }, err('INVALID_PAUSE_STATE')),
  row('HOST_PAUSE met reason null afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_PAUSE', reason: null, remainingMs: 3_000 }, err('INVALID_PAUSE_STATE')),

  // [16] Inconsistente bronstate: phase PAUSED zonder pausedState. Deze rij legt
  // het huidige gedrag vast — HOST_RESUME leest pausedState niet — als bewust
  // vastgelegd gedrag, niet als eis uit de spec.
  row('HOST_RESUME vanuit PAUSED zonder pausedState slaagt (vastgelegd gedrag, geen spec-eis)',
    { phase: 'PAUSED', pausedState: null }, 'auto',
    { type: 'HOST_RESUME', nextPhase: 'ROUND_ACTIVE' }, ok('ROUND_ACTIVE')),

  // [17] `now` moet bij HOST_PAUSE een eindig getal zijn. Alleen HOST_PAUSE
  // gebruikt now; de andere events raken hem niet aan en valideren hem dus ook niet.
  invalidNowRow('HOST_PAUSE met now undefined afgewezen', 'ROUND_ACTIVE', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 },
    err('INVALID_PAUSE_STATE'), undefined),
  invalidNowRow('HOST_PAUSE met now NaN afgewezen', 'COUNTDOWN', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PAUSE_STATE'), NaN),
  invalidNowRow('HOST_PAUSE met now Infinity afgewezen', 'ROUND_RESULT', 'auto',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PAUSE_STATE'), Infinity),
  invalidNowRow('HOST_PAUSE met now als string "gisteren" afgewezen', 'SCOREBOARD', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 },
    err('INVALID_PAUSE_STATE'), STRING_NOW),
  invalidNowRow('HOST_PAUSE met now als object afgewezen', 'ROUND_ACTIVE', 'host',
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 },
    err('INVALID_PAUSE_STATE'), OBJECT_NOW),
  invalidNowRow('TIMER_ELAPSED negeert een ongeldige now (alleen HOST_PAUSE valideert hem)',
    'ROUND_ACTIVE', 'auto', { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' },
    ok('ROUND_RESULT'), undefined),
  invalidNowRow('HOST_FINISH negeert een ongeldige now', 'SCOREBOARD', 'host',
    { type: 'HOST_FINISH' }, ok('FINISHED'), NaN),

  // [18] `pacing` wordt globaal gevalideerd tegen 'auto' | 'host', ongeacht event
  // of fase — verspreid over alle zeven event-types. Het event-alfabet blijft de
  // buitenste poort, ook vóór de pacing-check.
  invalidPacingRow('Pacing undefined + HOST_START → INVALID_PHASE', 'LOBBY', undefined,
    { type: 'HOST_START' }, err('INVALID_PHASE')),
  invalidPacingRow('Pacing null + HOST_FINISH → INVALID_PHASE', 'ROUND_ACTIVE', null,
    { type: 'HOST_FINISH' }, err('INVALID_PHASE')),
  invalidPacingRow('Pacing "AUTO" (hoofdletters) + TIMER_ELAPSED → INVALID_PHASE', 'COUNTDOWN', 'AUTO',
    { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  invalidPacingRow('Pacing "Auto" + HOST_RESUME → INVALID_PHASE', pausedFrom(), 'Auto',
    { type: 'HOST_RESUME', nextPhase: 'ROUND_ACTIVE' }, err('INVALID_PHASE')),
  // Bronfase PAUSED met de enige geldige bestemming: met een geldige pacing zou
  // deze rij slagen, dus faalt hij echt op de pacing-validatie.
  invalidPacingRow('Pacing "host " (trailing spatie) + RECOVERY_RESUME → INVALID_PHASE',
    pausedFrom(), 'host ', { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' },
    err('INVALID_PHASE')),
  invalidPacingRow('Pacing 42 + HOST_PAUSE met geldige payload → INVALID_PHASE', 'ROUND_ACTIVE', 42,
    { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 3_000 }, err('INVALID_PHASE')),
  // Bronfase SCOREBOARD, want dat is de enige HOST_NEXT-bron: met pacing 'host'
  // zou deze rij slagen, dus faalt hij echt op de pacing-validatie en niet op de
  // tabel.
  invalidPacingRow('Pacing "HOST" (hoofdletters) + HOST_NEXT → INVALID_PHASE', 'SCOREBOARD', 'HOST',
    { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, err('INVALID_PHASE')),
  invalidPacingRow('Ongeldige pacing + onbekend event-type → UNSUPPORTED_EVENT (event vóór pacing)',
    'LOBBY', 'AUTO', { type: 'GAME_START' }, err('UNSUPPORTED_EVENT')),
];

test('overgangstabel en randgevallen (fixture-set)', async (t) => {
  for (const fixture of FIXTURES) {
    await t.test(fixture.description, () => {
      const before = structuredClone(fixture.fromState);
      const result = transition(fixture.fromState, fixture.event, fixture.pacing, fixture.now);

      // Exacte verwachting: fase én pausedState, of exacte foutcode (invarianten 3-5).
      assert.deepStrictEqual(result, fixture.expected);

      // Invariant 2 geldt voor elke rij, geslaagd of afgewezen.
      assert.deepStrictEqual(fixture.fromState, before, 'transition mag de invoerstate niet muteren');

      if (result.ok) {
        assert.notStrictEqual(result.state, fixture.fromState, 'succes moet een nieuw object opleveren');
      }
    });
  }
});

/**
 * Speelt een reeks events af bij `pacing: "host"` en telt de hostacties. Elke stap
 * moet slagen; de nieuwe state is de bron van de volgende stap.
 * @param {MatchState} startState
 * @param {Array<{ event: object, expectedPhase: string }>} steps
 * @returns {{ state: MatchState, hostActions: number }}
 */
function playHostSteps(startState, steps) {
  let state = startState;
  let hostActions = 0;

  for (const step of steps) {
    const result = transition(state, step.event, 'host', NOW);
    assert.deepStrictEqual(result, ok(step.expectedPhase),
      `${state.phase} + ${step.event.type} → ${step.expectedPhase}`);
    if (step.event.type === 'HOST_NEXT') {
      hostActions += 1;
    }
    state = result.state;
  }

  return { state, hostActions };
}

// Besluit 1 (docs/multiplayer/DECISIONS.md): host-tempo kent precies één hostactie
// per ronde, en die zit altijd bij SCOREBOARD — onafhankelijk van
// GameConfiguration.scoreboardFrequency.
test('scenario host-tempo MET tussenstand: de enige hostactie zit bij SCOREBOARD', () => {
  const { state, hostActions } = playHostSteps({ phase: 'LOBBY', pausedState: null }, [
    { event: { type: 'HOST_START' }, expectedPhase: 'COUNTDOWN' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, expectedPhase: 'ROUND_ACTIVE' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, expectedPhase: 'ROUND_RESULT' },
    // Besluit 1: de uitslag loopt op zijn timer door naar de tussenstand.
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, expectedPhase: 'SCOREBOARD' },
    // "Volgende": de enige hostactie van deze ronde.
    { event: { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, expectedPhase: 'COUNTDOWN' },
  ]);

  assert.strictEqual(state.phase, 'COUNTDOWN', 'de ronde eindigt in de countdown van de volgende ronde');
  assert.strictEqual(hostActions, 1, 'precies één HOST_NEXT in de hele ronde');

  // De tussenstand wacht echt op de host: hij loopt bij host-tempo niet op de timer door.
  assert.deepStrictEqual(
    transition({ phase: 'SCOREBOARD', pausedState: null },
      { type: 'TIMER_ELAPSED', nextPhase: 'COUNTDOWN' }, 'host', NOW),
    err('INVALID_PHASE'));
});

// De configuratie kan de tussenstand uitzetten, maar niet de fase: bij host-tempo
// is SCOREBOARD de enige plek waar de host kan handelen, dus komt élke ronde er
// langs. `scoreboardFrequency: 'uit'` betekent "toon geen tussenstand", niet "sla
// de fase over" — zie aanname 2 in de modulekop en INT-10.
test('scenario host-tempo: elke ronde loopt via SCOREBOARD en kost precies één HOST_NEXT', () => {
  const { state, hostActions } = playHostSteps({ phase: 'LOBBY', pausedState: null }, [
    { event: { type: 'HOST_START' }, expectedPhase: 'COUNTDOWN' },
    // Ronde 1.
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, expectedPhase: 'ROUND_ACTIVE' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, expectedPhase: 'ROUND_RESULT' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, expectedPhase: 'SCOREBOARD' },
    { event: { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, expectedPhase: 'COUNTDOWN' },
    // Ronde 2 — dezelfde keten, ook in een configuratie die de tussenstand niet toont.
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_ACTIVE' }, expectedPhase: 'ROUND_ACTIVE' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, expectedPhase: 'ROUND_RESULT' },
    { event: { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, expectedPhase: 'SCOREBOARD' },
    // Laatste ronde: dezelfde hostactie op dezelfde plek, alleen een andere bestemming.
    { event: { type: 'HOST_NEXT', nextPhase: 'FINISHED' }, expectedPhase: 'FINISHED' },
  ]);

  assert.strictEqual(state.phase, 'FINISHED', 'de match eindigt na de laatste hostactie');
  assert.strictEqual(hostActions, 2, 'precies één HOST_NEXT per ronde, twee rondes');

  // Er is geen route die SCOREBOARD overslaat: vanuit de uitslag weigert host-tempo
  // zowel de timer als de hostactie naar de volgende ronde of het einde.
  for (const nextPhase of ['COUNTDOWN', 'ROUND_ACTIVE', 'FINISHED']) {
    for (const type of ['TIMER_ELAPSED', 'HOST_NEXT']) {
      assert.deepStrictEqual(
        transition({ phase: 'ROUND_RESULT', pausedState: null }, { type, nextPhase }, 'host', NOW),
        err('INVALID_PHASE'),
        `ROUND_RESULT + ${type} → ${nextPhase} mag bij host-tempo niet bestaan`);
    }
  }
});

// REGRESSIE INT-10 (docs/integration-plan/HANDOFF.md). Deze module accepteerde ooit
// HOST_NEXT vanuit ROUND_RESULT bij host-tempo, terwijl
// client/flow/host-controls-state.mjs de hostactie 'next' uitsluitend bij SCOREBOARD
// aanbiedt (WAITING_PHASES). Met de tussenstand uit hing de match daardoor in
// ROUND_RESULT: de server wachtte op een actie die nooit kwam en weigerde de timer.
// Zet die tak niet terug — deze test faalt dan meteen.
test('regressie INT-10: ROUND_RESULT + HOST_NEXT bestaat niet bij host-tempo (deadlock met de client)', () => {
  for (const nextPhase of ['COUNTDOWN', 'ROUND_ACTIVE', 'FINISHED', 'SCOREBOARD']) {
    assert.deepStrictEqual(
      transition({ phase: 'ROUND_RESULT', pausedState: null },
        { type: 'HOST_NEXT', nextPhase }, 'host', NOW),
      err('INVALID_PHASE'),
      `ROUND_RESULT + HOST_NEXT → ${nextPhase} moet afgewezen blijven (INT-10)`);
  }

  // De keten die de client wél aanbiedt moet blijven werken, anders is de deadlock
  // alleen verplaatst.
  assert.deepStrictEqual(
    transition({ phase: 'ROUND_RESULT', pausedState: null },
      { type: 'TIMER_ELAPSED', nextPhase: 'SCOREBOARD' }, 'host', NOW),
    ok('SCOREBOARD'));
  assert.deepStrictEqual(
    transition({ phase: 'SCOREBOARD', pausedState: null },
      { type: 'HOST_NEXT', nextPhase: 'COUNTDOWN' }, 'host', NOW),
    ok('COUNTDOWN'));
});

// INT-16 (docs/integration-plan/HANDOFF.md): HOST_RESUME en RECOVERY_RESUME zijn
// géén synoniemen. Dezelfde PAUSED-state, dezelfde gevraagde bestemming, twee
// verschillende uitkomsten — dát is de reden dat het twee events zijn en niet één
// event met een `reason`-veld. Verdwijnt dit verschil, dan is de splitsing zinloos
// geworden en faalt deze test terecht.
test('INT-16: RECOVERY_RESUME mag alleen naar COUNTDOWN, HOST_RESUME ook terug naar previousPhase', () => {
  const paused = () => ({
    phase: 'PAUSED',
    pausedState: {
      previousPhase: 'ROUND_ACTIVE',
      remainingMs: 12_000,
      reason: 'server_recovery',
      pausedAt: PAUSED_AT,
    },
  });

  // Een host hervat waar hij gebleven was: terug naar de lopende ronde.
  const hostBack = transition(paused(), { type: 'HOST_RESUME', nextPhase: 'ROUND_ACTIVE' }, 'auto', NOW);
  assert.deepStrictEqual(hostBack, ok('ROUND_ACTIVE'),
    'HOST_RESUME naar previousPhase blijft toegestaan');

  // Herstel na een serverherstart mag dat juist niet: ARCHITECTURE.md §10 eist een
  // nieuwe korte countdown in plaats van stilletjes terugvallen in de ronde.
  assert.deepStrictEqual(
    transition(paused(), { type: 'RECOVERY_RESUME', nextPhase: 'ROUND_ACTIVE' }, 'auto', NOW),
    err('INVALID_PHASE'),
    'RECOVERY_RESUME naar previousPhase moet worden afgewezen');

  // ...en de route die §10 wél voorschrijft slaagt.
  const recovered = transition(paused(), { type: 'RECOVERY_RESUME', nextPhase: 'COUNTDOWN' }, 'auto', NOW);
  assert.deepStrictEqual(recovered, ok('COUNTDOWN'),
    'RECOVERY_RESUME naar COUNTDOWN is de enige toegestane hersteltransitie');

  // Invariant 1 voor beide events: de pauze is weg, niet half blijven staan.
  assert.strictEqual(hostBack.state.pausedState, null, 'HOST_RESUME wist pausedState');
  assert.strictEqual(recovered.state.pausedState, null, 'RECOVERY_RESUME wist pausedState');

  // De overige drie speelfasen scheiden de twee events op dezelfde manier: geldig
  // voor HOST_RESUME, afgewezen voor RECOVERY_RESUME.
  for (const nextPhase of ['ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD']) {
    assert.strictEqual(
      transition(paused(), { type: 'HOST_RESUME', nextPhase }, 'host', NOW).ok, true,
      `HOST_RESUME → ${nextPhase} blijft toegestaan`);
    assert.deepStrictEqual(
      transition(paused(), { type: 'RECOVERY_RESUME', nextPhase }, 'host', NOW),
      err('INVALID_PHASE'),
      `RECOVERY_RESUME → ${nextPhase} mag niet bestaan (ARCHITECTURE.md §10)`);
  }
});

test('afgewezen transitie laat het originele state-object volledig ongewijzigd', () => {
  const original = {
    phase: 'PAUSED',
    pausedState: {
      previousPhase: 'ROUND_ACTIVE',
      remainingMs: 12_000,
      reason: 'host-pauze',
      pausedAt: PAUSED_AT,
    },
  };
  const snapshot = structuredClone(original);
  const nestedRef = original.pausedState;

  const result = transition(original, { type: 'HOST_RESUME', nextPhase: 'FINISHED' }, 'host', NOW);

  assert.deepStrictEqual(result, { ok: false, code: 'INVALID_PHASE' });
  assert.deepStrictEqual(original, snapshot, 'deep-equal vóór en na de afwijzing');
  assert.strictEqual(original.pausedState, nestedRef, 'genest object niet vervangen');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'state'), false);
});

test('geslaagde transitie geeft een nieuw state-object terug, niet de bron', () => {
  const original = { phase: 'ROUND_ACTIVE', pausedState: null };
  const snapshot = structuredClone(original);

  const result = transition(original, { type: 'TIMER_ELAPSED', nextPhase: 'ROUND_RESULT' }, 'auto', NOW);

  assert.deepStrictEqual(result, { ok: true, state: { phase: 'ROUND_RESULT', pausedState: null } });
  assert.notStrictEqual(result.state, original, 'returnwaarde mag niet hetzelfde object zijn');
  assert.deepStrictEqual(original, snapshot, 'bronstate ongewijzigd');
});

test('HOST_PAUSE kopieert de eventvelden in plaats van het event te aliasen', () => {
  const event = { type: 'HOST_PAUSE', reason: 'host-pauze', remainingMs: 7_000 };
  const eventSnapshot = structuredClone(event);

  const result = transition({ phase: 'ROUND_ACTIVE', pausedState: null }, event, 'auto', NOW);

  assert.deepStrictEqual(result, {
    ok: true,
    state: {
      phase: 'PAUSED',
      pausedState: {
        previousPhase: 'ROUND_ACTIVE',
        remainingMs: 7_000,
        reason: 'host-pauze',
        pausedAt: NOW,
      },
    },
  });
  assert.notStrictEqual(result.state.pausedState, event, 'pausedState mag niet het event zelf zijn');
  assert.deepStrictEqual(event, eventSnapshot, 'het event blijft ongewijzigd');
});

// Meta-tests op de fixture-set zelf: bewaken de eisen aan de suite.
test('meta: elke fixture heeft een exacte verwachting en een vaste now', () => {
  assert.ok(FIXTURES.length > 0);
  const seen = new Set();

  for (const fixture of FIXTURES) {
    // `now` blijft altijd een vaste literal (testpunt 11). Rijen die de
    // now-validatie zélf testen zijn gemarkeerd en moeten hun waarde uit de
    // eveneens vaste INVALID_NOWS-lijst halen — nooit uit een klok.
    if (fixture.invalidNow) {
      assert.ok(INVALID_NOWS.includes(fixture.now),
        `gemarkeerde ongeldige now moet uit INVALID_NOWS komen: ${fixture.description}`);
    } else {
      assert.ok(FIXED_NOWS.includes(fixture.now), `now moet een vaste literal zijn: ${fixture.description}`);
    }

    // Idem voor pacing: alleen expliciet gemarkeerde rijen mogen buiten
    // 'auto'|'host' vallen, en die markering moet dan ook kloppen.
    if (fixture.invalidPacing) {
      assert.strictEqual(['auto', 'host'].includes(fixture.pacing), false,
        `invalidPacing-rij moet echt een ongeldige pacing hebben: ${fixture.description}`);
    } else {
      assert.ok(['auto', 'host'].includes(fixture.pacing), fixture.description);
    }
    assert.strictEqual(seen.has(fixture.description), false, `dubbele description: ${fixture.description}`);
    seen.add(fixture.description);

    if (fixture.expected.ok) {
      // Invariant 1 moet al in de verwachting zelf zijn vastgelegd.
      assert.strictEqual(typeof fixture.expected.state.phase, 'string', fixture.description);
      if (fixture.expected.state.phase !== 'PAUSED') {
        assert.strictEqual(fixture.expected.state.pausedState, null, fixture.description);
      } else {
        assert.notStrictEqual(fixture.expected.state.pausedState, null, fixture.description);
      }
    } else {
      assert.strictEqual(typeof fixture.expected.code, 'string', fixture.description);
    }
  }
});
