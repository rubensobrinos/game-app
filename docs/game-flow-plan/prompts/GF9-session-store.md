# Prompt — GF9: Session-store

Onderdeel van [`../README.md`](../README.md), fase GF9 (nieuw, stond al in de
oorspronkelijke moduletabel maar miste een fasenummer — zie `GF-PROGRESS.md`). Doel:
het sessietoken + minimale herstelgegevens lokaal bewaren/lezen, zodat reconnect
(GF4) in de praktijk iets heeft om mee te authenticeren. Prioriteit boven GF10/GF11
omdat GF4 hier functioneel van afhangt.

## Brondocument

`DATA-MODEL.md` §Lokale clientsessie: "uitsluitend de tijdelijke bearer token en
minimale herstelgegevens in browserstorage." `GAME-FLOW.md` Randgeval 2:
"sessietoken blijft lokaal bewaard; client probeert automatisch te rejoinen."
`ARCHITECTURE.md` §4: cryptografisch willekeurige bearer token per room, geen
account.

## Ontwerpkeuze: storage geïnjecteerd, niet global `localStorage`

Dit is de eerste `client/flow`-module die *wél* écht iets persisteert — dat is haar
hele bestaansreden, dus de "geen side effects"-lijn uit Uitgangspunt 1 geldt hier
anders dan bij de andere modules. Om toch zonder DOM/browser te kunnen testen met
`node --test`, nemen alle functies een `storage`-object als parameter
(`{ getItem, setItem, removeItem }` — exact de vorm van de Web Storage-API), in
plaats van zelf `localStorage` aan te roepen. Wiring-tijd geeft straks gewoon het
echte `localStorage`-object door; geen adapter nodig. Of dat `localStorage` of
`sessionStorage` wordt, is een wiring-keuze — deze module is storage-agnostisch en
neemt die beslissing niet.

**Geverifieerd:** de bestaande singleplayer-app gebruikt `localStorage`-sleutels
`gameapp.state` en `gameapp.highscores` (`app.js` regel 440–441). De hieronder
voorgestelde sleutelnaamgeving (`mp:session:{roomCode}`) botst daar niet mee.

## Te bouwen module

Bestand: `client/flow/session-store.mjs`.

```js
/**
 * @typedef {{
 *   sessionToken: string,
 *   roomCode: string,
 *   playerId: string | null,
 *   savedAt: number,
 * }} StoredSession
 *
 * @typedef {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 * }} StorageLike
 */

/** @param {string} roomCode @returns {string} */
export function storageKeyFor(roomCode) {}

/** @param {StorageLike} storage @param {StoredSession} session */
export function saveSession(storage, session) {}

/**
 * @param {StorageLike} storage
 * @param {string} roomCode
 * @returns {StoredSession | null}
 */
export function loadSession(storage, roomCode) {}

/** @param {StorageLike} storage @param {string} roomCode */
export function clearSession(storage, roomCode) {}
```

## Regels

- `storageKeyFor(roomCode)` → `` `mp:session:${roomCode}` ``. Vast, voorspelbaar,
  genamespaced.
- `saveSession`/`clearSession` mogen doorgeven wat `storage.setItem`/`removeItem`
  zelf gooit (bijv. quota exceeded in een echte browser) — dat is een genuine
  I/O-fout van de aanroeper's storage, niet iets dit deze module kan of moet
  opvangen.
- `loadSession` gooit **nooit**, wat er ook in storage staat. Ongeldige JSON,
  ontbrekende velden, een verkeerd type, of een `roomCode` binnen de opgeslagen data
  die niet overeenkomt met het gevraagde `roomCode` (defensieve consistentiecheck,
  ook al is de sleutel zelf al room-specifiek) — in elk van die gevallen: `null`.
  Browserstorage is onvertrouwde data (kan handmatig gewijzigd zijn via devtools, of
  achtergebleven van een oudere appversie met een ander schema).
- Geen eigen TTL/leeftijdscontrole op `savedAt` — of een sessie nog geldig is, blijkt
  uit de eerstvolgende serverreactie (`TOKEN_EXPIRED`, `GAME_NOT_FOUND`), niet uit een
  lokale gok over hoe oud "te oud" is.
- `sessionToken` wordt alleen op "niet-lege string" gecontroleerd — er is geen
  gedocumenteerd vast formaat om verder op te valideren.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `storageKeyFor('482917')` | exact `'mp:session:482917'` |
| 2 | `saveSession` gevolgd door `loadSession` met dezelfde `roomCode` | levert een object gelijk aan wat werd opgeslagen |
| 3 | `loadSession` voor een `roomCode` waar niets voor is opgeslagen | `null` |
| 4 | `loadSession` wanneer de opgeslagen waarde ongeldige JSON is | `null`, geen throw |
| 5 | `loadSession` wanneer de JSON geldig is maar `sessionToken` ontbreekt of geen string is | `null` |
| 6 | `loadSession` wanneer de opgeslagen `roomCode` niet overeenkomt met het gevraagde `roomCode` | `null` |
| 7 | `clearSession` gevolgd door `loadSession` | `null` |
| 8 | `saveSession`/`loadSession` met `playerId: null` (host die niet meespeelt) | rondtrip behoudt `null` exact |
| 9 | Een fake `storage` waarvan `setItem` een `Error` gooit | `saveSession` laat die error doorgaan (geen silent swallow) |
| 10 | Twee verschillende `roomCode`-waarden in dezelfde `storage` | elk `loadSession` levert alleen zijn eigen sessie, geen kruisbesmetting |

Gebruik in de tests een simpele in-memory `StorageLike`-fake (bijvoorbeeld een
`Map`-backed object) — geen echte browser nodig.

## Niet in scope voor GF9

- De keuze `localStorage` vs. `sessionStorage` — wiring-tijd, niet deze module.
- Automatisch rejoinen na het laden van een sessie — dat is `reconnect-state` (GF4)
  en de nog te bouwen wiring-laag, niet deze module.
- Multi-tab-synchronisatie (bijv. via het `storage`-event) — niet gevraagd door de
  bron, niet toevoegen.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/session-store.test.mjs`.
- `loadSession` gooit nooit, voor geen enkele malformed input uit de tabel.
- Geen enkele functie roept `window.localStorage`/`sessionStorage` rechtstreeks aan —
  storage is altijd een parameter.
