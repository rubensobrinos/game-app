// Documentserialisatie voor de Redis-adapter (INTB2a).
//
// DECISIONS #22 zegt dat Room, Match en Round als *versieerbare* JSON-documenten
// worden opgeslagen, maar niet hóé. Dit bestand maakt dat concreet. Zolang dat
// niet vastligt is "versieerbaar" een woord in een besluit in plaats van een
// eigenschap van de opslag, en merken we het verschil pas bij de eerste
// incompatibele deploy — tijdens een live room, met spelers erin.
//
// DE KEUZE, in drie regels:
//
//   1. Elk document krijgt een envelop met een EXPLICIET schemaversieveld.
//      Geen impliciete versie afgeleid uit de aanwezigheid van velden, geen
//      "als `x` ontbreekt is het wel de oude vorm". Raden is precies wat we
//      hier uitsluiten.
//   2. Een NIEUWERE of ONBEKENDE versie faalt LUID. Een oude serverinstantie
//      die een document van een nieuwe instantie leest, weet per definitie niet
//      wat de nieuwe velden betekenen. Doorgaan met de velden die hij toevallig
//      herkent levert stille datacorruptie op; werpen levert een gecrashte
//      request op. Het tweede is een storing, het eerste is een bug die maanden
//      later terugkomt als een verkeerd scoreboard.
//   3. Een OUDERE bekende versie loopt langs een migratiepad. Dat pad is nu
//      leeg — er is nog maar één versie — maar de plek bestaat, is aanroepbaar
//      en is getest. Een lege registratietabel die werkt is iets anders dan
//      geen tabel.
//
// Waarom een envelop en niet een `_v`-veld ín het document: het domeindocument
// blijft precies wat `server/data/types/` valideert, zonder opslag-eigen veld
// dat elke `assert*Shape` zou moeten dulden. De opslaglaag voegt metadata toe,
// het domein weet daar niets van. Bijkomend voordeel: `documentType` in de
// envelop maakt een verkeerd gelezen sleutel meteen zichtbaar in plaats van
// stilzwijgend een Match als Room te laten binnenkomen.
//
// Waarom JSON en niet een Redis-hash per veld: #22 schrijft het voor, en het
// alternatief (hash met een veld per attribuut) maakt een documentwissel
// niet-atomair — halve documenten zijn dan waarneembaar. Indexes, sessies,
// spelers en de idempotency-cache mogen wél Redis-structuren gebruiken; de
// wáárden daarin zijn opnieuw enveloppen uit dit bestand.
//
// GEEN POORTMETHODEN, GEEN SLEUTELS, GEEN TTL. Dit bestand doet geen I/O en
// kent geen enkele Redis-sleutel: het zet objecten om in strings en terug.
// Sleutels komen uit `server/data/redis-keys.js` en TTL uit
// `server/data/ttl.js`, in INTB2b.
//
// DECISIONS #28: ESM, `.mjs`.

/**
 * Documenttypes die als versieerbare JSON-envelop worden opgeslagen.
 *
 * `room`, `match` en `round` staan letterlijk in DECISIONS #22. `session`,
 * `player`, `answer` en `action-cache-entry` staan in DATA-MODEL.md §Redis-
 * sleutels als waarden ín een hash; ze krijgen dezelfde envelop, want een
 * `Session`-vorm kan net zo goed veranderen als een `Room`-vorm en een tweede
 * serialisatiemechanisme naast dit ene is een gegarandeerde inconsistentie.
 *
 * `session-token-index` is de WAARDE onder `session:token:{tokenHash}`
 * (BESLUIT-INTB-locators-en-sessieindex.md, deel B): het paar
 * `{ roomId, sessionId }` en verder niets. Hij staat hier en niet als kale
 * string omdat de kop van dit bestand dat zelf voorschrijft — "indexes … mogen
 * wél Redis-structuren gebruiken; de wáárden daarin zijn opnieuw enveloppen uit
 * dit bestand". `room:code:{code}` en `room:invite:{inviteHash}` dragen een
 * kale `roomId` en zijn daarmee geen tegenvoorbeeld: één ondoorzichtige string
 * heeft geen vorm die kan verschuiven, een paar wél.
 */
export const DOCUMENT_TYPES = Object.freeze([
  'room',
  'match',
  'round',
  'session',
  'player',
  'answer',
  'action-cache-entry',
  'session-token-index',
]);

/**
 * De huidige schemaversie per documenttype. Per type apart, niet één globaal
 * nummer: een wijziging in `Round` hoort geen migratie voor `Room` te
 * forceren.
 *
 * OPHOGEN WANNEER: een veld verdwijnt, van betekenis verandert of van type
 * verandert. NIET ophogen voor een puur additief optioneel veld — dat leest
 * een oude instantie zonder schade, en elke ophoging kost een migratiefunctie.
 */
export const CURRENT_SCHEMA_VERSIONS = Object.freeze({
  room: 1,
  match: 1,
  round: 1,
  session: 1,
  player: 1,
  answer: 1,
  'action-cache-entry': 1,
  'session-token-index': 1,
});

/**
 * Migratiepad van een oudere bekende versie naar de volgende. Sleutel:
 * `"{documentType}:{vanVersie}"`, waarde: `(payload) => payload` die precies
 * één versiestap omhoog gaat. `decode` loopt de stappen achter elkaar af, dus
 * v1→v3 is `room:1` gevolgd door `room:2`; niemand hoeft een migratie te
 * schrijven die twee stappen tegelijk doet.
 *
 * NU LEEG, en dat hoort zo: er is nog maar één versie per type, dus er valt
 * niets te migreren. De plek bestaat, wordt aangeroepen en is getest (zie
 * `documents.test.mjs`, dat een codec met kunstmatige versies opzet). Ontbreekt
 * er straks een stap, dan werpt `decode` `MIGRATION_MISSING` — het document
 * wordt niet half gemigreerd doorgelaten.
 * @type {Readonly<Record<string, (payload: object) => object>>}
 */
export const DOCUMENT_MIGRATIONS = Object.freeze({});

/** Foutcodes van `DocumentCodecError`. Stabiel; bedoeld om op te matchen. */
export const DOCUMENT_ERROR_CODES = Object.freeze({
  /** Documenttype staat niet in het register. */
  UNKNOWN_DOCUMENT_TYPE: 'UNKNOWN_DOCUMENT_TYPE',
  /** Payload is niet serialiseerbaar of geen object. */
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  /** De opgeslagen string is geen geldige JSON. */
  MALFORMED_JSON: 'MALFORMED_JSON',
  /** De JSON mist de envelop of heeft hem in een onbruikbare vorm. */
  MALFORMED_ENVELOPE: 'MALFORMED_ENVELOPE',
  /** De envelop bevat een ander documenttype dan gevraagd. */
  DOCUMENT_TYPE_MISMATCH: 'DOCUMENT_TYPE_MISMATCH',
  /** Versie is nieuwer dan deze instantie kent. Nooit raden. */
  SCHEMA_VERSION_TOO_NEW: 'SCHEMA_VERSION_TOO_NEW',
  /** Versie is ouder, maar de migratiestap ontbreekt. */
  MIGRATION_MISSING: 'MIGRATION_MISSING',
  /** Een migratiefunctie gaf iets terug dat geen object is. */
  MIGRATION_FAILED: 'MIGRATION_FAILED',
});

/** Foutklasse van deze module. */
export class DocumentCodecError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string, documentType?: string, schemaVersion?: number, cause?: unknown }} details
   */
  constructor(message, { code, documentType, schemaVersion, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DocumentCodecError';
    /** @type {string} */
    this.code = code;
    /** @type {string|undefined} */
    this.documentType = documentType;
    /** @type {number|undefined} */
    this.schemaVersion = schemaVersion;
  }
}

/** Veldnamen van de envelop. Kort maar leesbaar; ze staan in élk document. */
const FIELD_SCHEMA_VERSION = 'schemaVersion';
const FIELD_DOCUMENT_TYPE = 'documentType';
const FIELD_PAYLOAD = 'payload';

/**
 * @param {unknown} value
 * @returns {boolean} true voor een gewoon object (geen array, geen null)
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Bouwt een codec. De productiecodec is `documentCodec` hieronder; de
 * parameters bestaan zodat de tests het versie- en migratiemechanisme kunnen
 * uitoefenen mét meer dan één versie, zonder de productieversies te verzinnen.
 * Een migratiepad dat pas bij de eerste échte v2 voor het eerst draait, is
 * geen migratiepad maar een voornemen.
 *
 * @param {object} [options]
 * @param {Record<string, number>} [options.currentVersions]
 * @param {Record<string, (payload: object) => object>} [options.migrations]
 * @returns {{
 *   encode: (documentType: string, payload: object) => string,
 *   decode: (documentType: string, raw: string|Buffer|null|undefined) => object|null,
 *   currentVersion: (documentType: string) => number,
 *   documentTypes: () => string[],
 * }}
 */
export function createDocumentCodec(options = {}) {
  const currentVersions = Object.freeze({ ...(options.currentVersions ?? CURRENT_SCHEMA_VERSIONS) });
  const migrations = Object.freeze({ ...(options.migrations ?? DOCUMENT_MIGRATIONS) });

  for (const [type, version] of Object.entries(currentVersions)) {
    if (!Number.isInteger(version) || version < 1) {
      throw new DocumentCodecError(
        `Schemaversie van '${type}' moet een geheel getal >= 1 zijn, kreeg: ${JSON.stringify(version)}`,
        { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType: type }
      );
    }
  }

  /**
   * @param {string} documentType
   * @returns {number}
   */
  function currentVersion(documentType) {
    const version = currentVersions[documentType];
    if (version === undefined) {
      throw new DocumentCodecError(
        `Onbekend documenttype: ${JSON.stringify(documentType)}. Bekend: ${Object.keys(currentVersions).join(', ')}`,
        { code: DOCUMENT_ERROR_CODES.UNKNOWN_DOCUMENT_TYPE, documentType }
      );
    }
    return version;
  }

  return {
    currentVersion,

    documentTypes() {
      return Object.keys(currentVersions);
    },

    /**
     * Verpakt een domeindocument in een versie-envelop en serialiseert het.
     *
     * Het `payload`-object gaat ongewijzigd mee: deze laag valideert de vórm
     * niet. Dat doet `server/data/types/` (`assertRoomShape` en familie), en
     * die controle hoort bij de poortmethode in INTB2b, niet twee keer op twee
     * plekken met twee meningen.
     * @param {string} documentType
     * @param {object} payload
     * @returns {string}
     */
    encode(documentType, payload) {
      const version = currentVersion(documentType);
      if (!isPlainObject(payload)) {
        throw new DocumentCodecError(
          `payload van '${documentType}' moet een object zijn, kreeg: ${
            Array.isArray(payload) ? 'array' : typeof payload
          }`,
          { code: DOCUMENT_ERROR_CODES.INVALID_PAYLOAD, documentType }
        );
      }

      const envelope = {
        [FIELD_SCHEMA_VERSION]: version,
        [FIELD_DOCUMENT_TYPE]: documentType,
        [FIELD_PAYLOAD]: payload,
      };

      let serialised;
      try {
        serialised = JSON.stringify(envelope);
      } catch (cause) {
        // Circulaire referentie, BigInt, of een werpende toJSON.
        throw new DocumentCodecError(`payload van '${documentType}' is niet naar JSON te serialiseren.`, {
          code: DOCUMENT_ERROR_CODES.INVALID_PAYLOAD,
          documentType,
          cause,
        });
      }
      if (typeof serialised !== 'string') {
        throw new DocumentCodecError(`payload van '${documentType}' serialiseerde naar undefined.`, {
          code: DOCUMENT_ERROR_CODES.INVALID_PAYLOAD,
          documentType,
        });
      }
      return serialised;
    },

    /**
     * Leest een opgeslagen document terug en geeft de payload.
     *
     * `null`/`undefined` (sleutel bestaat niet, of is verlopen — met een
     * room-TTL van vier uur is dat de normale gang van zaken, geen fout) geeft
     * `null`. Alles wat wél data is maar niet klopt, werpt.
     * @param {string} documentType
     * @param {string|Buffer|null|undefined} raw
     * @returns {object|null}
     */
    decode(documentType, raw) {
      const expectedVersion = currentVersion(documentType);
      if (raw === null || raw === undefined) return null;

      const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
      if (typeof text !== 'string') {
        throw new DocumentCodecError(
          `Opgeslagen '${documentType}' moet een string of Buffer zijn, kreeg: ${typeof raw}`,
          { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new DocumentCodecError(`Opgeslagen '${documentType}' is geen geldige JSON.`, {
          code: DOCUMENT_ERROR_CODES.MALFORMED_JSON,
          documentType,
          cause,
        });
      }

      if (!isPlainObject(parsed)) {
        throw new DocumentCodecError(
          `Opgeslagen '${documentType}' is geen envelop-object (kreeg ${
            Array.isArray(parsed) ? 'array' : typeof parsed
          }).`,
          { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType }
        );
      }

      const storedType = parsed[FIELD_DOCUMENT_TYPE];
      if (typeof storedType !== 'string' || storedType.length === 0) {
        throw new DocumentCodecError(
          `Envelop mist een bruikbaar '${FIELD_DOCUMENT_TYPE}' (verwacht '${documentType}').`,
          { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType }
        );
      }
      if (storedType !== documentType) {
        // Bijna altijd een verkeerde sleutel, en dat wil je weten vóórdat een
        // Match als Room door de rest van de server loopt.
        throw new DocumentCodecError(
          `Envelop bevat een '${storedType}' terwijl een '${documentType}' werd gelezen.`,
          { code: DOCUMENT_ERROR_CODES.DOCUMENT_TYPE_MISMATCH, documentType }
        );
      }

      const storedVersion = parsed[FIELD_SCHEMA_VERSION];
      if (!Number.isInteger(storedVersion) || storedVersion < 1) {
        throw new DocumentCodecError(
          `Envelop van '${documentType}' mist een bruikbare '${FIELD_SCHEMA_VERSION}' (kreeg: ${JSON.stringify(
            storedVersion
          )}).`,
          { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType }
        );
      }

      let payload = parsed[FIELD_PAYLOAD];
      if (!isPlainObject(payload)) {
        throw new DocumentCodecError(
          `Envelop van '${documentType}' mist een '${FIELD_PAYLOAD}'-object.`,
          { code: DOCUMENT_ERROR_CODES.MALFORMED_ENVELOPE, documentType, schemaVersion: storedVersion }
        );
      }

      if (storedVersion > expectedVersion) {
        // Nieuwer dan wij kennen. NIET doorlaten: deze instantie kan de
        // betekenis van de nieuwe vorm onmogelijk kennen, en "de velden die ik
        // herken meenemen" is stille corruptie. Dit is de melding die je wilt
        // zien tijdens een rollende deploy, niet drie dagen later in een
        // scoreboard.
        throw new DocumentCodecError(
          `Opgeslagen '${documentType}' heeft schemaversie ${storedVersion}; deze instantie kent maximaal ` +
            `${expectedVersion}. Waarschijnlijk draait er een nieuwere serverversie mee — deze instantie ` +
            `weigert te raden.`,
          {
            code: DOCUMENT_ERROR_CODES.SCHEMA_VERSION_TOO_NEW,
            documentType,
            schemaVersion: storedVersion,
          }
        );
      }

      // Ouder én bekend: stap voor stap omhoog. Elke stap moet geregistreerd
      // zijn; een ontbrekende stap is een fout, geen stilzwijgende passage.
      for (let version = storedVersion; version < expectedVersion; version += 1) {
        const migrate = migrations[`${documentType}:${version}`];
        if (typeof migrate !== 'function') {
          throw new DocumentCodecError(
            `Geen migratie geregistreerd van '${documentType}' v${version} naar v${version + 1}.`,
            { code: DOCUMENT_ERROR_CODES.MIGRATION_MISSING, documentType, schemaVersion: version }
          );
        }
        const migrated = migrate(payload);
        if (!isPlainObject(migrated)) {
          throw new DocumentCodecError(
            `Migratie van '${documentType}' v${version} naar v${version + 1} gaf geen object terug.`,
            { code: DOCUMENT_ERROR_CODES.MIGRATION_FAILED, documentType, schemaVersion: version }
          );
        }
        payload = migrated;
      }

      return payload;
    },
  };
}

/** De codec die de adapter in productie gebruikt. */
export const documentCodec = createDocumentCodec();

/**
 * @param {string} documentType
 * @param {object} payload
 * @returns {string}
 */
export function encodeDocument(documentType, payload) {
  return documentCodec.encode(documentType, payload);
}

/**
 * @param {string} documentType
 * @param {string|Buffer|null|undefined} raw
 * @returns {object|null}
 */
export function decodeDocument(documentType, raw) {
  return documentCodec.decode(documentType, raw);
}
