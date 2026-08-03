# Prompt — T4-6: BOUWSPRINT 1c-content

**Status: uitgevoerd.** Onderdeel van [`../PROGRESS.md`](../PROGRESS.md),
thema 4. Reactie op de BOUWSPRINT-opdracht (3 aug 2026, "geen review, geen
wachten — regie reviewt achteraf"). Twee van de vier gevraagde
onderdelen hadden geen enkele grond in de repo (geen mockup, geen
bouwticket-copy, geen bestaand scherm) — dat is aan de producteigenaar
voorgelegd via twee gerichte vragen in plaats van blind te verzinnen of de
sprint te weigeren. Antwoorden: "Ik verzin en leg zelf vast" (vormnamen +
Rondo-vocabulaire) en "Alleen binnen thema 4's eigen bestanden" (sweep-scope).
Dit document verwerkt beide antwoorden.

## Brondocument

De BOUWSPRINT-opdracht zelf (geen `09`-paragraafnummer — dit is geen
tekstcorrectie tegen een bestaand brondocument, maar nieuwe content vooruit
op nog te bouwen of net gebouwde schermen). Voor de vraagtekst-/
correct-antwoordstatus: `09-CONTENT-AND-MICROCOPY.md` §7/§9 (zie hieronder,
bleek al gedicht door een andere agent). Voor Rondo:
`docs/frontend-plan/BOUWTICKET-rondo-lobbygame.md`.

## 1 — Startknop-subregel

`lobby.startSub`: "Iedereen mee? Dan kun je beginnen" (NL) / "Everyone in?
You can start" (EN) / "¿Están todos? Puedes empezar" (ES). Bewust géén
rondeaantal of tijdsduur — `lobby.mjs`'s `update()`-model bevat geen
hostconfig (`totalRounds` e.d. worden nergens naar de lobby doorgegeven), en
een hardgecodeerd getal zou per host kunnen liegen. Gewijzigd volgens
hetzelfde patroon als `home.mjs`'s bestaande `quickStartLabel`/`quickStartSub`
(twee `<span>`s in één knop) — geen los DOM-element nodig, dus geen nieuwe
CSS-grid-area voor T5-7's tabletlayout.

## 2 — "Meedoen · 6 cijfers"

**Niet als losse, nieuwe sleutel toegevoegd — al gedekt, andere verdeling
over sleutels.** `home.mjs` heeft inmiddels (niet door mij, ook onderdeel van
dezelfde BOUWSPRINT maar door een andere thema-agent uitgevoerd) een
zes-cellen codeveld met `home.codeLabel` ("Voer de gamecode in"),
`home.codeSubmit` ("Meedoen met code") en `home.codeInvalid` ("Vul een code
van 6 cijfers in"). Dat dekt dezelfde intentie als de letterlijke
sprintregel, verdeeld over drie plekken in plaats van één string. Een vierde,
overlappende sleutel toevoegen zou een dode of dubbelop-sleutel worden —
tegen de bestaande conventie in dit document (geen ongebruikte sleutels).

## 3 — Vraagtekst per spelvorm

**Bleek al opgelost, niet door mij gebouwd.** De vorige `PROGRESS.md`-versie
signaleerde dat `gameplay.mjs` voor `real_or_fake_flag`/`higher_lower` nog
hetzelfde `flags_mc`-vraagtekst en `countryName()`-correct-antwoordstempel
toonde. Bij het opnieuw controleren tijdens deze sprint bleek een andere
agent dit al te hebben gedicht: `game.realOrFakePrompt`,
`game.higherLowerPrompt`, `game.wasReal`/`wasFake`, `game.higherLowerResult`
bestaan al in alle drie de locales én `gameplay.mjs` takt er al op af via
`model.gameType`. Zie `PROGRESS.md` §7/§9 voor de bijgewerkte niveaus.

## 4 — Vormnamen RUIT/BOL/PIEK/BLOK

**Zelf vastgelegd, per expliciete PO-instructie — geen bestaande component.**
Onderzocht: `rounda-1c.css` (regie-eigendom, bevroren voor thema's, bevat
nul vorm- of tekstinhoud), `player-chip.mjs` (heeft al een eígen, ánder
vormenstelsel: cirkel/vierkant/driehoek/ruit/vijfhoek/zeshoek/ster/kruis,
puur CSS `clip-path`, decoratief/geen i18n nodig), geen bouwticket, geen
scherm. Nieuwe sleutels `shapes.diamond`/`sphere`/`peak`/`block` (NL-namen
letterlijk uit de sprintopdracht, EN/ES door mij gekozen: Diamond/Sphere/
Peak/Block, Diamante/Esfera/Pico/Bloque). **Niet gekoppeld aan
`player-chip.mjs`** — dat component heeft zijn eigen acht vormen en is
thema 2's eigendom. Deze vier staan klaar voor wie ze wél nodig krijgt
(vermoedelijk de 1c-visuele richting), met een expliciete placeholder-notitie
in `PROGRESS.md` zodat een toekomstige lezer dit niet aanziet voor een
uit een mockup overgenomen naam.

## 5 — "+N meer"

**Wél meteen gebruikt**, geen losse placeholder: nieuwe sleutel
`lobby.moreCount` ("+{n} meer"/"+{n} more"/"+{n} más"), toegevoegd als
badge naast de bestaande "Bekijk alle spelers"-knop uit thema 5's T5-9
(samengevouwen 36+-weergave). Alleen zichtbaar zodra er ook echt spelers
achter de knop schuilgaan (`hiddenCount > 0`); vóór de eerste `update()`-call
is er nog geen `lastModel`, dus dan blijft de badge weg in plaats van "+NaN
meer" te tonen.

## 6 — Countdown-copy

`game.countdownLabel` ("Zo begint de vraag"/"Question starts in"/"La
pregunta empieza en"), toegevoegd boven het bestaande aftellende getal in
`gameplay.mjs`. Vóór deze wijziging toonde de countdown alleen een kaal
getal — voor een screenreader zijn "5… 4… 3…" losse getallen zonder context.
Label en getal zijn losse `<span>`s binnen dezelfde `aria-live="polite"`-
paragraaf, zodat de bestaande per-cijfer-tikanimatie (`gameplay-countdown-
tick`, BOUWSPRINT/E04) alleen op het getal blijft werken, niet op de hele
regel; elke tik kondigt daardoor "Zo begint de vraag: {n}" in zijn geheel aan
in plaats van een kaal getal.

## 7 — Rondo-vocabulaire

**Zelf vastgelegd, per expliciete PO-instructie.**
`BOUWTICKET-rondo-lobbygame.md` (bron: producteigenaar) specificeert het
component (`rondo.mjs`, eigendom thema 1+3) volledig qua DOM-contract en
aansturing, maar bevat zelf géén letter copy — geen uitleg, geen
lobbyrecord-label, geen pauzemelding. Nieuwe sleutels `rondo.explanation`,
`rondo.lobbyRecord` ("Beste van deze lobby: {n}"), `rondo.pauseMessage`,
drietalig. **Niet ingehangen** — `rondo.mjs` bestaat nog niet, dat is niet
mijn bestand. Deze sleutels liggen klaar voor wie het bouwt.

## 8 — Sweep hardgecodeerde strings

Scope per PO-antwoord: alleen `home.mjs`, `join.mjs`, `lobby.mjs`,
`gameplay.mjs`, `session-shell.mjs`, `hostbar.mjs`. Doorzocht op
`textContent = '...'`, `innerHTML`, en hardgecodeerde `alt`/`title`/
`placeholder`/`aria-label`-strings buiten `t()`/`tCount()` om — niets
gevonden. `.alt = ''` in `gameplay.mjs` is bewust leeg (decoratieve
vlagafbeelding), geen gemiste sleutel. Geen wijziging nodig; dit is een
schone bevinding, geen "niets gedaan".

## §12/§13-copy

Beide secties opnieuw gecontroleerd: §12 staat volledig op niveau 2, geen
open item. §13 heeft nog twee niveau-0-rijen (langdurig-mislukt-tekst,
handmatige-retry-knop), allebei expliciet gebonden aan T4-2b's PO-besluit —
dat blijft ⏸, zoals de sprintopdracht vroeg. Geen ander open copy-item in
deze twee secties.

## Regels

- Alle nieuwe sleutels in `nl.mjs`/`en.mjs`/`es.mjs` tegelijk.
- T4-2b blijft ongemoeid — geen enkele wijziging aan reconnect-drempel- of
  retry-knop-gerelateerde teksten.
- Sweep strikt beperkt tot de zes genoemde bestanden, geen andere thema's
  bestanden aangeraakt.
- Placeholder-sleutels (vormnamen, Rondo-vocabulaire) expliciet als zodanig
  gedocumenteerd in `PROGRESS.md` — niet stilzwijgend als "af" genoteerd.

## Definition of done — behaald

- `node --test`: 2896/2896 groen, inclusief `locales.test.mjs` (sleutelpariteit
  NL/EN/ES, geen lege waarden).
- `lobby.startSub`/`lobby.moreCount`/`game.countdownLabel` daadwerkelijk
  ingehangen en zichtbaar (geverifieerd via codelezing van de render-paden;
  geen aparte Playwright-sessie voor deze sprint — puur copy- en
  weergavewerk in al bestaande, net geverifieerde componenten).
- `PROGRESS.md` bijgewerkt: §6 (startknop), §7 (vraagtekst + countdown-copy),
  §9 (correct antwoord) naar niveau 2; nieuwe BOUWSPRINT-sectie met de twee
  niveau-0-placeholders; Telling-tabel herteld (52 rijen, 8/11/33/0).
- `prompts/README.md` bijgewerkt met deze rij.
