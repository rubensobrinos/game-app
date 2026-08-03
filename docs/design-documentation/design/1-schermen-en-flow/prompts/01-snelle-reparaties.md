# Prompt — 01: Snelle reparaties

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Vier losse, kleine
fixes op code die al bestaat — geen nieuwe schermen, geen nieuwe views. Geen
onderlinge afhankelijkheid; mag in willekeurige volgorde of los gecommit
worden.

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §4.4
(`PAUSED`), [`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md)
S17, S19, S21. Zie de rijen S16/S17/S19/S21 in `../PROGRESS.md` voor de
precieze diagnose per punt.

## 1. S16 — hostbalk zichtbaar tijdens pauze

`hostbar.mjs`'s lock/kick/finish-knoppen bestaan al en `availableHostActions()`
berekent ze correct als beschikbaar tijdens `PAUSED` — het probleem is dat
`session-shell.mjs`'s pauze-overlay (`position:fixed; inset:0`) er visueel
overheen ligt. Precies hetzelfde probleem is al opgelost voor de Hervat-knop
(die staat daarom ín de overlay, zie `pauseResumeButton`).

**Aanpak:** dezelfde oplossing herhalen voor lock/kick/finish, niet een nieuwe
UI bouwen. Concreet: geef de pauze-overlay een manier om naar de bestaande
`hostBar`-instantie te renderen (of verplaats de render-aanroep zodat de
overlay 'm bevat), zodat een host tijdens `PAUSED` nog steeds kan vergrendelen,
spelers verwijderen en beëindigen — niet alleen hervatten.

## 2. S17 — dubbele deelnemersweergave

De lobby (`lobby.mjs`'s `.lobby-players`) en de hostbalk
(`hostbar.mjs`'s `.session-hostbar-players`) tonen onafhankelijk van elkaar
dezelfde `participants`-Map uit `session-shell.mjs`. Tijdens `LOBBY` ziet een
host dus twee keer dezelfde namenlijst op het scherm.

**Aanpak:** kies één plek. Voorstel (geen vast besluit — leg de keuze vast als
`HANDOFF`-item als je afwijkt): de lobby's eigen lijst krijgt inline
verwijder-knoppen voor de host, en de hostbalk se aparte spelerslijst wordt
alleen getoond in fases wáár de lobbylijst niet zichtbaar is (gameplay,
scoreboard, podium) — niet meer tijdens `LOBBY` zelf.

## 3. S19 — reconnect zonder terugvalroute

`session-shell.mjs`'s statusbalk toont de reconnect-reden, maar er is geen
`Opnieuw proberen`-knop na een paar seconden en geen definitieve terugvalroute
als het echt niet lukt (`04` S19).

**Aanpak:** na bv. 8–10 seconden onafgebroken `disconnected`/`reconnecting`
een knop tonen die de gebruiker terug naar `/` stuurt (`onLeaveHome`,
bestaat al) — geen nieuwe reconnectpoging forceren, de transportlaag doet dat
zelf al (niet aanraken, zie eerdere `HANDOFF`-afspraak).

## 4. S21 — host beëindigt vanuit lege lobby

`game:finish` is beschikbaar in élke fase behalve `FINISHED`, dus een host die
vanuit een lege `LOBBY` op "Beëindig" drukt routeert nu vermoedelijk naar het
podiumscherm met nul gespeelde rondes. Nooit getest, waarschijnlijk onzinnig.

**Aanpak:** eerst reproduceren tegen `transport-mock.mjs` om te bevestigen wat
er daadwerkelijk gebeurt. Als het inderdaad een leeg/nutteloos podium toont:
`hostbar.mjs`'s finish-bevestiging kan in `LOBBY` een ander bevestigingstekst
tonen, of `session-shell.mjs` kan bij `game:finished` met nul rondes navigeren
naar `/` in plaats van het podium te mounten — kies de kleinste ingreep, geen
nieuw S21-scherm hoeft hier nog niet bij (dat is losse scope, zie thema 1's
overige `S21`-oorzaken).

## Regels

- Geen van deze vier raakt de transportlaag-swap of `transport.mjs` — puur
  view-/orchestratielaag.
- Geen nieuwe `innerHTML`, geen nieuwe niet-vertaalde tekst.
- Elke fix apart verifiëren tegen `transport-mock.mjs`; niet met een
  gecombineerde test die bij falen niet zegt wélk van de vier stuk is.

## Definition of done

- Tijdens `PAUSED`: een host kan vergrendelen/verwijderen/beëindigen zonder
  eerst te hervatten.
- Tijdens `LOBBY`: spelersnamen staan maar op één plek.
- Reconnect die langer dan de gekozen drempel duurt toont een werkende
  terugkeerknop.
- Beëindigen vanuit een lege lobby doet iets zinnigs (gereproduceerd én
  gefixt, niet aangenomen).
- `../PROGRESS.md` bijgewerkt: de vier rijen die dit dekt (S16, S17, S19,
  S21) naar het niveau dat de fix rechtvaardigt.
