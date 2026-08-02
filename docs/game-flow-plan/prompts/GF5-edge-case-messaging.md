# Prompt — GF5: Edge-case-messaging

Onderdeel van [`../README.md`](../README.md), fase GF5. Doel: servercodes/-redenen →
berichtsleutel. Geen vertaling, geen JSX/DOM — alleen opzoekwerk met een veilige
fallback.

## Bronnen

`PROTOCOL.md` §Foutcodes (23 codes, exhaustief opgesomd). `GAME-FLOW.md`
§Randgevallen 1–14. `PRODUCT.md` §Talen: "technische foutcodes worden client-side
vertaald" — dat betekent dat de foutcode zelf al vaak de facto de sleutel is; de
vertaallaag (niet dit plan) zet 'm om naar NL/EN/ES-tekst.

## Herziening t.o.v. de oorspronkelijke module-omschrijving

Het plan noemde dit "14 randgevallen → sleutel", alsof er 14 losse mappings nodig
zijn. Bij het uitwerken blijkt dat onjuist: verschillende randgevallen delen dezelfde
foutcode, hebben helemaal geen foutmelding nodig, of horen bij een andere module.
Onderstaande tabel is de eerlijke uitwerking, geen mechanische 1-op-1-vertaling van
de 14 kopjes.

| # (GAME-FLOW.md) | Wat er echt gebeurt | Hoort hier? |
| --- | --- | --- |
| 1. Host disconnect | pauzereden (voorgesteld, ongeconfirmeerd) | ja — `messageForPauseReason` |
| 2. Speler reconnect | `reconnect-state` (GF4) status | ja — `messageForConnectionStatus` |
| 3. Late join geweigerd / room locked | `LATE_JOIN_DISABLED` / `ROOM_LOCKED` | ja — `messageForErrorCode` |
| 4. Dubbele naam | server lost dit stil op | **nee** — geen melding nodig |
| 5. Geen naam | server genereert er één, stil | **nee** — geen melding nodig |
| 6. Niemand antwoordt → pauze | pauzereden (voorgesteld) | ja, voor de melding; de host-keuze Doorgaan/Beëindigen zelf is hostbediening, niet messaging |
| 7. Te laat antwoord | `DEADLINE_PASSED` | ja |
| 8. Room vol | `GAME_FULL` | ja |
| 9. Ongeldige/verlopen uitnodiging | `GAME_NOT_FOUND` / `INVITE_INVALID` | ja |
| 10. Kick | `session:kicked` | ja — `messageForSessionTermination` |
| 11. Vrijwillig verlaten | bevestigingsdialoog vóóraf | **nee** — geen serverstatus, hoort bij een nog niet gebouwde "verlaat room"-actie |
| 12. Rematch | `game:rematch-started` | optioneel, neutrale vaste sleutel — lage prioriteit |
| 13. Room-TTL verlopen | **exact dezelfde code als #9** | ja, maar géén apart geval — zie hieronder |
| 14. Serverherstart | reconnect + snapshot, geen apart signaal | **nee** — al gedekt door #1/#2 |

**Belangrijk:** `PROTOCOL.md`'s foutcodelijst heeft geen `ROOM_EXPIRED` of
vergelijkbaar. Een verlopen room en een nooit-bestaan-hebbende room zijn voor de
client ononderscheidbaar — beide leveren `GAME_NOT_FOUND`/`INVITE_INVALID` op. Deze
module verzint dus geen apart "verlopen"-bericht voor #13; dat zou een precisie
suggereren die het wire-contract niet biedt.

## Open spec-vraag — niet door mij op te lossen

`PROTOCOL.md` noemt voor `game:paused` alleen "reden, vorige fase" als kernpayload,
zonder de mogelijke waarden van `reason` op te sommen. `DATA-MODEL.md`'s
`pausedState`-voorbeeld toont `"reason": "host"` maar dat is één voorbeeld, geen
uitputtende enum. Ik gok op de waarden `host_disconnected` en `no_answers` als
redelijke namen voor randgevallen 1 en 6, maar dat is een `public_api`-detail dat de
`PROTOCOL.md`-eigenaar moet vastleggen. Vandaar de expliciete fallback hieronder voor
elke onbekende/toekomstige reason-waarde.

## Te bouwen module

Bestand: `client/flow/edge-case-messaging.mjs`.

```js
const KNOWN_ERROR_CODES = new Set([
  'GAME_NOT_FOUND', 'INVITE_INVALID', 'GAME_FULL', 'GAME_ALREADY_STARTED',
  'LATE_JOIN_DISABLED', 'ROOM_LOCKED', 'CODE_RATE_LIMITED',
  'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SESSION_REVOKED', 'NOT_HOST', 'NOT_PLAYER',
  'INVALID_PHASE', 'ROUND_NOT_ACTIVE', 'PLAYER_NOT_ELIGIBLE', 'ALREADY_ANSWERED',
  'DEADLINE_PASSED', 'INVALID_ANSWER_FORMAT', 'UNSUPPORTED_EVENT',
  'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED', 'PROTOCOL_VERSION_UNSUPPORTED',
]);

/** @param {string} errorCode @returns {string} */
export function messageForErrorCode(errorCode) {}

/** @param {string | null | undefined} reason @returns {string} */
export function messageForPauseReason(reason) {}

/**
 * @param {'connected' | 'disconnected' | 'reconnecting'} status
 * @returns {string | null} null voor 'connected' — niets te tonen
 */
export function messageForConnectionStatus(status) {}

/** @param {'kicked' | 'revoked'} kind @param {string | null} [reason] @returns {string} */
export function messageForSessionTermination(kind, reason) {}
```

## Regels

- `messageForErrorCode`: een code uit `KNOWN_ERROR_CODES` komt **ongewijzigd**
  terug (de code IS de sleutel, per `PRODUCT.md` §Talen). Alles anders — een
  onbekende toekomstige code, `null`, een niet-string — geeft de vaste fallback
  `'UNKNOWN_ERROR'`, nooit een throw en nooit de rauwe onbekende waarde
  doorgegeven (die kan een halve JSON-fout of iets onverwachts zijn).
- `messageForPauseReason`: bekende waarden `'host_disconnected'` en `'no_answers'`
  geven `'pause.host_disconnected'` resp. `'pause.no_answers'`. Alles anders
  (`null`, `undefined`, onbekende toekomstige reden) geeft `'pause.unknown'` — nooit
  een throw, nooit een verzonnen specifieke tekst voor een reden die niet bevestigd
  is.
- `messageForConnectionStatus('connected')` geeft `null` (niets te tonen — "niet-
  blokkerend" betekent ook: geen ruis als alles goed gaat). `'disconnected'` en
  `'reconnecting'` geven elk hun eigen sleutel.
- `messageForSessionTermination`: `'kicked'` → `'session.kicked'`, `'revoked'` →
  `'session.revoked'`. Een onbekende `kind` geeft `'session.unknown'`, geen throw.
  `reason` wordt momenteel niet in de sleutel verwerkt (er is geen bevestigde
  reason-enum voor kick/revoke) — puur doorgegeven aan de aanroeper als optioneel
  metadata, niet in deze functies zelf gebruikt.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `messageForErrorCode` voor elk van de 22 bekende codes | elk exact ongewijzigd terug |
| 2 | `messageForErrorCode('ROOM_EXPIRED')` (bestaat niet in de spec) | `'UNKNOWN_ERROR'` — bewijst dat er geen verzonnen code voor randgeval 13 bestaat |
| 3 | `messageForErrorCode(null)`, `messageForErrorCode(undefined)`, `messageForErrorCode(42)` | elk `'UNKNOWN_ERROR'`, geen throw |
| 4 | `messageForPauseReason('host_disconnected')` en `messageForPauseReason('no_answers')` | `'pause.host_disconnected'`, `'pause.no_answers'` |
| 5 | `messageForPauseReason(null)`, `messageForPauseReason('some_future_reason')` | beide `'pause.unknown'` |
| 6 | `messageForConnectionStatus('connected')` | `null` |
| 7 | `messageForConnectionStatus('disconnected')` en `('reconnecting')` | elk een eigen, niet-lege sleutel, en de twee onderling verschillend |
| 8 | `messageForConnectionStatus('bogus')` | geen throw; iets zinnigs (fallback of `null`) — kies één gedrag en test dat exact |
| 9 | `messageForSessionTermination('kicked')` en `('revoked')` | `'session.kicked'`, `'session.revoked'` |
| 10 | `messageForSessionTermination('bogus')` | `'session.unknown'`, geen throw |
| 11 | `messageForErrorCode('GAME_NOT_FOUND')` en `messageForErrorCode('INVITE_INVALID')` | beide ongewijzigd — bewijst dat randgeval 9 én 13 op dezelfde twee codes uitkomen, geen apart pad |

## Niet in scope voor GF5

- Daadwerkelijke vertaling naar NL/EN/ES-tekst — dat is de bestaande vertaallaag.
- De host-keuze `Doorgaan`/`Beëindigen` na drie lege rondes (randgeval 6) — dat is
  een actie-aanbod voor hostbediening, geen berichtsleutel.
- De bevestigingsdialoog vóór vrijwillig verlaten (randgeval 11) — geen
  serverstatus om op te reageren, hoort bij een nog niet gebouwde
  "verlaat room"-actie.
- Randgevallen 4, 5 en 14 — geen aparte melding nodig, zie de tabel hierboven.
- Zelf luisteren naar sockets/events — deze module krijgt een code/reden/status
  aangereikt, ze haalt niets zelf op.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/edge-case-messaging.test.mjs`.
- Geen enkele functie gooit een exception.
- Geen enkele functie verzint een specifieke sleutel voor een niet-bevestigde
  waarde (reason-enum, foutcode) — altijd de gedocumenteerde fallback.
