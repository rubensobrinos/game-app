# Prompt — T4-4: Pure aanvullingen zonder afhankelijkheden

**Status: uitgevoerd.** Onderdeel van [`../PROGRESS.md`](../PROGRESS.md),
thema 4. Bracht drie niveau-0-rijen naar niveau 2: alle drie geverifieerd als
puur tekst/UI-werk met data die al bestaat — geen protocolwijziging, geen
PO-besluit nodig. **Punt 2 gecorrigeerd ná [`REVIEW.md`](REVIEW.md) F2** —
het geldt alleen voor het uitnodigingslink-pad, niet voor een ingetikte
gamecode.

## Brondocument

`09-CONTENT-AND-MICROCOPY.md` §4 (belofte-regel), §5 (sociaal bewijs), §6
(vergrendelstatus).

## 1 — Belofte-regel op de startpagina

`views/home.mjs`: statische regel onder de titel, geen state-afhankelijkheid.

- Nieuwe sleutel `home.promise`: `Geen account. Geen download. Iedereen
  speelt op zijn eigen telefoon.`
- Altijd zichtbaar op het startscherm, geen voorwaarde.

## 2 — Sociaal bewijs ná een uitnodigingslink

**Correctie (`REVIEW.md` F2):** dit werkt alléén ná een uitnodigingslink,
niet ná het intikken van een gamecode. Een code-locator slaat de
`previewing`-status in `join-state.mjs:145-155` volledig over en landt
direct in `name-entry` (met `suggestedName: null`) — `previewInvite()` wordt
dan nooit aangeroepen, dus er is geen respons om `playerCount` uit te halen.
`transport.mjs:245-247` bevestigt hetzelfde aan de transportkant: het
preview-eindpunt is uitsluitend `inviteId`, geen `gameCode`-variant
(`PROTOCOL.md`). Thema 1's `06-start-en-join-polish.md` S04.2 documenteert
deze beperking al.

De data bestaat wél voor het invite-pad: `GET /games/preview` retourneert
`playerCount` (`server/protocol/preview-endpoint.mjs:100-121`, ook al
doorgegeven via `transport.previewInvite()` in zowel `transport.mjs:250-252`
als `transport-mock.mjs:135-150`). `views/join.mjs:83-84` gebruikt momenteel
alleen `preview.suggestedName` uit die respons — `playerCount` wordt nergens
uitgelezen. Dit is dus geen ontbrekende data, alleen ontbrekende UI, en
uitsluitend op het moment dat `join-state.status === 'previewing'` bestaat.

- Nieuwe sleutel (pluraliseerbaar, gebruik `tCount`, zie de bestaande
  `lobby.playerCount`): `join.waitingCount` — `.one`: `1 speler wacht al`,
  `.other`: `{n} spelers wachten al`.
- Toon deze regel in `join.mjs` alleen tijdens/ná de `previewing`-status
  (dus nooit voor een code-locator) en zodra `playerCount > 0`; verberg 'm
  bij `playerCount === 0` (dan is er niemand om over te berichten) en
  tijdens het laden.

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

## Definition of done — behaald

- Browserverifieerd tegen `transport-mock.mjs` (Playwright, echte UI-clicks):
  startpagina toont de belofte-regel; een tweede speler die de
  uitnodigingslink opent (niet: een code intikt) ziet "1 speler wacht al" ná
  het aanmaken van een game door de host; de host ziet "Room vergrendeld" in
  de lobby ná het klikken van de vergrendelknop, kort "Nieuwe spelers kunnen
  weer meedoen" ná het ontgrendelen.
- `node --test`: 2749/2749 groen (volledige suite).
- `PROGRESS.md` §4 (belofte-regel), §5 (sociaal bewijs), §6-host
  (vergrendelstatus) naar niveau 2.
