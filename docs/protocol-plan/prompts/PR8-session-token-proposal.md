# Prompt — PR8: Voorstel sessie/tokenmodule

Dekt fase **PR8** uit [`../README.md`](../README.md#fasering) (`auth`, niet-bindend,
checkpoint vóór code). Kopieer alles onder **Prompt** naar een nieuwe sessie/agent-
aanroep. Dit bestand is zelfstandig leesbaar, zonder kennis van enig eerder gesprek.

> **Waarschuwing vooraf, geldig voor de hele rest van dit bestand:** dit is de enige
> fase in `protocol-plan` die een `auth`-beslissing raakt. Dit promptbestand voert je
> **nooit** automatisch door naar codeschrijven. Stap 1 hieronder (PR8a) levert
> uitsluitend een schriftelijk voorstel — geen enkele functie-body. Pas ná de
> expliciete bevestiging in de Checkpoint-sectie mag Stap 3 (PR8b) beginnen. Voer geen
> stap uit door de vorige over te slaan, ook niet "om vast te testen" of "als
> voorlopige versie".

---

## Prompt

Je werkt in de repo `game-app`. Lees, voordat je begint:

- [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md), sectie
  **Authenticatie en tijdelijke sessies**.
- [`docs/multiplayer/ARCHITECTURE.md`](../../multiplayer/ARCHITECTURE.md), §4
  ("Tijdelijke sessies, geen accounts").
- [`../README.md`](../README.md), Uitgangspunt 1, de modulestabel-rij
  `auth-session`, fase **PR8**, en de sectie **Wat hier expliciet buiten valt**
  (het `TOKEN_PEPPER`/`.env`-punt).
- `server/protocol/envelope.mjs`/`idempotency.mjs` (bestaande PR1-code — stijl:
  platte `.mjs`, JSDoc, functies die nooit gooien).

### Brondocument

`PROTOCOL.md`, sectie **Authenticatie en tijdelijke sessies**, letterlijk:

> Er bestaan geen accounts.
>
> Een `sessionToken` is een cryptografisch willekeurige bearer token voor één room. De
> server bewaart alleen een hash. De bijbehorende sessie bevat rollen:
>
> ```json
> {
>   "roles": ["host", "player"],
>   "playerId": "p_8f42d1"
> }
> ```

`ARCHITECTURE.md` §4, letterlijk:

> Elke browser krijgt een cryptografisch willekeurige bearer token voor één room. De
> token verwijst naar een tijdelijke `Session` met rollen: ... Tokens worden alleen
> gehasht in Redis opgeslagen en vervallen met de room.

`../README.md`, Uitgangspunt 1, letterlijk:

> Dit onderscheid geldt ook ván binnen één en dezelfde spec-sectie: bij
> §Authenticatie en tijdelijke sessies is de vórm van `sessionToken`/`roles` en de
> handshake-payload (a) — letterlijk coderen — terwijl het kiezen van een
> generatie-/hashingalgoritme voor die token (b) is, ook al oogt het als "maar" een
> pure functie.

`../README.md`, modulestabel-rij `auth-session`, letterlijk:

> `auth-session` (voorstel, niet-bindend, checkpoint vóór code) | daadwerkelijke
> `generateSessionToken()`/`hashToken()`-functielichamen (algoritme, entropie,
> peppering) — expliciet géén vorm-validatie, die zit in `auth-shape` |
> §Authenticatie en tijdelijke sessies

`../README.md`, fase PR8, letterlijk (volledig, dit ís de fasering die je hieronder
uitvoert):

> - **PR8a — Schriftelijk voorstel, geen code:** algoritme-keuze (bv. `node:crypto`
>   `randomBytes`-lengte/entropie-doel), hashingschema en peppering-strategie als
>   proza/pseudocode, met een afweging tussen alternatieven. Dit voorstel bevat
>   uitdrukkelijk **geen** `generateSessionToken()`/`hashToken()`-implementatie — het
>   kiezen van een generatie-/hashingaanpak ís al de `auth`-beslissing zelf, niet
>   alleen de koppeling aan Redis-sessieopslag.
> - **Checkpoint:** ik vraag expliciet akkoord op dit voorstel vóórdat ik ook maar één
>   regel `generateSessionToken()`/`hashToken()`-code schrijf. Zonder akkoord stopt dit
>   plan hier.
> - **PR8b — Pas na akkoord:** `generateSessionToken()` en `hashToken()` als pure
>   functies, getest op formaat, entropie en hash-consistentie (zelfde patroon als
>   `architecture-plan`'s `room-codes`/AR2) — nog steeds **niet** op echte opslag of
>   revocation-levenscyclus; dat blijft een aparte, latere `auth`-stap.

`../README.md`, sectie **Wat hier expliciet buiten valt**, letterlijk (relevant
fragment):

> Alles wat `TOKEN_PEPPER`, `.env` of productie-secrets raakt.

### Stap 1 — PR8a: schriftelijk voorstel (geen code)

Lever een los reviewdocument op: `docs/protocol-plan/PR8a-auth-session-voorstel.md`.
Dit document bevat proza/pseudocode — **geen enkele werkende functie-body, geen
`.mjs`-bestand**. Behandel minimaal:

1. **Context en grenzen.** Herhaal kort wat al vastligt en dus *niet* ter discussie
   staat in dit voorstel: de vorm van `sessionToken` (bearer string), `roles`/
   `playerId` (uit `PROTOCOL.md`), en dat de server "alleen een hash" bewaart. Dit
   voorstel gaat alleen over hóe die token gegenereerd en gehasht wordt.
2. **Entropie/algoritme-keuze.** Pseudocode-niveau, bijvoorbeeld
   `token = base64url(randomBytes(N))`, met een afweging van minstens twee
   `N`-waarden (bijv. 16 vs. 32 bytes) op entropie, tokenlengte in headers/URL's, en
   botsingskans bij het verwachte aantal gelijktijdige rooms.
3. **Hashingschema voor opslag.** Vergelijk minstens twee alternatieven, bijvoorbeeld
   een snelle cryptografische hash (zoals SHA-256) tegenover een langzame
   wachtwoord-KDF (zoals bcrypt/scrypt/argon2), met een expliciete afweging: een
   `sessionToken` is zelf al hoog-entropisch en willekeurig (in tegenstelling tot een
   door mensen gekozen wachtwoord), dus een langzame KDF kost latency zonder
   evenredig veiligheidsvoordeel — of leg uit waarom dat afwegingspunt in dit geval
   ánders uitpakt.
4. **Peppering-strategie, als proza/pseudocode.** Beschrijf hoe een server-side pepper
   conceptueel met de hash gecombineerd wordt (bijv.
   `storedHash = hash(token, pepper)`), zónder een concrete peperwaarde, opslagplek of
   provisioneringsmechanisme te kiezen — dat raakt `TOKEN_PEPPER`/`.env`/
   productiesecrets en is expliciet buiten dit plan (zie Brondocument hierboven).
5. **Afwegingstabel.** Eén tabel: alternatief, voordeel, nadeel, aanbeveling — voor
   zowel de entropie-/algoritmekeuze als de hashingkeuze.
6. **Wat dit voorstel niet beslist.** Redis-opslag/TTL-koppeling, revocation
   (`session:revoked`), en de daadwerkelijke bron van de pepper-waarde — die blijven
   bij `architecture-plan`/`data-model-plan` resp. een latere, aparte `auth`-stap.

Presenteer dit document daarna expliciet ter goedkeuring. Ga pas verder na een
reactie.

## Checkpoint — wacht op bevestiging vóór code

**Wacht op expliciete bevestiging van de gebruiker/mens die `PROTOCOL.md` accordeert
vóórdat ook maar één regel `generateSessionToken()`- of `hashToken()`-code wordt
geschreven.** Dit geldt voor élke regel token-generatie- of hashingcode — niet alleen
voor de koppeling aan Redis-opslag, sessiebeheer of revocation. Zonder dit akkoord
stop je hier: geen `.mjs`-bestand, geen "even snel de pseudocode omzetten in echte
code om te kijken of het werkt", geen voorlopige implementatie "die we later toch
herzien". Als de bevestiging uitblijft of afwijkend is (bijv. een andere
algoritmekeuze dan voorgesteld), verwerk je dat als een wijziging op het PR8a-voorstel
en leg je het opnieuw voor — je schrijft niet alvast code op de aanname dat het wel
goedgekeurd zal worden.

### Stap 3 — PR8b: pure functies (uitsluitend na de Checkpoint hierboven)

Bouw, exact volgens de in PR8a goedgekeurde aanpak, twee pure functies in
`server/protocol/auth-session.mjs`. De signaturen hieronder zijn het doelcontract voor
ná de Checkpoint — schrijf de function-bodies niet eerder.

```js
/**
 * @file Sessietoken-generatie en -hashing — realiseert PROTOCOL.md
 * §Authenticatie en tijdelijke sessies, volgens het PR8a-voorstel na
 * bevestiging (zie ../README.md fase PR8, ../PR8-session-token-proposal.md).
 * @see docs/protocol-plan/PR8a-auth-session-voorstel.md — de geaccordeerde
 *   algoritme-/hashing-/peppering-keuze die deze module implementeert.
 *
 * Pure functies: geen Redis, geen sessiebeheer, geen revocation. `crypto` en
 * `pepper` komen altijd als argument binnen, nooit via een module-brede
 * import van `node:crypto` of een gelezen env-variabele — dat houdt de
 * functies deterministisch testbaar en scheidt "hoe genereren/hashen we"
 * (hier) van "waar komt de pepper vandaan" (buiten dit plan).
 */

/**
 * Genereert een cryptografisch willekeurige sessietoken volgens het in PR8a
 * gekozen entropie-doel en encoderingsformaat.
 *
 * @param {{ randomBytes: (size: number) => Buffer }} cryptoSource -
 *   geïnjecteerde `randomBytes`-achtige functie (bijv. `node:crypto`), zodat
 *   de functie testbaar is zonder de systeem-CSPRNG te monkeypatchen
 * @returns {string} de sessietoken in het PR8a-gekozen formaat (bijv.
 *   base64url)
 */
export function generateSessionToken(cryptoSource) {
  /* ... */
}

/**
 * Hasht een sessietoken voor opslag, volgens het in PR8a gekozen algoritme en
 * peppering-schema.
 *
 * @param {string} token
 * @param {string} pepper - server-side geheim; herkomst/opslag van deze
 *   waarde valt buiten dit plan (`prod`/`.env`)
 * @returns {string} de waarde zoals die (elders, niet in dit plan) in Redis
 *   wordt opgeslagen
 */
export function hashToken(token, pepper) {
  /* ... */
}
```

### Verplichte testgevallen (uitsluitend voor PR8b, na de Checkpoint)

| # | Functie | Scenario | Verwacht |
| --- | --- | --- | --- |
| 1 | `generateSessionToken` | injecteer een deterministische fake `randomBytes` (vaste bytes) | deterministieke, reproduceerbare outputstring — bewijst dat er geen verborgen globale randomness gebruikt wordt |
| 2 | `generateSessionToken` | output-vorm | string voldoet aan het in PR8a gekozen encoderingsformaat/lengte (bijv. exacte base64url-lengte voor N bytes) |
| 3 | `generateSessionToken` | 1000 aanroepen met een échte `randomBytes` | geen enkele botsing binnen deze steekproef (smoke test, geen entropiebewijs) |
| 4 | `hashToken` | zelfde `token` + zelfde `pepper`, twee aanroepen | identieke hash (determinisme) |
| 5 | `hashToken` | zelfde `token`, verschillende `pepper` | verschillende hash |
| 6 | `hashToken` | verschillende `token`, zelfde `pepper` | verschillende hash |
| 7 | `hashToken` | output-vorm | lengte/encodering komt exact overeen met het in PR8a gekozen hash-algoritme (bijv. hex-lengte van een SHA-256-digest) |
| 8 | `hashToken` | lege string als `token` of als `pepper` | expliciet gedefinieerd gedrag uit PR8a (afwijzen met een duidelijke fout, of expliciet toegestaan) — niet stilzwijgend een verrassende hash |
| 9 | integratie | `hashToken(generateSessionToken(realRandomBytes), pepper)` | slaagt zonder foutieve type-aannames tussen beide functies (bijv. Buffer- vs. string-verwarring) |

### Niet in scope

**Voor PR8a:**
- Elke vorm van functie-body, `.mjs`-bestand of "voorlopige implementatie" — dit is
  uitsluitend een schriftelijk voorstel.
- Een concrete `TOKEN_PEPPER`-waarde, `.env`-variabele of secrets-manager-keuze —
  alleen het conceptuele combinatieschema (proza/pseudocode).
- Redis-opslagvorm en TTL-koppeling — `architecture-plan`/`data-model-plan`.

**Voor PR8b (en alleen relevant ná de Checkpoint):**
- Echte Redis-opslag van de hash, sessie-TTL, of de koppeling aan `Room`/`Session` uit
  `DATA-MODEL.md`.
- Revocation-levenscyclus (`session:revoked`, kick-koppeling uit `game:kick`).
- De daadwerkelijke bron/provisionering van de pepper-waarde in productie.
- Elke aanpassing aan de `sessionToken`/`roles`-vórm zelf uit `PROTOCOL.md` — die vorm
  ligt al vast en hoort bij `auth-shape` (PR3), niet bij dit voorstel.
- Doorgaan naar Stap 3 zonder de Checkpoint-bevestiging — dat is geen "niet in
  scope"-detail maar een harde stop, zie hierboven.

### Definition of done

- **PR8a:** `docs/protocol-plan/PR8a-auth-session-voorstel.md` bestaat, bevat geen
  enkele functie-body, en bevat voor zowel de entropie-/algoritmekeuze als de
  hashingkeuze een afweging tussen minstens twee alternatieven plus een expliciete
  aanbeveling.
- **Checkpoint:** een expliciete bevestiging van de gebruiker/mens die `PROTOCOL.md`
  accordeert is ontvangen en aantoonbaar (bijv. aangehaald of verwezen) vóórdat Stap 3
  begint. Zonder die bevestiging eindigt de uitvoering van dit prompt bij Stap 1.
- **PR8b (alleen na akkoord):** `generateSessionToken` en `hashToken` bestaan in
  `server/protocol/auth-session.mjs`, geïmplementeerd exact volgens de goedgekeurde
  PR8a-keuze, met alle 9 testgevallen groen via
  `node --test server/protocol/auth-session.test.mjs`. Geen Redis-, opslag- of
  revocation-code in dit bestand.
- Past binnen de autonomiegrens uit `CLAUDE.md` (≤15 bestanden, ≤5.000 regels per actie);
  PR8a en PR8b zijn hoe dan ook al gesplitst door de Checkpoint, dus dit past ruim.
