'use strict';

// Tabelgedreven testsuite voor de precedentieregel snapshot vs. event.
// Spec: docs/multiplayer/PROTOCOL.md basisregel 6 + sectie "Reconnect",
// docs/multiplayer/ARCHITECTURE.md §3 en docs/multiplayer/DATA-MODEL.md (rematch =
// nieuwe matchId binnen dezelfde room). Alleen node:test + node:assert, geen externe
// dependencies; geschreven vanuit de spec, niet vanuit de implementatie. Geen enkele
// test raakt de systeemklok: alle tijdstempels zijn vaste literals, zodat elke
// ordening exact te asserten is.

const { test } = require('node:test');
const assert = require('node:assert');

const { shouldApplySnapshot, shouldApplyEvent, REASONS } = require('./snapshot-precedence');

const V1 = 'v1';
const ROOM = '482917';
const OTHER_ROOM = '194026';
const MATCH_A = 'match_01JA';
const MATCH_B = 'match_01JB';

/** Vaste epoch-ms op één roomtijdlijn — nooit Date.now(). */
const T_EARLY = 1_785_623_400_000;
const T_NOW = 1_785_623_412_000;
const T_LATE = 1_785_623_427_000;

/** @typedef {{ description: string, localState: unknown, incoming: unknown,
 *   expected: object }} Fixture */

/** LocalState met geldige defaults: state komt van een event op T_NOW. */
function local(overrides = {}) {
  return {
    protocolVersion: V1,
    roomCode: ROOM,
    matchId: MATCH_A,
    appliedServerTime: T_NOW,
    appliedFrom: 'event',
    ...overrides,
  };
}

/** Verse client: nog niets toegepast (reconnect stap 5, allereerste snapshot). */
function fresh(overrides = {}) {
  return local({ matchId: null, appliedServerTime: null, appliedFrom: null, ...overrides });
}

/** Snapshot volgens PROTOCOL.md "State-snapshot"; alleen beslissingsvelden variëren. */
function snap({ protocolVersion = V1, serverTime = T_LATE, code = ROOM, matchId = MATCH_A, room } = {}) {
  return {
    protocolVersion,
    serverTime,
    room:
      room === undefined
        ? { code, phase: 'ROUND_ACTIVE', locked: false, playerCount: 23, config: {}, matchId }
        : room,
    self: { roles: ['player'], playerId: 'p_8f42d1', score: 600, answeredCurrentRound: false },
    currentRound: {},
    scoreboard: { top: [], self: {} },
  };
}

/** Server → client envelope (PROTOCOL.md "Event-envelope"). */
function evt(serverTime = T_LATE, name = 'round:started') {
  return { event: name, eventId: 'evt_01J', serverTime, payload: { matchId: MATCH_A } };
}

/** Kopie zonder één sleutel — voor de "ontbrekend veld"-rijen. */
function omit(source, key) {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

const applied = (matchChanged) => ({ apply: true, matchChanged });
const appliedEvent = () => ({ apply: true });
const denied = (reason) => ({ apply: false, reason });

/** @returns {Fixture} */
const row = (description, localState, incoming, expected) =>
  ({ description, localState, incoming, expected });

/** @type {Fixture[]} */
const SNAPSHOT_FIXTURES = [
  // [1] Kernregel: een snapshot wint van eerder ontvangen events (basisregel 6).
  row('nieuwere snapshot overschrijft event-state', local(), snap(), applied(false)),
  row('snapshot met GELIJKE serverTime wint van reeds toegepast event',
    local(), snap({ serverTime: T_NOW }), applied(false)),
  row('nieuwere snapshot overschrijft eerdere snapshot-state',
    local({ appliedFrom: 'snapshot' }), snap(), applied(false)),

  // [2] Maar een STALE snapshot wint niet: out-of-order aankomst na reconnect.
  row('oudere snapshot draait nieuwere event-state niet terug',
    local(), snap({ serverTime: T_EARLY }), denied(REASONS.STALE_SNAPSHOT)),
  row('oudere snapshot draait nieuwere snapshot-state niet terug',
    local({ appliedServerTime: T_LATE, appliedFrom: 'snapshot' }), snap({ serverTime: T_NOW }),
    denied(REASONS.STALE_SNAPSHOT)),
  row('trage tweede /state-respons van vóór de laatste event-tick is stale',
    local({ appliedServerTime: T_LATE }), snap({ serverTime: T_EARLY }),
    denied(REASONS.STALE_SNAPSHOT)),
  row('snapshot met GELIJKE serverTime als reeds toegepaste snapshot is een duplicaat',
    local({ appliedFrom: 'snapshot' }), snap({ serverTime: T_NOW }),
    denied(REASONS.DUPLICATE_SNAPSHOT)),

  // [3] Verse client: er is nog niets om achterhaald door te raken.
  row('eerste snapshot op een verse client wordt toegepast', fresh(), snap(), applied(true)),
  row('eerste snapshot zonder actieve match', fresh(), snap({ matchId: null }), applied(false)),
  row('oude serverTime is op een verse client prima', fresh(), snap({ serverTime: T_EARLY }), applied(true)),

  // [4] Protocolversie gaat vóór alles wat inhoud is (open punt a in de module).
  row('afwijkende protocolVersion v2 wordt afgewezen',
    local(), snap({ protocolVersion: 'v2' }), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row('protocolVersion is hoofdlettergevoelig: "V1" wordt afgewezen',
    local(), snap({ protocolVersion: 'V1' }), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row('versiecheck gaat vóór de tijdcheck: stale én v2 → PROTOCOL_VERSION_UNSUPPORTED',
    local(), snap({ protocolVersion: 'v2', serverTime: T_EARLY }),
    denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row('versiecheck gaat vóór de roomcheck: andere room én v2 → PROTOCOL_VERSION_UNSUPPORTED',
    local(), snap({ protocolVersion: 'v2', code: OTHER_ROOM }),
    denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row('lokaal verwachte v2 wijst een v1-snapshot af',
    local({ protocolVersion: 'v2' }), snap(), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),

  // [5] Room-identiteit: een snapshot van een andere room is een routeringsfout.
  row('snapshot voor een andere room wordt afgewezen',
    local(), snap({ code: OTHER_ROOM }), denied(REASONS.ROOM_MISMATCH)),
  row('roomcheck gaat vóór de tijdcheck: andere room én nieuwer → ROOM_MISMATCH',
    local({ appliedServerTime: T_EARLY }), snap({ code: OTHER_ROOM, serverTime: T_LATE }),
    denied(REASONS.ROOM_MISMATCH)),
  row('roomcheck gaat vóór de tijdcheck: andere room én stale → ROOM_MISMATCH',
    local(), snap({ code: OTHER_ROOM, serverTime: T_EARLY }), denied(REASONS.ROOM_MISMATCH)),

  // [6] Rematch: nieuwe matchId binnen DEZELFDE room is een geldige overgang, geen
  // fout. matchId ordent niet — dat doet uitsluitend serverTime.
  row('rematch: nieuwe matchId binnen dezelfde room wordt toegepast en gemarkeerd',
    local(), snap({ matchId: MATCH_B }), applied(true)),
  row('rematch met gelijke serverTime wint alsnog van event-state',
    local(), snap({ matchId: MATCH_B, serverTime: T_NOW }), applied(true)),
  row('eerste match: matchId null → id wordt gemarkeerd als matchwissel',
    local({ matchId: null }), snap({ matchId: MATCH_A }), applied(true)),
  row('room zonder actieve match: matchId id → null wordt gemarkeerd als matchwissel',
    local(), snap({ matchId: null }), applied(true)),
  row('zelfde matchId levert matchChanged false op', local(), snap({ matchId: MATCH_A }), applied(false)),
  row('snapshot van de VORIGE match valt af op tijd, niet op matchId',
    local({ matchId: MATCH_B, appliedServerTime: T_LATE }), snap({ matchId: MATCH_A, serverTime: T_NOW }),
    denied(REASONS.STALE_SNAPSHOT)),

  // [7] Ontbrekende, lege of vijandige snapshotvelden → nooit een exception.
  row('snapshot null', local(), null, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot undefined', local(), undefined, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als array', local(), [], denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als string', local(), 'snapshot', denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als getal', local(), 42, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder protocolVersion', local(), omit(snap(), 'protocolVersion'),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot met lege protocolVersion', local(), snap({ protocolVersion: '' }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder serverTime', local(), omit(snap(), 'serverTime'),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime als numerieke string vergelijkt niet en wordt afgewezen',
    local(), snap({ serverTime: String(T_LATE) }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime NaN', local(), snap({ serverTime: NaN }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime Infinity', local(), snap({ serverTime: Infinity }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime negatief', local(), snap({ serverTime: -1 }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime null', local(), snap({ serverTime: null }), denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder room', local(), omit(snap(), 'room'), denied(REASONS.INVALID_SNAPSHOT)),
  row('room null', local(), snap({ room: null }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room als array', local(), snap({ room: [] }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder code', local(), snap({ room: { phase: 'LOBBY', matchId: MATCH_A } }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('room.code leeg', local(), snap({ code: '' }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder matchId: ontbrekend is geen impliciete null',
    local(), snap({ room: { code: ROOM, phase: 'LOBBY' } }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room.matchId als lege string', local(), snap({ matchId: '' }), denied(REASONS.INVALID_SNAPSHOT)),
  row('structuurcheck gaat vóór de versiecheck: v2 zonder room → INVALID_SNAPSHOT',
    local(), omit(snap({ protocolVersion: 'v2' }), 'room'), denied(REASONS.INVALID_SNAPSHOT)),

  // [8] LocalState-validatie gaat vóór alles: zonder betrouwbare lokale herkomst is
  // er niets om tegen af te wegen.
  row('localState null', null, snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState undefined', undefined, snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState als array', [], snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState als string', 'state', snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState zonder roomCode', omit(local(), 'roomCode'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState met lege protocolVersion', local({ protocolVersion: '' }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState zonder matchId-veld', omit(local(), 'matchId'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('halve herkomst: appliedServerTime gevuld, appliedFrom null',
    local({ appliedFrom: null }), snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('halve herkomst: appliedServerTime null, appliedFrom "event"',
    local({ appliedServerTime: null }), snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('onbekende appliedFrom-waarde', local({ appliedFrom: 'snap' }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('appliedServerTime als string', local({ appliedServerTime: String(T_NOW) }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('appliedServerTime ontbreekt volledig', omit(local(), 'appliedServerTime'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('ongeldige localState wint van ongeldige snapshot', null, null, denied(REASONS.INVALID_LOCAL_STATE)),
];

/** @type {Fixture[]} */
const EVENT_FIXTURES = [
  // [1] Normale event-voortgang op event-state.
  row('nieuwer event wordt toegepast', local(), evt(T_LATE), appliedEvent()),
  row('event met gelijke serverTime als een eerder event landt ook (partiële delta)',
    local(), evt(T_NOW, 'scoreboard:updated'), appliedEvent()),
  row('out-of-order: ouder event dan de laatste event-tick wordt genegeerd',
    local(), evt(T_EARLY), denied(REASONS.STALE_EVENT)),

  // [2] De andere helft van basisregel 6: de snapshot is leidend boven eerder
  // ontvangen events.
  row('event van vóór de toegepaste snapshot wordt genegeerd',
    local({ appliedFrom: 'snapshot' }), evt(T_EARLY), denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row('event met gelijke serverTime als de snapshot verliest van de snapshot',
    local({ appliedFrom: 'snapshot' }), evt(T_NOW), denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row('event ná de snapshot landt wel', local({ appliedFrom: 'snapshot' }), evt(T_LATE), appliedEvent()),

  // [3] Verse client: elk geldig event mag landen.
  row('event op een verse client wordt toegepast', fresh(), evt(T_LATE), appliedEvent()),
  row('oud event op een verse client wordt ook toegepast', fresh(), evt(T_EARLY), appliedEvent()),

  // [4] Ongeldige envelope → nooit een exception.
  row('event null', local(), null, denied(REASONS.INVALID_EVENT)),
  row('event undefined', local(), undefined, denied(REASONS.INVALID_EVENT)),
  row('event als array', local(), [], denied(REASONS.INVALID_EVENT)),
  row('event als string', local(), 'round:started', denied(REASONS.INVALID_EVENT)),
  row('event zonder serverTime', local(), omit(evt(), 'serverTime'), denied(REASONS.INVALID_EVENT)),
  row('event met serverTime als string', local(), evt(String(T_LATE)), denied(REASONS.INVALID_EVENT)),
  row('event met serverTime NaN', local(), evt(NaN), denied(REASONS.INVALID_EVENT)),
  row('event met negatieve serverTime', local(), evt(-1), denied(REASONS.INVALID_EVENT)),
  row('event zonder eventnaam is geldig: alleen serverTime telt voor de ordening',
    local(), { serverTime: T_LATE }, appliedEvent()),

  // [5] LocalState-validatie gaat ook hier voorop.
  row('event: localState null', null, evt(T_LATE), denied(REASONS.INVALID_LOCAL_STATE)),
  row('event: ongeldige local wint van ongeldig event', 'state', null, denied(REASONS.INVALID_LOCAL_STATE)),
];

/** Draait één fixtureset: exacte uitkomst plus non-mutatie van beide argumenten. */
async function runFixtures(t, fixtures, decide) {
  for (const fixture of fixtures) {
    await t.test(fixture.description, () => {
      const localBefore = structuredClone(fixture.localState);
      const incomingBefore = structuredClone(fixture.incoming);
      const result = decide(fixture.localState, fixture.incoming);

      assert.deepStrictEqual(result, fixture.expected);
      assert.deepStrictEqual(fixture.localState, localBefore, 'localState mag niet muteren');
      assert.deepStrictEqual(fixture.incoming, incomingBefore, 'invoer mag niet muteren');
    });
  }
}

test('shouldApplySnapshot — beslistabel', async (t) => {
  await runFixtures(t, SNAPSHOT_FIXTURES, shouldApplySnapshot);
});

test('shouldApplyEvent — beslistabel', async (t) => {
  await runFixtures(t, EVENT_FIXTURES, shouldApplyEvent);
});

test('beide argumenten blijven ongewijzigd, inclusief geneste objecten', () => {
  const localState = local();
  const snapshot = snap({ matchId: MATCH_B });
  const localCopy = structuredClone(localState);
  const incomingCopy = structuredClone(snapshot);
  const roomRef = snapshot.room;

  assert.deepStrictEqual(shouldApplySnapshot(localState, snapshot), applied(true));
  assert.deepStrictEqual(localState, localCopy);
  assert.deepStrictEqual(snapshot, incomingCopy);
  assert.strictEqual(snapshot.room, roomRef, 'genest room-object niet vervangen');
});

test('afwijzing raakt de lokale state niet aan en draagt geen matchChanged', () => {
  const localState = local({ appliedFrom: 'snapshot' });
  const before = structuredClone(localState);
  const result = shouldApplySnapshot(localState, snap({ serverTime: T_EARLY }));

  assert.deepStrictEqual(result, denied(REASONS.STALE_SNAPSHOT));
  assert.deepStrictEqual(localState, before);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'matchChanged'), false);
});

/** Kopie waarin precies één property werpt bij lezing. */
function withThrowingGetter(base, key) {
  const target = { ...base };
  Object.defineProperty(target, key, {
    enumerable: true,
    get() {
      throw new Error('vijandige getter');
    },
  });
  return target;
}

test('werpende getters leveren een afwijzing op, geen exception', () => {
  const hostileRoom = withThrowingGetter({ code: ROOM, matchId: MATCH_A }, 'code');

  assert.deepStrictEqual(shouldApplySnapshot(local(), withThrowingGetter(snap(), 'room')),
    denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(local(), snap({ room: hostileRoom })),
    denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(withThrowingGetter(local(), 'appliedServerTime'), snap()),
    denied(REASONS.INVALID_LOCAL_STATE));
  assert.deepStrictEqual(shouldApplyEvent(local(), withThrowingGetter(evt(), 'serverTime')),
    denied(REASONS.INVALID_EVENT));
});

test('reconnectscenario: snapshot en events lopen door elkaar (PROTOCOL.md "Reconnect")', () => {
  // De aanroeper werkt zijn LocalState telkens bij zoals de modulekop voorschrijft;
  // deze test doet dat expliciet, met vaste tijdstempels en zonder klok.
  let state = fresh();

  // Stap 5: na verbinding vraagt de client een snapshot; niets heeft die achterhaald.
  assert.deepStrictEqual(shouldApplySnapshot(state, snap({ serverTime: T_NOW })), applied(true));
  state = local({ appliedServerTime: T_NOW, appliedFrom: 'snapshot' });

  // Een event van vóór de onderbreking arriveert alsnog en mag niets terugdraaien.
  assert.deepStrictEqual(shouldApplyEvent(state, evt(T_EARLY)),
    denied(REASONS.SUPERSEDED_BY_SNAPSHOT));

  // Een verse event-tick landt wel.
  assert.deepStrictEqual(shouldApplyEvent(state, evt(T_LATE)), appliedEvent());
  state = local({ appliedServerTime: T_LATE, appliedFrom: 'event' });

  // Een trage tweede /state-respons van vóór die tick draait niets terug.
  assert.deepStrictEqual(shouldApplySnapshot(state, snap({ serverTime: T_NOW })),
    denied(REASONS.STALE_SNAPSHOT));

  // De host start een rematch: nieuwe matchId binnen dezelfde room, nieuwere tijd.
  assert.deepStrictEqual(
    shouldApplySnapshot(state, snap({ serverTime: T_LATE + 1, matchId: MATCH_B })), applied(true));
});

// Meta-test op de fixture-sets zelf: bewaakt de eisen aan de suite.
test('meta: exacte verwachtingen, unieke beschrijvingen en volledige motiefdekking', () => {
  const allFixtures = [...SNAPSHOT_FIXTURES, ...EVENT_FIXTURES];
  const seen = new Set();
  const usedReasons = new Set();
  const known = new Set(Object.values(REASONS));
  assert.ok(allFixtures.length > 0);

  for (const fixture of allFixtures) {
    assert.strictEqual(seen.has(fixture.description), false, `dubbel: ${fixture.description}`);
    seen.add(fixture.description);

    if (!fixture.expected.apply) {
      assert.ok(known.has(fixture.expected.reason), `onbekend motief: ${fixture.description}`);
      usedReasons.add(fixture.expected.reason);
      continue;
    }
    // Alleen de snapshotregel kent matchChanged; de eventregel interpreteert matchId
    // bewust niet en mag de vlag dus niet dragen.
    const hasFlag = Object.prototype.hasOwnProperty.call(fixture.expected, 'matchChanged');
    assert.strictEqual(hasFlag, SNAPSHOT_FIXTURES.includes(fixture), fixture.description);
    assert.ok(!hasFlag || typeof fixture.expected.matchChanged === 'boolean', fixture.description);
  }

  // Elk gepubliceerd motief moet minstens één rij hebben.
  assert.deepStrictEqual([...usedReasons].sort(), [...known].sort());
});
