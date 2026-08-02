# Prompt — GF7: Teams-keuze & spectatorroute

**⏸️ ON HOLD — niet uitvoeren.** Een onafhankelijke review
([`REVIEW-GF7-GF8.md`](REVIEW-GF7-GF8.md)) vond een echte blocker: het is niet
gezegd wáár teamkeuze in de joinvolgorde past (`POST /api/v1/games/join` maakt nu al
in één stap een sessie aan, terwijl `GAME-FLOW.md` teamkeuze vóór de lobby plaatst —
drie wezenlijk verschillende contracten zijn mogelijk, zie
[`GF8-protocol-interface-proposal.md`](GF8-protocol-interface-proposal.md) vraag 1).
Daarnaast bleken de teamidentifier (naam vs. `teamId`, punt 2 in de review),
serverbevestiging/idempotentie (punt 3) en spectator-auth/subscription (punt 4) niet
concreet genoeg om nu al te bouwen. Dit bestand blijft staan als ontwerpschets
(vandaar niet herschreven), maar wordt na antwoord op GF8 waarschijnlijk aangepast
vóórdat het wordt uitgevoerd — inclusief de robuustheidstests voor ongeldige invoer
die de review terecht miste (punt 7): geen enkele test hieronder dekt een
malformed `availableTeams`, een ongeldige state of een array-mutatiecheck, terwijl
alle andere GF-modules dat wel standaard hebben.

Onderdeel van [`../README.md`](../README.md), fase GF7 — na Golf 1, niet
launch-blocking. Doel: zo veel mogelijk nu al bouwen zonder te gokken op een
protocol-detail dat nog niet vastligt.

## Brondocument

`GAME-FLOW.md` §Teams — latere MVP-uitbreiding en §Spectatorroute — optioneel.
`GAME-RULES.md` §Teams — fase 1.5 (scoringformule; dat is de `GAME-RULES.md`-
eigenaar, niet dit plan). `DATA-MODEL.md`'s `GameConfiguration` kent al `mode` en
`teamNames: []`.

## Blokkade — niet door mij op te lossen

`PROTOCOL.md`'s event-tabellen (client→server én server→client) bevatten **geen**
event voor teamkeuze. Er is geen `player:choose-team` of vergelijkbaar, geen
payloadvorm, geen foutcode voor "ongeldig team". `GAME-FLOW.md` zegt alleen dát
teamkeuze "na naamkeuze en vóór de lobby" komt, niet hóe dat over de lijn gaat. Dit is
een `public_api`-gat, geen ontbrekend detail dat ik zelf kan invullen — het hoort in
`GF8-protocol-interface-proposal.md` als
concreet voorstel naar de `PROTOCOL.md`-eigenaar, niet hier verzonnen.

**Consequentie voor deze fase:** de team-statemachine hieronder is met opzet
gebouwd rond een abstracte "verzend dit team-verzoek"-stap, precies zoals `join-state`
(GF2a) de bron van de voorgestelde naam abstract hield toen die ook nog onbevestigd
was. Zodra GF8's voorstel is geaccordeerd, wordt alleen de vorm van het verzoek
concreet — de statemachine zelf verandert niet.

## Deel 1 — Team-selectiestate (wél te bouwen)

Bestand: `client/flow/team-selection-state.mjs`.

```js
/**
 * @typedef {
 *   | { status: 'choosing', availableTeams: string[], selectedTeam: string | null }
 *   | { status: 'submitting', selectedTeam: string }
 *   | { status: 'confirmed', teamId: string }
 *   | { status: 'error', code: string, availableTeams: string[] }
 * } TeamSelectionState
 */

/** @param {string[]} availableTeams @returns {TeamSelectionState} */
export function initialTeamSelectionState(availableTeams) {}

/** @param {TeamSelectionState} state @param {object} event @returns {TeamSelectionState} */
export function transition(state, event) {}

/**
 * Wat er nu naar de server moet, of null. Vorm is een placeholder — zie de
 * blokkade hierboven: `teamRequestFor` levert alleen `{ selectedTeam }`, geen
 * vast event-envelope, totdat PROTOCOL.md dat vastlegt.
 * @param {TeamSelectionState} state
 * @returns {{ selectedTeam: string } | null}
 */
export function teamRequestFor(state) {}
```

Events: `TEAM_SELECTED` (`{ team }`), `SUBMIT`, `TEAM_CONFIRMED` (`{ teamId }`),
`TEAM_REJECTED` (`{ code }`), `RETRY`. Zelfde non-null-tijdens-in-flight-conventie als
`joinRequestFor`/`createRequestFor`: `teamRequestFor` is alleen non-null tijdens
`submitting`.

### Regels

- `availableTeams` komt van de host-configuratie (`teamNames`), niet zelf verzonnen.
- Automatische verdeling ("spelers kiezen een team of worden automatisch verdeeld")
  is een servergestuurde uitkomst, geen clientkeuze — deze module modelleert alleen
  de kiesbare kant; `TEAM_CONFIRMED` dekt ook het geval waarin de server een team
  toewijst zonder dat de speler zelf `TEAM_SELECTED` deed (rechtstreeks vanuit
  `choosing` naar `confirmed`).
- Nooit een team kiezen dat niet in `availableTeams` staat — `TEAM_SELECTED` met een
  onbekende waarde wordt genegeerd, niet stilzwijgend geaccepteerd.

### Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialTeamSelectionState(['Rood', 'Blauw'])` | `{ status: 'choosing', availableTeams: ['Rood','Blauw'], selectedTeam: null }` |
| 2 | `TEAM_SELECTED` met een team uit `availableTeams` | `selectedTeam` bijgewerkt, status blijft `choosing` |
| 3 | `TEAM_SELECTED` met een onbekend team | genegeerd, state ongewijzigd |
| 4 | `SUBMIT` zonder gekozen team | genegeerd — geen `submitting` zonder `selectedTeam` |
| 5 | `SUBMIT` met een gekozen team | `submitting`; `teamRequestFor` levert `{ selectedTeam }` |
| 6 | `TEAM_CONFIRMED` rechtstreeks vanuit `choosing` (automatische toewijzing) | `confirmed` met de toegewezen `teamId`, ook zonder voorafgaande `SUBMIT` |
| 7 | `TEAM_CONFIRMED` vanuit `submitting` | `confirmed` |
| 8 | `TEAM_REJECTED` vanuit `submitting` | `error`, `availableTeams` blijft bewaard voor een nieuwe poging |
| 9 | `RETRY` vanuit `error` | terug naar `choosing` met dezelfde `availableTeams`, `selectedTeam: null` |
| 10 | `teamRequestFor` buiten `submitting` | `null` |

## Deel 2 — Spectatorroute (`/screen/{code}`)

**Geen nieuwe pure flow-statemodule nodig** — `route-resolver` (GF1),
`match-phase-state` (GF3) en `edge-case-messaging` (GF5) zijn als reducers
herbruikbaar. **Maar niet end-to-end gedekt:** `PROTOCOL.md` kent alleen `host`- en
`player`-rollen, geen read-only spectatorrol, geen subscribe-mechanisme zonder
sessie, en geen garantie dat persoonlijke snapshot-/eventvelden voor een spectator
worden weggelaten. Die drie vragen staan nu in
[`GF8-protocol-interface-proposal.md`](GF8-protocol-interface-proposal.md) vraag 4 —
de integratie is dus geblokkeerd op spectator-auth/subscription/projectie, niet op
ontbrekende clientlogica. Wat een spectatorscherm WEL en NIET toont ("geen
hostbediening, nooit antwoordknoppen") blijft daarnaast een renderkeuze, buiten dit
plan (Uitgangspunten #1 in [`../README.md`](../README.md)).

Enige concrete regel om te bewaken: `join-state`/`host-setup-state`/
`team-selection-state` worden **niet** geïnitialiseerd op de spectatorroute — een
spectator joint niet en kiest geen team. Dat is een integratiedetail voor wie de
modules straks samenvoegt (GF8-achtig, buiten deze prompt), niet iets om hier een
aparte functie voor te bouwen.

## Niet in scope voor GF7

- De exacte teamkeuze-eventvorm richting `PROTOCOL.md` — zie Blokkade hierboven.
- De teamscore-formule (gemiddelde per ronde) — `GAME-RULES.md`-eigenaar.
- Spectator-rendering zelf — visuele vormgeving, buiten dit plan.
- Automatische teamverdeling-logica (wie krijgt welk team) — serverbeslissing.

## Definition of done

- Alle testgevallen voor `team-selection-state` slagen, met
  `node --test client/flow/team-selection-state.test.mjs`.
- Geen enkele functie gooit een exception.
- Geen enkel bestand toegevoegd voor de spectatorroute — expliciet bevestigd dat dat
  niet nodig is, in plaats van uit gewoonte toch iets aan te maken.
