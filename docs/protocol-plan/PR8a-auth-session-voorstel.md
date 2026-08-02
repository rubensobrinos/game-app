# PR8a — Voorstel: sessionToken-generatie en -hashing

Status: **niet-bindend, wacht op menselijk akkoord** (zie Checkpoint onderaan). Dit
document bevat uitsluitend proza en illustratieve pseudocode. Er staat geen enkele
werkende functie-body in, en er hoort geen `.mjs`-bestand bij dit voorstel.

Dekt fase **PR8a** uit
[`prompts/PR8-session-token-proposal.md`](prompts/PR8-session-token-proposal.md) en de
`auth-session`-rij in [`README.md`](README.md)'s modulestabel.

## 1. Context en grenzen

Wat al vastligt en dus **niet** ter discussie staat in dit voorstel:

- De vórm van `sessionToken`: een bearer-string, meegestuurd als
  `Authorization: Bearer <sessionToken>` (REST) of als `auth.sessionToken` in de
  Socket.IO-handshake (`PROTOCOL.md`, §Authenticatie en tijdelijke sessies). Deze vorm
  is al gerealiseerd in `auth-shape` (PR3) en wordt hier niet gewijzigd.
- De vorm van de bijbehorende sessie: `{ roles: ["host"|"player", ...], playerId:
  string|null }` (`PROTOCOL.md`, zelfde sectie).
- Dat de server "alleen een hash" van de token bewaart, nooit de token zelf
  (`PROTOCOL.md` en `ARCHITECTURE.md` §4, letterlijk).
- Dat de token nooit via een event-payload reist (Basisregel 3) en nooit in de
  QR/deel-link terechtkomt — die draagt `inviteId`, een apart, publiek veld
  (`ARCHITECTURE.md` §5).

Dit voorstel gaat uitsluitend over **hoe** die token gegenereerd wordt (welk
algoritme, welke lengte) en **hoe** die vervolgens gehasht wordt voor opslag
(welk hash-schema, hoe een pepper daarin meegenomen wordt). Het raakt niet de
koppeling aan Redis, TTL's, of een revocation-mechanisme — zie §6.

## 2. Entropie- en algoritmekeuze voor tokengeneratie

Voorgestelde aanpak, op pseudocode-niveau:

```text
// pseudocode — alleen ter illustratie, geen implementatie
token = base64url_zonder_padding(randomBytes(N))
```

waarbij `randomBytes` de CSPRNG van `node:crypto` is (niet `Math.random()`, dat is
niet cryptografisch veilig) en `N` het aantal bytes ruwe entropie is, vóór encodering.

**Waarom base64url en niet hex.** Beide zijn veilig in een `Authorization`-header;
base64url (het alfabet uit RFC 4648 §5, dus `-`/`_` in plaats van `+`/`/`, zonder
`=`-padding) codeert dichter (4 tekens per 3 bytes tegenover 2 tekens per byte bij
hex), en is al de gangbare keuze voor bearer tokens (bv. JWT's gebruiken dezelfde
encodering). Geen padding-tekens voorkomt escaping-gedoe in headers/JSON.

**Afweging van `N`.**

- `N = 16` (128 bit entropie) → 22 tekens na base64url-encodering (zonder padding).
  128 bit is de entropie die courante richtlijnen (o.a. OWASP Session Management)
  als ondergrens voor sessie-identifiers noemen; UUIDv4, ter vergelijking, heeft
  slechts ~122 bit bruikbare entropie en wordt in de praktijk algemeen als
  toereikend beschouwd voor sessie-achtige tokens.
- `N = 32` (256 bit entropie) → 43 tekens na base64url-encodering (zonder padding).
  Ruim boven de gangbare ondergrens, met een aanzienlijke veiligheidsmarge tegen
  toekomstige verbeteringen in aanvalscapaciteit, tegen een verwaarloosbare
  meerkost: de token reist niet via een URL (zie §1) en de extra ~21 tekens zijn
  irrelevant voor een `Authorization`-header of een JSON-veld in de Socket.IO-
  handshake.

**Botsingskans.** Met de birthday-bound-benadering
`p ≈ n² / (2 · 2^bit)` geldt, zelfs bij een ruim overschatte `n` van 10 miljoen
ooit uitgegeven tokens over de hele levensduur van de app (dit is een quizspel,
geen wereldwijde schaal-dienst):

- bij 128 bit: `p ≈ (10^7)² / (2 · 2^128) ≈ 1,5 · 10⁻²⁵` — verwaarloosbaar.
- bij 256 bit: `p ≈ (10^7)² / (2 · 2^256) ≈` praktisch nul, ver onder elke
  meetbare drempel.

Met andere woorden: voor de verwachte schaal van dit spel (rooms met een handvol
sessies elk, geen miljoenen gelijktijdige rooms) is 128 bit al ruimschoots
toereikend; 256 bit voegt puur marge toe zonder praktisch nadeel.

**Aanbeveling:** `N = 32` (256 bit), niet omdat 128 bit onvoldoende zou zijn, maar
omdat de meerkost van 256 bit hier verwaarloosbaar is en het een royalere,
toekomstvaster marge geeft — zie de tabel in §5.

## 3. Hashingschema voor opslag

Voorgestelde aanpak, op pseudocode-niveau:

```text
// pseudocode — alleen ter illustratie, geen implementatie
storedHash = hex(HMAC_SHA256(key: pepper, message: token))
```

**Afweging: snelle cryptografische hash versus trage wachtwoord-KDF.**

Wachtwoord-KDF's (bcrypt/scrypt/argon2) bestaan om **laag-entropische, door mensen
gekozen** geheimen te beschermen: een wachtwoord als `"zomer2024!"` heeft misschien
30-40 bit praktisch haalbare entropie na aftrek van veelvoorkomende patronen, en een
aanvaller met een gestolen hash-database kan offline, met veel parallelle hardware,
miljarden gokken per seconde proberen. Een trage KDF maakt elke gok kunstmatig duur
(bijv. honderden milliseconden) om dat afdoende te vertragen.

Een `sessionToken` zoals hierboven voorgesteld is fundamenteel anders: het is zelf
al 128-256 bit CSPRNG-entropie, niet een door een mens onthouden of getypt geheim.
Een aanvaller die de opgeslagen hash heeft (bijv. via een Redis-dump) en het
token wil "raden", staat voor een zoekruimte van 2^128 tot 2^256 mogelijke
waarden — een KDF die elke gok 100× of 1000× duurder maakt, verandert daar
niets wezenlijks aan: het verschil tussen "onhaalbaar" en "nog onhaalbaarder" is
irrelevant, terwijl de kost wél reëel is. En die kost wordt hier vaker betaald dan
bij een wachtwoord: sessietoken-verificatie gebeurt potentieel bij elke
REST-call en elke Socket.IO-(re)connect, niet eenmalig bij inloggen. Een trage KDF
op dat pad voegt structurele latency en CPU-last toe zonder evenredig
veiligheidsvoordeel.

Een snelle, cryptografische hash (SHA-256, hier toegepast via een HMAC-constructie
— zie §4) is daarom passender: verwaarloosbare rekenkost per aanroep, en de
werkelijke beveiliging komt uit de entropie van de token zelf plus de pepper
(§4), niet uit het kunstmatig vertragen van de hashfunctie.

**Uitvoervorm.** SHA-256 (en dus ook HMAC-SHA256) levert een vaste 32-byte
digest. Als hex-string is dat exact 64 tekens — een vaste, makkelijk te
verifiëren lengte (relevant voor de latere PR8b-test op uitvoervorm).

**Aanbeveling:** HMAC-SHA256, hex-gecodeerd — zie de tabel in §5.

## 4. Peppering-strategie (proza/pseudocode, geen concrete waarde)

Een pepper verschilt van een salt: een salt is per record uniek en staat meestal
gewoon náást de hash in de opslag (niet geheim); een pepper is één
(of een klein, versieerbaar setje) server-side geheim dat **niet** in Redis
terechtkomt, en dus niet meekomt bij een eventuele Redis-dump.

Omdat de token hierboven al zijn eigen, per-sessie hoge entropie meebrengt, is een
aparte per-record salt niet nodig om het klassieke salt-doel te dienen (voorkomen
van precomputed/rainbow-table-aanvallen tegen veelvoorkomende, laag-entropische
invoerwaarden — die bestaan hier niet, elke token is uniek en willekeurig). De rol
van de pepper is hier een andere: een aanvaller die **alleen** de Redis-inhoud
buit (dus alle opgeslagen hashes) kan daarmee nog geen geldige token
fabriceren of een gok verifiëren, zolang die de pepper niet heeft. De pepper
voegt dus een tweede, los bewaard geheim toe aan het dreigingsmodel "Redis
gecompromitteerd" (`ARCHITECTURE.md` §4/§10).

Conceptueel combinatieschema:

```text
// pseudocode — alleen ter illustratie, geen implementatie
storedHash = hex(HMAC_SHA256(key: pepper, message: token))
```

De keuze voor een HMAC-constructie (in plaats van bijvoorbeeld
`sha256(token + pepper)` als platte string-concatenatie) is bewust: HMAC is de
gestandaardiseerde, formeel geanalyseerde manier om een geheime sleutel met een
hashfunctie te combineren, en voorkomt de subtiele constructiefouten die aan
naïeve concatenatie kleven. `node:crypto` biedt dit direct via
`crypto.createHmac('sha256', pepper)`.

**Uitdrukkelijk niet gekozen in dit voorstel:** een concrete peperwaarde, waar die
vandaan komt (`.env`, secrets manager, KMS), of hoe die geprovisioneerd/geroteerd
wordt. Dat raakt `TOKEN_PEPPER`/`.env`/productiesecrets en is expliciet buiten dit
plan (zie Brondocument in
[`prompts/PR8-session-token-proposal.md`](prompts/PR8-session-token-proposal.md)).
Ook een eventueel versioneringsschema voor pepper-rotatie (zodat een pepper-wissel
niet in één klap alle sessies ongeldig maakt) wordt hier niet uitgewerkt — zie de
open vraag in §7.

## 5. Afwegingstabel

| Alternatief | Voordeel | Nadeel | Aanbeveling |
| --- | --- | --- | --- |
| Token: `randomBytes(16)` → 128 bit, base64url | Korter (22 tekens); iets minder bytes per header/veld | 128 bit is precies de gangbare ondergrens (OWASP), dus minder marge voor toekomstige aanvalsverbeteringen | Niet gekozen |
| Token: `randomBytes(32)` → 256 bit, base64url | Ruime marge boven elke praktische botsingsdrempel (zie §2); verwaarloosbare meerkost omdat de token niet via een URL reist | Iets langere string (43 tekens) — in de praktijk irrelevant voor een header/JSON-veld | **Aanbevolen** |
| Hashing: HMAC-SHA256 (snel), hex-gecodeerd | Verwaarloosbare CPU-kost per auth-check, ook bij hoge verificatiefrequentie (elke request/reconnect); token is zelf al hoog-entropisch, dus brute-force blijft onhaalbaar ongeacht hashsnelheid | Beschermt niet tegen laag-entropische, door mensen gekozen geheimen — niet van toepassing hier | **Aanbevolen** |
| Hashing: bcrypt/scrypt/argon2 (traag, wachtwoord-KDF) | Vertraagt offline brute-force van laag-entropische geheimen (nuttig voor wachtwoorden) | Voegt structurele latency/CPU-last toe op een pad dat mogelijk bij élke request/reconnect wordt doorlopen, zonder evenredig voordeel: het token is geen laag-entropisch mensgekozen geheim | Niet gekozen |

## 6. Wat dit voorstel niet beslist

- **Redis-opslagvorm en TTL-koppeling** van `storedHash` aan een `Session`/`Room` —
  eigendom van `architecture-plan`/`data-model-plan`; dit voorstel levert
  hoogstens het hierboven beschreven hash-schema ter overname.
- **Revocation-levenscyclus** (`session:revoked`, koppeling aan `game:kick`) — een
  latere, aparte `auth`-stap, niet dit voorstel.
- **De daadwerkelijke bron/opslag/rotatie van de pepper-waarde** — `TOKEN_PEPPER`,
  `.env` of een secrets-manager-keuze; expliciet buiten dit plan (zie §4).
- **Constant-time vergelijking bij verificatie.** `hashToken()` zelf berekent
  alleen een hash; een latere verificatiefunctie (niet in de PR8b-scope van dit
  voorstel — die levert alleen `generateSessionToken`/`hashToken`) moet bij het
  vergelijken van een binnenkomende hash tegen de opgeslagen hash een
  constant-time vergelijking gebruiken (bv. `crypto.timingSafeEqual`) om
  timing-aanvallen te voorkomen. Dat is een implementatiedetail voor die latere
  stap, hier alleen benoemd zodat het niet vergeten wordt.
- **De vorm van `sessionToken`/`roles` zelf** — die ligt al vast in `PROTOCOL.md`
  en is gerealiseerd in `auth-shape` (PR3); dit voorstel wijzigt daar niets aan.

## 7. Openstaande vragen voor akkoord

Vraag expliciet akkoord (of een afwijkende keuze) op elk van de volgende punten
vóórdat PR8b start:

1. Akkoord met `randomBytes(32)` (256 bit) + base64url-zonder-padding als
   tokenformaat? (Alternatief: 16 bytes/128 bit, indien een voorkeur bestaat voor
   kortere tokens boven extra marge.)
2. Akkoord met HMAC-SHA256(pepper, token), hex-gecodeerd, als hashingschema —
   in plaats van een trage KDF (bcrypt/scrypt/argon2)?
3. Akkoord dat peppering hier alleen conceptueel wordt vastgelegd
   (`storedHash = HMAC_SHA256(pepper, token)`), zonder een keuze over
   pepper-opslag, -bron of -rotatie — dat blijft een latere, aparte `auth`-stap?
4. Moet dit voorstel al een pepper-versioneringsschema schetsen voor toekomstige
   rotatie (zodat een pepper-wissel niet in één klap alle actieve sessies
   ongeldig maakt), of is dat expliciet uit scope voor nu en pas relevant bij die
   latere stap?
5. Is de constant-time-vergelijkingseis in §6 voldoende benoemd als aandachtspunt
   voor een latere verificatiefunctie, of moet dit voorstel daar al iets
   concreters over vastleggen?

## Checkpoint — wacht op bevestiging vóór PR8b

Dit voorstel is niet-bindend. **Er wordt geen enkele regel
`generateSessionToken()`- of `hashToken()`-code geschreven totdat een mens dit
document expliciet beoordeelt en akkoord geeft** (op de voorstellen in §2–§5,
of op een expliciet afwijkend alternatief) — pas dan begint PR8b, zoals
vastgelegd in de Checkpoint-sectie van
[`prompts/PR8-session-token-proposal.md`](prompts/PR8-session-token-proposal.md).
