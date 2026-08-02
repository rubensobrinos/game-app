# Prompt — DT3b: Integratietests omzetten naar code

Onderdeel van [`README.md`](../README.md), fase DT3b. Doel: scenario's uit
[`integration-matrix.md`](../integration-matrix.md) omzetten naar uitvoerbare
`test.skip`-code, mét metadata en een staleness-controle — maar **alleen** per
scenario wiens activatiecriterium al is gehaald.

## Status: volledig geblokkeerd

Op het moment van schrijven heeft **geen enkele** van de 14 rijen in
[`integration-matrix.md`](../integration-matrix.md) haar activatiecriterium gehaald
— elke rij vereist een werkende serverkoppeling (echte create/join-endpoints, echte
state machine, echte Redis-opslag) die nog niet bestaat. Dit prompt-bestand bestaat
zodat het klaarligt voor review en direct bruikbaar is zodra dat verandert — niet om
nu te worden uitgevoerd.

## Stappen (pas uitvoeren als een rij's activatiecriterium is gehaald)

1. **Verplichte stap 0, vóór alle andere stappen:** open
   [`integration-matrix.md`](../integration-matrix.md), controleer per rij het
   activatiecriterium tegen de daadwerkelijke stand van `server/`. Werk alleen aan
   rijen die aantoonbaar voldoen — citeer het bewijs (bestand + functie/test) in de
   commit- of PR-omschrijving.
2. Voor elke geactiveerde rij: schrijf één `test.skip(...)`-blok in
   `tests/integration/`, met:
   - de scenario-omschrijving uit de matrixrij als testnaam;
   - een metadata-comment: matrixrij-nummer, activatiecriterium-referentie, datum
     van activatie;
   - de daadwerkelijke test-body (niet alleen de skip) al geschreven en klaar om
     zonder wijziging te draaien zodra de `skip` verwijderd wordt.
3. Voeg een aparte, kleine controle toe (los testbestand of script) die faalt als
   een `test.skip` in `tests/integration/` ouder is dan een ingebouwde
   staleness-grens (bijv. 30 dagen) zonder heractivatie-review — dit is de
   REVIEW.md #6-eis: een vergeten skip mag niet stilzwijgend groen blijven.
4. Rijen 13 en 14 (round:progress-throttle, snapshot-geen-correctAnswer tegen de
   échte producer) hebben specifieke testvorm-eisen — zie hun kolom
   "Activatiecriterium" in de matrix voor de exacte meetmethode (meerdere
   antwoorden in <500 ms; diepe stringzoektocht naar `correctAnswer` in de hele
   serverresponse).

## Harde grenzen

- Nooit een `test.skip` activeren (de `skip` verwijderen) zonder dat het
  activatiecriterium uit de matrix expliciet is geciteerd als bewijs.
- Geen server-/opslagcode zelf bouwen om een prerequisite kunstmatig te vervullen —
  dat is de architectuur-/protocol-/data-model-/game-rules-eigenaren hun terrein.
- Blijf binnen de autonomiegrenzen per actie (zie README.md Uitgangspunt 8); bij
  meerdere geactiveerde rijen tegelijk, splits over meerdere acties.

## Definition of done

- Voor elke opgenomen rij: een niet-skippende test die daadwerkelijk tegen de echte
  implementatie draait, met het geciteerde bewijs in de commitboodschap.
- De staleness-controle bestaat en faalt aantoonbaar op een kunstmatig verouderde
  skip (test dat zelf).
- Geen enkele rij is geactiveerd op aanname in plaats van bewijs.
