import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moetAankondigen, fractie, URGENT_VANAF_SECONDEN } from './timer-bar.mjs';

test('de eerste tick kondigt aan, de tweede niet', () => {
  assert.equal(moetAankondigen(null, 30), true);
  assert.equal(moetAankondigen(30, 29), false);
});

test('alleen de overgang naar urgent kondigt aan, niet elke tick erbinnen', () => {
  assert.equal(moetAankondigen(4, 3), true, 'grens gepasseerd');
  assert.equal(moetAankondigen(3, 2), false, 'al urgent');
  assert.equal(moetAankondigen(2, 1), false);
  assert.equal(moetAankondigen(1, 0), false);
});

test('een sprong over de grens heen kondigt ook aan', () => {
  // Kan gebeuren na een tabwissel of een trage tick: 6 → 1 in één stap.
  assert.equal(moetAankondigen(6, 1), true);
});

test('een screenreader hoort per ronde hooguit twee keer iets', () => {
  const ticks = [30, 29, 28, 20, 10, 5, 4, 3, 2, 1, 0];
  let vorige = null;
  let aankondigingen = 0;
  for (const t of ticks) {
    if (moetAankondigen(vorige, t)) aankondigingen++;
    vorige = t;
  }
  assert.equal(aankondigingen, 2, 'start + het ingaan van de urgente fase');
});

test('de urgentiegrens is instelbaar, geen hardgecodeerde 3', () => {
  assert.equal(URGENT_VANAF_SECONDEN, 3);
  assert.equal(moetAankondigen(6, 5, 5), true);
  assert.equal(moetAankondigen(4, 3, 5), false, 'al urgent bij een grens van 5');
});

test('onbruikbare invoer kondigt niets aan in plaats van te gooien', () => {
  assert.equal(moetAankondigen(null, Number.NaN), false);
  assert.equal(moetAankondigen(10, undefined), false);
});

test('fractie loopt van 1 naar 0 en blijft binnen die grenzen', () => {
  assert.equal(fractie(30, 30), 1);
  assert.equal(fractie(15, 30), 0.5);
  assert.equal(fractie(0, 30), 0);
  assert.equal(fractie(-5, 30), 0, 'nooit negatief');
  assert.equal(fractie(40, 30), 1, 'nooit boven vol');
});

test('een onbruikbare totaalduur geeft een lege balk, geen deling door nul', () => {
  assert.equal(fractie(10, 0), 0);
  assert.equal(fractie(10, null), 0);
  assert.equal(fractie(Number.NaN, 30), 0);
});

// ── 12-segmentenvorm (1c) ────────────────────────────────────────────────
import { brandendeSegmenten, SEGMENTEN, URGENTE_SEGMENTEN } from './timer-bar.mjs';

test('vol is twaalf segmenten, leeg is nul', () => {
  assert.equal(brandendeSegmenten(30, 30), 12);
  assert.equal(brandendeSegmenten(0, 30), 0);
});

test('de helft van de tijd is de helft van de segmenten', () => {
  assert.equal(brandendeSegmenten(15, 30), 6);
});

test('een restje tijd houdt altijd één segment aan', () => {
  // Anders staat de timer op nul terwijl je nog kunt antwoorden — erger dan
  // een segment te veel.
  assert.equal(brandendeSegmenten(0.4, 30), 1);
  assert.equal(brandendeSegmenten(0.01, 30), 1);
});

test('de laatste seconden vallen binnen de urgente zone', () => {
  // Bij 30s totaal is één segment 2,5s; de laatste twee segmenten dekken dus
  // ruwweg de laatste vijf seconden — de zone die magenta is.
  assert.ok(brandendeSegmenten(5, 30) <= URGENTE_SEGMENTEN);
  assert.ok(brandendeSegmenten(6, 30) > URGENTE_SEGMENTEN);
});

test('segmenten blijven binnen hun grenzen, ook bij rare invoer', () => {
  for (const [r, tot] of [[-5, 30], [999, 30], [Number.NaN, 30], [10, 0], [10, null]]) {
    const n = brandendeSegmenten(r, tot);
    assert.ok(n >= 0 && n <= SEGMENTEN, `${r}/${tot} gaf ${n}`);
    assert.ok(Number.isInteger(n));
  }
});

test('het aantal segmenten daalt monotoon met de tijd', () => {
  let vorige = SEGMENTEN;
  for (let s = 30; s >= 0; s--) {
    const n = brandendeSegmenten(s, 30);
    assert.ok(n <= vorige, `bij ${s}s sprong het omhoog: ${vorige} → ${n}`);
    vorige = n;
  }
});
