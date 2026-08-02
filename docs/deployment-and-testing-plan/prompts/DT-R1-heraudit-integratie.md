# Prompt — DT-R1: Heraudit DT3a tegen de huidige serverstand

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md),
opdracht 1. Doel: elke rij in [`integration-matrix.md`](../integration-matrix.md)
opnieuw checken tegen de daadwerkelijke stand van `server/`, en alleen activeren
wat aantoonbaar voldoet.

## Context

- `docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord is verleend, maar heft de
  technische prerequisites per rij niet op.
- Op 2026-08-02 was `server/index.mjs` expliciet een **placeholder**
  (`node:http`, alleen `/healthz`, `/readyz` (503), `/api/v1/time`; alle overige
  `/api/*` en `/socket.io/*` geven `501 NOT_IMPLEMENTED`). De echte game-server
  (AR5/AR6: Fastify + Socket.IO, rooms, state machine, scoring) bestond op dat
  moment nog niet. **Neem dit niet als gegeven aan** — dit repo verandert snel;
  verifieer eerst opnieuw wat er nu daadwerkelijk staat vóór je een rij beoordeelt.
- [`prompts/DT3b-integratie-code.md`](DT3b-integratie-code.md) stap 0 is exact
  deze audit; dit prompt-bestand voegt toe dat de audit nu **opnieuw en compleet**
  gebeurt, niet uitgesteld tot toevallig iemand het opmerkt.

## Stappen

1. Lees `server/index.mjs` (of het bestand dat `package.json`'s `"start"`-script
   aanwijst) om te bepalen of er inmiddels een echte route-implementatie bestaat
   voor `/api/v1/games`, `/api/v1/games/join`, `/api/v1/games/{code}/state`,
   `/api/v1/games/{code}/leave`, en Socket.IO-events.
2. Doorloop alle 14 rijen in `integration-matrix.md` één voor één. Voor elke rij:
   citeer het concrete bewijs (bestandspad + functienaam of routedefinitie) dat
   het activatiecriterium wel/niet gehaald is. Geen rij overslaan, geen aanname
   zonder citaat.
3. Voor elke rij die **wel** voldoet: volg
   [`prompts/DT3b-integratie-code.md`](DT3b-integratie-code.md) — een direct
   actieve test in `tests/integration/`, geen `test.skip`.
4. Voor elke rij die **niet** voldoet: laat de matrixrij ongewijzigd staan. Voeg
   geen speculatieve datum of "bijna klaar"-opmerking toe.
5. Werk de statusregel bovenaan `integration-matrix.md` bij met de datum en het
   aantal geactiveerde rijen (bijv. "0/14" of "3/14"), ongeacht de uitkomst.

## Harde grenzen

- Geen fictieve of gemockte integratietest voor een rij die niet voldoet — dat is
  precies wat REVIEW-DT3B-DT7.md #7 en het oorspronkelijke REVIEW.md #6 afwijzen.
- Geen server-/opslagcode zelf bouwen om een prerequisite kunstmatig te vervullen.
- Max 5 bestanden/400 regels per actie; splits bij meerdere geactiveerde rijen.

## Definition of done

- Alle 14 rijen zijn expliciet gecontroleerd, met citaat, niet alleen de
  "makkelijke" rijen.
- Het daadwerkelijke aantal geactiveerde rijen (0 of meer) staat, met bewijs, in
  zowel `integration-matrix.md` als het rapport terug naar DT-R5.
