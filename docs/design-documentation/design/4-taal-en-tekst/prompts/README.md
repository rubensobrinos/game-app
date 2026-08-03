# Prompts — 4. Taal en tekst

Breekt `PROGRESS.md`'s bevindingen op in kleinere, uitvoerbare stappen —
zelfde stijl als `docs/frontend-plan/prompts/`: brondocument, exacte
voor/na-tekst, Regels, Definition of Done.

| Bestand | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- |
| [`T4-1-terminologie-en-directe-correcties.md`](T4-1-terminologie-en-directe-correcties.md) | uitgevoerd | Pure tekstvervangingen, geen state/logica-wijziging | niets |
| [`T4-2a-statusteksten-direct-uitvoerbaar.md`](T4-2a-statusteksten-direct-uitvoerbaar.md) | uitgevoerd | Loadingstatus, lege lobby, hersteld-bevestiging + antwoord-geruststelling | T4-3 (`answerSaved` leunt op de hydratatiefix) |
| [`T4-2b-reconnect-drempel-en-handmatige-retry.md`](T4-2b-reconnect-drempel-en-handmatige-retry.md) | open — wacht op PO-besluit | `connection.reconnectFailed`-drempel + handmatige retry-knoppen | PO-besluit over drempel en knopgedrag |
| [`T4-3-vraagtekst-en-geen-antwoord-staat.md`](T4-3-vraagtekst-en-geen-antwoord-staat.md) | uitgevoerd, herontworpen ná reviewfeedback | Vraagtekst + snapshot-hydratatie zodat `GEEN ANTWOORD` server-autoritatief is | niets |
| [`T4-4-pure-aanvullingen-zonder-afhankelijkheden.md`](T4-4-pure-aanvullingen-zonder-afhankelijkheden.md) | uitgevoerd, F2 verwerkt vóór uitvoering | Belofte-regel, sociaal bewijs ná uitnodigingslink, vergrendelstatus in de lobby | niets |
| [`T4-5-host-specifieke-copy.md`](T4-5-host-specifieke-copy.md) | uitgevoerd, F1 verwerkt vóór uitvoering (`selfName`-prop toegevoegd) | Spelerslobby-copy + host-pauzestempel | niets |

[`REVIEW.md`](REVIEW.md) — feitelijke controle van T4-4/T4-5 en de
(inmiddels opgeloste) bugmelding tegen de code (3 aug 2026). Zes bevindingen;
F1 en F2 zijn verwerkt in de prompts zelf vóór uitvoering, F4/F5/F6 in de
bugfix (zie `PROGRESS.md` §9), F3 blijft een open coördinatiepunt met
thema 1.

T4-2 is na reviewfeedback opgesplitst in T4-2a (geen open productbesluit,
direct uitvoerbaar) en T4-2b (wél een open productbesluit) — zie de uitleg
bovenaan T4-2b.

Bewust nog geen prompt voor (geverifieerd tegen de code, niet aangenomen):

- **Gelijke plaatsen** (§11) — vraagt eerst een productbesluit over de
  tie-regel zelf (wie staat bovenaan bij een gelijke stand?), niet alleen
  tekst. Wel al een `standings.sharedPlace`-sleutel aanwezig, vooruitlopend
  op `HANDOFF-UI.md` UI-15.
- **Sociale headlines** (§10) — de copy-helft is van hier, maar zonder de
  selectielogica (thema 1, S14) heeft een templateset nergens een plek om te
  verschijnen. Wacht op afstemming met thema 1.
- **Countdown-copy** (§7) — het scherm zelf bestaat nog niet (thema 1, S07).
- **Naam-botsingsmelding** (§5) — de server voegt de suffix stil toe zonder
  een apart signaal (`nameSource` onderscheidt alleen server-verzonnen van
  zelf-gekozen, niet "botste met een bestaande naam"). Vraagt een
  protocolveld, geen tekstwerk — buiten mijn bevoegdheid zonder overleg.
- ~~**Rank movement** (§9)~~ — **niet meer geblokkeerd, en inmiddels
  opgelost** (door thema 1/3, niet hier): `standings-model.mjs` heeft nu
  `rankMovementFrom()` en `scoreboard.mjs` toont de ↑/↓-badge. Deze
  auditronde vond dat de vorige versie van dit document dat nog niet had
  bijgewerkt.
- ~~**Podium: delen/afsluiten** (§11)~~ — **inmiddels ook opgelost** (niet
  hier): `podium.mjs` heeft nu `podium.share`/`podium.newGame`/`podium.close`.

**Nieuw gevonden tijdens de documentatie-auditronde (3 aug 2026), nog geen
prompt voor:**

- **Vraagtekst/correct-antwoord voor niet-`flags_mc`-spelvormen** (§7, §9) —
  `round-model.mjs` ondersteunt al `real_or_fake_flag`/`higher_lower`, maar
  `gameplay.mjs` is nog hardgecodeerd op vlaggen. Nog niet urgent:
  `host-setup-state.mjs`'s `gameTypes` staat vast op `['flags_mc']`, dus
  onbereikbaar voor een host — wél iets dat meteen kapot is zodra dat opengaat.
  Geen prompt zolang dat niet aan de orde is.
- **"Spel aanpassen"-scherm** (`host-setup.mjs`, 27 `hostSetup.*`-sleutels)
  — nieuw scherm zonder eigen `09`-paragraaf om tegen te toetsen. Niet
  volledig geaudit, alleen de link zelf (`09` §4) is bevestigd. Geen prompt
  zolang er geen brondocument voor de inhoud van dit scherm is.
