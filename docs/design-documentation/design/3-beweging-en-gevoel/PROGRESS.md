# Voortgang — 3. Beweging en gevoel

**Eigenaar:** UI — toegewezen 3 augustus 2026
**Documenten:** `06-MOTION-SOUND-AND-FEEDBACK.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties F, G en H (motion/reveal/podium),
plus twee criteria die dit gebied deelt met thema 5: K ("Respecteert motion de
systeemvoorkeur?", "Is geluid uitschakelbaar en niet essentieel?") en M
(§9 Performancebudget — "Zijn animaties performant op middelmatige
Androidhardware?"). De oorspronkelijke verwijzing (alleen F en G) miste H's
twee directe motion-checks (confetti/reduced-motion, finale overslaan) en
negeerde dat reduced-motion/geluid-mute ook letterlijk in K staan.
Schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53` + kritische pas UI

Dit gebied is geen lijst onderdelen maar een **gebeurteniscatalogus**: `06`
beschrijft vijftien momenten (`E01`–`E15`) waarop het spel hoort te reageren.
De vraag per regel is dus niet "hoe ziet het eruit" maar "vuurt er iets, en
wanneer".

Ook geldt hier een bijzondere rekenregel: **dit gebied *is* niveau 3 voor alle
andere vier.** Een 1 hier betekent dat er íéts van feedback is; een 2 is
choreografie. Dat dit gebied achterloopt is verwacht, niet alarmerend — het is
de laag die pas zin heeft als de schermen eronder staan.

## De vijftien momenten

| # | Moment | Fase | Niveau | Wat er vuurt (of niet) |
|---|---|---|---|---|
| E01 | Knop indrukken | overal | 1 | `:active` geeft een kleine schaalsprong op `.btn-primary`, `.btn-secondary`, `.btn-destructive` en `.gameplay-option` (geverifieerd in `components.css`). **Ontbreekt met naam op `.btn-opt` (taal-/themaknoppen in het hamburgermenu) en `.btn-icon` (hamburgerknop, QR-terugknop)** — geen haptiek nergens. |
| E02 | Potje maken | landing | 0 | Knop wordt alleen disabled. Geen labelwissel, geen voortgang. |
| E03 | Speler komt binnen | lobby | 0 | Naam verschijnt zonder overgang, teller pulseert niet, geen batching bij bulkjoins. |
| E04 | Countdown | rondestart | 0 | Het scherm bestaat niet. **Afhankelijk van thema 1** (`S07`) — er is niets om te choreograferen vóór dat scherm bestaat. |
| E05 | Antwoordselectie | vraag | 1 | Gekozen optie krijgt direct een accentrand — géén goed/fout, dus anti-afkijk klopt. Hergebruikt E01's pressfeedback (zie noot); geen aparte pressanimatie, geen haptiek. |
| E06 | Antwoord bevestigd | vraag | 1 | Statustekst verschijnt, opties vergrendelen. Bouwt óók op E01. Geen `Verstuurd ✓` in de component (bewust, `D-021`), andere opties dimmen niet. |
| E07 | Laatste drie seconden | vraag | 0 | Timer verandert niet van uiterlijk of tempo. |
| E08 | Ronde sluit | rondeslot | — | **Vervalt als apart event ná review.** Bestaat niet als zelfstandig clientmoment: `optionsLocked()` staat voor wie al antwoordde al sinds E06 op `true`, en voor wie niet antwoordde komt sluiten en de volledige uitslag (E09) gelijktijdig binnen via `round:ended`. Samengevoegd met het begin van E09; het ontbrekende protocolmoment is gemeld als `HANDOFF-UI`-item, niet stilzwijgend opgelost. |
| E09 | Reveal correct antwoord | reveal | 1 | Correcte optie krijgt een groene rand, eigen resultaat verschijnt als tekst. Geen opbouw, fout gekozen optie wordt niet gemarkeerd. |
| E10 | Punten tellen | reveal | 1 | Eindwaarde staat direct in de DOM — goed voor toegankelijkheid. Geen oplopende telling. |
| E11 | Rank movement | tussenstand | 0 | Rijen springen naar hun nieuwe plek zonder beweging of `↑2`-notatie. |
| E12 | Sociale headline | reveal | 0 | Bestaat niet. **Afhankelijk van thema 1** (`S14`, geen plek in de flow) **én thema 4** (geen sjabloontekst) — niet zelfstandig te bouwen. |
| E13 | Streak | reveal | 0 | Bestaat niet. **Zelfde afhankelijkheid als E12.** |
| E14 | Podium | eind | 0 | Volledige lijst verschijnt ineens. Geen 3→2→1, geen confetti. |
| E15 | Reconnecting | overal | 1 | Statusbalk verschijnt en verdwijnt. Geen voortgang, geen successcue. |

**E01 is geen los item.** E05 en E06 hergebruiken letterlijk dezelfde
pressfeedback — `06` beschrijft die daar opnieuw omdat het de vraagcontext is,
niet omdat het een ander mechanisme is. E01 op alle controls + motion-tokens
brengen dus een deel van E05/E06 gratis mee, in plaats van drie keer evenveel
werk te zijn.

## Voorgestelde toevoeging: E16 — Overlay/dialoog open-dicht

**Niet stilzwijgend toegevoegd — expliciet voorstel voor `06`, nog niet
bevestigd.** De vijftien momenten dekken geen enkele dialoogtransitie. Drie
bestaande dialogen (hamburgermenu, QR-overlay, pauze-overlay) wisselen nu
puur via `hidden`/`display:none` — geen fade, geen scale, niets. Dat is een
reëel gat, geen editorial keuze: deze drie zijn precies de plekken waar `06`
§2's regel ("feedback op input start vrijwel onmiddellijk") al door focus-
beheer wordt gedekt, maar niet door motion.

| # | Moment | Fase | Niveau | Wat er vuurt (of niet) |
|---|---|---|---|---|
| E16 (voorstel) | Overlay/dialoog open-dicht | overal | 0 | Hamburgermenu, QR-overlay, pauze-overlay tonen/verbergen instant. Geen fade/scale, dus ook niets om onder `prefers-reduced-motion` te downgraden — dat werkt toevallig al goed. |

## Wat er onder die momenten hoort te liggen

| Fundament | Niveau | Stand |
|---|---|---|
| Motion-tokens | — | **Eigenaarschap verhuisd naar thema 2 ná `HANDOFF-UI` UI-9** (thema 2, 3 aug 2026): tokens hoorden bij zowel dit `PROGRESS.md` als thema 2's — twee schrijvers op één blok in `base.css`, hetzelfde patroon dat al eerder misging (`05` §15). Akkoord: thema 2 levert en beheert `--motion-instant` t/m `--motion-stage`, thema 3 consumeert. Niveau bijhouden gebeurt voortaan in `2-vorm-en-systeem/PROGRESS.md`. |
| `prefers-reduced-motion` | 1 | **Bijgewerkt:** een blanket-regel staat inmiddels in `base.css` (door een andere agent, nog niet gecommit op moment van schrijven) — `animation`/`transition-duration` naar vrijwel nul, `scroll-behavior: auto`. Dekt de vloer; niveau 2 pas zodra `M2`'s inhoudelijke vervangingen (podium direct compleet, score direct definitief, geen carrousel) er ook zijn — zie `prompts/M0-reduced-motion.md`. |
| Mute-mechanisme | 0 | **Losgetrokken van "Geluidslaag":** een UI-schakelaar + lokaal bewaarde voorkeur, exact hetzelfde patroon als de bestaande taal-/themaknop. Vandaag bouwbaar, geen open besluit nodig — er is alleen nog niets om te muten. |
| Geluidsarchitectuur | 0 | Assets, mixer, categorieën (§5). Zit vast op `O-008` (wie bestuurt geluid) én op geluidsassets die nog niet bestaan — dit deel kán ik niet alleen oplossen. |
| Haptiek | 0 | Geen `navigator.vibrate` bij submit of reveal. |
| Performancebudget | 0 | `06` §9 (transform/opacity-only, confetti-limiet, test op middelmatige Androidhardware) staat nergens als vastgelegde regel — toevallig nog niet geschonden omdat er nog geen motion is, maar ook niet getoetst. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Momenten (14, `E08` vervallen/samengevoegd met `E09`) | 8 | 6 | 0 | 0 |
| Momenten incl. voorstel `E16` | 9 | 6 | 0 | 0 |
| Fundamenten (Motion-tokens nu bij thema 2, zie hieronder) | 4 | 1 | 0 | 0 |

## Afhankelijkheden van andere thema's

Niet alles hier is zelfstandig te trekken. Drie momenten wachten op een
andere eigenaar vóór er iets te choreograferen valt:

- **E04 (countdown)** — thema 1 moet `S07` bouwen.
- **E12 (sociale headline)**, **E13 (streak)** — thema 1 moet `S14` een plek
  in de flow geven, thema 4 moet de sjabloonteksten schrijven.

Tot die er zijn, blijven deze drie op 0 staan ongeacht hoeveel tijd hier
wordt gestoken — dat is geen onderschatting, dat is de afhankelijkheid
correct weergeven in plaats van 'm te verstoppen.

## Volgorde die ik zou aanhouden (herzien ná review, 3 aug 2026)

Een review van de zes prompts (`prompts/`) leverde elf bevindingen op — vier
"Hoog": de reduced-motion-regel verkort een scale in plaats van 'm te
verwijderen (`06` §7 is expliciet), `E06` liet opties dimmen vóór de
serverbevestiging, `E08` bleek geen zelfstandig clientevent te zijn, en `M3`
onderschatte de techniek van een echte dialoogsluitanimatie. Alle vier
verwerkt in de prompts zelf; zie die bestanden voor het volledige verhaal.
Oordeel: M0/M5 goedgekeurd ná aanscherping, M1/M2/M4 bijgesteld, M3
geparkeerd tot `E16` bevestigd is.

Herziene volgorde:

1. **`prefers-reduced-motion`, écht** — niet alleen de duur verkorten
   (bestond al), maar ook de scale zelf uitschakelen onder reduced motion,
   met een non-transform-alternatief zodat de interactie voelbaar blijft.
2. **E01 op álle acht controls** (inclusief `.btn-quiet`, `.btn-opt`,
   `.btn-icon`) zodra thema 2's motion-tokens er zijn (`UI-9`) — bestaande
   transities aanvullen, niet vervangen.
3. **E05/E06/E09/E10/E15 naar niveau 2** — met E06 pas bij `accepted`, en
   E08 samengevoegd met E09's begin (protocolgat gemeld, niet verstopt).
4. **Performancebudget direct daarna**, als meetbare gate met numerieke
   criteria — niet als losse aanname achteraf.
5. **Alleen de opslaglaag van het mute-mechanisme** (`loadMuted`/
   `saveMuted` + een gedeelde `safeSet` voor alle drie voorkeuren) — de
   zichtbare schakelaar wacht op het eerste echte audiosignaal, geen
   placebo-control tonen.
6. **`E16` pas ná expliciete bevestiging** als spec-toevoeging, én pas na
   het ontwerp van één gedeelde dialog-lifecycle-helper — niet drie losse
   fade-implementaties.
7. E04, E12, E13 pas zodra thema 1 (en voor E12/E13 ook thema 4) hun deel
   hebben geleverd.
8. Geluidsarchitectuur en haptiek blijven geparkeerd tot `O-008` beslist is.
