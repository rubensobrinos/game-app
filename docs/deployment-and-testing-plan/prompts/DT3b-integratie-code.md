# Prompt — DT3b: Integratietests omzetten naar code

Onderdeel van [`README.md`](../README.md), fase DT3b. Doel: scenario's uit
[`integration-matrix.md`](../integration-matrix.md) omzetten naar **direct actieve**
integratietests — maar **alleen** per scenario wiens activatiecriterium al is
gehaald.

**Herzien na [`REVIEW-DT3B-DT7.md`](REVIEW-DT3B-DT7.md) #7.** De eerdere versie
vroeg om eerst `test.skip(...)` te schrijven en die pas later te "activeren" — een
zinloze tussenstap, want stap 0 hieronder dwingt toch al af dat er alleen aan een
rij gewerkt wordt zodra het bewijs er al is. Als de echte implementatie al bestaat
op het moment dat je de test schrijft, is er geen reden om eerst te skippen. Het
"pending, nog niet bewezen"-model bestaat al, en wel als
[`integration-matrix.md`](../integration-matrix.md) zelf (DT3a) — met
eigenaar-afhankelijkheid, prerequisite en activatiecriterium per rij. Die matrix is
de plek voor "nog niet gebouwd, houd het in de gaten"; code in `tests/integration/`
is uitsluitend voor "al bewezen". Twee registraties van dezelfde onzekerheid was de
fout.

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
2. Voor elke rij die daadwerkelijk voldoet: schrijf één **direct actieve**
   `test(...)`-blok in `tests/integration/` (geen `test.skip`) — de scenario-
   omschrijving uit de matrixrij als testnaam, en een metadata-comment
   (matrixrij-nummer, activatiecriterium-referentie, datum) puur ter traceerbaarheid,
   niet als voorwaarde om te draaien. De test moet bij het schrijven meteen slagen
   tegen de echte implementatie — zo niet, dan was het activatiecriterium niet
   werkelijk gehaald en hoort de rij nog in de matrix te staan, niet in code.
3. Rijen 13 en 14 (round:progress-throttle, snapshot-geen-correctAnswer tegen de
   échte producer) hebben specifieke testvorm-eisen — zie hun kolom
   "Activatiecriterium" in de matrix voor de exacte meetmethode (meerdere
   antwoorden in <500 ms; diepe stringzoektocht naar `correctAnswer` in de hele
   serverresponse).

## Harde grenzen

- Geen `test.skip` in `tests/integration/` — een rij is óf nog niet rijp (blijft in
  de matrix, geen code) óf al bewezen (directe, actieve test). Niets ertussenin.
- Geen server-/opslagcode zelf bouwen om een prerequisite kunstmatig te vervullen —
  dat is de architectuur-/protocol-/data-model-/game-rules-eigenaren hun terrein.
- Blijf binnen de autonomiegrenzen per actie (zie README.md Uitgangspunt 8); bij
  meerdere geactiveerde rijen tegelijk, splits over meerdere acties.

## Definition of done

- Voor elke opgenomen rij: een direct actieve test die daadwerkelijk tegen de echte
  implementatie draait en slaagt, met het geciteerde bewijs in de commitboodschap.
- Nul `test.skip`-blokken in `tests/integration/`.
- Geen enkele rij is opgenomen op aanname in plaats van bewijs.
