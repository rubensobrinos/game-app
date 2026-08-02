# Prompt — UI4: Tussenstand + Eindpodium

Onderdeel van [`../README.md`](../README.md), fase UI4. Vereist UI0, UI3 (de
rondedata-aanpak). Bouwt scherm 5 van UI1a.

## Brondocument

`GAME-FLOW.md` §Spelscherm (tussenstand: top 5 + eigen positie; eindpodium),
Randgeval 12 (rematch). `PROTOCOL.md` `scoreboard:updated`, `game:finished`,
`game:rematch-started`.

## Tussenstand (fase `SCOREBOARD`)

`scoreboard:updated` → top 5 + eigen positie (`PROTOCOL.md`: "top 5, eigen
positie"). Toon namen via `textContent`. Dit scherm verschijnt niet elke ronde
verplicht — `scoreboardFrequency` is roomconfiguratie; toon simpelweg wat
`match-phase-state`'s fase op dat moment is (`SCOREBOARD` of niet), geen eigen
aanname over de frequentie.

## Eindpodium (fase `FINISHED`)

`game:finished` → podium + eigen samenvatting. Toon minimaal de top 3 en de
eigen eindpositie/score.

**Rematch-knop**, alleen voor de host: `host-controls-state.availableHostActions(context)`
bevat `'rematch'` zodra `phase === 'FINISHED'`. Bij een tik:
`hostActionRequest('rematch', context)` → versturen. Bij `game:rematch-started`
gaat `match-phase-state` terug naar `LOBBY` met een nieuwe `matchId` — de
viewswitcher (UI0) toont dan vanzelf weer het lobbyscherm (UI2), geen aparte
overgangslogica hier nodig.

Niet-hosts zien geen rematch-knop, maar wél een wachtmelding
("wacht op de host") — geen losse foutmelding als ze proberen te rematchen,
toon de knop simpelweg niet.

## Regels

- Score/positiedata komt uitsluitend uit de payloads — geen eigen optelsom of
  ranking berekenen.
- Nooit `innerHTML` voor namen.

## Definition of done

- Tegen `transport-mock.mjs`: na de laatste ronde toont het podium correct;
  rematch (als host) brengt alle "spelers" terug naar de lobby met scores op
  nul (geverifieerd via `match-phase-state`'s nieuwe `matchId`, niet zelf
  scores resetten in dit scherm — dat doet de server).
- `UI-PROGRESS.md` bijgewerkt.
