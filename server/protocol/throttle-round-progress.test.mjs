import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throttleRoundProgress } from './throttle-round-progress.mjs';

/**
 * Simpele in-memory fake `ThrottleStore` voor tests. `throttleRoundProgress`
 * zelf muteert de store niet (Rij 44) — deze fake simuleert de aanroeper die
 * het teruggegeven record wél zelf terugschrijft, zoals de JSDoc voorschrijft.
 * @returns {{ get(roundId: string): { emittedAtMs: number[] } | undefined, set(roundId: string, record: { emittedAtMs: number[] }): void }}
 */
function createFakeStore() {
  const recordsByRoundId = new Map();
  return {
    get: (roundId) => recordsByRoundId.get(roundId),
    set: (roundId, record) => recordsByRoundId.set(roundId, record),
  };
}

// Rij 40
test('throttleRoundProgress: twee aanroepen binnen 1000ms voor dezelfde ronde → beide allow:true', () => {
  const store = createFakeStore();

  const first = throttleRoundProgress(store, 'round_07', 1000);
  assert.equal(first.allow, true);
  store.set('round_07', first.record);

  const second = throttleRoundProgress(store, 'round_07', 1200);
  assert.equal(second.allow, true);
  store.set('round_07', second.record);
});

// Rij 41
test('throttleRoundProgress: derde aanroep binnen hetzelfde venster → allow:false', () => {
  const store = createFakeStore();

  const first = throttleRoundProgress(store, 'round_07', 1000);
  store.set('round_07', first.record);
  const second = throttleRoundProgress(store, 'round_07', 1200);
  store.set('round_07', second.record);

  const third = throttleRoundProgress(store, 'round_07', 1400);
  assert.deepEqual(third, { allow: false });
});

// Rij 42
test('throttleRoundProgress: aanroep net ná het verstrijken van het venster → allow:true', () => {
  const store = createFakeStore();

  const first = throttleRoundProgress(store, 'round_07', 0);
  assert.equal(first.allow, true);
  store.set('round_07', first.record);

  // now - 1000 = 1, en de eerdere emissie op t=0 is niet > 1 → buiten venster.
  const afterWindow = throttleRoundProgress(store, 'round_07', 1001);
  assert.equal(afterWindow.allow, true);
});

// Rij 43
test('throttleRoundProgress: twee verschillende roundId\'s tellen onafhankelijk, elk tot 2x allow:true', () => {
  const store = createFakeStore();

  const roundAFirst = throttleRoundProgress(store, 'round_A', 100);
  assert.equal(roundAFirst.allow, true);
  store.set('round_A', roundAFirst.record);

  const roundBFirst = throttleRoundProgress(store, 'round_B', 100);
  assert.equal(roundBFirst.allow, true);
  store.set('round_B', roundBFirst.record);

  const roundASecond = throttleRoundProgress(store, 'round_A', 200);
  assert.equal(roundASecond.allow, true);
  store.set('round_A', roundASecond.record);

  const roundBSecond = throttleRoundProgress(store, 'round_B', 200);
  assert.equal(roundBSecond.allow, true);
  store.set('round_B', roundBSecond.record);

  // Beide rondes zitten nu op 2 emissies binnen hun eigen venster → derde
  // aanroep voor elk wordt onafhankelijk geweigerd.
  const roundAThird = throttleRoundProgress(store, 'round_A', 300);
  assert.equal(roundAThird.allow, false);
  const roundBThird = throttleRoundProgress(store, 'round_B', 300);
  assert.equal(roundBThird.allow, false);
});

// Rij 44
test('throttleRoundProgress: muteert de store zelf niet', () => {
  const existingRecord = { emittedAtMs: [100] };
  const store = createFakeStore();
  store.set('round_07', existingRecord);

  const snapshotBefore = JSON.parse(JSON.stringify(existingRecord));

  const result = throttleRoundProgress(store, 'round_07', 500);

  assert.equal(result.allow, true);
  // Het bestaande record (en zijn interne array) is ongewijzigd gebleven —
  // throttleRoundProgress construeert een nieuw record, het schrijft niet in
  // het bestaande terug.
  assert.deepEqual(existingRecord, snapshotBefore);
  assert.deepEqual(store.get('round_07'), existingRecord);
});
