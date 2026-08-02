# Prompt — DT1a: Traceability-matrix voor PROTOCOL.md

Onderdeel van [`docs/deployment-and-testing-plan/README.md`](../README.md), fase
DT1a. Doel: elk gedocumenteerd payloadveld/regel uit `PROTOCOL.md` koppelen aan zijn
bron en aan een open beslispunt — als basis voor latere contracttests, nog niet als
bindend contract.

## Context

- [`REVIEW.md`](REVIEW.md) #5: afgeleide schema's kunnen zonder review ongemerkt
  het feitelijke protocolcontract worden. Deze matrix is het middel om dat te
  voorkomen: eerst traceren en open vragen expliciet maken, pas daarna (DT1b, na
  bevestiging door de `PROTOCOL.md`-eigenaar) contracttests schrijven.
- Bron: [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md) — de
  REST-endpoints (`/api/v1/games`, `/api/v1/games/join`,
  `/api/v1/games/{code}/state`, `/api/v1/games/{code}/leave`, `/api/v1/time`), de
  event-envelope, alle client→server- en server→client-eventtabellen, de
  foutcodes, en de `round:started`-voorbeeldpayload.

## Stappen

1. Lees `PROTOCOL.md` volledig.
2. Bouw één markdown-tabel per bronsectie (REST, event-envelope, client→server-
   events, server→client-events, foutcodes) met kolommen: veld/regel |
   brontekst-referentie (paragraaf) | verplicht/optioneel volgens de tekst | open
   beslispunt.
3. Vul "open beslispunt" alleen in waar de brontekst daadwerkelijk ruimte laat voor
   interpretatie — geen eigen aanname stilzwijgend als "zo is het" vastleggen.
4. Sluit af met een sectie "Keuze schemavorm": leg de twee opties voor (een echt
   JSON Schema met een validator-library — nieuwe dependency, dus een eigen
   `deps`-checkpoint — versus een klein, dependency-vrij JSDoc-/handmatig
   validatorcontract met `node:assert`) zonder er zelf een te activeren.
5. Sluit af met een expliciet verzoek aan de (toekomstige) `PROTOCOL.md`-eigenaar om
   deze matrix te bevestigen of te corrigeren vóórdat er contractcode op wordt
   gebouwd.

## Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/traceability-matrix.md`.
  Geen bestanden in `tests/` — dit is documentatie, geen code.
- Geen schemavorm activeren of implementeren — dat is DT1b, na bevestiging.

## Definition of done

- Het bestand bestaat, dekt alle vijf bronsecties, en bevat minimaal één echt open
  beslispunt.
- De schemavorm-keuze staat als voorstel, niet als besluit.
- Het document eindigt met een expliciet verzoek om bevestiging, niet met de
  aanname dat de matrix al geldig is.
