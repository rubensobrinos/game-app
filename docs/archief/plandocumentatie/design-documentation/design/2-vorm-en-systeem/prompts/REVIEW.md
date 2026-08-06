# Review — prompts thema 2

Twee adversariële rondes. Vastgelegd omdat elke correctie in deze set naar een
bevinding verwijst, en zonder dit bestand kan niemand die nalopen — thema 1 en
thema 4 leggen hun review wél vast, dit thema deed dat niet.

## Ronde 1 — 3 augustus, op de eerste zeven prompts

Twee reviewers, elk met één bril en de opdracht te wéérleggen: **spec-
conformiteit** (klopt elke verwijzing, en spreekt een prompt de spec tegen?) en
**actualiteit** (is het al gebouwd, doet een ander thema het al, klopt de
beschreven beginsituatie?). Samen 62 bevindingen.

De zwaarste vier:

| # | Bevinding | Verwerkt |
| --- | --- | --- |
| 1 | De motion-tokenpatstelling was eenzijdig opgelost: thema 3 had het voorstel geaccepteerd en `M1` herschreven, terwijl de README nog weigerde te leveren op grond van een conflict dat niet meer bestond. Alle animatie stond op thema 2 te wachten. | `T2-8` geschreven en uitgevoerd (`8eb1996`), `UI-9` op ✅ |
| 2 | `T2-1` mapte `--accent-glow` naar `--color-focus-glow` — een naam die in geen enkel document staat — en verenigde daarmee precies wat `05` §2.6 scheidt (focusring is geen decoratieve glow). `--color-focus` viel daardoor uit zowel de mapping als de ontbrekende-rollenlijst. | `T2-1` herschreven |
| 3 | `T2-4` vulde `O-009` in door de werkhypothese als bindend te citeren, terwijl `T2-7` in dezelfde set juist stelt dat een agent dat niet mag. Twee maten in één set. | Voorgelegd aan de producteigenaar → `D-022` |
| 4 | `T2-5`'s definition of done eiste dat de code zichtbaar is "ook tijdens een actieve vraag" zonder te zeggen wat het QR-pictogram dan doet — `05` §12 en `00` §5 verbieden een overlay over actieve spelinhoud. | Als expliciete keuze in `T2-5` gezet |

Verder feitelijk fout en gecorrigeerd: negen overschreven tokens waren er
dertien, zeventien rollen waren er negentien, de DoD-grep van `T2-1` sloeg vijf
tokens over, `T2-2` beschreef een beginsituatie die thema 4 al had ingehaald,
`T2-4` citeerde `D-008` (dat over munten en power-ups gaat) als grond voor
tijdelijke identiteit, `T2-6` beweerde dat het label `Jij` al op de eigen rij
stond, en `T2-7` vroeg de producteigenaar iets vast te stellen over goud dat
thema 5 al had opgelost.

**Gat:** `Overlays` blokkeerde thema 1 maar had geen prompt en stond ook niet
bij de bewuste weglatingen. Dat werd `T2-9`.

## Ronde 2 — na de herziening, inclusief de twee nieuwe prompts

Eén reviewer, opdracht: zijn de correcties zélf correct, en wat is er mis met
`T2-8` en `T2-9` die nog nooit bekeken waren? 25 bevindingen.

De drie zwaarste:

| # | Bevinding | Verwerkt |
| --- | --- | --- |
| 1 | `T2-9` wees `S17` een bottom sheet toe, terwijl dat vandaag geen overlay is maar een inline verwijderknop per rij, en thema 1 in `01-snelle-reparaties.md` juist voor inline heeft gekozen. De prompt verbood zelf "geen nieuwe overlay toevoegen". Daarnaast claimde hij het desktop-zijpaneel dat thema 5's `T5-7` óók claimt. | `S17` uit de prompt; afstemming met `T5-7` als harde voorwaarde opgenomen |
| 2 | `T2-2` en `T2-7` waren herzien wégens verouderde beginsituaties en bevatten er elk nog één: de knop heet geen `Snel starten` meer maar `Start direct een game` (waardoor het layoutshift-argument omklapt — de knop wordt smaller, niet breder), en thema 5 had zijn blokkade op `O-002`/`O-003` expliciet ingetrokken en `T5-7`/`T5-8` alsnog geschreven. | Beide gecorrigeerd, en `UI-11` versmald tot alleen thema 2 |
| 3 | `T2-8` haalt de motiontokens uit fase 3 zonder het besluit dat dezelfde set voor `D-022` wél eiste, en levert negen tokens waarvan er zes geen gebruiker hebben — wat `T2-1` in dezelfde set juist verbiedt. De uitvoering bevestigde het: `--ease-press` stond op een hover-transitie. | Ease-fout gecorrigeerd; de fase- en ongebruikte-tokenvraag staat open, zie hieronder |

Ook uit deze ronde en verwerkt: `05` §12 verbiedt een popover over een actieve
vraag "behalve essentiële mute/noodactie", en die uitzondering telt juist voor
het voorkeurenpaneel (`06` §5, `O-008`) — `T2-9` citeerde de regel strenger dan
hij is. En het voorkeurenpaneel is vandaag een disclosure, geen dialog; het
omzetten naar een sheet is een ARIA-patroonwissel, niet een verbouwing.

## Bewust niet verwerkt

- **`T2-8` haalt fase-3-werk naar voren zonder besluit.** Dat klopt formeel.
  Maar de tokens waren nodig om thema 3 te deblokkeren, en het alternatief was
  hem langer laten stilstaan voor een besluit over een CSS-variabele. Als de
  producteigenaar dit terug wil draaien is dat één commit.
- **Zes van de negen motion-tokens hebben geen gebruiker.** `T2-1`'s regel
  ("een ongebruikte rol is erger dan een ontbrekende") geldt voor kleurrollen,
  waar een ongebruikte rol een verkeerde toepassing uitnodigt. Bij een
  durationschaal is de volledigheid juist het punt: thema 3 moet kunnen kiezen
  zonder terug te komen. Dit staat als expliciete afwijking in `PROGRESS.md`.
- **`Loading / empty / error` blokkeert thema 1 en 4 en heeft geen prompt.**
  Terecht gesignaleerd — `T2-2` dekt alleen de laadstaat op knoppen, niet de
  lege en foutstaten. Dit is hetzelfde gat waarvoor `T2-9` is geschreven en het
  is bij deze ronde niet gedicht. **Openstaand.**
