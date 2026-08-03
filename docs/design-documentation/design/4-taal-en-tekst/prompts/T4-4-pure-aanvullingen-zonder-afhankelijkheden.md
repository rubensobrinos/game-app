# Prompt — T4-4: Pure aanvullingen zonder afhankelijkheden

Onderdeel van [`../PROGRESS.md`](../PROGRESS.md), thema 4. Brengt drie
niveau-0-rijen naar niveau 1: alle drie geverifieerd als puur tekst/UI-werk
met data die al bestaat — geen protocolwijziging, geen PO-besluit nodig.

## Brondocument

`09-CONTENT-AND-MICROCOPY.md` §4 (belofte-regel), §5 (sociaal bewijs), §6
(vergrendelstatus).

## 1 — Belofte-regel op de startpagina

`views/home.mjs`: statische regel onder de titel, geen state-afhankelijkheid.

- Nieuwe sleutel `home.promise`: `Geen account. Geen download. Iedereen
  speelt op zijn eigen telefoon.`
- Altijd zichtbaar op het startscherm, geen voorwaarde.

## 2 — Sociaal bewijs bij het invoeren van een gamecode

De data bestaat al: `GET /games/preview` retourneert `playerCount`
(`server/protocol/preview-endpoint.mjs:100-121`, ook al doorgegeven via
`transport.previewInvite()` in zowel `transport.mjs:250-252` als
`transport-mock.mjs:135-150`). `views/join.mjs:83-84` gebruikt momenteel
alleen `preview.suggestedName` uit die respons — `playerCount` wordt nergens
uitgelezen. Dit is dus geen ontbrekende data, alleen ontbrekende UI.

- Nieuwe sleutel (pluraliseerbaar, gebruik `tCount`, zie de bestaande
  `lobby.playerCount`): `join.waitingCount` — `.one`: `1 speler wacht al`,
  `.other`: `{n} spelers wachten al`.
- Toon deze regel in `join.mjs` zodra de preview is opgehaald en
  `playerCount > 0`; verberg 'm bij `playerCount === 0` (dan is er niemand om
  over te berichten) en tijdens het laden.

## 3 — Vergrendelstatus zichtbaar in de lobby

De state bestaat al client-side: `locked` zit in de `room:state`-snapshot en
in het losse `room:lock-changed`-event, en wordt al verwerkt in
`session-shell.mjs:152,348-349,387` en doorgegeven aan `hostbar.mjs:95-97`
(dat toont al lock/unlock-knoptekst). `lobby.mjs` zelf toont nergens dat de
room op slot zit — dat is het gat.

- Nieuwe sleutels: `lobby.locked`: `Room vergrendeld`, `lobby.unlocked`:
  `Nieuwe spelers kunnen weer meedoen`.
- Toon `lobby.locked` als een zichtbare regel in `lobby.mjs` zolang
  `locked === true`; bij het ontgrendelen kort (zelfde 3s-patroon als
  `connection.connected` uit T4-2a) `lobby.unlocked` tonen, dan weer stil.
  Geef `locked` als prop door aan `createLobbyView()` — zelfde patroon als
  `isHost` al wordt doorgegeven (`session-shell.mjs:470`).

## Regels

- Alle nieuwe sleutels in `nl.mjs`, `en.mjs`, `es.mjs` tegelijk, en
  `locales.test.mjs` moet groen blijven zonder aanpassing (parity-check dekt
  dit al automatisch).
- `join.waitingCount` gebruikt `tCount`, geen los enkelvoud/meervoud-if.
- Geen nieuwe transport-aanroepen nodig voor punt 2 en 3 — alleen bestaande
  respons-/snapshotvelden eindelijk uitlezen.

## Definition of done

- Handmatig tegen `transport-mock.mjs`: startpagina toont de belofte-regel;
  een tweede speler die een code intikt ziet "1 speler wacht al" ná het
  aanmaken van een game door de host; de host ziet "Room vergrendeld" in de
  lobby ná `game:lock`, kort "Nieuwe spelers kunnen weer meedoen" ná
  `game:unlock`.
- `node --test` groen (volledige suite, niet alleen frontend).
- `PROGRESS.md` §4 (belofte-regel), §5 (sociaal bewijs), §6-host
  (vergrendelstatus) naar niveau 1.
