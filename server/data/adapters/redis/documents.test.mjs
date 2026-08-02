// Tests voor de documentserialisatie (INTB2a).
//
// GEEN REDIS. Dit bestand doet geen I/O: de codec zet objecten om in strings
// en terug. Er is dus ook niets te beschermen tegen de verkeerde instantie —
// zie `connection.test.mjs` en `test-redis.mjs` voor de tests die wél een
// socket opzetten.
//
// Wat hier bewezen moet worden is niet "JSON werkt", maar de drie eigenschappen
// waar DECISIONS #22 op leunt: de versie staat er expliciet in, een nieuwere of
// onbekende versie faalt luid, en het migratiepad voor een oudere bekende
// versie bestaat écht en wordt echt gebruikt.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_SCHEMA_VERSIONS,
  DOCUMENT_ERROR_CODES,
  DOCUMENT_MIGRATIONS,
  DOCUMENT_TYPES,
  DocumentCodecError,
  createDocumentCodec,
  decodeDocument,
  documentCodec,
  encodeDocument,
} from './documents.mjs';

/**
 * @param {() => unknown} fn
 * @param {string} expectedCode
 * @returns {DocumentCodecError}
 */
function expectCodecError(fn, expectedCode) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof DocumentCodecError, `verwachtte DocumentCodecError, kreeg ${error?.name}`);
    assert.equal(error.code, expectedCode, `foutcode: ${error.code} (${error.message})`);
    return error;
  }
  throw new assert.AssertionError({
    message: `verwachtte een DocumentCodecError met code ${expectedCode}, maar er werd niets geworpen`,
  });
}

const ROOM_PAYLOAD = Object.freeze({
  id: 'room-1',
  code: '111111',
  phase: 'LOBBY',
  createdAt: 1785600000000,
});

describe('documents — envelop', () => {
  it('schrijft schemaversie, documenttype en payload als aparte velden', () => {
    const raw = encodeDocument('room', ROOM_PAYLOAD);
    const parsed = JSON.parse(raw);

    assert.deepEqual(Object.keys(parsed).sort(), ['documentType', 'payload', 'schemaVersion']);
    assert.equal(parsed.schemaVersion, CURRENT_SCHEMA_VERSIONS.room);
    assert.equal(parsed.documentType, 'room');
    assert.deepEqual(parsed.payload, ROOM_PAYLOAD);
  });

  it('laat het domeindocument ongemoeid — geen opslagveld in de payload', () => {
    const parsed = JSON.parse(encodeDocument('room', ROOM_PAYLOAD));
    assert.deepEqual(Object.keys(parsed.payload).sort(), Object.keys(ROOM_PAYLOAD).sort());
    assert.equal(parsed.payload.schemaVersion, undefined);
    assert.equal(parsed.payload.documentType, undefined);
  });

  it('rondreist elk documenttype', () => {
    for (const documentType of DOCUMENT_TYPES) {
      const payload = { marker: documentType, nested: { n: 1 }, list: [1, 2, 3] };
      const decoded = decodeDocument(documentType, encodeDocument(documentType, payload));
      assert.deepEqual(decoded, payload, `roundtrip van ${documentType}`);
    }
  });

  it('leest een Buffer net zo goed als een string', () => {
    const raw = Buffer.from(encodeDocument('match', { id: 'match-1' }), 'utf8');
    assert.deepEqual(decodeDocument('match', raw), { id: 'match-1' });
  });

  it('geeft null voor een ontbrekende sleutel — een verlopen room is geen fout', () => {
    assert.equal(decodeDocument('room', null), null);
    assert.equal(decodeDocument('room', undefined), null);
  });

  it('kent precies de documenttypes uit DOCUMENT_TYPES, met een versie elk', () => {
    assert.deepEqual(documentCodec.documentTypes().sort(), [...DOCUMENT_TYPES].sort());
    for (const documentType of DOCUMENT_TYPES) {
      assert.equal(typeof CURRENT_SCHEMA_VERSIONS[documentType], 'number', `versie van ${documentType}`);
      assert.ok(CURRENT_SCHEMA_VERSIONS[documentType] >= 1);
    }
  });
});

describe('documents — luid falen op onbruikbare invoer', () => {
  it('weigert een onbekend documenttype bij encode en decode', () => {
    expectCodecError(() => encodeDocument('spaceship', {}), DOCUMENT_ERROR_CODES.UNKNOWN_DOCUMENT_TYPE);
    expectCodecError(() => decodeDocument('spaceship', '{}'), DOCUMENT_ERROR_CODES.UNKNOWN_DOCUMENT_TYPE);
  });

  it('weigert een payload die geen object is', () => {
    for (const payload of [null, undefined, 42, 'room', [1, 2], true]) {
      expectCodecError(() => encodeDocument('room', payload), DOCUMENT_ERROR_CODES.INVALID_PAYLOAD);
    }
  });

  it('weigert een niet-serialiseerbare payload', () => {
    const circular = { id: 'room-1' };
    circular.self = circular;
    expectCodecError(() => encodeDocument('room', circular), DOCUMENT_ERROR_CODES.INVALID_PAYLOAD);
    expectCodecError(() => encodeDocument('room', { big: 1n }), DOCUMENT_ERROR_CODES.INVALID_PAYLOAD);
  });

  it('weigert kapotte JSON', () => {
    expectCodecError(() => decodeDocument('room', '{niet eens json'), DOCUMENT_ERROR_CODES.MALFORMED_JSON);
  });

  it('weigert JSON die geen envelop-object is', () => {
    for (const raw of ['42', '"room"', 'null', '[]', 'true']) {
      expectCodecError(() => decodeDocument('room', raw), DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE);
    }
  });

  it('weigert een envelop zonder bruikbaar payload-object', () => {
    for (const payload of ['null', '42', '"x"', '[]']) {
      const raw = `{"schemaVersion":1,"documentType":"room","payload":${payload}}`;
      expectCodecError(() => decodeDocument('room', raw), DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE);
    }
    expectCodecError(
      () => decodeDocument('room', '{"schemaVersion":1,"documentType":"room"}'),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
  });

  it('weigert een envelop zonder bruikbare schemaversie', () => {
    for (const version of ['0', '-1', '"1"', '1.5', 'null', 'true']) {
      const raw = `{"schemaVersion":${version},"documentType":"room","payload":{"id":"r"}}`;
      expectCodecError(() => decodeDocument('room', raw), DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE);
    }
    expectCodecError(
      () => decodeDocument('room', '{"documentType":"room","payload":{"id":"r"}}'),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
  });

  it('weigert een envelop van een ander documenttype — een verkeerde sleutel blijft niet stil', () => {
    const raw = encodeDocument('match', { id: 'match-1' });
    const error = expectCodecError(() => decodeDocument('room', raw), DOCUMENT_ERROR_CODES.DOCUMENT_TYPE_MISMATCH);
    assert.match(error.message, /match/);
    assert.match(error.message, /room/);
  });

  it('weigert een envelop zonder bruikbaar documentType-veld', () => {
    expectCodecError(
      () => decodeDocument('room', '{"schemaVersion":1,"documentType":"","payload":{"id":"r"}}'),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
    expectCodecError(
      () => decodeDocument('room', '{"schemaVersion":1,"payload":{"id":"r"}}'),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
  });
});

describe('documents — versiebeleid', () => {
  it('weigert een NIEUWERE versie en raadt niet', () => {
    // Zo ziet een document van een nieuwere serverinstantie eruit tijdens een
    // rollende deploy: bekende velden plus iets wat wij niet kennen.
    const future = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSIONS.room + 1,
      documentType: 'room',
      payload: { ...ROOM_PAYLOAD, somethingNew: 'onbekend' },
    });

    const error = expectCodecError(
      () => decodeDocument('room', future),
      DOCUMENT_ERROR_CODES.SCHEMA_VERSION_TOO_NEW
    );
    assert.equal(error.schemaVersion, CURRENT_SCHEMA_VERSIONS.room + 1);
    assert.equal(error.documentType, 'room');
  });

  it('weigert elke nieuwere versie voor élk documenttype', () => {
    for (const documentType of DOCUMENT_TYPES) {
      const raw = JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSIONS[documentType] + 7,
        documentType,
        payload: { id: 'x' },
      });
      expectCodecError(() => decodeDocument(documentType, raw), DOCUMENT_ERROR_CODES.SCHEMA_VERSION_TOO_NEW);
    }
  });

  it('houdt het productiemigratieregister leeg — er is nog maar één versie', () => {
    assert.deepEqual(Object.keys(DOCUMENT_MIGRATIONS), []);
    for (const documentType of DOCUMENT_TYPES) {
      assert.equal(
        CURRENT_SCHEMA_VERSIONS[documentType],
        1,
        `${documentType} staat op een versie > 1 maar DOCUMENT_MIGRATIONS is leeg — registreer de migratiestap`
      );
    }
  });
});

describe('documents — migratiepad', () => {
  // De productiecodec kent maar één versie per type, dus daar valt niets te
  // migreren. Een migratiepad dat pas bij de eerste échte v2 voor het eerst
  // draait is geen pad maar een voornemen: hieronder wordt hetzelfde mechanisme
  // met kunstmatige versies wél uitgeoefend.

  it('migreert een oudere bekende versie stap voor stap omhoog', () => {
    const steps = [];
    const codec = createDocumentCodec({
      currentVersions: { room: 3 },
      migrations: {
        'room:1': (payload) => {
          steps.push('1->2');
          return { ...payload, viaV2: true };
        },
        'room:2': (payload) => {
          steps.push('2->3');
          return { ...payload, viaV3: true };
        },
      },
    });

    const stored = JSON.stringify({ schemaVersion: 1, documentType: 'room', payload: { id: 'room-1' } });
    const decoded = codec.decode('room', stored);

    assert.deepEqual(steps, ['1->2', '2->3'], 'beide stappen, in volgorde');
    assert.deepEqual(decoded, { id: 'room-1', viaV2: true, viaV3: true });
  });

  it('slaat de migratie over als de versie al actueel is', () => {
    let called = 0;
    const codec = createDocumentCodec({
      currentVersions: { room: 2 },
      migrations: {
        'room:1': (payload) => {
          called += 1;
          return payload;
        },
      },
    });

    const decoded = codec.decode('room', codec.encode('room', { id: 'room-1' }));
    assert.equal(called, 0);
    assert.deepEqual(decoded, { id: 'room-1' });
  });

  it('werpt als de migratiestap ontbreekt — geen stilzwijgende passage', () => {
    const codec = createDocumentCodec({ currentVersions: { room: 2 }, migrations: {} });
    const stored = JSON.stringify({ schemaVersion: 1, documentType: 'room', payload: { id: 'room-1' } });

    const error = expectCodecError(() => codec.decode('room', stored), DOCUMENT_ERROR_CODES.MIGRATION_MISSING);
    assert.equal(error.schemaVersion, 1);
  });

  it('werpt als een migratie iets teruggeeft dat geen document is', () => {
    const codec = createDocumentCodec({
      currentVersions: { room: 2 },
      migrations: { 'room:1': () => undefined },
    });
    const stored = JSON.stringify({ schemaVersion: 1, documentType: 'room', payload: { id: 'room-1' } });
    expectCodecError(() => codec.decode('room', stored), DOCUMENT_ERROR_CODES.MIGRATION_FAILED);
  });

  it('gebruikt de migratie van het juiste documenttype', () => {
    const codec = createDocumentCodec({
      currentVersions: { room: 2, match: 2 },
      migrations: { 'room:1': (payload) => ({ ...payload, migrated: 'room' }) },
    });

    assert.deepEqual(
      codec.decode('room', JSON.stringify({ schemaVersion: 1, documentType: 'room', payload: { id: 'r' } })),
      { id: 'r', migrated: 'room' }
    );
    // Match heeft dezelfde oude versie maar geen eigen migratie: dat mag niet
    // stilletjes de room-migratie pakken.
    expectCodecError(
      () => codec.decode('match', JSON.stringify({ schemaVersion: 1, documentType: 'match', payload: { id: 'm' } })),
      DOCUMENT_ERROR_CODES.MIGRATION_MISSING
    );
  });

  it('weigert een codec met een onzinnige versie', () => {
    expectCodecError(
      () => createDocumentCodec({ currentVersions: { room: 0 } }),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
    expectCodecError(
      () => createDocumentCodec({ currentVersions: { room: 1.5 } }),
      DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE
    );
  });
});
