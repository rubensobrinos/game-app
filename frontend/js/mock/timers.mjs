// mock/timers.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs, laatste twee functies van de
// "Fake socket"/dispatchlaag. Geen gedragsverandering. Gedeeld door
// mock/match.mjs en mock/pacing.mjs — beide plannen/annuleren timers op de
// room (`target.pendingTimers`), vandaar een eigen, afhankelijkheidsloos
// bestand in plaats van dat het ene bestand het andere importeert.

export function scheduleTimer(target, delayMs, callback) {
  const handle = setTimeout(() => {
    target.pendingTimers.delete(handle);
    callback();
  }, Math.max(0, delayMs));
  target.pendingTimers.add(handle);
}

export function clearTimers(target) {
  for (const handle of target.pendingTimers) {
    clearTimeout(handle);
  }
  target.pendingTimers.clear();
}
