import test from 'node:test';
import assert from 'node:assert/strict';
import { standingsFrom, podiumTop3 } from './standings-model.mjs';

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

test('geen eigen ranking: volgorde van de payload wordt nooit hersorteerd', () => {
  const shuffled = [TOP[2], TOP[0], TOP[1]];
  const s = standingsFrom({ top: shuffled, self: null });
  assert.deepEqual(s.entries.map((e) => e.playerId), ['p3', 'p1', 'p2']);
});
