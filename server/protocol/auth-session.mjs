/**
 * @file Sessietoken-generatie en -hashing — realiseert PROTOCOL.md
 * §Authenticatie en tijdelijke sessies, volgens het PR8a-voorstel na
 * bevestiging (zie ../../docs/protocol-plan/README.md fase PR8,
 * ../../docs/protocol-plan/prompts/PR8-session-token-proposal.md).
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
 * `hashToken` importeert `node:crypto` wél rechtstreeks voor
 * `createHmac`/`digest`: dat pad bevat geen randomness, dus speelt het
 * testbaarheidsprobleem daar niet.
 *
 * `pepper` komt bij `hashToken` als argument binnen; waar die vandaan komt
 * (`.env`, secrets manager, rotatie) valt buiten dit plan (zie PR8a §4/§6) —
 * deze module scheidt uitdrukkelijk "hoe genereren/hashen we" (hier) van
 * "waar komt de pepper vandaan" (elders).
 */
import { createHmac } from 'node:crypto';

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
 * `node:crypto`'s `createHmac('sha256', pepper).update(token).digest('hex')`.
 * Geen trage wachtwoord-KDF (bcrypt/scrypt/argon2) — zie de afweging in
 * PR8a §3: het token is zelf al hoog-entropisch, dus een langzame KDF kost
 * hier alleen latency zonder evenredig veiligheidsvoordeel.
 *
 * Gedefinieerd gedrag bij een lege string (niet in PR8a vastgelegd, hier
 * gekozen implementatiedetail): een lege `token` of een lege `pepper` wordt
 * **afgewezen met een duidelijke `Error`**, in plaats van stilzwijgend een
 * verrassende hash te retourneren. Redenen: (1) een lege `pepper` zou de
 * hele peppering-strategie uit PR8a §4 stilzwijgend teniet doen — de HMAC-
 * sleutel zou dan leeg zijn, wat de dekking tegen een "Redis gecompromit-
 * teerd"-scenario ongemerkt weghaalt; (2) een lege `token` kan nooit een
 * geldig, door `generateSessionToken` geproduceerd token zijn (dat levert
 * altijd 43 tekens), dus is een lege string altijd een programmeerfout van
 * de aanroeper, niet een geldige invoer om stil te verwerken. Beide gevallen
 * zijn dus behandeld als een aanroepfout (`Error`), niet als "onverwachte"
 * interne breuk.
 *
 * @param {string} token
 * @param {string} pepper - server-side geheim; herkomst/opslag van deze
 *   waarde valt buiten dit plan (`prod`/`.env`, zie PR8a §4/§6)
 * @returns {string} de waarde zoals die (elders, niet in dit plan) in Redis
 *   wordt opgeslagen: 64 hex-tekens (SHA-256-digest-lengte)
 * @throws {Error} als `token` of `pepper` een lege string is
 */
export function hashToken(token, pepper) {
  if (token.length === 0) {
    throw new Error('hashToken: token mag geen lege string zijn');
  }
  if (pepper.length === 0) {
    throw new Error('hashToken: pepper mag geen lege string zijn');
  }
  return createHmac('sha256', pepper).update(token).digest('hex');
}
