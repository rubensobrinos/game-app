# Prompt — 10: Verzoek `UI-15` — inconsistente tie-regel tussen `scoreboard:updated` en `game:finished`

Onderdeel van [`README.md`](README.md). **Geen bouwtaak voor thema 1.** Verzoek
aan INT-A, geschreven zoals `docs/handoff-principles.md` het voorschrijft.

## Ingetrokken aanname — met de reden (principe 8)

De eerste versie van dit item vroeg de producteigenaar om een tie-regel te
kiezen. Dat was fout: het besluit **is al genomen**. `docs/multiplayer/
GAME-RULES.md` §"Gelijke eindscore" en `docs/game-rules-plan/prompts/
GR2-standings.md` (status: "uitgevoerd, geverifieerd... competitierangschikking
is bevestigd, ontwerpbeslissing 1") leggen exact vast:

```text
Volgorde:
1. hoogste totaalscore;
2. meeste correcte antwoorden;
3. laagste totale responstijd over correcte antwoorden;
4. gedeelde positie.
```

Competitierangschikking (`1,1,3,4`, niet `1,1,2,3`) — bevestigd, niet
"voorgesteld" zoals de code-comment in `server/rules/standings.js` nog
suggereert (die comment is zelf stale, zie hieronder). `server/rules/
standings.test.js` bewijst dit met 23 doorlopende testgevallen.

## Wat wél nog een echte vraag is: twee inconsistente implementaties

**Gereproduceerd, niet aangenomen** (principe 3), via code lezen
(`server/composition/match-lifecycle.mjs`):

| Event | Functie | Gebruikt `rankPlayers()`? | Veldnaam | Gedeelde positie bij een tie? |
| --- | --- | --- | --- | --- |
| `game:finished` | `finishMatch()`, regel ~1112 | Ja | `position` | Ja |
| `scoreboard:updated` | `getScoreboard()`, regel ~1049–1071 | **Nee** — eigen `rank: index + 1` uit `getScoreboardTop()` | `rank` | **Nee** |

Twee events die conceptueel hetzelfde doen (een ranglijst tonen), met twee
verschillende regels en zelfs twee verschillende veldnamen. Wie alleen de
tussenstand test (niet de eindstand) ziet dus nooit een gedeelde plaats,
zelfs bij een exacte tie.

**Bovendien, ontdekt tijdens `1-schermen-en-flow/prompts/
08-leaderboard-en-podium.md`:** `frontend/js/transport-mock.mjs` implementeert
geen van beide — een eigen `joinedAt`-tiebreak, altijd sequentieel, altijd via
dezelfde `top`/`podium`-vorm. Testen tegen de mock (wat thema 1 tot nu toe
deed) geeft dus geen signaal over dit verschil. Dit gedrag staat gepind in
`frontend/js/transport-mock.test.mjs` (`'UI-15 (pin, geen besluit): ...'` —
de testnaam wordt bijgewerkt zodra dit item sluit, zie hieronder).

**Ook ontdekt:** de client (`frontend/js/views/standings-model.mjs`'s
`standingsFrom()`) negeert sowieso elk binnenkomend rang-/positieveld en
berekent zelf `index + 1` — dus zelfs als `scoreboard:updated` morgen
`rankPlayers()` zou gebruiken, blijft de client een gedeelde plaats verbergen
totdat hij is aangepast.

## Wat ik zou voorstellen

`getScoreboard()` zou `rankPlayers()` moeten gebruiken, net als `finishMatch()`
— één ranglogica voor beide events, één veldnaam (`position`). Maar dit is
jouw module en jouw afweging (misschien is `scoreboard:updated`'s eigen `rank`
bewust simpel gehouden voor prestatie tijdens een lopende match, en is dat een
geldige reden om het zo te laten) — vandaar een vraag, geen PR.

## Wat ik nodig heb om verder te kunnen

1. **`getScoreboard()` aansluiten op `rankPlayers()`** — dan volgt een klein,
   duidelijk afgebakend client-vervolg: `standingsFrom()` gebruikt het
   aangeleverde `position`-veld per entry in plaats van `index + 1`, en de
   gepinde test in `transport-mock.test.mjs` wordt omgedraaid naar het nieuwe
   gedrag (de test zelf zegt al welke assertie dat is).
2. **Bewust zo laten** — ook een geldig antwoord; leg dan vast waarom
   `scoreboard:updated` een lichtere ranglogica mag hebben dan `game:finished`,
   zodat de volgende die dit tegenkomt niet opnieuw denkt dat het een bug is.

## Regels

- Geen agent kiest dit stilzwijgend (`00-DESIGN-INDEX.md` §6 punt 9).
- De gepinde test in `transport-mock.mjs` niet verwijderen zonder de reden
  erbij te zetten (principe 8), ook niet als het antwoord "bewust zo laten"
  is — pas dan de naam/comment aan om dat vast te leggen.
