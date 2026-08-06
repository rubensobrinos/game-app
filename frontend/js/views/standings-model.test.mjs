import test from 'node:test';
import assert from 'node:assert/strict';
import { standingsFrom, podiumTop3, rankMovementFrom } from './standings-model.mjs';

const TOP = [
  { playerId: 'p1', effectiveName: 'Vlugge Vos', score: 1200 },
  { playerId: 'p2', effectiveName: 'Ruben', score: 1100 },
  { playerId: 'p3', effectiveName: 'Sanne 2', score: 900 },
];

test('scoreboard:updated → posities in payloadvolgorde, self gemarkeerd', () => {
  const s = standingsFrom({ top: TOP, self: { playerId: 'p2', effectiveName: 'Ruben', score: 1100 } });
  assert.equal(s.entries.length, 3);
  assert.deepEqual(s.entries.map((e) => e.position), [1, 2, 3]);
  assert.equal(s.entries[1].isSelf, true);
  assert.equal(s.self.position, 2);
});

test('game:finished → podium-key werkt identiek; top 3 afgekapt', () => {
  const four = [...TOP, { playerId: 'p4', effectiveName: 'D', score: 100 }];
  const s = standingsFrom({ podium: four, self: { playerId: 'p4', effectiveName: 'D', score: 100 } });
  assert.equal(s.entries.length, 4);
  assert.equal(podiumTop3(s).length, 3);
  // self buiten de meegegeven lijst-top? position is dan de echte index in de lijst
  assert.equal(s.self.position, 4);
});

test('self buiten de top: positie null, gegevens uit self-payload', () => {
  const s = standingsFrom({ top: TOP, self: { playerId: 'p9', effectiveName: 'Laatkomer', score: 0 } });
  assert.equal(s.self.position, null);
  assert.equal(s.self.effectiveName, 'Laatkomer');
});

test('host zonder spelersrol (self: null) en rommelige rijen breken niets', () => {
  const s = standingsFrom({ top: [...TOP, { nonsense: true }, null], self: null });
  assert.equal(s.entries.length, 3);
  assert.equal(s.self, null);
  const empty = standingsFrom(undefined);
  assert.deepEqual(empty.entries, []);
  assert.equal(empty.self, null);
});

test('spelersidentiteit.md stap 5: identity reist mee als paar, niet als gerenderde tekst', () => {
  const rows = [
    { playerId: 'p1', effectiveName: 'Bulgaarse Koe', identity: { country: 'bg', word: 'cow' }, score: 1200 },
    { playerId: 'p2', effectiveName: 'Ruben', identity: null, score: 1100 },
  ];
  const s = standingsFrom({ top: rows, self: { playerId: 'p1', effectiveName: 'Bulgaarse Koe', identity: { country: 'bg', word: 'cow' }, score: 1200 } });
  assert.deepEqual(s.entries[0].identity, { country: 'bg', word: 'cow' });
  assert.equal(s.entries[1].identity, null);
  assert.deepEqual(s.self.identity, { country: 'bg', word: 'cow' });
});

test('een rij zonder identity-veld (oudere server) krijgt null, geen crash', () => {
  const s = standingsFrom({ top: TOP, self: { playerId: 'p2', effectiveName: 'Ruben', score: 1100 } });
  assert.equal(s.entries[0].identity, null);
  assert.equal(s.self.identity, null);
});

test('geen eigen ranking: volgorde van de payload wordt nooit hersorteerd', () => {
  const shuffled = [TOP[2], TOP[0], TOP[1]];
  const s = standingsFrom({ top: shuffled, self: null });
  assert.deepEqual(s.entries.map((e) => e.playerId), ['p3', 'p1', 'p2']);
});

test('rankMovementFrom: null vorige stand geeft een lege Map (bv. eerste ronde)', () => {
  const current = standingsFrom({ top: TOP, self: null });
  const movement = rankMovementFrom(null, current);
  assert.equal(movement.size, 0);
});

test('rankMovementFrom: p3 stijgt van 3 naar 1, p1 daalt van 1 naar 3, p2 blijft gelijk', () => {
  const previous = standingsFrom({ top: TOP, self: null });
  const shuffled = [TOP[2], TOP[1], TOP[0]];
  const current = standingsFrom({ top: shuffled, self: null });
  const movement = rankMovementFrom(previous, current);
  assert.equal(movement.get('p3'), 2); // was 3, nu 1 -> +2
  assert.equal(movement.get('p1'), -2); // was 1, nu 3 -> -2
  assert.equal(movement.get('p2'), 0); // was 2, nu 2 -> 0
});

test('rankMovementFrom: een nieuwe speler zonder vorige positie krijgt geen entry', () => {
  const previous = standingsFrom({ top: TOP.slice(0, 2), self: null });
  const current = standingsFrom({ top: TOP, self: null });
  const movement = rankMovementFrom(previous, current);
  assert.equal(movement.has('p3'), false);
  assert.equal(movement.get('p1'), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// §A3 (5 aug 2026) — de positie komt van de server. Dit model telde 'm zelf op
// uit de rijvolgorde, waardoor een gelijke stand er hier als 1-2-3-4 uitzag
// terwijl de server 1-2-2-4 stuurde.
// ─────────────────────────────────────────────────────────────────────────────

const TIE_TOP = [
  { playerId: 'p1', effectiveName: 'Vos', score: 1200, rank: 1 },
  { playerId: 'p2', effectiveName: 'Ruben', score: 1100, rank: 2 },
  { playerId: 'p3', effectiveName: 'Sanne', score: 1100, rank: 2 },
  { playerId: 'p4', effectiveName: 'Dirk', score: 300, rank: 4 },
];

test('§A3: een gedeelde plaats uit de tussenstand blijft gedeeld (1-2-2-4)', () => {
  const s = standingsFrom({ top: TIE_TOP, self: { playerId: 'p3', effectiveName: 'Sanne', score: 1100, position: 2 } });
  assert.deepEqual(s.entries.map((e) => e.position), [1, 2, 2, 4]);
  assert.equal(s.self.position, 2, 'de eigen regel toont dezelfde gedeelde plaats');
});

test('§A3: de eindstand gebruikt `position` en wordt net zo overgenomen', () => {
  const podium = TIE_TOP.map(({ rank, ...rest }) => ({ ...rest, position: rank }));
  const s = standingsFrom({ podium, self: { playerId: 'p2', effectiveName: 'Ruben', score: 1100, position: 2 } });
  assert.deepEqual(s.entries.map((e) => e.position), [1, 2, 2, 4]);
  assert.equal(s.self.position, 2);
});

test('§A3: de server wint van de rijvolgorde, ook als die twee uit elkaar lopen', () => {
  const s = standingsFrom({ top: [{ playerId: 'p9', effectiveName: 'Negen', score: 10, rank: 9 }], self: null });
  assert.equal(s.entries[0].position, 9, 'rij 1 met rank 9 blijft #9 — de speler staat buiten de top');
});

test('§A3: de eigen positie uit de self-payload wint van wat er in de toplijst staat', () => {
  // De server stuurt de eigen positie ook mee als je buiten de top vijf valt.
  const s = standingsFrom({ top: TIE_TOP, self: { playerId: 'p12', effectiveName: 'Laat', score: 0, position: 12 } });
  assert.equal(s.self.position, 12);
});

test('§A3: zonder rang van de server valt het model terug op de rijvolgorde', () => {
  // Oudere server of onvolledige payload: liever een leesbare lijst dan niets.
  const s = standingsFrom({ top: TOP, self: null });
  assert.deepEqual(s.entries.map((e) => e.position), [1, 2, 3]);
});
