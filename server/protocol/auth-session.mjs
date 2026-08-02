/**
 * @file Sessietoken-generatie en -hashing — realiseert PROTOCOL.md
 * §Authenticatie en tijdelijke sessies, volgens het PR8a-voorstel na
 * bevestiging (zie ../../docs/protocol-plan/README.md fase PR8,
 * ../../docs/protocol-plan/prompts/PR8-session-token-proposal.md), uitgebreid
 * in PR12 (../../docs/protocol-plan/prompts/PR12-auth-session-extension.md)
 * met pepper-versionering en constant-time verificatie (`DECISIONS.md`
 * punt 26, tweede helft).
 * @see docs/protocol-plan/PR8a-auth-session-voorstel.md — de geaccordeerde
 *   algoritme-/hashing-/peppering-keuze die deze module implementeert:
 *   `randomBytes(32)` (256 bit) → base64url zonder padding (§2), en
 *   `hex(HMAC_SHA256(key: pepper, message: token))` als hashingschema (§3–4).
 *
 * Pure functies: geen Redis, geen sessiebeheer, geen revocation.
 * `generateSessionToken`'s `cryptoSource` (de `randomBytes`-bron) komt altijd
 * als argument binnen, nooit via een module-brede import van `node:crypto`
 * voor de willekeur zelf — dat houdt tokengeneratie deterministisch testbaar
 * met een fake `randomBytes`, zonder de systeem-CSPRNG te monkeypatchen.
 * `hashToken`/`verifyToken` importeren `node:crypto` wél rechtstreeks voor
 * `createHmac`/`digest`/`timingSafeEqual`: dat pad bevat geen randomness, dus
 * speelt het testbaarheidsprobleem daar niet.
 *
 * `pepper`(s) komen bij `hashToken`/`verifyToken` als argument binnen; waar
 * die vandaan komen (`.env`, secrets manager, rotatie) valt buiten dit plan
 * (zie PR8a §4/§6) — deze module scheidt uitdrukkelijk "hoe genereren/hashen/
 * verifiëren we" (hier) van "waar komt de pepper vandaan" (elders).
 *
 * PR12: `hashToken`'s signatuur is gewijzigd (`hashToken(token, pepper)` →
 * `hashToken(token, { version, pepper })`) — er is nog geen productiedata,
 * dus is bewust gekozen géén legacy-parser voor onversioned hashes te bouwen.
 * De opslagvorm is `${version}:${hex-hash}` — `:` als scheidingsteken, omdat
 * dat teken nooit in een hex-digest of in een pepperversie-naam (`v1`, `v2`,
 * …) voorkomt.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Scheidingsteken tussen pepperversie en hex-hash in de opslagvorm. */
const STORED_HASH_SEPARATOR = ':';

/**
 * Hex-string van één of meer byte-paren (even lengte, alleen `0-9a-f`,
 * hoofdletterongevoelig). Gebruikt om een `storedHash`'s hex-deel te
 * valideren vóórdat die naar een `Buffer` wordt omgezet — `Buffer.from` met
 * `'hex'`-encoding gooit zelf niet bij ongeldige of oneven invoer, maar
 * negeert/knipt stilzwijgend, wat precies het stille-verrassing-gedrag is
 * dat we hier willen vermijden.
 */
const HEX_BYTE_PAIRS_PATTERN = /^([0-9a-f]{2})+$/i;

/**
 * Genereert een cryptografisch willekeurige sessietoken: 32 ruwe bytes
 * (256 bit entropie, PR8a §2/§5) van de geïnjecteerde `randomBytes`-bron,
 * gecodeerd als base64url zonder padding (RFC 4648 §5: `+`→`-`, `/`→`_`,
 * geen `=`-padding) — Node's ingebouwde `'base64url'`-Buffer-encoding volgt
 * dat alfabet al exact, dus geen losse vervangingsstap nodig.
 *
 * Puur en gooit nooit onverwacht: als `cryptoSource.randomBytes` zelf gooit
 * (bijv. omdat een fake in een test kapot is), propageert die fout
 * ongewijzigd naar de aanroeper — deze functie vangt dat niet stilzwijgend
 * weg.
 *
 * @param {{ randomBytes: (size: number) => Buffer }} cryptoSource -
 *   geïnjecteerde `randomBytes`-achtige functie (bijv. `node:crypto`), zodat
 *   de functie testbaar is zonder de systeem-CSPRNG te monkeypatchen
 * @returns {string} de sessietoken: 43 tekens base64url (zonder padding),
 *   overeenkomend met 32 bytes/256 bit ruwe entropie
 */
export function generateSessionToken(cryptoSource) {
  return cryptoSource.randomBytes(32).toString('base64url');
}

/**
 * Hasht een sessietoken voor opslag volgens het in PR8a §3–4 gekozen
 * schema: `hex(HMAC_SHA256(key: pepper, message: token))`, via
 * `node:crypto`'s `createHmac('sha256', pepper).update(token).digest('hex')`,
 * uitgebreid in PR12 met een pepperversie-prefix zodat `verifyToken` later
 * kan opzoeken welke pepper bij een gegeven opgeslagen hash hoort (nodig om
 * pepper-rotatie te ondersteunen zonder alle bestaande sessies ongeldig te
 * maken). Geen trage wachtwoord-KDF (bcrypt/scrypt/argon2) — zie de afweging
 * in PR8a §3: het token is zelf al hoog-entropisch, dus een langzame KDF
 * kost hier alleen latency zonder evenredig veiligheidsvoordeel.
 *
 * Gedefinieerd gedrag bij een lege string (niet in PR8a vastgelegd, hier
 * gekozen implementatiedetail): een lege `token`, een lege `pepperConfig.
 * version` of een lege `pepperConfig.pepper` wordt **afgewezen met een
 * duidelijke `Error`**, in plaats van stilzwijgend een verrassende hash te
 * retourneren. Redenen: (1) een lege `pepper` zou de hele peppering-
 * strategie uit PR8a §4 stilzwijgend teniet doen — de HMAC-sleutel zou dan
 * leeg zijn, wat de dekking tegen een "Redis gecompromitteerd"-scenario
 * ongemerkt weghaalt; (2) een lege `token` kan nooit een geldig, door
 * `generateSessionToken` geproduceerd token zijn (dat levert altijd 43
 * tekens), dus is een lege string altijd een programmeerfout van de
 * aanroeper; (3) een lege `version` zou de opslagvorm `${version}:${hex}`
 * onbruikbaar maken voor `verifyToken`'s opzoekactie. Alle drie zijn dus
 * behandeld als een aanroepfout (`Error`), niet als "onverwachte" interne
 * breuk.
 *
 * PR12: signatuur bewust gewijzigd van `hashToken(token, pepper)` naar
 * `hashToken(token, { version, pepper })` — geen productiedata bestaat nog,
 * dus is er geen legacy-pad voor onversioned hashes.
 *
 * @param {string} token
 * @param {{ version: string, pepper: string }} pepperConfig - de *huidige*
 *   pepperversie waarmee dit token gehasht wordt; `version` identificeert de
 *   pepper in de opslagvorm zodat `verifyToken` 'm later kan terugvinden.
 * @returns {string} de opslagvorm zoals die (elders, niet in dit plan) in
 *   Redis wordt opgeslagen: `${version}:${hex-hash}`, waarbij het hex-deel
 *   64 tekens telt (SHA-256-digest-lengte)
 * @throws {Error} als `token`, `pepperConfig.version` of `pepperConfig.
 *   pepper` een lege string (of ontbrekend) is
 */
export function hashToken(token, pepperConfig) {
  if (token.length === 0) {
    throw new Error('hashToken: token mag geen lege string zijn');
  }
  const { version, pepper } = pepperConfig ?? {};
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('hashToken: pepperConfig.version mag geen lege string zijn');
  }
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('hashToken: pepperConfig.pepper mag geen lege string zijn');
  }
  const hexHash = createHmac('sha256', pepper).update(token).digest('hex');
  return `${version}${STORED_HASH_SEPARATOR}${hexHash}`;
}

/**
 * Verifieert een binnenkomende sessietoken tegen een opgeslagen hash
 * (PR12, `DECISIONS.md` punt 26: "verificatie gebruikt constant-time
 * vergelijking"). Leest de pepperversie uit `storedHash`, zoekt de
 * bijbehorende pepper op in `peppersByVersion`, hasht `token` opnieuw met
 * die pepper, en vergelijkt het resultaat met `node:crypto`'s
 * `timingSafeEqual` — nooit met `===`/`Buffer.equals` op stringniveau, juist
 * om te voorkomen dat een aanvaller via responstijd-verschillen byte voor
 * byte een geldige hash kan raden. `timingSafeEqual` gooit zelf een
 * `RangeError` bij ongelijke bufferlengte, dus die lengte wordt hier
 * expliciet vooraf gecontroleerd zodat deze functie nooit een onbehandelde
 * exception laat ontsnappen.
 *
 * Tijdens een pepper-rotatie kan `peppersByVersion` meerdere versies tegelijk
 * bevatten (bv. `{ v1: oldPepper, v2: currentPepper }`), zodat sessies die
 * met de oude pepper gehasht zijn nog steeds verifiëren totdat ze natuurlijk
 * verlopen of expliciet ingetrokken worden.
 *
 * Werpt nooit: elke vorm van vijandige of misvormde invoer (onbekende
 * versie, ontbrekende `:`-scheiding, ongeldige hex, ongelijke lengte)
 * levert `false` op, nooit een throw — dit draait op invoer die (indirect)
 * van een cliënt komt.
 *
 * @param {string} token - de binnenkomende, te verifiëren token.
 * @param {string} storedHash - vorm `${version}:${hex-hash}` uit `hashToken`.
 * @param {Record<string, string>} peppersByVersion - alle nog geldige
 *   peppers, bv. `{ v1: oudePepper, v2: huidigePepper }` — tijdens een
 *   rotatie blijven oude sessies verifieerbaar zolang hun versie hier nog
 *   in staat.
 * @returns {boolean} `false` bij een onbekende versie in `storedHash`, een
 *   malformed `storedHash` (geen `:`-scheiding, of ongeldige/oneven hex), een
 *   lengteverschil tussen opgeslagen en herberekende hash, of een niet-
 *   matchende hash — nooit een throw.
 */
export function verifyToken(token, storedHash, peppersByVersion) {
  if (typeof storedHash !== 'string') {
    return false;
  }
  const separatorIndex = storedHash.indexOf(STORED_HASH_SEPARATOR);
  if (separatorIndex === -1) {
    return false;
  }
  const version = storedHash.slice(0, separatorIndex);
  const storedHex = storedHash.slice(separatorIndex + 1);
  if (!HEX_BYTE_PAIRS_PATTERN.test(storedHex)) {
    return false;
  }
  const pepper = peppersByVersion?.[version];
  if (typeof pepper !== 'string' || pepper.length === 0) {
    return false;
  }
  const recomputedHex = createHmac('sha256', pepper).update(token).digest('hex');
  const storedBuffer = Buffer.from(storedHex, 'hex');
  const recomputedBuffer = Buffer.from(recomputedHex, 'hex');
  // timingSafeEqual gooit zelf een RangeError bij ongelijke lengte — expliciet
  // afvangen vóór de aanroep, zodat verifyToken hier nooit op struikelt.
  if (storedBuffer.length !== recomputedBuffer.length) {
    return false;
  }
  return timingSafeEqual(storedBuffer, recomputedBuffer);
}
