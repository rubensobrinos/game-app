// mock/ids.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Naam- en ID-generatie"-kopje
// (het ID-gedeelte; naamgeneratie zit in mock/names.mjs). Geen gedragsverandering.
// Gedeeld door meerdere mock/*.mjs-bestanden (o.a. mock/room.mjs's buildRoom,
// mock/events.mjs's emit) én door transport-mock.mjs zelf — vandaar een eigen,
// afhankelijkheidsloos bestand in plaats van dat de een van de ander importeert.

export function randomToken() {
  return `tok_${randomHex(24)}`;
}

export function randomId(prefix) {
  return `${prefix}_${randomHex(12)}`;
}

export function randomInviteId() {
  return randomHex(12);
}

export function randomGameCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function randomHex(length) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, length);
  }
  let result = '';
  while (result.length < length) {
    result += Math.random().toString(16).slice(2);
  }
  return result.slice(0, length);
}

export function buildJoinUrl(inviteId) {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : 'http://localhost:8000';
  return `${origin}/j/${inviteId}`;
}
